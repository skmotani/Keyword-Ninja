/**
 * Storage utilities for Page Intent Analysis data
 * Uses PostgreSQL when USE_POSTGRES_PAGE_INTENT is enabled, falls back to JSON
 */
import fs from 'fs/promises';
import path from 'path';
import { PageIntentDomainSummary, PageIntentDetail } from '@/types/pageIntent';
import { prisma } from '@/lib/prisma';

const USE_POSTGRES = process.env.USE_POSTGRES_PAGE_INTENT === 'true';
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
    if (USE_POSTGRES) {
        const records = await prisma.pageIntentSummary.findMany();
        return records.map(r => ({
            id: r.id,
            clientCode: r.clientCode,
            domain: r.url,
            totalPages: (r.summaryJson as any)?.totalPages ?? 0,
            problemAwareSolutionCount: (r.summaryJson as any)?.problemAwareSolutionCount ?? 0,
            educationalInformationalCount: (r.summaryJson as any)?.educationalInformationalCount ?? 0,
            commercialInvestigationCount: (r.summaryJson as any)?.commercialInvestigationCount ?? 0,
            trustProofCount: (r.summaryJson as any)?.trustProofCount ?? 0,
            brandNavigationCount: (r.summaryJson as any)?.brandNavigationCount ?? 0,
            transactionalCount: (r.summaryJson as any)?.transactionalCount ?? 0,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
        }));
    }
    await ensureFile(SUMMARIES_FILE);
    const data = await fs.readFile(SUMMARIES_FILE, 'utf-8');
    return JSON.parse(data);
}

export async function getSummariesByClient(clientCode: string): Promise<PageIntentDomainSummary[]> {
    if (USE_POSTGRES) {
        const records = await prisma.pageIntentSummary.findMany({
            where: { clientCode }
        });
        return records.map(r => ({
            id: r.id,
            clientCode: r.clientCode,
            domain: r.url,
            totalPages: (r.summaryJson as any)?.totalPages ?? 0,
            problemAwareSolutionCount: (r.summaryJson as any)?.problemAwareSolutionCount ?? 0,
            educationalInformationalCount: (r.summaryJson as any)?.educationalInformationalCount ?? 0,
            commercialInvestigationCount: (r.summaryJson as any)?.commercialInvestigationCount ?? 0,
            trustProofCount: (r.summaryJson as any)?.trustProofCount ?? 0,
            brandNavigationCount: (r.summaryJson as any)?.brandNavigationCount ?? 0,
            transactionalCount: (r.summaryJson as any)?.transactionalCount ?? 0,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
        }));
    }
    const summaries = await getSummaries();
    return summaries.filter(s => s.clientCode === clientCode);
}

export async function getSummaryByDomain(clientCode: string, domain: string): Promise<PageIntentDomainSummary | null> {
    if (USE_POSTGRES) {
        const record = await prisma.pageIntentSummary.findFirst({
            where: { clientCode, url: domain }
        });
        if (!record) return null;
        return {
            id: record.id,
            clientCode: record.clientCode,
            domain: record.url,
            totalPages: (record.summaryJson as any)?.totalPages ?? 0,
            problemAwareSolutionCount: (record.summaryJson as any)?.problemAwareSolutionCount ?? 0,
            educationalInformationalCount: (record.summaryJson as any)?.educationalInformationalCount ?? 0,
            commercialInvestigationCount: (record.summaryJson as any)?.commercialInvestigationCount ?? 0,
            trustProofCount: (record.summaryJson as any)?.trustProofCount ?? 0,
            brandNavigationCount: (record.summaryJson as any)?.brandNavigationCount ?? 0,
            transactionalCount: (record.summaryJson as any)?.transactionalCount ?? 0,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
        };
    }
    const summaries = await getSummaries();
    return summaries.find(s => s.clientCode === clientCode && s.domain === domain) || null;
}

export async function upsertSummary(summary: PageIntentDomainSummary): Promise<void> {
    if (USE_POSTGRES) {
        const existing = await prisma.pageIntentSummary.findFirst({
            where: { clientCode: summary.clientCode, url: summary.domain }
        });

        const summaryJson = {
            totalPages: summary.totalPages,
            problemAwareSolutionCount: summary.problemAwareSolutionCount,
            educationalInformationalCount: summary.educationalInformationalCount,
            commercialInvestigationCount: summary.commercialInvestigationCount,
            trustProofCount: summary.trustProofCount,
            brandNavigationCount: summary.brandNavigationCount,
            transactionalCount: summary.transactionalCount,
        };

        if (existing) {
            await prisma.pageIntentSummary.update({
                where: { id: existing.id },
                data: { summaryJson, updatedAt: new Date() }
            });
        } else {
            await prisma.pageIntentSummary.create({
                data: {
                    id: summary.id,
                    clientCode: summary.clientCode,
                    url: summary.domain,
                    summaryJson,
                }
            });
        }
        return;
    }

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
    if (USE_POSTGRES) {
        const records = await prisma.pageIntentPage.findMany();
        return records.map(r => ({
            id: r.id,
            clientCode: r.clientCode,
            domain: (r.intentData as any)?.domain ?? '',
            url: r.url,
            intent: (r.intentData as any)?.intent ?? '',
            createdAt: r.createdAt.toISOString(),
        }));
    }
    await ensureFile(PAGES_FILE);
    const data = await fs.readFile(PAGES_FILE, 'utf-8');
    return JSON.parse(data);
}

export async function getPagesByDomain(clientCode: string, domain: string): Promise<PageIntentDetail[]> {
    if (USE_POSTGRES) {
        const records = await prisma.pageIntentPage.findMany({
            where: { clientCode }
        });
        return records
            .filter(r => (r.intentData as any)?.domain === domain)
            .map(r => ({
                id: r.id,
                clientCode: r.clientCode,
                domain: (r.intentData as any)?.domain ?? '',
                url: r.url,
                intent: (r.intentData as any)?.intent ?? '',
                createdAt: r.createdAt.toISOString(),
            }));
    }
    const pages = await getPages();
    return pages.filter(p => p.clientCode === clientCode && p.domain === domain);
}

export async function upsertPage(page: PageIntentDetail): Promise<void> {
    if (USE_POSTGRES) {
        const existing = await prisma.pageIntentPage.findFirst({
            where: { clientCode: page.clientCode, url: page.url }
        });

        const intentData = { domain: page.domain, intent: page.intent };

        if (existing) {
            await prisma.pageIntentPage.update({
                where: { id: existing.id },
                data: { intentData, updatedAt: new Date() }
            });
        } else {
            await prisma.pageIntentPage.create({
                data: {
                    id: page.id,
                    clientCode: page.clientCode,
                    url: page.url,
                    intentData,
                }
            });
        }
        return;
    }

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
    if (USE_POSTGRES) {
        for (const page of newPages) {
            await upsertPage(page);
        }
        return;
    }

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
    if (USE_POSTGRES) {
        const records = await prisma.pageIntentPage.findMany({
            where: { clientCode }
        });
        const toDelete = records.filter(r => (r.intentData as any)?.domain === domain);
        for (const r of toDelete) {
            await prisma.pageIntentPage.delete({ where: { id: r.id } });
        }
        return;
    }

    const pages = await getPages();
    const filtered = pages.filter(p => !(p.clientCode === clientCode && p.domain === domain));
    await fs.writeFile(PAGES_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
}
