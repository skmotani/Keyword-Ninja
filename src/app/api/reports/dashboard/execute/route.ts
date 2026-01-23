import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getQueryById } from '@/lib/storage/dashboardQueryStore';
import {
    DashboardQueryResult,
    KeywordBalloonData,
    DomainInfo,
    DataSourceLink,
    ClientRankingsData,
    KeywordsAbsenceData,
    CompetitorGlobalData,
    MarketSizeData,
    ETVComparisonData,
    KeywordOpportunityMatrixData,
    BrandPowerData,
    Top20IncludeBuyData,
    Top20IncludeLearnData,
    RankBucket,
    VolumeBucket,
    OpportunityType,
    PriorityLevel,
    CompetitorBalloonData,
    ClientBusinessData,
    HomePageData,
    ExecuteQueryRequest,
    DashboardQueryDefinition
} from '@/types/dashboardTypes';
import { Client, KeywordApiDataRecord, ClientAIProfile, DomainKeywordRecord, Competitor } from '@/types';
import { readClientSerpData } from '@/lib/clientSerpStore';
import { getKeywordApiDataByClientAndLocations } from '@/lib/keywordApiStore';
import { readTags, normalizeKeyword } from '@/lib/keywordTagsStore';
import { getCredibilityByClientAndLocation, getCredibilityByClient } from '@/lib/storage/domainCredibilityStore';


const DATA_DIR = path.join(process.cwd(), 'data');

// Location code mappings
const LOCATION_CODES: Record<string, number> = {
    india: 2356,
    global: 2840,
};

// Location code strings used in domain_keywords.json
const INDIA_LOCATION_CODES = ['IN', '2356'];
const GLOBAL_LOCATION_CODES = ['GL', '2840'];

const LOCATION_CODE_TO_NAME: Record<string, string> = {
    'IN': 'India',
    '2356': 'India',
    'GL': 'Global',
    '2840': 'Global',
};

// CTR model based on position
// Using midpoint values from user's CTR table
function getCTR(position: number): number {
    if (position <= 0 || position > 100) return 0;
    if (position === 1) return 0.30;  // 28-35% → ~30%
    if (position === 2) return 0.175; // 15-20% → 17.5%
    if (position === 3) return 0.12;  // 10-14% → 12%
    if (position === 4) return 0.08;  // 7-9% → 8%
    if (position === 5) return 0.06;  // 5-7% → 6%
    if (position === 6) return 0.04;  // 3.5-4.5% → 4%
    if (position === 7) return 0.03;  // 2.5-3.5% → 3%
    if (position === 8) return 0.02;  // 1.8-2.5% → 2%
    if (position === 9) return 0.015; // 1.2-1.8% → 1.5%
    if (position === 10) return 0.01; // 0.8-1.2% → 1%
    if (position <= 15) return 0.005; // 0.4-0.7% → 0.5%
    if (position <= 20) return 0.003; // 0.2-0.4% → 0.3%
    if (position <= 30) return 0.001; // 0.05-0.15% → 0.1%
    if (position <= 50) return 0.0003; // 0.01-0.05% → 0.03%
    return 0; // 51-100: ~0%
}

// Helper: Read clients data
async function readClients(): Promise<Client[]> {
    try {
        const filePath = path.join(DATA_DIR, 'clients.json');
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as Client[];
    } catch {
        return [];
    }
}

// Helper: Read AI profiles
async function readAiProfiles(): Promise<ClientAIProfile[]> {
    try {
        const filePath = path.join(DATA_DIR, 'client_ai_profiles.json');
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as ClientAIProfile[];
    } catch {
        return [];
    }
}

// Helper: Read keyword API data
async function readKeywordApiData(): Promise<KeywordApiDataRecord[]> {
    try {
        const filePath = path.join(DATA_DIR, 'keyword_api_data.json');
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as KeywordApiDataRecord[];
    } catch {
        return [];
    }
}

// Helper: Read domain keywords
async function readDomainKeywords(): Promise<DomainKeywordRecord[]> {
    try {
        const filePath = path.join(DATA_DIR, 'domain_keywords.json');
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as DomainKeywordRecord[];
    } catch {
        return [];
    }
}

// Helper: Read competitors
async function readCompetitors(): Promise<Competitor[]> {
    try {
        const filePath = path.join(DATA_DIR, 'competitors.json');
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as Competitor[];
    } catch {
        return [];
    }
}

// Domain Overview record from domain_overview.json
interface DomainOverviewRecord {
    id: string;
    clientCode: string;
    domain: string;
    locationCode: string;
    organicTrafficETV: number | null;
    organicKeywordsCount: number | null;
}

// Helper: Read domain overview
async function readDomainOverview(): Promise<DomainOverviewRecord[]> {
    try {
        const filePath = path.join(DATA_DIR, 'domain_overview.json');
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as DomainOverviewRecord[];
    } catch {
        return [];
    }
}

// Client Position record from client_positions.json
interface ClientPositionRecord {
    id: string;
    clientCode: string;
    keywordOrTheme: string;
    currentPosition: string;  // '-' means not ranked / absent
    source: string;
    asOfDate: string;
}

// Helper: Read client positions (for client-rank page data)
async function readClientPositions(): Promise<ClientPositionRecord[]> {
    try {
        const filePath = path.join(DATA_DIR, 'client_positions.json');
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as ClientPositionRecord[];
    } catch {
        return [];
    }
}

// Execute domain-info query - includes AI Profile data
async function executeDomainInfoQuery(clientCode: string): Promise<DomainInfo> {
    const clients = await readClients();
    const client = clients.find(c => c.code === clientCode);

    if (!client) {
        throw new Error(`Client not found: ${clientCode}`);
    }

    const profiles = await readAiProfiles();
    const aiProfile = profiles.find(p => p.clientCode === clientCode);

    return {
        clientName: client.name,
        clientCode: client.code,
        mainDomain: client.mainDomain,
        allDomains: client.domains || [client.mainDomain],
        status: 'Critical',
        businessModel: aiProfile?.businessModel,
        shortSummary: aiProfile?.shortSummary,
        industryType: aiProfile?.industryType,
        productLines: aiProfile?.productLines,
        targetCustomerSegments: aiProfile?.targetCustomerSegments,
        targetGeographies: aiProfile?.targetGeographies,
        coreTopics: aiProfile?.coreTopics,
    };
}

// Execute keyword-volume query
async function executeKeywordVolumeQuery(
    clientCode: string,
    config: { location?: string; limit?: number }
): Promise<KeywordBalloonData[]> {
    const allKeywords = await readKeywordApiData();
    const limit = config.limit || 10;

    let clientKeywords = allKeywords.filter(k => k.clientCode === clientCode);

    if (config.location === 'india') {
        clientKeywords = clientKeywords.filter(k => k.locationCode === LOCATION_CODES.india);
    } else if (config.location === 'global') {
        clientKeywords = clientKeywords.filter(k => k.locationCode === LOCATION_CODES.global);
    }

    clientKeywords.sort((a, b) => (b.searchVolume || 0) - (a.searchVolume || 0));
    const topKeywords = clientKeywords.slice(0, limit);

    return topKeywords.map(k => ({
        keyword: k.keywordText,
        volume: k.searchVolume || 0,
        position: null,
        location: k.locationCode === LOCATION_CODES.india ? 'india' : 'global',
    }));
}

// Helper: Normalize domain for matching (removes www., https://, http://)
function normalizeDomain(domain: string): string {
    return domain
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '');
}

// Q005: Execute client-rankings query
// Data source: domain_keywords.json
// Top 3: position 1-3, Top 10: position 4-10 (separate buckets)
async function executeClientRankingsQuery(clientCode: string): Promise<ClientRankingsData> {
    const domainKeywords = await readDomainKeywords();
    const clients = await readClients();
    const client = clients.find(c => c.code === clientCode);

    if (!client) {
        throw new Error(`Client not found: ${clientCode}`);
    }

    // Build normalized set of client's own domains
    const rawDomains = [client.mainDomain, ...(client.domains || [])];
    const normalizedClientDomains = new Set(rawDomains.map(d => normalizeDomain(d)));

    // Filter to client's OWN domains only (not competitors)
    // Uses normalized matching to handle www.domain.com vs domain.com
    const clientKws = domainKeywords.filter(k =>
        k.clientCode === clientCode &&
        normalizedClientDomains.has(normalizeDomain(k.domain)) &&
        k.position !== null &&
        k.position >= 1 &&
        k.position <= 10
    );

    // Count unique keywords by location and position bucket
    const indiaTop3 = new Set<string>();  // pos 1-3
    const globalTop3 = new Set<string>(); // pos 1-3
    const indiaTop10 = new Set<string>(); // pos 4-10
    const globalTop10 = new Set<string>(); // pos 4-10

    // Collect all qualifying keywords for sorting
    const allQualifyingKeywords: {
        domain: string;
        location: string;
        keyword: string;
        position: number;
        volume: number;
        rankingBucket: 'Top 3' | 'Top 10';
    }[] = [];

    for (const kw of clientKws) {
        const pos = kw.position!;
        const normalizedKw = kw.keyword.toLowerCase();
        const isIndia = INDIA_LOCATION_CODES.includes(kw.locationCode);
        const locationName = LOCATION_CODE_TO_NAME[kw.locationCode] || kw.locationCode;

        // Top 3 bucket: position 1-3
        if (pos >= 1 && pos <= 3) {
            if (isIndia) indiaTop3.add(normalizedKw);
            else globalTop3.add(normalizedKw);

            allQualifyingKeywords.push({
                domain: kw.domain,
                location: locationName,
                keyword: kw.keyword,
                position: pos,
                volume: kw.searchVolume || 0,
                rankingBucket: 'Top 3',
            });
        }
        // Top 10 bucket: position 4-10 only
        else if (pos >= 4 && pos <= 10) {
            if (isIndia) indiaTop10.add(normalizedKw);
            else globalTop10.add(normalizedKw);

            allQualifyingKeywords.push({
                domain: kw.domain,
                location: locationName,
                keyword: kw.keyword,
                position: pos,
                volume: kw.searchVolume || 0,
                rankingBucket: 'Top 10',
            });
        }
    }

    // Separate by location for balanced representation
    const indiaKeywords = allQualifyingKeywords.filter(k => k.location === 'India');
    const globalKeywords = allQualifyingKeywords.filter(k => k.location === 'Global');

    // Sort each by volume descending
    indiaKeywords.sort((a, b) => b.volume - a.volume);
    globalKeywords.sort((a, b) => b.volume - a.volume);

    // Take top 5 from each location for balanced representation
    const top5India = indiaKeywords.slice(0, 5);
    const top5Global = globalKeywords.slice(0, 5);
    const balancedTop10 = [...top5India, ...top5Global].sort((a, b) => b.volume - a.volume);

    return {
        summary: {
            uniqueTop3India: indiaTop3.size,
            uniqueTop3Global: globalTop3.size,
            uniqueTop10India: indiaTop10.size,
            uniqueTop10Global: globalTop10.size,
        },
        sampleKeywords: balancedTop10,
    };
}

