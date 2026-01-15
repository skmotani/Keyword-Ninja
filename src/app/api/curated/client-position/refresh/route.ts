import { NextResponse } from 'next/server';
import { upsertClientPositionSerpRecords, getClientPositionSerpRecords } from '@/lib/serpStore';
import { fetchKeywordMetrics, fetchSerp, locationMap } from '@/lib/dataforseo';
import { getCuratedKeywords } from '@/lib/curatedStore';
import { ClientPositionSerpRecord, CompetitorSnapshot } from '@/types';
import { promises as fs } from 'fs';
import path from 'path';

// Helper to derive Brand Label
const deriveBrand = (url: string, domain: string): string => {
    if (!domain) return 'Unknown';
    // 1. Try to get simplistic label from domain
    let label = domain.toLowerCase().replace(/^(www\.)?/, '').replace(/\.[a-z]{2,}(\.[a-z]{2,})?$/, '');
    // 2. Title Case
    label = label.charAt(0).toUpperCase() + label.slice(1);
    return label;
};

// Helper to normalize domain for comparison
const normalizeDomain = (d: string): string => {
    if (!d) return '';
    return d.toLowerCase()
        .replace(/^(https?:\/\/)?/, '')
        .replace(/^www\./, '')
        .split('/')[0];
};

// Global augmentation for debug flag
declare global {
    var debugDumpWritten: boolean;
}

// Helper to reliably extract organic items from possibly multiple result blocks
// Robust against DataForSEO response variations (Array vs Object, multiple result blocks)
const extractOrganicItems = (task: any): any[] => {
    if (!task || !task.result) return [];

    // Normalize result to array (sometimes it's an object if single result)
    // Common pattern: task.result is an array of objects describing SERP blocks
    const results = Array.isArray(task.result) ? task.result : [task.result];

    // Iterate through all result blocks to find the first one containing valid organic items
    for (const res of results) {
        if (!res || !res.items || !Array.isArray(res.items)) continue;

        const organic = res.items.filter((i: any) =>
            i.type === 'organic' &&
            i.domain &&
            i.url
        );

        if (organic.length > 0) return organic;
    }

    return [];
};

