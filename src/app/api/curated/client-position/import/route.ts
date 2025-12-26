import { NextResponse } from 'next/server';
import { upsertClientPositionSerpRecords } from '@/lib/serpStore';
import { ClientPositionSerpRecord } from '@/types';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { clientCode, selectedDomain, keywordList, source, locationType } = body;

        if (!clientCode || !selectedDomain || !keywordList || keywordList.length === 0) {
            return NextResponse.json({ success: false, error: 'Missing params' }, { status: 400 });
        }

        const timestamp = new Date().toISOString();
        const records: Partial<ClientPositionSerpRecord>[] = keywordList.map((k: string) => ({
            clientCode,
            selectedDomain,
            keyword: k,
            source: source || 'Manual',
            locationType: locationType || 'IN',
            // Initialize with default values for rendering
            rank: null,
            searchVolume: 0,
            competition: '-',
            checkUrl: '',
            lastPulledAt: timestamp
            // No result data yet, will be filled by Refresh
        }));

        await upsertClientPositionSerpRecords(records as any);

        return NextResponse.json({ success: true, count: records.length });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
