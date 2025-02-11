import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Participant, ClassResult } from '@/types';

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
    } catch (error) {
        console.error(`Error fetching class ${mkId}-${mkKelas}:`, error);
        return null;
    }
}

async function checkSession(phpSessionId: string): Promise<boolean> {
    try {
        const response = await axios.get('https://akademik.its.ac.id/home.php', {
            headers: {
                Cookie: `PHPSESSID=${phpSessionId}`
            }
        });
        return !response.data.includes('myitsauth.php');
    } catch (error) {
        return false;
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { nrp, sessionId } = body;

        if (!nrp) {
            return NextResponse.json({ error: 'NRP is required' }, { status: 400 });
        }

        // Use provided session ID or fallback to hardcoded one
        const phpSessionId = sessionId || 'h01m0cj1d3jkse862gmv2l5pt6';

        // Verify if session is valid
        const isValidSession = await checkSession(phpSessionId);
        if (!isValidSession) {
            return NextResponse.json({ 
                error: 'Invalid or expired session. Please login to MyITS again.',
                requireLogin: true 
            }, { status: 401 });
        }

        const foundClasses: ClassResult[] = [];

        // Search through all course IDs and allowed classes
        for (const mkId of MK_ID_LIST) {
            for (const kelas of ALLOWED_CLASSES) {
                const participants = await getClassParticipants(mkId, kelas, phpSessionId);
                
                if (participants) {
                    const found = participants.find(p => p.nrp === nrp);
                    if (found) {
                        foundClasses.push({
                            mk_id: mkId,
                            semester: 2,
                            kelas: kelas,
                            name: found.name,
                            course_name: found.course_name
                        });
                    }
                }
            }
        }

        return NextResponse.json({
            results: foundClasses
        });

    } catch (error: unknown) {
        console.error('Search error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to search classes' },
            { status: 500 }
        );
    }
}