// Q006: Execute keywords-absence query
// Data source: clientSerpStore (same as /curated/client-rank page)
// Filter: rank > 10 OR rank is null (not ranked)
// Output: Top 10 keywords sorted by volume DESC
async function executeKeywordsAbsenceQuery(
    clientCode: string,
    config: { limit?: number }
): Promise<KeywordsAbsenceData> {
    // Get client domains for rank calculation
    const clients = await readClients();
    const client = clients.find(c => c.code === clientCode);
    if (!client) {
        return { keywords: [] };
    }

    const rawClientDomains = client.domains || (client.mainDomain ? [client.mainDomain] : []);
    const normalizeDomainLocal = (url: string): string => {
        if (!url) return '';
        let domain = url.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '');
        domain = domain.split('/')[0].split(':')[0];
        return domain.toLowerCase();
    };
    const clientDomainsNorm = rawClientDomains.map((d: string) => normalizeDomainLocal(d));

    // Get SERP data and keyword API data
    const [serpData, apiData] = await Promise.all([
        readClientSerpData(clientCode),
        getKeywordApiDataByClientAndLocations(clientCode, [2356, 2840])
    ]);

    const keywords = serpData.keywords || [];

    // Create metadata lookup: key = locationCode_keywordLower
    const metaMap = new Map<string, { searchVolume: number | null }>();
    for (const rec of apiData) {
        const key = `${rec.locationCode}_${rec.keywordText.trim().toLowerCase()}`;
        metaMap.set(key, { searchVolume: rec.searchVolume });
    }

    // Process keywords and find those where rank > 10 or not ranked
    const results: KeywordsAbsenceData['keywords'] = [];

    for (const k of keywords) {
        const kLower = k.keyword.trim().toLowerCase();

        // Check India location
        if (k.serp?.IN) {
            const inResults = k.serp.IN.results || [];
            let rank: number | null = null;

            // Find client's rank in SERP
            for (const item of inResults) {
                const norm = normalizeDomainLocal(item.domain || item.url);
                if (clientDomainsNorm.some((cd: string) => norm === cd || norm.endsWith('.' + cd))) {
                    if (rank === null || item.rank_group < rank) {
                        rank = item.rank_group;
                    }
                }
            }

            // Include if rank > 10 or not ranked
            if (rank === null || rank > 10) {
                const meta = metaMap.get(`2356_${kLower}`);
                results.push({
                    keyword: k.keyword,
                    volume: meta?.searchVolume || 0,
                    clientRank: rank === null ? '>100' : String(rank),
                    location: 'IN',
                });
            }
        }

        // Check Global location
        if (k.serp?.GL) {
            const glResults = k.serp.GL.results || [];
            let rank: number | null = null;

            // Find client's rank in SERP
            for (const item of glResults) {
                const norm = normalizeDomainLocal(item.domain || item.url);
                if (clientDomainsNorm.some((cd: string) => norm === cd || norm.endsWith('.' + cd))) {
                    if (rank === null || item.rank_group < rank) {
                        rank = item.rank_group;
                    }
                }
            }

            // Include if rank > 10 or not ranked
            if (rank === null || rank > 10) {
                const meta = metaMap.get(`2840_${kLower}`);
                results.push({
                    keyword: k.keyword,
                    volume: meta?.searchVolume || 0,
                    clientRank: rank === null ? '>100' : String(rank),
                    location: 'GL',
                });
            }
        }
    }

    // Sort by volume descending and take top N
    results.sort((a, b) => b.volume - a.volume);
    const limit = config.limit || 10;

    return {
        keywords: results.slice(0, limit),
    };
}
// Q007: Execute Client Vs Competitor Strength query
// Data source: competitors.json (same as /competitors page)
// Output: Client domains (Self) + Top 5 Main Competitors by score
async function executeCompetitorGlobalQuery(
    clientCode: string,
    config: { limit?: number }
): Promise<CompetitorGlobalData> {
    const competitors = await readCompetitors();

    const result: CompetitorGlobalData['competitors'] = [];

    // Add client domains (competitionType = "Self") with their actual score
    const selfEntries = competitors.filter(
        c => c.clientCode === clientCode &&
            c.competitionType === 'Self' &&
            c.isActive
    );
    // Sort Self entries by score descending
    selfEntries.sort((a, b) => (b.importanceScore || 0) - (a.importanceScore || 0));

    for (const entry of selfEntries) {
        result.push({
            name: entry.name,
            domain: entry.domain,
            score: Math.round(entry.importanceScore || 0),  // Integer only
            isClient: true,
        });
    }

    // Filter to Main Competitors only
    const mainCompetitors = competitors.filter(
        c => c.clientCode === clientCode &&
            c.competitionType === 'Main Competitor' &&
            c.isActive
    );

    // Sort by importance score descending
    mainCompetitors.sort((a, b) => (b.importanceScore || 0) - (a.importanceScore || 0));

    // Take top N competitors and add to result
    const limit = config.limit || 5;
    for (const comp of mainCompetitors.slice(0, limit)) {
        result.push({
            name: comp.name,
            domain: comp.domain,
            score: Math.round(comp.importanceScore || 0),  // Integer only
            isClient: false,
        });
    }

    return { competitors: result };
}
// Q008: Execute market-size query
// Data source: domain_keywords.json
// Formula with CTR Model:
// A) totalMarketVolume = sum of unique keyword search volumes
// B) clientVolume = sum of unique keyword volumes for client domains
// C) clientTraffic = sum of (volume × CTR(position)) for client domains
// D) clientTrafficPercent = clientTraffic / totalMarketVolume * 100
// E) competitors = each competitor's volume and traffic using CTR
async function executeMarketSizeQuery(
    clientCode: string,
    config: { limit?: number }
): Promise<MarketSizeData> {
    const domainKeywords = await readDomainKeywords();
    const competitors = await readCompetitors();

    // Get client domains (from competitors where type = "Self")
    const selfEntries = competitors.filter(
        c => c.clientCode === clientCode && c.competitionType === 'Self'
    );
    const clientDomains = new Set(selfEntries.map(c => c.domain.toLowerCase()));

    // Get main competitors
    const mainCompetitors = competitors.filter(
        c => c.clientCode === clientCode &&
            c.competitionType === 'Main Competitor' &&
            c.isActive
    );

    // Step A: Calculate total unique keyword search volume
    const allKeywords = domainKeywords.filter(k => k.clientCode === clientCode);
    const uniqueKeywordVolumes = new Map<string, number>();

    for (const kw of allKeywords) {
        const key = kw.keyword.toLowerCase().trim();
        const existing = uniqueKeywordVolumes.get(key) || 0;
        if ((kw.searchVolume || 0) > existing) {
            uniqueKeywordVolumes.set(key, kw.searchVolume || 0);
        }
    }

    const totalMarketVolume = Array.from(uniqueKeywordVolumes.values()).reduce((sum, v) => sum + v, 0);

    // Step B & C: Calculate client volume and traffic using CTR model
    // For each unique keyword, find client's best position and calculate traffic
    const clientKeywordData = new Map<string, { volume: number; position: number | null }>();

    for (const kw of allKeywords) {
        if (clientDomains.has(kw.domain.toLowerCase())) {
            const key = kw.keyword.toLowerCase().trim();
            const existing = clientKeywordData.get(key);
            if (!existing) {
                clientKeywordData.set(key, {
                    volume: kw.searchVolume || 0,
                    position: kw.position
                });
            } else {
                // Keep highest volume
                if ((kw.searchVolume || 0) > existing.volume) {
                    existing.volume = kw.searchVolume || 0;
                }
                // Keep best (lowest) position
                if (kw.position !== null && (existing.position === null || kw.position < existing.position)) {
                    existing.position = kw.position;
                }
            }
        }
    }

    let clientVolume = 0;
    let clientTraffic = 0;
    for (const data of Array.from(clientKeywordData.values())) {
        clientVolume += data.volume;
        if (data.position !== null && data.position > 0) {
            clientTraffic += Math.round(data.volume * getCTR(data.position));
        }
    }

    // Step D: Calculate client traffic percent
    const clientTrafficPercent = totalMarketVolume > 0
        ? parseFloat(((clientTraffic / totalMarketVolume) * 100).toFixed(2))
        : 0;

    // Step E: Calculate each competitor's volume and traffic
    const competitorResults: MarketSizeData['competitors'] = [];

    for (const comp of mainCompetitors.slice(0, config.limit || 5)) {
        const compDomain = comp.domain.toLowerCase();
        const compKeywordData = new Map<string, { volume: number; position: number | null }>();

        for (const kw of allKeywords) {
            if (kw.domain.toLowerCase() === compDomain) {
                const key = kw.keyword.toLowerCase().trim();
                const existing = compKeywordData.get(key);
                if (!existing) {
                    compKeywordData.set(key, {
                        volume: kw.searchVolume || 0,
                        position: kw.position
                    });
                } else {
                    if ((kw.searchVolume || 0) > existing.volume) {
                        existing.volume = kw.searchVolume || 0;
                    }
                    if (kw.position !== null && (existing.position === null || kw.position < existing.position)) {
                        existing.position = kw.position;
                    }
                }
            }
        }

        let compVolume = 0;
        let compTraffic = 0;
        for (const data of Array.from(compKeywordData.values())) {
            compVolume += data.volume;
            if (data.position !== null && data.position > 0) {
                compTraffic += Math.round(data.volume * getCTR(data.position));
            }
        }

        const compTrafficPercent = totalMarketVolume > 0
            ? parseFloat(((compTraffic / totalMarketVolume) * 100).toFixed(2))
            : 0;

        competitorResults.push({
            domain: comp.domain,
            volume: compVolume,
            traffic: compTraffic,
            trafficPercent: compTrafficPercent,
        });
    }

    // Sort competitors by traffic descending
    competitorResults.sort((a, b) => b.traffic - a.traffic);

    return {
        totalMarketVolume,
        clientVolume,
        clientTraffic,
        clientTrafficPercent,
        competitors: competitorResults,
    };
}

