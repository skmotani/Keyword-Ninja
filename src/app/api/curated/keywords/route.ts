import { NextResponse } from 'next/server';
import { getCuratedKeywords } from '@/lib/curatedStore';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const clientCode = searchParams.get('clientCode');

    // We fetch all or filter by client
    // Security: In a real app we'd check user permissions, but here we assume if they can access the page, they can fetch.
    const data = await getCuratedKeywords(clientCode || undefined);
    return NextResponse.json({ success: true, data });
}
