import { promises as fs } from 'fs';
import path from 'path';
import { getExportPage, getColumnsForPage, ExportColumnEntry } from './exportRegistryStore';

const DATA_DIR = path.join(process.cwd(), 'data');

export interface ExportData {
    headers: string[];
    rows: Record<string, any>[];
    metadata: {
        pageKey: string;
        pageName: string;
        route: string;
        description: string;
        rowDescription: string;
    };
    columns: ExportColumnEntry[];
}

// Generic JSON file reader
async function readJsonFile<T>(filename: string): Promise<T[]> {
    try {
        const filePath = path.join(DATA_DIR, filename);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as T[];
    } catch (error) {
        console.error(`Failed to read ${filename}:`, error);
        return [];
    }
}

// Helper to filter records by clientCode
function filterByClientCode<T extends Record<string, any>>(
    records: T[],
    clientCode: string,
    filterField: string
): T[] {
    return records.filter(r => {
        const value = r[filterField];
        // Handle both exact match and array contains
        if (Array.isArray(value)) {
            return value.includes(clientCode);
        }
        return value === clientCode;
    });
}

// Helper to extract specified columns from records
function extractColumns(
    records: Record<string, any>[],
    columns: ExportColumnEntry[]
): Record<string, any>[] {
    // Helper to get nested value using dot notation
    const getNestedValue = (obj: any, path: string): any => {
        const parts = path.split('.');
        let current = obj;
        for (const part of parts) {
            if (current == null) return undefined;
            current = current[part];
        }
        return current;
    };

    return records.map(record => {
        const row: Record<string, any> = {};
        for (const col of columns) {
            const value = getNestedValue(record, col.sourceField);
            // Handle arrays - join with comma
            if (Array.isArray(value)) {
                row[col.columnName] = value.join(', ');
            } else {
                row[col.columnName] = value;
            }
        }
        return row;
    });
}

// Type for adapter function
export type ExportAdapter = (clientCode: string) => Promise<ExportData>;

// Generic adapter factory for JSON file-based pages
function createJsonAdapter(pageKey: string): ExportAdapter {
    return async (clientCode: string): Promise<ExportData> => {
        const page = await getExportPage(pageKey);
        if (!page) {
            throw new Error(`Page not found in registry: ${pageKey}`);
        }

        const columns = await getColumnsForPage(pageKey);
        if (columns.length === 0) {
            throw new Error(`No columns registered for page: ${pageKey}`);
        }

        // Read data from JSON file
        const rawRecords = await readJsonFile<Record<string, any>>(page.dataSourceRef);
        console.log(`[ExportAdapter:${pageKey}] Raw records loaded: ${rawRecords.length}`);

        // Filter by clientCode
        const filteredRecords = filterByClientCode(rawRecords, clientCode, page.clientFilterField);
        console.log(`[ExportAdapter:${pageKey}] Filtered records for ${clientCode}: ${filteredRecords.length}`);

        // Debug: Log first record's keys and some values
        if (filteredRecords.length > 0) {
            const sample = filteredRecords[0];
            console.log(`[ExportAdapter:${pageKey}] Sample record keys:`, Object.keys(sample));
            console.log(`[ExportAdapter:${pageKey}] Sample values - domainAgeYears:${sample.domainAgeYears}, referringDomains:${sample.referringDomains}, organicTraffic:${sample.organicTraffic}`);
        }

        // Extract columns
        const rows = extractColumns(filteredRecords, columns);

        return {
            headers: columns.map(c => c.displayName),
            rows,
            metadata: {
                pageKey: page.pageKey,
                pageName: page.pageName,
                route: page.route,
                description: page.description,
                rowDescription: page.rowDescription,
            },
            columns,
        };
    };
}

// Special adapter for Client Master - it filters by code, not clientCode
function createClientMasterAdapter(): ExportAdapter {
    return async (clientCode: string): Promise<ExportData> => {
        const pageKey = 'client-master';
        const page = await getExportPage(pageKey);
        if (!page) {
            throw new Error(`Page not found in registry: ${pageKey}`);
        }

        const columns = await getColumnsForPage(pageKey);
        const rawRecords = await readJsonFile<Record<string, any>>('clients.json');

        // Filter to just the selected client
        const filteredRecords = rawRecords.filter(r => r.code === clientCode);
        const rows = extractColumns(filteredRecords, columns);

        return {
            headers: columns.map(c => c.displayName),
            rows,
            metadata: {
                pageKey: page.pageKey,
                pageName: page.pageName,
                route: page.route,
                description: page.description,
                rowDescription: page.rowDescription,
            },
            columns,
        };
    };
}

