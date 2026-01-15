import { NextResponse } from 'next/server';
import { getDomainKeywordsByClient } from '@/lib/domainOverviewStore';
import { saveTags, normalizeKeyword } from '@/lib/keywordTagsStore';
import { KeywordTag } from '@/types';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { clientCode } = body;

        if (!clientCode) {
            return NextResponse.json({ success: false, error: 'Missing clientCode' }, { status: 400 });
        }

        // Get all keywords for this client
        const allRecords = await getDomainKeywordsByClient(clientCode);
        const uniqueKeywords = new Set<string>();
        allRecords.forEach(r => uniqueKeywords.add(normalizeKeyword(r.keyword)));

        const now = new Date().toISOString();
        const tagsToSave: KeywordTag[] = [];

        // Reset all tags to BLANK
        for (const normalizedKw of Array.from(uniqueKeywords)) {
            tagsToSave.push({
                id: `${clientCode}_${normalizedKw}`,
                clientCode,
                profileVersion: now,
                keyword: normalizedKw,
                fitStatus: 'BLANK',
                productLine: 'NONE',
                rationale: 'Reset by user',
                modelRunId: `RESET_${now.replace(/[:.]/g, '-')}`,
                createdAt: now,
                updatedAt: now,
            });
        }

        await saveTags(tagsToSave);

        return NextResponse.json({
            success: true,
            totalReset: tagsToSave.length
        });

    } catch (error: any) {
        console.error('Reset Tags Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
