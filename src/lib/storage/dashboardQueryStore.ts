import { promises as fs } from 'fs';
import path from 'path';
import { QueryGroup, DashboardQueryDefinition } from '@/types/dashboardTypes';
import { prisma } from '@/lib/prisma';

const USE_POSTGRES = process.env.USE_POSTGRES_DASHBOARD_QUERIES === 'true';
const DATA_DIR = path.join(process.cwd(), 'data');
const QUERY_GROUPS_FILE = 'dashboard_query_groups.json';
const QUERIES_FILE = 'dashboard_queries.json';
const SEED_FILE = 'dashboard_queries_seed.json';

// ============================================
// Query Groups
// ============================================

async function readQueryGroups(): Promise<QueryGroup[]> {
    if (USE_POSTGRES) {
        const records = await prisma.dashboardQueryGroup.findMany({ orderBy: { displayOrder: 'asc' } });
        return records.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description ?? undefined,
            order: r.displayOrder,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
        }));
    }
    try {
        const filePath = path.join(DATA_DIR, QUERY_GROUPS_FILE);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as QueryGroup[];
    } catch {
        return [];
    }
}

async function writeQueryGroups(groups: QueryGroup[]): Promise<void> {
    if (USE_POSTGRES) return;
    const filePath = path.join(DATA_DIR, QUERY_GROUPS_FILE);
    await fs.writeFile(filePath, JSON.stringify(groups, null, 2), 'utf-8');
}

export async function getQueryGroups(): Promise<QueryGroup[]> {
    return readQueryGroups();
}

export async function getQueryGroupById(id: string): Promise<QueryGroup | null> {
    if (USE_POSTGRES) {
        const record = await prisma.dashboardQueryGroup.findUnique({ where: { id } });
        if (!record) return null;
        return {
            id: record.id,
            name: record.name,
            description: record.description ?? undefined,
            order: record.displayOrder,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
        };
    }
    const groups = await readQueryGroups();
    return groups.find(g => g.id === id) || null;
}

export async function createQueryGroup(
    group: Omit<QueryGroup, 'id' | 'createdAt' | 'updatedAt'>
): Promise<QueryGroup> {
    if (USE_POSTGRES) {
        const id = `GRP-${Date.now()}`;
        const record = await prisma.dashboardQueryGroup.create({
            data: { id, name: group.name, description: group.description, displayOrder: group.order ?? 0 }
        });
        return {
            id: record.id,
            name: record.name,
            description: record.description ?? undefined,
            order: record.displayOrder,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
        };
    }
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
    if (USE_POSTGRES) {
        try {
            const record = await prisma.dashboardQueryGroup.update({
                where: { id },
                data: { name: updates.name, description: updates.description, displayOrder: updates.order, updatedAt: new Date() }
            });
            return {
                id: record.id,
                name: record.name,
                description: record.description ?? undefined,
                order: record.displayOrder,
                createdAt: record.createdAt.toISOString(),
                updatedAt: record.updatedAt.toISOString(),
            };
        } catch {
            return null;
        }
    }
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
    if (USE_POSTGRES) {
        try {
            await prisma.dashboardQueryGroup.delete({ where: { id } });
            return true;
        } catch {
            return false;
        }
    }
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
    if (USE_POSTGRES) {
        const records = await prisma.dashboardQuery.findMany();
        return records.map(r => ({
            id: r.id,
            queryNumber: r.queryNumber ?? undefined,
            groupId: r.groupId ?? undefined,
            title: r.title,
            description: r.description ?? undefined,
            tooltip: r.tooltip ?? undefined,
            status: r.status as any ?? 'active',
            queryType: r.queryType ?? undefined,
            config: r.config as any ?? {},
            sourceInfo: r.sourceInfo as any ?? {},
            isActive: r.isActive,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
        }));
    }
    try {
        const filePath = path.join(DATA_DIR, QUERIES_FILE);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as DashboardQueryDefinition[];
    } catch {
        return [];
    }
}

async function writeQueries(queries: DashboardQueryDefinition[]): Promise<void> {
    if (USE_POSTGRES) return;
    const filePath = path.join(DATA_DIR, QUERIES_FILE);
    await fs.writeFile(filePath, JSON.stringify(queries, null, 2), 'utf-8');
}

