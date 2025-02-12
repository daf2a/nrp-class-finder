import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Participant, ClassResult } from '@/types';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const ALLOWED_CLASSES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'P', 'T'];
const MK_ID_LIST = [
    "EF4103", "EF4101", "SM4101", "EF4104", "EF4102", "SM4201",
    "EF4204", "EF4203", "EE4101", "EF4202", "EF4201", "EF4801",
    "EF4303", "EK4201", "EF4307", "EF4305", "EF4302", "EF4301",
    "EF4304", "EF4404", "EF4403", "EF4406", "EF4401", "EF4405",
    "ER4301", "EF4402", "EF4518", "EF4504", "EF4507", "EF4502",
    "EF4512", "EF4503", "EF4501", "EF4509", "EF4520", "EF4519",
    "EF4521", "EF4517", "EF4515", "EF4505", "EF4510", "EF4513",
    "EF4508", "EF4514", "EF4511", "EF4506", "EF4612", "EF4615",
    "EF4616", "EF4605", "EF4619", "EF4614", "EF4613", "EF4618",
    "EF4602", "EF4607", "EF4606", "EF4603", "EF4604", "EF4625",
    "ER4402", "ER4503", "EF4608", "EF4601", "EF4621", "EF4620",
    "EF4610", "EF4609", "EF4617", "EF4611", "EK4501", "EF4708",
    "ER4403", "EF4712", "EF4701", "ER4505", "EF4705", "EF4710",
    "EF4704", "EF4713", "EF4722", "EF4707", "EF4706", "EF4702",
    "EF4711", "EF4726", "EF4709", "EF4703", "EF4714", "EF4715",
    "EF4716", "EF4717", "EF4718", "EF4719", "EF4720", "EF4721"
];

const REQUEST_TIMEOUT = 10000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

async function getClassParticipants(mkId: string, mkKelas: string, phpSessionId: string): Promise<Participant[] | null> {
    const baseUrl = "https://akademik.its.ac.id/lv_peserta.php";
    const params = {
        mkJur: "51100",
        mkID: mkId,
        mkSem: "2",
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
                    Cookie: `PHPSESSID=${phpSessionId}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                timeout: REQUEST_TIMEOUT,
                validateStatus: (status) => status === 200
            });

            if (!response.data || typeof response.data !== 'string') {
                throw new Error('Invalid response data');
            }

            const $ = cheerio.load(response.data);

            let table = $('table.GridStyle');
            if (table.length === 0) {
                table = $('table').eq(1);
                if (table.length === 0) {
                    throw new Error('Table not found in response');
                }
            }

            let courseName = '';
            const possibleCourseNameSelectors = [
                'td.PageTitle',
                'td[class="PageTitle"]',
                'td[align="left"]'
            ];

            for (const selector of possibleCourseNameSelectors) {
                courseName = $('table').first().find('tr').eq(1).find(selector).text().trim();
                if (courseName) break;
            }

            if (!courseName) {
                courseName = `${mkId}-${mkKelas}`;
            }

            const participants = table.find('tr')
                .slice(1)
                .map((_, row) => {
                    try {
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
                    } catch (error) {
                        console.error(`Error parsing row: ${error}`);
                        return null;
                    }
                    return null;
                })
                .get()
                .filter((p): p is Participant => p !== null);

            return participants;

        } catch (error) {
            retries++;
            console.error(`Request failed: ${error}`);
            
            if (retries > MAX_RETRIES) {
                return null;
            }

            const delay = RETRY_DELAY * Math.pow(2, retries - 1) * (0.5 + Math.random() * 0.5);
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

        const chunkSize = 3;
        const mkIdChunks = Array.from(
            { length: Math.ceil(MK_ID_LIST.length / chunkSize) },
            (_, i) => MK_ID_LIST.slice(i * chunkSize, (i + 1) * chunkSize)
        );

        const allResults: ClassResult[] = [];

        for (const chunk of mkIdChunks) {
            const results = await searchBatch(chunk, ALLOWED_CLASSES, nrp, sessionId);
            allResults.push(...results);
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