// Custom adapter for Domain Authority - flattens nested whoisJson structure
function createDomainAuthorityAdapter(): ExportAdapter {
    return async (clientCode: string): Promise<ExportData> => {
        const pageKey = 'domain-authority';
        const page = await getExportPage(pageKey);
        if (!page) {
            throw new Error(`Page not found in registry: ${pageKey}`);
        }

        const columns = await getColumnsForPage(pageKey);
        const rawRecords = await readJsonFile<Record<string, any>>(page.dataSourceRef);

        // Filter by clientCode
        const filteredRecords = rawRecords.filter(r => r.clientCode === clientCode);
        console.log(`[DomainAuthorityAdapter] Found ${filteredRecords.length} records for ${clientCode}`);

        // Flatten nested structure
        const flattenedRecords = filteredRecords.map(record => {
            const whois = record.whoisJson || {};
            const backlinksInfo = whois.backlinks_info || {};
            const metricsOrganic = whois.metrics?.organic || {};
            const metricsPaid = whois.metrics?.paid || {};

            // Calculate domain age from created_datetime
            let domainAgeYears: number | null = null;
            if (whois.created_datetime) {
                const createdDate = new Date(whois.created_datetime);
                const now = new Date();
                domainAgeYears = Math.round((now.getTime() - createdDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000) * 10) / 10;
            }

            // Calculate organic traffic from position counts
            const pos1 = metricsOrganic.pos_1 || 0;
            const pos2_3 = metricsOrganic.pos_2_3 || 0;
            const pos4_10 = metricsOrganic.pos_4_10 || 0;
            const pos11_20 = metricsOrganic.pos_11_20 || 0;
            const organicTraffic = pos1 + pos2_3 + pos4_10 + pos11_20;

            // Calculate keyword position counts
            const organicTop3 = pos1 + pos2_3;
            const organicTop10 = organicTop3 + pos4_10;
            const organicTop100 = Object.keys(metricsOrganic)
                .filter(k => k.startsWith('pos_'))
                .reduce((sum, k) => sum + (metricsOrganic[k] || 0), 0);

            return {
                id: record.id || `${clientCode}-${record.domain}`,
                clientCode: record.clientCode,
                domain: record.domain,
                domainType: record.type || 'competitor',
                domainAgeYears,
                referringDomains: backlinksInfo.referring_domains || null,
                totalBacklinks: backlinksInfo.backlinks || null,
                dofollowBacklinks: backlinksInfo.dofollow || null,
                nofollowBacklinks: backlinksInfo.backlinks && backlinksInfo.dofollow
                    ? backlinksInfo.backlinks - backlinksInfo.dofollow : null,
                organicTraffic: organicTraffic || null,
                organicCost: metricsOrganic.etv || null,
                organicKeywordsCount: metricsOrganic.count || null,
                paidKeywordsCount: metricsPaid.count || null,
                organicTop3: organicTop3 || null,
                organicTop10: organicTop10 || null,
                organicTop100: organicTop100 || null,
                keywordVisibilityScore: null, // Not available in raw data
                paidTraffic: metricsPaid.traffic || null,
                paidCost: metricsPaid.cost || null,
                fetchedAt: record.lastPulledAt || null,
            };
        });

        console.log(`[DomainAuthorityAdapter] Flattened ${flattenedRecords.length} records`);
        if (flattenedRecords.length > 0) {
            const sample = flattenedRecords[0];
            console.log(`[DomainAuthorityAdapter] Sample - domain:${sample.domain}, age:${sample.domainAgeYears}, rd:${sample.referringDomains}, traffic:${sample.organicTraffic}`);
        }

        // Extract columns
        const rows = extractColumns(flattenedRecords, columns);

        return {
            headers: columns.map(c => c.displayName),
            rows,
            metadata: {
                pageKey: page.pageKey,
                pageName: page.pageName,
                route: page.route,
                description: page.description,
                rowDescription: page.rowDescription,
            },
            columns,
        };
    };
}

