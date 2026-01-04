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
You are an Expert SEO Keyword Classification Architect. Your task is to generate a COMPREHENSIVE Client AI Profile with an extensive "Matching Dictionary" that can accurately classify thousands of keywords for ANY industry.

# CRITICAL REQUIREMENTS - READ CAREFULLY

1. **EXHAUSTIVE TOKEN LISTS ARE MANDATORY**
   - positiveTokens: MINIMUM 200 tokens (aim for 300+)
   - negativeTokens: MINIMUM 100 tokens
   - competitorBrands: MINIMUM 30 tokens
   - ambiguousTokens: MINIMUM 30 tokens
   - anchorTokens: MINIMUM 40 tokens

2. **INDUSTRY EXPERTISE IS REQUIRED**
   - Research and include ALL terminology for the client's industry
   - Include machinery, equipment, processes, materials, components, specifications
   - Include industry jargon, abbreviations, technical terms
   - Include global and regional competitor names

3. **CLASSIFICATION ACCURACY DEPENDS ON COMPLETENESS**
   - Missing positive token = relevant keyword marked as "Review" (BAD)
   - Missing negative token = irrelevant keyword pollutes results (BAD)
   - When in doubt, INCLUDE the term in appropriate category

# TOKEN BUCKET DEFINITIONS

## 1. brandTokens
Client's own brand name and ALL variations.

**What to include:**
- Full company name (e.g., "meera industries")
- Short name (e.g., "meera")
- Domain-based name without TLD (e.g., "meeraind")
- Common variations: ltd, limited, pvt ltd, corp, corporation, enterprises, exports
- Subsidiary or sister brands if mentioned
- Common misspellings if any

**What NOT to include:**
- Competitor names (those go in competitorBrands)
- Generic industry terms

**Example:** For a company "Meera Industries" with domain "meeraind.com":
meera, meeraind, meera industries, meera industries ltd, meera industries limited, meera industries pvt ltd, meera corp, meera corporation, meera enterprises, meera exports

## 2. competitorBrands (MINIMUM 30 tokens)
All known competitors in the client's industry.

**What to include:**
- Global market leaders
- Regional competitors
- Competitors from major manufacturing countries (Germany, Italy, China, Japan, Taiwan, India, etc.)
- Parent companies and subsidiaries
- Name variations and abbreviations

**Research approach:**
- Think: "Who else sells similar products/services?"
- Think: "What brands would appear in industry trade shows?"
- Think: "What are the top 50 companies in this industry globally?"

## 3. positiveTokens (MINIMUM 200 tokens)
Terms that indicate the keyword is RELEVANT to the client's business.

**MANDATORY CATEGORIES TO COVER:**

### A. MACHINERY & EQUIPMENT (50+ tokens)
- Every type of machine the client sells or relates to
- Machine variants, models, configurations
- Industry-standard machine names
- Abbreviations (e.g., TFO, CNC, PLC)

### B. PROCESSES & OPERATIONS (40+ tokens)
- Manufacturing processes
- Processing steps
- Quality control processes
- Installation, maintenance, service processes

### C. MATERIALS & INPUTS (40+ tokens)
- Raw materials used in the industry
- Semi-finished materials
- Material types, grades, specifications
- Brand names of materials if common

### D. COMPONENTS & PARTS (40+ tokens)
- Machine parts and components
- Spare parts
- Consumables
- Accessories

### E. TECHNICAL SPECIFICATIONS (30+ tokens)
- Measurement units specific to industry
- Quality parameters
- Standards and certifications
- Technical jargon

### F. APPLICATIONS & END PRODUCTS (20+ tokens)
- What the machines/products create
- End-use applications
- Industries served

### G. BUYER INTENT TERMS (20+ tokens)
- manufacturer, supplier, exporter, dealer, distributor, wholesaler, vendor
- price, cost, rate, quote, quotation, pricing, rates
- buy, purchase, order, enquiry, inquiry, rfq
- machine, machinery, equipment, system, line, plant, unit, factory

