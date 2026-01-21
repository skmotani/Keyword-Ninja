/**
 * Scan History API
 * 
 * GET /api/digital-footprint/scan/history?clientId=xxx
 * 
 * Returns last 20 scans for a client with summary counts
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface ScanHistoryItem {
    id: string;
    clientId: string;
    clientName: string;
    mode: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    summary: {
        total: number;
        counts: Record<string, number>;
        presentCount: number;
        absentCount: number;
        score: number;
    } | null;
}

export async function GET(request: NextRequest) {
    const clientId = request.nextUrl.searchParams.get('clientId');

    try {
        // Use raw SQL to avoid Prisma client regeneration issues
        let scans: Array<{
            id: string;
            clientId: string;
            clientName: string;
            mode: string;
            status: string;
            startedAt: Date | null;
            completedAt: Date | null;
            summary: unknown;
        }>;

        if (clientId) {
            scans = await prisma.$queryRaw`
                SELECT id, "clientId", "clientName", mode, status, "startedAt", "completedAt", summary
                FROM digital_footprint_scans
                WHERE "clientId" = ${clientId}
                ORDER BY "createdAt" DESC
                LIMIT 20
            `;
        } else {
            scans = await prisma.$queryRaw`
                SELECT id, "clientId", "clientName", mode, status, "startedAt", "completedAt", summary
                FROM digital_footprint_scans
                ORDER BY "createdAt" DESC
                LIMIT 20
            `;
        }

        // Format response
        const history: ScanHistoryItem[] = scans.map(scan => ({
            id: scan.id,
            clientId: scan.clientId,
            clientName: scan.clientName,
            mode: scan.mode,
            status: scan.status,
            startedAt: scan.startedAt?.toISOString() || '',
            completedAt: scan.completedAt?.toISOString() || null,
            summary: scan.summary as ScanHistoryItem['summary'],
        }));

        return NextResponse.json({
            scans: history,
            count: history.length,
        });

    } catch (error) {
        console.error('Scan history error:', error);
        return NextResponse.json({
            error: 'Failed to fetch scan history',
            details: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
