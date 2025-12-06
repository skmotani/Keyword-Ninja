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
