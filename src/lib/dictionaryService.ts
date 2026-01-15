import { ClientAIProfile, MatchingDictionary, TokenEntry, DictionaryScope } from '@/types';

// --- 1. Normalization Service ---

export function normalizeToken(token: string): string {
    if (!token) return '';
    return token
        .trim()
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // Remove punctuation except hyphens/spaces
        .replace(/\s+/g, ' ');    // Collapse spaces
}

/**
 * Enhanced normalization for checking equality
 * e.g. "twisting" -> "twist" could happen here if we had a stemmer.
 * For now, just strict lower-case trim.
 */
export function getCanonicalForm(token: string): string {
    return normalizeToken(token);
}


// --- 2. Dictionary Management ---

export const EMPTY_DICTIONARY: MatchingDictionary = {
    version: 0,
    brandTokens: [],
    positiveTokens: [],
    negativeTokens: [],
    ambiguousTokens: [],
    ignoreTokens: [],
    anchorTokens: [],
    productLineMap: {}
};

/**
 * Convert legacy string[] dictionary to new TokenEntry[] format
 */
export function migrateLegacyDictionary(oldDict: any): MatchingDictionary {
    if (!oldDict) return JSON.parse(JSON.stringify(EMPTY_DICTIONARY));

    // If already V2 (has positiveTokens), return as is
    if (oldDict.positiveTokens) return oldDict as MatchingDictionary;

    const newDict: MatchingDictionary = {
        ...EMPTY_DICTIONARY,
        version: oldDict.version || 1,
        brandTokens: (oldDict.brandTokens || []).map((t: string) => makeEntry(t, 'CLIENT')),
        negativeTokens: (oldDict.negativeTokens || []).map((t: string) => makeEntry(t, 'CLIENT')),

        // Merge Core/Adjacent/Product into Positive
        positiveTokens: [
            ...(oldDict.coreTokens || []).map((t: string) => makeEntry(t, 'CLIENT')),
            ...(oldDict.adjacentTokens || []).map((t: string) => makeEntry(t, 'CLIENT')),
        ],

        // Product Map
        productLineMap: {}
    };

    // Flatten Product Lines into Positive Tokens + Map
    if (oldDict.productLineTokens) {
        Object.entries(oldDict.productLineTokens).forEach(([line, tokens]) => {
            const tList = tokens as string[];
            tList.forEach(t => {
                // Add to positive if not exists
                if (!newDict.positiveTokens.find(pt => pt.token === t)) {
                    newDict.positiveTokens.push(makeEntry(t, 'CLIENT'));
                }
                // Update Map
                if (!newDict.productLineMap[t]) newDict.productLineMap[t] = [];
                if (!newDict.productLineMap[t].includes(line)) {
                    newDict.productLineMap[t].push(line);
                }
            });
        });
    }

    return newDict;
}

export function makeEntry(token: string, scope: DictionaryScope, isHardNegative = false): TokenEntry {
    return {
        token: normalizeToken(token),
        scope,
        isHardNegative,
        updatedAt: new Date().toISOString()
    };
}


// --- 3. Dictionary Operations ---

export function upsertToken(
    dict: MatchingDictionary,
    bucket: keyof MatchingDictionary,
    entry: TokenEntry
): MatchingDictionary {
    const next = { ...dict };

    // Arrays only
    if (!Array.isArray(next[bucket])) {
        // e.g. productLineMap is not a bucket in this sense
        return next;
    }

    const list = next[bucket] as TokenEntry[];
    const idx = list.findIndex(e => e.token === entry.token);

    if (idx >= 0) {
        // Update existing (Scope Override?)
        // Domain > Client > Global. 
        // If existing is DOMAIN and new is CLIENT, do not overwrite? 
        // For now, simpler: Upsert = Overwrite.
        list[idx] = { ...list[idx], ...entry, updatedAt: new Date().toISOString() };
    } else {
        list.push(entry);
    }

    // Auto-version bump?
    next.version += 1;
    return next;
}
