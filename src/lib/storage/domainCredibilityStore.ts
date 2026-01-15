/**
 * Domain Credibility Storage
 * Persists domain credibility data to JSON files
 * 
 * Features:
 * - Save with timestamps
 * - Load without re-fetching
 * - Track previous fetches for comparison
 * - Per-client storage
 */

import { promises as fs } from 'fs';
import path from 'path';
import { DomainCredibilityRecord, LocationCode } from '@/lib/dataforseo/index';

console.log('[CredibilityStore] Module loaded');

// ============================================================================
// CONFIGURATION
// ============================================================================

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
        console.log(`[CredibilityStore] Created data directory: ${DATA_DIR}`);
    }
}

async function readStore(): Promise<DomainCredibilityRecord[]> {
    try {
        await ensureDataDir();
        const data = await fs.readFile(STORE_FILE, 'utf-8');
        const records = JSON.parse(data) as DomainCredibilityRecord[];
        console.log(`[CredibilityStore] Loaded ${records.length} records from storage`);
        return records;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            console.log('[CredibilityStore] No existing store file, starting fresh');
            return [];
        }
        console.error('[CredibilityStore] Error reading store:', error);
        return [];
    }
}

async function writeStore(records: DomainCredibilityRecord[]): Promise<void> {
    await ensureDataDir();
    await fs.writeFile(STORE_FILE, JSON.stringify(records, null, 2), 'utf-8');
    console.log(`[CredibilityStore] Saved ${records.length} records to storage`);
}

function createRecordKey(clientCode: string, domain: string, locationCode: LocationCode): string {
    return `${clientCode}:${domain.toLowerCase()}:${locationCode}`;
}

// ============================================================================
// PUBLIC API - Read Operations
// ============================================================================

/**
 * Get all credibility records
 */
export async function getAllCredibilityRecords(): Promise<DomainCredibilityRecord[]> {
    return readStore();
}

/**
 * Get credibility records for a specific client
 */
export async function getCredibilityByClient(
    clientCode: string
): Promise<DomainCredibilityRecord[]> {
    const records = await readStore();
    return records.filter(r => r.clientCode === clientCode);
}

/**
 * Get credibility records for a client and location
 */
export async function getCredibilityByClientAndLocation(
    clientCode: string,
    locationCode: LocationCode
): Promise<DomainCredibilityRecord[]> {
    const records = await readStore();
    return records.filter(r => r.clientCode === clientCode && r.locationCode === locationCode);
}

/**
 * Get credibility record for a specific domain
 */
export async function getCredibilityByDomain(
    clientCode: string,
    domain: string,
    locationCode: LocationCode
): Promise<DomainCredibilityRecord | null> {
    const records = await readStore();
    const normalizedDomain = domain.toLowerCase().trim();
    return records.find(
        r => r.clientCode === clientCode &&
            r.domain.toLowerCase() === normalizedDomain &&
            r.locationCode === locationCode
    ) || null;
}

/**
 * Check if we have recent data (within specified hours)
 */
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

/**
 * Save or update credibility records (upsert)
 * Uses clientCode + domain + locationCode as unique key
 */
export async function saveCredibilityRecords(
    newRecords: DomainCredibilityRecord[]
): Promise<{ saved: number; updated: number }> {
    const existing = await readStore();

    // Create a map for efficient lookup
    const recordMap = new Map<string, DomainCredibilityRecord>();

    // Add existing records to map
    for (const record of existing) {
        const key = createRecordKey(record.clientCode, record.domain, record.locationCode);
        recordMap.set(key, record);
    }

    let updated = 0;
    let saved = 0;

    // Upsert new records
    for (const record of newRecords) {
        const key = createRecordKey(record.clientCode, record.domain, record.locationCode);

        if (recordMap.has(key)) {
            // Update existing - keep the old record's ID but update data
            const oldRecord = recordMap.get(key)!;
            recordMap.set(key, {
                ...record,
                id: oldRecord.id, // Keep original ID
            });
            updated++;
        } else {
            recordMap.set(key, record);
            saved++;
        }
    }

    // Convert back to array and save
    const allRecords = Array.from(recordMap.values());
    await writeStore(allRecords);

    console.log(`[CredibilityStore] Saved: ${saved} new, Updated: ${updated} existing`);
    return { saved, updated };
}

/**
 * Replace all records for a client and location
 */
export async function replaceClientLocationCredibility(
    clientCode: string,
    locationCode: LocationCode,
    newRecords: DomainCredibilityRecord[]
): Promise<void> {
    const existing = await readStore();

    // Remove old records for this client+location
    const filtered = existing.filter(
        r => !(r.clientCode === clientCode && r.locationCode === locationCode)
    );

    // Add new records
    const updated = [...filtered, ...newRecords];
    await writeStore(updated);

    console.log(`[CredibilityStore] Replaced ${newRecords.length} records for ${clientCode}/${locationCode}`);
}

/**
 * Delete a single credibility record
 */
export async function deleteCredibilityRecord(
    clientCode: string,
    domain: string,
    locationCode: LocationCode
): Promise<boolean> {
    const records = await readStore();
    const normalizedDomain = domain.toLowerCase().trim();

    const filtered = records.filter(
        r => !(r.clientCode === clientCode &&
            r.domain.toLowerCase() === normalizedDomain &&
            r.locationCode === locationCode)
    );

    if (filtered.length === records.length) {
        return false; // Nothing deleted
    }

    await writeStore(filtered);
    console.log(`[CredibilityStore] Deleted record for ${domain}`);
    return true;
}

/**
 * Delete all records for a client
 */
export async function deleteClientCredibility(clientCode: string): Promise<number> {
    const records = await readStore();
    const filtered = records.filter(r => r.clientCode !== clientCode);
    const deletedCount = records.length - filtered.length;

    await writeStore(filtered);
    console.log(`[CredibilityStore] Deleted ${deletedCount} records for client ${clientCode}`);
    return deletedCount;
}

// ============================================================================
// PUBLIC API - Summary & Analytics
// ============================================================================

/**
 * Get summary statistics for a client
 */
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

    // Calculate averages (only from records with data)
    const agesWithData = records.filter(r => r.domainAgeYears !== null);
    const avgDomainAge = agesWithData.length > 0
        ? Math.round((agesWithData.reduce((sum, r) => sum + (r.domainAgeYears || 0), 0) / agesWithData.length) * 10) / 10
        : null;

    const rdWithData = records.filter(r => r.referringDomains !== null);
    const avgReferringDomains = rdWithData.length > 0
        ? Math.round(rdWithData.reduce((sum, r) => sum + (r.referringDomains || 0), 0) / rdWithData.length)
        : null;

    // Find oldest and newest fetch times
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

/**
 * Get the last fetch timestamp for a client
 */
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

// ============================================================================
// VERSION
// ============================================================================

export const CREDIBILITY_STORE_VERSION = '1.0.0';
console.log(`[CredibilityStore] Version: ${CREDIBILITY_STORE_VERSION}`);
