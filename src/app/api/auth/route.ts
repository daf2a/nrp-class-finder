import { NextResponse } from 'next/server';
import { getMyITSSession, cleanup } from '@/services/auth';

export async function GET() {
    try {
        const sessionId = await getMyITSSession();
        return NextResponse.json({ sessionId });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to get session' },
            { status: 500 }
        );
    }
}

export async function POST() {
    try {
        await cleanup();
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to cleanup' },
            { status: 500 }
        );
    }
}