import ExcelJS from 'exceljs';
import { ExportData } from './exportAdapters';
import { matchGlossaryBatch, GlossaryEntry } from './exportRegistryStore';

const MAX_ROWS_PER_SHEET = 900000; // Leave buffer for headers and footnotes
const MAX_SHEET_NAME_LENGTH = 31; // Excel limit

export interface ExcelSheetData extends ExportData {
    glossaryMatches: Map<string, GlossaryEntry>;
}

/**
 * Sanitize sheet name to meet Excel requirements
 */
function sanitizeSheetName(name: string, suffix: string = ''): string {
    // Remove invalid characters: \ / * ? : [ ]
    let clean = name.replace(/[\\/*?:\[\]]/g, '-');

    // Truncate to fit within limit
    const maxLen = MAX_SHEET_NAME_LENGTH - suffix.length;
    if (clean.length > maxLen) {
        clean = clean.substring(0, maxLen);
    }

    return clean + suffix;
}

/**
 * Generate Excel workbook with multiple sheets
 * First sheet is always "data" containing metadata about all other sheets
 */
export async function generateClientExportWorkbook(
    sheets: ExportData[],
    clientCode: string,
    exportTimestamp: Date
): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SEO Intelligence';
    workbook.created = exportTimestamp;

    // Create "data" sheet first with metadata about all sheets
    await createDataSheet(workbook, sheets, clientCode, exportTimestamp);

    // Track sheet names to ensure uniqueness
    const usedSheetNames = new Set<string>();
    usedSheetNames.add('data'); // Reserve "data" sheet name

    for (const sheetData of sheets) {
        // Get glossary matches for this sheet's columns
        const columnNames = sheetData.columns.map(c => c.columnName);
        const glossaryMatches = await matchGlossaryBatch(columnNames);

        // Calculate number of sheets needed for this data
        const totalRows = sheetData.rows.length;
        const numSheets = Math.ceil(totalRows / MAX_ROWS_PER_SHEET) || 1;

        for (let sheetIndex = 0; sheetIndex < numSheets; sheetIndex++) {
            // Determine sheet name
            let baseName = sanitizeSheetName(sheetData.metadata.pageName);
            let sheetName = baseName;

            if (numSheets > 1) {
                sheetName = sanitizeSheetName(baseName, `_${sheetIndex + 1}`);
            }

            // Ensure uniqueness
            let counter = 1;
            while (usedSheetNames.has(sheetName)) {
                sheetName = sanitizeSheetName(baseName, `_${counter++}`);
            }
            usedSheetNames.add(sheetName);

            // Get rows for this sheet
            const startRow = sheetIndex * MAX_ROWS_PER_SHEET;
            const endRow = Math.min(startRow + MAX_ROWS_PER_SHEET, totalRows);
            const sheetRows = sheetData.rows.slice(startRow, endRow);

            // Create worksheet
            const worksheet = workbook.addWorksheet(sheetName);

            // Add metadata rows (1-3)
            addMetadataRows(worksheet, clientCode, exportTimestamp, sheetData.metadata);

            // Add header row (row 4)
            addHeaderRow(worksheet, sheetData.headers);

            // Add data rows (row 5+)
            addDataRows(worksheet, sheetRows, sheetData.columns);

            // Add footnote section
            addFootnotes(worksheet, sheetData, glossaryMatches, clientCode);

            // Auto-fit columns (approximate)
            autoFitColumns(worksheet, sheetData.columns);
        }
    }

    return workbook;
}

/**
 * Create "data" sheet with metadata about all exported sheets
 * This sheet is always first and contains: Sheet Name, JSON Source, Page Title, Column Headers
 */
async function createDataSheet(
    workbook: ExcelJS.Workbook,
    sheets: ExportData[],
    clientCode: string,
    timestamp: Date
): Promise<void> {
    const worksheet = workbook.addWorksheet('data');

    // Title row
    const titleRow = worksheet.addRow(['Export Metadata']);
    titleRow.font = { bold: true, size: 14 };
    titleRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE3F2FD' },
    };

    // Info rows
    worksheet.addRow(['Client Code:', clientCode]);
    worksheet.addRow(['Export Date:', timestamp.toISOString()]);
    worksheet.addRow(['Total Sheets:', sheets.length]);
    worksheet.addRow([]);

    // Header row
    const headerRow = worksheet.addRow(['Sheet Name', 'JSON Source', 'Page Title', 'Column Headers']);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4A5568' },
    };

    // Get page registry for JSON file names
    const { getExportPage } = require('./exportRegistryStore');

    // Add one row per sheet
    for (const sheet of sheets) {
        const page = await getExportPage(sheet.metadata.pageKey);
        const jsonSource = page?.dataSourceRef || 'N/A';
        const sheetName = sanitizeSheetName(sheet.metadata.pageName);
        const pageTitle = sheet.metadata.pageName;
        const columnHeaders = sheet.headers.join(', ');

        worksheet.addRow([sheetName, jsonSource, pageTitle, columnHeaders]);
    }

    // Auto-fit columns
    worksheet.getColumn(1).width = 25;  // Sheet Name
    worksheet.getColumn(2).width = 25;  // JSON Source
    worksheet.getColumn(3).width = 25;  // Page Title
    worksheet.getColumn(4).width = 80;  // Column Headers (wide for all cols)

    // Freeze header row
    worksheet.views = [
        { state: 'frozen', ySplit: 6, xSplit: 0 }
    ];
}

