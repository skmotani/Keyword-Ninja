import { NextRequest, NextResponse } from 'next/server';
import {
    getActiveExportPages,
    getColumnsForPage,
    ExportPageEntry,
    ExportColumnEntry
} from '@/lib/exportRegistryStore';
import { getExportDataForPages } from '@/lib/exportAdapters';
import { generateClientExportWorkbook, workbookToBuffer } from '@/lib/excelGenerator';

/**
 * GET /api/reports/client-data-export
 * Returns list of registered exportable pages and their columns
 */
export async function GET() {
    try {
        const pages = await getActiveExportPages();

        // Get columns for each page
        const columnsMap: Record<string, ExportColumnEntry[]> = {};
        for (const page of pages) {
            columnsMap[page.pageKey] = await getColumnsForPage(page.pageKey);
        }

        return NextResponse.json({
            success: true,
            pages,
            columns: columnsMap,
        });
    } catch (error) {
        console.error('Failed to get export pages:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch export pages' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/reports/client-data-export
 * Generates and returns Excel file for selected pages
 * 
 * Request body:
 * {
 *   clientCode: string,
 *   selectedPageKeys: string[]
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { clientCode, selectedPageKeys } = body;

        // Validate input
        if (!clientCode || typeof clientCode !== 'string') {
            return NextResponse.json(
                { success: false, error: 'clientCode is required' },
                { status: 400 }
            );
        }

        if (!selectedPageKeys || !Array.isArray(selectedPageKeys) || selectedPageKeys.length === 0) {
            return NextResponse.json(
                { success: false, error: 'selectedPageKeys must be a non-empty array' },
                { status: 400 }
            );
        }

        // Always include client-master as the first sheet
        const pageKeys = ['client-master', ...selectedPageKeys.filter(k => k !== 'client-master')];

        // Get export data for all selected pages
        const exportData = await getExportDataForPages(pageKeys, clientCode);

        if (exportData.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No data found for the selected pages' },
                { status: 404 }
            );
        }

        // Generate Excel workbook
        const timestamp = new Date();
        const workbook = await generateClientExportWorkbook(exportData, clientCode, timestamp);

        // Convert to buffer
        const buffer = await workbookToBuffer(workbook);

        // Convert Buffer to Uint8Array for NextResponse compatibility
        const uint8Array = new Uint8Array(buffer);

        // Generate filename
        const dateStr = timestamp.toISOString().split('T')[0];
        const filename = `${clientCode}_client_data_export_${dateStr}.xlsx`;

        // Return as downloadable file
        return new NextResponse(uint8Array, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': uint8Array.length.toString(),
            },
        });
    } catch (error) {
        console.error('Failed to generate export:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to generate export file' },
            { status: 500 }
        );
    }
}
