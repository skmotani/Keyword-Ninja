// Footprint Registry - Export API

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Export all surfaces as JSON or CSV
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const format = searchParams.get('format') || 'json';

        const surfaces = await prisma.footprintSurfaceRegistry.findMany({
            orderBy: [
                { category: 'asc' },
                { importanceTier: 'asc' },
                { surfaceKey: 'asc' },
            ],
        });

        if (format === 'csv') {
            // Generate CSV
            const headers = [
                'surfaceKey', 'label', 'category', 'importanceTier', 'basePoints',
                'defaultRelevanceWeight', 'sourceType', 'searchEngine', 'maxQueries',
                'officialnessRequired', 'enabled', 'confirmationArtifact',
            ];

            const rows = surfaces.map(s => [
                s.surfaceKey,
                `"${s.label}"`,
                s.category,
                s.importanceTier,
                s.basePoints,
                s.defaultRelevanceWeight,
                s.sourceType,
                s.searchEngine || '',
                s.maxQueries,
                s.officialnessRequired,
                s.enabled,
                `"${s.confirmationArtifact.replace(/"/g, '""')}"`,
            ].join(','));

            const csv = [headers.join(','), ...rows].join('\n');

            return new NextResponse(csv, {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': 'attachment; filename="footprint-registry.csv"',
                },
            });
        }

        // Default: JSON
        return NextResponse.json(surfaces, {
            headers: {
                'Content-Disposition': 'attachment; filename="footprint-registry.json"',
            },
        });

    } catch (error) {
        console.error('Export failed:', error);
        return NextResponse.json({ error: 'Export failed' }, { status: 500 });
    }
}
