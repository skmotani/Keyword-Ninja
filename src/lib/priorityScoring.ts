import {
  PageClassificationIntent,
  PageTypeValue,
  PriorityTier,
  PriorityScoreBreakdown,
  DomainPageRecord,
} from '@/types';

export const PRIORITY_WEIGHTS = {
  etv: 0.40,
  intent: 0.25,
  pageType: 0.20,
  businessRelevance: 0.15,
};

export const INTENT_SCORES: Record<PageClassificationIntent, number> = {
  TRANSACTIONAL: 100,
  COMMERCIAL_RESEARCH: 80,
  INFORMATIONAL: 50,
  SUPPORT: 20,
  NAVIGATIONAL: 10,
  IRRELEVANT_SEO: 0,
};

export const PAGE_TYPE_SCORES: Record<PageTypeValue, number> = {
  PRODUCT_SERVICE: 100,
  PRICING_PLANS: 100,
  LANDING_CAMPAIGN: 90,
  CATEGORY_COLLECTION: 70,
  BLOG_ARTICLE_NEWS: 60,
  RESOURCE_GUIDE_DOC: 50,
  HOME_PAGE: 40,
  SUPPORT_CONTACT: 20,
  COMPANY_ABOUT: 10,
  CAREERS_HR: 0,
  LEGAL_POLICY: 0,
  ACCOUNT_AUTH: 0,
  OTHER_MISC: 30,
};

export type BusinessRelevanceForScoring = 'DIRECT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export const BUSINESS_RELEVANCE_SCORES: Record<BusinessRelevanceForScoring, number> = {
  DIRECT: 100,
  HIGH: 80,
  MEDIUM: 60,
  LOW: 30,
  NONE: 0,
};

export const PRIORITY_TIER_THRESHOLDS: { tier: PriorityTier; minScore: number }[] = [
  { tier: 'TIER_1_IMMEDIATE', minScore: 80 },
  { tier: 'TIER_2_HIGH', minScore: 60 },
  { tier: 'TIER_3_MEDIUM', minScore: 40 },
  { tier: 'TIER_4_MONITOR', minScore: 20 },
  { tier: 'TIER_5_IGNORE', minScore: 0 },
];

export function normalizeETV(etv: number | null, maxEtv: number): number {
  if (etv === null || etv <= 0 || maxEtv <= 0) {
    return 0;
  }
  const normalized = (etv / maxEtv) * 100;
  return Math.min(100, Math.round(normalized * 100) / 100);
}

export function getIntentScore(intent: PageClassificationIntent | null | undefined): number {
  if (!intent) return 0;
  return INTENT_SCORES[intent] ?? 0;
}

export function getPageTypeScore(pageType: PageTypeValue | null | undefined): number {
  if (!pageType) return 0;
  return PAGE_TYPE_SCORES[pageType] ?? 0;
}

export function inferBusinessRelevanceFromPage(page: DomainPageRecord): BusinessRelevanceForScoring {
  if (!page.isSeoRelevant) {
    return 'NONE';
  }
  
  const intent = page.pageIntent;
  const pageType = page.pageType;
  
  if (
    intent === 'TRANSACTIONAL' ||
    pageType === 'PRODUCT_SERVICE' ||
    pageType === 'PRICING_PLANS'
  ) {
    return 'DIRECT';
  }
  
  if (
    intent === 'COMMERCIAL_RESEARCH' ||
    pageType === 'LANDING_CAMPAIGN' ||
    pageType === 'CATEGORY_COLLECTION'
  ) {
    return 'HIGH';
  }
  
  if (
    intent === 'INFORMATIONAL' ||
    pageType === 'BLOG_ARTICLE_NEWS' ||
    pageType === 'RESOURCE_GUIDE_DOC'
  ) {
    return 'MEDIUM';
  }
  
  if (
    intent === 'NAVIGATIONAL' ||
    pageType === 'HOME_PAGE' ||
    pageType === 'COMPANY_ABOUT'
  ) {
    return 'LOW';
  }
  
  return 'NONE';
}

