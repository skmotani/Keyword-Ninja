import { NextResponse } from 'next/server';
import { getClientPositionSerpRecords } from '@/lib/serpStore';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const clientCode = searchParams.get('clientCode');
    const selectedDomain = searchParams.get('selectedDomain');
    const locationType = searchParams.get('locationType'); // IN or GLOBAL

    if (!clientCode) {
        return NextResponse.json({ success: false, error: 'clientCode required' }, { status: 400 });
    }

    const data = await getClientPositionSerpRecords(
        clientCode,
        selectedDomain || undefined,
        (locationType as 'IN' | 'GL') || undefined
    );
    return NextResponse.json({ success: true, data });
}
