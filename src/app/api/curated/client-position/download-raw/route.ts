import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId || !/^[a-zA-Z0-9_-]+$/.test(jobId)) {
        return NextResponse.json({ error: 'Invalid Job ID' }, { status: 400 });
    }

    const rawDir = path.join(process.cwd(), 'data', 'serp_raw', jobId);

    try {
        await fs.promises.access(rawDir);
    } catch {
        return NextResponse.json({ error: 'Raw logs not found for this job' }, { status: 404 });
    }

    // Spawn tar to create archive on the fly
    // tar -c -z -f - -C data/serp_raw <jobId>
    // -c: create
    // -z: gzip (if supported by bsdtar on windows, usually yes. If not, standard tar)
    // -f - : output to stdout
    // -C data/serp_raw : change dir so archive root is jobId/

    // We use relative path for -C to be safe?
    // process.cwd() is project root.
    const relativeParent = 'data/serp_raw';

    const tarProcess = spawn('tar', ['-c', '-z', '-f', '-', '-C', relativeParent, jobId], {
        stdio: ['ignore', 'pipe', 'ignore']
    });

    const stream = new ReadableStream({
        start(controller) {
            tarProcess.stdout.on('data', (chunk) => controller.enqueue(chunk));
            tarProcess.stdout.on('end', () => controller.close());
            tarProcess.stdout.on('error', (err) => controller.error(err));
        },
        cancel() {
            tarProcess.kill();
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'application/gzip',
            'Content-Disposition': `attachment; filename="serp_raw_${jobId}.tar.gz"`
        }
    });
}
