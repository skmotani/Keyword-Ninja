import { NextResponse } from 'next/server';
import { runDiscoveryScan } from '@/lib/exportDiscovery';

/**
 * POST /api/reports/client-data-export/refresh
 * Runs discovery scan to register/update all exportable pages
 */
export async function POST() {
    try {
        const result = await runDiscoveryScan();

        return NextResponse.json({
            success: true,
            ...result,
            message: `Discovered ${result.pagesDiscovered} pages with ${result.columnsRegistered} total columns.`,
        });
    } catch (error) {
        console.error('Failed to run discovery scan:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to run discovery scan',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
