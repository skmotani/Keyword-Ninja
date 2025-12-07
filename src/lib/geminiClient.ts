import { DomainProfile, ClientAIProfile } from '@/types';

interface ClientInputData {
  clientCode: string;
  clientName: string;
  notes?: string;
  domains: Array<{
    domain: string;
    active: boolean;
    title: string | null;
    metaDescription: string | null;
    inferredCategory: string | null;
    organicTraffic: number | null;
    organicKeywords: number | null;
    topKeywords: Array<{
      keyword: string;
      position: number;
      searchVol: number | null;
      url: string | null;
    }>;
  }>;
}

interface GeminiResponse {
  clientId: string;
  clientName: string;
  primaryDomains: string[];
  industryType: string;
  shortSummary: string;
  businessModel: string;
  productLines: string[];
  targetCustomerSegments: string[];
  targetGeographies: string[];
  coreTopics: string[];
  adjacentTopics: string[];
  negativeTopics: string[];
  domainTypePatterns: {
    oemManufacturerIndicators: string[];
    serviceProviderIndicators: string[];
    marketplaceIndicators: string[];
    endCustomerIndicators: string[];
    educationalMediaIndicators: string[];
  };
  classificationIntentHints: {
    transactionalKeywords: string[];
    informationalKeywords: string[];
    directoryKeywords: string[];
  };
  businessRelevanceLogicNotes: {
    directCompetitorDefinition: string;
    potentialCustomerDefinition: string;
    marketplaceChannelDefinition: string;
    irrelevantDefinition: string;
  };
}

const SYSTEM_PROMPT = `You are an AI assistant that builds structured "client profiles" for a SERP intelligence and classification system.

CONTEXT ABOUT THE SYSTEM
------------------------
We maintain a "Client Master" where each client has:
- A short code (e.g. "01")
- A name (e.g. "Meera Industries")
- Up to 5 domains
- For each domain, a "Domain Profile" with SEO information:
  - Title (page title)
  - Meta Description
  - Inferred Category (e.g. E-commerce, Education, etc.)
  - Organic Traffic, Organic Keywords (numbers; just for context)
  - Top Keywords table:
    - keyword
    - position
    - search volume
    - CPC (optional)
    - URL

Your job is:
Given the full "Client Master" record for ONE client (code, name, domains + domain profiles + keywords), generate a **machine-usable AI profile** that will act as the "brain" for:
- Understanding what this client does.
- Understanding what topics and intents are relevant to this client.
- Later classifying external domains and SERP results as:
  - direct competitors,
  - potential customers/leads,
  - marketplaces/directories,
  - content/educational,
  - irrelevant.

You must:
- Use ALL relevant information from the provided Client Master data.
- Make reasonable inferences about:
  - industry type,
  - business model,
  - product lines,
  - target customers,
  - topic clusters.
- Keep the output **strictly as JSON**, no extra explanation or comments.

YOUR TASK
---------
From the provided data, build a **CLIENT PROFILE JSON** with this schema:

{
  "clientId": string,              // e.g. "01"
  "clientName": string,            // full name (resolve from code + name + domains if needed)
  "primaryDomains": string[],      // list of domains that belong to this client (from Client Master)
  "industryType": string,          // short label like "textile_machinery", "edtech_coaching", "law_firm", etc.
  "shortSummary": string,          // 2–4 sentence plain-language description of who they are and what they do
  "businessModel": string,         // e.g. "B2B OEM textile machinery manufacturer", "Online EdTech test-prep platform"
  "productLines": string[],        // key products / services / categories inferred from titles, meta, and top keywords
  "targetCustomerSegments": string[], // list of who buys from or uses this client (e.g. 'technical yarn manufacturers', 'NEET/JEE aspirants')
  "targetGeographies": string[],   // inferred regions or markets (rough, based on context; keep generic like 'India', 'Global', etc.)
  "coreTopics": string[],          // highly relevant topics/keywords describing what the client offers (derived from top keywords and on-page text)
  "adjacentTopics": string[],      // related but slightly broader/narrower topics still relevant for discovering leads or context
  "negativeTopics": string[],      // obvious topics that should be treated as NOT relevant for this client (e.g. hobby knitting, fitness, crypto, etc.)
  "domainTypePatterns": {
    "oemManufacturerIndicators": string[],          // phrases that, when found in other domains, suggest they are similar suppliers/manufacturers (for B2B clients)
    "serviceProviderIndicators": string[],          // phrases that indicate coaching/consulting/service businesses (for service clients)
    "marketplaceIndicators": string[],              // domain fragments or phrases that usually indicate B2B/B2C marketplaces or listing sites
    "endCustomerIndicators": string[],              // phrases indicating end-product manufacturers or end-users (for B2B clients this often means potential leads)
    "educationalMediaIndicators": string[]          // phrases indicating blogs, media, knowledge hubs, docs, etc.
  },
  "classificationIntentHints": {
    "transactionalKeywords": string[],   // words/phrases that usually indicate commercial / buy / enroll / manufacturer intent for THIS client type
    "informationalKeywords": string[],   // words/phrases that indicate how-to, notes, guides, explanations, lectures, etc.
    "directoryKeywords": string[]        // words/phrases that indicate directories, listings, portals, marketplaces
  },
  "businessRelevanceLogicNotes": {
    "directCompetitorDefinition": string,       // in 2–3 lines, define what qualifies as a direct competitor for THIS client
    "potentialCustomerDefinition": string,      // in 2–3 lines, define what qualifies as a potential customer/lead
    "marketplaceChannelDefinition": string,     // in 1–2 lines, define marketplaces/directories for THIS client
    "irrelevantDefinition": string              // in 1–2 lines, define what is clearly irrelevant
  }
}

REQUIREMENTS
------------
- Use ONLY the provided Client Master data plus general industry understanding. Do NOT invent detailed financials or traffic numbers.
- Always fill all fields; if something is unclear, make a reasonable assumption that stays consistent with the domains, titles, meta descriptions, and keywords.
- "industryType" must be a SHORT machine-friendly label (lowercase, underscores).
- "coreTopics" and "adjacentTopics" should be useful as matching tokens for later domain classification.
- "negativeTopics" should help filter out garbage SERP results and unrelated industries.
- Output MUST be a single valid JSON object, no markdown, no comments, no extra text.`;

