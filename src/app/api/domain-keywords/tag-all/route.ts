
import { NextResponse } from 'next/server';
import { getDomainKeywordsByClient } from '@/lib/domainOverviewStore';
import { getAiProfileByClientCode } from '@/lib/clientAiProfileStore';
import { readTags, saveTags, normalizeKeyword } from '@/lib/keywordTagsStore';
import { KeywordTag, FitStatus, ProductLine, MatchingDictionary, TokenEntry } from '@/types';
import { migrateLegacyDictionary, normalizeToken } from '@/lib/dictionaryService';

// Deterministic Tagger v3 (Master Dictionary System)

interface TagAllRequest {
    clientCode: string;
    locationCode?: string; // 'all' | 'IN' | 'GL'
    domains?: string[];
}

// Helper: Check if text contains token (Robust Match)
function isMatch(text: string, entry: TokenEntry): boolean {
    const t = entry.token;
    if (!t) return false;

    // Exact word boundary for short tokens (< 4 chars)
    if (t.length < 4) {
        const regex = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return regex.test(text);
    }
    return text.includes(t);
}

// Helper: Word boundary matching for Product Relevance Filter terms
// Prevents "era" from matching inside "meera", "with" from matching "within", etc.
function matchesWithBoundary(keyword: string, term: string): boolean {
    if (!term || term.length === 0) return false;

    // For multi-word phrases, check if phrase exists in keyword
    if (term.includes(' ')) {
        return keyword.includes(term);
    }

    // For single words, use word boundary matching
    // This ensures "era" doesn't match inside "meera"
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');
    return regex.test(keyword);
}

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as TagAllRequest;
        const { clientCode, locationCode, domains } = body;

        if (!clientCode) return NextResponse.json({ success: false, error: 'Missing clientCode' }, { status: 400 });

        // 1. Fetch AI Profile
        const profile = await getAiProfileByClientCode(clientCode);
        if (!profile) return NextResponse.json({ success: false, error: 'AI Profile not found' }, { status: 404 });

        // 2. Load and Migrate Dictionary
        // We use migrateLegacyDictionary to ensure we have the V2 structure even if the DB has V1
        const dict = migrateLegacyDictionary(profile.matchingDictionary);

        // 3. Load Keywords
        let allRecords = await getDomainKeywordsByClient(clientCode);
        if (locationCode && locationCode !== 'all') allRecords = allRecords.filter(r => r.locationCode === locationCode);
        if (domains && domains.length > 0) allRecords = allRecords.filter(r => domains.includes(r.domain));

        if (allRecords.length === 0) return NextResponse.json({ success: true, totalKeywords: 0, updated: 0 });

        // 4. Processing Loop
        const tagsToSave: KeywordTag[] = [];
        const uniqueKeywords = new Set<string>();
        allRecords.forEach(r => uniqueKeywords.add(normalizeKeyword(r.keyword)));

        const now = new Date().toISOString();
        const runId = `DICT_MASTER_${now.replace(/[:.]/g, '-')}`;

        for (const normalizedKw of Array.from(uniqueKeywords)) {
            // Clean keyword for matching
            const kwClean = normalizeToken(normalizedKw);

            let fitStatus: FitStatus = 'BLANK';
            let productLine: ProductLine = 'NONE';
            let rationaleParts: string[] = [];

            // --- NEW: Product Relevance Filter Dictionary ---
            // Load terms from ai_kw_builder_term_dictionary (Product Relevance Filter)
            const productRelevanceDict = (profile as any).ai_kw_builder_term_dictionary?.terms || [];

            // Categorize terms by bucket
            const excludeTerms = productRelevanceDict.filter((t: any) => t.bucket === 'exclude').map((t: any) => t.term.toLowerCase());
            const brandTerms = productRelevanceDict.filter((t: any) => t.bucket === 'brand').map((t: any) => t.term.toLowerCase());
            const includeTerms = productRelevanceDict.filter((t: any) => t.bucket === 'include').map((t: any) => t.term.toLowerCase());
            const reviewTerms = productRelevanceDict.filter((t: any) => t.bucket === 'review').map((t: any) => t.term.toLowerCase());

            // Debug: Log dictionary counts on first keyword only
            if (tagsToSave.length === 0) {
                console.log('[TagAll] Dictionary loaded from ai_kw_builder_term_dictionary:');
                console.log(`  - Include terms (${includeTerms.length}):`, includeTerms.slice(0, 20));
                console.log(`  - Exclude terms (${excludeTerms.length}):`, excludeTerms.slice(0, 20));
                console.log(`  - Brand terms (${brandTerms.length}):`, brandTerms.slice(0, 20));
                console.log(`  - Review terms (${reviewTerms.length}):`, reviewTerms.slice(0, 20));
            }

            // Check matches using word boundary matching (prevents "era" matching inside "meera")
            const matchExclude = excludeTerms.filter((t: string) => matchesWithBoundary(kwClean, t));
            const matchBrand = brandTerms.filter((t: string) => matchesWithBoundary(kwClean, t));
            const matchInclude = includeTerms.filter((t: string) => matchesWithBoundary(kwClean, t));
            const matchReview = reviewTerms.filter((t: string) => matchesWithBoundary(kwClean, t));

            // Debug: Log specific keywords
            if (kwClean.includes('meera') || kwClean.includes('twist')) {
                console.log(`[TagAll] Checking keyword: "${kwClean}"`);
                console.log(`  - matchExclude: ${matchExclude.length > 0 ? matchExclude : 'none'}`);
                console.log(`  - matchBrand: ${matchBrand.length > 0 ? matchBrand : 'none'}`);
                console.log(`  - matchInclude: ${matchInclude.length > 0 ? matchInclude : 'none'}`);
            }

            // --- PRIORITY ORDER: Brand > Exclude > Include (Option C) ---
            // 1. Brand terms always win (your brand keywords)
            // 2. If no brand match, Exclude blocks everything
            // 3. If no exclude match, Include wins
            if (matchBrand.length > 0) {
                fitStatus = 'BRAND_KW';
                rationaleParts.push(`Brand: ${matchBrand.join(', ')}`);
            } else if (matchExclude.length > 0) {
                // Exclude blocks Include - if ANY exclude word is present, it's NO_MATCH
                fitStatus = 'NO_MATCH';
                rationaleParts.push(`Exclude: ${matchExclude.join(', ')}`);
            } else if (matchInclude.length > 0) {
                fitStatus = 'CORE_MATCH';
                rationaleParts.push(`Include: ${matchInclude.join(', ')}`);
            } else {
                // No match in any bucket - leave as BLANK
                fitStatus = 'BLANK';
                rationaleParts.push('No matches found');
            }

            // --- Product Line Assignment ---
            if (fitStatus === 'CORE_MATCH' || fitStatus === 'BRAND_KW') {
                const detectedLines = new Set<string>();
                const posHits = dict.positiveTokens.filter(t => isMatch(kwClean, t));
                posHits.forEach(p => {
                    const lines = dict.productLineMap[p.token];
                    if (lines) lines.forEach(l => detectedLines.add(l));
                });

                if (detectedLines.size === 1) {
                    const l = Array.from(detectedLines)[0];
                    if (l === 'TWISTING') productLine = 'TWISTING';
                    else if (l === 'WINDING') productLine = 'WINDING';
                    else if (l === 'HEAT_SETTING') productLine = 'HEAT_SETTING';
                    else productLine = 'NONE';
                    rationaleParts.push(`PL:${productLine}`);
                } else if (detectedLines.size > 1) {
                    productLine = 'MULTIPLE';
                    rationaleParts.push(`PL:Multiple`);
                } else if (fitStatus === 'BRAND_KW') {
                    productLine = 'BRAND_KW';
                }
            }

            // Final Rationale Composition
            const rationale = rationaleParts.join('; ');

            tagsToSave.push({
                id: `${clientCode}_${normalizedKw}`,
                clientCode,
                profileVersion: profile.updatedAt,
                keyword: normalizedKw,
                fitStatus,
                productLine,
                rationale,
                modelRunId: runId,
                createdAt: now,
                updatedAt: now,
            });
        }

        await saveTags(tagsToSave);

        return NextResponse.json({
            success: true,
            totalKeywords: allRecords.length,
            updated: tagsToSave.length,
            sampleRationale: tagsToSave.length > 0 ? tagsToSave[0].rationale : ''
        });

    } catch (error: any) {
        console.error('Master Tagger Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
