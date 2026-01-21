/**
 * Test Scan API - Uses Raw SQL to bypass Prisma client issue
 * 
 * POST /api/digital-footprint/test-scan
 * 
 * Creates a test scan with pre-created results for all enabled surfaces
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const clientId = body.clientId || 'test-client-id';
        const clientName = body.clientName || 'Test Client';

        // Get all enabled surfaces via raw SQL
        const surfaces = await prisma.$queryRaw<Array<{
            id: string;
            surfaceKey: string;
            label: string;
            category: string;
            importanceTier: string;
        }>>`
            SELECT id, "surfaceKey", label, category, "importanceTier"
            FROM footprint_surfaces
            WHERE enabled = true
            ORDER BY category, "importanceTier"
        `;

        if (surfaces.length === 0) {
            return NextResponse.json({
                error: 'No enabled surfaces found',
            }, { status: 400 });
        }

        // Create unique scan ID
        const scanId = randomUUID();
        const now = new Date();

        // Create scan record via raw SQL
        await prisma.$executeRaw`
            INSERT INTO digital_footprint_scans 
            (id, "clientId", "clientName", mode, status, "startedAt", "completedAt", summary, "createdAt", "updatedAt")
            VALUES (
                ${scanId},
                ${clientId},
                ${clientName},
                'CRAWL_ONLY',
                'COMPLETED',
                ${now},
                ${now},
                ${{
                counts: { total: surfaces.length },
                presentCount: 0,
                absentCount: 0,
                score: 0,
            }}::jsonb,
                ${now},
                ${now}
            )
        `;

        // Create result rows for each surface
        let createdCount = 0;
        for (const surface of surfaces) {
            const resultId = randomUUID();

            // Get active rule for this surface
            const rules = await prisma.$queryRaw<Array<{ id: string }>>`
                SELECT id FROM footprint_surface_rules
                WHERE "surfaceId" = ${surface.id} AND "isActive" = true
                LIMIT 1
            `;
            const ruleId = rules[0]?.id || null;

            // Create result with placeholder status
            await prisma.$executeRaw`
                INSERT INTO digital_footprint_scan_results
                (id, "scanId", "surfaceKey", "surfaceLabel", "surfaceRuleId", category, "importanceTier", status, confidence, evidence, "createdAt", "updatedAt")
                VALUES (
                    ${resultId},
                    ${scanId},
                    ${surface.surfaceKey},
                    ${surface.label},
                    ${ruleId},
                    ${surface.category},
                    ${surface.importanceTier},
                    'QUEUED',
                    50,
                    ${{
                    target: { method: 'TEST_SCAN' },
                    fetch: { httpStatus: 200 },
                    match: { matchSignals: [], mismatchSignals: [] },
                    extracted: {},
                    integrity: {},
                    errors: {},
                }}::jsonb,
                    ${now},
                    ${now}
                )
            `;
            createdCount++;
        }

        // Update scan summary
        await prisma.$executeRaw`
            UPDATE digital_footprint_scans
            SET summary = ${{
                counts: {
                    total: createdCount,
                    QUEUED: createdCount,
                },
                presentCount: 0,
                absentCount: 0,
                score: 0,
            }}::jsonb
            WHERE id = ${scanId}
        `;

        // Verify result count
        const resultCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count FROM digital_footprint_scan_results
            WHERE "scanId" = ${scanId}
        `;

        return NextResponse.json({
            success: true,
            scanId,
            clientId,
            clientName,
            surfacesCount: surfaces.length,
            resultsCreated: createdCount,
            verifiedResultCount: Number(resultCount[0]?.count || 0),
            message: `Test scan created with ${createdCount} results`,
        });

    } catch (error) {
        console.error('Test scan error:', error);
        return NextResponse.json({
            error: 'Failed to create test scan',
            details: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}

// GET: Check if scan exists
export async function GET(request: NextRequest) {
    try {
        const scans = await prisma.$queryRaw<Array<{
            id: string;
            clientName: string;
            status: string;
            createdAt: Date;
        }>>`
            SELECT id, "clientName", status, "createdAt"
            FROM digital_footprint_scans
            ORDER BY "createdAt" DESC
            LIMIT 5
        `;

        return NextResponse.json({
            scans,
            count: scans.length,
        });

    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
