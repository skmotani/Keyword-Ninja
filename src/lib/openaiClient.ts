import OpenAI from 'openai';
import { 
  DomainProfile, 
  ClientAIProfile,
  ProfileMeta,
  ProfileCoreIdentity,
  ProfileDomains,
  ProfileUrlClassificationSupport,
  ProfileKeywordClassificationSupport,
  ProfileBusinessRelevanceSupport,
  PatternWithExamples
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
}

const SYSTEM_PROMPT = `You are an SEO, data-modeling, and classification expert that builds structured "client profiles" for a SERP intelligence and classification system.

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
- Classifying URLs by page type (product, blog, category, etc.)
- Classifying keywords by intent (transactional, informational, etc.)

CRITICAL: You must NOT hard-code any final classification labels. You must only provide patterns, keyword lists, and descriptive rules that programs will use later for domain, URL, and keyword classification.

YOUR TASK
---------
From the provided data, build a **CLIENT PROFILE JSON** with this schema:

{
  "clientId": string,
  "clientName": string,
  "primaryDomains": string[],
  "industryType": string,
  "shortSummary": string,
  "businessModel": string,
  "productLines": string[],
  "targetCustomerSegments": string[],
  "targetGeographies": string[],
  "coreTopics": string[],
  "adjacentTopics": string[],
  "negativeTopics": string[],
  "domainTypePatterns": {
    "oemManufacturerIndicators": string[],
    "serviceProviderIndicators": string[],
    "marketplaceIndicators": string[],
    "endCustomerIndicators": string[],
    "educationalMediaIndicators": string[]
  },
  "classificationIntentHints": {
    "transactionalKeywords": string[],
    "informationalKeywords": string[],
    "directoryKeywords": string[]
  },
  "businessRelevanceLogicNotes": {
    "directCompetitorDefinition": string,
    "potentialCustomerDefinition": string,
    "marketplaceChannelDefinition": string,
    "irrelevantDefinition": string
  },
  "meta": {
    "clientName": string,
    "generatedAt": string,
    "industryTag": string,
    "summary": string
  },
  "coreIdentity": {
    "businessModel": string,
    "primaryOfferTypes": string[],
    "productLines": string[],
    "services": string[],
    "industriesServed": string[],
    "customerSegments": string[]
  },
  "domains": {
    "primaryDomains": string[],
    "secondaryDomains": string[],
    "expectedTlds": string[],
    "positiveDomainHints": string[],
    "negativeDomainHints": string[]
  },
  "urlClassificationSupport": {
    "productSlugPatterns": { "description": string, "examples": string[] },
    "categorySlugPatterns": { "description": string, "examples": string[] },
    "blogSlugPatterns": { "description": string, "examples": string[] },
    "resourceSlugPatterns": { "description": string, "examples": string[] },
    "supportSlugPatterns": { "description": string, "examples": string[] },
    "legalSlugPatterns": { "description": string, "examples": string[] },
    "accountSlugPatterns": { "description": string, "examples": string[] },
    "careersSlugPatterns": { "description": string, "examples": string[] },
    "aboutCompanySlugPatterns": { "description": string, "examples": string[] },
    "marketingLandingPatterns": { "description": string, "examples": string[] }
  },
  "keywordClassificationSupport": {
    "brandKeywords": { "description": string, "examples": string[] },
    "transactionalPhrases": { "description": string, "examples": string[] },
    "commercialResearchPhrases": { "description": string, "examples": string[] },
    "informationalPhrases": { "description": string, "examples": string[] },
    "directoryPhrases": { "description": string, "examples": string[] },
    "irrelevantKeywordTopics": { "description": string, "examples": string[] }
  },
  "businessRelevanceSupport": {
    "directCompetitorDefinition": string,
    "potentialCustomerDefinition": string,
    "marketplaceDefinition": string,
    "irrelevantDefinition": string
  }
}

FIELD EXPLANATIONS
------------------
- meta.industryTag: short snake_case tag like "textile_machinery_oem" or "online_education"
- meta.summary: 2-3 sentence explanation of what the client does
- coreIdentity.primaryOfferTypes: main offer types like ["machines", "equipment", "online_courses", "software_saas"]
- domains.positiveDomainHints: lowercase words that suggest a domain is relevant to this industry
- domains.negativeDomainHints: lowercase words that usually mean NOT relevant (e.g. "movie", "music", "game")
- urlClassificationSupport.*SlugPatterns: each has description (what it identifies) and examples (lowercase slug fragments)
  - For a textile machinery OEM, productSlugPatterns.examples might be: ["twister", "winder", "heat-setting", "tfo"]
- keywordClassificationSupport.*: phrases that indicate intent, specific to this client's domain
  - brandKeywords: brand and near-brand phrases
  - transactionalPhrases: buying/quote/price intent phrases
  - irrelevantKeywordTopics: themes that share words but are wrong context

REQUIREMENTS
------------
- Use ONLY the provided Client Master data plus general industry understanding.
- Fill ALL fields with concrete examples (no "..." placeholders).
- Use lower-case strings for pattern examples where possible.
- "industryType" must be a SHORT machine-friendly label (lowercase, underscores).
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
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const openai = new OpenAI({ apiKey });

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

    const domainsUsed = clientInputData.domains.map(d => d.domain);

    const defaultPatternWithExamples = { description: '', examples: [] };

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