// Q009: Execute ETV Comparison query
// Data source: competitors.json + domain_overview.json
// Compares ETV between Self and Main Competitor domains
async function executeETVComparisonQuery(
    clientCode: string,
    config: { limit?: number }
): Promise<ETVComparisonData> {
    const competitors = await readCompetitors();
    const domainOverview = await readDomainOverview();

    // Filter to Self and Main Competitor only for this client
    const relevantCompetitors = competitors.filter(
        c => c.clientCode === clientCode &&
            (c.competitionType === 'Self' || c.competitionType === 'Main Competitor') &&
            c.isActive
    );

    // Build domain lookup from domain_overview
    const overviewByDomain = new Map<string, { india: DomainOverviewRecord | null; global: DomainOverviewRecord | null }>();

    for (const ov of domainOverview.filter(o => o.clientCode === clientCode)) {
        const normalizedDomain = normalizeDomain(ov.domain);
        if (!overviewByDomain.has(normalizedDomain)) {
            overviewByDomain.set(normalizedDomain, { india: null, global: null });
        }
        const entry = overviewByDomain.get(normalizedDomain)!;
        if (ov.locationCode === 'IN') {
            entry.india = ov;
        } else if (ov.locationCode === 'GL') {
            entry.global = ov;
        }
    }

    // Build result entries, deduplicating by normalized domain
    const entries: ETVComparisonData['entries'] = [];
    const seenDomains = new Set<string>();

    for (const comp of relevantCompetitors) {
        const normalizedDomain = normalizeDomain(comp.domain);

        // Skip duplicate domains
        if (seenDomains.has(normalizedDomain)) continue;
        seenDomains.add(normalizedDomain);

        const overview = overviewByDomain.get(normalizedDomain);

        const etvIndia = overview?.india?.organicTrafficETV || 0;
        const etvGlobal = overview?.global?.organicTrafficETV || 0;
        const keywordsIndia = overview?.india?.organicKeywordsCount || 0;
        const keywordsGlobal = overview?.global?.organicKeywordsCount || 0;

        entries.push({
            domain: comp.domain,
            name: comp.name,
            type: comp.competitionType as 'Self' | 'Main Competitor',
            etvIndia: Math.round(etvIndia * 100) / 100,
            etvGlobal: Math.round(etvGlobal * 100) / 100,
            etvTotal: Math.round((etvIndia + etvGlobal) * 100) / 100,
            keywordsIndia: keywordsIndia,
            keywordsGlobal: keywordsGlobal,
        });
    }

    // Sort by ETV Total descending, Self entries first
    entries.sort((a, b) => {
        if (a.type === 'Self' && b.type !== 'Self') return -1;
        if (a.type !== 'Self' && b.type === 'Self') return 1;
        return b.etvTotal - a.etvTotal;
    });

    // Apply limit
    const limit = config.limit || 10;

    return { entries: entries.slice(0, limit) };
}

// Q010: Execute Keyword Opportunity Matrix query
// Data source: domain_keywords.json + competitors.json + AI Profile term dictionary
// Includes keywords from Self + Main Competitor domains
// Filter: Only keywords containing terms with bucket = 'include' from AI Keyword Builder
// Rank Buckets: Top (1-10), Medium (11-30), Low (>30)
// Volume Buckets: High (Top 30% >= P30), Low (Bottom 70% < P30)
async function executeKeywordOpportunityMatrixQuery(
    clientCode: string,
    config: { limit?: number }
): Promise<KeywordOpportunityMatrixData> {
    const domainKeywords = await readDomainKeywords();
    const competitors = await readCompetitors();
    const aiProfiles = await readAiProfiles();

    // Get AI profile and term dictionary
    const profile = aiProfiles.find(p => p.clientCode === clientCode);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const termDictionary = (profile as any)?.ai_kw_builder_term_dictionary as { terms?: Array<{ term: string; bucket?: string }> } | undefined;
    const terms = termDictionary?.terms || [];

    // Build sets of terms by bucket for lookup
    const includeTerms = new Set(
        terms.filter(t => t.bucket === 'include').map(t => t.term.toLowerCase().trim())
    );
    const brandTerms = new Set(
        terms.filter(t => t.bucket === 'brand').map(t => t.term.toLowerCase().trim())
    );

    // Get ALL relevant domains: Self + Main Competitors
    const relevantCompetitors = competitors.filter(
        c => c.clientCode === clientCode &&
            (c.competitionType === 'Self' || c.competitionType === 'Main Competitor') &&
            c.isActive
    );

    // ALSO add brandNames from Competitor Master to brandTerms
    for (const comp of relevantCompetitors) {
        const compBrandNames = comp.brandNames || [];
        for (const bn of compBrandNames) {
            if (bn && bn.trim()) {
                brandTerms.add(bn.toLowerCase().trim());
            }
        }
    }

    // Helper to check if keyword contains any term from a bucket
    const keywordMatchesBucket = (keyword: string, bucketTerms: Set<string>): boolean => {
        const kwLower = keyword.toLowerCase().trim();
        const termsArray = Array.from(bucketTerms);
        for (const term of termsArray) {
            // Check if keyword contains the term as a word/phrase
            if (kwLower.includes(term)) return true;
        }
        return false;
    };

    if (relevantCompetitors.length === 0 || includeTerms.size === 0) {
        return {
            summary: {
                coreAssets: 0, doingNothing: 0, lowHangingFruit: 0,
                secondPriority: 0, longTermOpportunity: 0, canIgnore: 0, total: 0
            },
            p30Threshold: 0,
            volumeRange: { min: 0, max: 0 },
            keywords: []
        };
    }

    // Build normalized set of ALL domains (Self + Main Competitors)
    const allDomains = new Set(
        relevantCompetitors.map(c => normalizeDomain(c.domain))
    );

    // Filter to keywords from ALL relevant domains with position data
    // AND only keywords that contain at least one 'include' bucket term
    // AND NOT containing any 'brand' bucket term
    const allKws = domainKeywords.filter(k => {
        if (k.clientCode !== clientCode) return false;
        if (!allDomains.has(normalizeDomain(k.domain))) return false;
        if (k.position === null || k.position <= 0) return false;

        // Check if keyword matches include bucket and not brand bucket
        const matchesInclude = keywordMatchesBucket(k.keyword, includeTerms);
        const matchesBrand = keywordMatchesBucket(k.keyword, brandTerms);

        return matchesInclude && !matchesBrand;
    });

    // Calculate P30 threshold for volume bucket (top 30%)
    const volumes = allKws
        .map(k => k.searchVolume || 0)
        .filter(v => v > 0)
        .sort((a, b) => b - a); // Sort descending for top percentile

    const p30Index = Math.floor(volumes.length * 0.30);
    const p30Threshold = volumes[p30Index] || 0;
    const volumeMax = volumes[0] || 0;
    const volumeMin = volumes[volumes.length - 1] || 0;

    // Helper functions with new definitions
    const getRankBucket = (position: number): RankBucket => {
        if (position <= 10) return 'Top';
        if (position <= 30) return 'Medium';
        return 'Low';
    };

    const getOpportunityType = (rank: RankBucket, volume: VolumeBucket): OpportunityType => {
        if (rank === 'Top' && volume === 'High') return 'Core Assets';
        if (rank === 'Top' && volume === 'Low') return 'Doing Nothing';
        if (rank === 'Medium' && volume === 'High') return 'Low-Hanging Fruit';
        if (rank === 'Medium' && volume === 'Low') return 'Second Priority';
        if (rank === 'Low' && volume === 'High') return 'Long-Term Opportunity';
        return 'Can Ignore';
    };

    const getPriorityLevel = (type: OpportunityType): PriorityLevel => {
        const priorities: Record<OpportunityType, PriorityLevel> = {
            'Core Assets': 'Critical',
            'Doing Nothing': 'Low',
            'Low-Hanging Fruit': 'Very High',
            'Second Priority': 'Medium',
            'Long-Term Opportunity': 'Medium-High',
            'Can Ignore': 'None'
        };
        return priorities[type];
    };

    const getDescription = (type: OpportunityType): string => {
        const descriptions: Record<OpportunityType, string> = {
            'Core Assets': 'Maintain, watchful - don\'t lose position',
            'Doing Nothing': 'Stable, no action needed',
            'Low-Hanging Fruit': 'Priority opportunity!',
            'Second Priority': 'Opportunity of 2nd priority',
            'Long-Term Opportunity': 'Tough but worth pursuing',
            'Can Ignore': 'Deprioritize'
        };
        return descriptions[type];
    };

    // Build domain type lookup (Self vs Competitor)
    const domainTypeMap = new Map<string, string>();
    for (const comp of relevantCompetitors) {
        domainTypeMap.set(normalizeDomain(comp.domain), comp.competitionType || 'Unknown');
    }

    // Classify all keywords
    const classifiedKeywords: KeywordOpportunityMatrixData['keywords'] = [];
    const summary = {
        coreAssets: 0,
        doingNothing: 0,
        lowHangingFruit: 0,
        secondPriority: 0,
        longTermOpportunity: 0,
        canIgnore: 0,
        total: 0
    };

    for (const kw of allKws) {
        const position = kw.position!;
        const volume = kw.searchVolume || 0;
        const rankBucket = getRankBucket(position);
        const volumeBucket: VolumeBucket = volume >= p30Threshold ? 'High' : 'Low';
        const opportunityType = getOpportunityType(rankBucket, volumeBucket);
        const priorityLevel = getPriorityLevel(opportunityType);
        const locationName = LOCATION_CODE_TO_NAME[kw.locationCode] || kw.locationCode;
        const domainType = domainTypeMap.get(normalizeDomain(kw.domain)) || 'Unknown';

        // Update summary counts
        summary.total++;
        switch (opportunityType) {
            case 'Core Assets': summary.coreAssets++; break;
            case 'Doing Nothing': summary.doingNothing++; break;
            case 'Low-Hanging Fruit': summary.lowHangingFruit++; break;
            case 'Second Priority': summary.secondPriority++; break;
            case 'Long-Term Opportunity': summary.longTermOpportunity++; break;
            case 'Can Ignore': summary.canIgnore++; break;
        }

        classifiedKeywords.push({
            keyword: kw.keyword,
            domain: kw.domain,
            domainType, // 'Self' or 'Main Competitor'
            location: locationName,
            position,
            volume,
            rankBucket,
            volumeBucket,
            opportunityType,
            priorityLevel,
            description: getDescription(opportunityType)
        });
    }

    // Sort by volume descending within each bucket
    classifiedKeywords.sort((a, b) => b.volume - a.volume);

    // Limit results per bucket
    const limit = config.limit || 50;

    return {
        summary,
        p30Threshold,
        volumeRange: { min: volumeMin, max: volumeMax },
        keywords: classifiedKeywords.slice(0, limit * 6) // Allow more keywords
    };
}

