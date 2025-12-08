import {
  PageTypeValue,
  PageClassificationIntent,
  ClassificationConfidenceValue,
  SeoActionValue,
  ClassificationExplanation,
  PageClassificationConfig,
} from '@/types';

export interface PageRow {
  domain: string;
  location: string | null;
  pageUrl: string;
  keyword?: string | null;
  estTraffic?: number | null;
  etv?: number | null;
  pageTitle?: string | null;
  pageSnippet?: string | null;
}

export interface RuleClassificationResult {
  pageType: PageTypeValue;
  pageIntent: PageClassificationIntent;
  isSeoRelevant: boolean;
  classificationMethod: 'RULE';
  classificationConfidence: ClassificationConfidenceValue;
  needsAiReview: boolean;
  seoAction: SeoActionValue;
  explanation: ClassificationExplanation;
}

interface UrlPatternMatch {
  pattern: RegExp;
  pageType: PageTypeValue;
  ruleName: string;
}

const URL_PATTERNS: UrlPatternMatch[] = [
  {
    pattern: /\/(login|signin|signup|account|dashboard|auth|register|my-account)/i,
    pageType: 'ACCOUNT_AUTH',
    ruleName: 'RULE_URL_MATCH_ACCOUNT_AUTH',
  },
  {
    pattern: /\/(privacy|terms|cookies?|disclaimer|legal|gdpr|policy|tos)/i,
    pageType: 'LEGAL_POLICY',
    ruleName: 'RULE_URL_MATCH_LEGAL_POLICY',
  },
  {
    pattern: /\/(career|job|vacancy|join-our-team|hiring|openings|work-with-us)/i,
    pageType: 'CAREERS_HR',
    ruleName: 'RULE_URL_MATCH_CAREERS_HR',
  },
  {
    pattern: /\/(contact|support|help|faq|customer-service|dealer-locator|enquiry|inquiry)/i,
    pageType: 'SUPPORT_CONTACT',
    ruleName: 'RULE_URL_MATCH_SUPPORT_CONTACT',
  },
  {
    pattern: /\/(about|our-story|company|who-we-are|about-us|team|leadership)/i,
    pageType: 'COMPANY_ABOUT',
    ruleName: 'RULE_URL_MATCH_COMPANY_ABOUT',
  },
  {
    pattern: /\/(blog|news|article|insights|resources|magazine|press|media)/i,
    pageType: 'BLOG_ARTICLE_NEWS',
    ruleName: 'RULE_URL_MATCH_BLOG_ARTICLE_NEWS',
  },
  {
    pattern: /\/(pricing|plans|rates|quote|subscription|packages|cost)/i,
    pageType: 'PRICING_PLANS',
    ruleName: 'RULE_URL_MATCH_PRICING_PLANS',
  },
  {
    pattern: /\/(guide|tutorial|whitepaper|ebook|documentation|docs|manual|handbook)/i,
    pageType: 'RESOURCE_GUIDE_DOC',
    ruleName: 'RULE_URL_MATCH_RESOURCE_GUIDE_DOC',
  },
  {
    pattern: /\/(landing|campaign|promo|offer|special|lp|get-started)/i,
    pageType: 'LANDING_CAMPAIGN',
    ruleName: 'RULE_URL_MATCH_LANDING_CAMPAIGN',
  },
];

const TRANSACTIONAL_KEYWORDS = /\b(buy|order|price|cost|quote|near me|book|purchase|shop|checkout|add to cart)\b/i;
const COMMERCIAL_RESEARCH_KEYWORDS = /\b(best|vs|compare|top|review|alternative|comparison|rated)\b/i;
const CATEGORY_COLLECTION_KEYWORDS = /\b(category|categories|solutions|use cases|products|services|collection)\b/i;

function matchesAny(text: string, patterns: string[]): boolean {
  const lowerText = text.toLowerCase();
  return patterns.some((pattern) => lowerText.includes(pattern.toLowerCase()));
}