export async function getQueries(): Promise<DashboardQueryDefinition[]> {
    return readQueries();
}

export async function getActiveQueries(): Promise<DashboardQueryDefinition[]> {
    if (USE_POSTGRES) {
        const records = await prisma.dashboardQuery.findMany({ where: { isActive: true } });
        return records.map(r => ({
            id: r.id,
            queryNumber: r.queryNumber ?? undefined,
            groupId: r.groupId ?? undefined,
            title: r.title,
            description: r.description ?? undefined,
            tooltip: r.tooltip ?? undefined,
            status: r.status as any ?? 'active',
            queryType: r.queryType ?? undefined,
            config: r.config as any ?? {},
            sourceInfo: r.sourceInfo as any ?? {},
            isActive: r.isActive,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
        }));
    }
    const queries = await readQueries();
    return queries.filter(q => q.isActive);
}

export async function getQueryById(id: string): Promise<DashboardQueryDefinition | null> {
    if (USE_POSTGRES) {
        const record = await prisma.dashboardQuery.findUnique({ where: { id } });
        if (!record) return null;
        return {
            id: record.id,
            queryNumber: record.queryNumber ?? undefined,
            groupId: record.groupId ?? undefined,
            title: record.title,
            description: record.description ?? undefined,
            tooltip: record.tooltip ?? undefined,
            status: record.status as any ?? 'active',
            queryType: record.queryType ?? undefined,
            config: record.config as any ?? {},
            sourceInfo: record.sourceInfo as any ?? {},
            isActive: record.isActive,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
        };
    }
    const queries = await readQueries();
    return queries.find(q => q.id === id) || null;
}

export async function getQueriesByGroup(groupId: string): Promise<DashboardQueryDefinition[]> {
    if (USE_POSTGRES) {
        const records = await prisma.dashboardQuery.findMany({ where: { groupId, isActive: true } });
        return records.map(r => ({
            id: r.id,
            queryNumber: r.queryNumber ?? undefined,
            groupId: r.groupId ?? undefined,
            title: r.title,
            description: r.description ?? undefined,
            tooltip: r.tooltip ?? undefined,
            status: r.status as any ?? 'active',
            queryType: r.queryType ?? undefined,
            config: r.config as any ?? {},
            sourceInfo: r.sourceInfo as any ?? {},
            isActive: r.isActive,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
        }));
    }
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
    const id = await getNextQueryId();

    if (USE_POSTGRES) {
        const record = await prisma.dashboardQuery.create({
            data: {
                id,
                queryNumber: query.queryNumber,
                groupId: query.groupId,
                title: query.title,
                description: query.description,
                tooltip: query.tooltip,
                status: query.status,
                queryType: query.queryType,
                config: query.config,
                sourceInfo: query.sourceInfo,
                isActive: query.isActive ?? true,
            }
        });
        return {
            id: record.id,
            queryNumber: record.queryNumber ?? undefined,
            groupId: record.groupId ?? undefined,
            title: record.title,
            description: record.description ?? undefined,
            tooltip: record.tooltip ?? undefined,
            status: record.status as any ?? 'active',
            queryType: record.queryType ?? undefined,
            config: record.config as any ?? {},
            sourceInfo: record.sourceInfo as any ?? {},
            isActive: record.isActive,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
        };
    }

    const queries = await readQueries();
    const now = new Date().toISOString();
    const newQuery: DashboardQueryDefinition = { ...query, id, createdAt: now, updatedAt: now };
    queries.push(newQuery);
    await writeQueries(queries);
    return newQuery;
}

