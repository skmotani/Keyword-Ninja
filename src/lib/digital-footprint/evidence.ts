// Evidence Collector - Uses DataForSEO to collect presence evidence

import { SURFACES, SurfaceDefinition, SurfaceStatus } from './surfaces';
import { BusinessProfile } from './profiler';
import { CrawlData } from './crawler';

export interface EvidenceItem {
    title: string;
    url: string;
    snippet?: string;
    isOfficial: boolean;  // Likely official brand presence
}

export interface SurfaceEvidence {
    surfaceKey: string;
    status: SurfaceStatus;
    confidence: number;
    evidence: EvidenceItem[];
    queriesUsed: string[];
    error?: string;
}

interface DataForSEOResult {
    title: string;
    url: string;
    description?: string;
}

// Build queries for a surface based on business profile
export function buildQueriesForSurface(
    surface: SurfaceDefinition,
    profile: BusinessProfile,
    domain: string
): string[] {
    const queries: string[] = [];
    const brand = profile.brandName;

    for (const template of surface.queryTemplates) {
        let query = template
            .replace('{brand}', brand)
            .replace('{domain}', domain)
            .replace('{industry}', profile.industry || '')
            .replace('{city}', ''); // Would need from profile

        // Replace brand variants for some queries
        if (template.includes('{brand}') && profile.brandVariants.length > 0) {
            // Add a variant query too
            const variant = profile.brandVariants[0];
            if (variant !== brand) {
                const variantQuery = template
                    .replace('{brand}', variant)
                    .replace('{domain}', domain);
                queries.push(variantQuery);
            }
        }

        if (query.trim()) {
            queries.push(query);
        }
    }

    // Limit to 3 queries per surface
    return queries.slice(0, 3);
}

// Collect evidence for a single surface using DataForSEO
export async function collectEvidenceForSurface(
    surface: SurfaceDefinition,
    profile: BusinessProfile,
    domain: string,
    crawlData?: CrawlData
): Promise<SurfaceEvidence> {
    // Handle owned surfaces differently (direct checks)
    if (surface.key === 'WEBSITE') {
        return checkWebsitePresence(domain, crawlData);
    }

    if (surface.key === 'SCHEMA') {
        return checkSchemaPresence(crawlData);
    }

    // For other surfaces, use search queries
    const queries = buildQueriesForSurface(surface, profile, domain);

    if (queries.length === 0) {
        return {
            surfaceKey: surface.key,
            status: 'unknown',
            confidence: 0,
            evidence: [],
            queriesUsed: [],
            error: 'No query templates for this surface',
        };
    }

    try {
        // Call DataForSEO (or fallback to simulated results)
        const results = await executeSearchQueries(queries);

        // Classify results
        const evidence = classifyEvidence(results, profile, domain);
        const status = determineStatus(evidence, profile.brandName);

        return {
            surfaceKey: surface.key,
            status,
            confidence: calculateConfidence(evidence, status),
            evidence: evidence.slice(0, 5),  // Top 5 evidence items
            queriesUsed: queries,
        };
    } catch (error) {
        return {
            surfaceKey: surface.key,
            status: 'unknown',
            confidence: 0,
            evidence: [],
            queriesUsed: queries,
            error: error instanceof Error ? error.message : 'Search failed',
        };
    }
}

// Check website presence from crawl data
function checkWebsitePresence(domain: string, crawlData?: CrawlData): SurfaceEvidence {
    if (!crawlData) {
        return {
            surfaceKey: 'WEBSITE',
            status: 'absent',
            confidence: 0.5,
            evidence: [],
            queriesUsed: [],
            error: 'Could not crawl website',
        };
    }

    const evidence: EvidenceItem[] = [{
        title: crawlData.title || domain,
        url: `https://${domain}`,
        snippet: crawlData.metaDescription,
        isOfficial: true,
    }];

    return {
        surfaceKey: 'WEBSITE',
        status: crawlData.hasSSL ? 'present' : 'partial',
        confidence: crawlData.hasSSL ? 0.95 : 0.7,
        evidence,
        queriesUsed: [],
    };
}

