/**
 * Database Diagnostic API
 * 
 * GET /api/digital-footprint/diagnose
 * 
 * Shows actual database table structure
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const results: Record<string, unknown> = {};

        // Check tables
        const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename LIKE 'footprint%' OR tablename LIKE 'digital_footprint%'
        `;
        results.tables = tables.map(t => t.tablename);

        // Check footprint_surfaces columns
        try {
            const surfacesCols = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'footprint_surfaces'
                ORDER BY ordinal_position
            `;
            results.footprint_surfaces_columns = surfacesCols;
        } catch (e) { results.footprint_surfaces_columns = `Error: ${e}`; }

        // Check footprint_surface_rules columns
        try {
            const rulesCols = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'footprint_surface_rules'
                ORDER BY ordinal_position
            `;
            results.footprint_surface_rules_columns = rulesCols;
        } catch (e) { results.footprint_surface_rules_columns = `Error: ${e}`; }

        // Check digital_footprint_scans columns
        try {
            const scansCols = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'digital_footprint_scans'
                ORDER BY ordinal_position
            `;
            results.digital_footprint_scans_columns = scansCols;
        } catch (e) { results.digital_footprint_scans_columns = `Error: ${e}`; }

        // Check digital_footprint_scan_results columns
        try {
            const resultsCols = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'digital_footprint_scan_results'
                ORDER BY ordinal_position
            `;
            results.digital_footprint_scan_results_columns = resultsCols;
        } catch (e) { results.digital_footprint_scan_results_columns = `Error: ${e}`; }

        // Check indexes
        try {
            const indexes = await prisma.$queryRaw<Array<{ indexname: string; tablename: string }>>`
                SELECT indexname, tablename FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND (tablename LIKE 'footprint%' OR tablename LIKE 'digital_footprint%')
            `;
            results.indexes = indexes;
        } catch (e) { results.indexes = `Error: ${e}`; }

        // Count rows
        try {
            const surfaceCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
                SELECT COUNT(*) as count FROM footprint_surfaces
            `;
            results.surface_count = Number(surfaceCount[0]?.count || 0);
        } catch (e) { results.surface_count = `Error: ${e}`; }

        return NextResponse.json(results);

    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
