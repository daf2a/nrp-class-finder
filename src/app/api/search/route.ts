import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Participant, ClassResult } from '@/types';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const ALLOWED_CLASSES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'P', 'T'];
const MK_ID_LIST = [
    "EF4403", "EF4406", "EF4401", "EF4601", "EE4101", "ER4301",
    "EF4405", "EF4402", "EF4702", "EF4510", "EF4610", "EF4609",
    "EF4617", "EF4202", "EF4201", "EK4501", "EF4714", "EF4801",
    "EF4615", "EF4712", "EF4605", "EF4101", "EF4619", "EF4614",
    "EF4613", "EF4602", "EF4607", "EF4606", "EF4603", "EF4604",
    "EF4204", "EF4625", "ER4402", "ER4503", "EF4404", "EF4203", 
    "EF4701"
];

// Ubah konstanta timeout dan retry
const REQUEST_TIMEOUT = 10000; // Naikkan menjadi 10 detik
const MAX_RETRIES = 3; // Naikkan retry
const RETRY_DELAY = 2000; // Delay antar retry 2 detik

async function getClassParticipants(mkId: string, mkKelas: string, phpSessionId: string): Promise<Participant[] | null> {
    const baseUrl = "https://akademik.its.ac.id/lv_peserta.php";
    const params = {
        mkJur: "51100",
        mkID: mkId,
        mkSem: "2", // Fixed to semester 2
        mkThn: "2024",
        mkKelas: mkKelas,
        mkThnKurikulum: "2023"
    };

    let retries = 0;
    while (retries <= MAX_RETRIES) {
        try {
            console.log(`Attempting request for ${mkId}-${mkKelas} (attempt ${retries + 1}/${MAX_RETRIES + 1})`);
            
            const response = await axios.get(baseUrl, {
                params,
                headers: {
                    Cookie: `PHPSESSID=${phpSessionId}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
                },
                timeout: REQUEST_TIMEOUT,
                validateStatus: (status) => status === 200
            });

            // Validasi response
            if (!response.data || typeof response.data !== 'string') {
                throw new Error('Invalid response data');
            }

            const $ = cheerio.load(response.data);
            
            // Validasi struktur HTML
            const table = $('table.GridStyle');
            if (table.length === 0) {
                throw new Error('Table not found in response');
            }

            const courseName = $('table').first().find('tr').eq(1).find('td.PageTitle').text().trim();
            if (!courseName) {
                throw new Error('Course name not found');
            }

            const participants = $('table.GridStyle tr')
                .slice(1)
                .map((_, row) => {
                    const cols = $(row).find('td');
                    if (cols.length >= 3) {
                        const nrp = $(cols[1]).text().trim();
                        const name = $(cols[2]).text().trim();
                        if (!nrp || !name) return null;
                        
                        return {
                            nrp,
                            name,
                            course_name: courseName
                        };
                    }
                    return null;
                })
                .get()
                .filter((p): p is Participant => p !== null);

            console.log(`Successfully fetched ${participants.length} participants for ${mkId}-${mkKelas}`);
            return participants;

        } catch (error) {
            retries++;
            console.error(`Failed attempt ${retries} for ${mkId}-${mkKelas}:`, error);
            
            if (retries > MAX_RETRIES) {
                console.error(`All attempts failed for ${mkId}-${mkKelas}`);
                return null;
            }

            // Exponential backoff with jitter
            const delay = RETRY_DELAY * Math.pow(2, retries - 1) * (0.5 + Math.random() * 0.5);
            console.log(`Waiting ${Math.round(delay)}ms before next attempt...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return null;
}

async function checkSession(sessionId: string): Promise<boolean> {
  try {
    const response = await axios.get('https://akademik.its.ac.id/home.php', {
      headers: { Cookie: `PHPSESSID=${sessionId}` }
    });
    return !response.data.includes('myitsauth.php');
  } catch {
    return false;
  }
}

async function searchBatch(
  mkIds: string[], 
  classes: string[], 
  nrp: string, 
  sessionId: string
): Promise<ClassResult[]> {
  const foundClasses: ClassResult[] = [];
  
  for (const mkId of mkIds) {
    console.log(`🔍 Searching in course ${mkId}...`);
    const classPromises = classes.map(async (kelas) => {
      const participants = await getClassParticipants(mkId, kelas, sessionId);
      console.log(`Participants for ${mkId}-${kelas}:`, participants);
      if (participants) {
        const found = participants.find(p => p.nrp === nrp);
        if (found) {
          console.log(`✅ Found ${nrp} in class ${mkId}-${kelas}: ${found.course_name}`);
          return {
            mk_id: mkId,
            semester: 2,
            kelas,
            name: found.name,
            course_name: found.course_name
          };
        }
      }
      return null;
    });

    const results = await Promise.all(classPromises);
    const validResults = results.filter((result): result is ClassResult => result !== null);
    foundClasses.push(...validResults);
  }
  
  return foundClasses;
}

export async function POST(request: Request) {
    try {
        const { nrp, sessionId } = await request.json();

        if (!nrp || !sessionId) {
            return NextResponse.json({ error: 'NRP and Session ID are required' }, { status: 400 });
        }

        const isValidSession = await checkSession(sessionId);
        if (!isValidSession) {
            return NextResponse.json({ 
                error: 'Invalid or expired session. Please get a new session ID.'
            }, { status: 401 });
        }

        // Kurangi ukuran chunk untuk mengurangi beban concurrent requests
        const chunkSize = 3;
        const mkIdChunks = Array.from(
            { length: Math.ceil(MK_ID_LIST.length / chunkSize) },
            (_, i) => MK_ID_LIST.slice(i * chunkSize, (i + 1) * chunkSize)
        );

        console.log(`🚀 Starting search for NRP: ${nrp}`);
        const allResults: ClassResult[] = [];

        let processedChunks = 0;
        const totalChunks = mkIdChunks.length;

        for (const chunk of mkIdChunks) {
            processedChunks++;
            console.log(`⏳ Processing chunk ${processedChunks}/${totalChunks} (${chunk.join(', ')})`);
            
            const results = await searchBatch(chunk, ALLOWED_CLASSES, nrp, sessionId);
            allResults.push(...results);
        }

        console.log(`✨ Search completed. Found ${allResults.length} class(es)`);
        return new NextResponse(
            JSON.stringify({ results: allResults }), 
            { 
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                }
            }
        );

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('Search error:', errorMessage);
        return new NextResponse(
            JSON.stringify({ 
                error: 'Failed to search classes. Please check your session ID.' 
            }), 
            { 
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                }
            }
        );
    }
}
