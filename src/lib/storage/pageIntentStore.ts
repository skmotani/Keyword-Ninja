/**
 * Storage utilities for Page Intent Analysis data
 */
import fs from 'fs/promises';
import path from 'path';
import { PageIntentDomainSummary, PageIntentDetail } from '@/types/pageIntent';

const DATA_DIR = path.join(process.cwd(), 'data');
const SUMMARIES_FILE = path.join(DATA_DIR, 'page_intent_summaries.json');
const PAGES_FILE = path.join(DATA_DIR, 'page_intent_pages.json');

// Helper to ensure file exists
async function ensureFile(filePath: string): Promise<void> {
    try {
        await fs.access(filePath);
    } catch {
        await fs.writeFile(filePath, '[]', 'utf-8');
    }
}

// ============ SUMMARIES ============

export async function getSummaries(): Promise<PageIntentDomainSummary[]> {
    await ensureFile(SUMMARIES_FILE);
    const data = await fs.readFile(SUMMARIES_FILE, 'utf-8');
    return JSON.parse(data);
}

export async function getSummariesByClient(clientCode: string): Promise<PageIntentDomainSummary[]> {
    const summaries = await getSummaries();
    return summaries.filter(s => s.clientCode === clientCode);
}

export async function getSummaryByDomain(clientCode: string, domain: string): Promise<PageIntentDomainSummary | null> {
    const summaries = await getSummaries();
    return summaries.find(s => s.clientCode === clientCode && s.domain === domain) || null;
}

export async function upsertSummary(summary: PageIntentDomainSummary): Promise<void> {
    const summaries = await getSummaries();
    const existingIndex = summaries.findIndex(
        s => s.clientCode === summary.clientCode && s.domain === summary.domain
    );

    if (existingIndex >= 0) {
        summaries[existingIndex] = { ...summary, updatedAt: new Date().toISOString() };
    } else {
        summaries.push({
            ...summary,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
    }

    await fs.writeFile(SUMMARIES_FILE, JSON.stringify(summaries, null, 2), 'utf-8');
}

// ============ PAGES ============

export async function getPages(): Promise<PageIntentDetail[]> {
    await ensureFile(PAGES_FILE);
    const data = await fs.readFile(PAGES_FILE, 'utf-8');
    return JSON.parse(data);
}

export async function getPagesByDomain(clientCode: string, domain: string): Promise<PageIntentDetail[]> {
    const pages = await getPages();
    return pages.filter(p => p.clientCode === clientCode && p.domain === domain);
}

export async function upsertPage(page: PageIntentDetail): Promise<void> {
    const pages = await getPages();
    const existingIndex = pages.findIndex(
        p => p.clientCode === page.clientCode && p.url === page.url
    );

    if (existingIndex >= 0) {
        pages[existingIndex] = page;
    } else {
        pages.push(page);
    }

    await fs.writeFile(PAGES_FILE, JSON.stringify(pages, null, 2), 'utf-8');
}

export async function bulkUpsertPages(newPages: PageIntentDetail[]): Promise<void> {
    const pages = await getPages();

    for (const newPage of newPages) {
        const existingIndex = pages.findIndex(
            p => p.clientCode === newPage.clientCode && p.url === newPage.url
        );

        if (existingIndex >= 0) {
            pages[existingIndex] = newPage;
        } else {
            pages.push(newPage);
        }
    }

    await fs.writeFile(PAGES_FILE, JSON.stringify(pages, null, 2), 'utf-8');
}

export async function deletePagesByDomain(clientCode: string, domain: string): Promise<void> {
    const pages = await getPages();
    const filtered = pages.filter(p => !(p.clientCode === clientCode && p.domain === domain));
    await fs.writeFile(PAGES_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
}
