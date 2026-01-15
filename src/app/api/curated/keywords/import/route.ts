import { NextResponse } from 'next/server';
import { addCuratedKeywords } from '@/lib/curatedStore';
import { getClients } from '@/lib/db';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { records } = body;

        if (!records || !Array.isArray(records)) {
            return NextResponse.json({ success: false, error: 'Invalid payload: records array required' }, { status: 400 });
        }

        const validClients = await getClients();
        const validClientCodes = new Set(validClients.map(c => c.code));

        const invalidRows: any[] = [];
        const validRows: any[] = [];

        for (const row of records) {
            // Validation
            if (!row.clientCode || !validClientCodes.has(row.clientCode) || !row.keyword) {
                invalidRows.push({ ...row, error: 'Invalid Client Code or Missing Keyword' });
                continue;
            }

            validRows.push({
                clientCode: row.clientCode,
                keyword: row.keyword,
                source: row.source || 'Manual Import',
                notes: row.notes || ''
            });
        }

        if (validRows.length > 0) {
            await addCuratedKeywords(validRows);
        }

        return NextResponse.json({
            success: true,
            imported: validRows.length,
            failed: invalidRows.length,
            failedRows: invalidRows
        });

    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
