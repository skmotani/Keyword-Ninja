/**
 * Sitemap fetching utilities for Page Intent Analysis
 */

import { parseStringPromise } from 'xml2js';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface SitemapFetchResult {
    urls: string[];
    errors: string[];
}

/**
 * Fetch sitemap URLs for a given domain
 * Tries multiple common sitemap locations
 */
export async function fetchSitemapUrls(domain: string): Promise<SitemapFetchResult> {
    const normalizedDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
    const baseUrl = `https://${normalizedDomain}`;

    console.log(`[SitemapFetch] Starting fetch for domain: ${domain} (normalized: ${normalizedDomain})`);

    const sitemapLocations = [
        `${baseUrl}/sitemap.xml`,
        `${baseUrl}/sitemap_index.xml`,
        `${baseUrl}/sitemap-index.xml`,
        `${baseUrl}/sitemap/sitemap.xml`,
        `${baseUrl}/sitemaps/sitemap.xml`,
        `${baseUrl}/wp-sitemap.xml`, // WordPress
        `${baseUrl}/sitemap1.xml`,
        `${baseUrl}/page-sitemap.xml`,
        `${baseUrl}/post-sitemap.xml`,
    ];

    const allUrls = new Set<string>();
    const errors: string[] = [];

    // First try robots.txt to find sitemap locations
    try {
        console.log(`[SitemapFetch] Checking robots.txt for sitemap references...`);
        const robotsUrls = await findSitemapsFromRobots(baseUrl);
        if (robotsUrls.length > 0) {
            console.log(`[SitemapFetch] Found ${robotsUrls.length} sitemap(s) in robots.txt:`, robotsUrls);
            // Prepend robots.txt sitemaps to the list
            sitemapLocations.unshift(...robotsUrls);
        }
    } catch (e) {
        console.log(`[SitemapFetch] Could not access robots.txt: ${e}`);
    }

    // Deduplicate sitemap locations
    const uniqueLocations = Array.from(new Set(sitemapLocations));

    for (const sitemapUrl of uniqueLocations) {
        try {
            console.log(`[SitemapFetch] Trying: ${sitemapUrl}`);
            const result = await fetchSingleSitemap(sitemapUrl, 0);

            if (result.urls.length > 0) {
                result.urls.forEach(url => allUrls.add(url));
                console.log(`[SitemapFetch] ✓ Found ${result.urls.length} URLs from ${sitemapUrl}`);
                break; // Found a working sitemap, stop trying others
            } else {
                console.log(`[SitemapFetch] ✗ No URLs found in ${sitemapUrl}`);
            }

            if (result.errors.length > 0) {
                errors.push(...result.errors);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.log(`[SitemapFetch] ✗ Error fetching ${sitemapUrl}: ${errorMsg}`);
            errors.push(`${sitemapUrl}: ${errorMsg}`);
        }
    }

    console.log(`[SitemapFetch] Final result: ${allUrls.size} total URLs found`);

    return {
        urls: Array.from(allUrls),
        errors: allUrls.size === 0 ? errors : [],
    };
}

/**
 * Fetch and parse a single sitemap (handles both sitemap index and regular sitemaps)
 */
async function fetchSingleSitemap(url: string, depth: number): Promise<SitemapFetchResult> {
    // Prevent infinite recursion
    if (depth > 3) {
        console.log(`[SitemapFetch] Max depth reached for ${url}`);
        return { urls: [], errors: ['Max recursion depth reached'] };
    }

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'application/xml, text/xml, */*',
            },
            signal: AbortSignal.timeout(20000),
        });

        console.log(`[SitemapFetch] HTTP ${response.status} for ${url}`);

        if (!response.ok) {
            return { urls: [], errors: [`HTTP ${response.status}`] };
        }

        const xml = await response.text();
        console.log(`[SitemapFetch] Received ${xml.length} bytes from ${url}`);

        // Log first 500 chars for debugging
        console.log(`[SitemapFetch] XML preview: ${xml.substring(0, 500).replace(/\s+/g, ' ')}`);

        let parsed;
        try {
            parsed = await parseStringPromise(xml, {
                explicitArray: false,
                ignoreAttrs: true,
                trim: true,
            });
        } catch (parseError) {
            console.error(`[SitemapFetch] XML parse error for ${url}:`, parseError);
            return { urls: [], errors: [`XML parse error: ${parseError}`] };
        }

        console.log(`[SitemapFetch] Parsed structure keys:`, Object.keys(parsed || {}));

        const urls: string[] = [];
        const errors: string[] = [];

        // Check if it's a sitemap index
        if (parsed?.sitemapindex?.sitemap) {
            let sitemaps = parsed.sitemapindex.sitemap;
            if (!Array.isArray(sitemaps)) {
                sitemaps = [sitemaps];
            }

            console.log(`[SitemapFetch] Found sitemap index with ${sitemaps.length} child sitemaps`);

            // Fetch each child sitemap (limit to first 15 to avoid too many requests)
            const childSitemaps = sitemaps.slice(0, 15);
            for (const sitemap of childSitemaps) {
                const childUrl = typeof sitemap === 'string' ? sitemap : sitemap?.loc;
                if (childUrl) {
                    console.log(`[SitemapFetch] Fetching child sitemap: ${childUrl}`);
                    try {
                        const childResult = await fetchSingleSitemap(childUrl, depth + 1);
                        urls.push(...childResult.urls);
                        console.log(`[SitemapFetch] Child ${childUrl} returned ${childResult.urls.length} URLs`);
                    } catch (error) {
                        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                        console.error(`[SitemapFetch] Child sitemap ${childUrl} error:`, errorMsg);
                        errors.push(`Child sitemap ${childUrl}: ${errorMsg}`);
                    }
                }
            }
        }

        // Check if it's a regular sitemap (urlset)
        if (parsed?.urlset?.url) {
            let urlEntries = parsed.urlset.url;
            if (!Array.isArray(urlEntries)) {
                urlEntries = [urlEntries];
            }

            console.log(`[SitemapFetch] Found urlset with ${urlEntries.length} URL entries`);

            for (const entry of urlEntries) {
                const loc = typeof entry === 'string' ? entry : entry?.loc;
                if (loc) {
                    urls.push(loc);
                }
            }
        }

        // Some sitemaps have URLs directly
        if (parsed?.url) {
            let urlEntries = parsed.url;
            if (!Array.isArray(urlEntries)) {
                urlEntries = [urlEntries];
            }
            for (const entry of urlEntries) {
                const loc = typeof entry === 'string' ? entry : entry?.loc;
                if (loc) {
                    urls.push(loc);
                }
            }
        }

        console.log(`[SitemapFetch] Extracted ${urls.length} URLs from ${url}`);
        return { urls, errors };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[SitemapFetch] Fatal error fetching ${url}:`, errorMsg);
        return { urls: [], errors: [errorMsg] };
    }
}

/**
 * Try to find sitemap URLs from robots.txt
 */
async function findSitemapsFromRobots(baseUrl: string): Promise<string[]> {
    const robotsUrl = `${baseUrl}/robots.txt`;

    const response = await fetch(robotsUrl, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
        return [];
    }

    const text = await response.text();
    const sitemapUrls: string[] = [];

    const lines = text.split('\n');
    for (const line of lines) {
        const match = line.match(/^Sitemap:\s*(.+)$/i);
        if (match && match[1]) {
            sitemapUrls.push(match[1].trim());
        }
    }

    return sitemapUrls;
}

