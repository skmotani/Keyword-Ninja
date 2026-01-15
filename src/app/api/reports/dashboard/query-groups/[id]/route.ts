import { NextResponse } from 'next/server';
import {
    getQueryGroupById,
    updateQueryGroup,
    deleteQueryGroup,
} from '@/lib/storage/dashboardQueryStore';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/reports/dashboard/query-groups/[id] - Get a single query group
export async function GET(request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;
        const group = await getQueryGroupById(id);

        if (!group) {
            return NextResponse.json(
                { success: false, error: 'Query group not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, group });
    } catch (error) {
        console.error('Failed to fetch query group:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch query group' },
            { status: 500 }
        );
    }
}

// PUT /api/reports/dashboard/query-groups/[id] - Update a query group
export async function PUT(request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { name, description, order } = body;

        const group = await updateQueryGroup(id, {
            ...(name && { name }),
            ...(description !== undefined && { description }),
            ...(order !== undefined && { order }),
        });

        if (!group) {
            return NextResponse.json(
                { success: false, error: 'Query group not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, group });
    } catch (error) {
        console.error('Failed to update query group:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update query group' },
            { status: 500 }
        );
    }
}

// DELETE /api/reports/dashboard/query-groups/[id] - Delete a query group
export async function DELETE(request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;
        const deleted = await deleteQueryGroup(id);

        if (!deleted) {
            return NextResponse.json(
                { success: false, error: 'Query group not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, message: 'Query group deleted' });
    } catch (error) {
        console.error('Failed to delete query group:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete query group' },
            { status: 500 }
        );
    }
}
