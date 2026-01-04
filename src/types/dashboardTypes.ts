// Dashboard Query Types

// Query severity/status levels
export type QueryStatus = 'Critical' | 'Warning' | 'Info' | 'Success';

// Query group for organizing related queries
export interface QueryGroup {
    id: string;
    name: string;
    description: string;
    order: number;
    createdAt: string;
    updatedAt: string;
}

// Extended query types for new queries
export type QueryType =
    | 'keyword-volume'
    | 'domain-info'
    | 'client-rankings'
    | 'keywords-absence'
    | 'competitor-global'
    | 'market-size'
    | 'etv-comparison'
    | 'custom';

// Query definition - static template for a query
export interface DashboardQueryDefinition {
    id: string;           // Unique ID like "Q001", "Q002"
    queryNumber: string;  // Display number like "1.1", "2.3"
    groupId: string;      // Reference to QueryGroup
    title: string;
    description: string;
    tooltip?: string;     // Purpose and calculation method
    status: QueryStatus;
    queryType: QueryType;
    config: {
        location?: 'india' | 'global' | 'both';
        limit?: number;
        [key: string]: unknown;
    };
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

// Data structure for balloon visualization
export interface KeywordBalloonData {
    keyword: string;
    volume: number;
    position: number | null;
    location: 'india' | 'global';
}

// Client domain info for display - includes AI profile data
export interface DomainInfo {
    clientName: string;
    clientCode: string;
    mainDomain: string;
    allDomains: string[];
    status: QueryStatus;
    // AI Profile fields
    businessModel?: string;
    shortSummary?: string;
    industryType?: string;
    productLines?: string[];
    targetCustomerSegments?: string[];
    targetGeographies?: string[];
    coreTopics?: string[];
}

// Q005 - Client Rankings Data
export interface ClientRankingsData {
    summary: {
        uniqueTop3India: number;
        uniqueTop3Global: number;
        uniqueTop10India: number;
        uniqueTop10Global: number;
    };
    sampleKeywords: {
        domain: string;
        location: string;
        keyword: string;
        position: number;
        volume: number;
        rankingBucket: 'Top 3' | 'Top 10';
    }[];
}

// Q006 - Keywords Absence Data (from client_positions where rank > 10 or absent)
export interface KeywordsAbsenceData {
    keywords: {
        keyword: string;
        volume: number;
        clientRank: string;  // '>100' = not ranked, or the position number
        location: string;    // 'IN' or 'GL'
    }[];
}

// Q007 - Client Vs Competitor Strength (from /competitors page)
export interface CompetitorGlobalData {
    competitors: {
        name: string;
        domain: string;
        score: number;  // importanceScore from competitors.json
        isClient: boolean;  // true = client domain, false = competitor
    }[];
}

// Q008 - Market Size Data (from domain_keywords.json)
// A) totalMarketVolume = sum of unique keyword search volumes
// B) clientVolume = sum of unique keyword volumes for client domains
// C) clientTraffic = actual traffic received based on CTR model using ranking positions
// D) clientTrafficPercent = clientTraffic / totalMarketVolume * 100
// E) competitors = each competitor's volume and traffic with share %
export interface MarketSizeData {
    totalMarketVolume: number;       // A: Aggregate unique keyword search volume
    clientVolume: number;            // B: Client domains' potential keyword volume
    clientTraffic: number;           // C: Actual traffic using CTR model
    clientTrafficPercent: number;    // D: Traffic % = C/A * 100
    competitors: {                   // E: Competitor breakdown
        domain: string;
        volume: number;
        traffic: number;
        trafficPercent: number;
    }[];
}

// Q009 - ETV Comparison Data (from competitors.json + domain_overview.json)
// Compares Estimated Traffic Value between Self and Main Competitor domains
export interface ETVComparisonData {
    entries: {
        domain: string;
        name: string;
        type: 'Self' | 'Main Competitor';
        etvIndia: number;
        etvGlobal: number;
        etvTotal: number;
        keywordsIndia: number;
        keywordsGlobal: number;
    }[];
}


// Source link for data verification
export interface DataSourceLink {
    label: string;
    href: string;
}

// Result from executing a query
export interface DashboardQueryResult {
    queryId: string;
    clientCode: string;
    title: string;
    status: QueryStatus;
    queryType: string;
    tooltip?: string;
    data: KeywordBalloonData[] | DomainInfo | ClientRankingsData | KeywordsAbsenceData | CompetitorGlobalData | MarketSizeData | unknown;
    executedAt: string;
    error?: string;
    sourceLink?: DataSourceLink;  // Link to source table for verification
}

// Request/Response types for API
export interface ExecuteQueryRequest {
    clientCode: string;
    queryId: string;
}

export interface ExecuteAllQueriesRequest {
    clientCode: string;
    groupId?: string;
}

export interface ExportPdfRequest {
    clientCode: string;
    queryIds: string[];
}

