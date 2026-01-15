/**
 * DataForSEO Backlinks API
 * Fetches backlink metrics: referring domains, total backlinks, dofollow/nofollow
 * 
 * API Endpoint: backlinks/summary/live
 * Cost: ~$0.002 per domain
 */

import { getDataForSEOClient } from '../core/client';

console.log('[DataForSEO] Backlinks endpoint module loaded');

// ============================================================================
// TYPES
// ============================================================================

export interface BacklinksResult {
    domain: string;
    rank: number | null;
    totalBacklinks: number | null;
    referringDomains: number | null;
    referringMainDomains: number | null;
    dofollowBacklinks: number | null;
    nofollowBacklinks: number | null;
    backlinkSpamScore: number | null;
    success: boolean;
    error?: string;
    rawResponse?: any; // For debugging
}

// ============================================================================
// HELPERS
// ============================================================================

function cleanDomain(domain: string): string {
    return domain
        .toLowerCase()
        .trim()
        .replace(/^(https?:\/\/)?(www\.)?/, '')
        .replace(/\/.*$/, '')
        .replace(/\s+/g, '');
}

// ============================================================================
// API FUNCTION
// ============================================================================

/**
 * Fetch Backlinks summary for a single domain
 */
export async function fetchBacklinksSummary(
    domain: string,
    options: { clientCode?: string; includeSubdomains?: boolean } = {}
): Promise<BacklinksResult> {
    const cleanedDomain = cleanDomain(domain);
    console.log(`[Backlinks] Fetching for: ${cleanedDomain}`);

    const client = getDataForSEOClient(options.clientCode);

    const payload = {
        target: cleanedDomain,
        include_subdomains: options.includeSubdomains ?? true,
        internal_list_limit: 1,
    };

    try {
        const response = await client.request<any>(
            'backlinks/summary/live',
            payload,
            { domain: cleanedDomain }
        );

        const item = response.tasks?.[0]?.result?.[0];

        // Debug: Log the raw response structure
        console.log(`[Backlinks] Raw response for ${cleanedDomain}:`, JSON.stringify({
            backlinks: item?.backlinks,
            referring_domains: item?.referring_domains,
            dofollow: item?.referring_links_attributes?.dofollow,
            nofollow: item?.referring_links_attributes?.nofollow,
            // Also check alternative locations
            dofollow_alt1: item?.backlinks_dofollow,
            dofollow_alt2: item?.dofollow,
            referring_links_attributes: item?.referring_links_attributes,
        }, null, 2));

        if (!item) {
            console.log(`[Backlinks] No data found for: ${cleanedDomain}`);
            return {
                domain: cleanedDomain,
                rank: null,
                totalBacklinks: null,
                referringDomains: null,
                referringMainDomains: null,
                dofollowBacklinks: null,
                nofollowBacklinks: null,
                backlinkSpamScore: null,
                success: true,
            };
        }

        // Extract dofollow - check multiple possible locations
        let dofollowCount: number | null = null;
        let nofollowCount: number | null = null;

        // Primary location: referring_links_attributes
        if (item.referring_links_attributes) {
            dofollowCount = item.referring_links_attributes.dofollow ?? null;
            nofollowCount = item.referring_links_attributes.nofollow ?? null;
        }

        // Alternative: direct properties
        if (dofollowCount === null && item.backlinks_dofollow !== undefined) {
            dofollowCount = item.backlinks_dofollow;
        }

        // Alternative: referring_links_types 
        if (dofollowCount === null && item.referring_links_types) {
            dofollowCount = item.referring_links_types.dofollow ?? null;
            nofollowCount = item.referring_links_types.nofollow ?? nofollowCount;
        }

        // If we have total backlinks and nofollow, calculate dofollow
        if (dofollowCount === null && item.backlinks != null && nofollowCount != null) {
            dofollowCount = item.backlinks - nofollowCount;
            console.log(`[Backlinks] Calculated dofollow for ${cleanedDomain}: ${item.backlinks} - ${nofollowCount} = ${dofollowCount}`);
        }

        const result: BacklinksResult = {
            domain: cleanedDomain,
            rank: item.rank ?? null,
            totalBacklinks: item.backlinks ?? null,
            referringDomains: item.referring_domains ?? null,
            referringMainDomains: item.referring_main_domains ?? null,
            dofollowBacklinks: dofollowCount,
            nofollowBacklinks: nofollowCount,
            backlinkSpamScore: item.backlinks_spam_score ?? null,
            success: true,
        };

        console.log(`[Backlinks] Success for ${cleanedDomain}: RD=${result.referringDomains}, BL=${result.totalBacklinks}, DF=${result.dofollowBacklinks}, NF=${result.nofollowBacklinks}`);
        return result;

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Backlinks] Error for ${cleanedDomain}: ${message}`);

        return {
            domain: cleanedDomain,
            rank: null,
            totalBacklinks: null,
            referringDomains: null,
            referringMainDomains: null,
            dofollowBacklinks: null,
            nofollowBacklinks: null,
            backlinkSpamScore: null,
            success: false,
            error: message,
        };
    }
}

export const BACKLINKS_VERSION = '1.0.1';
