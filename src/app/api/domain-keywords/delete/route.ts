import { NextRequest, NextResponse } from 'next/server';
import { deleteDomainKeywordsByDomains } from '@/lib/domainOverviewStore';

// DELETE /api/domain-keywords/delete - Delete keywords for specified domains
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { clientCode, locationCode, domains } = body;

        if (!clientCode) {
            return NextResponse.json(
                { success: false, error: 'clientCode is required' },
                { status: 400 }
            );
        }

        if (!domains || !Array.isArray(domains) || domains.length === 0) {
            return NextResponse.json(
                { success: false, error: 'domains array is required and must not be empty' },
                { status: 400 }
            );
        }

        const deletedCount = await deleteDomainKeywordsByDomains(
            clientCode,
            locationCode || null,
            domains
        );

        return NextResponse.json({
            success: true,
            deletedCount,
            message: `Deleted ${deletedCount} keyword records for ${domains.length} domain(s)`,
        });
    } catch (error) {
        console.error('Error deleting domain keywords:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { success: false, error: `Failed to delete domain keywords: ${errorMessage}` },
            { status: 500 }
        );
    }
}
