// Footprint Registry - Single Item API (GET, PUT, DELETE)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
    params: { id: string };
}

// GET - Get single surface
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const surface = await prisma.footprintSurfaceRegistry.findUnique({
            where: { id: params.id },
        });

        if (!surface) {
            return NextResponse.json({ error: 'Surface not found' }, { status: 404 });
        }

        return NextResponse.json(surface);
    } catch (error) {
        console.error('Failed to fetch surface:', error);
        return NextResponse.json({ error: 'Failed to fetch surface' }, { status: 500 });
    }
}

// PUT - Update surface
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const body = await request.json();

        // Validate surfaceKey format if provided
        if (body.surfaceKey && !/^[A-Z][A-Z0-9_]*$/.test(body.surfaceKey)) {
            return NextResponse.json({
                error: 'surfaceKey must be uppercase snake_case'
            }, { status: 400 });
        }

        // Validate basePoints (0-30)
        if (body.basePoints !== undefined && (body.basePoints < 0 || body.basePoints > 30)) {
            return NextResponse.json({ error: 'basePoints must be 0-30' }, { status: 400 });
        }

        // Validate defaultRelevanceWeight (0-1)
        if (body.defaultRelevanceWeight !== undefined &&
            (body.defaultRelevanceWeight < 0 || body.defaultRelevanceWeight > 1)) {
            return NextResponse.json({ error: 'defaultRelevanceWeight must be 0-1' }, { status: 400 });
        }

        const surface = await prisma.footprintSurfaceRegistry.update({
            where: { id: params.id },
            data: {
                ...(body.surfaceKey && { surfaceKey: body.surfaceKey }),
                ...(body.label && { label: body.label }),
                ...(body.category && { category: body.category }),
                ...(body.importanceTier && { importanceTier: body.importanceTier }),
                ...(body.basePoints !== undefined && { basePoints: body.basePoints }),
                ...(body.defaultRelevanceWeight !== undefined && { defaultRelevanceWeight: body.defaultRelevanceWeight }),
                ...(body.sourceType && { sourceType: body.sourceType }),
                ...(body.searchEngine !== undefined && { searchEngine: body.searchEngine }),
                ...(body.queryTemplates && { queryTemplates: body.queryTemplates }),
                ...(body.maxQueries !== undefined && { maxQueries: body.maxQueries }),
                ...(body.confirmationArtifact && { confirmationArtifact: body.confirmationArtifact }),
                ...(body.presenceRules !== undefined && { presenceRules: body.presenceRules }),
                ...(body.officialnessRules !== undefined && { officialnessRules: body.officialnessRules }),
                ...(body.officialnessRequired !== undefined && { officialnessRequired: body.officialnessRequired }),
                ...(body.evidenceFields !== undefined && { evidenceFields: body.evidenceFields }),
                ...(body.tooltipTemplates !== undefined && { tooltipTemplates: body.tooltipTemplates }),
                ...(body.enabled !== undefined && { enabled: body.enabled }),
                ...(body.notes !== undefined && { notes: body.notes }),
                ...(body.industryOverrides !== undefined && { industryOverrides: body.industryOverrides }),
                ...(body.geoOverrides !== undefined && { geoOverrides: body.geoOverrides }),
            },
        });

        return NextResponse.json(surface);
    } catch (error: unknown) {
        console.error('Failed to update surface:', error);
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
            return NextResponse.json({ error: 'Surface not found' }, { status: 404 });
        }
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
            return NextResponse.json({ error: 'Surface key already exists' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Failed to update surface' }, { status: 500 });
    }
}

// DELETE - Delete surface
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        await prisma.footprintSurfaceRegistry.delete({
            where: { id: params.id },
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('Failed to delete surface:', error);
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
            return NextResponse.json({ error: 'Surface not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Failed to delete surface' }, { status: 500 });
    }
}
