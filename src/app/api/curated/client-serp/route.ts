import { NextResponse } from 'next/server';
import { readClientSerpData } from '@/lib/clientSerpStore';
import { getClients } from '@/lib/db';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const clientCode = searchParams.get('clientCode');

        if (!clientCode) {
            return NextResponse.json({ success: false, error: 'clientCode is required' }, { status: 400 });
        }

        // Validate client code exists
        const validClients = await getClients();
        const validClientCodes = new Set(validClients.map(c => c.code));
        
        if (!validClientCodes.has(clientCode)) {
            return NextResponse.json({ success: false, error: 'Invalid clientCode' }, { status: 400 });
        }

        // Read client SERP data
        const data = await readClientSerpData(clientCode);

        return NextResponse.json({
            success: true,
            data
        });

    } catch (e: any) {
        console.error('Get SERP data error:', e);
        return NextResponse.json({ success: false, error: e.message || 'Failed to fetch data' }, { status: 500 });
    }
}

