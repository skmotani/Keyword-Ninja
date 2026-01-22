import { NextResponse } from 'next/server';
import {
    getActiveQueries,
    getQueriesByGroup,
    createQuery,
    initializeSeedData,
} from '@/lib/storage/dashboardQueryStore';
import { QueryStatus } from '@/types/dashboardTypes';

// GET /api/reports/dashboard/queries - List all queries
export async function GET(request: Request) {
    try {
        // Initialize seed data if needed
        await initializeSeedData();

        const { searchParams } = new URL(request.url);
        const groupId = searchParams.get('groupId');

        let queries;
        if (groupId) {
            queries = await getQueriesByGroup(groupId);
        } else {
            queries = await getActiveQueries();
        }

        // Sort by query number (handle undefined)
        queries.sort((a, b) => (a.queryNumber || '').localeCompare(b.queryNumber || ''));

        return NextResponse.json({ success: true, queries });
    } catch (error) {
        console.error('Failed to fetch queries:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch queries' },
            { status: 500 }
        );
    }
}

// POST /api/reports/dashboard/queries - Create a new query
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            queryNumber,
            groupId,
            title,
            description,
            status,
            queryType,
            config,
        } = body;

        if (!title || !groupId || !queryType) {
            return NextResponse.json(
                { success: false, error: 'Title, groupId, and queryType are required' },
                { status: 400 }
            );
        }

        const query = await createQuery({
            queryNumber: queryNumber || '0.0',
            groupId,
            title,
            description: description || '',
            status: (status as QueryStatus) || 'Info',
            queryType,
            config: config || {},
            isActive: true,
        });

        return NextResponse.json({ success: true, query });
    } catch (error) {
        console.error('Failed to create query:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create query' },
            { status: 500 }
        );
    }
}
