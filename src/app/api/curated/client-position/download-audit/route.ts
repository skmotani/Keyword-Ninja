import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { getJob } from '@/lib/clientPositionJobManager';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
        return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }

    try {
        const job = await getJob(jobId);
        if (!job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        if (!job.auditCsvPath) {
            return NextResponse.json({ error: 'Audit CSV not generated for this job' }, { status: 404 });
        }

        const filePath = path.join(process.cwd(), job.auditCsvPath);

        // Security check: simple check to ensure path is within data/exports
        if (!filePath.includes(path.join('data', 'exports'))) {
            return NextResponse.json({ error: 'Invalid file path' }, { status: 403 });
        }

        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'Audit file missing on disk' }, { status: 404 });
        }

        const fileBuffer = await fs.promises.readFile(filePath);

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${path.basename(filePath)}"`,
            }
        });

    } catch (e: any) {
        console.error('Download error:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
