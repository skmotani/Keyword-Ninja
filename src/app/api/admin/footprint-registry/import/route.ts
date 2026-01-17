// Footprint Registry - Import API

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface ImportSurface {
    surfaceKey: string;
    label: string;
    category: string;
    importanceTier: string;
    basePoints?: number;
    defaultRelevanceWeight?: number;
    sourceType: string;
    searchEngine?: string;
    queryTemplates?: string[];
    maxQueries?: number;
    confirmationArtifact: string;
    presenceRules?: Record<string, unknown>;
    officialnessRules?: Record<string, unknown>;
    officialnessRequired?: boolean;
    evidenceFields?: string[];
    tooltipTemplates?: Record<string, unknown>;
    enabled?: boolean;
    notes?: string;
    industryOverrides?: Record<string, number>;
    geoOverrides?: Record<string, number>;
}

// POST - Import surfaces from JSON
export async function POST(request: NextRequest) {
    console.log('Starting import...'); // Force deploy
    try {
        const body = await request.json();

        let surfaces: ImportSurface[] = [];

        if (Array.isArray(body)) {
            surfaces = body;
        } else if (body.surfaces && Array.isArray(body.surfaces)) {
            surfaces = body.surfaces;
        } else {
            return NextResponse.json({
                error: 'Invalid format. Expected array or { surfaces: [...] }'
            }, { status: 400 });
        }

        if (surfaces.length === 0) {
            return NextResponse.json({ error: 'No surfaces to import' }, { status: 400 });
        }

        // Validate each surface
        const errors: string[] = [];
        const validSurfaces: ImportSurface[] = [];

        for (let i = 0; i < surfaces.length; i++) {
            const s = surfaces[i];

            if (!s.surfaceKey) {
                errors.push(`Item ${i}: Missing surfaceKey`);
                continue;
            }
            if (!s.label) {
                errors.push(`Item ${i}: Missing label`);
                continue;
            }
            if (!s.category) {
                errors.push(`Item ${i}: Missing category`);
                continue;
            }
            if (!s.importanceTier) {
                errors.push(`Item ${i}: Missing importanceTier`);
                continue;
            }
            if (!s.sourceType) {
                errors.push(`Item ${i}: Missing sourceType`);
                continue;
            }
            if (!s.confirmationArtifact) {
                errors.push(`Item ${i}: Missing confirmationArtifact`);
                continue;
            }

            // Validate surfaceKey format
            if (!/^[A-Z][A-Z0-9_]*$/.test(s.surfaceKey)) {
                errors.push(`Item ${i}: surfaceKey must be uppercase snake_case`);
                continue;
            }

            validSurfaces.push(s);
        }

        if (validSurfaces.length === 0) {
            return NextResponse.json({ error: 'No valid surfaces', errors }, { status: 400 });
        }

        // Upsert surfaces
        let created = 0;
        let updated = 0;

        for (const s of validSurfaces) {
            const existing = await prisma.footprintSurfaceRegistry.findUnique({
                where: { surfaceKey: s.surfaceKey },
            });

            // Prepare data object, using Prisma.DbNull for null JSON fields
            // We use 'as any' for JSON fields to avoid strict type checks against InputJsonValue
            const data = {
                label: s.label,
                category: s.category,
                importanceTier: s.importanceTier,
                basePoints: s.basePoints ?? 10,
                defaultRelevanceWeight: s.defaultRelevanceWeight ?? 1.0,
                sourceType: s.sourceType,
                searchEngine: s.searchEngine || null,
                queryTemplates: (s.queryTemplates || []) as any,
                maxQueries: s.maxQueries ?? 2,
                confirmationArtifact: s.confirmationArtifact,
                presenceRules: s.presenceRules ? (s.presenceRules as any) : undefined, // undefined to skip update if missing
                officialnessRules: s.officialnessRules ? (s.officialnessRules as any) : undefined,
                officialnessRequired: s.officialnessRequired ?? true,
                evidenceFields: s.evidenceFields ? (s.evidenceFields as any) : undefined,
                tooltipTemplates: s.tooltipTemplates ? (s.tooltipTemplates as any) : undefined,
                enabled: s.enabled ?? true,
                notes: s.notes || null,
                industryOverrides: s.industryOverrides ? (s.industryOverrides as any) : undefined,
                geoOverrides: s.geoOverrides ? (s.geoOverrides as any) : undefined,
            };

            if (existing) {
                await prisma.footprintSurfaceRegistry.update({
                    where: { id: existing.id },
                    data,
                });
                updated++;
            } else {
                await prisma.footprintSurfaceRegistry.create({
                    data: {
                        surfaceKey: s.surfaceKey,
                        ...data,
                        // For creation, ensure JSON fields are null if undefined in data
                        presenceRules: data.presenceRules ?? undefined,
                        officialnessRules: data.officialnessRules ?? undefined,
                        evidenceFields: data.evidenceFields ?? undefined,
                        tooltipTemplates: data.tooltipTemplates ?? undefined,
                        industryOverrides: data.industryOverrides ?? undefined,
                        geoOverrides: data.geoOverrides ?? undefined,
                    },
                });
                created++;
            }
        }

        return NextResponse.json({
            success: true,
            created,
            updated,
            errors: errors.length > 0 ? errors : undefined,
        });

    } catch (error) {
        console.error('Import failed:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Import failed'
        }, { status: 500 });
    }
}