### H. GEOGRAPHIC TERMS (20+ tokens)
- Major industry hubs/cities
- Manufacturing regions
- Countries relevant to trade
- Trade show locations

**Format:** All tokens lowercase, include singular and plural forms, include hyphenated and non-hyphenated versions.

## 4. negativeTokens (MINIMUM 100 tokens)
Terms that indicate the keyword is NOT relevant.

**HARD NEGATIVES (isHardNegative: true)** - Always exclude:

Jobs & Career:
jobs, job, career, careers, vacancy, vacancies, recruitment, hiring, hire, resume, cv, curriculum vitae, salary, salaries, interview, interviews, employment, unemployed, jobless, job opening, job openings, walk in, walk-in, walkin, fresher, freshers, trainee, trainees, internship, intern, interns, apprentice, placement, placements, naukri, indeed, linkedin jobs, job portal

Wikipedia & Definitions:
wikipedia, wiki, wikihow, meaning, definition, define, what is the meaning, full form, abbreviation, stands for, meaning in hindi, meaning in tamil, meaning in telugu, meaning in marathi, meaning in gujarati, matlab, kya hai, kya hota hai, arth, paribhasha

Free Downloads:
pdf download, free download, pdf free, free pdf, download free, torrent, crack, pirated, free software

**SOFT NEGATIVES (isHardNegative: false)** - Usually exclude:

Used/Second-hand:
used, second hand, secondhand, second-hand, old, scrap, junk, waste, salvage, refurbished, rental, rent, hire, lease, leasing

Financial/Stock:
stock market, share price, stock price, investor, investors, investment, invest, ipo, quarterly results, annual report, balance sheet, profit loss, dividend, shareholding, market cap, bse, nse, sensex, nifty

News/Media:
news, latest news, today news, breaking news, headlines, current affairs, blog, blogger, vlog, vlogger, video, videos, youtube, youtuber, tutorial video, tiktok, instagram, facebook, twitter, social media

Education/Academic:
course, courses, classes, coaching, coaching classes, training institute, training center, college, colleges, university, universities, school, schools, admission, admissions, syllabus, exam, exams, examination, question paper, question papers, previous year, model paper, notes, assignment, assignments, homework, degree, diploma, certificate course, online course, udemy, coursera, edx

Unrelated Industries:
recipe, recipes, food, foods, restaurant, restaurants, hotel, hotels, hospital, hospitals, medical, medicine, medicines, doctor, doctors, pharma, pharmaceutical, pharmaceuticals, drug, drugs, health, healthcare, fitness, yoga, gym, exercise, workout, beauty, cosmetic, cosmetics, makeup, skincare, fashion, clothing, clothes, wear, dress, dresses, shirt, shirts, pant, pants, saree, sarees, suit, suits, jewelry, jewellery

Real Estate:
real estate, property, properties, flat, flats, apartment, apartments, house, houses, home loan, mortgage, rent house, rental house, pg, hostel, hostels, plot, plots, land, lands, builder, builders, construction, villa, villas, township

Legal/Finance:
lawyer, lawyers, advocate, advocates, legal, court, courts, police, crime, crimes, accident, accidents, insurance, claim, claims, bank, banks, banking, loan, loans, finance, financing, credit, credit card, debit, debit card, atm, emi, tax, taxes, gst, income tax, ca, chartered accountant, audit

Entertainment:
game, games, gaming, gamer, movie, movies, film, films, song, songs, music, mp3, mp4, entertainment, cricket, football, soccer, sports, sport, actor, actors, actress, actresses, celebrity, celebrities, bollywood, hollywood, netflix, amazon prime, hotstar

## 5. ambiguousTokens (MINIMUM 30 tokens)
Terms that could be relevant OR irrelevant depending on context.
These need an ANCHOR term to confirm relevance.

**Criteria for ambiguous tokens:**
- Word has multiple meanings across different industries
- Relevant meaning requires industry context
- Without context, classification is uncertain

