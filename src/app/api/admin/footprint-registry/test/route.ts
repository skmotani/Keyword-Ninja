// Footprint Registry - Test Query Tool

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface TestRequest {
    surfaceId: string;
    domain: string;
    brand: string;
    city?: string;
    country?: string;
    industry?: string;
    variants?: string[];
}

// Substitute tokens in query template
function substituteTokens(template: string, params: TestRequest): string {
    let query = template;
    query = query.replace(/\{brand\}/g, params.brand);
    query = query.replace(/\{domain\}/g, params.domain);
    query = query.replace(/\{city\}/g, params.city || '');
    query = query.replace(/\{country\}/g, params.country || '');
    query = query.replace(/\{industry\}/g, params.industry || '');

    // Handle variant tokens
    if (params.variants) {
        for (let i = 0; i < 5; i++) {
            query = query.replace(new RegExp(`\\{variant${i + 1}\\}`, 'g'), params.variants[i] || '');
        }
    }

    // Clean up extra spaces
    return query.replace(/\s+/g, ' ').trim();
}

// Execute DataForSEO SERP search
async function executeDataForSEOSerp(query: string, engine: string): Promise<{ results: unknown[]; success: boolean; error?: string }> {
    try {
        const { getDataForSEOCredentials } = await import('@/lib/dataforseo/core/credentials');
        const creds = await getDataForSEOCredentials();

        const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${creds.username}:${creds.password}`).toString('base64'),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([{
                keyword: query,
                location_code: 2840, // USA
                language_code: 'en',
                se_domain: engine === 'bing' ? 'bing.com' : 'google.com',
                depth: 10,
            }]),
        });

        if (!response.ok) {
            return { results: [], success: false, error: `HTTP ${response.status}` };
        }

        const data = await response.json();
        const items = data.tasks?.[0]?.result?.[0]?.items || [];

        const results = items
            .filter((item: { type: string }) => item.type === 'organic')
            .slice(0, 5)
            .map((item: { url: string; title: string; description: string; rank_absolute: number }) => ({
                url: item.url,
                title: item.title,
                snippet: item.description,
                position: item.rank_absolute,
            }));

        return { results, success: true };
    } catch (error) {
        return {
            results: [],
            success: false,
            error: error instanceof Error ? error.message : 'DataForSEO call failed'
        };
    }
}

// Execute website crawl check
async function executeWebsiteCrawl(domain: string): Promise<{ results: unknown[]; success: boolean; error?: string }> {
    try {
        const url = `https://${domain}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers: { 'User-Agent': 'MotaniBot/1.0' },
        });
        clearTimeout(timeout);

        const html = await response.text();
        const hasSSL = url.startsWith('https');

        // Extract title
        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : '';

        // Check for schema
        const hasSchema = html.includes('application/ld+json') || html.includes('itemtype=');

        return {
            results: [{
                url,
                httpStatus: response.status,
                hasSSL,
                title,
                hasSchema,
            }],
            success: true,
        };
    } catch (error) {
        return {
            results: [],
            success: false,
            error: error instanceof Error ? error.message : 'Crawl failed',
        };
    }
}

// Evaluate presence status based on results and rules
function evaluatePresence(
    results: unknown[],
    presenceRules: Record<string, string> | null,
    domain: string,
    brand: string
): { status: string; officialness: boolean; confidence: number } {
    if (results.length === 0) {
        return { status: 'absent', officialness: false, confidence: 0.7 };
    }

    const brandLower = brand.toLowerCase();
    const domainLower = domain.toLowerCase().split('.')[0];

    // Check for official results
    let officialCount = 0;
    for (const result of results) {
        const r = result as { url?: string; title?: string };
        const urlLower = (r.url || '').toLowerCase();
        const titleLower = (r.title || '').toLowerCase();

        if (urlLower.includes(domainLower) || titleLower.includes(brandLower)) {
            officialCount++;
        }
    }

    const officialness = officialCount > 0;

    if (officialCount >= 2) {
        return { status: 'present', officialness: true, confidence: 0.95 };
    }
    if (officialCount === 1) {
        return { status: 'present', officialness: true, confidence: 0.8 };
    }
    if (results.length >= 2) {
        return { status: 'partial', officialness: false, confidence: 0.6 };
    }

    return { status: 'partial', officialness: false, confidence: 0.5 };
}

// POST - Run test query for a surface
export async function POST(request: NextRequest) {
    try {
        const body: TestRequest = await request.json();

        if (!body.surfaceId || !body.domain || !body.brand) {
            return NextResponse.json({
                error: 'Missing required fields: surfaceId, domain, brand'
            }, { status: 400 });
        }

        // Get surface from registry
        const surface = await prisma.footprintSurfaceRegistry.findUnique({
            where: { id: body.surfaceId },
        });

        if (!surface) {
            return NextResponse.json({ error: 'Surface not found' }, { status: 404 });
        }

        // Generate queries from templates
        const templates = surface.queryTemplates as string[];
        const queries = templates
            .slice(0, surface.maxQueries)
            .map(t => substituteTokens(t, body))
            .filter(q => q.length > 0);

        // Execute based on source type
        let allResults: unknown[] = [];
        let success = true;
        let error: string | undefined;

        if (surface.sourceType === 'WEBSITE_CRAWL') {
            const crawlResult = await executeWebsiteCrawl(body.domain);
            allResults = crawlResult.results;
            success = crawlResult.success;
            error = crawlResult.error;
        } else if (surface.sourceType === 'DATAFORSEO_SERP' || surface.sourceType === 'DATAFORSEO_AUTOCOMPLETE') {
            for (const query of queries) {
                const searchResult = await executeDataForSEOSerp(query, surface.searchEngine || 'google');
                if (searchResult.success) {
                    allResults.push(...searchResult.results);
                } else {
                    success = false;
                    error = searchResult.error;
                }
            }
        } else {
            return NextResponse.json({
                queries,
                results: [],
                status: 'unknown',
                message: `Source type ${surface.sourceType} not implemented for testing`,
            });
        }

        // Evaluate presence
        const evaluation = evaluatePresence(
            allResults,
            surface.presenceRules as Record<string, string> | null,
            body.domain,
            body.brand
        );

        // Calculate score preview
        const statusFactor = evaluation.status === 'present' ? 1 : evaluation.status === 'partial' ? 0.5 : 0;
        const scorePreview = surface.basePoints * surface.defaultRelevanceWeight * statusFactor;

        return NextResponse.json({
            surface: {
                key: surface.surfaceKey,
                label: surface.label,
                sourceType: surface.sourceType,
            },
            queries,
            results: allResults.slice(0, 10),
            evaluation: {
                status: success ? evaluation.status : 'unknown',
                officialness: evaluation.officialness,
                confidence: evaluation.confidence,
            },
            scorePreview: {
                basePoints: surface.basePoints,
                weight: surface.defaultRelevanceWeight,
                statusFactor,
                finalScore: Math.round(scorePreview * 10) / 10,
            },
            error,
        });

    } catch (error) {
        console.error('Test query failed:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Test failed'
        }, { status: 500 });
    }
}