export async function POST(req: Request) {
    global.debugDumpWritten = false; // Reset debug flag
    const timestamp = new Date().toISOString();
    const startTime = Date.now();
    const logs: string[] = [];

    // Structured Diagnostics
    const diagnostics = {
        clientCode: '',
        selectedDomain: '',
        locations: {
            'IN': {
                success: false,
                metricsCount: 0,
                serpTasksCount: 0,
                serpKeywordsWithOrganicCount: 0,
                serpKeywordsEmptyCount: 0,
                serpKeywordsErroredCount: 0,
                error: null as string | null
            },
            'GL': {
                success: false,
                metricsCount: 0,
                serpTasksCount: 0,
                serpKeywordsWithOrganicCount: 0,
                serpKeywordsEmptyCount: 0,
                serpKeywordsErroredCount: 0,
                error: null as string | null
            }
        },
        totalUpserted: 0,
        logFile: '',
        durationMs: 0
    };

    const log = (msg: string) => {
        console.log(msg);
        logs.push(`[${new Date().toISOString().split('T')[1].split('.')[0]}] ${msg}`);
    };

    try {
        const body = await req.json();
        const { clientCode, selectedDomain, keywords: inputKeywords } = body;

        diagnostics.clientCode = clientCode;
        diagnostics.selectedDomain = selectedDomain;

        if (!clientCode || !selectedDomain) {
            return NextResponse.json({ success: false, error: 'Missing required params' }, { status: 400 });
        }

        const normalizedSelected = normalizeDomain(selectedDomain);

        // 1. Determine Keywords
        let keywordsToProcess = inputKeywords || [];
        if (keywordsToProcess.length === 0) {
            log(`Fetching curated and existing keywords for client: ${clientCode}`);
            const curated = await getCuratedKeywords(clientCode);
            const curatedKw = curated.map(k => k.keyword);
            const existing = await getClientPositionSerpRecords(clientCode, selectedDomain); // Gets IN and GL
            const existingKw = existing.map(e => e.keyword);
            keywordsToProcess = Array.from(new Set([...curatedKw, ...existingKw]));
        }

        if (keywordsToProcess.length === 0) {
            return NextResponse.json({ success: true, message: 'No keywords to process', diagnostics, logs });
        }

        log(`Identified ${keywordsToProcess.length} keywords to process.`);

        // 2. Process Locations (IN and GL unconditionally)
        const updates: Partial<ClientPositionSerpRecord>[] = [];
        const locations: ('IN' | 'GL')[] = ['IN', 'GL'];

        for (const loc of locations) {
            log(`>>> Processing Location: ${loc}`);
            try {
                const locCode = locationMap[loc];
                const metricsMap = new Map();

                // A. METRICS (Mandatory)
                log(`[Metrics] Fetching for ${keywordsToProcess.length} keywords (${loc})...`);
                // Note: fetchKeywordMetrics might throw if creds missing
                const metricsData = await fetchKeywordMetrics(keywordsToProcess, locCode);

                metricsData.forEach((m: any) => {
                    if (m.keyword) {
                        metricsMap.set(m.keyword.toLowerCase(), {
                            sv: m.search_volume || 0,
                            comp: m.competition_level || 'Unknown'
                        });
                    }
                });

                diagnostics.locations[loc].metricsCount = metricsMap.size;
                log(`[Metrics] Processed ${metricsMap.size} metrics.`);

                // B. SERP (Mandatory, Top 10)
                log(`[SERP] Fetching for ${keywordsToProcess.length} keywords (${loc})...`);
                const serpTasks = await fetchSerp(keywordsToProcess, locCode, 200);

                diagnostics.locations[loc].serpTasksCount = serpTasks.length;
                log(`[SERP] Received ${serpTasks.length} results.`);

                for (const task of serpTasks) {
                    const requestedKeyword = task.data?.keyword;
                    if (!requestedKeyword) continue;

                    // 1. Validate Status Code
                    if (task.status_code !== 20000) {
                        log(`[SERP][ERROR] ${requestedKeyword} (${loc}) status_code=${task.status_code} message=${task.status_message}`);
                        diagnostics.locations[loc].serpKeywordsErroredCount++;
                        continue;
                    }

                    // Improved extraction of valid organic items
                    const organicItems = extractOrganicItems(task);

                    // safely extract checkUrl from first result block if available
                    let checkUrl = '';
                    if (task.result) {
                        const r = Array.isArray(task.result) ? task.result[0] : task.result;
                        if (r && r.check_url) checkUrl = r.check_url;
                    }

                    if (organicItems.length === 0) {
                        log(`[SERP][EMPTY] ${requestedKeyword} (${loc}) - no organic items found`);
                        diagnostics.locations[loc].serpKeywordsEmptyCount++;

                        // Debug Dump (ONCE per refresh)
                        if (!global.debugDumpWritten) {
                            try {
                                const debugDir = path.join(process.cwd(), 'data', 'serp_logs');
                                await fs.mkdir(debugDir, { recursive: true });
                                const debugPath = path.join(debugDir, 'debug_raw_serp_task.json');
                                await fs.writeFile(debugPath, JSON.stringify({
                                    keyword: requestedKeyword,
                                    location: loc,
                                    task: task
                                }, null, 2));
                                log(`[DEBUG] Raw task dumped to ${debugPath}`);
                                global.debugDumpWritten = true;
                            } catch (dErr) {
                                console.error('Debug dump failed', dErr);
                            }
                        }
                    } else {
                        diagnostics.locations[loc].serpKeywordsWithOrganicCount++;
                    }

                    // Find Client Rank
                    const match = organicItems.find((i: any) => {
                        const iDomain = normalizeDomain(i.domain);
                        const iUrl = i.url || '';

                        if (iDomain === normalizedSelected) return true;
                        if (iDomain.endsWith('.' + normalizedSelected)) return true;
                        if (normalizedSelected.endsWith('.' + iDomain)) return true;
                        if (iUrl.includes(normalizedSelected)) return true;
                        return false;
                    });

                    // Rank = client domain rank in top 10, else null (UI shows Absent).
                    let rank = null;
                    if (match && match.rank_group <= 10) {
                        rank = match.rank_group;
                    }

                    // Competitors (Top 10)
                    const top10 = organicItems.slice(0, 10);
                    const competitors: Record<string, CompetitorSnapshot> = {};
                    top10.forEach((item: any, idx: number) => {
                        const key = `c${idx + 1}` as keyof ClientPositionSerpRecord;
                        competitors[key] = {
                            brandLabel: deriveBrand(item.url, item.domain),
                            domain: normalizeDomain(item.domain), // Normalized per requirement
                            url: item.url
                        };
                    });

                    // Metrics
                    const m = metricsMap.get(requestedKeyword.toLowerCase());
                    const searchVolume = m ? m.sv : 0;
                    const competition = m ? m.comp : 'Unknown';

                    const updateObj: any = {
                        clientCode,
                        keyword: requestedKeyword,
                        selectedDomain,
                        locationType: loc,
                        rank,
                        checkUrl,
                        searchVolume,
                        competition,
                        lastPulledAt: timestamp,
                        ...competitors
                    };

                    updates.push(updateObj);
                }

                diagnostics.locations[loc].success = true;

            } catch (err: any) {
                log(`[ERROR] Location ${loc} failed: ${err.message}`);
                diagnostics.locations[loc].error = err.message;
            }
        }

        if (updates.length > 0) {
            log(`Upserting ${updates.length} records...`);
            await upsertClientPositionSerpRecords(updates as any);
        }

        diagnostics.totalUpserted = updates.length;
        diagnostics.durationMs = Date.now() - startTime;

        // 3. Write Log File
        try {
            const logDir = path.join(process.cwd(), 'data', 'serp_logs');
            await fs.mkdir(logDir, { recursive: true });
            const logFilename = `refresh_${clientCode}_${selectedDomain.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.json`;
            const logPath = path.join(logDir, logFilename);

            const logContent = {
                meta: diagnostics,
                logs: logs
            };

            await fs.writeFile(logPath, JSON.stringify(logContent, null, 2));
            diagnostics.logFile = logFilename;
            log(`Log written to ${logFilename}`);
        } catch (logErr: any) {
            console.error('Failed to write log file', logErr);
            log(`Failed to write log file: ${logErr.message}`);
        }

        return NextResponse.json({ success: true, diagnostics, logs });

    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ success: false, error: e.message, logs }, { status: 500 });
    }
}
