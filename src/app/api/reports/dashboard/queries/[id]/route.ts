import { NextResponse } from 'next/server';
import {
    getQueryById,
    updateQuery,
    deleteQuery,
} from '@/lib/storage/dashboardQueryStore';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/reports/dashboard/queries/[id] - Get a single query
export async function GET(request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;
        const query = await getQueryById(id);

        if (!query) {
            return NextResponse.json(
                { success: false, error: 'Query not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, query });
    } catch (error) {
        console.error('Failed to fetch query:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch query' },
            { status: 500 }
        );
    }
}

// PUT /api/reports/dashboard/queries/[id] - Update a query
export async function PUT(request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;
        const body = await request.json();

        const query = await updateQuery(id, body);

        if (!query) {
            return NextResponse.json(
                { success: false, error: 'Query not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, query });
    } catch (error) {
        console.error('Failed to update query:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update query' },
            { status: 500 }
        );
    }
}

// DELETE /api/reports/dashboard/queries/[id] - Delete a query
export async function DELETE(request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;
        const deleted = await deleteQuery(id);

        if (!deleted) {
            return NextResponse.json(
                { success: false, error: 'Query not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, message: 'Query deleted' });
    } catch (error) {
        console.error('Failed to delete query:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete query' },
            { status: 500 }
        );
    }
}
