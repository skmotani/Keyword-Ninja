import { promises as fs } from 'fs';
import path from 'path';
import { ApiCredential } from '@/types';

// Configuration
const DEFAULT_DELAY = 2000; // 2 seconds
const MAX_POLLING_ATTEMPTS = 300; // 10 minutes max (300 * 2s = 600s)
const MAX_CONCURRENT_FETCH = 50;

// Helper for concurrency
async function runConcurrent<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
    const queue = [...items];
    const workers = Array(Math.min(items.length, concurrency)).fill(0).map(async () => {
        while (queue.length > 0) {
            const item = queue.shift()!;
            await fn(item);
        }
    });
    await Promise.all(workers);
}

interface ForensicLogOptions {
    jobId: string;
    locType: string;
    chunkIndex: number;
    attempt?: number;
    tag?: string;
}

async function logRawData(filename: string, data: any, options?: ForensicLogOptions) {
    if (!options || !options.jobId) return;
    try {
        const dir = path.join(process.cwd(), 'data', 'serp_raw', options.jobId, options.locType || 'UNK');
        await fs.mkdir(dir, { recursive: true });
        const filePath = path.join(dir, filename);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch { /* ignore */ }
}

async function getDfsCredentials(): Promise<ApiCredential | null> {
    try {
        const filePath = path.join(process.cwd(), 'data', 'api_credentials.json');
        const data = await fs.readFile(filePath, 'utf-8');
        const creds = JSON.parse(data) as ApiCredential[];
        return creds.find(c => c.serviceType === 'DATAFORSEO' && c.isActive) || null;
    } catch {
        return null;
    }
}

/**
 * Canonical DataForSEO HTTP Helper
 * - GET for task_get endpoints (no body)
 * - POST for task_post (JSON array body)
 */
async function fetchDfs(endpoint: string, payload: any, creds: ApiCredential) {
    const auth = Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
    const fullUrl = `https://api.dataforseo.com/v3/${endpoint}`;

    const isGet = endpoint.includes('/task_get/');
    const method = isGet ? 'GET' : 'POST';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const headers: Record<string, string> = {
            'Authorization': `Basic ${auth}`
        };

        const fetchOptions: RequestInit = {
            method: method,
            headers: headers,
            signal: controller.signal
        };

        let bodyPreview = '<none>';

        if (method === 'POST') {
            headers['Content-Type'] = 'application/json';
            const payloadArray = Array.isArray(payload) ? payload : (payload ? [payload] : []);
            const bodyStr = JSON.stringify(payloadArray);
            fetchOptions.body = bodyStr;
            bodyPreview = bodyStr.substring(0, 80);
        }

        console.log(`[DFS] ${method} ${endpoint} body=${bodyPreview}`);

        const res = await fetch(fullUrl, fetchOptions);
        clearTimeout(timeoutId);

        const jsonData = await res.json();
        console.log(`[DFS] ${method} ${endpoint} => HTTP ${res.status}, status_code=${jsonData.status_code}`);

        return jsonData;

    } catch (e: any) {
        clearTimeout(timeoutId);
        if (e.name === 'AbortError') throw new Error(`Timeout: ${endpoint}`);
        throw e;
    }
}

// METRICS
export async function postMetricsTask(keywords: string[], locationCode: number, jobId: string) {
    const creds = await getDfsCredentials();
    if (!creds) throw new Error('No DataForSEO credentials found');

    const payload = [{
        location_code: locationCode,
        language_code: 'en',
        keywords: keywords.slice(0, 1000),
        tag: jobId
    }];

    const data = await fetchDfs('keywords_data/google_ads/search_volume/task_post', payload, creds);
    if (!data.tasks?.[0]?.id) throw new Error('Metrics Task Post failed: ' + (data.status_message || 'Unknown'));
    return data.tasks[0].id;
}