export function getBusinessRelevanceScore(relevance: BusinessRelevanceForScoring): number {
  return BUSINESS_RELEVANCE_SCORES[relevance] ?? 0;
}

export function calculatePriorityTier(score: number): PriorityTier {
  for (const threshold of PRIORITY_TIER_THRESHOLDS) {
    if (score >= threshold.minScore) {
      return threshold.tier;
    }
  }
  return 'TIER_5_IGNORE';
}

export interface PriorityCalculationResult {
  priorityScore: number;
  priorityTier: PriorityTier;
  breakdown: PriorityScoreBreakdown;
}

export function calculatePriority(
  page: DomainPageRecord,
  maxEtvInDataset: number
): PriorityCalculationResult {
  const normalizedEtv = normalizeETV(page.estTrafficETV, maxEtvInDataset);
  const etvScore = normalizedEtv;
  
  const intentScore = getIntentScore(page.pageIntent);
  const pageTypeScore = getPageTypeScore(page.pageType);
  
  const businessRelevance = inferBusinessRelevanceFromPage(page);
  const businessRelevanceScore = getBusinessRelevanceScore(businessRelevance);
  
  const weightedScore =
    etvScore * PRIORITY_WEIGHTS.etv +
    intentScore * PRIORITY_WEIGHTS.intent +
    pageTypeScore * PRIORITY_WEIGHTS.pageType +
    businessRelevanceScore * PRIORITY_WEIGHTS.businessRelevance;
  
  const priorityScore = Math.round(weightedScore * 100) / 100;
  const priorityTier = calculatePriorityTier(priorityScore);
  
  const breakdown: PriorityScoreBreakdown = {
    etvScore: Math.round(etvScore * 100) / 100,
    intentScore,
    pageTypeScore,
    businessRelevanceScore,
    etvWeight: PRIORITY_WEIGHTS.etv,
    intentWeight: PRIORITY_WEIGHTS.intent,
    pageTypeWeight: PRIORITY_WEIGHTS.pageType,
    businessRelevanceWeight: PRIORITY_WEIGHTS.businessRelevance,
    rawEtv: page.estTrafficETV,
    maxEtvInDataset,
    normalizedEtv: Math.round(normalizedEtv * 100) / 100,
  };
  
  return {
    priorityScore,
    priorityTier,
    breakdown,
  };
}

export function calculatePriorityBatch(
  pages: DomainPageRecord[]
): Map<string, PriorityCalculationResult> {
  if (pages.length === 0) {
    return new Map();
  }
  
  const maxEtv = Math.max(
    ...pages.map((p) => p.estTrafficETV ?? 0).filter((v) => v > 0),
    1
  );
  
  const results = new Map<string, PriorityCalculationResult>();
  
  for (const page of pages) {
    const result = calculatePriority(page, maxEtv);
    results.set(page.id, result);
  }
  
  return results;
}

export function formatPriorityTier(tier: PriorityTier | null | undefined): string {
  if (!tier) return '-';
  const labels: Record<PriorityTier, string> = {
    TIER_1_IMMEDIATE: 'Tier 1 - Immediate',
    TIER_2_HIGH: 'Tier 2 - High',
    TIER_3_MEDIUM: 'Tier 3 - Medium',
    TIER_4_MONITOR: 'Tier 4 - Monitor',
    TIER_5_IGNORE: 'Tier 5 - Ignore',
  };
  return labels[tier] || tier;
}

export function getPriorityTierBadgeColor(tier: PriorityTier | null | undefined): string {
  if (!tier) return 'bg-gray-100 text-gray-600';
  const colors: Record<PriorityTier, string> = {
    TIER_1_IMMEDIATE: 'bg-red-100 text-red-800',
    TIER_2_HIGH: 'bg-orange-100 text-orange-800',
    TIER_3_MEDIUM: 'bg-yellow-100 text-yellow-800',
    TIER_4_MONITOR: 'bg-blue-100 text-blue-800',
    TIER_5_IGNORE: 'bg-gray-100 text-gray-500',
  };
  return colors[tier] || 'bg-gray-100 text-gray-600';
}