// Q011: Execute Brand Power Report query
// Data source: domain_keywords.json + competitors.json + AI Profile term dictionary
// Groups brand keywords by domain to show brand power comparison
async function executeBrandKeywordsMatrixQuery(
    clientCode: string,
    config: { limit?: number }
): Promise<BrandPowerData> {
    const domainKeywords = await readDomainKeywords();
    const competitors = await readCompetitors();
    const aiProfiles = await readAiProfiles();

    // Get AI profile and term dictionary
    const profile = aiProfiles.find(p => p.clientCode === clientCode);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const termDictionary = (profile as any)?.ai_kw_builder_term_dictionary as { terms?: Array<{ term: string; bucket?: string }> } | undefined;
    const terms = termDictionary?.terms || [];

    // Build set of brand terms from AI term dictionary
    const brandTerms = new Set(
        terms.filter(t => t.bucket === 'brand').map(t => t.term.toLowerCase().trim())
    );

    // Build exclude terms set
    const excludeTerms = new Set(
        terms.filter(t => t.bucket && (t.bucket.toLowerCase() === 'exclude' || t.bucket.toLowerCase().includes('noise')))
            .map(t => t.term.toLowerCase().trim())
    );

    // Get ALL relevant domains: Self + Main Competitors
    const relevantCompetitors = competitors.filter(
        c => c.clientCode === clientCode &&
            (c.competitionType === 'Self' || c.competitionType === 'Main Competitor') &&
            c.isActive
    );

    // ALSO add brandNames from Competitor Master to brandTerms
    for (const comp of relevantCompetitors) {
        const compBrandNames = comp.brandNames || [];
        for (const bn of compBrandNames) {
            if (bn && bn.trim()) {
                brandTerms.add(bn.toLowerCase().trim());
            }
        }
    }

    // SANITIZE EXCLUDE TERMS:
    // If a term is in both Brand and Exclude, Brand must win to prevent nuking valid brand keywords.
    // Example: if "meera" is in exclude (mistake), it would hide "meera industries".
    // We remove any exclude term that is also a brand term.
    const sanitizedExcludeTerms = new Set<string>();
    for (const term of Array.from(excludeTerms)) {
        if (!brandTerms.has(term)) {
            sanitizedExcludeTerms.add(term);
        }
    }

    // Helper to check if keyword contains any brand term
    const keywordMatchesBrand = (keyword: string): boolean => {
        const kwLower = keyword.toLowerCase().trim();
        const termsArray = Array.from(brandTerms);
        const excludeArray = Array.from(sanitizedExcludeTerms);

        // Check Exclusions First
        for (const term of excludeArray) {
            if (kwLower.includes(term)) return false;
        }

        // Check Brand match
        for (const term of termsArray) {
            if (kwLower.includes(term)) return true;
        }
        return false;
    };

    if (relevantCompetitors.length === 0 || brandTerms.size === 0) {
        return {
            summary: {
                totalDomains: 0,
                totalBrandKeywords: 0,
                totalBrandVolume: 0
            },
            domains: []
        };
    }

    // Build domain info lookup (domain -> { type, brandName, favicon })
    const domainInfoMap = new Map<string, { type: 'Self' | 'Main Competitor'; brandName: string; favicon?: string | null }>();
    for (const comp of relevantCompetitors) {
        const normalizedDomain = normalizeDomain(comp.domain);
        // Get brand name from competitor's brandNames array or derive from name/domain
        const brandName = comp.brandNames?.[0] || comp.name || comp.domain.replace(/\.(com|in|co\.in|org|net)$/i, '');

        // Get Favicon (first logo or null)
        const favicon = comp.logos && comp.logos.length > 0 ? comp.logos[0] : null;

        domainInfoMap.set(normalizedDomain, {
            type: comp.competitionType as 'Self' | 'Main Competitor',
            brandName,
            favicon
        });
    }

    // Build normalized set of ALL domains
    const allDomains = new Set(
        relevantCompetitors.map(c => normalizeDomain(c.domain))
    );

    // Build Term Bucket Map for O(1) Lookup (Explicit User Overrides)
    const termBucketMap = new Map<string, string>();
    if (terms) {
        for (const t of terms) {
            if (t.term && t.bucket) {
                termBucketMap.set(t.term.toLowerCase().trim(), t.bucket.toLowerCase());
            }
        }
    }

    // Filter for BRAND keywords and group by domain
    const domainBrandData = new Map<string, {
        keywords: Array<{ keyword: string; location: string; position: number; volume: number }>;
        totalVolume: number;
    }>();

    for (const kw of domainKeywords) {
        if (kw.clientCode !== clientCode) continue;

        const normalizedDomain = normalizeDomain(kw.domain);
        if (!allDomains.has(normalizedDomain)) continue;
        if (kw.position === null || kw.position <= 0) continue;

        const kwLower = kw.keyword.toLowerCase().trim();
        const explicitBucket = termBucketMap.get(kwLower);

        // LOGIC: Dictionary > Heuristic
        let isMatch = false;

        if (explicitBucket) {
            // If explicit bucket exists, ONLY 'brand' or 'brand | nav' is valid for this report
            if (explicitBucket === 'brand' || explicitBucket.includes('brand')) {
                isMatch = true;
            } else {
                // Explicitly 'exclude', 'include', 'review' -> SKIP
                continue;
            }
        } else {
            // Fallback to Heuristic for Unassigned/Competitor keywords
            if (keywordMatchesBrand(kw.keyword)) {
                isMatch = true;
            }
        }

        if (!isMatch) continue;

        const locationName = LOCATION_CODE_TO_NAME[kw.locationCode] || kw.locationCode;
        const volume = kw.searchVolume || 0;

        if (!domainBrandData.has(normalizedDomain)) {
            domainBrandData.set(normalizedDomain, { keywords: [], totalVolume: 0 });
        }

        const domainData = domainBrandData.get(normalizedDomain)!;
        domainData.keywords.push({
            keyword: kw.keyword,
            location: locationName,
            position: kw.position,
            volume
        });
        domainData.totalVolume += volume;
    }

    // Build result array
    const domainResults: BrandPowerData['domains'] = [];
    let totalBrandKeywords = 0;
    let totalBrandVolume = 0;

    for (const [normalizedDomain, data] of Array.from(domainBrandData.entries())) {
        const info = domainInfoMap.get(normalizedDomain);
        if (!info) continue;

        // Sort keywords by volume desc
        data.keywords.sort((a, b) => b.volume - a.volume);

        // Find original domain case from competitors
        const originalDomain = relevantCompetitors.find(
            c => normalizeDomain(c.domain) === normalizedDomain
        )?.domain || normalizedDomain;

        domainResults.push({
            domain: originalDomain,
            domainType: info.type,
            brandName: info.brandName,
            favicon: info.favicon,
            brandKeywordCount: data.keywords.length,
            totalBrandVolume: data.totalVolume,
            keywords: data.keywords.slice(0, config.limit || 50) // Limit keywords per domain
        });

        totalBrandKeywords += data.keywords.length;
        totalBrandVolume += data.totalVolume;
    }

    // Sort domains by total brand volume (Self first, then by volume)
    domainResults.sort((a, b) => {
        if (a.domainType !== b.domainType) {
            return a.domainType === 'Self' ? -1 : 1;
        }
        return b.totalBrandVolume - a.totalBrandVolume;
    });

    return {
        summary: {
            totalDomains: domainResults.length,
            totalBrandKeywords,
            totalBrandVolume
        },
        domains: domainResults
    };
}

