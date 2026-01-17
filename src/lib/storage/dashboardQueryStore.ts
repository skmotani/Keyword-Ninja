import { promises as fs } from 'fs';
import path from 'path';
import { QueryGroup, DashboardQueryDefinition } from '@/types/dashboardTypes';

const DATA_DIR = path.join(process.cwd(), 'data');
const QUERY_GROUPS_FILE = 'dashboard_query_groups.json';
const QUERIES_FILE = 'dashboard_queries.json';

// ============================================
// Query Groups
// ============================================

async function readQueryGroups(): Promise<QueryGroup[]> {
    try {
        const filePath = path.join(DATA_DIR, QUERY_GROUPS_FILE);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as QueryGroup[];
    } catch {
        return [];
    }
}

async function writeQueryGroups(groups: QueryGroup[]): Promise<void> {
    const filePath = path.join(DATA_DIR, QUERY_GROUPS_FILE);
    await fs.writeFile(filePath, JSON.stringify(groups, null, 2), 'utf-8');
}

export async function getQueryGroups(): Promise<QueryGroup[]> {
    return readQueryGroups();
}

export async function getQueryGroupById(id: string): Promise<QueryGroup | null> {
    const groups = await readQueryGroups();
    return groups.find(g => g.id === id) || null;
}

export async function createQueryGroup(
    group: Omit<QueryGroup, 'id' | 'createdAt' | 'updatedAt'>
): Promise<QueryGroup> {
    const groups = await readQueryGroups();
    const now = new Date().toISOString();
    const newGroup: QueryGroup = {
        ...group,
        id: `GRP-${Date.now()}`,
        createdAt: now,
        updatedAt: now,
    };
    groups.push(newGroup);
    await writeQueryGroups(groups);
    return newGroup;
}

export async function updateQueryGroup(
    id: string,
    updates: Partial<Omit<QueryGroup, 'id' | 'createdAt'>>
): Promise<QueryGroup | null> {
    const groups = await readQueryGroups();
    const index = groups.findIndex(g => g.id === id);
    if (index === -1) return null;

    groups[index] = {
        ...groups[index],
        ...updates,
        updatedAt: new Date().toISOString(),
    };
    await writeQueryGroups(groups);
    return groups[index];
}

export async function deleteQueryGroup(id: string): Promise<boolean> {
    const groups = await readQueryGroups();
    const filtered = groups.filter(g => g.id !== id);
    if (filtered.length === groups.length) return false;
    await writeQueryGroups(filtered);
    return true;
}

// ============================================
// Query Definitions
// ============================================

async function readQueries(): Promise<DashboardQueryDefinition[]> {
    try {
        const filePath = path.join(DATA_DIR, QUERIES_FILE);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as DashboardQueryDefinition[];
    } catch {
        return [];
    }
}

async function writeQueries(queries: DashboardQueryDefinition[]): Promise<void> {
    const filePath = path.join(DATA_DIR, QUERIES_FILE);
    await fs.writeFile(filePath, JSON.stringify(queries, null, 2), 'utf-8');
}

export async function getQueries(): Promise<DashboardQueryDefinition[]> {
    return readQueries();
}

export async function getActiveQueries(): Promise<DashboardQueryDefinition[]> {
    const queries = await readQueries();
    return queries.filter(q => q.isActive);
}

export async function getQueryById(id: string): Promise<DashboardQueryDefinition | null> {
    const queries = await readQueries();
    return queries.find(q => q.id === id) || null;
}

export async function getQueriesByGroup(groupId: string): Promise<DashboardQueryDefinition[]> {
    const queries = await readQueries();
    return queries.filter(q => q.groupId === groupId && q.isActive);
}

export async function getNextQueryId(): Promise<string> {
    const queries = await readQueries();
    const maxNum = queries.reduce((max, q) => {
        const match = q.id.match(/^Q(\d+)$/);
        if (match) {
            const num = parseInt(match[1], 10);
            return num > max ? num : max;
        }
        return max;
    }, 0);
    return `Q${String(maxNum + 1).padStart(3, '0')}`;
}

export async function createQuery(
    query: Omit<DashboardQueryDefinition, 'id' | 'createdAt' | 'updatedAt'>
): Promise<DashboardQueryDefinition> {
    const queries = await readQueries();
    const now = new Date().toISOString();
    const id = await getNextQueryId();

    const newQuery: DashboardQueryDefinition = {
        ...query,
        id,
        createdAt: now,
        updatedAt: now,
    };
    queries.push(newQuery);
    await writeQueries(queries);
    return newQuery;
}

