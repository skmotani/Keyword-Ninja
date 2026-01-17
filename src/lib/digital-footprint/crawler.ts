// Website Crawler - Extracts entity signals from website

export interface CrawlResult {
    success: boolean;
    finalUrl?: string;
    httpStatus?: number;
    error?: string;
    data?: CrawlData;
}

export interface CrawlData {
    title?: string;
    metaDescription?: string;
    schemaBlocks?: SchemaBlock[];
    socialLinks?: SocialLink[];
    brandSignals?: BrandSignal[];
    hasSSL: boolean;
    loadTimeMs?: number;
}

export interface SchemaBlock {
    type: string;  // Organization, LocalBusiness, Product, etc.
    raw: Record<string, unknown>;
}

export interface SocialLink {
    platform: string;
    url: string;
}

export interface BrandSignal {
    source: string;  // title, schema, logo_alt, etc.
    value: string;
}

// Normalize domain input
export function normalizeDomain(input: string): string {
    let domain = input.trim().toLowerCase();

    // Remove protocol
    domain = domain.replace(/^https?:\/\//, '');

    // Remove www
    domain = domain.replace(/^www\./, '');

    // Remove path
    domain = domain.split('/')[0];

    // Remove port
    domain = domain.split(':')[0];

    return domain;
}

// Parse domains from multi-line input
export function parseDomainsInput(input: string, maxDomains: number = 5): string[] {
    const raw = input
        .split(/[\n,;]+/)
        .map(d => d.trim())
        .filter(Boolean);

    const normalized = raw.map(normalizeDomain);
    const unique = [...new Set(normalized)];

    return unique.slice(0, maxDomains);
}

// Crawl a website and extract entity data
export async function crawlWebsite(domain: string): Promise<CrawlResult> {
    const url = `https://${domain}`;

    try {
        const startTime = Date.now();

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; MotaniBot/1.0; +https://motani.com)',
                'Accept': 'text/html,application/xhtml+xml',
            },
            redirect: 'follow',
        });

        const loadTimeMs = Date.now() - startTime;
        const html = await response.text();

        // Extract data
        const data: CrawlData = {
            hasSSL: url.startsWith('https'),
            loadTimeMs,
        };

        // Extract title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
            data.title = titleMatch[1].trim();
        }

        // Extract meta description
        const metaMatch = html.match(/<meta\s+name=["\']description["\']\s+content=["\']([^"\']+)["\']/i);
        if (metaMatch) {
            data.metaDescription = metaMatch[1].trim();
        }

        // Extract JSON-LD schemas
        const schemaMatches = html.matchAll(/<script\s+type=["\']application\/ld\+json["\']\s*>([^<]+)<\/script>/gi);
        data.schemaBlocks = [];
        for (const match of schemaMatches) {
            try {
                const json = JSON.parse(match[1]);
                const type = json['@type'] || 'Unknown';
                data.schemaBlocks.push({ type, raw: json });
            } catch {
                // Skip invalid JSON
            }
        }

        // Extract social links from HTML
        data.socialLinks = [];
        const socialPatterns = [
            { platform: 'linkedin', pattern: /href=["\']([^"\']*linkedin\.com[^"\']*)["\']/ },
            { platform: 'youtube', pattern: /href=["\']([^"\']*youtube\.com[^"\']*)["\']/ },
            { platform: 'facebook', pattern: /href=["\']([^"\']*facebook\.com[^"\']*)["\']/ },
            { platform: 'instagram', pattern: /href=["\']([^"\']*instagram\.com[^"\']*)["\']/ },
            { platform: 'twitter', pattern: /href=["\']([^"\']*twitter\.com[^"\']*)["\']/ },
            { platform: 'x', pattern: /href=["\']([^"\']*x\.com[^"\']*)["\']/ },
            { platform: 'pinterest', pattern: /href=["\']([^"\']*pinterest\.com[^"\']*)["\']/ },
        ];

        for (const { platform, pattern } of socialPatterns) {
            const match = html.match(pattern);
            if (match) {
                data.socialLinks.push({ platform, url: match[1] });
            }
        }

        // Extract brand signals
        data.brandSignals = [];

        // From title
        if (data.title) {
            const brandFromTitle = data.title.split(/[-|–—]/)[0].trim();
            if (brandFromTitle && brandFromTitle.length < 50) {
                data.brandSignals.push({ source: 'title', value: brandFromTitle });
            }
        }

        // From schema
        for (const schema of data.schemaBlocks) {
            if (schema.raw.name && typeof schema.raw.name === 'string') {
                data.brandSignals.push({ source: 'schema', value: schema.raw.name });
            }
        }

        // From og:site_name
        const ogSiteMatch = html.match(/<meta\s+property=["\']og:site_name["\']\s+content=["\']([^"\']+)["\']/i);
        if (ogSiteMatch) {
            data.brandSignals.push({ source: 'og_site_name', value: ogSiteMatch[1].trim() });
        }

        return {
            success: true,
            finalUrl: response.url,
            httpStatus: response.status,
            data,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
