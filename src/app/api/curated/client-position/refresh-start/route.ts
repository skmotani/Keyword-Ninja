import { NextResponse } from 'next/server';
import { createJob, updateJob } from '@/lib/clientPositionJobManager';
import { startClientPositionJobWorker } from '@/lib/clientPositionWorker';
import path from 'path';
import fs from 'fs';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { clientCode, selectedDomain } = body;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        // 1. Forensic: Log Request Arrival
        try {
            const jobsDir = path.join(process.cwd(), 'data', 'jobs', 'client_position');
            await fs.promises.mkdir(jobsDir, { recursive: true });
            const logPath = path.join(jobsDir, `received_${timestamp}_${clientCode}.json`);
            await fs.promises.writeFile(logPath, JSON.stringify({
                receivedAt: new Date().toISOString(),
                headers: Object.fromEntries(req.headers),
                body
            }, null, 2));
        } catch (e) {
            console.error('Failed to write forensic request log', e);
        }

        if (!clientCode || !selectedDomain) {
            return NextResponse.json({ error: 'Missing clientCode or selectedDomain' }, { status: 400 });
        }

        // 2. Create Job
        const job = await createJob(clientCode, selectedDomain);

        if (job.status === 'RUNNING') {
            return NextResponse.json({
                jobId: job.jobId,
                status: 'ALREADY_RUNNING',
                clientCode,
                selectedDomain
            });
        }

        // 3. Immediately set to RUNNING (Forensic Requirement)
        // This ensures tracking starts even if worker startup fails
        await updateJob(job.jobId, {
            status: 'RUNNING',
            startedAt: new Date().toISOString()
        });

        // 4. Fire and Forget Worker
        (async () => {
            console.log(`[API] Triggering worker for ${job.jobId}`);
            try {
                await startClientPositionJobWorker(job.jobId);
            } catch (err) {
                console.error(`[API] Worker failed immediately for ${job.jobId}`, err);
                await updateJob(job.jobId, { status: 'FAILED', errors: [`Worker startup failed: ${err}`] });
            }
        })();

        return NextResponse.json({ jobId: job.jobId, status: 'STARTED' });

    } catch (e: any) {
        console.error('Refresh Start Error', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
