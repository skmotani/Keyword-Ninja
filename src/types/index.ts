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
  serviceName: string;
  serviceType: 'SEO_DATA' | 'ANALYTICS' | 'OTHER';
  apiKey: string;
  apiSecret?: string;
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
  locationCode: string;
  sourceApi: string;
  snapshotDate: string;
  lastPulledAt: string;
}
