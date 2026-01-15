import { createJob, getJob, updateJob, JobStatus } from './clientPositionJobManager';
import { upsertClientPositionSerpRecords } from './serpStore';
import { fetchKeywordMetrics, fetchSerp } from './dataforseo';
import { postMetricsTask, pollMetricsTask, postSerpTaskChunk, waitForSerpResults } from './dataforseoStandard';
import { getCuratedKeywords } from './curatedStore';
import { getClientPositionSerpRecords } from './serpStore';
import { locationMap } from './dataforseo';
import { getClients } from './db';
import { ClientPositionSerpRecord, CompetitorSnapshot } from '@/types';
import { saveSerpResults, SerpResultItem } from './serpResultsDatabase';
import path from 'path';
import fs from 'fs';

// Helper to derive Brand Label
const deriveBrand = (url: string, domain: string): string => {
    if (!domain) return 'Unknown';
    let label = domain.toLowerCase().replace(/^(www\.)?/, '').replace(/\.[a-z]{2,}(\.[a-z]{2,})?$/, '');
    label = label.charAt(0).toUpperCase() + label.slice(1);
    return label;
};

// Helper to normalize domain STRICTLY for matching
const normalizeDomainStrict = (d: string): string => {
    if (!d) return '';
    try {
        const urlStr = d.startsWith('http') ? d : `http://${d}`;
        const u = new URL(urlStr);
        let hostname = u.hostname.toLowerCase();
        hostname = hostname.replace(/^www\./, '');
        return hostname;
    } catch {
        return d.toLowerCase().replace(/^(https?:\/\/)?/, '').replace(/^www\./, '').split('/')[0];
    }
};

// Extract Organic Items - Aggregate from ALL result blocks to get all 50 results
const extractOrganicItems = (task: any): any[] => {
    if (!task || !task.result) return [];
    const results = Array.isArray(task.result) ? task.result : [task.result];
    const allOrganic: any[] = [];
    
    // Aggregate organic items from ALL result blocks, not just the first one
    for (const res of results) {
        if (!res || !res.items || !Array.isArray(res.items)) continue;
        const organic = res.items.filter((i: any) =>
            i.type === 'organic' &&
            i.domain &&
            i.url
        );
        allOrganic.push(...organic);
    }
    
    // Sort by rank_group to ensure correct order (in case items are from multiple blocks)
    allOrganic.sort((a, b) => (a.rank_group || 999) - (b.rank_group || 999));
    
    // Log extraction details for verification
    if (allOrganic.length > 0) {
        console.log(`[extractOrganicItems] Extracted ${allOrganic.length} organic items from ${results.length} result block(s), rank range: ${allOrganic[0]?.rank_group || 'N/A'} to ${allOrganic[allOrganic.length - 1]?.rank_group || 'N/A'}`);
    }
    
    return allOrganic;
};


declare global {
    var debugDumpCount: number;
}

interface AuditRow {
    jobId: string;
    clientCode: string;
    locationType: string;
    keyword: string;
    depthRequested: number;
    organicCountFound: number;
    rank_group: number;
    domain: string;
    normalized_domain: string;
    url: string;
    title: string;
    snippet: string;
    isClientDomainMatch: boolean;
    matchedClientDomain: string;
}

