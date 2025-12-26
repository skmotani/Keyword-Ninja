export interface CuratedKeyword {
    id: string;
    clientCode: string;
    keyword: string;
    source: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ClientPosition {
    id: string;
    clientCode: string;
    keywordOrTheme: string;
    currentPosition?: string;
    competitor?: string;
    source: string;
    notes?: string;
    asOfDate: string; // ISO Date "YYYY-MM-DD"
    createdAt: string;
    updatedAt: string;
}
