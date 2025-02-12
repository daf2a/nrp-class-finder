import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Participant, ClassResult } from '@/types';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const ALLOWED_CLASSES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'P', 'T', 'M00'];
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

const COURSE_CREDITS: Record<string, number> = {
    "EF4103": 3, // Aljabar Linier
    "EF4101": 4, // Dasar Pemrograman
    "SM4101": 3, // Kalkulus 1
    "EF4104": 4, // Sistem Basis Data
    "EF4102": 3, // Sistem Digital
    "SM4201": 3, // Kalkulus 2
    "EF4204": 3, // Komputasi Numerik
    "EF4203": 3, // Organisasi Komputer
    "EE4101": 2, // Pengantar Teknologi Elektro
    "EF4202": 4, // Sistem Operasi
    "EF4201": 4, // Struktur Data
    "EF4801": 5, // Tugas Akhir
    "EF4303": 4, // Jaringan Komputer
    "EK4201": 3, // Konsep Kecerdasan Artifisial
    "EF4307": 2, // Konsep Pengembangan Perangkat Lunak
    "EF4305": 3, // Matematika Diskrit
    "EF4302": 3, // Pemrograman Berorientasi Objek
    "EF4301": 3, // Pemrograman Web
    "EF4304": 3, // Teori Graf
    "EF4404": 3, // Manajemen Basis Data
    "EF4403": 2, // Otomata
    "EF4406": 3, // Pembelajaran Mesin
    "EF4401": 3, // Pemrograman Jaringan
    "EF4405": 3, // Perancangan dan Analisis Algoritma
    "ER4301": 3, // Perancangan Perangkat Lunak
    "EF4402": 3, // Probabilitas dan Statistik
    "EF4518": 3, // Data Mining
    "EF4504": 3, // Grafika Komputer
    "EF4507": 3, // Jaringan Nirkabel
    "EF4502": 3, // Keamanan Informasi
    "EF4512": 3, // Manajemen Proyek Perangkat Lunak
    "EF4503": 3, // Pemodelan dan Simulasi
    "EF4501": 3, // Pemrograman Berbasis Kerangka Kerja
    "EF4509": 3, // Pemrograman Kompetitif
    "EF4520": 3, // Pengantar Pengembangan Game
    "EF4519": 3, // Pengantar Sistem Cerdas
    "EF4521": 3, // Pengantar Teknologi Basis Data
    "EF4517": 3, // Pengolahan Citra dan Visi Komputer
    "EF4515": 3, // Rekayasa Kebutuhan
    "EF4505": 3, // Rekayasa Sistem Berbasis Pengetahuan
    "EF4510": 3, // Riset Operasi
    "EF4513": 3, // Sistem Enterprise
    "EF4508": 3, // Sistem Terdistribusi
    "EF4514": 3, // Tata Kelola Teknologi Informasi
    "EF4511": 3, // Teknik Pengembangan Game
    "EF4506": 3, // Teknologi antar Jaringan
    "EF4612": 3, // Animasi Komputer dan Pemodelan 3D
    "EF4615": 3, // Audit Sistem
    "EF4616": 3, // Basis Data Terdistribusi
    "EF4605": 3, // Capstone Project
    "EF4619": 3, // Deep Learning
    "EF4614": 3, // Desain Pengalaman Pengguna
    "EF4613": 3, // Game Edukasi dan Simulasi
    "EF4618": 3, // Game Engine
    "EF4602": 3, // Interaksi Manusia dan Komputer
    "EF4607": 3, // Keamanan Aplikasi
    "EF4606": 3, // Keamanan Jaringan
    "EF4603": 4, // Kerja Praktik
    "EF4604": 3, // Komputasi Bergerak
    "EF4625": 3, // Komputasi Pervasif dan Jaringan Sensor
    "ER4402": 3, // Konstruksi Perangkat Lunak
    "ER4503": 3, // Kualitas Perangkat Lunak
    "EF4608": 3, // Pemrograman Berbasis Antarmuka
    "EF4601": 3, // Pemrograman Perangkat Bergerak
    "EF4621": 3, // Pengantar Logika dan Pemrograman
    "EF4620": 3, // Pengantar Proses Mining
    "EF4610": 3, // Simulasi Berbasis Agen
    "EF4609": 3, // Simulasi Sistem Dinamis
    "EF4617": 3, // Sistem Informasi Geografis
    "EF4611": 3, // Teknik Peramalan
    "EK4501": 3, // Text Mining
    "EF4708": 3, // Analisis Data Multivariat
    "ER4403": 3, // Arsitektur Perangkat Lunak
    "EF4712": 3, // Big Data
    "EF4701": 2, // Etika Profesi
    "ER4505": 3, // Evolusi Perangkat Lunak
    "EF4705": 3, // Forensik Digital
    "EF4710": 3, // Game Cerdas
    "EF4704": 3, // Komputasi Awan
    "EF4713": 3, // Komputasi Kuantum
    "EF4722": 6, // Magang
    "EF4707": 3, // Pemrograman Data Sains Terapan
    "EF4706": 3, // Pemrograman Pengolahan Sinyal
    "EF4702": 2, // Proposal Tugas Akhir
    "EF4711": 3, // Realitas X
    "EF4726": 3, // Robotika
    "EF4709": 3, // Simulasi Berorientasi Obyek
    "EF4703": 3, // Teknologi IoT
    "EF4714": 3, // Topik Khusus Algoritma dan Pemrograman
    "EF4715": 3, // Topik Khusus Arsitektur dan Jaringan Komputer
    "EF4716": 3, // Topik Khusus Grafika, Interaksi dan Game
    "EF4717": 3, // Topik Khusus Komputasi Berbasis Jaringan
    "EF4718": 3, // Topik Khusus Komputasi Cerdas dan Visi
    "EF4719": 3, // Topik Khusus Manajemen Cerdas Informasi
    "EF4720": 3, // Topik Khusus Pemodelan dan Komputasi Terapan
    "EF4721": 3  // Topik Khusus Rekayasa Perangkat Lunak
};

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
                    const result: ClassResult = {
                        mk_id: mkId,
                        semester: 2,
                        kelas,
                        name: found.name,
                        course_name: found.course_name,
                        credits: COURSE_CREDITS[mkId] || 0
                    };
                    return result;
                }
            }
            return null;
        });

        const results = await Promise.all(classPromises);
        const validResults = results.filter((result): result is ClassResult => 
            result !== null && 
            typeof result === 'object' && 
            'credits' in result
        );
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
