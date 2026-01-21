/**
 * Orphan Cleanup API
 * 
 * POST /api/digital-footprint/cleanup-orphans
 * 
 * Detects and removes orphan footprint_surface_rules where surfaceId
 * has no matching enabled footprint_surfaces.id
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        // Step 1: Detect orphan rules (rules pointing to non-existent or disabled surfaces)
        const orphanRules = await prisma.$queryRaw<Array<{
            id: string;
            surfaceId: string;
            ruleVersion: number;
        }>>`
            SELECT fsr.id, fsr."surfaceId", fsr."ruleVersion"
            FROM footprint_surface_rules fsr
            LEFT JOIN footprint_surfaces fs ON fsr."surfaceId" = fs.id
            WHERE fs.id IS NULL OR fs.enabled = false
        `;

        if (orphanRules.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No orphan rules found',
                orphansDeleted: 0,
            });
        }

        // Step 2: Log what we're removing
        const orphanIds = orphanRules.map(r => r.id);
        console.log(`[CLEANUP] Found ${orphanRules.length} orphan rules:`, orphanRules);

        // Step 3: Delete orphan rules
        const deleteResult = await prisma.$executeRaw`
            DELETE FROM footprint_surface_rules
            WHERE id = ANY(${orphanIds}::text[])
        `;

        // Step 4: Verify new counts
        const newActiveRules = await prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count FROM footprint_surface_rules WHERE "isActive" = true
        `;
        const newEnabledSurfaces = await prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count FROM footprint_surfaces WHERE enabled = true
        `;

        return NextResponse.json({
            success: true,
            message: `Deleted ${orphanRules.length} orphan rules`,
            orphansDeleted: orphanRules.length,
            deletedRules: orphanRules,
            newCounts: {
                activeRules: Number(newActiveRules[0]?.count || 0),
                enabledSurfaces: Number(newEnabledSurfaces[0]?.count || 0),
            },
        });

    } catch (error) {
        console.error('Cleanup error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}

// GET: Just detect orphans without deleting
export async function GET(request: NextRequest) {
    try {
        const orphanRules = await prisma.$queryRaw<Array<{
            id: string;
            surfaceId: string;
            ruleVersion: number;
            surfaceExists: boolean;
            surfaceEnabled: boolean | null;
        }>>`
            SELECT 
                fsr.id, 
                fsr."surfaceId", 
                fsr."ruleVersion",
                fs.id IS NOT NULL as "surfaceExists",
                fs.enabled as "surfaceEnabled"
            FROM footprint_surface_rules fsr
            LEFT JOIN footprint_surfaces fs ON fsr."surfaceId" = fs.id
            WHERE fs.id IS NULL OR fs.enabled = false
        `;

        const activeRules = await prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count FROM footprint_surface_rules WHERE "isActive" = true
        `;
        const enabledSurfaces = await prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count FROM footprint_surfaces WHERE enabled = true
        `;

        // Also check rules linked to enabled surfaces only
        const validActiveRules = await prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count 
            FROM footprint_surface_rules fsr
            JOIN footprint_surfaces fs ON fsr."surfaceId" = fs.id
            WHERE fsr."isActive" = true AND fs.enabled = true
        `;

        return NextResponse.json({
            orphanRules,
            orphanCount: orphanRules.length,
            counts: {
                totalActiveRules: Number(activeRules[0]?.count || 0),
                totalEnabledSurfaces: Number(enabledSurfaces[0]?.count || 0),
                validActiveRules: Number(validActiveRules[0]?.count || 0),
            },
        });

    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
