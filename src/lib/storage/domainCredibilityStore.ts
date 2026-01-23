/**
 * Domain Credibility Storage
 * Uses PostgreSQL when USE_POSTGRES_DOMAIN_CREDIBILITY is enabled
 */

import { promises as fs } from 'fs';
import path from 'path';
import { DomainCredibilityRecord, LocationCode } from '@/lib/dataforseo/index';
import { prisma } from '@/lib/prisma';

const USE_POSTGRES = process.env.USE_POSTGRES_DOMAIN_CREDIBILITY === 'true';
const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'domain_credibility.json');

// ============================================================================
// TYPES
// ============================================================================

export interface CredibilityStoreSummary {
    totalRecords: number;
    clientDomains: number;
    competitorDomains: number;
    avgDomainAge: number | null;
    avgReferringDomains: number | null;
    oldestFetch: string | null;
    newestFetch: string | null;
    lastUpdated: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function ensureDataDir(): Promise<void> {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

async function readStore(): Promise<DomainCredibilityRecord[]> {
    if (USE_POSTGRES) {
        const records = await (prisma.domainCredibility as any).findMany();
        return records.map(r => ({
            id: r.id,
            clientCode: r.clientCode,
            domain: r.domain,
            domainType: r.domainType as 'client' | 'competitor',
            locationCode: r.locationCode as LocationCode,
            domainAgeYears: r.domainAgeYears,
            referringDomains: r.referringDomains,
            totalBacklinks: r.totalBacklinks,
            dofollowBacklinks: r.dofollowBacklinks,
            nofollowBacklinks: r.nofollowBacklinks,
            organicTraffic: r.organicTraffic,
            organicCost: r.organicCost,
            organicKeywordsCount: r.organicKeywordsCount,
            paidKeywordsCount: r.paidKeywordsCount,
            organicTop3: r.organicTop3,
            organicTop10: r.organicTop10,
            organicTop100: r.organicTop100,
            keywordVisibilityScore: r.keywordVisibilityScore,
            paidTraffic: r.paidTraffic,
            paidCost: r.paidCost,
            fetchedAt: r.fetchedAt,
        }));
    }
    try {
        await ensureDataDir();
        const data = await fs.readFile(STORE_FILE, 'utf-8');
        return JSON.parse(data) as DomainCredibilityRecord[];
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return [];
        }
        return [];
    }
}

async function writeStore(records: DomainCredibilityRecord[]): Promise<void> {
    if (USE_POSTGRES) return;
    await ensureDataDir();
    await fs.writeFile(STORE_FILE, JSON.stringify(records, null, 2), 'utf-8');
}

function createRecordKey(clientCode: string, domain: string, locationCode: LocationCode): string {
    return `${clientCode}:${domain.toLowerCase()}:${locationCode}`;
}

// ============================================================================
// PUBLIC API - Read Operations
// ============================================================================

export async function getAllCredibilityRecords(): Promise<DomainCredibilityRecord[]> {
    return readStore();
}

export async function getCredibilityByClient(clientCode: string): Promise<DomainCredibilityRecord[]> {
    if (USE_POSTGRES) {
        const records = await (prisma.domainCredibility as any).findMany({ where: { clientCode } });
        return records.map(r => ({
            id: r.id,
            clientCode: r.clientCode,
            domain: r.domain,
            domainType: r.domainType as 'client' | 'competitor',
            locationCode: r.locationCode as LocationCode,
            domainAgeYears: r.domainAgeYears,
            referringDomains: r.referringDomains,
            totalBacklinks: r.totalBacklinks,
            dofollowBacklinks: r.dofollowBacklinks,
            nofollowBacklinks: r.nofollowBacklinks,
            organicTraffic: r.organicTraffic,
            organicCost: r.organicCost,
            organicKeywordsCount: r.organicKeywordsCount,
            paidKeywordsCount: r.paidKeywordsCount,
            organicTop3: r.organicTop3,
            organicTop10: r.organicTop10,
            organicTop100: r.organicTop100,
            keywordVisibilityScore: r.keywordVisibilityScore,
            paidTraffic: r.paidTraffic,
            paidCost: r.paidCost,
            fetchedAt: r.fetchedAt,
        }));
    }
    const records = await readStore();
    return records.filter(r => r.clientCode === clientCode);
}

export async function getCredibilityByClientAndLocation(
    clientCode: string,
    locationCode: LocationCode
): Promise<DomainCredibilityRecord[]> {
    if (USE_POSTGRES) {
        const records = await (prisma.domainCredibility as any).findMany({ where: { clientCode, locationCode } });
        return records.map(r => ({
            id: r.id,
            clientCode: r.clientCode,
            domain: r.domain,
            domainType: r.domainType as 'client' | 'competitor',
            locationCode: r.locationCode as LocationCode,
            domainAgeYears: r.domainAgeYears,
            referringDomains: r.referringDomains,
            totalBacklinks: r.totalBacklinks,
            dofollowBacklinks: r.dofollowBacklinks,
            nofollowBacklinks: r.nofollowBacklinks,
            organicTraffic: r.organicTraffic,
            organicCost: r.organicCost,
            organicKeywordsCount: r.organicKeywordsCount,
            paidKeywordsCount: r.paidKeywordsCount,
            organicTop3: r.organicTop3,
            organicTop10: r.organicTop10,
            organicTop100: r.organicTop100,
            keywordVisibilityScore: r.keywordVisibilityScore,
            paidTraffic: r.paidTraffic,
            paidCost: r.paidCost,
            fetchedAt: r.fetchedAt,
        }));
    }
    const records = await readStore();
    return records.filter(r => r.clientCode === clientCode && r.locationCode === locationCode);
}

export async function getCredibilityByDomain(
    clientCode: string,
    domain: string,
    locationCode: LocationCode
): Promise<DomainCredibilityRecord | null> {
    if (USE_POSTGRES) {
        const record = await (prisma.domainCredibility as any).findFirst({
            where: { clientCode, domain: { equals: domain, mode: 'insensitive' }, locationCode }
        });
        if (!record) return null;
        return {
            id: record.id,
            clientCode: record.clientCode,
            domain: record.domain,
            domainType: record.domainType as 'client' | 'competitor',
            locationCode: record.locationCode as LocationCode,
            domainAgeYears: record.domainAgeYears,
            referringDomains: record.referringDomains,
            totalBacklinks: record.totalBacklinks,
            dofollowBacklinks: record.dofollowBacklinks,
            nofollowBacklinks: record.nofollowBacklinks,
            organicTraffic: record.organicTraffic,
            organicCost: record.organicCost,
            organicKeywordsCount: record.organicKeywordsCount,
            paidKeywordsCount: record.paidKeywordsCount,
            organicTop3: record.organicTop3,
            organicTop10: record.organicTop10,
            organicTop100: record.organicTop100,
            keywordVisibilityScore: record.keywordVisibilityScore,
            paidTraffic: record.paidTraffic,
            paidCost: record.paidCost,
            fetchedAt: record.fetchedAt,
        };
    }
    const records = await readStore();
    const normalizedDomain = domain.toLowerCase().trim();
    return records.find(
        r => r.clientCode === clientCode &&
            r.domain.toLowerCase() === normalizedDomain &&
            r.locationCode === locationCode
    ) || null;
}

export async function hasRecentData(
    clientCode: string,
    locationCode: LocationCode,
    maxAgeHours: number = 24
): Promise<boolean> {
    const records = await getCredibilityByClientAndLocation(clientCode, locationCode);
    if (records.length === 0) return false;

    const cutoff = Date.now() - (maxAgeHours * 60 * 60 * 1000);
    return records.some(r => new Date(r.fetchedAt).getTime() > cutoff);
}

// ============================================================================
// PUBLIC API - Write Operations
// ============================================================================

export async function saveCredibilityRecords(
    newRecords: DomainCredibilityRecord[]
): Promise<{ saved: number; updated: number }> {
    if (USE_POSTGRES) {
        let saved = 0, updated = 0;
        for (const record of newRecords) {
            const existing = await (prisma.domainCredibility as any).findFirst({
                where: { clientCode: record.clientCode, domain: { equals: record.domain, mode: 'insensitive' }, locationCode: record.locationCode }
            });
            if (existing) {
                await (prisma.domainCredibility as any).update({
                    where: { id: existing.id },
                    data: {
                        domainType: record.domainType,
                        domainAgeYears: record.domainAgeYears,
                        referringDomains: record.referringDomains,
                        totalBacklinks: record.totalBacklinks,
                        dofollowBacklinks: record.dofollowBacklinks,
                        nofollowBacklinks: record.nofollowBacklinks,
                        organicTraffic: record.organicTraffic,
                        organicCost: record.organicCost,
                        organicKeywordsCount: record.organicKeywordsCount,
                        paidKeywordsCount: record.paidKeywordsCount,
                        organicTop3: record.organicTop3,
                        organicTop10: record.organicTop10,
                        organicTop100: record.organicTop100,
                        keywordVisibilityScore: record.keywordVisibilityScore,
                        paidTraffic: record.paidTraffic,
                        paidCost: record.paidCost,
                        fetchedAt: record.fetchedAt,
                        updatedAt: new Date(),
                    }
                });
                updated++;
            } else {
                await (prisma.domainCredibility as any).create({
                    data: {
                        id: record.id,
                        clientCode: record.clientCode,
                        domain: record.domain,
                        domainType: record.domainType,
                        locationCode: record.locationCode,
                        domainAgeYears: record.domainAgeYears,
                        referringDomains: record.referringDomains,
                        totalBacklinks: record.totalBacklinks,
                        dofollowBacklinks: record.dofollowBacklinks,
                        nofollowBacklinks: record.nofollowBacklinks,
                        organicTraffic: record.organicTraffic,
                        organicCost: record.organicCost,
                        organicKeywordsCount: record.organicKeywordsCount,
                        paidKeywordsCount: record.paidKeywordsCount,
                        organicTop3: record.organicTop3,
                        organicTop10: record.organicTop10,
                        organicTop100: record.organicTop100,
                        keywordVisibilityScore: record.keywordVisibilityScore,
                        paidTraffic: record.paidTraffic,
                        paidCost: record.paidCost,
                        fetchedAt: record.fetchedAt,
                    }
                });
                saved++;
            }
        }
        return { saved, updated };
    }

    const existing = await readStore();
    const recordMap = new Map<string, DomainCredibilityRecord>();

    for (const record of existing) {
        const key = createRecordKey(record.clientCode, record.domain, record.locationCode);
        recordMap.set(key, record);
    }

    let updated = 0;
    let saved = 0;

    for (const record of newRecords) {
        const key = createRecordKey(record.clientCode, record.domain, record.locationCode);

        if (recordMap.has(key)) {
            const oldRecord = recordMap.get(key)!;
            recordMap.set(key, { ...record, id: oldRecord.id });
            updated++;
        } else {
            recordMap.set(key, record);
            saved++;
        }
    }

    const allRecords = Array.from(recordMap.values());
    await writeStore(allRecords);

    return { saved, updated };
}

export async function replaceClientLocationCredibility(
    clientCode: string,
    locationCode: LocationCode,
    newRecords: DomainCredibilityRecord[]
): Promise<void> {
    if (USE_POSTGRES) {
        await (prisma.domainCredibility as any).deleteMany({ where: { clientCode, locationCode } });
        for (const record of newRecords) {
            await (prisma.domainCredibility as any).create({
                data: {
                    id: record.id,
                    clientCode: record.clientCode,
                    domain: record.domain,
                    domainType: record.domainType,
                    locationCode: record.locationCode,
                    domainAgeYears: record.domainAgeYears,
                    referringDomains: record.referringDomains,
                    totalBacklinks: record.totalBacklinks,
                    dofollowBacklinks: record.dofollowBacklinks,
                    nofollowBacklinks: record.nofollowBacklinks,
                    organicTraffic: record.organicTraffic,
                    organicCost: record.organicCost,
                    organicKeywordsCount: record.organicKeywordsCount,
                    paidKeywordsCount: record.paidKeywordsCount,
                    organicTop3: record.organicTop3,
                    organicTop10: record.organicTop10,
                    organicTop100: record.organicTop100,
                    keywordVisibilityScore: record.keywordVisibilityScore,
                    paidTraffic: record.paidTraffic,
                    paidCost: record.paidCost,
                    fetchedAt: record.fetchedAt,
                }
            });
        }
        return;
    }
    const existing = await readStore();
    const filtered = existing.filter(r => !(r.clientCode === clientCode && r.locationCode === locationCode));
    const updated = [...filtered, ...newRecords];
    await writeStore(updated);
}

export async function deleteCredibilityRecord(
    clientCode: string,
    domain: string,
    locationCode: LocationCode
): Promise<boolean> {
    if (USE_POSTGRES) {
        const existing = await (prisma.domainCredibility as any).findFirst({
            where: { clientCode, domain: { equals: domain, mode: 'insensitive' }, locationCode }
        });
        if (!existing) return false;
        await (prisma.domainCredibility as any).delete({ where: { id: existing.id } });
        return true;
    }
    const records = await readStore();
    const normalizedDomain = domain.toLowerCase().trim();

    const filtered = records.filter(
        r => !(r.clientCode === clientCode &&
            r.domain.toLowerCase() === normalizedDomain &&
            r.locationCode === locationCode)
    );

    if (filtered.length === records.length) {
        return false;
    }

    await writeStore(filtered);
    return true;
}

export async function deleteClientCredibility(clientCode: string): Promise<number> {
    if (USE_POSTGRES) {
        const result = await (prisma.domainCredibility as any).deleteMany({ where: { clientCode } });
        return result.count;
    }
    const records = await readStore();
    const filtered = records.filter(r => r.clientCode !== clientCode);
    const deletedCount = records.length - filtered.length;

    await writeStore(filtered);
    return deletedCount;
}

// ============================================================================
// PUBLIC API - Summary & Analytics
// ============================================================================

export async function getCredibilitySummary(
    clientCode: string,
    locationCode?: LocationCode
): Promise<CredibilityStoreSummary> {
    let records = await getCredibilityByClient(clientCode);

    if (locationCode) {
        records = records.filter(r => r.locationCode === locationCode);
    }

    if (records.length === 0) {
        return {
            totalRecords: 0,
            clientDomains: 0,
            competitorDomains: 0,
            avgDomainAge: null,
            avgReferringDomains: null,
            oldestFetch: null,
            newestFetch: null,
            lastUpdated: new Date().toISOString(),
        };
    }

    const clientDomains = records.filter(r => r.domainType === 'client');
    const competitorDomains = records.filter(r => r.domainType === 'competitor');

    const agesWithData = records.filter(r => r.domainAgeYears !== null);
    const avgDomainAge = agesWithData.length > 0
        ? Math.round((agesWithData.reduce((sum, r) => sum + (r.domainAgeYears || 0), 0) / agesWithData.length) * 10) / 10
        : null;

    const rdWithData = records.filter(r => r.referringDomains !== null);
    const avgReferringDomains = rdWithData.length > 0
        ? Math.round(rdWithData.reduce((sum, r) => sum + (r.referringDomains || 0), 0) / rdWithData.length)
        : null;

    const sortedByTime = [...records].sort(
        (a, b) => new Date(a.fetchedAt).getTime() - new Date(b.fetchedAt).getTime()
    );

    return {
        totalRecords: records.length,
        clientDomains: clientDomains.length,
        competitorDomains: competitorDomains.length,
        avgDomainAge,
        avgReferringDomains,
        oldestFetch: sortedByTime[0]?.fetchedAt || null,
        newestFetch: sortedByTime[sortedByTime.length - 1]?.fetchedAt || null,
        lastUpdated: new Date().toISOString(),
    };
}

export async function getLastFetchedAt(
    clientCode: string,
    locationCode?: LocationCode
): Promise<string | null> {
    let records = await getCredibilityByClient(clientCode);

    if (locationCode) {
        records = records.filter(r => r.locationCode === locationCode);
    }

    if (records.length === 0) return null;

    const sorted = records.sort(
        (a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime()
    );

    return sorted[0].fetchedAt;
}

export const CREDIBILITY_STORE_VERSION = '2.0.0';

