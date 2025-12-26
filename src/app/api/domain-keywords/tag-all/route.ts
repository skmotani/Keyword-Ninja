
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

            let fitStatus: FitStatus = 'REVIEW';
            let productLine: ProductLine = 'NONE';
            let rationaleParts: string[] = [];

            // --- Algorithm Step 1: Hard Negative Gate ---
            const hardNeg = dict.negativeTokens.find(t => t.isHardNegative && isMatch(kwClean, t));
            if (hardNeg) {
                fitStatus = 'NO_MATCH';
                rationaleParts.push(`HardNeg: ${hardNeg.token}`);
            } else {

                // --- Algorithm Step 2: Classification ---
                const brandHits = dict.brandTokens.filter(t => isMatch(kwClean, t));
                const posHits = dict.positiveTokens.filter(t => isMatch(kwClean, t));
                const ambHits = dict.ambiguousTokens.filter(t => isMatch(kwClean, t));
                const negHits = dict.negativeTokens.filter(t => isMatch(kwClean, t)); // Non-hard negatives
                // We ignore ignoreTokens completely (noise)

                // --- Algorithm Step 3: Anchor Validation ---
                // "If Ambiguous tokens exist: At least one Anchor Token must be present, Else -> cannot be CORE"
                // Actually the prompt says: "Ambiguous terms can never produce CORE alone."
                // And "If Ambiguous tokens exist: At least one Anchor Token must be present" implies 
                // if we rely on the ambiguous token for score, we need anchor.

                const anchorHits = dict.anchorTokens.filter(t => isMatch(kwClean, t));
                const hasAnchor = anchorHits.length > 0;

                // --- Algorithm Step 4: Scoring ---
                // P = count of Positive tokens
                // A = Ambiguous tokens (only count if anchor present)

                let score = 0;

                // Brand (+10 - Override)
                if (brandHits.length > 0) {
                    score += 10;
                    rationaleParts.push(`Brand:${brandHits.map(t => t.token).join(',')}`);
                }

                // Positives (+1 each)
                // Deduplicate? "twisting" and "twist" might both match.
                // We trust the dictionary didn't contain dupes, or we distinct the hits?
                // Let's count distinct matched tokens.
                score += posHits.length * 1;
                if (posHits.length > 0) rationaleParts.push(`Pos:${posHits.map(t => t.token).join(',')}`);

                // Ambiguous (+0.5 if anchor)
                if (ambHits.length > 0) {
                    if (hasAnchor) {
                        score += ambHits.length * 0.5;
                        rationaleParts.push(`Amb:${ambHits.map(t => t.token).join(',')}(+Anchor)`);
                    } else {
                        rationaleParts.push(`Amb:${ambHits.map(t => t.token).join(',')}(NoAnchor)`);
                        // No score add
                    }
                }

                // Negatives (-5 each)
                if (negHits.length > 0) {
                    score -= negHits.length * 5;
                    rationaleParts.push(`Neg:${negHits.map(t => t.token).join(',')}`);
                }

                // --- Algorithm Step 5: Decision Rules ---

                if (score >= 10) {
                    fitStatus = 'BRAND_KW'; // Brand implies core usually, but we have specific status
                    // Actually Brand Matches are usually effectively CORE but better.
                } else if (score < 0) {
                    fitStatus = 'NO_MATCH';
                } else {
                    // Check specific thresholds
                    // CORE MATCH if: no negatives, P >= threshold (let's say 1), anchor satisfied if needed
                    const noNegs = negHits.length === 0;

                    // If we have ANY positive hit, and no negatives -> CORE?
                    // Prompt: "CORE MATCH if: no negatives, sufficient positive evidence (P >= threshold)"
                    if (noNegs && score >= 1) {
                        fitStatus = 'CORE_MATCH';
                    } else if (score > 0) {
                        // Some positive evidence but maybe negatives dragged it down, or just weak?
                        // If negatives exist but score still > 0? (e.g. 5 positives, 1 negative)
                        // Prompt: "NO MATCH if: negatives present OR no positives".
                        // Step 5 says: "NO MATCH if: negatives present". 
                        // So if NegHits > 0, it is NO MATCH (unless we have a specific override logic?)
                        // The prompt says "Guardrail 1: Certain negatives override everything". 
                        // "Step 5: NO MATCH if negatives present".

                        if (negHits.length > 0) {
                            fitStatus = 'NO_MATCH';
                        } else {
                            // Score > 0, No Negs -> Core Match (covered above)
                            fitStatus = 'REVIEW';
                        }
                    } else {
                        // Score <= 0
                        fitStatus = 'NO_MATCH';
                        // Or REVIEW if 0? 
                        // "REVIEW if: no negatives, partial evidence"
                        // If 0 evidence -> NO MATCH.
                        if (posHits.length === 0 && ambHits.length === 0) {
                            fitStatus = 'NO_MATCH';
                        } else {
                            fitStatus = 'REVIEW';
                        }
                    }
                }

                // --- Algorithm Step 6: Product Line Assignment ---
                // Assign product line based on strongest matching product-line token group.
                // We look at the 'productLineMap' in the dictionary.
                // productLineMap: { "twist": ["TWISTING"], "winder": ["WINDING"] }

                if (fitStatus === 'CORE_MATCH' || fitStatus === 'BRAND_KW') {
                    const detectedLines = new Set<string>();

                    // Check positives for mapping
                    posHits.forEach(p => {
                        const lines = dict.productLineMap[p.token];
                        if (lines) lines.forEach(l => detectedLines.add(l));
                    });

                    if (detectedLines.size === 1) {
                        const l = Array.from(detectedLines)[0];
                        // Map to known Enum? 
                        if (l === 'TWISTING') productLine = 'TWISTING';
                        else if (l === 'WINDING') productLine = 'WINDING';
                        else if (l === 'HEAT_SETTING') productLine = 'HEAT_SETTING';
                        else productLine = 'NONE';

                        rationaleParts.push(`PL:${productLine}`);
                    } else if (detectedLines.size > 1) {
                        productLine = 'MULTIPLE';
                        rationaleParts.push(`PL:Multiple`);
                    } else {
                        // Brand might not have product line
                        if (fitStatus === 'BRAND_KW') productLine = 'BRAND_KW';
                    }
                }
            } // End of Hard Neg else

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