// MANUAL_002: Execute Top 20 Include|Learn (Review) Keywords query
// Data source: client_ai_profiles.json (term dictionary) + domain_keywords.json + clients.json
// Filter: bucket = 'review' (Include|Learn)
// Volume: Combined India + Global
// Position: Client Self domains only
async function executeTop20IncludeLearnQuery(
    clientCode: string,
    config: { limit?: number }
): Promise<Top20IncludeLearnData> {
    const aiProfiles = await readAiProfiles();
    const domainKeywords = await readDomainKeywords();
    const clients = await readClients();

    // Get client's self domains
    const clientData = clients.find(c => c.code === clientCode);
    const normalizeDomainLocal = (d: string): string => {
        if (!d) return '';
        return d.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase().replace(/\/$/, '');
    };
    const selfDomains = new Set((clientData?.domains || []).map(normalizeDomainLocal));

    // Get AI profile and term dictionary
    const profile = aiProfiles.find(p => p.clientCode === clientCode);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const termDictionary = (profile as any)?.ai_kw_builder_term_dictionary as { terms?: Record<string, { name?: string; term?: string; bucket?: string }> } | undefined;
    const terms = termDictionary?.terms || {};

    // Filter for Include|Learn (review) bucket terms
    const includeLearnTerms: string[] = [];
    const termsList = Array.isArray(terms) ? terms : Object.values(terms);

    for (const term of termsList) {
        if (term.bucket === 'review') {
            const termName = term.name || term.term;
            if (termName) includeLearnTerms.push(termName.toLowerCase());
        }
    }

    if (includeLearnTerms.length === 0) {
        return {
            keywords: [],
            summary: {
                totalIncludeLearnKeywords: 0,
                selfDomainsCount: selfDomains.size
            }
        };
    }

    // Filter domain keywords for this client
    const clientDomainKeywords = domainKeywords.filter(dk => dk.clientCode === clientCode);

    // Create volume map: keyword -> combined IN + GL volume
    const volumeMap = new Map<string, { volumeIN: number; volumeGL: number }>();
    for (const dk of clientDomainKeywords) {
        const kw = dk.keyword.toLowerCase();
        const existing = volumeMap.get(kw);
        if (!existing) {
            volumeMap.set(kw, {
                volumeIN: dk.locationCode === 'IN' || dk.locationCode === '2356' ? (dk.searchVolume || 0) : 0,
                volumeGL: dk.locationCode === 'GL' || dk.locationCode === '2840' ? (dk.searchVolume || 0) : 0,
            });
        } else {
            if ((dk.locationCode === 'IN' || dk.locationCode === '2356') && (dk.searchVolume || 0) > existing.volumeIN) {
                existing.volumeIN = dk.searchVolume || 0;
            }
            if ((dk.locationCode === 'GL' || dk.locationCode === '2840') && (dk.searchVolume || 0) > existing.volumeGL) {
                existing.volumeGL = dk.searchVolume || 0;
            }
        }
    }

    // Create position map from SELF domains only
    const selfDomainKeywords = clientDomainKeywords.filter(dk => {
        const normalizedDomain = normalizeDomainLocal(dk.domain);
        return selfDomains.has(normalizedDomain);
    });

    const selfPositionMap = new Map<string, { positionIN: number | null; positionGL: number | null }>();
    for (const dk of selfDomainKeywords) {
        const kw = dk.keyword.toLowerCase();
        const existing = selfPositionMap.get(kw);
        if (!existing) {
            selfPositionMap.set(kw, {
                positionIN: dk.locationCode === 'IN' || dk.locationCode === '2356' ? dk.position : null,
                positionGL: dk.locationCode === 'GL' || dk.locationCode === '2840' ? dk.position : null,
            });
        } else {
            // Take best (lowest) position for each location
            if ((dk.locationCode === 'IN' || dk.locationCode === '2356') && dk.position !== null && (existing.positionIN === null || dk.position < existing.positionIN)) {
                existing.positionIN = dk.position;
            }
            if ((dk.locationCode === 'GL' || dk.locationCode === '2840') && dk.position !== null && (existing.positionGL === null || dk.position < existing.positionGL)) {
                existing.positionGL = dk.position;
            }
        }
    }

    // Enrich terms with volume and position data
    const enrichedTerms: Top20IncludeLearnData['keywords'] = [];

    // Only process unique terms
    const uniqueTerms = new Set(includeLearnTerms);

    for (const termName of Array.from(uniqueTerms)) {
        const volData = volumeMap.get(termName);
        const posData = selfPositionMap.get(termName);
        const totalVolume = (volData?.volumeIN || 0) + (volData?.volumeGL || 0);

        enrichedTerms.push({
            rank: 0, // Will be set after sorting
            keyword: termName,
            bucket: 'Include | Learn',
            totalVolume,
            volumeIN: volData?.volumeIN || 0,
            volumeGL: volData?.volumeGL || 0,
            selfPosIN: posData?.positionIN || null,
            selfPosGL: posData?.positionGL || null,
        });
    }

    // Sort by combined volume DESC
    enrichedTerms.sort((a, b) => b.totalVolume - a.totalVolume);

    // Apply limit and set ranks
    const limit = config.limit || 20;
    const topTerms = enrichedTerms.slice(0, limit);
    topTerms.forEach((t, idx) => { t.rank = idx + 1; });

    return {
        keywords: topTerms,
        summary: {
            totalIncludeLearnKeywords: uniqueTerms.size,
            selfDomainsCount: selfDomains.size
        }
    };
}

// MANUAL_001: Execute Top 20 Include|Buy Keywords query
// Data source: client_ai_profiles.json (term dictionary) + domain_keywords.json + clients.json
// Filter: bucket = 'include' (Include|Buy)
// Volume: Combined India + Global
// Position: Client Self domains only
async function executeTop20IncludeBuyQuery(
    clientCode: string,
    config: { limit?: number }
): Promise<Top20IncludeBuyData> {
    const aiProfiles = await readAiProfiles();
    const domainKeywords = await readDomainKeywords();
    const clients = await readClients();

    // Get client's self domains
    const clientData = clients.find(c => c.code === clientCode);
    const normalizeDomainLocal = (d: string): string => {
        if (!d) return '';
        return d.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase().replace(/\/$/, '');
    };
    const selfDomains = new Set((clientData?.domains || []).map(normalizeDomainLocal));

    // Get AI profile and term dictionary
    const profile = aiProfiles.find(p => p.clientCode === clientCode);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const termDictionary = (profile as any)?.ai_kw_builder_term_dictionary as { terms?: Record<string, { name?: string; term?: string; bucket?: string }> } | undefined;
    const terms = termDictionary?.terms || {};

    // Filter for Include|Buy bucket terms
    const includeBuyTerms: string[] = [];
    for (const [, term] of Object.entries(terms)) {
        if (term.bucket === 'include') {
            const termName = term.name || term.term;
            if (termName) includeBuyTerms.push(termName.toLowerCase());
        }
    }

    if (includeBuyTerms.length === 0) {
        return {
            keywords: [],
            summary: {
                totalIncludeBuyKeywords: 0,
                selfDomainsCount: selfDomains.size
            }
        };
    }

    // Filter domain keywords for this client
    const clientDomainKeywords = domainKeywords.filter(dk => dk.clientCode === clientCode);

    // Create volume map: keyword -> combined IN + GL volume
    const volumeMap = new Map<string, { volumeIN: number; volumeGL: number }>();
    for (const dk of clientDomainKeywords) {
        const kw = dk.keyword.toLowerCase();
        const existing = volumeMap.get(kw);
        if (!existing) {
            volumeMap.set(kw, {
                volumeIN: dk.locationCode === 'IN' ? (dk.searchVolume || 0) : 0,
                volumeGL: dk.locationCode === 'GL' ? (dk.searchVolume || 0) : 0,
            });
        } else {
            if (dk.locationCode === 'IN' && (dk.searchVolume || 0) > existing.volumeIN) {
                existing.volumeIN = dk.searchVolume || 0;
            }
            if (dk.locationCode === 'GL' && (dk.searchVolume || 0) > existing.volumeGL) {
                existing.volumeGL = dk.searchVolume || 0;
            }
        }
    }

    // Create position map from SELF domains only
    const selfDomainKeywords = clientDomainKeywords.filter(dk => {
        const normalizedDomain = normalizeDomainLocal(dk.domain);
        return selfDomains.has(normalizedDomain);
    });

    const selfPositionMap = new Map<string, { positionIN: number | null; positionGL: number | null }>();
    for (const dk of selfDomainKeywords) {
        const kw = dk.keyword.toLowerCase();
        const existing = selfPositionMap.get(kw);
        if (!existing) {
            selfPositionMap.set(kw, {
                positionIN: dk.locationCode === 'IN' ? dk.position : null,
                positionGL: dk.locationCode === 'GL' ? dk.position : null,
            });
        } else {
            // Take best (lowest) position for each location
            if (dk.locationCode === 'IN' && dk.position !== null && (existing.positionIN === null || dk.position < existing.positionIN)) {
                existing.positionIN = dk.position;
            }
            if (dk.locationCode === 'GL' && dk.position !== null && (existing.positionGL === null || dk.position < existing.positionGL)) {
                existing.positionGL = dk.position;
            }
        }
    }

    // Enrich terms with volume and position data
    const enrichedTerms: Top20IncludeBuyData['keywords'] = [];
    for (const termName of includeBuyTerms) {
        const volData = volumeMap.get(termName);
        const posData = selfPositionMap.get(termName);
        const totalVolume = (volData?.volumeIN || 0) + (volData?.volumeGL || 0);

        enrichedTerms.push({
            rank: 0, // Will be set after sorting
            keyword: termName,
            bucket: 'Include | Buy',
            totalVolume,
            volumeIN: volData?.volumeIN || 0,
            volumeGL: volData?.volumeGL || 0,
            selfPosIN: posData?.positionIN || null,
            selfPosGL: posData?.positionGL || null,
        });
    }

    // Sort by combined volume DESC
    enrichedTerms.sort((a, b) => b.totalVolume - a.totalVolume);

    // Apply limit and set ranks
    const limit = config.limit || 20;
    const topTerms = enrichedTerms.slice(0, limit);
    topTerms.forEach((t, idx) => { t.rank = idx + 1; });

    return {
        keywords: topTerms,
        summary: {
            totalIncludeBuyKeywords: includeBuyTerms.length,
            selfDomainsCount: selfDomains.size
        }
    };
}




