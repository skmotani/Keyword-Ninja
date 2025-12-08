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

function parseUrlPath(pageUrl: string): { pathname: string; segments: string[] } {
  try {
    const url = new URL(pageUrl);
    const pathname = url.pathname.toLowerCase();
    const segments = pathname.split('/').filter(Boolean);
    return { pathname, segments };
  } catch {
    const pathname = pageUrl.toLowerCase().replace(/^https?:\/\/[^\/]+/, '');
    const segments = pathname.split('/').filter(Boolean);
    return { pathname, segments };
  }
}

function isHomepage(pageUrl: string): boolean {
  const { pathname, segments } = parseUrlPath(pageUrl);
  if (segments.length === 0) return true;
  if (pathname === '/' || pathname === '') return true;
  if (segments.length === 1 && (segments[0] === 'index.html' || segments[0] === 'index.htm' || segments[0] === 'home')) return true;
  return false;
}

function matchesAnyPattern(text: string, patterns: string[]): { matched: boolean; matchedPattern: string | null } {
  const lowerText = text.toLowerCase();
  for (const pattern of patterns) {
    if (lowerText.includes(pattern.toLowerCase())) {
      return { matched: true, matchedPattern: pattern };
    }
  }
  return { matched: false, matchedPattern: null };
}

function matchesAnySegment(segments: string[], patterns: string[]): { matched: boolean; matchedPattern: string | null; matchedSegment: string | null } {
  for (const segment of segments) {
    const segmentLower = segment.toLowerCase();
    for (const pattern of patterns) {
      if (segmentLower === pattern.toLowerCase() || segmentLower.includes(pattern.toLowerCase())) {
        return { matched: true, matchedPattern: pattern, matchedSegment: segment };
      }
    }
  }
  return { matched: false, matchedPattern: null, matchedSegment: null };
}

function isPdfOrDocument(pageUrl: string): boolean {
  const lowerUrl = pageUrl.toLowerCase();
  return lowerUrl.endsWith('.pdf') || 
         lowerUrl.endsWith('.doc') || 
         lowerUrl.endsWith('.docx') || 
         lowerUrl.endsWith('.xls') || 
         lowerUrl.endsWith('.xlsx');
}

interface ClassifyPageTypeResult {
  pageType: PageTypeValue;
  confidence: ClassificationConfidenceValue;
  firedRules: string[];
  matchDetails?: string;
}

