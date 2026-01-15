import { NextRequest, NextResponse } from 'next/server';
import { getPageConfig, savePageConfig } from '@/lib/db';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');

    if (!path) {
        return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    let config = await getPageConfig(path);

    if (!config) {
        // Auto-register page on first visit
        config = {
            path,
            userDescription: '',
            comments: [],
            updatedAt: new Date().toISOString()
        };
        await savePageConfig(config);
    }

    return NextResponse.json(config);
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.path) {
            return NextResponse.json({ error: 'Path is required' }, { status: 400 });
        }

        const updateData: any = {
            path: body.path,
            updatedAt: new Date().toISOString()
        };

        if (body.userDescription !== undefined) {
            updateData.userDescription = body.userDescription;
        }

        if (body.comments !== undefined) {
            updateData.comments = body.comments;
        }

        const saved = await savePageConfig(updateData);

        return NextResponse.json(saved);
    } catch (error) {
        console.error('Failed to save page config:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
