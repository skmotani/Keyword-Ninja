import { NextResponse } from 'next/server';
import {
    getQueryGroups,
    createQueryGroup,
    initializeSeedData,
} from '@/lib/storage/dashboardQueryStore';

// GET /api/reports/dashboard/query-groups - List all query groups
export async function GET() {
    try {
        // Initialize seed data if needed
        await initializeSeedData();

        const groups = await getQueryGroups();
        return NextResponse.json({
            success: true,
            groups: groups.sort((a, b) => a.order - b.order),
        });
    } catch (error) {
        console.error('Failed to fetch query groups:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch query groups' },
            { status: 500 }
        );
    }
}

// POST /api/reports/dashboard/query-groups - Create a new query group
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, description, order } = body;

        if (!name) {
            return NextResponse.json(
                { success: false, error: 'Name is required' },
                { status: 400 }
            );
        }

        const group = await createQueryGroup({
            name,
            description: description || '',
            order: order || 999,
        });

        return NextResponse.json({ success: true, group });
    } catch (error) {
        console.error('Failed to create query group:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create query group' },
            { status: 500 }
        );
    }
}
