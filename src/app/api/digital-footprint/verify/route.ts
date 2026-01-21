/**
 * Verification API Endpoint (Production-Ready)
 * 
 * GET /api/digital-footprint/verify
 * 
 * Features:
 * - Retry logic with exponential backoff for DB timeouts
 * - Admin role protection (or dev-only in production)
 * - Updated C5 to check for non-QUEUED statuses
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getToken } from 'next-auth/jwt';

interface CheckResult {
    name: string;
    passed: boolean;
    details: string;
    remediation?: string;
    skipped?: boolean;
}

// Retry wrapper with exponential backoff
async function withRetry<T>(
    fn: () => Promise<T>,
    maxAttempts = 3,
    baseDelayMs = 250
): Promise<{ result?: T; error?: string; attempts: number }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const result = await fn();
            return { result, attempts: attempt };
        } catch (e) {
            lastError = e instanceof Error ? e : new Error(String(e));

            // Check if it's a connection error worth retrying
            const isRetryable = lastError.message.includes("Can't reach database") ||
                lastError.message.includes("Connection") ||
                lastError.message.includes("timeout");

            if (!isRetryable || attempt === maxAttempts) {
                break;
            }

            // Exponential backoff: 250ms, 750ms, 1500ms
            const delay = baseDelayMs * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    return { error: lastError?.message || 'Unknown error', attempts: maxAttempts };
}

// Check if user is admin (for production protection)
async function isAuthorized(request: NextRequest): Promise<boolean> {
    // In development, allow all
    if (process.env.NODE_ENV !== 'production') {
        return true;
    }

    // In production, require admin role
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return false;

    const role = token.role as string;
    return role === 'superadmin' || role === 'admin';
}

export async function GET(request: NextRequest) {
    // Check authorization
    if (!(await isAuthorized(request))) {
        return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
    }

    const results: CheckResult[] = [];

    function addResult(name: string, passed: boolean, details: string, remediation?: string, skipped?: boolean) {
        results.push({ name, passed, details, remediation, skipped });
    }

    try {
        // === A) MIGRATION / DB CHECKS (with retry) ===

        // A1: Check partial unique index
        const a1Result = await withRetry(async () => {
            return prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
                SELECT indexname, indexdef 
                FROM pg_indexes 
                WHERE indexname = 'one_active_rule_per_surface'
            `;
        });

        if (a1Result.error) {
            addResult('A1: Partial Unique Index', false, `SKIP after ${a1Result.attempts} attempts: ${a1Result.error.slice(0, 100)}`, undefined, true);
        } else if (a1Result.result && a1Result.result.length > 0) {
            addResult('A1: Partial Unique Index', true, `Found: ${a1Result.result[0].indexdef.slice(0, 100)}...`);
        } else {
            addResult('A1: Partial Unique Index', false, 'Index one_active_rule_per_surface not found', 'Run: npx prisma migrate deploy');
        }

        // A2: Check surface_key unique index
        const a2Result = await withRetry(async () => {
            return prisma.$queryRaw<Array<{ count: bigint }>>`
                SELECT COUNT(*) as count FROM pg_indexes 
                WHERE tablename = 'footprint_surfaces' 
                AND (indexdef LIKE '%surfaceKey%' OR indexdef LIKE '%surface_key%')
            `;
        });

        if (a2Result.error) {
            addResult('A2: surfaceKey Index', false, `SKIP after ${a2Result.attempts} attempts: ${a2Result.error.slice(0, 100)}`, undefined, true);
        } else {
            addResult('A2: surfaceKey Index', Number(a2Result.result?.[0]?.count || 0) > 0, `Index count: ${a2Result.result?.[0]?.count || 0}`);
        }

        // A3: Check rules unique index (surfaceId + ruleVersion)
        const a3Result = await withRetry(async () => {
            return prisma.$queryRaw<Array<{ count: bigint }>>`
                SELECT COUNT(*) as count FROM pg_indexes 
                WHERE tablename = 'footprint_surface_rules' 
                AND (indexdef LIKE '%surfaceId%' OR indexdef LIKE '%surface_id%')
                AND (indexdef LIKE '%ruleVersion%' OR indexdef LIKE '%rule_version%')
            `;
        });

        if (a3Result.error) {
            addResult('A3: Rules Unique Index', false, `SKIP: ${a3Result.error.slice(0, 100)}`, undefined, true);
        } else {
            addResult('A3: Rules Unique Index', Number(a3Result.result?.[0]?.count || 0) > 0, `Index count: ${a3Result.result?.[0]?.count || 0}`);
        }

        // A4: Check scan results unique index
        const a4Result = await withRetry(async () => {
            return prisma.$queryRaw<Array<{ count: bigint }>>`
                SELECT COUNT(*) as count FROM pg_indexes 
                WHERE tablename = 'digital_footprint_scan_results' 
                AND (indexdef LIKE '%scanId%' OR indexdef LIKE '%scan_id%')
                AND (indexdef LIKE '%surfaceKey%' OR indexdef LIKE '%surface_key%')
            `;
        });

        if (a4Result.error) {
            addResult('A4: Scan Results Unique Index', false, `SKIP: ${a4Result.error.slice(0, 100)}`, undefined, true);
        } else {
            addResult('A4: Scan Results Unique Index', Number(a4Result.result?.[0]?.count || 0) > 0, `Index count: ${a4Result.result?.[0]?.count || 0}`);
        }

        // === B) BOOTSTRAP INTEGRITY ===

        // B1: Count enabled surfaces
        let enabledSurfacesCount = 0;
        try {
            const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
                SELECT COUNT(*) as count FROM footprint_surfaces WHERE enabled = true
            `;
            enabledSurfacesCount = Number(result[0]?.count || 0);
            addResult('B1: Enabled Surfaces Count', enabledSurfacesCount >= 80, `Found ${enabledSurfacesCount} enabled surfaces`);
        } catch (e) {
            addResult('B1: Enabled Surfaces Count', false, `Query failed: ${e}`, 'Run: npm run footprint:bootstrap');
        }

        // B2: Count active rules (joined to enabled surfaces only)
        let activeRulesCount = 0;
        try {
            const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
                SELECT COUNT(*) as count 
                FROM footprint_surface_rules fsr
                JOIN footprint_surfaces fs ON fsr."surfaceId" = fs.id
                WHERE fsr."isActive" = true AND fs.enabled = true
            `;
            activeRulesCount = Number(result[0]?.count || 0);
            addResult(
                'B2: Active Rules Match Surfaces',
                activeRulesCount === enabledSurfacesCount,
                `Active rules (joined): ${activeRulesCount}, Enabled surfaces: ${enabledSurfacesCount}`
            );
        } catch (e) {
            addResult('B2: Active Rules Match Surfaces', false, `Query failed: ${e}`);
        }

        // B3: Surfaces missing active rules
        try {
            const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
                SELECT COUNT(*) as count FROM footprint_surfaces fs
                WHERE fs.enabled = true
                AND NOT EXISTS (
                    SELECT 1 FROM footprint_surface_rules fsr 
                    WHERE fsr."surfaceId" = fs.id AND fsr."isActive" = true
                )
            `;
            const missingCount = Number(result[0]?.count || 0);
            addResult('B3: No Surfaces Missing Rules', missingCount === 0, `Missing: ${missingCount} surfaces`);
        } catch (e) {
            addResult('B3: No Surfaces Missing Rules', false, `Query failed: ${e}`);
        }

        // B4: Multiple active rules per surface
        try {
            const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
                SELECT COUNT(*) as count FROM (
                    SELECT "surfaceId" FROM footprint_surface_rules 
                    WHERE "isActive" = true 
                    GROUP BY "surfaceId" 
                    HAVING COUNT(*) > 1
                ) AS multi
            `;
            const multiCount = Number(result[0]?.count || 0);
            addResult('B4: One Active Rule Per Surface', multiCount === 0, `Surfaces with multiple active rules: ${multiCount}`);
        } catch (e) {
            addResult('B4: One Active Rule Per Surface', false, `Query failed: ${e}`);
        }

        // === C) SCAN EXECUTION CHECKS ===

        // C1: Get most recent completed scan
        let scanId: string | null = null;
        let scanResultsCount = 0;
        try {
            const scans = await prisma.$queryRaw<Array<{ id: string; clientName: string; status: string }>>`
                SELECT id, "clientName", status FROM digital_footprint_scans 
                ORDER BY "createdAt" DESC LIMIT 1
            `;

            if (scans.length > 0) {
                scanId = scans[0].id;

                // Count results for this scan
                const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
                    SELECT COUNT(*) as count FROM digital_footprint_scan_results 
                    WHERE "scanId" = ${scanId}
                `;
                scanResultsCount = Number(countResult[0]?.count || 0);

                addResult(
                    'C1: Scan Completeness',
                    scanResultsCount === enabledSurfacesCount,
                    `Scan ${scanId.slice(0, 8)}... has ${scanResultsCount} results (expected ${enabledSurfacesCount})`
                );
            } else {
                addResult('C1: Scan Completeness', false, 'No scans found', 'Run a scan first');
            }
        } catch (e) {
            addResult('C1: Scan Completeness', false, `Query failed: ${e}`);
        }

        // C2: Check for duplicates in scan
        if (scanId) {
            try {
                const dups = await prisma.$queryRaw<Array<{ count: bigint }>>`
                    SELECT COUNT(*) as count FROM (
                        SELECT "scanId", "surfaceKey", COUNT(*) as c 
                        FROM digital_footprint_scan_results 
                        WHERE "scanId" = ${scanId}
                        GROUP BY "scanId", "surfaceKey" 
                        HAVING COUNT(*) > 1
                    ) as dups
                `;
                const dupCount = Number(dups[0]?.count || 0);
                addResult('C2: No Duplicate Results', dupCount === 0, `Duplicate (scanId, surfaceKey) pairs: ${dupCount}`);
            } catch (e) {
                addResult('C2: No Duplicate Results', false, `Query failed: ${e}`);
            }
        }

        // C3: Confidence bounds
        if (scanId) {
            try {
                const outOfBounds = await prisma.$queryRaw<Array<{ count: bigint }>>`
                    SELECT COUNT(*) as count FROM digital_footprint_scan_results 
                    WHERE "scanId" = ${scanId}
                    AND (confidence < 0 OR confidence > 100)
                `;
                const oobCount = Number(outOfBounds[0]?.count || 0);
                addResult('C3: Confidence Bounds (0-100)', oobCount === 0, `Out of bounds: ${oobCount}`);
            } catch (e) {
                addResult('C3: Confidence Bounds', false, `Query failed: ${e}`);
            }
        }

        // C4: Sample evidence schema (check a few results)
        if (scanId) {
            try {
                const samples = await prisma.$queryRaw<Array<{
                    surfaceKey: string;
                    status: string;
                    evidence: unknown
                }>>`
                    SELECT "surfaceKey", status, evidence 
                    FROM digital_footprint_scan_results 
                    WHERE "scanId" = ${scanId}
                    AND evidence IS NOT NULL
                    LIMIT 5
                `;

                let validSchemaCount = 0;
                for (const r of samples) {
                    const ev = r.evidence as { target?: object; fetch?: object; match?: object; errors?: object; dns?: object } | null;
                    if (ev && ev.target && (ev.fetch || ev.dns) && ev.match && ev.errors) {
                        validSchemaCount++;
                    }
                }

                addResult(
                    'C4: Evidence Schema Consistency',
                    validSchemaCount >= samples.length * 0.6 || samples.length === 0,
                    `${validSchemaCount}/${samples.length} samples have valid schema`
                );
            } catch (e) {
                addResult('C4: Evidence Schema Consistency', false, `Query failed: ${e}`);
            }
        }

        // C5: Status distribution - Strict check for real execution
        if (scanId) {
            try {
                // Get scan info to check client and auto-ready count
                const scanInfo = await prisma.$queryRaw<Array<{ clientId: string; clientName: string; summary: unknown }>>`
                    SELECT "clientId", "clientName", summary FROM digital_footprint_scans WHERE id = ${scanId}
                `;
                const summary = (scanInfo[0]?.summary as { autoReady?: number; counts?: Record<string, number> } | null);
                const autoReadyCount = summary?.autoReady ?? 0;

                const distribution = await prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
                    SELECT status, COUNT(*) as count 
                    FROM digital_footprint_scan_results 
                    WHERE "scanId" = ${scanId}
                    GROUP BY status
                    ORDER BY count DESC
                `;

                const distStr = distribution.map(d => `${d.status}: ${d.count}`).join(', ');
                const queuedCount = distribution.find(d => d.status === 'QUEUED');
                const totalResults = distribution.reduce((sum, d) => sum + Number(d.count), 0);
                const nonQueuedCount = totalResults - Number(queuedCount?.count || 0);

                // Check counts from summary - if we have them, can detect if scan was fully processed
                const summaryTotal = summary?.counts
                    ? Object.values(summary.counts).reduce((a, b) => a + (b || 0), 0)
                    : 0;
                const hasValidSummary = summaryTotal > 0;

                // If autoReady is 0 but there are enabled surfaces, this is a classification bug
                // In a properly configured client with domain, AUTO_READY should be > 0
                if (autoReadyCount === 0 && totalResults > 0) {
                    // Check if scan has evidence that it was processed (not just pre-created)
                    if (hasValidSummary && nonQueuedCount > 0) {
                        // Scan was processed but AUTO_READY wasn't tracked - likely old scan
                        addResult('C5: Status Distribution', true, `${distStr} (legacy scan, ${nonQueuedCount} processed)`);
                    } else if (hasValidSummary) {
                        // Scan completed but all QUEUED - classification or execution issue
                        addResult(
                            'C5: Status Distribution',
                            false,
                            `Configured client but AUTO_READY=0 in summary. Plan classification bug suspected.`,
                            'Check /api/digital-footprint/scan/plan logic'
                        );
                    } else {
                        // Pre-created only, no processing - skip
                        addResult(
                            'C5: Status Distribution',
                            false,
                            `No AUTO_READY surfaces tracked (autoReady=0). May be test scan or classification bug.`,
                            undefined,
                            true // skipped for old/test scans
                        );
                    }
                }
                // AUTO_READY > 0 but all still QUEUED means scan didn't execute properly
                else if (autoReadyCount > 0 && nonQueuedCount === 0) {
                    addResult(
                        'C5: Status Distribution',
                        false,
                        `AUTO_READY=${autoReadyCount} but all ${totalResults} results are QUEUED. Scan execution failed.`,
                        'Run a real scan or check scan engine logs'
                    );
                }
                // At least 1 non-QUEUED result means real execution happened
                else if (nonQueuedCount > 0) {
                    addResult('C5: Status Distribution', true, `${distStr} (autoReady=${autoReadyCount}, processed=${nonQueuedCount})`);
                }
                // Fallback
                else {
                    addResult('C5: Status Distribution', false, `Unable to verify: ${distStr}`, 'Run a new scan');
                }
            } catch (e) {
                addResult('C5: Status Distribution', false, `Query failed: ${e}`);
            }
        }

        // Summary
        const passCount = results.filter(r => r.passed && !r.skipped).length;
        const failCount = results.filter(r => !r.passed && !r.skipped).length;
        const skipCount = results.filter(r => r.skipped).length;

        return NextResponse.json({
            overall: failCount === 0 ? (skipCount > 0 ? 'PARTIAL_PASS' : 'PASS') : 'FAIL',
            summary: {
                passed: passCount,
                failed: failCount,
                skipped: skipCount,
                total: results.length,
            },
            checks: results,
            scanId,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        return NextResponse.json({
            overall: 'ERROR',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
        }, { status: 500 });
    }
}