function classifyPageType(
  row: PageRow,
  config: PageClassificationConfig
): { pageType: PageTypeValue; confidence: ClassificationConfidenceValue; firedRules: string[] } {
  const firedRules: string[] = [];
  const urlLower = row.pageUrl.toLowerCase();

  for (const urlPattern of URL_PATTERNS) {
    if (urlPattern.pattern.test(urlLower)) {
      firedRules.push(urlPattern.ruleName);
      return { pageType: urlPattern.pageType, confidence: 'HIGH', firedRules };
    }
  }

  const haystack = [
    row.pageUrl,
    row.keyword || '',
    row.pageTitle || '',
    row.pageSnippet || '',
  ]
    .join(' ')
    .toLowerCase();

  if (matchesAny(haystack, config.productKeywords) || matchesAny(haystack, config.serviceKeywords)) {
    firedRules.push('RULE_CONTENT_MATCH_PRODUCT_SERVICE');
    return { pageType: 'PRODUCT_SERVICE', confidence: 'MEDIUM', firedRules };
  }

  if (matchesAny(haystack, config.blogMarkers)) {
    firedRules.push('RULE_CONTENT_MATCH_BLOG_ARTICLE');
    return { pageType: 'BLOG_ARTICLE_NEWS', confidence: 'MEDIUM', firedRules };
  }

  if (CATEGORY_COLLECTION_KEYWORDS.test(haystack)) {
    firedRules.push('RULE_CONTENT_MATCH_CATEGORY_COLLECTION');
    return { pageType: 'CATEGORY_COLLECTION', confidence: 'MEDIUM', firedRules };
  }

  firedRules.push('RULE_FALLBACK_OTHER_MISC');
  return { pageType: 'OTHER_MISC', confidence: 'LOW', firedRules };
}

function classifyPageIntent(
  row: PageRow,
  pageType: PageTypeValue,
  config: PageClassificationConfig
): { pageIntent: PageClassificationIntent; firedRules: string[] } {
  const firedRules: string[] = [];
  const keywordLower = (row.keyword || '').toLowerCase();

  const isBrandOnly = config.brandNames.some((brand) => {
    const brandLower = brand.toLowerCase();
    return (
      keywordLower === brandLower ||
      keywordLower === `${brandLower} website` ||
      keywordLower === `${brandLower}.com` ||
      keywordLower === `${brandLower} official`
    );
  });

  if (isBrandOnly) {
    firedRules.push('RULE_INTENT_NAVIGATIONAL_BRAND');
    return { pageIntent: 'NAVIGATIONAL', firedRules };
  }

  if (TRANSACTIONAL_KEYWORDS.test(keywordLower) || pageType === 'PRICING_PLANS') {
    firedRules.push('RULE_INTENT_TRANSACTIONAL');
    return { pageIntent: 'TRANSACTIONAL', firedRules };
  }

  if (pageType === 'PRODUCT_SERVICE' || pageType === 'LANDING_CAMPAIGN') {
    if (COMMERCIAL_RESEARCH_KEYWORDS.test(keywordLower)) {
      firedRules.push('RULE_INTENT_COMMERCIAL_RESEARCH');
      return { pageIntent: 'COMMERCIAL_RESEARCH', firedRules };
    }
    firedRules.push('RULE_INTENT_TRANSACTIONAL_FROM_PRODUCT');
    return { pageIntent: 'TRANSACTIONAL', firedRules };
  }

  if (pageType === 'BLOG_ARTICLE_NEWS' || pageType === 'RESOURCE_GUIDE_DOC') {
    firedRules.push('RULE_INTENT_INFORMATIONAL_FROM_CONTENT');
    return { pageIntent: 'INFORMATIONAL', firedRules };
  }

  if (pageType === 'SUPPORT_CONTACT') {
    firedRules.push('RULE_INTENT_SUPPORT');
    return { pageIntent: 'SUPPORT', firedRules };
  }

  if (pageType === 'LEGAL_POLICY' || pageType === 'ACCOUNT_AUTH') {
    firedRules.push('RULE_INTENT_IRRELEVANT_SEO');
    return { pageIntent: 'IRRELEVANT_SEO', firedRules };
  }

  firedRules.push('RULE_INTENT_FALLBACK_INFORMATIONAL');
  return { pageIntent: 'INFORMATIONAL', firedRules };
}

function determineIsSeoRelevant(
  pageType: PageTypeValue,
  pageIntent: PageClassificationIntent
): boolean {
  if (pageIntent === 'IRRELEVANT_SEO') return false;
  if (['LEGAL_POLICY', 'ACCOUNT_AUTH', 'CAREERS_HR'].includes(pageType)) return false;
  return true;
}

function determineSeoAction(
  pageType: PageTypeValue,
  pageIntent: PageClassificationIntent,
  isSeoRelevant: boolean,
  estTraffic: number | null
): { seoAction: SeoActionValue; firedRules: string[] } {
  const firedRules: string[] = [];
  const traffic = estTraffic ?? 0;
  const HIGH_TRAFFIC_THRESHOLD = 1000;

  if (!isSeoRelevant) {
    firedRules.push('RULE_ACTION_IGNORE_IRRELEVANT');
    return { seoAction: 'IGNORE_IRRELEVANT', firedRules };
  }

  const isCommercialPage = ['PRODUCT_SERVICE', 'PRICING_PLANS', 'LANDING_CAMPAIGN'].includes(pageType);
  const isCommercialIntent = ['COMMERCIAL_RESEARCH', 'TRANSACTIONAL'].includes(pageIntent);

  if (isCommercialPage && isCommercialIntent && traffic >= HIGH_TRAFFIC_THRESHOLD) {
    firedRules.push('RULE_ACTION_HIGH_PRIORITY_TARGET');
    return { seoAction: 'HIGH_PRIORITY_TARGET', firedRules };
  }

  if (['BLOG_ARTICLE_NEWS', 'RESOURCE_GUIDE_DOC', 'CATEGORY_COLLECTION'].includes(pageType)) {
    firedRules.push('RULE_ACTION_ADD_TO_CONTENT_CLUSTER');
    return { seoAction: 'ADD_TO_CONTENT_CLUSTER', firedRules };
  }

  if (isCommercialPage && traffic < HIGH_TRAFFIC_THRESHOLD) {
    firedRules.push('RULE_ACTION_MONITOR_ONLY');
    return { seoAction: 'MONITOR_ONLY', firedRules };
  }

  firedRules.push('RULE_ACTION_FALLBACK_MONITOR');
  return { seoAction: 'MONITOR_ONLY', firedRules };
}

