/**
 * Verification Helper Script
 * 
 * Validates scan integrity:
 * 1. Every scan has results count == enabled surfaces count
 * 2. No duplicate (scanId, surfaceKey)
 * 3. No more than one active rule per surface
 * 
 * Run with: npx ts-node scripts/verifyScanIntegrity.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Verifying scan integrity...\n');

    let passed = 0;
    let failed = 0;

    // 1. Check enabled surfaces count
    const enabledSurfaces = await prisma.footprintSurface.count({
        where: { enabled: true },
    });
    console.log(`📊 Enabled surfaces: ${enabledSurfaces}`);

    // 2. Check all scans have correct result count
    const scans = await prisma.digitalFootprintScan.findMany({
        include: {
            _count: {
                select: { results: true },
            },
        },
    });

    for (const scan of scans) {
        const resultCount = scan._count.results;
        if (resultCount === enabledSurfaces) {
            console.log(`✅ Scan ${scan.id}: ${resultCount} results (OK)`);
            passed++;
        } else {
            console.log(`❌ Scan ${scan.id}: ${resultCount} results (expected ${enabledSurfaces})`);
            failed++;
        }
    }

    // 3. Check for duplicate (scanId, surfaceKey)
    const duplicates = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*) as count FROM (
            SELECT scan_id, surface_key, COUNT(*) as c 
            FROM digital_footprint_scan_results 
            GROUP BY scan_id, surface_key 
            HAVING COUNT(*) > 1
        ) as dups
    `;

    const dupCount = Number(duplicates[0]?.count || 0);
    if (dupCount === 0) {
        console.log(`✅ No duplicate (scanId, surfaceKey) pairs`);
        passed++;
    } else {
        console.log(`❌ Found ${dupCount} duplicate (scanId, surfaceKey) pairs`);
        failed++;
    }

    // 4. Check for multiple active rules per surface
    const multipleActiveRules = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*) as count FROM (
            SELECT surface_id, COUNT(*) as c 
            FROM footprint_surface_rules 
            WHERE is_active = true 
            GROUP BY surface_id 
            HAVING COUNT(*) > 1
        ) as multi
    `;

    const multiCount = Number(multipleActiveRules[0]?.count || 0);
    if (multiCount === 0) {
        console.log(`✅ No surfaces with multiple active rules`);
        passed++;
    } else {
        console.log(`❌ Found ${multiCount} surfaces with multiple active rules`);
        failed++;
    }

    // Summary
    console.log(`\n📋 Summary: ${passed} passed, ${failed} failed`);

    if (failed > 0) {
        process.exit(1);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
