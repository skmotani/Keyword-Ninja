import { NextResponse } from 'next/server';
import { getJob } from '@/lib/clientSerpJobManager';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const jobId = searchParams.get('jobId');

        if (!jobId) {
            return NextResponse.json({ success: false, error: 'jobId required' }, { status: 400 });
        }

        const job = await getJob(jobId);
        if (!job) {
            return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, ...job });
    } catch (e: any) {
        console.error('Get job status error:', e);
        return NextResponse.json({ success: false, error: e.message || 'Failed to get job status' }, { status: 500 });
    }
}

