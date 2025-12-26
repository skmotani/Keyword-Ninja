import OpenAI from 'openai';
import { getActiveCredentialByService } from '@/lib/apiCredentialsStore';
import {
  DomainProfile,
  ClientAIProfile,
  ProfileMeta,
  ProfileCoreIdentity,
  ProfileDomains,
  ProfileUrlClassificationSupport,
  ProfileKeywordClassificationSupport,
  ProfileBusinessRelevanceSupport,
  PatternWithExamples,
  MatchingDictionary
} from '@/types';

const MODEL = 'gpt-4o-mini';

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

interface PatternWithExamplesResponse {
  description: string;
  examples: string[];
}

interface AIProfileResponse {
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
  meta?: {
    clientName: string;
    generatedAt: string;
    industryTag: string;
    summary: string;
  };
  coreIdentity?: {
    businessModel: string;
    primaryOfferTypes: string[];
    productLines: string[];
    services: string[];
    industriesServed: string[];
    customerSegments: string[];
  };
  domains?: {
    primaryDomains: string[];
    secondaryDomains: string[];
    expectedTlds: string[];
    positiveDomainHints: string[];
    negativeDomainHints: string[];
  };
  urlClassificationSupport?: {
    productSlugPatterns: PatternWithExamplesResponse;
    categorySlugPatterns: PatternWithExamplesResponse;
    blogSlugPatterns: PatternWithExamplesResponse;
    resourceSlugPatterns: PatternWithExamplesResponse;
    supportSlugPatterns: PatternWithExamplesResponse;
    legalSlugPatterns: PatternWithExamplesResponse;
    accountSlugPatterns: PatternWithExamplesResponse;
    careersSlugPatterns: PatternWithExamplesResponse;
    aboutCompanySlugPatterns: PatternWithExamplesResponse;
    marketingLandingPatterns: PatternWithExamplesResponse;
  };
  keywordClassificationSupport?: {
    brandKeywords: PatternWithExamplesResponse;
    transactionalPhrases: PatternWithExamplesResponse;
    commercialResearchPhrases: PatternWithExamplesResponse;
    informationalPhrases: PatternWithExamplesResponse;
    directoryPhrases: PatternWithExamplesResponse;
    irrelevantKeywordTopics: PatternWithExamplesResponse;
  };
  businessRelevanceSupport?: {
    directCompetitorDefinition: string;
    potentialCustomerDefinition: string;
    marketplaceDefinition: string;
    irrelevantDefinition: string;
  };
  matchingDictionary?: MatchingDictionary;
}

