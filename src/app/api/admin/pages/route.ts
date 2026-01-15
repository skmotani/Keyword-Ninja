import { NextResponse } from 'next/server';
import { getPageConfigs } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const configs = await getPageConfigs();
        // Sort by path for now
        configs.sort((a, b) => a.path.localeCompare(b.path));

        return NextResponse.json(configs);
    } catch (error) {
        console.error('Failed to fetch page configs:', error);
        return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 });
    }
}
