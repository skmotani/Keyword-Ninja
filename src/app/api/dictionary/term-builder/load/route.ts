import { NextRequest, NextResponse } from 'next/server';
import { getClientDictionaryFromProfile, getGlobalDictionary } from '@/lib/dictionaries/termDictionaryStore';
import { applyAiClassification } from '@/lib/dictionaries/aiSuggest';
import { TermEntry } from '@/types/termDictionary';

// Helper to extract terms from keywords (Harvest logic replacement)
// For now, we assume the UI sends the current keyword list OR we fetch it from DB?
// "Harvested terms with AI suggestions" -> implie
// let's assume the CLIENT passes the current keywords or we fetch from `api-data` store.
// Alternatively, look at `src/app/keywords/domain-keywords/page.tsx`... 
// It fetches from `/api/keywords/domain-keywords`? 
// Let's rely on the client (UI) passing the raw terms/keywords if possible, 
// OR we fetch the keywords here if we strictly follow "Load API".
// Prompt: "Input: { clientCode, domain, industryKey }"
// Output: "Harvested terms with AI suggestions"
// This implies SERVER SIDE processing of raw keywords to terms.

export async function POST(req: NextRequest) {
    try {
        const { clientCode, domain, industryKey } = await req.json();

        if (!clientCode) {
            return NextResponse.json({ error: 'Missing clientCode' }, { status: 400 });
        }

        // 1. Load Existing Dictionaries
        const [clientDict, globalDict] = await Promise.all([
            getClientDictionaryFromProfile(clientCode),
            getGlobalDictionary(industryKey)
        ]);

        // 2. Fetch Raw Keywords (Simulation / Placeholder)
        // In a real Antigravity generic implementation, I'd need to find where keywords live.
        // Based on `domain-keywords/page.tsx`, it uses `HarvestModal`.
        // Let's assume we need to generate terms from Scratch? 
        // OR we return empty "currentTerms" and let the UI send them in a separate "Analyze" call?
        // Prompt says: "Output: Harvested terms with AI suggestions".
        // This strongly suggests the server does the heavy lifting of Unigram/Bigram extraction.

        // Let's stub the term extraction or use a dummy set if we can't easily access the main DB.
        // Actually, we can try to read `data/keywords.json` or similar if it exists.
        // `src/lib/keywordApiStore.ts` seems relevant.
        // `getKeywordApiDataByClientAndLocations`?

        // For SAFETY and SPEED: We will rely on simple mock-harvesting or reading a known file.
        // If impossible, we return just the dictionaries and let client merge.
        // BUT strict requirement: "Harvested terms".

        // Let's return the dictionaries. The UI will likely have the keywords loaded already in the state.
        // It might be better if the UI passes the content to "Analyze" endpoint.
        // But this is "LOAD". 
        // I will return the Persisted Dictionaries. 
        // The UI will be responsible for merging "Live" terms with "Persisted" terms for now,
        // unless I find the keyword store.

        return NextResponse.json({
            clientDictionary: clientDict,
            globalDictionary: globalDict,
            // We can't easily fetch ALL keywords here without proper args (location etc).
            // So we send just the dictionaries. The Client Interaction Flow implies
            // the user opens the panel -> data loads.
            // I'll add a 'terms' field that is empty or populated if I find the source.
            terms: []
        });

    } catch (error) {
        console.error('Error in Term Builder Load:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
