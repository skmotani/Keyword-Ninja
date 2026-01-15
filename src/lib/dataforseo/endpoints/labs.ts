/**
 * DataForSEO Labs API
 * Fetches domain rank overview with organic/paid metrics
 * 
 * API Endpoint: dataforseo_labs/google/domain_rank_overview/live
 */

import { getDataForSEOClient } from '../core/client';
import { LOCATION_CODES, LANGUAGE_CODES, LocationCode } from '../core/types';

console.log('[DataForSEO] Labs endpoint module loaded');

// ============================================================================
// TYPES
// ============================================================================

export interface OrganicMetrics {
    etv: number | null;              // Estimated Traffic Value (monthly visits)
    count: number | null;            // Total ranking keywords
    estimatedPaidTrafficCost: number | null;
    // Position buckets
    pos1: number | null;
    pos2_3: number | null;
    pos4_10: number | null;
    pos11_20: number | null;
    pos21_30: number | null;
    pos31_40: number | null;
    pos41_50: number | null;
    pos51_60: number | null;
    pos61_70: number | null;
    pos71_80: number | null;
    pos81_90: number | null;
    pos91_100: number | null;
}

export interface PaidMetrics {
    etv: number | null;
    count: number | null;
    estimatedPaidTrafficCost: number | null;
    pos1: number | null;
    pos2_3: number | null;
    pos4_10: number | null;
}

export interface LabsResult {
    domain: string;
    locationCode: LocationCode;

    // Organic metrics
    organicTraffic: number | null;        // etv
    organicKeywordsCount: number | null;  // count
    organicCost: number | null;           // estimated_paid_traffic_cost

    // Position distribution (organic)
    organicTop3: number | null;           // pos_1 + pos_2_3
    organicTop10: number | null;          // pos_1 + pos_2_3 + pos_4_10
    organicTop100: number | null;         // sum of all

    // Raw position buckets for detailed view
    organicPositions: OrganicMetrics | null;

    // Paid metrics
    paidTraffic: number | null;
    paidKeywordsCount: number | null;
    paidCost: number | null;
    paidPositions: PaidMetrics | null;

    // Computed scores
    keywordVisibilityScore: number | null;  // Custom computed score