export async function startClientPositionJobWorker(jobId: string) {
    if (typeof global.debugDumpCount === 'undefined') global.debugDumpCount = 0;

    let heartbeatInterval: NodeJS.Timeout | null = null;
    let heartbeatCount = 0;

    try {
        console.log(`[JobWorker] Starting Job ${jobId}`);
        await updateJob(jobId, { status: 'RUNNING', startedAt: new Date().toISOString() });

        const job = await getJob(jobId);
        if (!job) return;

        // Start Heartbeat
        heartbeatInterval = setInterval(async () => {
            heartbeatCount++;
            try {
                await updateJob(jobId, {
                    heartbeat: heartbeatCount,
                    updatedAt: new Date().toISOString()
                });
            } catch { }
        }, 3000);

        // Fetch Full Client Code to get ALL Domains
        const allClients = await getClients();
        const client = allClients.find(c => c.code === job.clientCode);
        const clientDomainsNormalized = new Set<string>();

        if (client) {
            if (client.mainDomain) clientDomainsNormalized.add(normalizeDomainStrict(client.mainDomain));
            if (client.domains && Array.isArray(client.domains)) {
                client.domains.forEach(d => clientDomainsNormalized.add(normalizeDomainStrict(d)));
            }
        }

        if (job.selectedDomain) clientDomainsNormalized.add(normalizeDomainStrict(job.selectedDomain));

        console.log(`[JobWorker] Client Domains Normalized:`, Array.from(clientDomainsNormalized));

        // Initialize Audit Collection
        const auditRows: AuditRow[] = [];

        // 1. PREPARE
        await updateJob(jobId, { stage: 'PREPARE', progressPercent: 0 });

        let keywordsToProcess = new Set<string>();

        const curated = await getCuratedKeywords(job.clientCode);
        curated.forEach(k => keywordsToProcess.add(k.keyword));

        const existing = await getClientPositionSerpRecords(job.clientCode, job.selectedDomain);
        existing.forEach(k => keywordsToProcess.add(k.keyword));

        const keywords = Array.from(keywordsToProcess);
        if (keywords.length === 0) {
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            await updateJob(jobId, { status: 'COMPLETED', finishedAt: new Date().toISOString(), progressPercent: 100 });
            return;
        }

        await updateJob(jobId, { totalKeywords: keywords.length, progressPercent: 5 });

        // 2. METRICS (Search Volume)
        const locations = ['IN', 'GL'] as const;
        const metricsDataMap = new Map<string, any>();

        existing.forEach(r => {
            const isStale = !r.lastPulledAt || (new Date(r.lastPulledAt).getTime() < Date.now() - 30 * 24 * 60 * 60 * 1000);
            if (!isStale && r.searchVolume !== undefined && r.competition && r.competition !== 'Unknown') {
                const key = `${r.locationType}_${r.keyword.toLowerCase()}`;
                metricsDataMap.set(key, { sv: r.searchVolume, comp: r.competition });
            }
        });

        for (const loc of locations) {
            if (await isCancelled(jobId, heartbeatInterval)) return;
            const stageLabel = `METRICS_${loc}` as any;
            await updateJob(jobId, { stage: stageLabel });

            const locCode = locationMap[loc];
            const keywordsToFetch = keywords.filter(k => !metricsDataMap.has(`${loc}_${k.toLowerCase()}`));

            if (keywordsToFetch.length > 0) {
                try {
                    console.log(`[JobWorker] Fetching metrics for ${keywordsToFetch.length} keywords (${loc})`);
                    const taskId = await postMetricsTask(keywordsToFetch, locCode, jobId);
                    console.log(`[JobWorker] Metrics task posted with ID: ${taskId}, starting to poll (will timeout after ~3 min if not ready)...`);
                    const results = await pollMetricsTask(taskId);
                    console.log(`[JobWorker] Metrics polling completed, received ${results.length} results for ${loc}`);

                    results.forEach((r: any) => {
                        const k = r.keyword;
                        if (k) {
                            const key = `${loc}_${k.toLowerCase()}`;
                            let compVal: string | number = 'Unknown';
                            if (r.competition_level) compVal = r.competition_level;
                            else if (typeof r.competition === 'number') compVal = r.competition;
                            metricsDataMap.set(key, { sv: r.search_volume || 0, comp: compVal });
                        }
                    });

                    await updateJob(jobId, {
                        metrics: { ...job.metrics, [loc]: { done: results.length, total: keywords.length, errors: 0 } },
                        progressPercent: (loc === 'IN' ? 15 : 25)
                    });

                } catch (e: any) {
                    console.error(`[JobWorker] Metrics ${loc} Error:`, e.message);
                    console.log(`[JobWorker] Continuing to SERP stage despite metrics failure for ${loc} - will use default values (searchVolume=0, competition='Unknown')`);
                    await updateJob(jobId, {
                        metrics: { ...job.metrics, [loc]: { done: 0, total: keywords.length, errors: keywordsToFetch.length } },
                        errors: [...(job.errors || []), `Metrics ${loc} Failed: ${e.message}`]
                    });
                    // Continue execution - metrics failure should not block SERP processing
                }
            } else {
                await updateJob(jobId, {
                    metrics: { ...job.metrics, [loc]: { done: keywords.length, total: keywords.length, errors: 0 } },
                    progressPercent: (loc === 'IN' ? 15 : 25)
                });
            }
        }

        // 3. SERP
        const CHUNK_SIZE = 100;

        let totalKeywordsWithMatch = 0;
        let totalKeywordsNoMatch = 0;
        let totalKeywordsErrored = 0;

        for (const loc of locations) {
            if (await isCancelled(jobId, heartbeatInterval)) return;
            const stageLabel = `SERP_${loc}` as any;
            
            // Update job with stage and initialize SERP totals
            const currentJob = await getJob(jobId);
            await updateJob(jobId, { 
                stage: stageLabel,
                serp: {
                    ...(currentJob?.serp || { IN: { done: 0, total: 0, errors: 0, empty: 0 }, GL: { done: 0, total: 0, errors: 0, empty: 0 } }),
                    [loc]: { done: 0, total: keywords.length, errors: 0, empty: 0 }
                }
            });
            
            console.log(`[JobWorker] Starting SERP processing for ${loc}: ${keywords.length} keywords`);

            const locCode = locationMap[loc];
            const chunks = [];
            for (let i = 0; i < keywords.length; i += CHUNK_SIZE) {
                chunks.push(keywords.slice(i, i + CHUNK_SIZE));
            }

            let completedCount = 0;
            let errorCount = 0;
            let emptyCount = 0;

            for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
                const chunk = chunks[chunkIdx];
                if (await isCancelled(jobId, heartbeatInterval)) return;

                try {
                    const logOptions = { jobId, locType: loc, chunkIndex: chunkIdx };

                    console.log(`[JobWorker] Posting SERP tasks for chunk ${chunkIdx + 1}/${chunks.length} (${chunk.length} keywords) in ${loc}...`);
                    const taskIds = await postSerpTaskChunk(chunk, locCode, 50, jobId, logOptions);
                    console.log(`[JobWorker] Posted ${taskIds.length} SERP tasks for chunk ${chunkIdx + 1}, starting to poll...`);

                    const idToKeyword = new Map<string, string>();
                    taskIds.forEach((id: string, idx: number) => {
                        if (chunk[idx]) idToKeyword.set(id, chunk[idx]);
                    });

                    // Deterministic Polling
                    console.log(`[JobWorker] Waiting for SERP results for ${taskIds.length} tasks (chunk ${chunkIdx + 1}/${chunks.length}, ${loc})...`);
                    const taskResults = await waitForSerpResults(taskIds, logOptions);
                    console.log(`[JobWorker] Received ${taskResults.length} SERP results for chunk ${chunkIdx + 1} (${loc})`);

                    const updates: Partial<ClientPositionSerpRecord>[] = [];
                    const timestamp = new Date().toISOString();

                    for (const res of taskResults) {
                        // FIX: Ensure we get correct keyword even if ID map fails? 
                        // idToKeyword should work because taskIds and chunk are aligned.
                        const requestedKeyword = idToKeyword.get(res.id) || 'Unknown';

                        let rank: number | null = null;
                        let rankDomain: string | null = null;
                        let rankLabel = 'ERR';
                        let organicItems: any[] = [];
                        let checkUrl = '';

                        if (res.status === 'COMPLETED' && res.data) {
                            const task = res.data;
                            organicItems = extractOrganicItems(task);
                            
                            // Log organic item count for verification
                            console.log(`[SERP] Keyword: ${requestedKeyword}, Location: ${loc}, Organic Items Found: ${organicItems.length}/50`);
                            
                            // Save all 50 results to database
                            if (organicItems.length > 0) {
                                try {
                                    const serpResults: SerpResultItem[] = organicItems.map((item: any) => ({
                                        rank_group: item.rank_group || 0,
                                        rank_absolute: item.rank_absolute || 0,
                                        domain: item.domain || '',
                                        url: item.url || '',
                                        title: item.title || '',
                                        description: item.description || '',
                                        breadcrumb: item.breadcrumb || null,
                                        type: item.type || 'organic'
                                    }));
                                    
                                    await saveSerpResults(
                                        job.clientCode,
                                        requestedKeyword,
                                        loc,
                                        serpResults,
                                        job.selectedDomain
                                    );
                                    console.log(`[SERP Database] Saved ${serpResults.length} results for keyword: ${requestedKeyword} (${loc})`);
                                } catch (dbError: any) {
                                    console.error(`[SERP Database] Failed to save results for ${requestedKeyword} (${loc}):`, dbError.message);
                                    // Continue processing even if database save fails
                                }
                            }
                            
                            if (organicItems.length === 0) emptyCount++;
                            checkUrl = task.result?.[0]?.check_url || '';

                            if (task.status_code === 20000) {
                                if (organicItems.length === 0) {
                                    rankLabel = 'ERR_NO_ITEMS';
                                    totalKeywordsErrored++;
                                } else {
                                    // Log if we got less than 50 results
                                    if (organicItems.length < 50) {
                                        console.warn(`[SERP] WARNING: Only ${organicItems.length}/50 organic items returned for keyword: ${requestedKeyword} (${loc})`);
                                        rankLabel = `INCOMPLETE (${organicItems.length}/50)`;
                                        totalKeywordsErrored++;
                                    } else {
                                        console.log(`[SERP] SUCCESS: All 50 organic items received for keyword: ${requestedKeyword} (${loc})`);
                                        // ONLY set >50 here if no match found later
                                        rankLabel = '>50';
                                        totalKeywordsNoMatch++;
                                    }

                                    // Scan for match
                                    let bestRankFound = false;
                                    for (const item of organicItems) {
                                        const iDomain = normalizeDomainStrict(item.domain);
                                        let isMatch = false;
                                        let matchedClient = '';

                                        if (clientDomainsNormalized.has(iDomain) ||
                                            Array.from(clientDomainsNormalized).some(cd => iDomain.endsWith('.' + cd))) {
                                            isMatch = true;
                                            matchedClient = iDomain;
                                        }

                                        auditRows.push({
                                            jobId,
                                            clientCode: job.clientCode,
                                            locationType: loc,
                                            keyword: requestedKeyword,
                                            depthRequested: 50,
                                            organicCountFound: organicItems.length,
                                            rank_group: item.rank_group,
                                            domain: item.domain,
                                            normalized_domain: iDomain,
                                            url: item.url,
                                            title: (item.title || '').replace(/[\r\n,]/g, ' '),
                                            snippet: (item.description || '').replace(/[\r\n,]/g, ' '),
                                            isClientDomainMatch: isMatch,
                                            matchedClientDomain: matchedClient
                                        });

                                        if (isMatch && !bestRankFound) {
                                            rank = item.rank_group;
                                            rankDomain = item.domain;
                                            rankLabel = item.rank_group.toString();

                                            // Correction: If we previously guessed >50 or Incomplete, we fix stats
                                            // If it was incomplete, it's still incomplete but we found a rank!
                                            // So we should decrease errored count?
                                            // Actually, if incomplete, we still TRUST the rank if found.
                                            // If organicCount < 50, we set rankLabel = INCOMPLETE initially.
                                            // If match found, we override rankLabel = '3' (example).
                                            // So we should decrement strictly based on initial assignment.

                                            if (organicItems.length < 50) totalKeywordsErrored--;
                                            else totalKeywordsNoMatch--;

                                            totalKeywordsWithMatch++;
                                            bestRankFound = true;
                                        }
                                    }
                                }
                            } else {
                                rankLabel = `ERR_${task.status_code}`;
                                totalKeywordsErrored++;
                            }
                        } else {
                            // TIMEOUT or ERROR
                            totalKeywordsErrored++;
                            rankLabel = res.status === 'TIMEOUT' ? 'ERR_TIMEOUT' : `ERR_DFS`;
                        }

                        // Prepare Record
                        const competitors: Record<string, CompetitorSnapshot> = {};
                        organicItems.slice(0, 10).forEach((item: any, idx: number) => {
                            const key = `c${idx + 1}` as keyof ClientPositionSerpRecord;
                            competitors[key] = {
                                brandLabel: deriveBrand(item.url, item.domain),
                                domain: normalizeDomainStrict(item.domain),
                                url: item.url
                            };
                        });

                        const metricKey = `${loc}_${requestedKeyword.toLowerCase()}`;
                        const m = metricsDataMap.get(metricKey);
                        const searchVolume = m ? m.sv : 0;
                        const competition = m ? m.comp : null;

                        const updateObj: any = {
                            clientCode: job.clientCode,
                            keyword: requestedKeyword,
                            selectedDomain: job.selectedDomain,
                            locationType: loc,
                            rank: rank,
                            rankLabel: rankLabel,
                            rankDomain: rankDomain,
                            checkUrl,
                            searchVolume,
                            lastPulledAt: timestamp,
                            ...competitors
                        };
                        if (competition && competition !== 'Unknown') updateObj.competition = competition;
                        updates.push(updateObj);
                    }

                    if (updates.length > 0) {
                        await upsertClientPositionSerpRecords(updates as any);
                    }

                    completedCount += taskResults.length;

                    // We only count ERRORS for items that failed completely or timed out
                    // `totalKeywordsErrored` tracks that.
                    // `errorCount` here is more about API batch failures?
                    // Let's make errorCount reflect actual fetch failures
                    const failedInBatch = taskResults.filter(r => r.status !== 'COMPLETED').length;
                    errorCount += failedInBatch;

                    const currentJob = await getJob(jobId);
                    if (currentJob) {
                        await updateJob(jobId, {
                            serp: {
                                ...currentJob.serp,
                                [loc]: {
                                    done: completedCount,
                                    total: keywords.length,
                                    errors: errorCount,
                                    empty: emptyCount
                                }
                            }
                        });
                    }

                } catch (e: any) {
                    console.error(`[JobWorker] SERP chunk error for ${loc} (chunk ${chunkIdx + 1}/${chunks.length}):`, e.message || e);
                    console.error(`[JobWorker] Full error:`, e);
                    // If chunk completely fails (Network), we count all as error
                    errorCount += chunk.length;
                    
                    // Update job with error
                    const currentJob = await getJob(jobId);
                    if (currentJob) {
                        await updateJob(jobId, {
                            serp: {
                                ...currentJob.serp,
                                [loc]: {
                                    ...currentJob.serp[loc],
                                    errors: (currentJob.serp[loc].errors || 0) + chunk.length
                                }
                            },
                            errors: [...(currentJob.errors || []), `SERP ${loc} chunk ${chunkIdx + 1} failed: ${e.message || 'Unknown error'}`]
                        });
                    }
                }
            }
        }

        console.log(`[JobWorker] Stats: Matched=${totalKeywordsWithMatch}, NoMatch=${totalKeywordsNoMatch}, Error=${totalKeywordsErrored}`);

        // 4. FINALIZE & EXPORT AUDIT
        let auditCsvPath = undefined;
        if (auditRows.length > 0) {
            try {
                const exportsDir = path.join(process.cwd(), 'data', 'exports');
                await fs.promises.mkdir(exportsDir, { recursive: true });
                const fileName = `client_position_serp_audit_${job.clientCode}_${jobId}.csv`;
                const filePath = path.join(exportsDir, fileName);

                const header = [
                    'jobId', 'clientCode', 'locationType', 'keyword', 'depthRequested',
                    'organicCountFound', 'rank_group', 'domain', 'normalized_domain',
                    'url', 'title', 'snippet', 'isClientDomainMatch', 'matchedClientDomain'
                ].join(',');

                const rows = auditRows.map(r => [
                    r.jobId, r.clientCode, r.locationType, `"${r.keyword.replace(/"/g, '""')}"`, r.depthRequested,
                    r.organicCountFound, r.rank_group, r.domain, r.normalized_domain,
                    `"${r.url.replace(/"/g, '""')}"`, `"${r.title.replace(/"/g, '""')}"`, `"${r.snippet.replace(/"/g, '""')}"`, r.isClientDomainMatch, r.matchedClientDomain
                ].join(','));

                await fs.promises.writeFile(filePath, [header, ...rows].join('\n'));
                auditCsvPath = `data/exports/${fileName}`;
            } catch (e) {
                console.error('Failed to write Audit CSV', e);
            }
        }

        if (heartbeatInterval) clearInterval(heartbeatInterval);

        // Job is COMPLETED even if there were errors, 
        // effectively "Completed with Errors" is communicated via stats.
        // If critical failure (whole job crash), it goes to FAILED (bottom catch).
        await updateJob(jobId, {
            stage: 'FINALIZE',
            progressPercent: 100,
            status: 'COMPLETED',
            finishedAt: new Date().toISOString(),
            auditCsvPath: auditCsvPath
        });

        console.log(`[JobWorker] Job ${jobId} Completed`);

    } catch (err: any) {
        console.error(`[JobWorker] Critical Failure`, err);
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        await updateJob(jobId, { status: 'FAILED', errors: [err.message] });
    }
}

async function isCancelled(jobId: string, interval?: NodeJS.Timeout | null) {
    const job = await getJob(jobId);
    if (job?.status === 'CANCELLED') {
        if (interval) clearInterval(interval);
        return true;
    }
    return false;
}
