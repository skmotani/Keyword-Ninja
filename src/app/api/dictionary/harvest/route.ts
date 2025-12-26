
import { NextResponse } from 'next/server';
import { getAiProfileByClientCode, saveAiProfile } from '@/lib/clientAiProfileStore';
import { getDomainKeywordsByClient } from '@/lib/domainOverviewStore';
import { saveTags, readTags, normalizeKeyword } from '@/lib/keywordTagsStore';
import { migrateLegacyDictionary, makeEntry, upsertToken, normalizeToken } from '@/lib/dictionaryService';
import { TokenEntry, DictionaryScope, MatchingDictionary } from '@/types';

// Re-use tagging logic from tag-all? 
// Ideally we should extract the tagging logic into a library function to avoid code duplication.
// But for now, we can just trigger a re-tag via an internal function call or let the client call tag-all.
// The Plan says "Trigger re-tag". 
// Let's extracting the tagging logic is better. Refactoring tag-all code into a service function first?
// Or I can just import the logic if I exported it? 
// I didn't export it from route.ts.

// Just for this MVP, I will Implement the "Save" part here, and let the Frontend trigger "Tag All" after success.
// This simplifies the API responsibility.

interface HarvestRequest {
    clientCode: string;
    terms: Array<{
        token: string;
        bucket: keyof MatchingDictionary; // brandTokens, positiveTokens, etc.
        scope: DictionaryScope;
        isHardNegative?: boolean;
        productLine?: string; // Single product line map
    }>;
}

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as HarvestRequest;
        const { clientCode, terms } = body;

        if (!clientCode || !terms || terms.length === 0) {
            return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
        }

        const profile = await getAiProfileByClientCode(clientCode);
        if (!profile) return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });

        // Migrate to ensure V2 structure
        let dict = migrateLegacyDictionary(profile.matchingDictionary);

        let updatedCount = 0;

        for (const t of terms) {
            // Upsert Token
            const entry = makeEntry(t.token, t.scope, t.isHardNegative);
            dict = upsertToken(dict, t.bucket, entry);

            // Handle Product Mapping if provided
            if (t.productLine) {
                const normToken = normalizeToken(t.token);
                dict.productLineMap[normToken] = [t.productLine]; // Store as array for consistency
            }
            updatedCount++;
        }

        // Update Profile
        const updatedProfile = {
            ...profile,
            matchingDictionary: dict,
            updatedAt: new Date().toISOString()
        };

        await saveAiProfile(updatedProfile);

        return NextResponse.json({
            success: true,
            message: `Harvested ${updatedCount} terms`,
            matchingDictionary: dict
        });

    } catch (error: any) {
        console.error('Harvest API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
