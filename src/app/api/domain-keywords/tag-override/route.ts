
import { NextResponse } from 'next/server';
import { saveTags, normalizeKeyword } from '@/lib/keywordTagsStore';
import { KeywordTag, FitStatus, ProductLine } from '@/types';
import { readTags } from '@/lib/keywordTagsStore';

interface OverrideRequest {
    clientCode: string;
    keyword: string;
    fitStatus: FitStatus;
    productLine: ProductLine;
}

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as OverrideRequest;
        const { clientCode, keyword, fitStatus, productLine } = body;

        if (!clientCode || !keyword) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        const now = new Date().toISOString();
        const normalizedKw = normalizeKeyword(keyword);

        // Read existing to preserve dates if needed, or just overwrite
        // We treat override as a fresh update

        const tag: KeywordTag = {
            id: `${clientCode}_${normalizedKw}`,
            clientCode,
            keyword: normalizedKw,
            fitStatus,
            productLine,
            rationale: 'Manual Override via UI',
            profileVersion: 'MANUAL',
            modelRunId: 'MANUAL_OVERRIDE',
            createdAt: now, // Simplification: in real app we might want to keep original created date
            updatedAt: now,
        };

        await saveTags([tag]);

        return NextResponse.json({ success: true, tag });

    } catch (error: any) {
        console.error('Error in manual override:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
