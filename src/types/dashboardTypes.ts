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
    | 'keyword-opportunity-matrix'
    | 'brand-keywords-matrix'
    | 'top20-include-buy'
    | 'top20-include-learn'
    | 'competitor-balloon'
    | 'client-business'
    | 'home-page'
    | 'top3-surfaces-by-category'
    | 'custom'
    | 'manual';

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
    // Data source information - displayed on query card
    sourceInfo?: {
        tables: string[];   // e.g. ["clients.json", "domain_keywords.json"]
        page?: string;      // Page name where data can be viewed
        pageUrl?: string;   // URL path to the source page
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

// Q010 - Keyword Opportunity Matrix Data
// Combines ranking position bands (Top/Medium/Low) with volume percentile buckets (High/Low)
export type RankBucket = 'Top' | 'Medium' | 'Low';
export type VolumeBucket = 'High' | 'Low';
export type OpportunityType =
    | 'Core Assets'           // Top + High: Maintain, don't lose position
    | 'Doing Nothing'         // Top + Low: Stable, no action
    | 'Low-Hanging Fruit'     // Medium + High: Priority opportunity
    | 'Second Priority'       // Medium + Low: Secondary opportunity
    | 'Long-Term Opportunity' // Low + High: Tough but worth it
    | 'Can Ignore';           // Low + Low: Deprioritize
export type PriorityLevel = 'Critical' | 'Very High' | 'Medium-High' | 'Medium' | 'Low' | 'None';

export interface KeywordOpportunityMatrixData {
    summary: {
        coreAssets: number;           // Top + High
        doingNothing: number;         // Top + Low
        lowHangingFruit: number;      // Medium + High
        secondPriority: number;       // Medium + Low
        longTermOpportunity: number;  // Low + High
        canIgnore: number;            // Low + Low
        total: number;
    };
    p30Threshold: number;  // Volume threshold for High/Low bucket (top 30%)
    volumeRange?: { min: number; max: number };  // Actual volume range in data
    keywords: {
        keyword: string;
        domain: string;
        domainType?: string;  // 'Self' or 'Main Competitor'
        location: string;
        position: number;
        volume: number;
        rankBucket: RankBucket;
        volumeBucket: VolumeBucket;
        opportunityType: OpportunityType;
        priorityLevel: PriorityLevel;
        description: string;
    }[];
}

// Q011: Brand Power Report - Compare brand strength across domains
export interface BrandPowerData {
    summary: {
        totalDomains: number;
        totalBrandKeywords: number;
        totalBrandVolume: number;
    };
    domains: {
        domain: string;
        domainType: 'Self' | 'Main Competitor';
        brandName: string;
        favicon?: string | null;
        brandKeywordCount: number;
        totalBrandVolume: number;
        keywords: {
            keyword: string;
            location: string;
            position: number;
            volume: number;
        }[];
    }[];
}

// MANUAL_001: Top 20 Include|Buy Keywords with combined IN+GL volume and Self positions
export interface Top20IncludeBuyData {
    keywords: {
        rank: number;
        keyword: string;
        bucket: string;           // 'Include | Buy'
        totalVolume: number;      // Combined IN + GL volume
        volumeIN: number;         // India volume
        volumeGL: number;         // Global volume
        selfPosIN: number | null; // Client domain position in India
        selfPosGL: number | null; // Client domain position in Global
    }[];
    summary: {
        totalIncludeBuyKeywords: number;
        selfDomainsCount: number;
    };
}

// MANUAL_002: Top 20 Include|Learn Keywords
export interface Top20IncludeLearnData {
    keywords: {
        rank: number;
        keyword: string;
        bucket: string;           // 'Include | Learn'
        totalVolume: number;      // Combined IN + GL volume
        volumeIN: number;         // India volume
        volumeGL: number;         // Global volume
        selfPosIN: number | null; // Client domain position in India
        selfPosGL: number | null; // Client domain position in Global
    }[];
    summary: {
        totalIncludeLearnKeywords: number;
        selfDomainsCount: number;
    };
}



// Q001: Client Business Data
export interface ClientBusinessData {
    businessOverview: {
        summary: string;
        businessModel: string;
        industry: string;
    };
    productMarket: {
        products: string[];
        segments: string[];
        geographies: string[];
    };
    assets: {
        brandPhotos: string[];
    };
    domains: {
        domain: string;
        cleanDomain: string;
        organicTraffic: number;
        organicKeywords: number;
        source: string;
    }[];
}

// Q012: You Vs Competitor Balloon Data
export interface CompetitorBalloonData {
    summary: {
        totalMainCompetitors: number;
        yourTrafficShare: number;
    };
    balloons: {
        domain: string;
        brandName: string;
        logo: string | null;
        traffic: number;
        etv: number;
        age: number | null;
        isSelf: boolean;
    }[];
}

// Q011: Brand ETV Comparison Data
export interface BrandETVData {
    note: string;
    self: {
        brandName: string;
        logo: string | null;
        totalETV: number;
        domainsCount: number;
    };
    topCompetitor: {
        brandName: string;
        logo: string | null;
        totalETV: number;
        domainsCount: number;
    };
    chasers?: {
        rank: number;
        brandName: string;
        favicon: string | null;
        etv: number;
    }[];
}

// MANUAL_003: Home Page Data
export interface HomePageData {
    clientName: string;
    clientLogo: string | null;
    appName: string;
    appLogo: string | null;
    tagline: string | null;
    punchline: string | null;
}

// MANUAL_004: Top 3 Surfaces by Category (from Footprint Registry)
export interface Top3SurfacesByCategoryData {
    categories: {
        category: string;
        categoryLabel: string;
        surfaces: {
            label: string;
            importance: string;  // 'Critical', 'High', 'Medium', 'Low'
            points: number;
            whyItMatters: string;
        }[];
    }[];
    summary: {
        totalCategories: number;
        totalSurfaces: number;
        totalPoints: number;
    };
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
    data: KeywordBalloonData[] | DomainInfo | ClientRankingsData | KeywordsAbsenceData | CompetitorGlobalData | MarketSizeData | ETVComparisonData | KeywordOpportunityMatrixData | BrandPowerData | Top20IncludeBuyData | Top20IncludeLearnData | CompetitorBalloonData | ClientBusinessData | HomePageData | Top3SurfacesByCategoryData | unknown;
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

