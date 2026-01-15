import { NextResponse } from 'next/server';
import { createJob, updateJob, getJob } from '@/lib/clientSerpJobManager';
import { postSerpTaskChunk, waitForSerpResults, SerpResultWrapper } from '@/lib/dataforseoStandard';
import { updateSerpResultsBatch, UpdateSerpResultPayload, updateSerpResults, getClientKeywords } from '@/lib/clientSerpStore';
import { locationMap } from '@/lib/dataforseo';
import { getClients } from '@/lib/db';
import { SerpResultItem } from '@/lib/serpResultsDatabase';

// Utils
const CHUNK_SIZE = 100;

function extractOrganicItems(task: any): any[] {
    let items: any[] = [];
    const results = Array.isArray(task.result) ? task.result : (task.result ? [task.result] : []);

    console.log(`[extractOrganicItems] task.result type: ${typeof task.result}, isArray: ${Array.isArray(task.result)}, length: ${results.length}`);

    for (const res of results) {
        if (res.items) {
            console.log(`[extractOrganicItems] res.items length: ${res.items.length}`);
            items.push(...res.items);
        } else {
            console.log(`[extractOrganicItems] res has no items. keys: ${Object.keys(res || {}).join(',')}`);
        }
    }

    const organic = items.filter((i: any) => i.type === 'organic');
    console.log(`[extractOrganicItems] Total items: ${items.length}, Organic items: ${organic.length}`);
    return organic;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { clientCode, keywords, selectedDomain } = body;

        console.log(`[Client SERP Fetch] Request for ${clientCode}: ${keywords?.length} keywords`);

        if (!clientCode) {
            return NextResponse.json({ success: false, error: 'clientCode is required' }, { status: 400 });
        }
        if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
            return NextResponse.json({ success: false, error: 'keywords array is required' }, { status: 400 });
        }

        // Validate client
        const validClients = await getClients();
        const client = validClients.find(c => c.code === clientCode);
        if (!client) {
            return NextResponse.json({ success: false, error: 'Invalid clientCode' }, { status: 400 });
        }

        // Filter valid keywords
        const validKeywords = keywords.filter(k => k && k.trim().length > 0).map(k => k.trim());
        if (validKeywords.length === 0) {
            return NextResponse.json({ success: false, error: 'No valid keywords provided' }, { status: 400 });
        }

        // Create Job
        const job = await createJob(clientCode, selectedDomain, validKeywords);
        const jobId = job.jobId;

        // Start async process
        processSerpFetch(jobId, clientCode, validKeywords, selectedDomain).catch(err => {
            console.error(`[Background Job Error] ${jobId}:`, err);
        });

        return NextResponse.json({ success: true, jobId, message: 'Job started' });

    } catch (e: any) {
        console.error('Fetch error:', e);
        return NextResponse.json({ success: false, error: e.message || 'Internal Error' }, { status: 500 });
    }
}