**Common ambiguous patterns:**
- Single common English words that have industry-specific meaning
- Words that could refer to consumer products OR industrial products
- Action words that have industry-specific applications

**Examples by industry type:**

For Manufacturing/Machinery:
ring, cone, beam, frame, card, count, twist, draft, shed, pick, beat, package, tension, guide, feed, drive, motor, roller, cylinder, setting, coating, printing, opening, cleaning, cutting, pressing, forming, molding, casting, finishing, threading, boring, turning, milling, grinding, polishing, welding, assembly, testing, inspection, loading, unloading, handling, transfer, conveyor, lift, hoist, crane, pump, valve, pipe, tube, wire, cable, belt, chain, gear, shaft, bearing, seal, spring, screw, bolt, nut, washer, bracket, clamp, holder, fixture, jig, tool, die, mold, pattern

For Services/Consulting:
solution, solutions, strategy, plan, analysis, assessment, review, audit, consulting, advisory, implementation, integration, optimization, transformation, management, support, service, maintenance

For Software/Technology:
system, platform, application, software, program, module, interface, dashboard, portal, database, server, cloud, network, security, automation, integration, api

## 6. anchorTokens (MINIMUM 40 tokens)
Context validators that confirm relevance when combined with ambiguous terms.

**What are anchors:**
- Industry-specific qualifiers
- Technical context words
- Business context words

**Standard anchors (include ALL relevant ones):**
machine, machines, machinery, equipment, equipments, industrial, industry, industries, manufacturing, manufacturer, manufacturers, factory, factories, plant, plants, mill, mills, unit, units, line, lines, system, systems, process, processing, production, automatic, automated, semi-automatic, semi-automated, manual, heavy duty, heavy-duty, high speed, high-speed, precision, commercial, professional, technical, laboratory, lab, testing, quality, control, spare, spares, parts, part, component, components, accessory, accessories, supplier, suppliers, exporter, exporters, dealer, dealers, distributor, distributors, vendor, vendors, trader, traders, stockist, price, prices, pricing, cost, costing, rate, rates, quotation, quote, buy, buying, purchase, purchasing, order, ordering, sale, sales, selling, installation, installing, service, servicing, maintenance, repair, repairing, commissioning, erection, operation, operating, operator, training, specification, specifications, spec, specs, model, models, capacity, output, power, speed, efficiency, performance, warranty, guarantee, catalogue, catalog, brochure, datasheet, manual

## 7. productLineTokens
Map positive tokens to the client's specific product lines.

**Instructions:**
- Create categories based on client's actual product lines from input data
- Each category should contain tokens specific to that product line
- Use UPPERCASE for category names
- Include an "OTHER" category for general industry terms

**Format:**
{
  "PRODUCT_LINE_1": ["token1", "token2", "token3", ...],
  "PRODUCT_LINE_2": ["token1", "token2", "token3", ...],
  "OTHER": ["general", "industry", "tokens", ...]
}

# OUTPUT JSON SCHEMA

Return a valid JSON object with this EXACT structure:

