import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getAiProfileByClientCode } from '@/lib/clientAiProfileStore';
import { getDomainKeywordsByClient } from '@/lib/domainOverviewStore'; // Assuming this exists or similar
import { getActiveCredentialByService } from '@/lib/apiCredentialsStore';

const MODEL = 'gpt-4o-mini';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { clientCode, scope, aggressiveness, includeKeywords } = body;

        if (!clientCode) {
            return NextResponse.json({ error: 'Client code is required' }, { status: 400 });
        }

        const profile = await getAiProfileByClientCode(clientCode);
        if (!profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        // 1. Get Keywords Sample
        let keywordSample: string[] = [];
        if (includeKeywords) {
            // Fetch up to 2000 keywords. 
            // Note: getDomainKeywordsByClient might be heavy. We should limit.
            const allKw = await getDomainKeywordsByClient(clientCode); // This reads the json file
            // Only take top 500 distinct keywords by search volume if possible, or just random sample?
            // Sort by volume? The array might not be sorted.
            // Let's just take the first 1000 for context to save tokens.
            keywordSample = allKw.slice(0, 1000).map(k => k.keyword);
        }

        // 2. Setup OpenAI
        const credential = await getActiveCredentialByService('OPENAI');
        const apiKey = credential?.apiKey || credential?.apiKeyMasked || process.env.OPENAI_API_KEY;

        if (!apiKey) { // Minimal check
            return NextResponse.json({ error: 'OpenAI API Key missing' }, { status: 500 });
        }
        const finalApiKey = (credential?.apiKey && !credential.apiKey.startsWith('****')) ? credential.apiKey : process.env.OPENAI_API_KEY;
        const openai = new OpenAI({ apiKey: finalApiKey });

        // 3. Build Prompt
        const existingDict = profile.matchingDictionary || {};

        // We only send relevant parts of dictionary to avoid HUGE context, or send all?
        // Sending all is better for de-duplication.

        const systemPrompt = `You are an expert taxonomy builder. 
Your goal is to expanded the "Matching Dictionary" for this client.
Client: ${profile.clientName}
Summary: ${profile.shortSummary}
Industry: ${profile.industryType}
Product Lines: ${profile.productLines.join(', ')}

OBJECTIVE:
Suggest NEW tokens to add to the dictionary.
Scope: ${scope} (FULL, PRODUCT_LINES, or NEGATIVES)
Aggressiveness: ${aggressiveness} (Conservative: high precision; Aggressive: improved recall/synonyms)

EXISTING DICTIONARY (Do NOT repeat these):
${JSON.stringify(existingDict, null, 2)}

INSTRUCTION:
1. Analyze the sample keywords (if provided) and the client identity.
2. Generate additional tokens that are missing.
3. Tokens must be lowercase, 1-4 words max.
4. Output JSON only.

JSON SCHEMA:
{
  "additions": {
     "brandTokens": [],
     "negativeTokens": [], // Irrelevant terms
     "industryIndicators": [],
     "productLineTokens": { "TWISTING": [], "WINDING": [], "HEAT_SETTING": [], "OTHER": [] }, // Use existing keys if possible
     "coreTokens": [],
     "adjacentTokens": [],
     "intentTokens": { "TRANSACTIONAL": [], "COMMERCIAL_RESEARCH": [], "INFORMATIONAL": [], "DIRECTORY": [] },
     "stopTokens": []
  },
  "rationaleSummary": "string"
}`;

        const userPrompt = `SAMPLE KEYWORDS FROM CORPUS:\n${keywordSample.join(', ')}\n\nGenerate additions now.`;

        const response = await openai.chat.completions.create({
            model: MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' }
        });

        const content = response.choices[0].message.content;
        const result = JSON.parse(content || '{}');

        return NextResponse.json({
            success: true,
            additions: result.additions || {},
            rationale: result.rationaleSummary
        });

    } catch (error: any) {
        console.error('Error in expand dictionary:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
