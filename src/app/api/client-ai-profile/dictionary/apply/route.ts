import { NextRequest, NextResponse } from 'next/server';
import { getAiProfileByClientCode, saveAiProfile } from '@/lib/clientAiProfileStore';
import { MatchingDictionary } from '@/types';

function normalizeToken(t: string): string {
    return t.toLowerCase().trim().replace(/\s+/g, ' ');
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { clientCode, additions, modelRunId } = body;

        if (!clientCode || !additions) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const profile = await getAiProfileByClientCode(clientCode);
        if (!profile || !profile.matchingDictionary) {
            return NextResponse.json({ error: 'Profile not found or invalid' }, { status: 404 });
        }

        const dict = profile.matchingDictionary;
        let totalAdded = 0;

        // Helper to merge
        const merge = (target: string[], incoming: string[]) => {
            let count = 0;
            incoming.forEach(raw => {
                const t = normalizeToken(raw);
                if (t && !target.includes(t)) {
                    target.push(t);
                    count++;
                    totalAdded++;
                }
            });
            return count;
        };

        // Merge top levels
        if (additions.brandTokens) merge(dict.brandTokens, additions.brandTokens);
        if (additions.negativeTokens) merge(dict.negativeTokens, additions.negativeTokens);
        if (additions.industryIndicators) merge(dict.industryIndicators, additions.industryIndicators);
        if (additions.coreTokens) merge(dict.coreTokens, additions.coreTokens);
        if (additions.adjacentTokens) merge(dict.adjacentTokens, additions.adjacentTokens);
        if (additions.stopTokens) merge(dict.stopTokens, additions.stopTokens);

        // Merge nested Product Lines
        if (additions.productLineTokens) {
            Object.entries(additions.productLineTokens).forEach(([key, tokens]) => {
                if (!dict.productLineTokens[key]) {
                    // Create if missing (e.g. OTHER or new mapped key)
                    dict.productLineTokens[key] = [];
                }
                merge(dict.productLineTokens[key], Array.isArray(tokens) ? tokens as string[] : []);
            });
        }

        // Merge nested Intents
        if (additions.intentTokens) {
            Object.entries(additions.intentTokens).forEach(([key, tokens]) => {
                // Cast key to keyof intentTokens
                const k = key as keyof typeof dict.intentTokens;
                if (dict.intentTokens[k]) {
                    merge(dict.intentTokens[k], Array.isArray(tokens) ? tokens as string[] : []);
                }
            });
        }

        // Add Log Entry (if we had a log field, user asked for "dictionaryAudit[]" but schema doesn't have it yet.
        // I should add it to the type or just meta? User said "Append audit log entry". 
        // I will check types/index.ts. If not present, I'll store it in meta or skip strict TS if needed, or update schema.
        // Updating schema is safer.

        await saveAiProfile(profile);

        return NextResponse.json({
            success: true,
            totalAdded,
            matchingDictionary: dict
        });

    } catch (error: any) {
        console.error('Error applying dictionary additions:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