function classifyPageType(
  row: PageRow,
  config: PageClassificationConfig
): ClassifyPageTypeResult {
  const firedRules: string[] = [];
  const { pathname, segments } = parseUrlPath(row.pageUrl);

  const accountResult = matchesAnySegment(segments, config.accountSlugPatterns);
  if (accountResult.matched) {
    firedRules.push('RULE_URL_ACCOUNT_AUTH');
    return { 
      pageType: 'ACCOUNT_AUTH', 
      confidence: 'HIGH', 
      firedRules,
      matchDetails: `Matched account pattern "${accountResult.matchedPattern}" in segment "${accountResult.matchedSegment}"`
    };
  }

  const legalResult = matchesAnySegment(segments, config.legalSlugPatterns);
  if (legalResult.matched) {
    firedRules.push('RULE_URL_LEGAL_POLICY');
    return { 
      pageType: 'LEGAL_POLICY', 
      confidence: 'HIGH', 
      firedRules,
      matchDetails: `Matched legal pattern "${legalResult.matchedPattern}" in segment "${legalResult.matchedSegment}"`
    };
  }

  const careersResult = matchesAnySegment(segments, config.careersSlugPatterns);
  if (careersResult.matched) {
    firedRules.push('RULE_URL_CAREERS_HR');
    return { 
      pageType: 'CAREERS_HR', 
      confidence: 'HIGH', 
      firedRules,
      matchDetails: `Matched careers pattern "${careersResult.matchedPattern}" in segment "${careersResult.matchedSegment}"`
    };
  }

  const supportResult = matchesAnySegment(segments, config.supportSlugPatterns);
  if (supportResult.matched) {
    firedRules.push('RULE_URL_SUPPORT_CONTACT');
    return { 
      pageType: 'SUPPORT_CONTACT', 
      confidence: 'HIGH', 
      firedRules,
      matchDetails: `Matched support pattern "${supportResult.matchedPattern}" in segment "${supportResult.matchedSegment}"`
    };
  }

  if (isHomepage(row.pageUrl)) {
    firedRules.push('RULE_HOMEPAGE_DETECTED');
    return { 
      pageType: 'COMPANY_ABOUT', 
      confidence: 'HIGH', 
      firedRules,
      matchDetails: 'Root URL detected as homepage'
    };
  }

  const aboutResult = matchesAnySegment(segments, config.aboutCompanySlugPatterns);
  if (aboutResult.matched) {
    firedRules.push('RULE_URL_COMPANY_ABOUT');
    return { 
      pageType: 'COMPANY_ABOUT', 
      confidence: 'HIGH', 
      firedRules,
      matchDetails: `Matched about/company pattern "${aboutResult.matchedPattern}" in segment "${aboutResult.matchedSegment}"`
    };
  }

  const productResult = matchesAnySegment(segments, config.productSlugPatterns);
  if (productResult.matched) {
    firedRules.push('RULE_URL_PRODUCT_SERVICE');
    return { 
      pageType: 'PRODUCT_SERVICE', 
      confidence: 'HIGH', 
      firedRules,
      matchDetails: `Matched product pattern "${productResult.matchedPattern}" in segment "${productResult.matchedSegment}"`
    };
  }

  const categoryResult = matchesAnySegment(segments, config.categorySlugPatterns);
  if (categoryResult.matched) {
    firedRules.push('RULE_URL_CATEGORY_COLLECTION');
    return { 
      pageType: 'CATEGORY_COLLECTION', 
      confidence: 'HIGH', 
      firedRules,
      matchDetails: `Matched category pattern "${categoryResult.matchedPattern}" in segment "${categoryResult.matchedSegment}"`
    };
  }

  const blogResult = matchesAnySegment(segments, config.blogSlugPatterns);
  if (blogResult.matched) {
    firedRules.push('RULE_URL_BLOG_ARTICLE_NEWS');
    return { 
      pageType: 'BLOG_ARTICLE_NEWS', 
      confidence: 'HIGH', 
      firedRules,
      matchDetails: `Matched blog pattern "${blogResult.matchedPattern}" in segment "${blogResult.matchedSegment}"`
    };
  }

  if (isPdfOrDocument(row.pageUrl)) {
    firedRules.push('RULE_URL_DOCUMENT_EXTENSION');
    return { 
      pageType: 'RESOURCE_GUIDE_DOC', 
      confidence: 'HIGH', 
      firedRules,
      matchDetails: 'Document file extension detected (.pdf, .doc, etc.)'
    };
  }

  const resourceResult = matchesAnySegment(segments, config.resourceSlugPatterns);
  if (resourceResult.matched) {
    firedRules.push('RULE_URL_RESOURCE_GUIDE_DOC');
    return { 
      pageType: 'RESOURCE_GUIDE_DOC', 
      confidence: 'HIGH', 
      firedRules,
      matchDetails: `Matched resource pattern "${resourceResult.matchedPattern}" in segment "${resourceResult.matchedSegment}"`
    };
  }

  const pricingPatterns = ['pricing', 'plans', 'rates', 'quote', 'subscription', 'packages', 'cost'];
  const pricingResult = matchesAnySegment(segments, pricingPatterns);
  if (pricingResult.matched) {
    firedRules.push('RULE_URL_PRICING_PLANS');
    return { 
      pageType: 'PRICING_PLANS', 
      confidence: 'HIGH', 
      firedRules,
      matchDetails: `Matched pricing pattern "${pricingResult.matchedPattern}" in segment "${pricingResult.matchedSegment}"`
    };
  }

  const landingResult = matchesAnySegment(segments, config.marketingLandingPatterns);
  if (landingResult.matched) {
    firedRules.push('RULE_URL_LANDING_CAMPAIGN');
    return { 
      pageType: 'LANDING_CAMPAIGN', 
      confidence: 'HIGH', 
      firedRules,
      matchDetails: `Matched landing/campaign pattern "${landingResult.matchedPattern}" in segment "${landingResult.matchedSegment}"`
    };
  }

  const haystack = [
    row.pageUrl,
    row.keyword || '',
    row.pageTitle || '',
    row.pageSnippet || '',
  ].join(' ').toLowerCase();

  const productContentResult = matchesAnyPattern(haystack, config.productKeywords);
  if (productContentResult.matched) {
    firedRules.push('RULE_CONTENT_PRODUCT_SERVICE');
    return { 
      pageType: 'PRODUCT_SERVICE', 
      confidence: 'MEDIUM', 
      firedRules,
      matchDetails: `Content matched product keyword "${productContentResult.matchedPattern}"`
    };
  }

  const serviceContentResult = matchesAnyPattern(haystack, config.serviceKeywords);
  if (serviceContentResult.matched) {
    firedRules.push('RULE_CONTENT_SERVICE');
    return { 
      pageType: 'PRODUCT_SERVICE', 
      confidence: 'MEDIUM', 
      firedRules,
      matchDetails: `Content matched service keyword "${serviceContentResult.matchedPattern}"`
    };
  }

  const blogContentResult = matchesAnyPattern(haystack, config.blogMarkers);
  if (blogContentResult.matched) {
    firedRules.push('RULE_CONTENT_BLOG_ARTICLE');
    return { 
      pageType: 'BLOG_ARTICLE_NEWS', 
      confidence: 'MEDIUM', 
      firedRules,
      matchDetails: `Content matched blog marker "${blogContentResult.matchedPattern}"`
    };
  }

  const categoryKeywords = /\b(category|categories|solutions|use cases|products|services|collection|industry|industries)\b/i;
  if (categoryKeywords.test(haystack)) {
    firedRules.push('RULE_CONTENT_CATEGORY_COLLECTION');
    return { 
      pageType: 'CATEGORY_COLLECTION', 
      confidence: 'MEDIUM', 
      firedRules,
      matchDetails: 'Content matched category/collection keywords'
    };
  }

  firedRules.push('RULE_FALLBACK_OTHER_MISC');
  return { 
    pageType: 'OTHER_MISC', 
    confidence: 'LOW', 
    firedRules,
    matchDetails: 'No patterns matched - falling back to OTHER_MISC'
  };
}

