/**
 * Smart Fetch Service
 * Only fetches MISSING data - never re-fetches existing data
 */

import { fetchWhoisOverview } from '../endpoints/whois';
import { fetchBacklinksSummary } from '../endpoints/backlinks';
import { fetchDomainRankOverview } from '../endpoints/labs';
import { API_PRICING, logApiCall } from '../core/usage-tracker';
import { checkBalance } from '../core/balance';
import { DomainCredibilityData, LocationCode } from '../core/types';

// ============================================================================
// TYPES
// ============================================================================

export interface ExistingData {
    domain: string;
    hasWhois: boolean;
    hasBacklinks: boolean;
    hasLabs: boolean;
    data: Partial<DomainCredibilityData> | null;
}

export interface FetchPlan {
    domain: string;
    needsWhois: boolean;
    needsBacklinks: boolean;
    needsLabs: boolean;
    estimatedCost: number;
}

export interface FetchPlanSummary {
    domains: FetchPlan[];
    totalDomains: number;
    domainsNeedingFetch: number;
    domainsComplete: number;
    apiCallsNeeded: {
        whois: number;
        backlinks: number;
        labs: number;
        total: number;
    };
    estimatedCost: {
        whois: number;
        backlinks: number;
        labs: number;
        total: number;
    };
}

export interface SmartFetchResult {
    domain: string;
    data: Partial<DomainCredibilityData>;
    apisCalled: string[];
    cost: number;
    errors: string[];
}

// ============================================================================
// ANALYZE EXISTING DATA
// ============================================================================

export function analyzeExistingData(
    storedRecord: Partial<DomainCredibilityData> | null
): { hasWhois: boolean; hasBacklinks: boolean; hasLabs: boolean } {
    if (!storedRecord) {
        return { hasWhois: false, hasBacklinks: false, hasLabs: false };
    }

    // Check Whois data (domain age)
    const hasWhois = storedRecord.domainAgeYears !== null &&
        storedRecord.domainAgeYears !== undefined;

    // Check Backlinks data (referring domains, backlinks)
    const hasBacklinks = storedRecord.referringDomains !== null &&
        storedRecord.referringDomains !== undefined &&
        storedRecord.totalBacklinks !== null;

    // Check Labs data (organic traffic, keywords)
    const hasLabs = storedRecord.organicKeywordsCount !== null &&
        storedRecord.organicKeywordsCount !== undefined;

    return { hasWhois, hasBacklinks, hasLabs };
}

// ============================================================================
// CREATE FETCH PLAN
// ============================================================================

export function createFetchPlan(
    domains: Array<{ domain: string; existingData: Partial<DomainCredibilityData> | null }>
): FetchPlanSummary {
    const plans: FetchPlan[] = [];
    let whoisCalls = 0, backlinksCalls = 0, labsCalls = 0;

    for (const { domain, existingData } of domains) {
        const { hasWhois, hasBacklinks, hasLabs } = analyzeExistingData(existingData);

        const needsWhois = !hasWhois;
        const needsBacklinks = !hasBacklinks;
        const needsLabs = !hasLabs;

        const cost =
            (needsWhois ? API_PRICING.whois.perDomain : 0) +
            (needsBacklinks ? API_PRICING.backlinks.perDomain : 0) +
            (needsLabs ? API_PRICING.labs.perDomain : 0);

        if (needsWhois) whoisCalls++;
        if (needsBacklinks) backlinksCalls++;
        if (needsLabs) labsCalls++;

        plans.push({
            domain,
            needsWhois,
            needsBacklinks,
            needsLabs,
            estimatedCost: cost,
        });
    }

    const domainsNeedingFetch = plans.filter(p =>
        p.needsWhois || p.needsBacklinks || p.needsLabs
    ).length;

    return {
        domains: plans,
        totalDomains: domains.length,
        domainsNeedingFetch,
        domainsComplete: domains.length - domainsNeedingFetch,
        apiCallsNeeded: {
            whois: whoisCalls,
            backlinks: backlinksCalls,
            labs: labsCalls,
            total: whoisCalls + backlinksCalls + labsCalls,
        },
        estimatedCost: {
            whois: whoisCalls * API_PRICING.whois.perDomain,
            backlinks: backlinksCalls * API_PRICING.backlinks.perDomain,
            labs: labsCalls * API_PRICING.labs.perDomain,
            total: (whoisCalls * API_PRICING.whois.perDomain) +
                (backlinksCalls * API_PRICING.backlinks.perDomain) +
                (labsCalls * API_PRICING.labs.perDomain),
        },
    };
}

