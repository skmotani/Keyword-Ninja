export interface ClientPositionSerpRecord {
    id: string;
    clientCode: string;
    keyword: string;
    selectedDomain: string;
    source?: string;
    locationType: 'IN' | 'GL';
    rank: number | null; // null for Absent
    searchVolume: number;
    competition: string;
    checkUrl: string;
    lastPulledAt: string;
    createdAt: string;
    updatedAt: string;
    rankLabel?: string; // "1".."50" | ">50" | "ERR"
    rankDomain?: string | null; // which client domain matched bestRank

    // Dynamic columns for top 10 competitors
    c1?: CompetitorSnapshot;
    c2?: CompetitorSnapshot;
    c3?: CompetitorSnapshot;
    c4?: CompetitorSnapshot;
    c5?: CompetitorSnapshot;
    c6?: CompetitorSnapshot;
    c7?: CompetitorSnapshot;
    c8?: CompetitorSnapshot;
    c9?: CompetitorSnapshot;
    c10?: CompetitorSnapshot;
}

export interface CompetitorSnapshot {
    brandLabel: string;
    domain: string;
    url: string;
}

export interface SerpRefreshRequest {
    clientCode: string;
    selectedDomain: string;
    keywords?: string[];
    // Removed legacy fields: refreshScope, locationType, mode
}
