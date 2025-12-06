export interface Client {
  id: string;
  code: string;
  name: string;
  mainDomain: string;
  notes?: string;
  isActive: boolean;
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
  competitionIndex: number | null;
  competitionLevel: string | null;
  monthlySearches: MonthlySearch[] | null;
  locationCode: string;
  sourceApi: string;
  snapshotDate: string;
  lastPulledAt: string;
  rawApiResponse?: string;
}

export interface MonthlySearch {
  year: number;
  month: number;
  searchVolume: number;
}

export interface DataForSEOKeywordResult {
  keyword: string;
  search_volume: number | null;
  cpc: number | null;
  competition: number | null;
  competition_level: string | null;
  monthly_searches: Array<{
    year: number;
    month: number;
    search_volume: number;
  }> | null;
}