export function buildClientInputData(
  clientCode: string,
  clientName: string,
  notes: string | undefined,
  domains: string[],
  domainProfiles: DomainProfile[]
): ClientInputData {
  const domainData = domains.map(domain => {
    const profile = domainProfiles.find(p => {
      const normalizedDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
      const normalizedProfile = p.domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
      return normalizedDomain === normalizedProfile;
    });

    return {
      domain,
      active: true,
      title: profile?.title || null,
      metaDescription: profile?.metaDescription || null,
      inferredCategory: profile?.inferredCategory || null,
      organicTraffic: profile?.organicTraffic || null,
      organicKeywords: profile?.organicKeywordsCount || null,
      topKeywords: (profile?.topKeywords || []).map(kw => ({
        keyword: kw.keyword,
        position: kw.position,
        searchVol: kw.searchVolume,
        url: kw.url,
      })),
    };
  });

  return {
    clientCode,
    clientName,
    notes,
    domains: domainData,
  };
}

export async function generateClientAIProfile(
  clientInputData: ClientInputData
): Promise<{ profile: ClientAIProfile; domainsUsed: string[] }> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const userPrompt = `NOW HERE IS THE ACTUAL CLIENT MASTER DATA:
----------------------------------------------------------------
${JSON.stringify(clientInputData, null, 2)}
----------------------------------------------------------------

Generate the CLIENT PROFILE JSON for this client.`;

  console.log('[Gemini] Sending request to generate client profile for:', clientInputData.clientCode);
  console.log('[Gemini] Number of domains:', clientInputData.domains.length);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: SYSTEM_PROMPT },
              { text: userPrompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Gemini] API Error:', errorText);
    
    if (response.status === 429) {
      throw new Error('Gemini API quota exceeded. Please wait a minute and try again, or check your API key quota at ai.dev/usage');
    }
    
    if (response.status === 404) {
      throw new Error('Gemini model not found. The API may have changed.');
    }
    
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const result = await response.json();
  console.log('[Gemini] Response received');

  const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!textContent) {
    throw new Error('No content in Gemini response');
  }

  let parsedResponse: GeminiResponse;
  try {
    parsedResponse = JSON.parse(textContent);
  } catch (e) {
    console.error('[Gemini] Failed to parse response:', textContent);
    throw new Error('Failed to parse Gemini response as JSON');
  }

  const domainsUsed = clientInputData.domains.map(d => d.domain);

  const profile: ClientAIProfile = {
    id: `ai-profile-${clientInputData.clientCode}-${Date.now()}`,
    clientCode: clientInputData.clientCode,
    clientName: parsedResponse.clientName || clientInputData.clientName,
    primaryDomains: parsedResponse.primaryDomains || domainsUsed,
    domainsUsedForGeneration: domainsUsed,
    industryType: parsedResponse.industryType || 'unknown',
    shortSummary: parsedResponse.shortSummary || '',
    businessModel: parsedResponse.businessModel || '',
    productLines: parsedResponse.productLines || [],
    targetCustomerSegments: parsedResponse.targetCustomerSegments || [],
    targetGeographies: parsedResponse.targetGeographies || [],
    coreTopics: parsedResponse.coreTopics || [],
    adjacentTopics: parsedResponse.adjacentTopics || [],
    negativeTopics: parsedResponse.negativeTopics || [],
    domainTypePatterns: parsedResponse.domainTypePatterns || {
      oemManufacturerIndicators: [],
      serviceProviderIndicators: [],
      marketplaceIndicators: [],
      endCustomerIndicators: [],
      educationalMediaIndicators: [],
    },
    classificationIntentHints: parsedResponse.classificationIntentHints || {
      transactionalKeywords: [],
      informationalKeywords: [],
      directoryKeywords: [],
    },
    businessRelevanceLogicNotes: parsedResponse.businessRelevanceLogicNotes || {
      directCompetitorDefinition: '',
      potentialCustomerDefinition: '',
      marketplaceChannelDefinition: '',
      irrelevantDefinition: '',
    },
    generatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  console.log('[Gemini] Profile generated successfully for:', clientInputData.clientCode);

  return { profile, domainsUsed };
}