// Execute client business query (Q001)
async function executeClientBusinessQuery(
    params: ExecuteQueryRequest,
    queryDef: DashboardQueryDefinition
): Promise<ClientBusinessData> {
    const clients = await readClients();
    const client = clients.find(c => c.code === params.clientCode);

    if (!client) {
        throw new Error(`Client not found: ${params.clientCode}`);
    }

    // Read AI Client Profile
    const aiProfilesPath = path.join(process.cwd(), 'data', 'client_ai_profiles.json');
    let aiProfile = null;
    try {
        if (await fs.stat(aiProfilesPath).then(() => true).catch(() => false)) {
            const aiProfilesRaw = await fs.readFile(aiProfilesPath, 'utf-8');
            const aiProfiles = JSON.parse(aiProfilesRaw);
            aiProfile = aiProfiles.find((p: any) => p.clientCode === params.clientCode);
        }
    } catch (error) {
        console.warn('Failed to read AI profiles:', error);
    }

    // Read Domain Profiles (correct data source for client domain metrics)
    const domainProfilesPath = path.join(process.cwd(), 'data', 'domainProfiles.json');
    let domainProfiles: any[] = [];
    try {
        if (await fs.stat(domainProfilesPath).then(() => true).catch(() => false)) {
            const domainProfilesRaw = await fs.readFile(domainProfilesPath, 'utf-8');
            domainProfiles = JSON.parse(domainProfilesRaw);
        }
    } catch (error) {
        console.warn('Failed to read domain profiles:', error);
    }

    // Filter domain profiles for this client
    const clientDomainProfiles = domainProfiles.filter((dp: any) => dp.clientCode === params.clientCode);

    // Assemble Data (Deduplicated)
    const domainsData: any[] = [];
    const seenDomains = new Set<string>();

    (client.domains || []).forEach((domain: string) => {
        // Clean domain for matching
        const cleanDomain = domain.toLowerCase().trim().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');

        if (seenDomains.has(cleanDomain)) return;
        seenDomains.add(cleanDomain);

        // Match against domain profiles (try exact match first, then cleaned match)
        const profile = clientDomainProfiles.find((dp: any) => {
            const dpClean = dp.domain.toLowerCase().trim().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
            return dpClean === cleanDomain || dp.domain.toLowerCase() === domain.toLowerCase();
        });

        domainsData.push({
            domain: domain,
            cleanDomain: cleanDomain,
            organicTraffic: Math.round(profile?.organicTraffic || 0),
            organicKeywords: profile?.organicKeywordsCount || 0
        });
    });

    return {
        businessOverview: {
            summary: aiProfile?.shortSummary || "N/A",
            businessModel: aiProfile?.businessModel || "N/A",
            industry: aiProfile?.industryType || "N/A"
        },
        productMarket: {
            products: aiProfile?.productLines || [],
            segments: aiProfile?.targetCustomerSegments || [],
            geographies: aiProfile?.targetGeographies || []
        },
        assets: {
            brandPhotos: client.brandPhotos || []
        },
        domains: domainsData
    };
}

// MANUAL_003: Home Page Query - Fetches client logo, app logo, tagline, punchline
async function executeHomePageQuery(
    params: ExecuteQueryRequest
): Promise<HomePageData> {
    const clients = await readClients();
    const client = clients.find(c => c.code === params.clientCode);

    if (!client) {
        throw new Error(`Client not found: ${params.clientCode}`);
    }

    // Get client logo from brandPhotos
    const clientLogo = client.brandPhotos && client.brandPhotos.length > 0
        ? client.brandPhotos[0]
        : null;

    // Get app profile from PostgreSQL
    let appProfile = null;
    try {
        const { prisma } = await import('@/lib/prisma');
        appProfile = await prisma.appProfile.findUnique({
            where: { key: 'primary' },
            include: { logos: { where: { isPrimary: true }, take: 1 } }
        });
    } catch (error) {
        console.warn('Failed to read app profile from database:', error);
    }

    // Get app logo (primary logo)
    const appLogo = appProfile?.logos?.[0]?.url || null;

    return {
        clientName: client.name,
        clientLogo,
        appName: appProfile?.appName || 'Keyword Ninja',
        appLogo,
        tagline: appProfile?.tagline || null,
        punchline: appProfile?.punchline || null
    };
}

// MANUAL_004: Top 3 Surfaces by Category from Footprint Registry
async function executeTop3SurfacesByCategoryQuery(): Promise<{
    categories: { category: string; categoryLabel: string; surfaces: { label: string; importance: string; points: number; whyItMatters: string; }[]; }[];
    summary: { totalCategories: number; totalSurfaces: number; totalPoints: number; };
}> {
    const { prisma } = await import('@/lib/prisma');

    // SEO meaning descriptions
    const getSurfaceSeoMeaning = (surfaceKey: string, label: string, category: string): string => {
        const key = surfaceKey.toLowerCase();
        const labelLower = label.toLowerCase();

        const meanings: Record<string, string> = {
            'linkedin': 'Professional network presence. Builds B2B trust.',
            'facebook': 'Social proof and community engagement.',
            'youtube': 'Video SEO powerhouse, 2nd largest search engine.',
            'google': 'Core search visibility indicator.',
            'gbp': 'Google Business Profile, critical for local SEO.',
            'knowledge_panel': 'Brand entity surface for SERP trust.',
            'wikipedia': 'Highest authority backlink.',
            'wikidata': 'Structured entity graph for AI/LLMs.',
            'website': 'Core web presence, foundation of SEO.',
            'schema': 'Structured data for rich snippets.',
            'gsc': 'Site ownership + indexing diagnostics.',
        };

        for (const [keyword, meaning] of Object.entries(meanings)) {
            if (key.includes(keyword) || labelLower.includes(keyword)) {
                return meaning;
            }
        }
        return 'Digital footprint surface.';
    };

    const CATEGORY_LABELS: Record<string, string> = {
        'owned': 'Owned Properties', 'search': 'Search Presence', 'social': 'Social Media',
        'video': 'Video Platforms', 'community': 'Community & Forums', 'trust': 'Trust & Reviews',
        'authority': 'Authority Signals', 'marketplace': 'Marketplaces', 'technical': 'Technical SEO',
        'ai': 'AI Platforms', 'aeo': 'Answer Engine Optimization',
        'performance_security': 'Performance & Security', 'eeat_entity': 'E-E-A-T & Entity',
    };

    const IMPORTANCE_DISPLAY: Record<string, string> = {
        'CRITICAL': 'Critical', 'HIGH': 'High', 'MEDIUM': 'Medium', 'LOW': 'Low',
    };

    const surfaces = await (prisma.footprintSurfaceRegistry as any).findMany({
        where: { enabled: true },
        orderBy: { basePoints: 'desc' },
        select: { surfaceKey: true, label: true, category: true, importanceTier: true, basePoints: true },
    });

    const categoryGroups: Record<string, typeof surfaces> = {};
    for (const surface of surfaces) {
        if (!categoryGroups[surface.category]) categoryGroups[surface.category] = [];
        if (categoryGroups[surface.category].length < 3) categoryGroups[surface.category].push(surface);
    }

    const categories = Object.entries(categoryGroups)
        .filter(([, items]) => items.length > 0)
        .map(([category, items]) => ({
            category,
            categoryLabel: CATEGORY_LABELS[category] || category,
            totalPoints: items.reduce((sum: number, s: any) => sum + s.basePoints, 0),
            surfaces: items.map((s: any) => ({
                label: s.label,
                importance: IMPORTANCE_DISPLAY[s.importanceTier] || s.importanceTier,
                points: s.basePoints,
                whyItMatters: getSurfaceSeoMeaning(s.surfaceKey, s.label, s.category),
            })),
        }))
        // Sort by total points descending (highest first)
        .sort((a, b) => b.totalPoints - a.totalPoints);

    return {
        categories,
        summary: {
            totalCategories: categories.length,
            totalSurfaces: categories.reduce((sum, c) => sum + c.surfaces.length, 0),
            totalPoints: categories.reduce((sum, c) => sum + c.surfaces.reduce((s: number, surf: any) => s + surf.points, 0), 0),
        },
    };
}

async function executeCompetitorBalloonQuery(clientCode: string, queryDef?: any): Promise<CompetitorBalloonData> {
    const clients = await readClients();
    const client = clients.find(c => c.code === clientCode);
    if (!client) throw new Error(`Client not found: ${clientCode}`);

    const competitors = await readCompetitors();
    const relevantCompetitors = competitors.filter(c => c.clientCode === clientCode && c.isActive && c.competitionType === 'Main Competitor');

    // Get credibility data
    const LOCATION_CODE = 'IN'; // Default to India for now
    const credibilityRecords = await getCredibilityByClientAndLocation(clientCode, LOCATION_CODE);

    const balloons: CompetitorBalloonData['balloons'] = [];
    let totalMainCompTraffic = 0;
    let yourTraffic = 0;

    // Process Client Domains
    for (const domain of client.domains || [client.mainDomain]) {
        const cleanDomain = domain.toLowerCase().trim().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
        const record = credibilityRecords.find(r => r.domain.toLowerCase() === cleanDomain);

        const traffic = record?.organicTraffic || 0;
        yourTraffic += traffic;

        if (traffic > 0 || record) {
            balloons.push({
                domain: cleanDomain,
                brandName: client.name,
                logo: client.brandPhotos?.[0] || null,
                traffic: traffic,
                etv: record?.organicCost || 0,
                age: record?.domainAgeYears || null,
                isSelf: true
            });
        }
    }

    // Process Competitors
    for (const comp of relevantCompetitors) {
        const cleanDomain = comp.domain.toLowerCase().trim().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
        const record = credibilityRecords.find(r => r.domain.toLowerCase() === cleanDomain);

        const traffic = record?.organicTraffic || 0;
        totalMainCompTraffic += traffic;

        if (traffic > 0 || record) {
            balloons.push({
                domain: cleanDomain,
                brandName: comp.name,
                logo: comp.logos?.[0] || null,
                traffic: traffic,
                etv: record?.organicCost || 0,
                age: record?.domainAgeYears || null,
                isSelf: false
            });
        }
    }

    const totalTraffic = totalMainCompTraffic + yourTraffic;
    const yourTrafficShare = totalTraffic > 0 ? (yourTraffic / totalTraffic) * 100 : 0;

    return {
        summary: {
            totalMainCompetitors: relevantCompetitors.length,
            yourTrafficShare
        },
        balloons: balloons.sort((a, b) => b.traffic - a.traffic)
    };
}

