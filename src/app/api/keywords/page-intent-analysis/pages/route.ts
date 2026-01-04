/**
 * API: GET /api/keywords/page-intent-analysis/pages
 * 
 * Returns URL-level intent details for a specific domain.
 * Used for expanding domain rows to show individual page classifications.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPagesByDomain } from '@/lib/storage/pageIntentStore';

export async function GET(request: NextRequest) {
    const startTime = Date.now();
    const searchParams = request.nextUrl.searchParams;
    const clientCode = searchParams.get('clientCode');
    const domain = searchParams.get('domain');

    console.log(`[PageIntentPages] GET request - clientCode: ${clientCode}, domain: ${domain}`);

    if (!clientCode) {
        return NextResponse.json(
            { error: 'clientCode query parameter is required' },
            { status: 400 }
        );
    }

    if (!domain) {
        return NextResponse.json(
            { error: 'domain query parameter is required' },
            { status: 400 }
        );
    }

    try {
        const pages = await getPagesByDomain(clientCode, domain);

        console.log(`[PageIntentPages] Returning ${pages.length} pages in ${Date.now() - startTime}ms`);

        return NextResponse.json({
            domain,
            pages,
        });
    } catch (error) {
        console.error('[PageIntentPages] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch page data', details: String(error) },
            { status: 500 }
        );
    }
}