// Check schema presence from crawl data
function checkSchemaPresence(crawlData?: CrawlData): SurfaceEvidence {
    if (!crawlData?.schemaBlocks?.length) {
        return {
            surfaceKey: 'SCHEMA',
            status: 'absent',
            confidence: 0.8,
            evidence: [],
            queriesUsed: [],
        };
    }

    const schemas = crawlData.schemaBlocks;
    const hasOrganization = schemas.some(s =>
        s.type === 'Organization' || s.type === 'LocalBusiness' || s.type === 'Corporation'
    );

    const evidence: EvidenceItem[] = schemas.map(s => ({
        title: `Schema: ${s.type}`,
        url: '',
        snippet: JSON.stringify(s.raw).slice(0, 200),
        isOfficial: true,
    }));

    return {
        surfaceKey: 'SCHEMA',
        status: hasOrganization ? 'present' : 'partial',
        confidence: hasOrganization ? 0.9 : 0.6,
        evidence,
        queriesUsed: [],
    };
}

// Execute search queries (mock for now - replace with DataForSEO)
async function executeSearchQueries(queries: string[]): Promise<DataForSEOResult[]> {
    // TODO: Replace with actual DataForSEO API call
    // For now, return empty to indicate "could not verify"

    const apiKey = process.env.DATAFORSEO_LOGIN;
    const apiPassword = process.env.DATAFORSEO_PASSWORD;

    if (!apiKey || !apiPassword) {
        // Return empty results if no API configured
        return [];
    }

    // Actual DataForSEO implementation would go here
    // Using their SERP API endpoint
    const results: DataForSEOResult[] = [];

    for (const query of queries) {
        try {
            const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${apiKey}:${apiPassword}`).toString('base64'),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify([{
                    keyword: query,
                    location_code: 2840, // USA
                    language_code: 'en',
                    depth: 10,
                }]),
            });

            if (response.ok) {
                const data = await response.json();
                const items = data.tasks?.[0]?.result?.[0]?.items || [];

                for (const item of items) {
                    if (item.type === 'organic') {
                        results.push({
                            title: item.title || '',
                            url: item.url || '',
                            description: item.description,
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`Search query failed: ${query}`, error);
        }
    }

    return results;
}

// Classify search results as evidence
function classifyEvidence(
    results: DataForSEOResult[],
    profile: BusinessProfile,
    domain: string
): EvidenceItem[] {
    const brandLower = profile.brandName.toLowerCase();
    const domainLower = domain.toLowerCase();
    const variantsLower = profile.brandVariants.map(v => v.toLowerCase());

    return results.map(r => {
        const titleLower = r.title.toLowerCase();
        const urlLower = r.url.toLowerCase();

        // Check if this is likely an official presence
        const containsBrand = titleLower.includes(brandLower) ||
            variantsLower.some(v => titleLower.includes(v));
        const containsDomain = urlLower.includes(domainLower.split('.')[0]);
        const isOfficial = containsBrand || containsDomain;

        return {
            title: r.title,
            url: r.url,
            snippet: r.description,
            isOfficial,
        };
    });
}

// Determine presence status from evidence
function determineStatus(evidence: EvidenceItem[], brandName: string): SurfaceStatus {
    if (evidence.length === 0) {
        return 'absent';
    }

    const officialCount = evidence.filter(e => e.isOfficial).length;

    if (officialCount >= 2) {
        return 'present';
    }

    if (officialCount === 1 || evidence.length >= 2) {
        return 'partial';
    }

    return 'absent';
}

// Calculate confidence score
function calculateConfidence(evidence: EvidenceItem[], status: SurfaceStatus): number {
    if (status === 'absent') return 0.7;  // Pretty sure it's not there
    if (status === 'unknown') return 0;

    const officialCount = evidence.filter(e => e.isOfficial).length;
    const totalCount = evidence.length;

    if (officialCount >= 3) return 0.95;
    if (officialCount >= 2) return 0.85;
    if (officialCount === 1) return 0.6;
    if (totalCount >= 2) return 0.5;

    return 0.3;
}

// Collect evidence for all surfaces
export async function collectAllEvidence(
    profile: BusinessProfile,
    domain: string,
    crawlData?: CrawlData
): Promise<SurfaceEvidence[]> {
    const surfaces = Object.values(SURFACES);
    const results: SurfaceEvidence[] = [];

    // Process in batches to avoid rate limits
    const batchSize = 3;
    for (let i = 0; i < surfaces.length; i += batchSize) {
        const batch = surfaces.slice(i, i + batchSize);
        const batchResults = await Promise.all(
            batch.map(surface => collectEvidenceForSurface(surface, profile, domain, crawlData))
        );
        results.push(...batchResults);
    }

    return results;
}
