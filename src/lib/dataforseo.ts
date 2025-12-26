
import { promises as fs } from 'fs';
import path from 'path';
import { ApiCredential } from '@/types';

// Simple types for DataForSEO
export interface DfsKeywordDataRequest {
    keywords: string[];
    location_code: number;
    language_code: string;
}

export interface DfsSerpRequest {
    keyword: string;
    location_code: number;
    language_code: string;
    device: string;
    os: string;
    depth: number;
    tag?: string;
}

async function getDfsCredentials(): Promise<ApiCredential | null> {
    try {
        const filePath = path.join(process.cwd(), 'data', 'api_credentials.json');
        const data = await fs.readFile(filePath, 'utf-8');
        const creds = JSON.parse(data) as ApiCredential[];
        // Look for MEERA label or just first DATAFORSEO
        return creds.find(c => c.serviceType === 'DATAFORSEO' && c.isActive) || null;
    } catch {
        return null;
    }
}

async function fetchDfs(endpoint: string, payload: any, creds: ApiCredential) {
    const auth = Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
    const res = await fetch(`https://api.dataforseo.com/v3/${endpoint}`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    return await res.json();
}

export async function fetchKeywordMetrics(
    keywords: string[],
    locationCode: number // 2356 (India) or 2840 (US/Global proxy) - Actually prompt says IN/Global. Using 2840 for Global? Or no location? Global usually implies US or aggregate. Let's use US (2840) as proxy for Global/Ag.
) {
    const creds = await getDfsCredentials();
    if (!creds) throw new Error('No DataForSEO credentials found');

    // Batch in chunks of 500 just to be safe (limit is higher)
    const chunks = [];
    for (let i = 0; i < keywords.length; i += 500) {
        chunks.push(keywords.slice(i, i + 500));
    }

    const results: any[] = [];

    for (const chunk of chunks) {
        const payload = [{
            keywords: chunk,
            location_code: locationCode,
            language_code: 'en'
        }];
        const data = await fetchDfs('keywords_data/google_ads/search_volume/live', payload, creds);

        if (data.tasks?.[0]?.result) {
            results.push(...data.tasks[0].result);
        }
    }
    return results;
}

export async function fetchSerp(
    keywords: string[],
    locationCode: number,
    depth = 200
) {
    const creds = await getDfsCredentials();
    if (!creds) throw new Error('No DataForSEO credentials found');

    // DataForSEO Live SERP endpoint ONLY accepts 1 task per request.
    // We must loop and send them sequentially with a small delay.

    const allTasks: any[] = [];

    console.log(`[fetchSerp] Starting sequential fetch for ${keywords.length} keywords (Loc: ${locationCode})`);

    for (let i = 0; i < keywords.length; i++) {
        const kw = keywords[i];
        const payload = [{
            keyword: kw,
            location_code: locationCode,
            language_code: 'en',
            device: 'desktop',
            os: 'windows',
            depth: depth
        }];

        try {
            // Small delay to prevent throttling
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 250));
            }

            const data = await fetchDfs('serp/google/organic/live/regular', payload, creds);

            if (data.status_code === 20000 && data.tasks) {
                // Success: Collect the task(s)
                // Note: Even with 1 request, data.tasks is an array.
                allTasks.push(...data.tasks);
            } else {
                console.error(`[SERP][ERROR] ${kw} (${locationCode}) status_code=${data.status_code} message=${data.status_message}`);
                // We create a "synthetic" failed task object so the caller knows this keyword failed
                // preserving the structure the route expects (task.data.keyword)
                allTasks.push({
                    status_code: data.status_code || 500,
                    status_message: data.status_message || 'API Error',
                    data: { keyword: kw, location_code: locationCode },
                    result: null
                });
            }
        } catch (err: any) {
            console.error(`[SERP][ERROR] ${kw} (${locationCode}) Exception: ${err.message}`);
            allTasks.push({
                status_code: 500,
                status_message: err.message,
                data: { keyword: kw, location_code: locationCode },
                result: null
            });
        }
    }

    console.log(`[fetchSerp] Completed. Collected ${allTasks.length} tasks.`);
    return allTasks;
}

export const locationMap = {
    'IN': 2356,    // India
    'GL': 2840     // US (Global Proxy)
};