    success: boolean;
    error?: string;
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

/**
 * Compute Keyword Visibility Score (0-100)
 * Formula: Weighted sum based on position buckets
 * Higher positions get more weight
 */
function computeVisibilityScore(organic: OrganicMetrics | null): number | null {
    if (!organic || organic.count === null || organic.count === 0) return null;

    const weights = {
        pos1: 100,
        pos2_3: 70,
        pos4_10: 40,
        pos11_20: 20,
        pos21_30: 10,
        pos31_40: 5,
        pos41_50: 3,
        pos51_60: 2,
        pos61_70: 1,
        pos71_80: 0.5,
        pos81_90: 0.2,
        pos91_100: 0.1,
    };

    let weightedSum = 0;
    let totalKeywords = 0;

    for (const [key, weight] of Object.entries(weights)) {
        const count = organic[key as keyof OrganicMetrics] as number | null;
        if (count != null && count > 0) {
            weightedSum += count * weight;
            totalKeywords += count;
        }
    }

    if (totalKeywords === 0) return null;

    // Normalize to 0-100 scale
    const maxPossibleScore = totalKeywords * 100;
    const score = (weightedSum / maxPossibleScore) * 100;

    return Math.round(score * 10) / 10; // One decimal
}

// ============================================================================
// API FUNCTION
// ============================================================================

export async function fetchDomainRankOverview(
    domain: string,
    options: { clientCode?: string; locationCode?: LocationCode } = {}
): Promise<LabsResult> {
    const cleanedDomain = cleanDomain(domain);
    const locationCode = options.locationCode || 'IN';
    const numericLocationCode = LOCATION_CODES[locationCode];
    const languageCode = LANGUAGE_CODES[locationCode];

    console.log(`[Labs] Fetching for: ${cleanedDomain} (Location: ${locationCode}=${numericLocationCode})`);

    const client = getDataForSEOClient(options.clientCode);

    const payload = {
        target: cleanedDomain,
        location_code: numericLocationCode,
        language_code: languageCode,
    };

    try {
        const response = await client.request<any>(
            'dataforseo_labs/google/domain_rank_overview/live',
            payload,
            { domain: cleanedDomain, locationCode }
        );

        const items = response.tasks?.[0]?.result?.[0]?.items;
        const item = items?.[0];

        if (!item || !item.metrics) {
            console.log(`[Labs] No data found for: ${cleanedDomain}`);
            return {
                domain: cleanedDomain,
                locationCode,
                organicTraffic: null,
                organicKeywordsCount: null,
                organicCost: null,
                organicTop3: null,
                organicTop10: null,
                organicTop100: null,
                organicPositions: null,
                paidTraffic: null,
                paidKeywordsCount: null,
                paidCost: null,
                paidPositions: null,
                keywordVisibilityScore: null,
                success: true,
            };
        }

        const organic = item.metrics.organic;
        const paid = item.metrics.paid;

        // Extract organic position buckets
        const organicPositions: OrganicMetrics | null = organic ? {
            etv: organic.etv ?? null,
            count: organic.count ?? null,
            estimatedPaidTrafficCost: organic.estimated_paid_traffic_cost ?? null,
            pos1: organic.pos_1 ?? null,
            pos2_3: organic.pos_2_3 ?? null,
            pos4_10: organic.pos_4_10 ?? null,
            pos11_20: organic.pos_11_20 ?? null,
            pos21_30: organic.pos_21_30 ?? null,
            pos31_40: organic.pos_31_40 ?? null,
            pos41_50: organic.pos_41_50 ?? null,
            pos51_60: organic.pos_51_60 ?? null,
            pos61_70: organic.pos_61_70 ?? null,
            pos71_80: organic.pos_71_80 ?? null,
            pos81_90: organic.pos_81_90 ?? null,
            pos91_100: organic.pos_91_100 ?? null,
        } : null;

        // Extract paid position buckets
        const paidPositions: PaidMetrics | null = paid ? {
            etv: paid.etv ?? null,
            count: paid.count ?? null,
            estimatedPaidTrafficCost: paid.estimated_paid_traffic_cost ?? null,
            pos1: paid.pos_1 ?? null,
            pos2_3: paid.pos_2_3 ?? null,
            pos4_10: paid.pos_4_10 ?? null,
        } : null;

        // Calculate top position aggregates
        const pos1 = organicPositions?.pos1 ?? 0;
        const pos2_3 = organicPositions?.pos2_3 ?? 0;
        const pos4_10 = organicPositions?.pos4_10 ?? 0;
        const pos11_20 = organicPositions?.pos11_20 ?? 0;
        const pos21_30 = organicPositions?.pos21_30 ?? 0;
        const pos31_40 = organicPositions?.pos31_40 ?? 0;
        const pos41_50 = organicPositions?.pos41_50 ?? 0;
        const pos51_60 = organicPositions?.pos51_60 ?? 0;
        const pos61_70 = organicPositions?.pos61_70 ?? 0;
        const pos71_80 = organicPositions?.pos71_80 ?? 0;
        const pos81_90 = organicPositions?.pos81_90 ?? 0;
        const pos91_100 = organicPositions?.pos91_100 ?? 0;

        const organicTop3 = pos1 + pos2_3;
        const organicTop10 = organicTop3 + pos4_10;
        const organicTop100 = organicTop10 + pos11_20 + pos21_30 + pos31_40 + pos41_50 + pos51_60 + pos61_70 + pos71_80 + pos81_90 + pos91_100;

        // Compute visibility score
        const keywordVisibilityScore = computeVisibilityScore(organicPositions);

        const result: LabsResult = {
            domain: cleanedDomain,
            locationCode,
            organicTraffic: organic?.etv ?? null,
            organicKeywordsCount: organic?.count ?? null,
            organicCost: organic?.estimated_paid_traffic_cost ?? null,
            organicTop3: organicTop3 > 0 ? organicTop3 : null,
            organicTop10: organicTop10 > 0 ? organicTop10 : null,
            organicTop100: organicTop100 > 0 ? organicTop100 : null,
            organicPositions,
            paidTraffic: paid?.etv ?? null,
            paidKeywordsCount: paid?.count ?? null,
            paidCost: paid?.estimated_paid_traffic_cost ?? null,
            paidPositions,
            keywordVisibilityScore,
            success: true,
        };

        console.log(`[Labs] Success for ${cleanedDomain}: Traffic=${result.organicTraffic}, KWs=${result.organicKeywordsCount}, Visibility=${result.keywordVisibilityScore}, Top10=${result.organicTop10}`);
        return result;

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Labs] Error for ${cleanedDomain}: ${message}`);

        return {
            domain: cleanedDomain,
            locationCode,
            organicTraffic: null,
            organicKeywordsCount: null,
            organicCost: null,
            organicTop3: null,
            organicTop10: null,
            organicTop100: null,
            organicPositions: null,
            paidTraffic: null,
            paidKeywordsCount: null,
            paidCost: null,
            paidPositions: null,
            keywordVisibilityScore: null,
            success: false,
            error: message,
        };
    }
}

export const LABS_VERSION = '2.0.0';
