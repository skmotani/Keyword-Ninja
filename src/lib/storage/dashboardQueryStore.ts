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

const SEED_FILE = 'dashboard_queries_seed.json';

// ... (keep existing imports)

async function readSeedQueries(): Promise<DashboardQueryDefinition[]> {
    try {
        const filePath = path.join(DATA_DIR, SEED_FILE);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as DashboardQueryDefinition[];
    } catch {
        return [];
    }
}

// ... (keep existing functions)

// ============================================
// Seed Data Initialization
// ============================================

export async function initializeSeedData(): Promise<{ groupsCreated: number; queriesCreated: number }> {
    let groupsCreated = 0;
    let queriesCreated = 0;

    // Check if groups exist (Keep existing group logic for now)
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

    // Sync Queries from Seed File
    const seedQueries = await readSeedQueries();
    const activeQueries = await readQueries();
    const activeMap = new Map(activeQueries.map(q => [q.id, q]));
    let updatesNeeded = false;

    if (seedQueries.length > 0) {
        for (const seedQ of seedQueries) {
            const activeQ = activeMap.get(seedQ.id);

            if (!activeQ) {
                // New query in code: Add to active
                activeQueries.push(seedQ);
                updatesNeeded = true;
                queriesCreated++;
            } else if (activeQ.queryType !== seedQ.queryType) {
                // Logic change (code update): Sync critical fields
                // We preserve user config/status, but update implementation details
                Object.assign(activeQ, {
                    queryType: seedQ.queryType,
                    sourceInfo: seedQ.sourceInfo,
                    title: seedQ.title, // Update default title
                    description: seedQ.description,
                    tooltip: seedQ.tooltip
                });
                updatesNeeded = true;
            }
        }
    } else {
        // Fallback if seed file is missing (should not happen if deployed correctly)
        // But preventing empty active queries if missing
        if (activeQueries.length === 0) {
            // ... (We could restore the hardcoded fallback here, but better to rely on seed file)
            // If seed is empty, we do nothing.
        }
    }

    if (updatesNeeded) {
        await writeQueries(activeQueries);
    }

    return { groupsCreated, queriesCreated };
}

