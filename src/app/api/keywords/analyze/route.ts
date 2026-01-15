import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getAiProfileByClientCode } from '@/lib/clientAiProfileStore';
import { saveTags, generateTagId } from '@/lib/keywordTagsStore';
import { getActiveCredentialByService } from '@/lib/apiCredentialsStore';
import { KeywordTag, FitStatus, ProductLine } from '@/types';

// Constants
const MODEL = 'gpt-4o-mini';

// Initial System Prompt provided by the user
const SYSTEM_PROMPT = `
You are a strict keyword classification engine for SEO, Social Media, and LLM search strategy.
Output MUST be valid JSON only.
Do NOT include markdown, explanations, or commentary.
Return exactly one output object per input keyword, in the same order.
`.trim();

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { clientCode, keywords, runLabel } = body;

        if (!clientCode || !keywords || !Array.isArray(keywords) || keywords.length === 0) {
            return NextResponse.json({ success: false, error: 'Missing clientCode or keywords' }, { status: 400 });
        }

        // 1. Fetch Client AI Profile
        const profile = await getAiProfileByClientCode(clientCode);
        if (!profile) {
            return NextResponse.json({ success: false, error: 'AI Profile not found for this client. Please generate one in Client Master first.' }, { status: 404 });
        }

        // 2. Get OpenAI API Key
        const credential = await getActiveCredentialByService('OPENAI');
        const finalApiKey = (credential?.apiKey && !credential.apiKey.startsWith('****'))
            ? credential.apiKey
            : process.env.OPENAI_API_KEY;

        if (!finalApiKey) {
            return NextResponse.json({ success: false, error: 'OpenAI API Key not configured.' }, { status: 500 });
        }

        const openai = new OpenAI({ apiKey: finalApiKey });

        // 3. Construct User Prompt
        const keywordsList = keywords.map((k, i) => `${i + 1}) ${k}`).join('\n');

        const USER_PROMPT_TEMPLATE = `
We are tagging keywords using a client AI profile.
All relevance, matching, and exclusions MUST be derived from the provided profile.
Do NOT assume anything outside the profile.

TASK:
For EACH keyword, assign:
1) FIT_STATUS
2) PRODUCT_LINE
3) rationale_short

Allowed values:

FIT_STATUS (enum):
- BRAND_KW
- CORE_MATCH
- ADJACENT_MATCH
- REVIEW
- NO_MATCH

PRODUCT_LINE (enum):
- BRAND_KW
- TWISTING
- WINDING
- HEAT_SETTING
- MULTIPLE
- NONE

RATIONALE:
- rationale_short must be ≤ 18 words
- factual, no marketing language

--------------------
CLASSIFICATION RULES (apply strictly in this order)
--------------------

RULE 1 — BRAND KEYWORD (HIGHEST PRIORITY)
If the keyword:
- exactly matches OR
- contains OR
- is a close variant / spacing / typo variant

of ANY brand name, company name, or domain listed in the client profile
(Primary Domains, Secondary Domains, Brand Names),

THEN:
- FIT_STATUS = BRAND_KW
- PRODUCT_LINE = BRAND_KW
- rationale_short = "Brand or domain-related keyword"

This rule OVERRIDES all others.

--------------------

RULE 2 — NEGATIVE TOPICS
If the keyword clearly belongs to any Negative Topics defined in the client profile
(or close semantic variants),

THEN:
- FIT_STATUS = NO_MATCH
- PRODUCT_LINE = NONE
- rationale_short = "Negative or excluded topic per profile"

Exception:
If a negative term appears incidentally but the keyword is clearly about the client’s industry,
set:
- FIT_STATUS = REVIEW
- PRODUCT_LINE = NONE
- rationale_short = "Mixed signals with excluded term"

--------------------

RULE 3 — CORE MATCH
If the keyword clearly aligns with the client’s Core Topics or Core Product Offerings,
as defined in the profile:

- FIT_STATUS = CORE_MATCH

PRODUCT_LINE assignment:
- TWISTING → if keyword clearly implies twisting/twister/TFO/cabling/doubling concepts
- WINDING → if keyword clearly implies winding/winder/rewinder/cross/cone winding concepts
- HEAT_SETTING → if keyword clearly implies heat setting / heat-set / yarn setting concepts
- MULTIPLE → if two or more product lines are strongly implied
- NONE → if core match but no specific product line is inferable

rationale_short must explain the mapping briefly.

--------------------

RULE 4 — ADJACENT MATCH
If the keyword relates to Adjacent Topics in the profile
(e.g., industry processes, materials, certifications, efficiency topics)
but is NOT directly about the core product offerings:

- FIT_STATUS = ADJACENT_MATCH
- PRODUCT_LINE = NONE
- rationale_short = "Related industry topic, not direct product"

--------------------

RULE 5 — REVIEW (AMBIGUOUS)
If the keyword:
- is too generic
- lacks clear industry signals
- could belong to multiple industries
- partially overlaps but is unclear

THEN:
- FIT_STATUS = REVIEW
- PRODUCT_LINE = NONE
- rationale_short = "Ambiguous intent or insufficient context"

These rows MUST be suitable for manual override in UI.

--------------------

RULE 6 — NO MATCH (DEFAULT)
If none of the above apply:

- FIT_STATUS = NO_MATCH
- PRODUCT_LINE = NONE
- rationale_short = "Unrelated to client industry"

--------------------

OUTPUT FORMAT (JSON ONLY):
{
  "rows": [
    {
      "keyword": "<exact input keyword>",
      "fit_status": "BRAND_KW|CORE_MATCH|ADJACENT_MATCH|REVIEW|NO_MATCH",
      "product_line": "BRAND_KW|TWISTING|WINDING|HEAT_SETTING|MULTIPLE|NONE",
      "rationale_short": "..."
    }
  ]
}

--------------------
CLIENT AI PROFILE (SOURCE OF TRUTH):
${JSON.stringify(profile, null, 2)}

--------------------
KEYWORDS (preserve order exactly):
${keywordsList}
`.trim();

        // 4. Call OpenAI
        const response = await openai.chat.completions.create({
            model: MODEL,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: USER_PROMPT_TEMPLATE }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.0 // Strict deterministic output
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No content received from OpenAI');
        }

        let result: {
            rows: {
                keyword: string;
                fit_status: string;
                product_line: string;
                rationale_short: string;
            }[]
        };

        try {
            result = JSON.parse(content);
        } catch (e) {
            console.error('Failed to parse JSON from AI:', content);
            return NextResponse.json({ success: false, error: 'Failed to parse AI response' }, { status: 500 });
        }

        // 5. Transform and Save Tags
        const newTags: KeywordTag[] = [];
        const timestamp = new Date().toISOString();

        if (result.rows && Array.isArray(result.rows)) {
            for (const row of result.rows) {
                // Safe casting/defaults
                const fitStatus = (['BRAND_KW', 'CORE_MATCH', 'ADJACENT_MATCH', 'REVIEW', 'NO_MATCH'].includes(row.fit_status)
                    ? row.fit_status
                    : 'REVIEW') as FitStatus;

                const productLine = (['BRAND_KW', 'TWISTING', 'WINDING', 'HEAT_SETTING', 'MULTIPLE', 'NONE'].includes(row.product_line)
                    ? row.product_line
                    : 'NONE') as ProductLine;

                const tag: KeywordTag = {
                    id: generateTagId(clientCode, row.keyword),
                    clientCode,
                    profileVersion: profile.updatedAt || 'v1',
                    keyword: row.keyword, // Should be normalized? The prompt asks for exact input. We normalize for ID generation.
                    fitStatus: fitStatus,
                    productLine: productLine,
                    rationale: row.rationale_short || '',
                    modelRunId: runLabel || `run-${Date.now()}`,
                    createdAt: timestamp,
                    updatedAt: timestamp
                };
                newTags.push(tag);
            }
        }

        await saveTags(newTags);

        return NextResponse.json({
            success: true,
            rows: newTags,
            meta: {
                total: newTags.length,
                model: response.model,
                usage: response.usage
            }
        });

    } catch (error: any) {
        console.error('Error in analyze route:', error);
        return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
