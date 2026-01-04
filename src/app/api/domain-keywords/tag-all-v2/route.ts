/**
 * Product Relevance Filter 2 API Endpoint
 * 
 * Uses dynamic rule-based classification from Client AI Profile
 * to assign TAG2 status to all keywords.
 */

import { NextResponse } from 'next/server';
import { getDomainKeywordsByClient } from '@/lib/domainOverviewStore';
import { getAiProfileByClientCode } from '@/lib/clientAiProfileStore';
import { readTags, saveTags, normalizeKeyword } from '@/lib/keywordTagsStore';
import { KeywordTag, FitStatus, ProductLine } from '@/types';
import { classifyAllKeywords, ClassificationStats } from '@/lib/keywordClassifierV2';

interface TagAllV2Request {
    clientCode: string;
    locationCode?: string; // 'all' | 'IN' | 'GL'
    domains?: string[];
}

interface TagAllV2Response {
    success: boolean;
    message: string;
    stats: ClassificationStats;
    processedCount: number;
    error?: string;
}

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as TagAllV2Request;
        const { clientCode, locationCode, domains } = body;

        if (!clientCode) {
            return NextResponse.json(
                { success: false, error: 'Missing clientCode' },
                { status: 400 }
            );
        }

        // 1. Fetch AI Profile
        const profile = await getAiProfileByClientCode(clientCode);
        if (!profile) {
            return NextResponse.json(
                { success: false, error: 'AI Profile not found. Please generate AI profile first.' },
                { status: 404 }
            );
        }

        // 2. Load Keywords from domain_keywords
        let allRecords = await getDomainKeywordsByClient(clientCode);

        // Apply filters
        if (locationCode && locationCode !== 'all') {
            allRecords = allRecords.filter(r => r.locationCode === locationCode);
        }
        if (domains && domains.length > 0) {
            allRecords = allRecords.filter(r => domains.includes(r.domain));
        }

        if (allRecords.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No keywords found to classify',
                stats: { total: 0, relevant: 0, irrelevant: 0, brand: 0, review: 0, blank: 0 },
                processedCount: 0
            });
        }

        // 3. Get unique keywords and domains
        const uniqueKeywords = new Set<string>();
        const uniqueDomains = new Set<string>();

        allRecords.forEach(r => {
            uniqueKeywords.add(normalizeKeyword(r.keyword));
            uniqueDomains.add(r.domain);
        });

        const keywordsList = Array.from(uniqueKeywords);
        const domainsList = Array.from(uniqueDomains);

        // 4. Run classification
        const { results, stats } = classifyAllKeywords(keywordsList, profile, domainsList);

        // 5. Load existing tags (Record<string, KeywordTag>) and update with TAG2 values
        const existingTagsRecord = await readTags(clientCode);
        const now = new Date().toISOString();
        const runId = `PRF2_${now.replace(/[:.]/g, '-')}`;

        const updatedTags: KeywordTag[] = [];

        // Iterate using Array.from to avoid downlevelIteration issue
        const resultsEntries = Array.from(results.entries());
        for (const [keyword, result] of resultsEntries) {
            const normalizedKw = normalizeKeyword(keyword);
            const existingTag = existingTagsRecord[normalizedKw];

            if (existingTag) {
                // Update existing tag with TAG2 values
                updatedTags.push({
                    ...existingTag,
                    tag2Status: result.tag2Status,
                    tag2Rationale: result.rationale,
                    updatedAt: now
                });
            } else {
                // Create new tag with minimal values
                updatedTags.push({
                    id: `${clientCode}_${normalizedKw}`,
                    clientCode,
                    profileVersion: profile.generatedAt || now,
                    keyword: normalizedKw,
                    fitStatus: 'BLANK' as FitStatus,
                    productLine: 'NONE' as ProductLine,
                    rationale: '',
                    modelRunId: runId,
                    createdAt: now,
                    updatedAt: now,
                    tag2Status: result.tag2Status,
                    tag2Rationale: result.rationale
                });
            }
        }

        // 6. Merge and save tags
        const tagMap = new Map<string, KeywordTag>();

        // First add all existing tags
        Object.values(existingTagsRecord).forEach((t: KeywordTag) => tagMap.set(t.keyword, t));

        // Then overwrite with updated ones
        updatedTags.forEach(t => tagMap.set(t.keyword, t));

        // Save all tags (saveTags takes only array)
        await saveTags(Array.from(tagMap.values()));

        // 7. Return response
        const response: TagAllV2Response = {
            success: true,
            message: `Classified ${stats.total} keywords using Product Relevance Filter 2`,
            stats,
            processedCount: updatedTags.length
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('[tag-all-v2] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                stats: { total: 0, relevant: 0, irrelevant: 0, brand: 0, review: 0, blank: 0 },
                processedCount: 0
            },
            { status: 500 }
        );
    }
}

