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

// Tambahkan konstanta untuk timeout dan retry
const REQUEST_TIMEOUT = 5000; // 5 detik
const MAX_RETRIES = 2;

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
            const response = await axios.get(baseUrl, {
                params,
                headers: {
                    Cookie: `PHPSESSID=${phpSessionId}`
                },
                timeout: REQUEST_TIMEOUT
            });

            const $ = cheerio.load(response.data);
            
            // Get course name
            const courseName = $('table').first().find('tr').eq(1).find('td.PageTitle').text().trim();
            
            // Optimisasi parsing dengan map alih-alih each
            const participants = $('table.GridStyle tr')
                .slice(1)
                .map((_, row) => {
                    const cols = $(row).find('td');
                    if (cols.length >= 3) {
                        return {
                            nrp: $(cols[1]).text().trim(),
                            name: $(cols[2]).text().trim(),
                            course_name: courseName
                        };
                    }
                    return null;
                })
                .get()
                .filter((p): p is Participant => p !== null);

            return participants;
        } catch (error) {
            retries++;
            if (retries > MAX_RETRIES) {
                console.error(`Failed after ${MAX_RETRIES} retries for ${mkId}-${mkKelas}: ${error}`);
                return null;
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
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
    const classPromises = classes.map(async (kelas) => {
      const participants = await getClassParticipants(mkId, kelas, sessionId);
      if (participants) {
        const found = participants.find(p => p.nrp === nrp);
        if (found) {
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
    // Menghapus early return di sini
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

        const allResults: ClassResult[] = [];

        // Proses chunk secara sequential untuk mengurangi beban
        for (const chunk of mkIdChunks) {
            const results = await searchBatch(chunk, ALLOWED_CLASSES, nrp, sessionId);
            allResults.push(...results);
            // Menghapus early return di sini
        }

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