export async function pollMetricsTask(taskId: string): Promise<any[]> {
    const creds = await getDfsCredentials();
    if (!creds) throw new Error('No Creds');

    for (let i = 0; i < 60; i++) {
        const data = await fetchDfs(`keywords_data/google_ads/search_volume/task_get/regular/${taskId}`, null, creds);
        if (data.tasks?.[0]?.result) return data.tasks[0].result;
        await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error('Metrics Polling Timeout');
}

// SERP
export async function postSerpTaskChunk(keywords: string[], locationCode: number, depth: number, jobId: string, logOptions?: ForensicLogOptions) {
    const creds = await getDfsCredentials();
    if (!creds) throw new Error('No Creds');

    const tasksPayload = keywords.map(kw => ({
        keyword: kw,
        location_code: locationCode,
        language_code: 'en',
        device: 'desktop',
        os: 'windows',
        depth: 50,
        tag: jobId
    }));

    const data = await fetchDfs('serp/google/organic/task_post', tasksPayload, creds);
    if (logOptions) await logRawData(`task_post_${logOptions.chunkIndex}.json`, data, logOptions);

    if (!data.tasks) throw new Error('SERP Task Post Failed: ' + (data.status_message || 'Unknown'));

    const taskIds = data.tasks.map((t: any) => t.id);
    console.log(`[postSerpTaskChunk] Posted ${taskIds.length} tasks`);
    return taskIds;
}

export interface SerpResultWrapper {
    id: string;
    status: 'COMPLETED' | 'ERROR' | 'TIMEOUT';
    data?: any;
    error?: string;
}

function extractOrganicItems(task: any): any[] {
    let items: any[] = [];
    const results = Array.isArray(task.result) ? task.result : (task.result ? [task.result] : []);
    for (const res of results) {
        if (res.items) items.push(...res.items);
    }
    return items.filter((i: any) => i.type === 'organic');
}

/**
 * Poll each task using dynamic worker pool for maximum throughput.
 * Returns 40602 if queued.
 * Returns 20000 when result is ready.
 */
export async function waitForSerpResults(
    ids: string[],
    logOptions?: ForensicLogOptions,
    onResult?: (res: SerpResultWrapper) => Promise<void>
): Promise<SerpResultWrapper[]> {
    const creds = await getDfsCredentials();
    if (!creds) throw new Error('No Creds');

    const pending = new Set(ids);
    const resultsMap = new Map<string, SerpResultWrapper>();
    ids.forEach(id => resultsMap.set(id, { id, status: 'TIMEOUT' }));

    console.log(`[waitForSerpResults] Polling ${ids.length} tasks directly...`);

    for (let attempt = 1; attempt <= MAX_POLLING_ATTEMPTS; attempt++) {
        if (pending.size === 0) break;

        console.log(`[waitForSerpResults] Attempt ${attempt}/${MAX_POLLING_ATTEMPTS}: ${pending.size} still pending`);

        const pendingArr = Array.from(pending);

        // Poll pending tasks with dynamic pool (no head-of-line blocking)
        await runConcurrent(pendingArr, MAX_CONCURRENT_FETCH, async (id) => {
            try {
                const data = await fetchDfs(`serp/google/organic/task_get/regular/${id}`, null, creds!);

                if (logOptions) await logRawData(`task_get_${logOptions.chunkIndex}_${id}_${attempt}.json`, data, logOptions);

                const task = data.tasks?.[0];

                if (!task) {
                    // No task returned - error
                    resultsMap.set(id, { id, status: 'ERROR', error: 'No task in response' });
                    pending.delete(id);
                    if (onResult) await onResult(resultsMap.get(id)!);
                    return;
                }

                // Check task status
                if (task.status_code === 20000) {
                    // SUCCESS - task is ready with results
                    console.log(`[task ${id}] COMPLETED - items: ${task.result?.[0]?.items?.length || 0}`);
                    resultsMap.set(id, { id, status: 'COMPLETED', data: task });
                    pending.delete(id);
                    if (onResult) await onResult(resultsMap.get(id)!);
                } else if (task.status_code === 40602) {
                    // QUEUED - still processing, keep waiting
                    // Don't log every time to reduce noise
                } else if (task.status_code === 40501) {
                    // Task not found - error
                    console.log(`[task ${id}] NOT FOUND (40501)`);
                    resultsMap.set(id, { id, status: 'ERROR', error: 'Task not found' });
                    pending.delete(id);
                    if (onResult) await onResult(resultsMap.get(id)!);
                } else {
                    // Other error
                    console.log(`[task ${id}] ERROR ${task.status_code}: ${task.status_message}`);
                    resultsMap.set(id, { id, status: 'ERROR', error: task.status_message });
                    pending.delete(id);
                    if (onResult) await onResult(resultsMap.get(id)!);
                }

            } catch (e: any) {
                console.error(`[task ${id}] Fetch error: ${e.message}`);
                // Keep in pending for retry
            }
        });

        // Wait before next polling round
        if (pending.size > 0 && attempt < MAX_POLLING_ATTEMPTS) {
            await new Promise(r => setTimeout(r, DEFAULT_DELAY));
        }
    }

    // Mark remaining as timeout
    for (const id of Array.from(pending)) {
        console.log(`[task ${id}] TIMEOUT after ${MAX_POLLING_ATTEMPTS} attempts`);
    }

    return Array.from(resultsMap.values());
}