export async function updateQuery(
    id: string,
    updates: Partial<Omit<DashboardQueryDefinition, 'id' | 'createdAt'>>
): Promise<DashboardQueryDefinition | null> {
    const queries = await readQueries();
    const index = queries.findIndex(q => q.id === id);
    if (index === -1) return null;

    queries[index] = {
        ...queries[index],
        ...updates,
        updatedAt: new Date().toISOString(),
    };
    await writeQueries(queries);
    return queries[index];
}

export async function deleteQuery(id: string): Promise<boolean> {
    const queries = await readQueries();
    const filtered = queries.filter(q => q.id !== id);
    if (filtered.length === queries.length) return false;
    await writeQueries(filtered);
    return true;
}

// ============================================
// Seed Data Initialization
// ============================================

export async function initializeSeedData(): Promise<{ groupsCreated: number; queriesCreated: number }> {
    let groupsCreated = 0;
    let queriesCreated = 0;

    // Check if groups exist
    const existingGroups = await readQueryGroups();
    if (existingGroups.length === 0) {
        const seedGroups: QueryGroup[] = [
            {
                id: 'GRP-001',
                name: 'Digital Footprint',
                description: 'Queries analyzing your business digital presence',
                order: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'GRP-002',
                name: 'Keyword Analysis',
                description: 'Keyword volume and position analysis queries',
                order: 2,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'GRP-003',
                name: 'Know Your Turf',
                description: 'Client keyword rankings and market presence analysis',
                order: 3,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'GRP-004',
                name: 'Competitive Intelligence',
                description: 'Competitor analysis and opportunity identification',
                order: 4,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'GRP-005',
                name: 'Market Size',
                description: 'Traffic share and market opportunity analysis',
                order: 5,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        ];
        await writeQueryGroups(seedGroups);
        groupsCreated = seedGroups.length;
    }

    // Check if queries exist
    const existingQueries = await readQueries();
    if (existingQueries.length === 0) {
        const seedQueries: DashboardQueryDefinition[] = [
            {
                id: 'Q001',
                queryNumber: '1.1',
                groupId: 'GRP-001',
                title: 'Analyzing Your Business Digital Footprints',
                description: 'Overview of client digital presence including domain information and status assessment',
                tooltip: 'TABLE: clients.json + client_ai_profiles.json\nFILTER: clientCode = selected\nOUTPUT: name, mainDomain, businessOverview, products, targetSegments, geographies',
                status: 'Critical',
                queryType: 'domain-info',
                config: {},
                sourceInfo: {
                    tables: ['clients.json', 'client_ai_profiles.json'],
                    page: 'Clients Page',
                    pageUrl: '/master/clients'
                },
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'Q002',
                queryNumber: '2.1',
                groupId: 'GRP-002',
                title: 'Top 10 Searched Keywords in India',
                description: 'Shows top 10 keywords by search volume in India with balloon visualization',
                tooltip: 'TABLE: keyword_api_data.json\nFILTER: clientCode = selected, locationCode = 2356 (India)\nSORT: searchVolume DESC\nOUTPUT: Top 10 keywords with volume as balloons',
                status: 'Info',
                queryType: 'keyword-volume',
                config: {
                    location: 'india',
                    limit: 10,
                },
                sourceInfo: {
                    tables: ['keyword_api_data.json'],
                    page: 'Keyword API Data',
                    pageUrl: '/client/keyword-api-data'
                },
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'Q003',
                queryNumber: '2.2',
                groupId: 'GRP-002',
                title: 'Top 10 Searched Keywords in Global',
                description: 'Shows top 10 keywords by search volume globally with balloon visualization',
                tooltip: 'TABLE: keyword_api_data.json\nFILTER: clientCode = selected, locationCode = 2840 (Global)\nSORT: searchVolume DESC\nOUTPUT: Top 10 keywords with volume as balloons',
                status: 'Info',
                queryType: 'keyword-volume',
                config: {
                    location: 'global',
                    limit: 10,
                },
                sourceInfo: {
                    tables: ['keyword_api_data.json'],
                    page: 'Keyword API Data',
                    pageUrl: '/client/keyword-api-data'
                },
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'Q004',
                queryNumber: '2.3',
                groupId: 'GRP-002',
                title: 'Top 20 Searched Keywords in India and World',
                description: 'Shows top 20 keywords by search volume from both India and Global locations',
                tooltip: 'TABLE: keyword_api_data.json\nFILTER: clientCode = selected, location = India OR Global\nSORT: searchVolume DESC\nOUTPUT: Top 20 deduplicated keywords with volume',
                status: 'Info',
                queryType: 'keyword-volume',
                config: {
                    location: 'both',
                    limit: 20,
                },
                sourceInfo: {
                    tables: ['keyword_api_data.json'],
                    page: 'Keyword API Data',
                    pageUrl: '/client/keyword-api-data'
                },
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'Q005',
                queryNumber: '3.1',
                groupId: 'GRP-003',
                title: 'Client Top Keywords in India and Global with Volume and Ranking',
                description: 'Summary of Top 3 and Top 10 keyword rankings for client domains',
                tooltip: 'TABLE: domain_keywords.json\nFILTER: clientCode = selected, domain IN client.domains (normalized), position 1-10\nBUCKETS: Top 3 (pos 1-3), Top 10 (pos 4-10) for India + Global\nOUTPUT: Summary counts + Top 5 India + Top 5 Global by volume',
                status: 'Info',
                queryType: 'client-rankings',
                config: {},
                sourceInfo: {
                    tables: ['domain_keywords.json'],
                    page: 'Domain Keywords',
                    pageUrl: '/client/domain-keywords'
                },
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'Q006',
                queryNumber: '4.1',
                groupId: 'GRP-004',
                title: 'Keywords Where Client is Absent',
                description: 'High-volume keywords where competitors rank but client is missing from Top 10',
                tooltip: 'TABLE: client_positions.json + keyword_api_data.json\\nFILTER: clientCode = selected, position = \"-\" (absent) OR position > 10\\nSORT: volume DESC\\nOUTPUT: Top 10 keywords with highest volume\\n\\n* We should have used domain_keywords, but the data is not ready as there are many irrelevant keywords that exist.',
                status: 'Warning',
                queryType: 'keywords-absence',
                config: {
                    limit: 10,
                },
                sourceInfo: {
                    tables: ['client_positions.json', 'keyword_api_data.json'],
                    page: 'Client Positions',
                    pageUrl: '/client/positions'
                },
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'Q007',
                queryNumber: '4.2',
                groupId: 'GRP-004',
                title: 'Client Vs Competitor Strength',
                description: 'Client domains and top 5 Main Competitors with importance scores',
                tooltip: 'TABLE: clients.json + competitors.json\nFILTER: competitionType = "Main Competitor", isActive = true\nSORT: importanceScore DESC\nOUTPUT: Client domains (score=100) + Top 5 competitors\n\nSCORE DEFINITION: The score (0-100) represents the competitive strength based on keyword overlap, ranking positions, and domain authority. Client domains always get score=100 as baseline.',
                status: 'Info',
                queryType: 'competitor-global',
                config: {
                    limit: 5,
                },
                sourceInfo: {
                    tables: ['clients.json', 'competitors.json'],
                    page: 'Competitors',
                    pageUrl: '/report/competitors'
                },
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'Q008',
                queryNumber: '5.1',
                groupId: 'GRP-005',
                title: 'Market Size - Keyword Volume Share',
                description: 'Client vs Competitor keyword volume share based on domain_keywords table',
                tooltip: 'TABLE: domain_keywords.json\nFORMULA WITH CTR MODEL:\nA) Total Market Volume = Sum of unique keyword search volumes\nB) Client Volume = Sum of unique keyword volumes for client domains\nC) Client Traffic = Sum of (Volume × CTR) based on ranking position\nD) Traffic % = C/A × 100\n\nCTR MODEL:\nPos 1=30%, Pos 2=17.5%, Pos 3=12%, Pos 4=8%, Pos 5=6%\nPos 6=4%, Pos 7=3%, Pos 8=2%, Pos 9=1.5%, Pos 10=1%\nPos 11-15=0.5%, Pos 16-20=0.3%, Pos 21+=~0%\n\nClick CTR? link on dashboard to see full model.',
                status: 'Critical',
                queryType: 'market-size',
                config: {
                    limit: 5,
                },
                sourceInfo: {
                    tables: ['domain_keywords.json'],
                    page: 'Domain Keywords',
                    pageUrl: '/client/domain-keywords'
                },
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'Q009',
                queryNumber: '4.3',
                groupId: 'GRP-004',
                title: 'Domain-wise Organic Traffic (ETV) Comparison',
                description: 'Compare ETV between client domains (Self) and Main Competitors with India/Global breakdown',
                tooltip: 'TABLES: competitors.json + domain_overview.json\nETV = Estimated Traffic Value ($ value of organic traffic based on equivalent Google Ads cost)\nFormula: ETV = Σ (Keyword Traffic × Keyword CPC)\n\nShows:\n• Self domains (client) with light blue highlight\n• Main Competitor domains\n• ETV for India, Global, and Total\n• Keyword counts for India and Global\n\nHigher ETV = more valuable organic presence.',
                status: 'Info',
                queryType: 'etv-comparison',
                config: {
                    limit: 10,
                },
                sourceInfo: {
                    tables: ['competitors.json', 'domain_overview.json'],
                    page: 'Domain Overview',
                    pageUrl: '/client/domain-overview'
                },
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'Q010',
                queryNumber: '2.4',
                groupId: 'GRP-002',
                title: 'Keyword Opportunity & Risk Matrix',
                description: 'Classify keywords by ranking position and volume percentile to prioritize SEO actions',
                tooltip: 'TABLE: domain_keywords.json\\nFILTER: clientCode = selected, position > 0\\n\\nMATRIX LOGIC:\\n• Rank Buckets: Top (1-10), Medium (11-30), Low (31+)\\n• Volume Buckets: High (≥P70), Low (<P70) calculated per dataset\\n\\nOPPORTUNITY TYPES:\\n• Defensive/Core Asset (Top+High) → Critical priority\\n• Low-Hanging Fruit (Medium+High) → Very High priority\\n• Strategic/Long-Term (Low+High) → Medium-High priority\\n• Secondary Opportunity (Medium+Low) → Medium priority\\n• Stable/Low Risk (Top+Low) → Low priority\\n• Ignore/Deprioritize (Low+Low) → No action',
                status: 'Info',
                queryType: 'keyword-opportunity-matrix',
                config: {
                    limit: 50,
                },
                sourceInfo: {
                    tables: ['domain_keywords.json'],
                    page: 'Domain Keywords',
                    pageUrl: '/client/domain-keywords'
                },
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'Q011',
                queryNumber: '2.5',
                groupId: 'GRP-002',
                title: 'Brand Power Analysis',
                description: 'Compare brand strength between Self and Main Competitor domains',
                tooltip: 'TABLE: domain_keywords.json + AI Term Dictionary\\nFILTER: Keywords containing terms with bucket=brand from AI Keyword Builder\\n\\nMATRIX LOGIC:\\n• Rank Buckets: Top (1-10), Medium (11-30), Low (31+)\\n• Volume Buckets: High (≥P25), Low (<P25) - Top 25% threshold\\n\\nBRAND KEYWORDS: Keywords containing brand terms like company names, product lines etc.',
                status: 'Info',
                queryType: 'brand-keywords-matrix',
                config: {
                    limit: 50,
                },
                sourceInfo: {
                    tables: ['domain_keywords.json', 'ai_term_dictionary.json'],
                    page: 'AI Keyword Builder',
                    pageUrl: '/client/domain-keywords'
                },
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        ];
        await writeQueries(seedQueries);
        queriesCreated = seedQueries.length;
    } else {
        // Check for missing queries and add them (upgrade scenario)
        const existingIds = new Set(existingQueries.map(q => q.id));

        // Q011 - Brand Keywords Matrix
        if (!existingIds.has('Q011')) {
            const q011: DashboardQueryDefinition = {
                id: 'Q011',
                queryNumber: '2.5',
                groupId: 'GRP-002',
                title: 'Brand Power Analysis',
                description: 'Compare brand strength between Self and Main Competitor domains',
                tooltip: 'TABLE: domain_keywords.json + AI Term Dictionary\\nFILTER: Keywords containing terms with bucket=brand from AI Keyword Builder\\n\\nMATRIX LOGIC:\\n• Rank Buckets: Top (1-10), Medium (11-30), Low (31+)\\n• Volume Buckets: High (≥P25), Low (<P25) - Top 25% threshold\\n\\nBRAND KEYWORDS: Keywords containing brand terms like company names, product lines etc.',
                status: 'Info',
                queryType: 'brand-keywords-matrix',
                config: { limit: 50 },
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            existingQueries.push(q011);
            await writeQueries(existingQueries);
            queriesCreated++;
        }
    }

    return { groupsCreated, queriesCreated };
}

