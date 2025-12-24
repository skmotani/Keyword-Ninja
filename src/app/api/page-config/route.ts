import { NextRequest, NextResponse } from 'next/server';
import { getPageConfig, savePageConfig } from '@/lib/db';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');

    if (!path) {
        return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    const config = await getPageConfig(path);
    return NextResponse.json(config || { path, userDescription: '', updatedAt: '' });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.path) {
            return NextResponse.json({ error: 'Path is required' }, { status: 400 });
        }

        const saved = await savePageConfig({
            path: body.path,
            userDescription: body.userDescription || '',
            updatedAt: new Date().toISOString()
        });

        return NextResponse.json(saved);
    } catch (error) {
        console.error('Failed to save page config:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
