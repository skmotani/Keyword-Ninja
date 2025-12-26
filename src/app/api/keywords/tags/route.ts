import { NextResponse } from 'next/server';
import { readTags } from '@/lib/keywordTagsStore';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const clientCode = searchParams.get('clientCode');

        if (!clientCode) {
            return NextResponse.json({ success: false, error: 'Missing clientCode' }, { status: 400 });
        }

        const tags = await readTags(clientCode);

        return NextResponse.json({ success: true, tags });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
