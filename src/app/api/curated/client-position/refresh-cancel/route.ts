import { NextResponse } from 'next/server';
import { updateJob } from '@/lib/clientPositionJobManager';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { jobId } = body;

        if (!jobId) {
            return NextResponse.json({ error: 'jobId required' }, { status: 400 });
        }

        // Status update to CANCELLED will be detected by worker loops
        const updated = await updateJob(jobId, { status: 'CANCELLED' });

        return NextResponse.json({ success: true, status: updated.status });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
