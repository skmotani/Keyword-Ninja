/**
 * Global DataForSEO Usage Tracker
 */

import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const USAGE_FILE = path.join(process.cwd(), 'data', 'api_logs', 'global_usage.json');

export const API_PRICING = {
    whois: { task: 0.10, item: 0.001, perDomain: 0.101, name: 'Whois API', desc: 'Age, registration' },
    backlinks: { task: 0.02, item: 0.00003, perDomain: 0.020, name: 'Backlinks API', desc: 'RD, backlinks, dofollow' },
    labs: { task: 0.10, item: 0.001, perDomain: 0.101, name: 'Labs API', desc: 'Traffic, keywords, ETV' },
    fullDomain: 0.222,
};

export interface ApiCallLog {
    id: string;
    timestamp: string;
    page: string;
    clientCode: string;
    apiType: 'whois' | 'backlinks' | 'labs' | 'balance';
    endpoint: string;
    domain?: string;
    cost: number;
    success: boolean;
    error?: string;
    durationMs: number;
}

export interface GlobalUsageData {
    logs: ApiCallLog[];
    totals: { allTimeCost: number; allTimeCalls: number; byClient: Record<string, { calls: number; cost: number; lastFetch: string }> };
    lastUpdated: string;
}

async function ensureDir(): Promise<void> {
    const dir = path.dirname(USAGE_FILE);
    try { await fs.access(dir); } catch { await fs.mkdir(dir, { recursive: true }); }
}

async function readUsage(): Promise<GlobalUsageData> {
    try {
        const data = await fs.readFile(USAGE_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return { logs: [], totals: { allTimeCost: 0, allTimeCalls: 0, byClient: {} }, lastUpdated: new Date().toISOString() };
    }
}

async function writeUsage(data: GlobalUsageData): Promise<void> {
    await ensureDir();
    data.lastUpdated = new Date().toISOString();
    if (data.logs.length > 1000) data.logs = data.logs.slice(-1000);
    await fs.writeFile(USAGE_FILE, JSON.stringify(data, null, 2));
}

export async function logApiCall(log: Omit<ApiCallLog, 'id' | 'timestamp'>): Promise<void> {
    const usage = await readUsage();
    usage.logs.push({ ...log, id: uuidv4(), timestamp: new Date().toISOString() });
    usage.totals.allTimeCost += log.cost;
    usage.totals.allTimeCalls += 1;
    if (!usage.totals.byClient[log.clientCode]) {
        usage.totals.byClient[log.clientCode] = { calls: 0, cost: 0, lastFetch: '' };
    }
    usage.totals.byClient[log.clientCode].calls += 1;
    usage.totals.byClient[log.clientCode].cost += log.cost;
    usage.totals.byClient[log.clientCode].lastFetch = new Date().toISOString();
    await writeUsage(usage);
    console.log(`[API Log] ${log.page} | ${log.apiType} | ${log.domain || 'N/A'} | $${log.cost.toFixed(4)} | ${log.success ? '✓' : '✗'}`);
}

export async function getUsageLogs(limit: number = 100): Promise<ApiCallLog[]> {
    const usage = await readUsage();
    return usage.logs.slice(-limit).reverse();
}

export async function getUsageSummary(): Promise<GlobalUsageData['totals'] & { recentLogs: ApiCallLog[] }> {
    const usage = await readUsage();
    return { ...usage.totals, recentLogs: usage.logs.slice(-20).reverse() };
}
