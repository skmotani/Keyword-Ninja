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
    source: 'direct' | 'dataforseo' | 'openai' | 'crawl';
    method: string;
    error?: string;
}

interface DataForSEOResult {
    title: string;
    url: string;
    description?: string;
}

// Get DataForSEO credentials from existing helper
async function getCredentials(): Promise<{ login: string; password: string } | null> {
    try {
        // Use existing credentials helper that reads from data/api_credentials.json
        const { getDataForSEOCredentials } = await import('@/lib/dataforseo/core/credentials');
        const creds = await getDataForSEOCredentials();

        if (creds) {
            return {
                login: creds.username,
                password: creds.password,
            };
        }
    } catch (error) {
        console.error('[Evidence] Failed to get DataForSEO credentials:', error);
    }
    return null;
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
            .replace(/\{brand\}/g, brand)
            .replace(/\{domain\}/g, domain)
            .replace(/\{industry\}/g, profile.industry || '');

        if (query.trim()) {
            queries.push(query);
        }
    }

    // Limit to 2 queries per surface
    return queries.slice(0, 2);
}

// Execute search queries using DataForSEO
async function executeSearchQueries(queries: string[]): Promise<{ results: DataForSEOResult[]; success: boolean }> {
    const creds = await getCredentials();

    if (!creds) {
        console.log('[Evidence] No DataForSEO credentials found');
        return { results: [], success: false };
    }

    const results: DataForSEOResult[] = [];

    for (const query of queries) {
        try {
            console.log(`[Evidence] Searching: ${query}`);

            const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${creds.login}:${creds.password}`).toString('base64'),
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
            } else {
                console.error(`[Evidence] DataForSEO error: ${response.status}`);
            }
        } catch (error) {
            console.error(`[Evidence] Search query failed: ${query}`, error);
        }
    }

    return { results, success: true };
}

// Collect evidence for a single surface
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
            source: 'dataforseo',
            method: 'No queries configured',
            error: 'No query templates for this surface',
        };
    }

    try {
        const { results, success } = await executeSearchQueries(queries);

        if (!success) {
            return {
                surfaceKey: surface.key,
                status: 'unknown',
                confidence: 0,
                evidence: [],
                queriesUsed: queries,
                source: 'dataforseo',
                method: 'SERP API (credentials missing)',
                error: 'DataForSEO credentials not configured',
            };
        }

        // Classify results
        const evidence = classifyEvidence(results, profile, domain);
        const status = determineStatus(evidence, surface);

        return {
            surfaceKey: surface.key,
            status,
            confidence: calculateConfidence(evidence, status),
            evidence: evidence.slice(0, 5),
            queriesUsed: queries,
            source: 'dataforseo',
            method: `SERP API (${queries.length} queries)`,
        };
    } catch (error) {
        return {
            surfaceKey: surface.key,
            status: 'unknown',
            confidence: 0,
            evidence: [],
            queriesUsed: queries,
            source: 'dataforseo',
            method: 'SERP API (error)',
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
            source: 'direct',
            method: 'HTTP fetch (failed)',
            error: 'Could not crawl website',
        };
    }

    const evidence: EvidenceItem[] = [{
        title: crawlData.title || domain,
        url: `https://${domain}`,
        snippet: crawlData.metaDescription,
        isOfficial: true,
    }];

    const hasSSL = crawlData.hasSSL;

    return {
        surfaceKey: 'WEBSITE',
        status: hasSSL ? 'present' : 'partial',
        confidence: hasSSL ? 0.95 : 0.7,
        evidence,
        queriesUsed: [],
        source: 'direct',
        method: hasSSL ? 'HTTP fetch (SSL verified)' : 'HTTP fetch (no SSL)',
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
            source: 'crawl',
            method: 'HTML parsing (no schema found)',
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
        source: 'crawl',
        method: `HTML parsing (${schemas.length} schema blocks)`,
    };
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
function determineStatus(evidence: EvidenceItem[], surface: SurfaceDefinition): SurfaceStatus {
    if (evidence.length === 0) {
        return 'absent';
    }

    const officialCount = evidence.filter(e => e.isOfficial).length;

    // Check if any result is on the expected platform
    const platformPatterns: Record<string, string[]> = {
        LINKEDIN: ['linkedin.com'],
        YOUTUBE: ['youtube.com', 'youtu.be'],
        FACEBOOK: ['facebook.com', 'fb.com'],
        INSTAGRAM: ['instagram.com'],
        X_TWITTER: ['twitter.com', 'x.com'],
        PINTEREST: ['pinterest.com'],
        REDDIT: ['reddit.com'],
        TRUSTPILOT: ['trustpilot.com'],
    };

    const patterns = platformPatterns[surface.key] || [];
    const hasPlatformMatch = evidence.some(e =>
        patterns.some(p => e.url.toLowerCase().includes(p))
    );

    if (hasPlatformMatch && officialCount >= 1) {
        return 'present';
    }

    if (officialCount >= 2 || hasPlatformMatch) {
        return 'present';
    }

    if (officialCount === 1 || evidence.length >= 2) {
        return 'partial';
    }

    return 'absent';
}

// Calculate confidence score
function calculateConfidence(evidence: EvidenceItem[], status: SurfaceStatus): number {
    if (status === 'absent') return 0.7;
    if (status === 'unknown') return 0;

    const officialCount = evidence.filter(e => e.isOfficial).length;

    if (officialCount >= 3) return 0.95;
    if (officialCount >= 2) return 0.85;
    if (officialCount === 1) return 0.6;
    if (evidence.length >= 2) return 0.5;

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

        // Small delay between batches
        if (i + batchSize < surfaces.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    return results;
}
