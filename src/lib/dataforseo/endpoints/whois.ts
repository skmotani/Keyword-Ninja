/**
 * DataForSEO Whois API
 * Fetches domain age and registration information
 * 
 * API Endpoint: domain_analytics/whois/overview/live
 * Cost: ~$0.001 per domain
 */

import { getDataForSEOClient } from '../core/client';
import { LocationCode } from '../core/types';

console.log('[DataForSEO] Whois endpoint module loaded');

// ============================================================================
// TYPES
// ============================================================================

export interface WhoisResult {
    domain: string;
    createdDate: string | null;
    expirationDate: string | null;
    domainAgeYears: number | null;
    registrar: string | null;
    success: boolean;
    error?: string;
}

interface WhoisApiItem {
    domain: string;
    created_datetime: string | null;
    expiration_datetime: string | null;
    registrar?: {
        name: string | null;
    } | null;
}

interface WhoisApiResult {
    items_count: number;
    items: WhoisApiItem[];
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Clean domain (remove protocol, www, path)
 */
function cleanDomain(domain: string): string {
    return domain
        .toLowerCase()
        .trim()
        .replace(/^(https?:\/\/)?(www\.)?/, '')
        .replace(/\/.*$/, '')
        .replace(/\s+/g, '');
}

/**
 * Calculate domain age in years from creation date
 */
function calculateDomainAge(createdDateStr: string | null): number | null {
    if (!createdDateStr) return null;

    try {
        const createdDate = new Date(createdDateStr);
        if (isNaN(createdDate.getTime())) return null;

        const now = new Date();
        const ageMs = now.getTime() - createdDate.getTime();
        const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25);
        return Math.round(ageYears * 10) / 10; // Round to 1 decimal
    } catch {
        return null;
    }
}

// ============================================================================
// API FUNCTION
// ============================================================================

/**
 * Fetch Whois data for a single domain
 */
export async function fetchWhoisOverview(
    domain: string,
    options: { clientCode?: string } = {}
): Promise<WhoisResult> {
    const cleanedDomain = cleanDomain(domain);
    console.log(`[Whois] Fetching for: ${cleanedDomain}`);

    const client = getDataForSEOClient(options.clientCode);

    const payload = {
        limit: 1,
        filters: [['domain', '=', cleanedDomain]],
    };

    try {
        const response = await client.request<WhoisApiResult>(
            'domain_analytics/whois/overview/live',
            payload,
            { domain: cleanedDomain }
        );

        const items = response.tasks?.[0]?.result?.[0]?.items;
        const item = items?.[0];

        if (!item) {
            console.log(`[Whois] No data found for: ${cleanedDomain}`);
            return {
                domain: cleanedDomain,
                createdDate: null,
                expirationDate: null,
                domainAgeYears: null,
                registrar: null,
                success: true, // API call succeeded, just no data
            };
        }

        const result: WhoisResult = {
            domain: cleanedDomain,
            createdDate: item.created_datetime,
            expirationDate: item.expiration_datetime,
            domainAgeYears: calculateDomainAge(item.created_datetime),
            registrar: item.registrar?.name || null,
            success: true,
        };

        console.log(`[Whois] Success for ${cleanedDomain}: Age=${result.domainAgeYears} years`);
        return result;

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Whois] Error for ${cleanedDomain}: ${message}`);

        return {
            domain: cleanedDomain,
            createdDate: null,
            expirationDate: null,
            domainAgeYears: null,
            registrar: null,
            success: false,
            error: message,
        };
    }
}

export const WHOIS_VERSION = '1.0.0';
