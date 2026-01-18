import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getActiveQueries } from '@/lib/storage/dashboardQueryStore';

const DATA_FILE = path.join(process.cwd(), 'data', 'dashboard_query_customizations.json');

interface QueryCustomization {
    queryId: string;
    customTitle?: string;
    pageTitle?: string;      // New: Title for the report page
    pageContent?: string;    // New: Content description
    updatedAt: string;
}

interface CategoryCustomization {
    groupId: string;
    customName?: string;
    updatedAt: string;
}

interface CustomizationsData {
    queries: QueryCustomization[];
    categories: CategoryCustomization[];
    queryOrder: Record<string, string[]>;  // groupId -> [queryId, queryId, ...]
}

async function readCustomizations(): Promise<CustomizationsData> {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        // Handle legacy format
        if (parsed.customizations) {
            return {
                queries: parsed.customizations.map((c: { queryId: string; customTitle?: string; customDescription?: string }) => ({
                    queryId: c.queryId,
                    customTitle: c.customTitle,
                    pageContent: c.customDescription,
                })),
                categories: [],
                queryOrder: {},
            };
        }
        return {
            queries: parsed.queries || [],
            categories: parsed.categories || [],
            queryOrder: parsed.queryOrder || {},
        };
    } catch {
        return { queries: [], categories: [], queryOrder: {} };
    }
}

async function writeCustomizations(data: CustomizationsData): Promise<void> {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// GET - Get all global customizations
export async function GET() {
    try {
        const data = await readCustomizations();

        // GENERIC SELF-HEALING: Inject Orphan Queries (Fix for Railway Volume drift)
        // This ensures new queries added via code appear on the dashboard even if customization file persists
        const activeQueries = await getActiveQueries();
        const placedQueryIds = new Set<string>();
        Object.values(data.queryOrder).forEach(ids => ids.forEach(id => placedQueryIds.add(id)));

        const orphans = activeQueries.filter(q => !placedQueryIds.has(q.id));
        let updatesNeeded = false;

        if (orphans.length > 0) {
            // Sort orphans by queryNumber to maintain logical order when inserting
            orphans.sort((a, b) => a.queryNumber.localeCompare(b.queryNumber));

            for (const q of orphans) {
                if (!data.queryOrder[q.groupId]) {
                    data.queryOrder[q.groupId] = [];
                }
                // Add to TOP of the group so user notices the new query immediately
                data.queryOrder[q.groupId].unshift(q.id);
                updatesNeeded = true;
            }
        }

        if (updatesNeeded) {
            await writeCustomizations(data);
        }

        // Convert to lookup objects
        const titles: Record<string, string> = {};
        const pageTitles: Record<string, string> = {};
        const pageContents: Record<string, string> = {};
        const categoryNames: Record<string, string> = {};

        for (const q of data.queries) {
            if (q.customTitle) titles[q.queryId] = q.customTitle;
            if (q.pageTitle) pageTitles[q.queryId] = q.pageTitle;
            if (q.pageContent) pageContents[q.queryId] = q.pageContent;
        }

        for (const c of data.categories) {
            if (c.customName) categoryNames[c.groupId] = c.customName;
        }

        return NextResponse.json({
            success: true,
            titles,
            pageTitles,
            pageContents,
            categoryNames,
            queryOrder: data.queryOrder,
        });
    } catch (error) {
        console.error('Failed to get customizations:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to get customizations' },
            { status: 500 }
        );
    }
}

// POST - Save a customization
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { type, queryId, groupId, customTitle, pageTitle, pageContent, customName, queryOrder } = body;

        const data = await readCustomizations();

        if (type === 'query' && queryId) {
            // Update query customization
            const existingIndex = data.queries.findIndex(q => q.queryId === queryId);
            const customization: QueryCustomization = {
                queryId,
                customTitle: customTitle || undefined,
                pageTitle: pageTitle || undefined,
                pageContent: pageContent || undefined,
                updatedAt: new Date().toISOString(),
            };

            if (existingIndex >= 0) {
                data.queries[existingIndex] = { ...data.queries[existingIndex], ...customization };
            } else {
                data.queries.push(customization);
            }
        } else if (type === 'category' && groupId) {
            // Update category customization
            const existingIndex = data.categories.findIndex(c => c.groupId === groupId);
            const customization: CategoryCustomization = {
                groupId,
                customName: customName || undefined,
                updatedAt: new Date().toISOString(),
            };

            if (existingIndex >= 0) {
                data.categories[existingIndex] = { ...data.categories[existingIndex], ...customization };
            } else {
                data.categories.push(customization);
            }
        } else if (type === 'order' && queryOrder) {
            // Update query order
            data.queryOrder = queryOrder;
        } else {
            return NextResponse.json(
                { success: false, error: 'Invalid request: type must be query, category, or order' },
                { status: 400 }
            );
        }

        await writeCustomizations(data);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to save customization:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to save customization' },
            { status: 500 }
        );
    }
}
