import { NextResponse } from 'next/server';
import axios, { AxiosError } from 'axios';
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

    try {
        const response = await axios.get(baseUrl, {
            params,
            headers: {
                Cookie: `PHPSESSID=${phpSessionId}`
            }
        });

        const $ = cheerio.load(response.data);
        
        // Get course name
        const courseName = $('table').first().find('tr').eq(1).find('td.PageTitle').text().trim();
        
        // Get participants
        const participants: Participant[] = [];
        $('table.GridStyle tr').slice(1).each((_, row) => {
            const cols = $(row).find('td');
            if (cols.length >= 3) {
                participants.push({
                    nrp: $(cols[1]).text().trim(),
                    name: $(cols[2]).text().trim(),
                    course_name: courseName
                });
            }
        });

        return participants;
    } catch (err) {
        const errorMessage = err instanceof AxiosError 
            ? err.response?.data || err.message
            : 'Unknown error';
        console.error(`Error fetching class ${mkId}-${mkKelas}:`, errorMessage);
        return null;
    }
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
  const promises = mkIds.map(async (mkId) => {
    for (const kelas of classes) {
      const participants = await getClassParticipants(mkId, kelas, sessionId);
      if (participants) {
        const found = participants.find(p => p.nrp === nrp);
        if (found) {
          foundClasses.push({
            mk_id: mkId,
            semester: 2,
            kelas,
            name: found.name,
            course_name: found.course_name
          });
        }
      }
    }
  });

  await Promise.all(promises);
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

        // Split MK_ID_LIST into smaller chunks
        const chunkSize = 5;
        const mkIdChunks = Array.from(
            { length: Math.ceil(MK_ID_LIST.length / chunkSize) },
            (_, i) => MK_ID_LIST.slice(i * chunkSize, (i + 1) * chunkSize)
        );

        let allResults: ClassResult[] = [];

        // Process chunks concurrently
        const promises = mkIdChunks.map(chunk => 
            searchBatch(chunk, ALLOWED_CLASSES, nrp, sessionId)
        );

        const results = await Promise.all(promises);
        allResults = results.flat();

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
