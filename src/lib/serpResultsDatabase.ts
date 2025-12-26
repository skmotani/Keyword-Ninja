import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SERP_DATABASE_FILE = 'serp_results_database.json';

export interface SerpResultItem {
    rank_group: number;
    rank_absolute: number;
    domain: string;
    url: string;
    title: string;
    description: string;
    breadcrumb?: string | null;
    type: string;
    // Add other fields from DataForSEO as needed
}

export interface KeywordSerpData {
    lastFetched: string;  // ISO timestamp
    selectedDomain: string;
    results: SerpResultItem[];  // All 50 results
}

interface SerpResultDatabase {
    [clientCode: string]: {
        [keyword: string]: {
            [locationType: 'IN' | 'GL']: KeywordSerpData;
        };
    };
}

async function readDatabase(): Promise<SerpResultDatabase> {
    try {
        const filePath = path.join(DATA_DIR, SERP_DATABASE_FILE);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as SerpResultDatabase;
    } catch {
        // File doesn't exist yet, return empty structure
        return {};
    }
}

async function writeDatabase(db: SerpResultDatabase): Promise<void> {
    const filePath = path.join(DATA_DIR, SERP_DATABASE_FILE);
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(db, null, 2), 'utf-8');
}

/**
 * Save all SERP results for a keyword to the database
 */
export async function saveSerpResults(
    clientCode: string,
    keyword: string,
    locationType: 'IN' | 'GL',
    results: SerpResultItem[],
    selectedDomain: string
): Promise<void> {
    const db = await readDatabase();
    
    // Initialize structure if needed
    if (!db[clientCode]) {
        db[clientCode] = {};
    }
    if (!db[clientCode][keyword]) {
        db[clientCode][keyword] = {};
    }
    
    // Save the results
    db[clientCode][keyword][locationType] = {
        lastFetched: new Date().toISOString(),
        selectedDomain,
        results: results.map(item => ({
            rank_group: item.rank_group,
            rank_absolute: item.rank_absolute,
            domain: item.domain,
            url: item.url,
            title: item.title || '',
            description: item.description || '',
            breadcrumb: item.breadcrumb || null,
            type: item.type || 'organic'
        }))
    };
    
    await writeDatabase(db);
}

/**
 * Get SERP results for a specific keyword
 */
export async function getSerpResults(
    clientCode: string,
    keyword: string,
    locationType: 'IN' | 'GL'
): Promise<KeywordSerpData | null> {
    const db = await readDatabase();
    return db[clientCode]?.[keyword]?.[locationType] || null;
}

/**
 * Get all SERP results for a client
 */
export async function getAllResultsForClient(
    clientCode: string
): Promise<Record<string, Record<'IN' | 'GL', KeywordSerpData | undefined>>> {
    const db = await readDatabase();
    return db[clientCode] || {};
}

/**
 * Get all results for a keyword across all locations
 */
export async function getSerpResultsForKeyword(
    clientCode: string,
    keyword: string
): Promise<{ IN?: KeywordSerpData; GL?: KeywordSerpData }> {
    const db = await readDatabase();
    const keywordData = db[clientCode]?.[keyword];
    return {
        IN: keywordData?.IN,
        GL: keywordData?.GL
    };
}

