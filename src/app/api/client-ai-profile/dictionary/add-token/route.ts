import { NextRequest, NextResponse } from 'next/server';
import { getAiProfileByClientCode, saveAiProfile } from '@/lib/clientAiProfileStore';
import { ClientAIProfile, MatchingDictionary } from '@/types';

function normalizeToken(t: string): string {
    return t.toLowerCase().trim().replace(/\s+/g, ' ');
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { clientCode, bucketPath, token, tokens } = body;

        if (!clientCode || !bucketPath) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const profile = await getAiProfileByClientCode(clientCode);
        if (!profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        if (!profile.matchingDictionary) {
            return NextResponse.json({ error: 'Profile has no matchingDictionary' }, { status: 400 });
        }

        const dict = profile.matchingDictionary;
        const inputs = tokens && Array.isArray(tokens) ? tokens : [token];
        const normalizedInputs = inputs.filter((t: any) => typeof t === 'string' && t.trim()).map((t: string) => normalizeToken(t));

        if (normalizedInputs.length === 0) {
            return NextResponse.json({ success: true, matchingDictionary: dict });
        }

        // Resolve bucket
        // bucketPath can be "negativeTokens", "productLineTokens.TWISTING", "intentTokens.TRANSACTIONAL", etc.
        const pathParts = bucketPath.split('.');

        let targetArray: string[] | undefined;

        if (pathParts.length === 1) {
            // Top level array: brandTokens, negativeTokens, coreTokens, etc.
            const key = pathParts[0] as keyof MatchingDictionary;
            if (Array.isArray(dict[key])) {
                targetArray = dict[key] as string[];
            }
        } else if (pathParts.length === 2) {
            // Nested object: productLineTokens.TWISTING, intentTokens.TRANSACTIONAL
            const parentKey = pathParts[0] as keyof MatchingDictionary;
            const childKey = pathParts[1];
            const parentObj = dict[parentKey];

            if (parentObj && typeof parentObj === 'object' && !Array.isArray(parentObj)) {
                // Safe access
                if (!(childKey in parentObj)) {
                    // Check if we need to initialize it? 
                    // For productLineTokens, keys should ideally exist, but we can allow dynamic if strictly typed?
                    // The type definition is Record<string, string[]> for productLineTokens, so yes.
                    // For intentTokens, it's specific keys.
                    (parentObj as any)[childKey] = (parentObj as any)[childKey] || [];
                }
                targetArray = (parentObj as any)[childKey];
            }
        }

        if (!targetArray) {
            return NextResponse.json({ error: `Invalid or unreachable bucket path: ${bucketPath}` }, { status: 400 });
        }

        // Add unique
        let addedCount = 0;
        for (const t of normalizedInputs) {
            if (!targetArray.includes(t)) {
                targetArray.push(t);
                addedCount++;
            }
        }

        if (addedCount > 0) {
            // Update persistent storage
            await saveAiProfile(profile);
        }

        return NextResponse.json({
            success: true,
            addedCount,
            matchingDictionary: profile.matchingDictionary
        });

    } catch (error: any) {
        console.error('Error adding token:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