{
  "clientCode": "string (from input)",
  "clientName": "string (from input)",
  "primaryDomains": ["array of client domains from input"],
  "industryType": "string (e.g., textile_manufacturing, packaging, education, software, healthcare)",
  "shortSummary": "string (2-3 sentences describing the business)",
  "businessModel": "B2B | B2C | B2B2C | D2C",
  
  "productLines": ["array of main product/service categories"],
  "targetCustomerSegments": ["array of target customer types"],
  "targetGeographies": ["array of target regions/countries"],
  
  "coreTopics": ["3-5 main business topics"],
  "adjacentTopics": ["related but secondary topics"],
  "negativeTopics": ["topics to avoid/exclude"],
  
  "domainTypePatterns": {
    "oemManufacturerIndicators": ["manufacturer", "supplier", "exporter", "maker", "producer", "oem", "odm"],
    "serviceProviderIndicators": ["service", "services", "solutions", "consulting", "maintenance", "support"],
    "marketplaceIndicators": ["shop", "store", "mart", "bazaar", "market", "marketplace", "directory", "portal", "platform"],
    "endCustomerIndicators": ["consumer", "retail", "home", "personal", "diy", "hobby", "domestic"],
    "educationalMediaIndicators": ["guide", "tutorial", "how to", "learn", "course", "training", "education", "blog", "article"]
  },
  
  "classificationIntentHints": {
    "transactionalKeywords": ["buy", "purchase", "price", "cost", "order", "quote", "quotation", "supplier", "dealer", "shop", "store"],
    "informationalKeywords": ["what is", "what are", "how to", "how does", "why", "guide", "tutorial", "meaning", "definition", "types of", "difference between", "vs", "versus", "comparison"],
    "directoryKeywords": ["list of", "directory", "suppliers list", "manufacturers in", "companies in", "top 10", "top 20", "best", "leading", "famous"]
  },
  
  "businessRelevanceLogicNotes": {
    "directCompetitorDefinition": "string describing what makes a domain a competitor",
    "potentialCustomerDefinition": "string describing what makes a domain a potential customer",
    "marketplaceChannelDefinition": "string describing marketplace/directory domains",
    "irrelevantDefinition": "string describing what makes a domain irrelevant"
  },
  
  "matchingDictionary": {
    "version": 2,
    
    "brandTokens": [
      {"token": "string", "scope": "CLIENT", "isHardNegative": false}
    ],
    
    "competitorBrands": [
      {"token": "string", "scope": "COMPETITOR", "isHardNegative": false}
    ],
    
    "positiveTokens": [
      {"token": "string", "scope": "CLIENT", "isHardNegative": false}
    ],
    
    "negativeTokens": [
      {"token": "string", "scope": "CLIENT", "isHardNegative": true or false}
    ],
    
    "ambiguousTokens": [
      {"token": "string", "scope": "CLIENT", "isHardNegative": false}
    ],
    
    "anchorTokens": [
      {"token": "string", "scope": "CLIENT", "isHardNegative": false}
    ],
    
    "productLineTokens": {
      "CATEGORY_NAME": ["token1", "token2"]
    }
  }
}

# VALIDATION CHECKLIST (You MUST meet these minimums)

Before returning your response, verify:

☑ brandTokens: 5-20 tokens (all variations of client name)
☑ competitorBrands: MINIMUM 30 tokens (industry competitors)
☑ positiveTokens: MINIMUM 200 tokens (cover ALL 8 categories: machinery, processes, materials, components, specs, applications, buyer intent, geography)
☑ negativeTokens: MINIMUM 100 tokens (proper isHardNegative flags set)
☑ ambiguousTokens: MINIMUM 30 tokens (context-dependent terms)
☑ anchorTokens: MINIMUM 40 tokens (context validators)
☑ productLineTokens: Maps to client's actual product lines
☑ All tokens are LOWERCASE
☑ No duplicate tokens within same array
☑ No industry-relevant terms accidentally in negativeTokens

# INDUSTRY-SPECIFIC GUIDANCE

Based on the client's industry, ensure you include domain-specific terminology:

**Manufacturing/Machinery:** Machine types, processes, materials, parts, specifications, quality standards, safety standards, automation terms, industry 4.0 terms

**Software/Technology:** Technologies, frameworks, platforms, programming terms, cloud terms, security terms, integration terms, API terms

**Education/Training:** Courses, certifications, exams, institutions, subjects, levels, boards, entrance tests, competitive exams

**Healthcare/Medical:** Treatments, procedures, equipment, specialties, conditions, medications, certifications, compliance terms

**Retail/E-commerce:** Products, categories, brands, shopping terms, payment terms, delivery terms, customer service terms

**Professional Services:** Service types, deliverables, methodologies, frameworks, compliance, certifications, engagement models

**Construction/Real Estate:** Materials, equipment, processes, certifications, property types, locations, regulations

**Food & Beverage:** Ingredients, products, processes, equipment, certifications, packaging, storage, regulations

Now generate the comprehensive profile based on the client data provided.
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