/**
 * Custom adapter for Page Intent Analysis
 * Enriches records with human-readable intent labels and funnel stages
 */
function createPageIntentAnalysisAdapter(): ExportAdapter {
    // Intent bucket to label mapping
    const intentLabels: Record<string, string> = {
        'problem_aware_solution_tofu': 'Problem-Aware / Solution',
        'educational_informational_tofu': 'Educational / Informational',
        'commercial_investigation_mofu': 'Commercial Investigation',
        'trust_proof_mofu': 'Trust & Proof',
        'brand_navigation_bofu': 'Brand / Navigation',
        'transactional_bofu': 'Transactional',
    };

    // Intent bucket to funnel stage mapping
    const funnelStages: Record<string, string> = {
        'problem_aware_solution_tofu': 'TOFU',
        'educational_informational_tofu': 'TOFU',
        'commercial_investigation_mofu': 'MOFU',
        'trust_proof_mofu': 'MOFU',
        'brand_navigation_bofu': 'BOFU',
        'transactional_bofu': 'BOFU',
    };

    return async (clientCode: string): Promise<ExportData> => {
        const pageKey = 'page-intent-analysis';
        const page = await getExportPage(pageKey);
        if (!page) {
            throw new Error(`Page not found in registry: ${pageKey}`);
        }

        const columns = await getColumnsForPage(pageKey);
        const rawRecords = await readJsonFile<Record<string, any>>(page.dataSourceRef);

        // Filter by clientCode
        const filteredRecords = rawRecords.filter(r => r.clientCode === clientCode);
        console.log(`[PageIntentAnalysisAdapter] Found ${filteredRecords.length} records for ${clientCode}`);

        // Enrich with labels and funnel stages
        const enrichedRecords = filteredRecords.map(record => ({
            ...record,
            intentLabel: intentLabels[record.intent] || record.intent,
            funnelStage: funnelStages[record.intent] || 'Unknown',
        }));

        // Extract columns
        const rows = extractColumns(enrichedRecords, columns);

        return {
            headers: columns.map(c => c.displayName),
            rows,
            metadata: {
                pageKey: page.pageKey,
                pageName: page.pageName,
                route: page.route,
                description: page.description,
                rowDescription: page.rowDescription,
            },
            columns,
        };
    };
}

// Registry of all adapters
export const exportAdapters: Record<string, ExportAdapter> = {
    'client-master': createClientMasterAdapter(),
    'client-ai-profile': createJsonAdapter('client-ai-profile'),
    'competitors': createJsonAdapter('competitors'),
    'domain-keywords': createJsonAdapter('domain-keywords'),
    'domain-pages': createJsonAdapter('domain-pages'),
    'domain-overview': createJsonAdapter('domain-overview'),
    'serp-results': createJsonAdapter('serp-results'),
    'keyword-api-data': createJsonAdapter('keyword-api-data'),
    'manual-keywords': createJsonAdapter('manual-keywords'),
    'client-position': createJsonAdapter('client-position'),
    'client-rank': createJsonAdapter('client-rank'),
    'curated-keywords': createJsonAdapter('curated-keywords'),
    'domain-profiles': createJsonAdapter('domain-profiles'),
    'domain-authority': createDomainAuthorityAdapter(),
    'page-intent-analysis': createPageIntentAnalysisAdapter(),
};

/**
 * Get export data for a specific page and client
 */
export async function getExportDataForPage(
    pageKey: string,
    clientCode: string
): Promise<ExportData> {
    const adapter = exportAdapters[pageKey];
    if (!adapter) {
        throw new Error(`No adapter found for page: ${pageKey}`);
    }
    return adapter(clientCode);
}

/**
 * Get export data for multiple pages
 */
export async function getExportDataForPages(
    pageKeys: string[],
    clientCode: string
): Promise<ExportData[]> {
    const results: ExportData[] = [];

    for (const pageKey of pageKeys) {
        try {
            const data = await getExportDataForPage(pageKey, clientCode);
            results.push(data);
        } catch (error) {
            console.error(`Failed to get export data for ${pageKey}:`, error);
            // Continue with other pages
        }
    }

    return results;
}
