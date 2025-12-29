/**
 * Domain Credibility Service
 * Combines Whois + Backlinks + Labs into a single credibility fetch
 * 
 * This is the main service used by the Domain Authority page
 */

import { v4 as uuidv4 } from 'uuid';
import { DomainCredibilityData, DomainCredibilityRecord, LocationCode } from '../core/types';
import { startNewCorrelation } from '../core/logger';
import { fetchWhoisOverview, WhoisResult } from './whois';
import { fetchBacklinksSummary, BacklinksResult } from './backlinks';
import { fetchDomainRankOverview, LabsResult } from './labs';

console.log('[DataForSEO] Credibility service module loaded');

// ============================================================================
// TYPES
// ============================================================================

export interface CredibilityFetchOptions {
    clientCode?: string;
    locationCode?: LocationCode;
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
// MAIN CREDIBILITY FETCH
// ============================================================================

/**
 * Fetch complete credibility data for a domain
 * Makes 3 API calls: Whois + Backlinks + Labs
 * 
 * @param domain - Domain to fetch
 * @param options - Client code and location
 * @returns Complete credibility data with all metrics
 */
export async function fetchDomainCredibility(
    domain: string,
    options: CredibilityFetchOptions = {}
): Promise<DomainCredibilityData> {
    const cleanedDomain = cleanDomain(domain);
    const locationCode = options.locationCode || 'IN';
    const correlationId = startNewCorrelation();
    const errors: string[] = [];

    console.log(`[Credibility] ========================================`);
    console.log(`[Credibility] Starting fetch for: ${cleanedDomain}`);
    console.log(`[Credibility] Location: ${locationCode}`);
    console.log(`[Credibility] Correlation: ${correlationId}`);
    console.log(`[Credibility] ========================================`);

    // Initialize result with nulls
    const result: DomainCredibilityData = {
        domain: cleanedDomain,
        locationCode,
        domainAgeYears: null,
        createdDate: null,
        expirationDate: null,
        registrar: null,
        referringDomains: null,
        totalBacklinks: null,
        dofollowBacklinks: null,
        nofollowBacklinks: null,
        backlinkSpamScore: null,
        domainRank: null,
        paidKeywordsCount: null,
        organicKeywordsCount: null,
        organicTraffic: null,
        organicCost: null,
        organicTop3: null,
        organicTop10: null,
        organicTop100: null,
        keywordVisibilityScore: null,
        paidTraffic: null,
        paidCost: null,
        fetchedAt: new Date().toISOString(),
        errors: [],
    };

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: Whois (Domain Age)
    // ─────────────────────────────────────────────────────────────────────────
    console.log(`[Credibility] Step 1/3: Fetching Whois...`);
    try {
        const whoisData = await fetchWhoisOverview(cleanedDomain, {
            clientCode: options.clientCode,
        });

        if (whoisData.success) {
            result.domainAgeYears = whoisData.domainAgeYears;
            result.createdDate = whoisData.createdDate;
            result.expirationDate = whoisData.expirationDate;
            result.registrar = whoisData.registrar;
            console.log(`[Credibility] ✅ Whois: Age=${result.domainAgeYears} years`);
        } else {
            errors.push(`Whois: ${whoisData.error}`);
            console.log(`[Credibility] ⚠️ Whois failed: ${whoisData.error}`);
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Whois: ${msg}`);
        console.error(`[Credibility] ❌ Whois exception: ${msg}`);
    }

    // Small delay between API calls (be nice to the API)
    await new Promise(resolve => setTimeout(resolve, 100));

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: Backlinks
    // ─────────────────────────────────────────────────────────────────────────
    console.log(`[Credibility] Step 2/3: Fetching Backlinks...`);
    try {
        const backlinksData = await fetchBacklinksSummary(cleanedDomain, {
            clientCode: options.clientCode,
        });

        if (backlinksData.success) {
            result.referringDomains = backlinksData.referringDomains;
            result.totalBacklinks = backlinksData.totalBacklinks;
            result.dofollowBacklinks = backlinksData.dofollowBacklinks;
            result.nofollowBacklinks = backlinksData.nofollowBacklinks;
            result.backlinkSpamScore = backlinksData.backlinkSpamScore;
            result.domainRank = backlinksData.rank;
            console.log(`[Credibility] ✅ Backlinks: RD=${result.referringDomains}, BL=${result.totalBacklinks}`);
        } else {
            errors.push(`Backlinks: ${backlinksData.error}`);
            console.log(`[Credibility] ⚠️ Backlinks failed: ${backlinksData.error}`);
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Backlinks: ${msg}`);
        console.error(`[Credibility] ❌ Backlinks exception: ${msg}`);
    }

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: Labs (Keyword counts)
    // ─────────────────────────────────────────────────────────────────────────
    console.log(`[Credibility] Step 3/3: Fetching Labs...`);
    try {
        const labsData = await fetchDomainRankOverview(cleanedDomain, {
            clientCode: options.clientCode,
            locationCode,
        });

        if (labsData.success) {
            result.paidKeywordsCount = labsData.paidKeywordsCount;
            result.organicKeywordsCount = labsData.organicKeywordsCount;
            result.organicTraffic = labsData.organicTraffic;
            result.organicCost = labsData.organicCost;
            result.organicTop3 = labsData.organicTop3;
            result.organicTop10 = labsData.organicTop10;
            result.organicTop100 = labsData.organicTop100;
            result.keywordVisibilityScore = labsData.keywordVisibilityScore;
            result.paidTraffic = labsData.paidTraffic;
            result.paidCost = labsData.paidCost;
            console.log(`[Credibility] ✅ Labs: Organic=${result.organicKeywordsCount}, Traffic=${result.organicTraffic}, Visibility=${result.keywordVisibilityScore}`);
        } else {
            errors.push(`Labs: ${labsData.error}`);
            console.log(`[Credibility] ⚠️ Labs failed: ${labsData.error}`);
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Labs: ${msg}`);
        console.error(`[Credibility] ❌ Labs exception: ${msg}`);
    }

    result.errors = errors;

    console.log(`[Credibility] ========================================`);
    console.log(`[Credibility] Completed: ${cleanedDomain}`);
    console.log(`[Credibility] Errors: ${errors.length > 0 ? errors.join(', ') : 'None'}`);
    console.log(`[Credibility] ========================================`);

    return result;
}

/**
 * Convert credibility data to a full record for storage
 */
export function toCredibilityRecord(
    data: DomainCredibilityData,
    clientCode: string,
    options: {
        domainType: 'client' | 'competitor';
        label?: string;
    }
): DomainCredibilityRecord {
    return {
        id: uuidv4(),
        clientCode,
        domainType: options.domainType,
        label: options.label,
        ...data,
    };
}

export const CREDIBILITY_VERSION = '1.0.0';