/**
 * Add metadata rows at the top of the sheet
 */
function addMetadataRows(
    worksheet: ExcelJS.Worksheet,
    clientCode: string,
    timestamp: Date,
    metadata: ExportData['metadata']
): void {
    // Row 1: Client Code
    const row1 = worksheet.addRow(['Client Code:', clientCode]);
    row1.font = { bold: true };
    row1.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE3F2FD' },
    };

    // Row 2: Export Timestamp
    const row2 = worksheet.addRow(['Export Date:', timestamp.toISOString()]);
    row2.font = { bold: true };
    row2.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE3F2FD' },
    };

    // Row 3: Source Route
    const row3 = worksheet.addRow(['Source Page:', `${metadata.pageName} (${metadata.route})`]);
    row3.font = { bold: true };
    row3.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE3F2FD' },
    };

    // Empty row for spacing
    worksheet.addRow([]);
}

/**
 * Add header row with formatting
 */
function addHeaderRow(worksheet: ExcelJS.Worksheet, headers: string[]): void {
    const headerRow = worksheet.addRow(headers);

    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4A5568' }, // Dark gray
    };

    // Freeze the header row
    worksheet.views = [
        { state: 'frozen', ySplit: 5, xSplit: 0 }
    ];
}

/**
 * Add data rows
 */
function addDataRows(
    worksheet: ExcelJS.Worksheet,
    rows: Record<string, any>[],
    columns: ExportData['columns']
): void {
    for (const row of rows) {
        const values = columns.map(col => {
            const val = row[col.columnName];
            // Format based on data type
            if (val === null || val === undefined) return '';
            if (col.dataType === 'date' && val) {
                try {
                    return new Date(val).toLocaleString();
                } catch {
                    return val;
                }
            }
            return val;
        });
        worksheet.addRow(values);
    }
}

/**
 * Add footnote section with definitions
 */
function addFootnotes(
    worksheet: ExcelJS.Worksheet,
    sheetData: ExportData,
    glossaryMatches: Map<string, GlossaryEntry>,
    clientCode: string
): void {
    // Add empty rows for spacing
    worksheet.addRow([]);
    worksheet.addRow([]);

    // Footnote header
    const footerStart = worksheet.addRow(['--- FOOTNOTES ---']);
    footerStart.font = { bold: true, size: 12 };
    footerStart.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF3CD' }, // Light yellow
    };

    worksheet.addRow([]);

    // Page description
    worksheet.addRow(['PAGE DESCRIPTION:']);
    const descRow = worksheet.addRow([sheetData.metadata.description]);
    descRow.font = { italic: true };

    worksheet.addRow([]);

    // Row description (grain)
    worksheet.addRow(['DATA GRAIN:']);
    const grainRow = worksheet.addRow([sheetData.metadata.rowDescription]);
    grainRow.font = { italic: true };

    worksheet.addRow([]);

    // Filters applied
    worksheet.addRow(['FILTERS APPLIED:']);
    worksheet.addRow([`Client Code: ${clientCode}`]);

    worksheet.addRow([]);

    // DataForSEO definitions (if any matches)
    if (glossaryMatches.size > 0) {
        const defHeader = worksheet.addRow(['METRIC DEFINITIONS (from DataForSEO):']);
        defHeader.font = { bold: true };

        Array.from(glossaryMatches.entries()).forEach(([columnName, entry]) => {
            worksheet.addRow([]);
            const metricRow = worksheet.addRow([`• ${columnName.toUpperCase()} (${entry.metricKey})`]);
            metricRow.font = { bold: true };

            const defRow = worksheet.addRow([`  Definition: ${entry.definition}`]);
            defRow.font = { italic: true };

            if (entry.notes) {
                worksheet.addRow([`  Note: ${entry.notes}`]);
            }

            if (entry.source) {
                worksheet.addRow([`  Source: ${entry.source}`]);
            }
        });
    }
}

/**
 * Auto-fit columns based on content length
 */
function autoFitColumns(
    worksheet: ExcelJS.Worksheet,
    columns: ExportData['columns']
): void {
    columns.forEach((col, index) => {
        const column = worksheet.getColumn(index + 1);
        // Set width based on header length, with min/max bounds
        const headerLen = col.displayName.length;
        column.width = Math.min(Math.max(headerLen + 2, 10), 50);
    });
}

/**
 * Convert workbook to buffer for streaming
 */
export async function workbookToBuffer(workbook: ExcelJS.Workbook): Promise<ArrayBuffer> {
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as ArrayBuffer;
}