// Execute 2x2 KW/Volume Analysis for Self
async function executeKwVolume2x2Query(clientCode: string) {
    const aiProfiles = await readAiProfiles();
    const domainKeywords = await readDomainKeywords();
    const clients = await readClients();

    // Get client's self domains
    const clientData = clients.find(c => c.code === clientCode);
    const normalizeDomain = (d: string): string => {
        if (!d) return '';
        return d.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase().replace(/\/$/, '');
    };
    const selfDomains = new Set((clientData?.domains || []).map(normalizeDomain));
    if (clientData?.mainDomain) selfDomains.add(normalizeDomain(clientData.mainDomain));

    // Get AI profile term dictionary for bucket mapping
    const profile = aiProfiles.find(p => p.clientCode === clientCode);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const termDictionary = (profile as any)?.ai_kw_builder_term_dictionary as { terms?: Record<string, { name?: string; term?: string; bucket?: string }> } | undefined;
    const terms = termDictionary?.terms || {};

    // Build term -> bucket map
    const termBucketMap = new Map<string, string>();
    for (const [, term] of Object.entries(terms)) {
        const termName = (term.name || term.term || '').toLowerCase();
        const bucket = term.bucket || 'unassigned';
        if (termName) termBucketMap.set(termName, bucket);
    }

    // Normalize bucket name
    const normalizeBucket = (bucket: string): string => {
        const b = bucket.toLowerCase().trim();
        if (b === 'include' || b === 'include | buy' || b === 'include|buy') return 'Include | Buy';
        if (b === 'review' || b === 'include | learn' || b === 'include|learn') return 'Include | Learn';
        if (b === 'brand' || b === 'brand | nav' || b === 'brand|nav') return 'Brand | Nav';
        if (b === 'exclude' || b === 'exclude | noise' || b === 'exclude|noise' || b === 'noise') return 'Exclude | Noise';
        return 'Unassigned';
    };

    // Get bucket for keyword
    const getBucket = (keyword: string): string => {
        const kw = keyword.toLowerCase();
        if (termBucketMap.has(kw)) return normalizeBucket(termBucketMap.get(kw)!);
        for (const [term, bucket] of Array.from(termBucketMap.entries())) {
            if (kw.includes(term)) return normalizeBucket(bucket);
        }
        return 'Unassigned';
    };

    // Excluded buckets
    const EXCLUDED_BUCKETS = ['Exclude | Noise', 'Unassigned'];

    // Filter for SELF domain with valid ranks and non-excluded buckets
    const filtered: { keyword: string; volume: number; rank: number; bucket: string }[] = [];
    const bucketsFound = new Set<string>();

    for (const dk of domainKeywords.filter(d => d.clientCode === clientCode)) {
        const normalizedDomain = normalizeDomain(dk.domain);
        const isSelf = selfDomains.has(normalizedDomain);
        const hasValidRank = dk.position && Number.isInteger(dk.position) && dk.position > 0;

        if (!isSelf || !hasValidRank) continue;

        const bucket = getBucket(dk.keyword);
        if (EXCLUDED_BUCKETS.includes(bucket)) continue;

        bucketsFound.add(bucket);
        filtered.push({
            keyword: dk.keyword,
            volume: dk.searchVolume || 0,
            rank: dk.position as number,
            bucket,
        });
    }

    if (filtered.length === 0) {
        return {
            quadrants: { q1: [], q2: [], q3: [], q4: [] },
            summary: { total: 0, p70: 0, q1: 0, q2: 0, q3: 0, q4: 0 },
            includedBuckets: []
        };
    }

    // Calculate P70 (top 30% threshold)
    const volumes = filtered.map(f => f.volume).sort((a, b) => a - b);
    const n = volumes.length;
    const index = Math.max(0, Math.min(n - 1, Math.ceil(0.70 * n) - 1));
    const p70 = volumes[index];

    // Assign quadrants
    const q1: typeof filtered = [];
    const q2: typeof filtered = [];
    const q3: typeof filtered = [];
    const q4: typeof filtered = [];

    for (const kw of filtered) {
        const isHighVolume = kw.volume >= p70;
        const isHighRank = kw.rank >= 1 && kw.rank <= 10;

        if (isHighVolume && isHighRank) q1.push(kw);
        else if (isHighVolume && !isHighRank) q2.push(kw);
        else if (!isHighVolume && isHighRank) q3.push(kw);
        else q4.push(kw);
    }

    // Sort by volume DESC, rank ASC
    const sortFn = (a: typeof filtered[0], b: typeof filtered[0]) => {
        if (b.volume !== a.volume) return b.volume - a.volume;
        return a.rank - b.rank;
    };
    q1.sort(sortFn);
    q2.sort(sortFn);
    q3.sort(sortFn);
    q4.sort(sortFn);

    return {
        quadrants: { q1, q2, q3, q4 },
        summary: { total: filtered.length, p70, q1: q1.length, q2: q2.length, q3: q3.length, q4: q4.length },
        includedBuckets: Array.from(bucketsFound)
    };
}

// Execute 2x2 Gap Analysis - Keywords where SELF is absent but competitors rank
async function executeKwVolumeGapQuery(clientCode: string) {
    const aiProfiles = await readAiProfiles();
    const domainKeywords = await readDomainKeywords();
    const clients = await readClients();

    // Get client's self domains
    const clientData = clients.find(c => c.code === clientCode);
    const normalizeDomain = (d: string): string => {
        if (!d) return '';
        return d.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase().replace(/\/$/, '');
    };
    const selfDomains = new Set((clientData?.domains || []).map(normalizeDomain));
    if (clientData?.mainDomain) selfDomains.add(normalizeDomain(clientData.mainDomain));

    // Get AI profile term dictionary for bucket mapping
    const profile = aiProfiles.find(p => p.clientCode === clientCode);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const termDictionary = (profile as any)?.ai_kw_builder_term_dictionary as { terms?: Record<string, { name?: string; term?: string; bucket?: string }> } | undefined;
    const terms = termDictionary?.terms || {};

    // Build term -> bucket map
    const termBucketMap = new Map<string, string>();
    for (const [, term] of Object.entries(terms)) {
        const termName = (term.name || term.term || '').toLowerCase();
        const bucket = term.bucket || 'unassigned';
        if (termName) termBucketMap.set(termName, bucket);
    }

    // Normalize bucket name
    const normalizeBucket = (bucket: string): string => {
        const b = bucket.toLowerCase().trim();
        if (b === 'include' || b === 'include | buy' || b === 'include|buy') return 'Include | Buy';
        if (b === 'review' || b === 'include | learn' || b === 'include|learn') return 'Include | Learn';
        if (b === 'brand' || b === 'brand | nav' || b === 'brand|nav') return 'Brand | Nav';
        if (b === 'exclude' || b === 'exclude | noise' || b === 'exclude|noise' || b === 'noise') return 'Exclude | Noise';
        return 'Unassigned';
    };

    // Get bucket for keyword
    const getBucket = (keyword: string): string => {
        const kw = keyword.toLowerCase();
        if (termBucketMap.has(kw)) return normalizeBucket(termBucketMap.get(kw)!);
        for (const [term, bucket] of Array.from(termBucketMap.entries())) {
            if (kw.includes(term)) return normalizeBucket(bucket);
        }
        return 'Unassigned';
    };

    // Get all keywords for this client
    const clientKws = domainKeywords.filter(d => d.clientCode === clientCode);

    // Find keywords where SELF ranks
    const selfRankingKeywords = new Set(
        clientKws
            .filter(k => selfDomains.has(normalizeDomain(k.domain)) && k.position && k.position > 0)
            .map(k => k.keyword)
    );

    // Group competitor rankings by keyword
    const keywordCompetitors = new Map<string, { domain: string; position: number }[]>();
    for (const dk of clientKws) {
        const domain = normalizeDomain(dk.domain);
        if (selfDomains.has(domain)) continue; // Skip self domains
        if (!dk.position || dk.position <= 0) continue;

        if (!keywordCompetitors.has(dk.keyword)) {
            keywordCompetitors.set(dk.keyword, []);
        }
        keywordCompetitors.get(dk.keyword)!.push({ domain: dk.domain, position: dk.position });
    }

    // Only Include buckets (Include | Buy, Include | Learn)
    const INCLUDED_BUCKETS = ['Include | Buy', 'Include | Learn'];

    // Build gap keywords list
    interface GapKeyword {
        keyword: string;
        volume: number;
        bucket: string;
        bestRank: number;
        topCompetitors: string; // "domain.com (#3), other.com (#7)"
    }

    const gapKeywords: GapKeyword[] = [];
    const bucketsFound = new Set<string>();

    for (const [keyword, competitors] of Array.from(keywordCompetitors.entries())) {
        // Skip if SELF is ranking
        if (selfRankingKeywords.has(keyword)) continue;

        const bucket = getBucket(keyword);

        // Only include "Include" buckets
        if (!INCLUDED_BUCKETS.includes(bucket)) continue;

        // Get best rank among competitors
        const sortedComps = competitors.sort((a, b) => a.position - b.position);
        const bestRank = sortedComps[0].position;

        // Get top 3 competitors as string
        const topComps = sortedComps.slice(0, 3)
            .map(c => `${c.domain} (#${c.position})`)
            .join(', ');

        // Get volume from any record of this keyword
        const kwRecord = clientKws.find(k => k.keyword === keyword);
        const volume = kwRecord?.searchVolume || 0;

        bucketsFound.add(bucket);
        gapKeywords.push({
            keyword,
            volume,
            bucket,
            bestRank,
            topCompetitors: topComps
        });
    }

    if (gapKeywords.length === 0) {
        return {
            quadrants: { q1: [], q2: [], q3: [], q4: [] },
            summary: { total: 0, p70: 0, q1: 0, q2: 0, q3: 0, q4: 0, selfRanking: selfRankingKeywords.size },
            includedBuckets: []
        };
    }

    // Calculate P70 (top 30% threshold)
    const volumes = gapKeywords.map(f => f.volume).sort((a, b) => a - b);
    const n = volumes.length;
    const index = Math.max(0, Math.min(n - 1, Math.ceil(0.70 * n) - 1));
    const p70 = volumes[index];

    // Assign quadrants based on COMPETITOR's best rank
    const q1: GapKeyword[] = []; // High Vol + Competitor Top 10 (Urgent gaps)
    const q2: GapKeyword[] = []; // High Vol + Competitor Below 10 (Quick wins)
    const q3: GapKeyword[] = []; // Low Vol + Competitor Top 10 (Niche gaps)
    const q4: GapKeyword[] = []; // Low Vol + Competitor Below 10 (Low priority)

    for (const kw of gapKeywords) {
        const isHighVolume = kw.volume >= p70;
        const isCompetitorTop10 = kw.bestRank >= 1 && kw.bestRank <= 10;

        if (isHighVolume && isCompetitorTop10) q1.push(kw);
        else if (isHighVolume && !isCompetitorTop10) q2.push(kw);
        else if (!isHighVolume && isCompetitorTop10) q3.push(kw);
        else q4.push(kw);
    }

    // Sort by volume DESC, bestRank ASC
    const sortFn = (a: GapKeyword, b: GapKeyword) => {
        if (b.volume !== a.volume) return b.volume - a.volume;
        return a.bestRank - b.bestRank;
    };
    q1.sort(sortFn);
    q2.sort(sortFn);
    q3.sort(sortFn);
    q4.sort(sortFn);

    return {
        quadrants: { q1, q2, q3, q4 },
        summary: {
            total: gapKeywords.length,
            p70,
            q1: q1.length,
            q2: q2.length,
            q3: q3.length,
            q4: q4.length,
            selfRanking: selfRankingKeywords.size
        },
        includedBuckets: Array.from(bucketsFound)
    };
}

