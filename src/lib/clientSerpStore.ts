import { promises as fs } from 'fs';
import path from 'path';
import { SerpResultItem } from './serpResultsDatabase';

const DATA_DIR = path.join(process.cwd(), 'data', 'serp_results');

// Simple file lock to prevent race conditions during concurrent writes
let fileLockPromise = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
    const result = fileLockPromise.then(() => fn());
    // Update the lock to wait for this operation to complete (success or fail)
    fileLockPromise = result.then(() => { }).catch(() => { });
    return result;
}

export interface KeywordSerpEntry {
    keyword: string;
    source: string;
    importedAt: string;
    serp: {
        IN?: {
            lastFetched: string;
            jobId?: string;
            results: SerpResultItem[];
            matchedDomainRank?: number | null;
            matchedUrl?: string | null;
        };
        GL?: {
            lastFetched: string;
            jobId?: string;
            results: SerpResultItem[];
            matchedDomainRank?: number | null;
            matchedUrl?: string | null;
        };
    };
}

export interface ClientSerpData {
    keywords: KeywordSerpEntry[];
}

/**
 * Get the file path for a client's SERP data
 */
function getClientSerpFilePath(clientCode: string): string {
    return path.join(DATA_DIR, `${clientCode}.json`);
}

/**
 * Read client SERP data from JSON file
 */
export async function readClientSerpData(clientCode: string): Promise<ClientSerpData> {
    try {
        const filePath = getClientSerpFilePath(clientCode);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as ClientSerpData;
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            // File doesn't exist, return empty structure
            return { keywords: [] };
        }
        console.error(`Error reading client SERP data for ${clientCode}:`, error);
        return { keywords: [] };
    }
}

/**
 * Write client SERP data to JSON file
 */
export async function writeClientSerpData(clientCode: string, data: ClientSerpData): Promise<void> {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const filePath = getClientSerpFilePath(clientCode);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error(`Error writing client SERP data for ${clientCode}:`, error);
        throw error;
    }
}

/**
 * Add keywords with source to client SERP data
 * Deduplicates by keyword (case-insensitive)
 */
export async function addKeywords(
    clientCode: string,
    keywords: string[],
    source: string
): Promise<number> {
    return withLock(async () => {
        const data = await readClientSerpData(clientCode);
        const existingKeywords = new Set(
            data.keywords.map(k => k.keyword.toLowerCase())
        );

        const importedAt = new Date().toISOString();
        let addedCount = 0;

        for (const keyword of keywords) {
            const trimmed = keyword.trim();
            if (!trimmed) continue;

            const lowerKeyword = trimmed.toLowerCase();
            if (existingKeywords.has(lowerKeyword)) {
                // Keyword already exists, skip
                continue;
            }

            data.keywords.push({
                keyword: trimmed,
                source,
                importedAt,
                serp: {}
            });

            existingKeywords.add(lowerKeyword);
            addedCount++;
        }

        if (addedCount > 0) {
            await writeClientSerpData(clientCode, data);
        }

        return addedCount;
    });
}

// ... (existing code)

export interface UpdateSerpResultPayload {
    keyword: string;
    location: 'IN' | 'GL';
    results: SerpResultItem[];
    selectedDomain: string;
    jobId: string;
}

/**
 * Update SERP results for multiple keywords in batch
 */
export async function updateSerpResultsBatch(
    clientCode: string,
    updates: UpdateSerpResultPayload[]
): Promise<void> {
    return withLock(async () => {
        const data = await readClientSerpData(clientCode);
        const importedAt = new Date().toISOString();
        let hasChanges = false;

        for (const update of updates) {
            const { keyword, location, results, selectedDomain, jobId } = update;

            // Find or create keyword entry
            let keywordEntry = data.keywords.find(k => k.keyword.toLowerCase() === keyword.toLowerCase());
            if (!keywordEntry) {
                keywordEntry = {
                    keyword,
                    source: 'Unknown',
                    importedAt,
                    serp: {}
                };
                data.keywords.push(keywordEntry);
            }

            // Calculate match
            let matchedDomainRank: number | null = null;
            let matchedUrl: string | null = null;

            if (selectedDomain) {
                const normSelected = selectedDomain.toLowerCase().replace(/^(www\.)?/, '');
                for (const item of results) {
                    const normDomain = (item.domain || '').toLowerCase().replace(/^(www\.)?/, '');
                    if (normDomain.includes(normSelected)) {
                        matchedDomainRank = item.rank_group;
                        matchedUrl = item.url;
                        break;
                    }
                }
            }

            // Update SERP results
            keywordEntry.serp[location] = {
                lastFetched: new Date().toISOString(),
                jobId,
                results: results.map(item => ({
                    rank_group: item.rank_group,
                    rank_absolute: item.rank_absolute,
                    domain: item.domain,
                    url: item.url,
                    title: item.title || '',
                    description: item.description || '',
                    breadcrumb: item.breadcrumb || null,
                    type: item.type || 'organic'
                })),
                matchedDomainRank,
                matchedUrl
            };
            hasChanges = true;
        }

        if (hasChanges) {
            await writeClientSerpData(clientCode, data);
        }
    });
}

// Keep single update for backward compatibility or small updates
export async function updateSerpResults(
    clientCode: string,
    keyword: string,
    location: 'IN' | 'GL',
    results: SerpResultItem[],
    selectedDomain: string,
    jobId: string
): Promise<void> {
    // Re-use batch logic
    return updateSerpResultsBatch(clientCode, [{
        keyword,
        location,
        results,
        selectedDomain,
        jobId
    }]);
}

/**
 * Get all keywords for a client
 */
export async function getClientKeywords(clientCode: string): Promise<KeywordSerpEntry[]> {
    const data = await readClientSerpData(clientCode);
    return data.keywords;
}

/**
 * Get SERP results for a specific keyword and location
 */
export async function getKeywordSerpResults(
    clientCode: string,
    keyword: string,
    location: 'IN' | 'GL'
): Promise<SerpResultItem[] | null> {
    const data = await readClientSerpData(clientCode);
    const keywordEntry = data.keywords.find(k => k.keyword.toLowerCase() === keyword.toLowerCase());
    return keywordEntry?.serp[location]?.results || null;
}
