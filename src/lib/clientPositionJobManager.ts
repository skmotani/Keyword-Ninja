import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const JOBS_DIR = path.join(process.cwd(), 'data', 'jobs', 'client_position');

export type JobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type JobStage = 'PREPARE' | 'METRICS_IN' | 'METRICS_GL' | 'SERP_IN' | 'SERP_GL' | 'FINALIZE' | 'DONE';

export interface ClientPositionJob {
    jobId: string;
    status: JobStatus;
    clientCode: string;
    selectedDomain: string;
    createdAt: string;
    startedAt: string | null;
    updatedAt: string;
    finishedAt: string | null;
    stage: JobStage;
    totalKeywords: number;
    metrics: {
        IN: { done: number; total: number; errors: number };
        GL: { done: number; total: number; errors: number };
    };
    serp: {
        IN: { done: number; total: number; errors: number; empty: number };
        GL: { done: number; total: number; errors: number; empty: number };
    };
    progressPercent: number;
    etaSeconds: number | null;
    lastLogs: string[];
    errors: string[];
    auditCsvPath?: string;
    heartbeat: number;
}

export async function ensureJobsDir() {
    await fs.mkdir(JOBS_DIR, { recursive: true });
}

export async function getJob(jobId: string): Promise<ClientPositionJob | null> {
    try {
        await ensureJobsDir();
        const filePath = path.join(JOBS_DIR, `${jobId}.json`);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch {
        return null;
    }
}

export async function updateJob(jobId: string, updates: Partial<ClientPositionJob>) {
    await ensureJobsDir();
    const filePath = path.join(JOBS_DIR, `${jobId}.json`);
    const tempPath = path.join(JOBS_DIR, `${jobId}.tmp`);

    let job: ClientPositionJob;
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        job = JSON.parse(data);
    } catch {
        throw new Error(`Job ${jobId} not found`);
    }

    const updatedJob = { ...job, ...updates, updatedAt: new Date().toISOString() };

    try {
        await fs.writeFile(tempPath, JSON.stringify(updatedJob, null, 2));
        await fs.rename(tempPath, filePath);
    } catch (e) {
        // If rename fails (rare), we might leave a temp file.
        // Retry logic could be added here but keeping it simple for now.
        throw e;
    }

    return updatedJob;
}

export async function createJob(clientCode: string, selectedDomain: string): Promise<ClientPositionJob> {
    await ensureJobsDir();

    // Check for existing RUNNING job
    try {
        const files = await fs.readdir(JOBS_DIR);
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            try {
                const content = await fs.readFile(path.join(JOBS_DIR, file), 'utf-8');
                const existing = JSON.parse(content) as ClientPositionJob;
                if (existing.status === 'RUNNING' && existing.clientCode === clientCode && existing.selectedDomain === selectedDomain) {
                    return existing;
                }
            } catch { /* ignore */ }
        }
    } catch { /* ignore readdir error */ }

    const jobId = uuidv4();
    const newJob: ClientPositionJob = {
        jobId,
        status: 'QUEUED',
        clientCode,
        selectedDomain,
        createdAt: new Date().toISOString(),
        startedAt: null,
        updatedAt: new Date().toISOString(),
        finishedAt: null,
        stage: 'PREPARE',
        totalKeywords: 0,
        metrics: {
            IN: { done: 0, total: 0, errors: 0 },
            GL: { done: 0, total: 0, errors: 0 }
        },
        serp: {
            IN: { done: 0, total: 0, errors: 0, empty: 0 },
            GL: { done: 0, total: 0, errors: 0, empty: 0 }
        },
        progressPercent: 0,
        etaSeconds: null,
        lastLogs: [],
        errors: [],
        heartbeat: 0
    };

    const filePath = path.join(JOBS_DIR, `${jobId}.json`);
    const tempPath = path.join(JOBS_DIR, `${jobId}.tmp`);

    await fs.writeFile(tempPath, JSON.stringify(newJob, null, 2));
    await fs.rename(tempPath, filePath);

    return newJob;
}
