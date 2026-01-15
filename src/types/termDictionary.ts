export type TermBucket = 'include' | 'exclude' | 'brand' | 'review';
export type NgramType = 'unigram' | 'bigram' | 'trigram';
export type TermSource = 'user' | 'ai' | 'system';

export interface TermEntry {
    term: string;
    ngramType: NgramType;
    freq: number;
    bucket?: TermBucket;
    source: TermSource;
    confidence: number;
    locked: boolean;
    examples?: string[];
    history?: {
        bucket: TermBucket;
        timestamp: string;
        source: TermSource;
    }[];
}

export interface ClientTermDictionary {
    version: number;
    updatedAt: string;
    domain: string;
    industryKey: string;
    terms: TermEntry[];
}

export interface GlobalIndustryTerm {
    term: string;
    ngramType: NgramType;
    bucket: TermBucket;
    supportCount: number; // How many clients use this classification
    globalConfidence: number;
    lastSeenAt: string;
}

export interface GlobalIndustryDictionary {
    industryKey: string;
    version: number;
    updatedAt: string;
    terms: GlobalIndustryTerm[];
}

export interface AiKwBuilderState {
    isOpen: boolean;
    activeBucket: TermBucket | null;
    filters: {
        ngram: NgramType[];
        minFreq: number;
        search: string;
        showUnassignedOnly: boolean;
    };
    terms: TermEntry[];
}