// Execute Blue Ocean Query - High volume keywords where NO domain is ranking
async function executeBlueOceanQuery(clientCode: string) {
    const aiProfiles = await readAiProfiles();
    const domainKeywords = await readDomainKeywords();
    const clients = await readClients();

    // Get client's self domains
    const clientData = clients.find(c => c.code === clientCode);
    const normalizeDomain = (d: string): string => {
        if (!d) return '';
        return d.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase().replace(/\/$/, '');
    };
    const selfDomains = new Set((clientData?.domains || []).map(normalizeDomain));
    if (clientData?.mainDomain) selfDomains.add(normalizeDomain(clientData.mainDomain));

    // Get AI profile term dictionary
    const profile = aiProfiles.find(p => p.clientCode === clientCode);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const termDictionary = (profile as any)?.ai_kw_builder_term_dictionary as { terms?: Record<string, { name?: string; term?: string; bucket?: string }> } | undefined;
    const terms = termDictionary?.terms || {};

    const termBucketMap = new Map<string, string>();
    for (const [, term] of Object.entries(terms)) {
        const termName = (term.name || term.term || '').toLowerCase();
        const bucket = term.bucket || 'unassigned';
        if (termName) termBucketMap.set(termName, bucket);
    }

    const normalizeBucket = (bucket: string): string => {
        const b = bucket.toLowerCase().trim();
        if (b === 'include' || b === 'include | buy' || b === 'include|buy') return 'Include | Buy';
        if (b === 'review' || b === 'include | learn' || b === 'include|learn') return 'Include | Learn';
        return 'Unassigned';
    };

    const getBucket = (keyword: string): string => {
        const kw = keyword.toLowerCase();
        if (termBucketMap.has(kw)) return normalizeBucket(termBucketMap.get(kw)!);
        for (const [term, bucket] of Array.from(termBucketMap.entries())) {
            if (kw.includes(term)) return normalizeBucket(bucket);
        }
        return 'Unassigned';
    };

    // Get all keywords for this client
    const clientKws = domainKeywords.filter(d => d.clientCode === clientCode);

    // Build keyword -> volume map (take max volume)
    const keywordVolumes = new Map<string, number>();
    const keywordsWithRanking = new Set<string>();

    for (const dk of clientKws) {
        const kw = dk.keyword;
        const vol = dk.searchVolume || 0;

        // Track volume (take max)
        if (!keywordVolumes.has(kw) || (keywordVolumes.get(kw) || 0) < vol) {
            keywordVolumes.set(kw, vol);
        }

        // Track if ANY domain is ranking (any position > 0, not just top 50)
        if (dk.position && dk.position > 0) {
            keywordsWithRanking.add(kw);
        }
    }

    // Calculate P50 (median)
    const volumes = Array.from(keywordVolumes.values()).sort((a, b) => a - b);
    const p50Index = Math.floor(volumes.length * 0.50);
    const p50 = volumes[p50Index] || 0;

    // Find blue ocean keywords
    const INCLUDED_BUCKETS = ['Include | Buy', 'Include | Learn'];
    interface BlueOceanKeyword {
        keyword: string;
        volume: number;
        bucket: string;
    }

    const blueOceanKeywords: BlueOceanKeyword[] = [];
    const bucketsFound = new Set<string>();

    for (const [keyword, volume] of Array.from(keywordVolumes.entries())) {
        if (volume < p50) continue; // Skip low volume
        if (keywordsWithRanking.has(keyword)) continue; // Skip if anyone is ranking

        const bucket = getBucket(keyword);
        if (!INCLUDED_BUCKETS.includes(bucket)) continue;

        bucketsFound.add(bucket);
        blueOceanKeywords.push({ keyword, volume, bucket });
    }

    // Sort by volume desc
    blueOceanKeywords.sort((a, b) => b.volume - a.volume);

    return {
        keywords: blueOceanKeywords,
        summary: {
            total: blueOceanKeywords.length,
            totalTracked: keywordVolumes.size,
            withRanking: keywordsWithRanking.size,
            p50
        },
        includedBuckets: Array.from(bucketsFound),
        selfDomains: Array.from(selfDomains)
    };
}

// Get source link for data verification
function getSourceLink(queryType: string): DataSourceLink {
    switch (queryType) {
        case 'domain-info':
            return { label: 'Client Master + AI Client Profile', href: '/clients' };
        case 'keyword-volume':
            return { label: 'Keyword API Data', href: '/keywords/api-data' };
        case 'client-rankings':
            return { label: 'Domain Keywords', href: '/keywords/domain-keywords' };
        case 'keywords-absence':
            return { label: 'Client Rank', href: '/curated/client-rank' };
        case 'competitor-global':
            return { label: 'Competitors + Client Rank', href: '/curated/client-rank' };
        case 'market-size':
            return { label: 'Domain Keywords (CTR Model)', href: '/keywords/domain-keywords' };
        case 'etv-comparison':
            return { label: 'Competitors + Domain Overview', href: '/keywords/domain-overview' };
        case 'etv-brand-comparison':
            return { label: 'Domain Authority (ETV)', href: '/master/domain-authority' };
        case 'keyword-opportunity-matrix':
            return { label: 'Domain Keywords (Opportunity Matrix)', href: '/keywords/domain-keywords' };
        case 'brand-keywords-matrix':
            return { label: 'Brand Keywords (P25 Matrix)', href: '/keywords/domain-keywords' };
        case 'competitor-balloon':
            return { label: 'Competitors + Domain Credibility', href: '/master/domain-authority' };
        case 'top20-include-buy':
            return { label: 'AI Keyword Builder (Include|Buy)', href: '/keywords/domain-keywords' };
        case 'top20-include-learn':
            return { label: 'AI Keyword Builder (Include|Learn)', href: '/keywords/domain-keywords' };
        case 'client-business':
            return { label: 'Client Master + AI Client Profile', href: '/master/clients' };
        case 'home-page':
            return { label: 'Client Master + App Profile', href: '/master/app-profile' };
        case 'top3-surfaces-by-category':
            return { label: 'Footprint Registry', href: '/admin/footprint-registry' };
        case 'kw-volume-2x2':
            return { label: '2x2 KW/Volume Analysis', href: '/report/preview-2x2' };
        case 'kw-volume-gap':
            return { label: '2x2 Gap Analysis', href: '/report/preview-2x2' };
        case 'blue-ocean':
            return { label: 'Blue Ocean Keywords', href: '/report/preview-2x2' };
        default:
            return { label: 'Unknown Source', href: '/' };
    }
}

// POST /api/reports/dashboard/execute - Execute a query for a client
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { clientCode, queryId } = body;

        if (!clientCode || !queryId) {
            return NextResponse.json(
                { success: false, error: 'clientCode and queryId are required' },
                { status: 400 }
            );
        }

        const query = await getQueryById(queryId);
        if (!query) {
            return NextResponse.json(
                { success: false, error: `Query not found: ${queryId}` },
                { status: 404 }
            );
        }

        let data: unknown;

        switch (query.queryType) {
            case 'domain-info':
                data = await executeDomainInfoQuery(clientCode);
                break;
            case 'keyword-volume':
                data = await executeKeywordVolumeQuery(clientCode, query.config);
                break;
            case 'client-rankings':
                data = await executeClientRankingsQuery(clientCode);
                break;
            case 'keywords-absence':
                data = await executeKeywordsAbsenceQuery(clientCode, query.config);
                break;
            case 'competitor-global':
                data = await executeCompetitorGlobalQuery(clientCode, query.config);
                break;
            case 'market-size':
                data = await executeMarketSizeQuery(clientCode, query.config);
                break;
            case 'etv-comparison':
                data = await executeETVComparisonQuery(clientCode, query.config);
                break;
            case 'keyword-opportunity-matrix':
                data = await executeKeywordOpportunityMatrixQuery(clientCode, query.config);
                break;
            case 'brand-keywords-matrix':
                data = await executeBrandKeywordsMatrixQuery(clientCode, query.config);
                break;
            case 'top20-include-buy':
                data = await executeTop20IncludeBuyQuery(clientCode, query.config);
                break;
            case 'top20-include-learn':
                data = await executeTop20IncludeLearnQuery(clientCode, query.config);
                break;
            case 'competitor-balloon':
                data = await executeCompetitorBalloonQuery(clientCode);
                break;

            case 'client-business':
                data = await executeClientBusinessQuery({ clientCode, queryId }, query);
                break;
            case 'home-page':
                data = await executeHomePageQuery({ clientCode, queryId });
                break;
            case 'top3-surfaces-by-category':
                data = await executeTop3SurfacesByCategoryQuery();
                break;
            case 'kw-volume-2x2':
                data = await executeKwVolume2x2Query(clientCode);
                break;
            case 'kw-volume-gap':
                data = await executeKwVolumeGapQuery(clientCode);
                break;
            case 'blue-ocean':
                data = await executeBlueOceanQuery(clientCode);
                break;
            default:
                data = { message: 'Custom query type - no execution logic defined' };
        }

        const result: DashboardQueryResult = {
            queryId: query.id,
            clientCode,
            title: query.title,
            status: query.status,
            queryType: query.queryType,
            tooltip: query.tooltip,
            data,
            executedAt: new Date().toISOString(),
            sourceLink: getSourceLink(query.queryType),
        };

        return NextResponse.json({ success: true, result });
    } catch (error) {
        console.error('Failed to execute query:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to execute query'
            },
            { status: 500 }
        );
    }
}


