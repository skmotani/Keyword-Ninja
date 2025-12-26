import { NextResponse } from 'next/server';
import { postSerpTaskChunk, getCompletedSerpTasks } from '@/lib/dataforseoStandard';
import path from 'path';
import fs from 'fs';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const clientCode = searchParams.get('clientCode');
    const keyword = searchParams.get('keyword');
    const locationType = searchParams.get('locationType') || 'IN';
    const locCode = locationType === 'IN' ? 2356 : 2840;

    if (!keyword) return NextResponse.json({ error: 'Keyword required' }, { status: 400 });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const testJobId = `TEST_SERP_${timestamp}`;

    // Create raw folder
    const rawDir = path.join(process.cwd(), 'data', 'serp_raw', testJobId, locationType);
    await fs.promises.mkdir(rawDir, { recursive: true });

    try {
        const logOptions = { jobId: testJobId, locType: locationType, chunkIndex: 0 };

        // 1. Post
        const taskIds = await postSerpTaskChunk([keyword], locCode, 50, testJobId, logOptions);

        // 2. Poll
        let results: any[] = [];
        let attempts = 0;

        while (results.length === 0 && attempts < 30) {
            await new Promise(r => setTimeout(r, 2000));
            attempts++;
            const attemptLog = { ...logOptions, attempt: attempts };
            results = await getCompletedSerpTasks(taskIds, attemptLog);
        }

        if (results.length === 0) {
            return NextResponse.json({
                ok: false,
                error: 'Timed out waiting for SERP',
                rawFolderPath: rawDir
            });
        }

        const task = results[0];
        // Parse basic info to prove success
        let organicCount = 0;
        let topDomains: string[] = [];
        let matchedRank = null;
        let matchedDomain = null;

        if (task.result && task.result[0] && task.result[0].items) {
            const items = task.result[0].items.filter((i: any) => i.type === 'organic');
            organicCount = items.length;
            topDomains = items.slice(0, 10).map((i: any) => i.domain);
        }

        return NextResponse.json({
            ok: true,
            jobId: testJobId,
            organicCountFound: organicCount,
            top10Domains: topDomains,
            rawFolderPath: rawDir
        });

    } catch (e: any) {
        return NextResponse.json({
            ok: false,
            error: e.message,
            stack: e.stack,
            rawFolderPath: rawDir
        }, { status: 500 });
    }
}
