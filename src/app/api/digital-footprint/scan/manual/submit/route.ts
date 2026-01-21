/**
 * Submit Manual Evidence
 * 
 * POST /api/digital-footprint/scan/manual/submit
 * 
 * Allows manual submission of evidence for surfaces that require it
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

interface SubmitRequest {
    scanId: string;
    surfaceKey: string;
    status: 'PRESENT_CONFIRMED' | 'PRESENT_PARTIAL' | 'ABSENT';
    evidence: {
        url?: string;
        notes?: string;
        screenshotUrl?: string;
    };
    submittedBy?: string;
}

export async function POST(request: NextRequest) {
    try {
        const body: SubmitRequest = await request.json();

        // Validate required fields
        if (!body.scanId || !body.surfaceKey || !body.status) {
            return NextResponse.json({
                error: 'scanId, surfaceKey, and status are required'
            }, { status: 400 });
        }

        // Validate status is one of the allowed values
        if (!['PRESENT_CONFIRMED', 'PRESENT_PARTIAL', 'ABSENT'].includes(body.status)) {
            return NextResponse.json({
                error: 'status must be PRESENT_CONFIRMED, PRESENT_PARTIAL, or ABSENT'
            }, { status: 400 });
        }

        // Find existing result
        const result = await prisma.digitalFootprintScanResult.findUnique({
            where: {
                scanId_surfaceKey: {
                    scanId: body.scanId,
                    surfaceKey: body.surfaceKey,
                },
            },
        });

        if (!result) {
            return NextResponse.json({
                error: 'Scan result not found',
                hint: 'Check scanId and surfaceKey'
            }, { status: 404 });
        }

        // Verify this surface allows manual submission
        const allowedStatuses = ['MANUAL_REQUIRED', 'REQUIRES_PROVIDER', 'NEEDS_ENTITY_INPUT', 'ERROR'];
        if (!allowedStatuses.includes(result.status)) {
            return NextResponse.json({
                error: 'This surface does not accept manual submissions',
                currentStatus: result.status
            }, { status: 400 });
        }

        // Build evidence object
        const evidence = {
            manual_submission: true,
            submitted_at: new Date().toISOString(),
            submitted_by: body.submittedBy || 'unknown',
            url: body.evidence.url || null,
            notes: body.evidence.notes || null,
            screenshot_url: body.evidence.screenshotUrl || null,
        };

        // Calculate confidence based on evidence provided
        let confidence = 60; // Base for manual
        if (body.evidence.url) confidence += 20;
        if (body.evidence.screenshotUrl) confidence += 15;
        if (body.evidence.notes) confidence += 5;
        confidence = Math.min(100, confidence);

        // Update the result
        const updated = await prisma.digitalFootprintScanResult.update({
            where: { id: result.id },
            data: {
                status: body.status,
                confidence,
                evidence: evidence as unknown as Prisma.JsonObject,
                submittedBy: body.submittedBy || null,
                submittedAt: new Date(),
                lastUpdatedAt: new Date(),
            },
        });

        // Update scan summary
        await updateScanSummary(body.scanId);

        return NextResponse.json({
            success: true,
            result: {
                id: updated.id,
                surfaceKey: updated.surfaceKey,
                status: updated.status,
                confidence: updated.confidence,
                submittedAt: updated.submittedAt,
            },
        });

    } catch (error) {
        console.error('Manual submit error:', error);
        return NextResponse.json(
            { error: 'Failed to submit manual evidence' },
            { status: 500 }
        );
    }
}

/**
 * Recalculate and update scan summary after manual submission
 */
async function updateScanSummary(scanId: string) {
    const results = await prisma.digitalFootprintScanResult.findMany({
        where: { scanId },
    });

    const counts = {
        PRESENT_CONFIRMED: 0,
        PRESENT_PARTIAL: 0,
        ABSENT: 0,
        NEEDS_ENTITY_INPUT: 0,
        MANUAL_REQUIRED: 0,
        REQUIRES_PROVIDER: 0,
        ERROR: 0,
        SKIPPED: 0,
        PENDING: 0,
    };

    for (const result of results) {
        const status = result.status as keyof typeof counts;
        if (status in counts) {
            counts[status]++;
        }
    }

    const summary = {
        counts,
        total: results.length,
        presentCount: counts.PRESENT_CONFIRMED + counts.PRESENT_PARTIAL,
        absentCount: counts.ABSENT,
        score: Math.round(((counts.PRESENT_CONFIRMED + counts.PRESENT_PARTIAL * 0.5) / results.length) * 100),
    };

    await prisma.digitalFootprintScan.update({
        where: { id: scanId },
        data: {
            summary: summary as unknown as Prisma.JsonObject,
        },
    });
}
