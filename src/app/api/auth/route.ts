import { NextResponse } from 'next/server';
import { getMyITSSession, cleanup } from '@/services/auth';

export async function GET() {
    try {
        const sessionId = await getMyITSSession();
        return NextResponse.json({ sessionId });
    } catch (err) {
        console.error('Auth error:', err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Failed to get session' },
            { status: 500 }
        );
    }
}

export async function POST() {
    try {
        await cleanup();
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Cleanup error:', err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Failed to cleanup' },
            { status: 500 }
        );
    }
}