// ============================================================================
// SMART FETCH - Only fetch what's missing
// ============================================================================

export async function smartFetchDomain(
    domain: string,
    existingData: Partial<DomainCredibilityData> | null,
    options: {
        clientCode: string;
        locationCode?: LocationCode;
        page: string;
    }
): Promise<SmartFetchResult> {
    const { hasWhois, hasBacklinks, hasLabs } = analyzeExistingData(existingData);
    const locationCode = options.locationCode || 'IN';

    const result: SmartFetchResult = {
        domain,
        data: existingData ? { ...existingData } : { domain, locationCode },
        apisCalled: [],
        cost: 0,
        errors: [],
    };

    // Fetch Whois if missing
    if (!hasWhois) {
        const startTime = Date.now();
        try {
            const whoisData = await fetchWhoisOverview(domain, { clientCode: options.clientCode });
            result.data.domainAgeYears = whoisData.domainAgeYears;
            result.data.createdDate = whoisData.createdDate;
            result.data.registrar = whoisData.registrar;
            result.apisCalled.push('whois');
            result.cost += API_PRICING.whois.perDomain;

            await logApiCall({
                page: options.page,
                clientCode: options.clientCode,
                apiType: 'whois',
                endpoint: 'domain_analytics/whois/overview/live',
                domain,
                cost: API_PRICING.whois.perDomain,
                success: whoisData.success,
                error: whoisData.error,
                durationMs: Date.now() - startTime,
            });
        } catch (error) {
            result.errors.push(`Whois: ${error}`);
        }
    }

    // Fetch Backlinks if missing
    if (!hasBacklinks) {
        const startTime = Date.now();
        try {
            const blData = await fetchBacklinksSummary(domain, { clientCode: options.clientCode });
            result.data.referringDomains = blData.referringDomains;
            result.data.totalBacklinks = blData.totalBacklinks;
            result.data.dofollowBacklinks = blData.dofollowBacklinks;
            result.data.nofollowBacklinks = blData.nofollowBacklinks;
            result.data.domainRank = blData.rank;
            result.apisCalled.push('backlinks');
            result.cost += API_PRICING.backlinks.perDomain;

            await logApiCall({
                page: options.page,
                clientCode: options.clientCode,
                apiType: 'backlinks',
                endpoint: 'backlinks/summary/live',
                domain,
                cost: API_PRICING.backlinks.perDomain,
                success: blData.success,
                error: blData.error,
                durationMs: Date.now() - startTime,
            });
        } catch (error) {
            result.errors.push(`Backlinks: ${error}`);
        }
    }

    // Fetch Labs if missing
    if (!hasLabs) {
        const startTime = Date.now();
        try {
            const labsData = await fetchDomainRankOverview(domain, {
                clientCode: options.clientCode,
                locationCode,
            });
            result.data.organicKeywordsCount = labsData.organicKeywordsCount;
            result.data.paidKeywordsCount = labsData.paidKeywordsCount;
            result.data.organicTraffic = labsData.organicTraffic;
            result.data.organicCost = labsData.organicCost;
            result.data.organicTop3 = labsData.organicTop3;
            result.data.organicTop10 = labsData.organicTop10;
            result.data.organicTop100 = labsData.organicTop100;
            result.data.keywordVisibilityScore = labsData.keywordVisibilityScore;
            result.data.paidTraffic = labsData.paidTraffic;
            result.data.paidCost = labsData.paidCost;
            result.apisCalled.push('labs');
            result.cost += API_PRICING.labs.perDomain;

            await logApiCall({
                page: options.page,
                clientCode: options.clientCode,
                apiType: 'labs',
                endpoint: 'dataforseo_labs/google/domain_rank_overview/live',
                domain,
                cost: API_PRICING.labs.perDomain,
                success: labsData.success,
                error: labsData.error,
                durationMs: Date.now() - startTime,
            });
        } catch (error) {
            result.errors.push(`Labs: ${error}`);
        }
    }

    result.data.fetchedAt = new Date().toISOString();
    result.data.errors = result.errors;

    return result;
}

export const SMART_FETCH_VERSION = '1.0.0';
