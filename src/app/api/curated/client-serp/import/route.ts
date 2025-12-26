import { NextResponse } from 'next/server';
import { addKeywords } from '@/lib/clientSerpStore';
import { getClients } from '@/lib/db';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { clientCode, keywords, source } = body;

        if (!clientCode) {
            return NextResponse.json({ success: false, error: 'clientCode is required' }, { status: 400 });
        }

        if (!keywords || !Array.isArray(keywords)) {
            return NextResponse.json({ success: false, error: 'keywords array is required' }, { status: 400 });
        }

        if (!source || typeof source !== 'string') {
            return NextResponse.json({ success: false, error: 'source is required' }, { status: 400 });
        }

        // Validate client code exists
        const validClients = await getClients();
        const validClientCodes = new Set(validClients.map(c => c.code));
        
        if (!validClientCodes.has(clientCode)) {
            return NextResponse.json({ success: false, error: 'Invalid clientCode' }, { status: 400 });
        }

        // Filter out empty keywords
        const validKeywords = keywords
            .map((k: string) => k.trim())
            .filter((k: string) => k.length > 0);

        if (validKeywords.length === 0) {
            return NextResponse.json({ success: false, error: 'No valid keywords provided' }, { status: 400 });
        }

        // Add keywords with source
        const imported = await addKeywords(clientCode, validKeywords, source);

        return NextResponse.json({
            success: true,
            imported
        });

    } catch (e: any) {
        console.error('Import error:', e);
        return NextResponse.json({ success: false, error: e.message || 'Import failed' }, { status: 500 });
    }
}

