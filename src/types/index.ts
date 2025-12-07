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

export interface Competitor {
  id: string;
  clientCode: string;
  name: string;
  domain: string;
  notes?: string;
  isActive: boolean;
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
}