export async function updateQuery(
    id: string,
    updates: Partial<Omit<DashboardQueryDefinition, 'id' | 'createdAt'>>
): Promise<DashboardQueryDefinition | null> {
    if (USE_POSTGRES) {
        try {
            const record = await prisma.dashboardQuery.update({
                where: { id },
                data: { ...updates, updatedAt: new Date() }
            });
            return {
                id: record.id,
                queryNumber: record.queryNumber ?? undefined,
                groupId: record.groupId ?? undefined,
                title: record.title,
                description: record.description ?? undefined,
                tooltip: record.tooltip ?? undefined,
                status: record.status as any ?? 'active',
                queryType: record.queryType ?? undefined,
                config: record.config as any ?? {},
                sourceInfo: record.sourceInfo as any ?? {},
                isActive: record.isActive,
                createdAt: record.createdAt.toISOString(),
                updatedAt: record.updatedAt.toISOString(),
            };
        } catch {
            return null;
        }
    }
    const queries = await readQueries();
    const index = queries.findIndex(q => q.id === id);
    if (index === -1) return null;

    queries[index] = { ...queries[index], ...updates, updatedAt: new Date().toISOString() };
    await writeQueries(queries);
    return queries[index];
}

export async function deleteQuery(id: string): Promise<boolean> {
    if (USE_POSTGRES) {
        try {
            await prisma.dashboardQuery.delete({ where: { id } });
            return true;
        } catch {
            return false;
        }
    }
    const queries = await readQueries();
    const filtered = queries.filter(q => q.id !== id);
    if (filtered.length === queries.length) return false;
    await writeQueries(filtered);
    return true;
}

// ============================================
// Seed Data Initialization
// ============================================

async function readSeedQueries(): Promise<DashboardQueryDefinition[]> {
    try {
        const filePath = path.join(DATA_DIR, SEED_FILE);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as DashboardQueryDefinition[];
    } catch {
        return [];
    }
}

export async function initializeSeedData(): Promise<{ groupsCreated: number; queriesCreated: number }> {
    let groupsCreated = 0;
    let queriesCreated = 0;

    const existingGroups = await readQueryGroups();
    if (existingGroups.length === 0) {
        const seedGroups: QueryGroup[] = [
            { id: 'GRP-001', name: 'Digital Footprint', description: 'Queries analyzing your business digital presence', order: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: 'GRP-002', name: 'Keyword Analysis', description: 'Keyword volume and position analysis queries', order: 2, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: 'GRP-003', name: 'Know Your Turf', description: 'Client keyword rankings and market presence analysis', order: 3, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: 'GRP-004', name: 'Competitive Intelligence', description: 'Competitor analysis and opportunity identification', order: 4, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: 'GRP-005', name: 'Market Size', description: 'Traffic share and market opportunity analysis', order: 5, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        ];

        if (USE_POSTGRES) {
            for (const g of seedGroups) {
                await prisma.dashboardQueryGroup.upsert({
                    where: { id: g.id },
                    update: {},
                    create: { id: g.id, name: g.name, description: g.description, displayOrder: g.order ?? 0 }
                });
            }
        } else {
            await writeQueryGroups(seedGroups);
        }
        groupsCreated = seedGroups.length;
    }

    const seedQueries = await readSeedQueries();
    const activeQueries = await readQueries();
    const activeMap = new Map(activeQueries.map(q => [q.id, q]));
    let updatesNeeded = false;

    if (seedQueries.length > 0) {
        for (const seedQ of seedQueries) {
            const activeQ = activeMap.get(seedQ.id);

            if (!activeQ) {
                if (USE_POSTGRES) {
                    await prisma.dashboardQuery.create({
                        data: {
                            id: seedQ.id,
                            queryNumber: seedQ.queryNumber,
                            groupId: seedQ.groupId,
                            title: seedQ.title,
                            description: seedQ.description,
                            tooltip: seedQ.tooltip,
                            status: seedQ.status,
                            queryType: seedQ.queryType,
                            config: seedQ.config,
                            sourceInfo: seedQ.sourceInfo,
                            isActive: seedQ.isActive ?? true,
                        }
                    });
                } else {
                    activeQueries.push(seedQ);
                }
                updatesNeeded = true;
                queriesCreated++;
            } else if (activeQ.queryType !== seedQ.queryType) {
                Object.assign(activeQ, {
                    queryType: seedQ.queryType,
                    sourceInfo: seedQ.sourceInfo,
                    title: seedQ.title,
                    description: seedQ.description,
                    tooltip: seedQ.tooltip
                });
                updatesNeeded = true;
            }
        }
    }

    if (updatesNeeded && !USE_POSTGRES) {
        await writeQueries(activeQueries);
    }

    return { groupsCreated, queriesCreated };
}
