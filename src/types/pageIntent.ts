/**
 * Page Intent Analysis Types
 * 
 * Intent buckets for classifying website pages into funnel stages:
 * - TOFU (Top of Funnel): Awareness stage
 * - MOFU (Middle of Funnel): Consideration stage
 * - BOFU (Bottom of Funnel): Decision stage
 */

export type PageIntentBucket =
    | 'problem_aware_solution_tofu'
    | 'educational_informational_tofu'
    | 'commercial_investigation_mofu'
    | 'trust_proof_mofu'
    | 'brand_navigation_bofu'
    | 'transactional_bofu';

export const PAGE_INTENT_BUCKETS: { code: PageIntentBucket; label: string; funnelStage: string }[] = [
    { code: 'problem_aware_solution_tofu', label: 'Problem-Aware / Solution (TOFU)', funnelStage: 'TOFU' },
    { code: 'educational_informational_tofu', label: 'Educational / Informational (TOFU)', funnelStage: 'TOFU' },
    { code: 'commercial_investigation_mofu', label: 'Commercial Investigation (MOFU)', funnelStage: 'MOFU' },
    { code: 'trust_proof_mofu', label: 'Trust & Proof (MOFU)', funnelStage: 'MOFU' },
    { code: 'brand_navigation_bofu', label: 'Brand / Navigation (BOFU)', funnelStage: 'BOFU' },
    { code: 'transactional_bofu', label: 'Transactional (BOFU)', funnelStage: 'BOFU' },
];

export function getIntentLabel(code: PageIntentBucket): string {
    const bucket = PAGE_INTENT_BUCKETS.find(b => b.code === code);
    return bucket?.label || code;
}

export function computePercent(count: number, total: number | null): number {
    if (!total || total <= 0) return 0;
    return Math.round((count / total) * 100);
}

/**
 * Domain-level intent summary for table display
 */
export interface DomainIntentSummaryRow {
    clientCode: string;
    clientName: string;
    companyName: string;
    domain: string;

    totalPages: number | null;

    problemAwareSolutionCount: number;
    problemAwareSolutionPercent: number;

    educationalInformationalCount: number;
    educationalInformationalPercent: number;

    commercialInvestigationCount: number;
    commercialInvestigationPercent: number;

    trustProofCount: number;
    trustProofPercent: number;

    brandNavigationCount: number;
    brandNavigationPercent: number;

    transactionalCount: number;
    transactionalPercent: number;

    hasDetails: boolean;
    lastFetchedAt?: string;
}

/**
 * Stored domain summary record
 */
export interface PageIntentDomainSummary {
    id: string;
    clientCode: string;
    domain: string;
    totalPages: number;
    problemAwareSolutionCount: number;
    educationalInformationalCount: number;
    commercialInvestigationCount: number;
    trustProofCount: number;
    brandNavigationCount: number;
    transactionalCount: number;
    createdAt: string;
    updatedAt: string;
}

/**
 * URL-level intent classification
 */
export interface PageIntentDetail {
    id: string;
    clientCode: string;
    domain: string;
    url: string;
    intent: PageIntentBucket;
    createdAt: string;
}

/**
 * API response for fetch operation
 */
export interface PageIntentFetchResult {
    domain: string;
    totalPages: number;
    problemAwareSolutionCount: number;
    educationalInformationalCount: number;
    commercialInvestigationCount: number;
    trustProofCount: number;
    brandNavigationCount: number;
    transactionalCount: number;
    error?: string;
}