const SYSTEM_PROMPT = `
You are an SEO Keyword Tagging Engine Architect building a scalable, explainable keyword classification system.

Your task is to generate a Client AI Profile containing a "Matching Dictionary" that classifies keywords for the given client domain context.

# Master Dictionary Architecture
The dictionary uses "Token Buckets" to classify keywords deterministically.
1. Brand Tokens: Variations of the client's brand name.
2. Positive Tokens: Core product terms, synonyms, and strong relevance signals.
3. Negative Tokens: Terms that indicate irrelevance.
   - You can flag some as "Hard Negatives" if they strictly disqualify a keyword.
4. Ambiguous Tokens: Terms that are relevant ONLY if an Anchor approach is present.
   - e.g. "ring" is ambiguous (jewelry vs machinery). "twist" is positive. "machine" is an Anchor.
5. Anchor Tokens: Context validators (e.g. "machine", "equipment", "service", "manufacturer").
6. Ignore Tokens: Stopwords or noise to be stripped before matching.

# Normalization
All tokens should be lowercase, singular (if possible), and stripped of punctuation.

# Output Schema
You must return a JSON object satisfying this structure:

{
  "clientCode": "string",
  "domainType": "string",
  "coreIdentity": {
    "brandName": "string",
    "primaryIndustry": "string",
    "coreOfferings": ["string"]
  },
  "matchingDictionary": {
    "version": 2,
    "brandTokens": [ { "token": "string", "scope": "GLOBAL" } ],
    "positiveTokens": [ { "token": "string", "scope": "GLOBAL" } ],
    "negativeTokens": [ { "token": "string", "scope": "GLOBAL", "isHardNegative": true/false } ],
    "ambiguousTokens": [ { "token": "string", "scope": "GLOBAL" } ],
    "anchorTokens": [ { "token": "string", "scope": "GLOBAL" } ],
    "ignoreTokens": [ { "token": "string", "scope": "GLOBAL" } ],
    "productLineMap": { "token": ["PRODUCT_LINE_ENUM"] }
  },
  "classificationIntentHints": {
     "informationalIntentKeywords": ["string"],
     "commercialResearchKeywords": ["string"],
     "transactionalKeywords": ["string"],
     "directoryKeywords": ["string"]
  },
  "businessRelevanceLogicNotes": {
     "directCompetitorDefinition": "string",
     "potentialCustomerDefinition": "string",
     "marketplaceChannelDefinition": "string",
     "irrelevantDefinition": "string"
  }
}

Ensure "scope" is always "GLOBAL" for your generated rules.
Populate "productLineMap" to map Positive Tokens to specific Product Lines (e.g. "twister" -> ["TWISTING"]).
Use one of these enums for product lines if applicable: "TWISTING", "WINDING", "HEAT_SETTING", "OTHER".
`;

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
  // Try to get credential from store first
  const credential = await getActiveCredentialByService('OPENAI');

  // Use stored key or fallback to env var
  const apiKey = credential?.apiKey || credential?.apiKeyMasked || process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey.startsWith('****')) { // Ensure we don't accidentally use a masked value if raw key is missing
    // Double check if process.env has it if the stored one was masked
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured in Settings or environment variables.');
    }
  }

  // Use the valid key (either from store or env)
  const finalApiKey = (credential?.apiKey && !credential.apiKey.startsWith('****'))
    ? credential.apiKey
    : process.env.OPENAI_API_KEY;

  if (!finalApiKey) {
    throw new Error('Valid OPENAI_API_KEY not found. Please configure in Settings.');
  }

  const openai = new OpenAI({ apiKey: finalApiKey });

  const userPrompt = `NOW HERE IS THE ACTUAL CLIENT MASTER DATA:
----------------------------------------------------------------
  ${JSON.stringify(clientInputData, null, 2)}
----------------------------------------------------------------

  Generate the CLIENT PROFILE JSON for this client.`;

  console.log('[OpenAI] Sending request to generate client profile for:', clientInputData.clientCode);
  console.log('[OpenAI] Number of domains:', clientInputData.domains.length);

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 8192,
    });

    const textContent = response.choices[0]?.message?.content;

    if (!textContent) {
      throw new Error('No content in OpenAI response');
    }

    console.log('[OpenAI] Response received');

    let parsedResponse: AIProfileResponse;
    try {
      parsedResponse = JSON.parse(textContent);
    } catch (e) {
      console.error('[OpenAI] Failed to parse response:', textContent);
      throw new Error('Failed to parse OpenAI response as JSON');
    }

    // --- VALIDATION & NORMALIZATION START ---

    if (!parsedResponse.matchingDictionary) {
      console.error('[OpenAI] Invalid Response: Missing matchingDictionary');
      throw new Error('AI Response invalid: Missing matchingDictionary section. Please retry.');
    }

    const dict = parsedResponse.matchingDictionary;
    if (!dict.brandTokens || dict.brandTokens.length === 0) {
      throw new Error('AI Response invalid: brandTokens empty.');
    }
    if (!dict.negativeTokens) {
      // Tolerant but warn
      dict.negativeTokens = [];
    }
    if (!dict.productLineTokens || Object.keys(dict.productLineTokens).length === 0) {
      throw new Error('AI Response invalid: productLineTokens missing/empty.');
    }

    // Normalize Product Line Keys
    // We strictly map to "TWISTING", "WINDING", "HEAT_SETTING", "OTHER"
    const normalizedPlTokens: Record<string, string[]> = {};

    // Helper to merge arrays unique
    const merge = (target: string[], source: string[]) => {
      const s = new Set([...target, ...source.map(x => x.toLowerCase().trim())]);
      return Array.from(s);
    };

    // Initialize Standard Keys
    normalizedPlTokens['TWISTING'] = [];
    normalizedPlTokens['WINDING'] = [];
    normalizedPlTokens['HEAT_SETTING'] = [];
    normalizedPlTokens['OTHER'] = [];

    // Process each key from AI
    Object.entries(dict.productLineTokens).forEach(([key, tokens]) => {
      const uKey = key.toUpperCase();
      if (!Array.isArray(tokens)) return;

      if (uKey.includes('TWIST')) {
        normalizedPlTokens['TWISTING'] = merge(normalizedPlTokens['TWISTING'], tokens);
      } else if (uKey.includes('WIND')) {
        normalizedPlTokens['WINDING'] = merge(normalizedPlTokens['WINDING'], tokens);
      } else if (uKey.includes('HEAT') || uKey.includes('SETTING')) {
        normalizedPlTokens['HEAT_SETTING'] = merge(normalizedPlTokens['HEAT_SETTING'], tokens);
      } else if (uKey === 'OTHER') {
        normalizedPlTokens['OTHER'] = merge(normalizedPlTokens['OTHER'], tokens);
      } else {
        // Fallback: If AI made up a new key like "TEXTILE_MACHINES", dump it in OTHER or try to map?
        // Or maybe we should keep the key if it's really distinct?
        // But the frontend expects standard keys for colors usually.
        // Let's dump to OTHER for safety to ensure Enum compliance if strict.
        normalizedPlTokens['OTHER'] = merge(normalizedPlTokens['OTHER'], tokens);
      }
    });

    // Cleanup empty keys from OTHER if we want cleaner UI? 
    // Actually, Typescript interface says Record<string, string[]> so any key is valid technically.
    // BUT we want deterministic tagging to work well.
    // Let's replace the dict.productLineTokens with our normalized version.
    dict.productLineTokens = normalizedPlTokens;

    // --- VALIDATION & NORMALIZATION END ---


    const domainsUsed = clientInputData.domains.map(d => d.domain);

    const defaultPatternWithExamples = { description: '', examples: [] };

    const profile: ClientAIProfile = {
      id: `ai - profile - ${clientInputData.clientCode} -${Date.now()} `,
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
      meta: parsedResponse.meta ? {
        clientName: parsedResponse.meta.clientName || clientInputData.clientName,
        generatedAt: new Date().toISOString(),
        industryTag: parsedResponse.meta.industryTag || parsedResponse.industryType || 'unknown',
        summary: parsedResponse.meta.summary || parsedResponse.shortSummary || '',
      } : undefined,
      coreIdentity: parsedResponse.coreIdentity ? {
        businessModel: parsedResponse.coreIdentity.businessModel || parsedResponse.businessModel || '',
        primaryOfferTypes: parsedResponse.coreIdentity.primaryOfferTypes || [],
        productLines: parsedResponse.coreIdentity.productLines || parsedResponse.productLines || [],
        services: parsedResponse.coreIdentity.services || [],
        industriesServed: parsedResponse.coreIdentity.industriesServed || [],
        customerSegments: parsedResponse.coreIdentity.customerSegments || parsedResponse.targetCustomerSegments || [],
      } : undefined,
      domains: parsedResponse.domains ? {
        primaryDomains: parsedResponse.domains.primaryDomains || domainsUsed,
        secondaryDomains: parsedResponse.domains.secondaryDomains || [],
        expectedTlds: parsedResponse.domains.expectedTlds || ['.com', '.in', '.co'],
        positiveDomainHints: parsedResponse.domains.positiveDomainHints || [],
        negativeDomainHints: parsedResponse.domains.negativeDomainHints || [],
      } : undefined,
      urlClassificationSupport: parsedResponse.urlClassificationSupport ? {
        productSlugPatterns: parsedResponse.urlClassificationSupport.productSlugPatterns || defaultPatternWithExamples,
        categorySlugPatterns: parsedResponse.urlClassificationSupport.categorySlugPatterns || defaultPatternWithExamples,
        blogSlugPatterns: parsedResponse.urlClassificationSupport.blogSlugPatterns || defaultPatternWithExamples,
        resourceSlugPatterns: parsedResponse.urlClassificationSupport.resourceSlugPatterns || defaultPatternWithExamples,
        supportSlugPatterns: parsedResponse.urlClassificationSupport.supportSlugPatterns || defaultPatternWithExamples,
        legalSlugPatterns: parsedResponse.urlClassificationSupport.legalSlugPatterns || defaultPatternWithExamples,
        accountSlugPatterns: parsedResponse.urlClassificationSupport.accountSlugPatterns || defaultPatternWithExamples,
        careersSlugPatterns: parsedResponse.urlClassificationSupport.careersSlugPatterns || defaultPatternWithExamples,
        aboutCompanySlugPatterns: parsedResponse.urlClassificationSupport.aboutCompanySlugPatterns || defaultPatternWithExamples,
        marketingLandingPatterns: parsedResponse.urlClassificationSupport.marketingLandingPatterns || defaultPatternWithExamples,
      } : undefined,
      keywordClassificationSupport: parsedResponse.keywordClassificationSupport ? {
        brandKeywords: parsedResponse.keywordClassificationSupport.brandKeywords || defaultPatternWithExamples,
        transactionalPhrases: parsedResponse.keywordClassificationSupport.transactionalPhrases || defaultPatternWithExamples,
        commercialResearchPhrases: parsedResponse.keywordClassificationSupport.commercialResearchPhrases || defaultPatternWithExamples,
        informationalPhrases: parsedResponse.keywordClassificationSupport.informationalPhrases || defaultPatternWithExamples,
        directoryPhrases: parsedResponse.keywordClassificationSupport.directoryPhrases || defaultPatternWithExamples,
        irrelevantKeywordTopics: parsedResponse.keywordClassificationSupport.irrelevantKeywordTopics || defaultPatternWithExamples,
      } : undefined,
      businessRelevanceSupport: parsedResponse.businessRelevanceSupport ? {
        directCompetitorDefinition: parsedResponse.businessRelevanceSupport.directCompetitorDefinition || '',
        potentialCustomerDefinition: parsedResponse.businessRelevanceSupport.potentialCustomerDefinition || '',
        marketplaceDefinition: parsedResponse.businessRelevanceSupport.marketplaceDefinition || '',
        irrelevantDefinition: parsedResponse.businessRelevanceSupport.irrelevantDefinition || '',
      } : undefined,
      matchingDictionary: dict, // Use normalized dictionary
    };

    console.log('[OpenAI] Profile generated successfully for:', clientInputData.clientCode);

    return { profile, domainsUsed };
  } catch (error: any) {
    console.error('[OpenAI] API Error:', error.message);

    if (error.status === 401) {
      throw new Error('Invalid OpenAI API key. Please check your API key.');
    }

    if (error.status === 429) {
      throw new Error('OpenAI API rate limit exceeded. Please wait a moment and try again.');
    }

    if (error.status === 500 || error.status === 503) {
      throw new Error('OpenAI service is temporarily unavailable. Please try again later.');
    }

    throw error;
  }
}
