import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';

const USE_POSTGRES = process.env.USE_POSTGRES_SERP_RESULTS === 'true';
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
}

export interface KeywordSerpData {
    lastFetched: string;
    selectedDomain: string;
    results: SerpResultItem[];
}

interface SerpResultDatabase {
    [clientCode: string]: {
        [keyword: string]: {
            IN?: KeywordSerpData;
            GL?: KeywordSerpData;
        };
    };
}

async function readDatabase(): Promise<SerpResultDatabase> {
    try {
        const filePath = path.join(DATA_DIR, SERP_DATABASE_FILE);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as SerpResultDatabase;
    } catch {
        return {};
    }
}

async function writeDatabase(db: SerpResultDatabase): Promise<void> {
    if (USE_POSTGRES) return;
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
    if (USE_POSTGRES) {
        const locationCode = locationType === 'IN' ? 2356 : 2840;
        const normalizedKeyword = keyword.toLowerCase().trim();

        // Delete existing results for this keyword/location
        await (prisma.serpResult as any).deleteMany({
            where: { clientCode, keyword: normalizedKeyword, locationCode }
        });

        // Insert new results
        for (const item of results) {
            await (prisma.serpResult as any).create({
                data: {
                    clientCode,
                    keyword: normalizedKeyword,
                    locationCode,
                    rank: item.rank_group,
                    domain: item.domain,
                    url: item.url,
                    title: item.title || '',
                    description: item.description || '',
                    serpData: {
                        rank_absolute: item.rank_absolute,
                        breadcrumb: item.breadcrumb,
                        type: item.type,
                        selectedDomain,
                    },
                    fetchedAt: new Date().toISOString(),
                }
            });
        }
        return;
    }

    const db = await readDatabase();

    if (!db[clientCode]) {
        db[clientCode] = {};
    }
    if (!db[clientCode][keyword]) {
        db[clientCode][keyword] = {};
    }

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
    if (USE_POSTGRES) {
        const locationCode = locationType === 'IN' ? 2356 : 2840;
        const normalizedKeyword = keyword.toLowerCase().trim();

        const records = await (prisma.serpResult as any).findMany({
            where: { clientCode, keyword: normalizedKeyword, locationCode },
            orderBy: { rank: 'asc' }
        });

        if (records.length === 0) return null;

        const selectedDomain = (records[0].serpData as any)?.selectedDomain || '';

        return {
            lastFetched: records[0].fetchedAt,
            selectedDomain,
            results: records.map((r: any) => ({
                rank_group: r.rank,
                rank_absolute: (r.serpData as any)?.rank_absolute ?? r.rank,
                domain: r.domain,
                url: r.url,
                title: r.title || '',
                description: r.description || '',
                breadcrumb: (r.serpData as any)?.breadcrumb ?? null,
                type: (r.serpData as any)?.type || 'organic',
            }))
        };
    }
    const db = await readDatabase();
    return db[clientCode]?.[keyword]?.[locationType] || null;
}

/**
 * Get all SERP results for a client
 */
export async function getAllResultsForClient(
    clientCode: string
): Promise<Record<string, { IN?: KeywordSerpData; GL?: KeywordSerpData }>> {
    if (USE_POSTGRES) {
        const records = await (prisma.serpResult as any).findMany({
            where: { clientCode },
            orderBy: [{ keyword: 'asc' }, { rank: 'asc' }]
        });

        const result: Record<string, { IN?: KeywordSerpData; GL?: KeywordSerpData }> = {};

        for (const r of records) {
            const keyword = r.keyword;
            const locationType = r.locationCode === 2356 ? 'IN' : 'GL';

            if (!result[keyword]) {
                result[keyword] = {};
            }

            if (!result[keyword][locationType]) {
                result[keyword][locationType] = {
                    lastFetched: r.fetchedAt,
                    selectedDomain: (r.serpData as any)?.selectedDomain || '',
                    results: []
                };
            }

            result[keyword][locationType]!.results.push({
                rank_group: r.rank,
                rank_absolute: (r.serpData as any)?.rank_absolute ?? r.rank,
                domain: r.domain,
                url: r.url,
                title: r.title || '',
                description: r.description || '',
                breadcrumb: (r.serpData as any)?.breadcrumb ?? null,
                type: (r.serpData as any)?.type || 'organic',
            });
        }

        return result;
    }
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
    if (USE_POSTGRES) {
        const [inData, glData] = await Promise.all([
            getSerpResults(clientCode, keyword, 'IN'),
            getSerpResults(clientCode, keyword, 'GL')
        ]);
        return { IN: inData || undefined, GL: glData || undefined };
    }
    const db = await readDatabase();
    const keywordData = db[clientCode]?.[keyword];
    return {
        IN: keywordData?.IN,
        GL: keywordData?.GL
    };
}