function buildReasoningString(
  pageType: PageTypeValue,
  pageIntent: PageClassificationIntent,
  seoAction: SeoActionValue,
  firedRules: string[],
  estTraffic: number | null
): string {
  const parts: string[] = [];

  const pageTypeRule = firedRules.find((r) => r.includes('MATCH') || r.includes('FALLBACK'));
  if (pageTypeRule?.includes('URL_MATCH')) {
    parts.push(`Classified as ${pageType} based on URL pattern matching.`);
  } else if (pageTypeRule?.includes('CONTENT_MATCH')) {
    parts.push(`Classified as ${pageType} based on content/keyword analysis.`);
  } else {
    parts.push(`Classified as ${pageType} (fallback - no strong pattern match).`);
  }

  const intentRule = firedRules.find((r) => r.includes('INTENT'));
  if (intentRule) {
    if (intentRule.includes('TRANSACTIONAL')) {
      parts.push(`Intent set to ${pageIntent} due to transactional signals or page type.`);
    } else if (intentRule.includes('COMMERCIAL')) {
      parts.push(`Intent set to ${pageIntent} based on comparison/research keywords.`);
    } else if (intentRule.includes('NAVIGATIONAL')) {
      parts.push(`Intent set to ${pageIntent} as keyword is brand-focused.`);
    } else if (intentRule.includes('INFORMATIONAL')) {
      parts.push(`Intent set to ${pageIntent} based on educational content signals.`);
    } else {
      parts.push(`Intent set to ${pageIntent}.`);
    }
  }

  const actionRule = firedRules.find((r) => r.includes('ACTION'));
  if (actionRule) {
    if (seoAction === 'HIGH_PRIORITY_TARGET') {
      parts.push(
        `Marked as ${seoAction} due to high estimated traffic (${estTraffic}) and strong commercial intent.`
      );
    } else if (seoAction === 'ADD_TO_CONTENT_CLUSTER') {
      parts.push(`Recommended action: ${seoAction} - useful supporting content for topic clusters.`);
    } else if (seoAction === 'IGNORE_IRRELEVANT') {
      parts.push(`Action: ${seoAction} - page has no SEO impact.`);
    } else {
      parts.push(`Action: ${seoAction}.`);
    }
  }

  return parts.join(' ');
}

export function classifyPageWithRules(
  row: PageRow,
  config: PageClassificationConfig
): RuleClassificationResult {
  const allFiredRules: string[] = [];

  const { pageType, confidence, firedRules: typeFiredRules } = classifyPageType(row, config);
  allFiredRules.push(...typeFiredRules);

  const { pageIntent, firedRules: intentFiredRules } = classifyPageIntent(row, pageType, config);
  allFiredRules.push(...intentFiredRules);

  const isSeoRelevant = determineIsSeoRelevant(pageType, pageIntent);

  const estTraffic = row.estTraffic ?? row.etv ?? null;
  const { seoAction, firedRules: actionFiredRules } = determineSeoAction(
    pageType,
    pageIntent,
    isSeoRelevant,
    estTraffic
  );
  allFiredRules.push(...actionFiredRules);

  const needsAiReview = pageType === 'OTHER_MISC' || confidence === 'LOW';

  const reasoning = buildReasoningString(pageType, pageIntent, seoAction, allFiredRules, estTraffic);

  return {
    pageType,
    pageIntent,
    isSeoRelevant,
    classificationMethod: 'RULE',
    classificationConfidence: confidence,
    needsAiReview,
    seoAction,
    explanation: {
      source: 'RULE',
      firedRules: allFiredRules,
      reasoning,
      inputs: {
        pageUrl: row.pageUrl,
        keyword: row.keyword || null,
        pageTitle: row.pageTitle || null,
        pageSnippet: row.pageSnippet || null,
        configSnapshot: config,
      },
    },
  };
}