async function processSerpFetch(jobId: string, clientCode: string, keywords: string[], selectedDomain: string) {
    try {
        await updateJob(jobId, { status: 'RUNNING', stage: 'PREPARE' });

        // Chunking
        const totalKeywords = keywords.length;


        const locations: Array<'IN' | 'GL'> = ['IN', 'GL'];

        await Promise.all(locations.map(async (loc) => {
            const locCode = locationMap[loc];
            await updateJob(jobId, { stage: `SERP_${loc}` as any });

            // Filter existing
            const existingData = await getClientKeywords(clientCode);
            const todoKeywords = keywords.filter(k => {
                const entry = existingData.find(e => e.keyword.toLowerCase() === k.trim().toLowerCase());
                return !(entry?.serp?.[loc]?.results?.length && entry.serp[loc].results.length > 0);
            });

            const skippedCount = keywords.length - todoKeywords.length;

            if (todoKeywords.length === 0) {
                await updateJob(jobId, {
                    progress: {
                        ...(await getJob(jobId))?.progress,
                        [loc]: { done: keywords.length, total: keywords.length, current: 'All existing results up to date' }
                    } as any
                });
                return;
            }

            // Re-chunk
            const locChunks: string[][] = [];
            for (let i = 0; i < todoKeywords.length; i += CHUNK_SIZE) {
                locChunks.push(todoKeywords.slice(i, i + CHUNK_SIZE));
            }

            let totalDoneForLoc = skippedCount;

            for (let chunkIdx = 0; chunkIdx < locChunks.length; chunkIdx++) {
                const chunk = locChunks[chunkIdx];

                await updateJob(jobId, {
                    progress: {
                        ...(await getJob(jobId))?.progress,
                        [loc]: { done: totalDoneForLoc, total: totalKeywords, current: `Posting chunk ${chunkIdx + 1}/${locChunks.length}` }
                    } as any
                });

                // const logOptions = { jobId, locType: loc, chunkIndex: chunkIdx }; // Logging disabled for now

                try {
                    // Post tasks
                    const taskIds = await postSerpTaskChunk(chunk, locCode, 50, jobId);
                    console.log(`[Client SERP Fetch] Posted ${taskIds.length} tasks (${loc} chunk ${chunkIdx + 1})`);

                    const idToKeyword = new Map<string, string>();
                    taskIds.forEach((id: string, idx: number) => { if (chunk[idx]) idToKeyword.set(id, chunk[idx]); });

                    // Buffer for batch updates
                    const pendingSaves: UpdateSerpResultPayload[] = [];
                    const flushThreshold = 10;

                    // Wait and Persist Incrementally
                    await waitForSerpResults(taskIds, undefined, async (res: SerpResultWrapper) => {
                        console.log(`[onResult] Task ${res.id} status=${res.status} for ${loc}`);
                        const keyword = idToKeyword.get(res.id);
                        if (!keyword) return;

                        const job = await getJob(jobId);
                        if (!job) return; // job cancelled or gone

                        if (res.status === 'COMPLETED' && res.data) {
                            try {
                                const organic = extractOrganicItems(res.data);
                                // Map to SerpResultItem
                                const serpResults: SerpResultItem[] = organic.map((item: any) => ({
                                    rank_group: item.rank_group || 0,
                                    rank_absolute: item.rank_absolute || 0,
                                    domain: item.domain || '',
                                    url: item.url || '',
                                    title: item.title || '',
                                    description: item.description || '',
                                    breadcrumb: item.breadcrumb || null,
                                    type: item.type || 'organic'
                                }));

                                pendingSaves.push({
                                    keyword,
                                    location: loc,
                                    results: serpResults,
                                    selectedDomain: job.selectedDomain,
                                    jobId
                                });

                                if (pendingSaves.length >= flushThreshold) {
                                    console.log(`[SAVE] Batch saving ${pendingSaves.length} items (${loc})`);
                                    const batch = [...pendingSaves];
                                    pendingSaves.length = 0;
                                    await updateSerpResultsBatch(job.clientCode, batch);
                                }

                            } catch (e: any) {
                                console.error(`Error saving results for ${keyword}: ${e.message}`);
                            }
                        } else {
                            // Error or Timeout
                            const err = res.error || res.status;
                            await updateJob(jobId, { errors: [...(job.errors || []), `${keyword} (${loc}): ${err}`] });
                        }

                        totalDoneForLoc++;
                        // Update progress periodically (every 5) or forced
                        if (totalDoneForLoc % 5 === 0 || totalDoneForLoc >= taskIds.length) {
                            await updateJob(jobId, {
                                progress: {
                                    ...(await getJob(jobId))?.progress,
                                    [loc]: { done: totalDoneForLoc, total: totalKeywords, current: `Chunk ${chunkIdx + 1} processing` }
                                } as any
                            });
                        }
                    });

                    // Flush remaining
                    const jobLast = await getJob(jobId);
                    if (pendingSaves.length > 0 && jobLast) {
                        console.log(`[SAVE] Final flush saving ${pendingSaves.length} items (${loc})`);
                        await updateSerpResultsBatch(jobLast.clientCode, pendingSaves);
                    }

                    // Update chunk progress
                    await updateJob(jobId, {
                        progress: {
                            ...(await getJob(jobId))?.progress,
                            [loc]: { done: totalDoneForLoc, total: totalKeywords, current: `Chunk ${chunkIdx + 1} completed` }
                        } as any
                    });

                } catch (e: any) {
                    console.error(`Chunk error ${loc}:`, e);
                    const jobNow = await getJob(jobId);
                    await updateJob(jobId, { errors: [...(jobNow?.errors || []), `Chunk error: ${e.message}`] });
                }
            } // end chunk loop
        })); // end location loop

        await updateJob(jobId, { status: 'COMPLETED', stage: 'DONE' });

    } catch (e: any) {
        console.error(`Job fatal error ${jobId}:`, e);
        await updateJob(jobId, { status: 'FAILED', errors: [e.message] });
    }
}
