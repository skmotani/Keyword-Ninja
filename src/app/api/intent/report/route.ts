/**
 * Intent Report API
 * GET /api/intent/report?clientCode=...
 * 
 * Returns stored intent classification results for a client
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const getResultsPath = (clientCode: string) =>
    path.join(process.cwd(), 'src', 'lib', `intent_results_${clientCode}.json`);

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const clientCode = searchParams.get('clientCode');

        if (!clientCode) {
            return NextResponse.json({ success: false, error: 'clientCode required' }, { status: 400 });
        }

        const resultsPath = getResultsPath(clientCode);

        try {
            const data = await fs.readFile(resultsPath, 'utf-8');
            const result = JSON.parse(data);

            return NextResponse.json({
                success: true,
                data: result
            });
        } catch (readError) {
            // No results found
            return NextResponse.json({
                success: true,
                data: null,
                message: 'No intent classification results found. Run classification first.'
            });
        }

    } catch (error) {
        console.error('Intent report error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to load report'
        }, { status: 500 });
    }
}
