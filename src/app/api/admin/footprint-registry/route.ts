// Footprint Registry - List and Create API

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - List all surfaces with filters
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Parse filters
        const category = searchParams.get('category')?.split(',').filter(Boolean);
        const sourceType = searchParams.get('sourceType')?.split(',').filter(Boolean);
        const searchEngine = searchParams.get('searchEngine')?.split(',').filter(Boolean);
        const importanceTier = searchParams.get('importanceTier')?.split(',').filter(Boolean);
        const enabled = searchParams.get('enabled');
        const search = searchParams.get('search');
        const sortBy = searchParams.get('sortBy') || 'importanceTier';
        const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

        // Build where clause
        const where: Record<string, unknown> = {};

        if (category?.length) {
            where.category = { in: category };
        }
        if (sourceType?.length) {
            where.sourceType = { in: sourceType };
        }
        if (searchEngine?.length) {
            where.searchEngine = { in: searchEngine };
        }
        if (importanceTier?.length) {
            where.importanceTier = { in: importanceTier };
        }
        if (enabled === 'true') {
            where.enabled = true;
        } else if (enabled === 'false') {
            where.enabled = false;
        }
        if (search) {
            where.OR = [
                { surfaceKey: { contains: search, mode: 'insensitive' } },
                { label: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Get surfaces
        const surfaces = await prisma.footprintSurfaceRegistry.findMany({
            where,
            orderBy: { [sortBy]: sortOrder },
        });

        // Get counts for filters
        const counts = await prisma.footprintSurfaceRegistry.groupBy({
            by: ['category', 'importanceTier', 'sourceType', 'enabled'],
            _count: true,
        });

        const totalCount = await prisma.footprintSurfaceRegistry.count();
        const enabledCount = await prisma.footprintSurfaceRegistry.count({ where: { enabled: true } });

        // Aggregate counts by category
        const categoryCounts: Record<string, number> = {};
        const tierCounts: Record<string, number> = {};
        const sourceTypeCounts: Record<string, number> = {};

        counts.forEach(c => {
            if (c.category) {
                categoryCounts[c.category] = (categoryCounts[c.category] || 0) + c._count;
            }
            if (c.importanceTier) {
                tierCounts[c.importanceTier] = (tierCounts[c.importanceTier] || 0) + c._count;
            }
            if (c.sourceType) {
                sourceTypeCounts[c.sourceType] = (sourceTypeCounts[c.sourceType] || 0) + c._count;
            }
        });

        return NextResponse.json({
            surfaces,
            meta: {
                total: totalCount,
                enabled: enabledCount,
                disabled: totalCount - enabledCount,
                categoryCounts,
                tierCounts,
                sourceTypeCounts,
            },
        });
    } catch (error) {
        console.error('Failed to fetch registry:', error);
        return NextResponse.json({ error: 'Failed to fetch registry' }, { status: 500 });
    }
}

// POST - Create new surface
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate required fields
        const required = ['surfaceKey', 'label', 'category', 'importanceTier', 'sourceType', 'confirmationArtifact'];
        for (const field of required) {
            if (!body[field]) {
                return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
            }
        }

        // Validate surfaceKey format (uppercase snake_case)
        if (!/^[A-Z][A-Z0-9_]*$/.test(body.surfaceKey)) {
            return NextResponse.json({
                error: 'surfaceKey must be uppercase snake_case (e.g., GOOGLE_ORGANIC)'
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

        // Require searchEngine for DataForSEO sources
        if ((body.sourceType === 'DATAFORSEO_SERP' || body.sourceType === 'DATAFORSEO_AUTOCOMPLETE')
            && !body.searchEngine) {
            return NextResponse.json({
                error: 'searchEngine required for DataForSEO source types'
            }, { status: 400 });
        }

        // Require queryTemplates for search-based sources
        if (['DATAFORSEO_SERP', 'DATAFORSEO_AUTOCOMPLETE'].includes(body.sourceType)) {
            if (!body.queryTemplates || !Array.isArray(body.queryTemplates) || body.queryTemplates.length === 0) {
                return NextResponse.json({
                    error: 'queryTemplates required for search-based sources'
                }, { status: 400 });
            }
        }

        const surface = await prisma.footprintSurfaceRegistry.create({
            data: {
                surfaceKey: body.surfaceKey,
                label: body.label,
                category: body.category,
                importanceTier: body.importanceTier,
                basePoints: body.basePoints ?? 10,
                defaultRelevanceWeight: body.defaultRelevanceWeight ?? 1.0,
                sourceType: body.sourceType,
                searchEngine: body.searchEngine || null,
                queryTemplates: body.queryTemplates || [],
                maxQueries: body.maxQueries ?? 2,
                confirmationArtifact: body.confirmationArtifact,
                presenceRules: body.presenceRules || null,
                officialnessRules: body.officialnessRules || null,
                officialnessRequired: body.officialnessRequired ?? true,
                evidenceFields: body.evidenceFields || null,
                tooltipTemplates: body.tooltipTemplates || null,
                enabled: body.enabled ?? true,
                notes: body.notes || null,
                industryOverrides: body.industryOverrides || null,
                geoOverrides: body.geoOverrides || null,
            },
        });

        return NextResponse.json(surface, { status: 201 });
    } catch (error: unknown) {
        console.error('Failed to create surface:', error);
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
            return NextResponse.json({ error: 'Surface key already exists' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Failed to create surface' }, { status: 500 });
    }
}
