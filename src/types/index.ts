export interface Client {
  id: string;
  code: string;
  name: string;
  mainDomain: string;
  domains: string[];
  notes?: string;
  isActive: boolean;
}

export interface DomainProfile {
  id: string;
  clientCode: string;
  domain: string;
  title: string | null;
  metaDescription: string | null;
  inferredCategory: string | null;
  topKeywords: TopKeywordEntry[];
  organicTraffic: number | null;
  organicKeywordsCount: number | null;
  backlinksCount: number | null;
  referringDomainsCount: number | null;
  domainRank: number | null;
  fetchStatus: 'pending' | 'fetching' | 'success' | 'error';
  errorMessage: string | null;
  lastFetchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TopKeywordEntry {
  keyword: string;
  position: number;
  searchVolume: number | null;
  cpc: number | null;
  url: string | null;
}

export type CompetitorSource = 'Manual Entry' | 'Via SERP Search';

export interface Competitor {
  id: string;
  clientCode: string;
  name: string;
  domain: string;
  notes?: string;
  isActive: boolean;
  source: CompetitorSource;
  importanceScore?: number;
  domainType?: DomainTypeValue;
  pageIntent?: PageIntentValue;
  productMatchScoreValue?: number;
  productMatchScoreBucket?: ProductMatchBucket;
  businessRelevanceCategory?: BusinessRelevanceCategoryValue;
  explanationSummary?: string;
  addedAt?: string;
}

export interface ManualKeyword {
  id: string;
  clientCode: string;
  keywordText: string;
  notes?: string;
  isActive: boolean;
}

export interface ApiCredential {
  id: string;
  userId: string;
  serviceType: 'DATAFORSEO' | 'SEO_SERP' | 'OPENAI' | 'GEMINI' | 'GROK' | 'GSC' | 'CUSTOM';
  authType: 'USERNAME_PASSWORD' | 'API_KEY' | 'OAUTH' | 'CUSTOM';
  username?: string;
  passwordMasked?: string;
  apiKeyMasked?: string;
  customConfig?: string;
  label: string;
  clientCode?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KeywordApiDataRecord {
  id: string;
  clientCode: string;
  keywordText: string;
  normalizedKeyword: string;
  searchVolume: number | null;
  cpc: number | null;
  competition: string | null;
  lowTopOfPageBid: number | null;
  highTopOfPageBid: number | null;
  locationCode: number;
  languageCode: string;
  sourceApi: string;
  snapshotDate: string;
  lastPulledAt: string;
}

export interface DataForSEOKeywordResult {
  keyword: string;
  search_volume: number | null;
  cpc: number | null;
  competition: string | null;
  low_top_of_page_bid: number | null;
  high_top_of_page_bid: number | null;
  location_code: number;
  language_code: string;
}

export interface SerpResult {
  id: string;
  clientCode: string;
  keyword: string;
  locationCode: number;
  languageCode: string;
  rank: number;
  rankAbsolute: number;
  url: string;
  title: string;
  description: string;
  domain: string;
  breadcrumb: string | null;
  isFeaturedSnippet: boolean;
  isImage: boolean;
  isVideo: boolean;
  highlighted: string[];
  etv: number | null;
  estimatedPaidTrafficCost: number | null;
  fetchedAt: string;
}

export interface DomainTypePatterns {
  oemManufacturerIndicators: string[];
  serviceProviderIndicators: string[];
  marketplaceIndicators: string[];
  endCustomerIndicators: string[];
  educationalMediaIndicators: string[];
}

export interface ClassificationIntentHints {
  transactionalKeywords: string[];
  informationalKeywords: string[];
  directoryKeywords: string[];
}

export interface BusinessRelevanceLogicNotes {
  directCompetitorDefinition: string;
  potentialCustomerDefinition: string;
  marketplaceChannelDefinition: string;
  irrelevantDefinition: string;
}

export interface PatternWithExamples {
  description: string;
  examples: string[];
}

export interface ProfileMeta {
  clientName: string;
  generatedAt: string;
  industryTag: string;
  summary: string;
}

export interface ProfileCoreIdentity {
  businessModel: string;
  primaryOfferTypes: string[];
  productLines: string[];
  services: string[];
  industriesServed: string[];
  customerSegments: string[];
}

export interface ProfileDomains {
  primaryDomains: string[];
  secondaryDomains: string[];
  expectedTlds: string[];
  positiveDomainHints: string[];
  negativeDomainHints: string[];
}

export interface ProfileUrlClassificationSupport {
  productSlugPatterns: PatternWithExamples;
  categorySlugPatterns: PatternWithExamples;
  blogSlugPatterns: PatternWithExamples;
  resourceSlugPatterns: PatternWithExamples;
  supportSlugPatterns: PatternWithExamples;
  legalSlugPatterns: PatternWithExamples;
  accountSlugPatterns: PatternWithExamples;
  careersSlugPatterns: PatternWithExamples;
  aboutCompanySlugPatterns: PatternWithExamples;
  marketingLandingPatterns: PatternWithExamples;
}

export interface ProfileKeywordClassificationSupport {
  brandKeywords: PatternWithExamples;
  transactionalPhrases: PatternWithExamples;
  commercialResearchPhrases: PatternWithExamples;
  informationalPhrases: PatternWithExamples;
  directoryPhrases: PatternWithExamples;
  irrelevantKeywordTopics: PatternWithExamples;
}

export interface ProfileBusinessRelevanceSupport {
  directCompetitorDefinition: string;
  potentialCustomerDefinition: string;
  marketplaceDefinition: string;
  irrelevantDefinition: string;
}

export interface ClientAIProfile {
  id: string;
  clientCode: string;
  clientName: string;
  primaryDomains: string[];
  domainsUsedForGeneration: string[];
  industryType: string;
  shortSummary: string;
  businessModel: string;
  productLines: string[];
  targetCustomerSegments: string[];
  targetGeographies: string[];
  coreTopics: string[];
  adjacentTopics: string[];
  negativeTopics: string[];
  domainTypePatterns: DomainTypePatterns;
  classificationIntentHints: ClassificationIntentHints;
  businessRelevanceLogicNotes: BusinessRelevanceLogicNotes;
  generatedAt: string;
  updatedAt: string;
  meta?: ProfileMeta;
  coreIdentity?: ProfileCoreIdentity;
  domains?: ProfileDomains;
  urlClassificationSupport?: ProfileUrlClassificationSupport;
  keywordClassificationSupport?: ProfileKeywordClassificationSupport;
  businessRelevanceSupport?: ProfileBusinessRelevanceSupport;
}

export type DomainTypeValue =
  | 'OEM / Manufacturer / Product Provider'
  | 'Service Provider / Agency / Integrator'
  | 'Marketplace / Directory / Portal'
  | 'End Customer / Buyer Organization'
  | 'Educational / Media / Research'
  | 'Brand / Platform / Corporate Site'
  | 'Irrelevant Industry'
  | 'Unknown';

export type PageIntentValue =
  | 'Transactional'
  | 'Commercial Investigation'
  | 'Informational'
  | 'Directory / Listing'
  | 'Navigational / Brand'
  | 'Irrelevant Intent'
  | 'Unknown';

export type ProductMatchBucket = 'High' | 'Medium' | 'Low' | 'None';

export type BusinessRelevanceCategoryValue =
  | 'Self'
  | 'Direct Competitor'
  | 'Adjacent / Weak Competitor'
  | 'Potential Customer / Lead'
  | 'Marketplace / Channel'
  | 'Service Provider / Partner'
  | 'Educational / Content Only'
  | 'Brand / Navigational Only'
  | 'Irrelevant'
  | 'Needs Manual Review';

export interface DomainClassification {
  id: string;
  clientCode: string;
  domain: string;
  domainType: DomainTypeValue;
  pageIntent: PageIntentValue;
  productMatchScoreValue: number;
  productMatchScoreBucket: ProductMatchBucket;
  businessRelevanceCategory: BusinessRelevanceCategoryValue;
  explanationLink: string;
  explanationSummary: string;
  classifiedAt: string;
  updatedAt: string;
}

export interface DomainOverviewRecord {
  id: string;
  clientCode: string;
  domain: string;
  label: string;
  locationCode: string;
  languageCode: string;
  organicTrafficETV: number | null;
  organicKeywordsCount: number | null;
  fetchedAt: string;
  snapshotDate: string;
}

export type PageTypeValue =
  | 'HOME_PAGE'
  | 'PRODUCT_SERVICE'
  | 'CATEGORY_COLLECTION'
  | 'BLOG_ARTICLE_NEWS'
  | 'RESOURCE_GUIDE_DOC'
  | 'PRICING_PLANS'
  | 'LANDING_CAMPAIGN'
  | 'COMPANY_ABOUT'
  | 'SUPPORT_CONTACT'
  | 'CAREERS_HR'
  | 'LEGAL_POLICY'
  | 'ACCOUNT_AUTH'
  | 'OTHER_MISC';

export type PageClassificationIntent =
  | 'INFORMATIONAL'
  | 'COMMERCIAL_RESEARCH'
  | 'TRANSACTIONAL'
  | 'NAVIGATIONAL'
  | 'SUPPORT'
  | 'IRRELEVANT_SEO';

export type ClassificationMethodValue = 'RULE' | 'AI';

export type ClassificationConfidenceValue = 'HIGH' | 'MEDIUM' | 'LOW';

export type SeoActionValue =
  | 'HIGH_PRIORITY_TARGET'
  | 'CREATE_EQUIVALENT_PAGE'
  | 'OPTIMIZE_EXISTING_PAGE'
  | 'ADD_TO_CONTENT_CLUSTER'
  | 'BACKLINK_PROSPECT'
  | 'MONITOR_ONLY'
  | 'IGNORE_IRRELEVANT';

export type PriorityTier =
  | 'TIER_1_IMMEDIATE'
  | 'TIER_2_HIGH'
  | 'TIER_3_MEDIUM'
  | 'TIER_4_MONITOR'
  | 'TIER_5_IGNORE';

export interface PriorityScoreBreakdown {
  etvScore: number;
  intentScore: number;
  pageTypeScore: number;
  businessRelevanceScore: number;
  etvWeight: number;
  intentWeight: number;
  pageTypeWeight: number;
  businessRelevanceWeight: number;
  rawEtv: number | null;
  maxEtvInDataset: number;
  normalizedEtv: number;
}

export interface ClassificationExplanation {
  source: 'RULE' | 'AI';
  firedRules?: string[];
  reasoning: string;
  inputs: {
    pageUrl: string;
    keyword?: string | null;
    pageTitle?: string | null;
    pageSnippet?: string | null;
    configSnapshot?: PageClassificationConfig;
  };
  model?: string;
  prompt?: Record<string, unknown>;
  rawResponse?: Record<string, unknown>;
}

export interface PageClassificationConfig {
  brandNames: string[];
  productKeywords: string[];
  serviceKeywords: string[];
  blogMarkers: string[];
  nonSeoPathFragments: string[];
  productSlugPatterns: string[];
  categorySlugPatterns: string[];
  blogSlugPatterns: string[];
  resourceSlugPatterns: string[];
  supportSlugPatterns: string[];
  legalSlugPatterns: string[];
  accountSlugPatterns: string[];
  careersSlugPatterns: string[];
  aboutCompanySlugPatterns: string[];
  marketingLandingPatterns: string[];
}

export interface DomainPageRecord {
  id: string;
  clientCode: string;
  domain: string;
  label: string;
  locationCode: string;
  languageCode: string;
  pageURL: string;
  estTrafficETV: number | null;
  keywordsCount: number | null;
  fetchedAt: string;
  snapshotDate: string;
  pageType?: PageTypeValue | null;
  pageIntent?: PageClassificationIntent | null;
  isSeoRelevant?: boolean | null;
  classificationMethod?: ClassificationMethodValue | null;
  classificationConfidence?: ClassificationConfidenceValue | null;
  needsAiReview?: boolean | null;
  seoAction?: SeoActionValue | null;
  classificationExplanation?: ClassificationExplanation | null;
  priorityScore?: number | null;
  priorityTier?: PriorityTier | null;
  priorityScoreBreakdown?: PriorityScoreBreakdown | null;
  priorityCalculatedAt?: string | null;
  matchedProduct?: string | null;
  clusterName?: string | null;
  productClassifiedAt?: string | null;
}

export interface DomainKeywordRecord {
  id: string;
  clientCode: string;
  domain: string;
  label: string;
  locationCode: string;
  languageCode: string;
  keyword: string;
  position: number | null;
  searchVolume: number | null;
  cpc: number | null;
  url: string | null;
  fetchedAt: string;
  snapshotDate: string;
}
