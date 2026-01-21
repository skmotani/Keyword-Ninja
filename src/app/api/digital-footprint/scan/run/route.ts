/**
 * Run Digital Footprint Scan
 * 
 * POST /api/digital-footprint/scan/run
 * 
 * Uses Prisma-based scanEngine by default.
 * Falls back to raw SQL only with ?forceRaw=1 in dev mode.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClients } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { Client, CanonicalEntity } from '@/types';

export const maxDuration = 120; // 2 minutes max

interface RunRequest {
    clientId: string;
    mode?: 'CRAWL_ONLY' | 'CRAWL_PLUS_PROVIDER';
}

export async function POST(request: NextRequest) {
    console.log('[SCAN/RUN] Received scan request');

    const forceRaw = request.nextUrl.searchParams.get('forceRaw') === '1';
    const isDev = process.env.NODE_ENV !== 'production';

    try {
        const body: RunRequest = await request.json();

        if (!body.clientId) {
            return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
        }

        console.log(`[SCAN/RUN] Client ID: ${body.clientId}, forceRaw: ${forceRaw}`);

        // Load client
        const clients = await getClients();
        const client = clients.find((c: Client) => c.id === body.clientId);

        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        console.log(`[SCAN/RUN] Client found: ${client.name}`);

        const entity = client.canonicalEntity as CanonicalEntity | null;

        if (!entity?.web?.canonicalDomain) {
            return NextResponse.json({
                error: 'Client has no Canonical Entity with domain configured',
                hint: 'Please set up the Canonical Entity profile first'
            }, { status: 400 });
        }

        console.log(`[SCAN/RUN] Domain: ${entity.web.canonicalDomain}`);

        // Check if Prisma client is properly generated
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prismaClientReady = typeof (prisma as any).digitalFootprintScan?.create === 'function';

        if (!prismaClientReady && !forceRaw) {
            console.error('[SCAN/RUN] ERROR: Prisma client not generated. Run: npx prisma generate');
            return NextResponse.json({
                error: 'Prisma client not generated',
                hint: 'Run: npx prisma generate && restart dev server',
                canForceRaw: isDev,
                forceRawUrl: isDev ? `${request.nextUrl.pathname}?forceRaw=1` : null,
            }, { status: 500 });
        }

        // Build scan config
        const config = {
            clientId: client.id,
            clientName: client.name,
            mode: body.mode || 'CRAWL_ONLY' as const,
            entity,
        };

        let scanId: string;

        // Use raw SQL executor only in dev mode with forceRaw flag
        if (!prismaClientReady && isDev && forceRaw) {
            console.log('[SCAN/RUN] Using raw SQL executor (DEV fallback)');
            const { executeScanRaw } = await import('@/lib/digital-footprint/scanEngineRaw');
            scanId = await executeScanRaw(config);
        } else {
            console.log('[SCAN/RUN] Using Prisma-based scan engine');
            const { executeScan } = await import('@/lib/digital-footprint/scanEngine');
            scanId = await executeScan(config);
        }

        console.log(`[SCAN/RUN] Scan completed: ${scanId}`);

        // Return scan ID for redirect
        return NextResponse.json({
            scanId,
            message: 'Scan completed successfully',
            redirectTo: `/digital-footprint/scan-results/${scanId}`,
            usedRawSql: !prismaClientReady && forceRaw,
        });

    } catch (error) {
        console.error('[SCAN/RUN] Error:', error);
        return NextResponse.json(
            { error: 'Failed to run scan', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
