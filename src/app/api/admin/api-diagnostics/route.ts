/**
 * API Diagnostics Route
 * View DataForSEO API call logs and diagnostics
 * 
 * Usage:
 *   GET /api/admin/api-diagnostics              - Get recent logs
 *   GET /api/admin/api-diagnostics?limit=50     - Limit results
 *   GET /api/admin/api-diagnostics?action=summary - Get summary only
 *   DELETE /api/admin/api-diagnostics           - Clear all logs
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    getLogEntries,
    getDiagnosticsSummary,
    clearLogs,
    ApiLogStatus,
} from '@/lib/dataforseo/index';

// ============================================================================
// GET: Retrieve logs and diagnostics
// ============================================================================

export async function GET(request: NextRequest) {
    console.log('[API /admin/api-diagnostics] GET request');

    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');
        const limit = parseInt(searchParams.get('limit') || '100');
        const status = searchParams.get('status') as ApiLogStatus | null;
        const endpoint = searchParams.get('endpoint');

        // Summary only
        if (action === 'summary') {
            const summary = await getDiagnosticsSummary();
            return NextResponse.json({
                success: true,
                summary,
            });
        }

        // Get log entries with filters
        const entries = await getLogEntries({
            limit,
            status: status || undefined,
            endpoint: endpoint || undefined,
        });

        const summary = await getDiagnosticsSummary();

        return NextResponse.json({
            success: true,
            entries,
            count: entries.length,
            summary,
        });

    } catch (error) {
        console.error('[API /admin/api-diagnostics] GET error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { success: false, error: `Failed to get diagnostics: ${message}` },
            { status: 500 }
        );
    }
}

// ============================================================================
// DELETE: Clear all logs
// ============================================================================

export async function DELETE(request: NextRequest) {
    console.log('[API /admin/api-diagnostics] DELETE request - Clearing logs');

    try {
        await clearLogs();

        return NextResponse.json({
            success: true,
            message: 'All API logs have been cleared',
            clearedAt: new Date().toISOString(),
        });

    } catch (error) {
        console.error('[API /admin/api-diagnostics] DELETE error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { success: false, error: `Failed to clear logs: ${message}` },
            { status: 500 }
        );
    }
}
