import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const JOBS_DIR = path.join(process.cwd(), 'data', 'jobs', 'client_serp');

export type JobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type JobStage = 'PREPARE' | 'SERP_IN' | 'SERP_GL' | 'DONE';

export interface ClientSerpJob {
    jobId: string;
    clientCode: string;
    selectedDomain: string;
    keywords: string[];
    status: JobStatus;
    stage: JobStage;
    progress: {
        IN: { done: number; total: number; current?: string };
        GL: { done: number; total: number; current?: string };
    };
    errors: string[];
    startedAt?: string;
    completedAt?: string;
    updatedAt: string;
}

async function ensureJobsDir() {
    await fs.mkdir(JOBS_DIR, { recursive: true });
}

// Simple memory lock
let jobLockPromise = Promise.resolve();
function withJobLock<T>(fn: () => Promise<T>): Promise<T> {
    const result = jobLockPromise.then(() => fn());
    jobLockPromise = result.then(() => { }).catch(() => { });
    return result;
}

export async function createJob(
    clientCode: string,
    selectedDomain: string,
    keywords: string[]
): Promise<ClientSerpJob> {
    return withJobLock(async () => {
        await ensureJobsDir();
        const jobId = uuidv4();
        const now = new Date().toISOString();

        const job: ClientSerpJob = {
            jobId,
            clientCode,
            selectedDomain,
            keywords,
            status: 'QUEUED',
            stage: 'PREPARE',
            progress: {
                IN: { done: 0, total: keywords.length },
                GL: { done: 0, total: keywords.length }
            },
            errors: [],
            startedAt: now,
            updatedAt: now
        };

        const filePath = path.join(JOBS_DIR, `${jobId}.json`);
        await fs.writeFile(filePath, JSON.stringify(job, null, 2));
        return job;
    });
}

export async function getJob(jobId: string): Promise<ClientSerpJob | null> {
    // Reads don't strictly need locks if writes are atomic via rename, 
    // but with direct writeFile, a lock is safer to avoid reading partial writes.
    // However, for performance, we might skip lock on read if we assume OS file atomicity is decent,
    // but to be 100% safe against read-after-write races in same process:
    return withJobLock(async () => {
        try {
            const filePath = path.join(JOBS_DIR, `${jobId}.json`);
            const data = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(data) as ClientSerpJob;
        } catch {
            return null;
        }
    });
}

export async function updateJob(jobId: string, updates: Partial<ClientSerpJob>): Promise<void> {
    return withJobLock(async () => {
        const filePath = path.join(JOBS_DIR, `${jobId}.json`);
        let job: ClientSerpJob;
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            job = JSON.parse(data);
        } catch {
            return; // Job not found
        }

        const updated = {
            ...job,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        // Deep merge progress if provided, to avoid overwriting other location
        if (updates.progress) {
            updated.progress = {
                ...job.progress,
                ...updates.progress
            };
        }

        await fs.writeFile(filePath, JSON.stringify(updated, null, 2));
    });
}