const TRANSACTIONAL_KEYWORDS = /\b(buy|order|price|cost|quote|near me|book|purchase|shop|checkout|add to cart)\b/i;
const COMMERCIAL_RESEARCH_KEYWORDS = /\b(best|vs|compare|top|review|alternative|comparison|rated)\b/i;

function classifyPageIntent(
  row: PageRow,
  pageType: PageTypeValue,
  config: PageClassificationConfig,
  isHomepagePage: boolean
): { pageIntent: PageClassificationIntent; firedRules: string[] } {
  const firedRules: string[] = [];
  const keywordLower = (row.keyword || '').toLowerCase();

  if (isHomepagePage) {
    firedRules.push('RULE_INTENT_NAVIGATIONAL_HOMEPAGE');
    return { pageIntent: 'NAVIGATIONAL', firedRules };
  }

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

  if (pageType === 'CATEGORY_COLLECTION') {
    firedRules.push('RULE_INTENT_COMMERCIAL_FROM_CATEGORY');
    return { pageIntent: 'COMMERCIAL_RESEARCH', firedRules };
  }

  if (pageType === 'SUPPORT_CONTACT') {
    firedRules.push('RULE_INTENT_SUPPORT');
    return { pageIntent: 'SUPPORT', firedRules };
  }

  if (pageType === 'COMPANY_ABOUT') {
    firedRules.push('RULE_INTENT_NAVIGATIONAL_COMPANY');
    return { pageIntent: 'NAVIGATIONAL', firedRules };
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
  pageIntent: PageClassificationIntent,
  isHomepagePage: boolean
): boolean {
  if (pageIntent === 'IRRELEVANT_SEO') return false;
  if (['LEGAL_POLICY', 'ACCOUNT_AUTH', 'CAREERS_HR'].includes(pageType)) return false;
  if (isHomepagePage) return true;
  return true;
}

function determineSeoAction(
  pageType: PageTypeValue,
  pageIntent: PageClassificationIntent,
  isSeoRelevant: boolean,
  estTraffic: number | null,
  isHomepagePage: boolean
): { seoAction: SeoActionValue; firedRules: string[] } {
  const firedRules: string[] = [];
  const traffic = estTraffic ?? 0;
  const HIGH_TRAFFIC_THRESHOLD = 1000;

  if (!isSeoRelevant) {
    firedRules.push('RULE_ACTION_IGNORE_IRRELEVANT');
    return { seoAction: 'IGNORE_IRRELEVANT', firedRules };
  }

  if (isHomepagePage) {
    firedRules.push('RULE_ACTION_MONITOR_HOMEPAGE');
    return { seoAction: 'MONITOR_ONLY', firedRules };
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

  if (pageType === 'COMPANY_ABOUT') {
    firedRules.push('RULE_ACTION_MONITOR_COMPANY');
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
  estTraffic: number | null,
  matchDetails?: string
): string {
  const parts: string[] = [];

  if (matchDetails) {
    parts.push(matchDetails + '.');
  }

  const pageTypeRule = firedRules.find((r) => r.includes('URL_') || r.includes('CONTENT_') || r.includes('HOMEPAGE') || r.includes('FALLBACK'));
  if (pageTypeRule) {
    if (pageTypeRule.includes('HOMEPAGE')) {
      parts.push(`Classified as ${pageType} because this is the homepage (root URL).`);
    } else if (pageTypeRule.includes('URL_')) {
      parts.push(`Classified as ${pageType} based on URL path pattern matching.`);
    } else if (pageTypeRule.includes('CONTENT_')) {
      parts.push(`Classified as ${pageType} based on content/keyword analysis.`);
    } else if (pageTypeRule.includes('FALLBACK')) {
      parts.push(`Classified as ${pageType} (fallback - no strong pattern match).`);
    }
  }

  const intentRule = firedRules.find((r) => r.includes('INTENT'));
  if (intentRule) {
    if (intentRule.includes('HOMEPAGE')) {
      parts.push(`Intent: ${pageIntent} - homepage is typically navigational.`);
    } else if (intentRule.includes('TRANSACTIONAL')) {
      parts.push(`Intent: ${pageIntent} due to transactional signals or commercial page type.`);
    } else if (intentRule.includes('COMMERCIAL')) {
      parts.push(`Intent: ${pageIntent} based on comparison/research context.`);
    } else if (intentRule.includes('NAVIGATIONAL')) {
      parts.push(`Intent: ${pageIntent} as keyword is brand-focused or navigational.`);
    } else if (intentRule.includes('INFORMATIONAL')) {
      parts.push(`Intent: ${pageIntent} based on educational content signals.`);
    } else {
      parts.push(`Intent: ${pageIntent}.`);
    }
  }

  const actionRule = firedRules.find((r) => r.includes('ACTION'));
  if (actionRule) {
    if (seoAction === 'HIGH_PRIORITY_TARGET') {
      parts.push(
        `Action: ${seoAction} - high traffic (${estTraffic}) with strong commercial intent.`
      );
    } else if (seoAction === 'ADD_TO_CONTENT_CLUSTER') {
      parts.push(`Action: ${seoAction} - useful supporting content for topic clusters.`);
    } else if (seoAction === 'IGNORE_IRRELEVANT') {
      parts.push(`Action: ${seoAction} - page has no SEO impact.`);
    } else if (seoAction === 'MONITOR_ONLY') {
      parts.push(`Action: ${seoAction} - track but not priority for content strategy.`);
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

  const isHomepagePage = isHomepage(row.pageUrl);

  const { pageType, confidence, firedRules: typeFiredRules, matchDetails } = classifyPageType(row, config);
  allFiredRules.push(...typeFiredRules);

  const { pageIntent, firedRules: intentFiredRules } = classifyPageIntent(row, pageType, config, isHomepagePage);
  allFiredRules.push(...intentFiredRules);

  const isSeoRelevant = determineIsSeoRelevant(pageType, pageIntent, isHomepagePage);

  const estTraffic = row.estTraffic ?? row.etv ?? null;
  const { seoAction, firedRules: actionFiredRules } = determineSeoAction(
    pageType,
    pageIntent,
    isSeoRelevant,
    estTraffic,
    isHomepagePage
  );
  allFiredRules.push(...actionFiredRules);

  const needsAiReview = pageType === 'OTHER_MISC' || confidence === 'LOW';

  const reasoning = buildReasoningString(pageType, pageIntent, seoAction, allFiredRules, estTraffic, matchDetails);

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
