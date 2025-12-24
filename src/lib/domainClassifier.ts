import OpenAI from 'openai';
import {
  ClientAIProfile,
  DomainClassification,
  DomainTypeValue,
  PageIntentValue,
  ProductMatchBucket,
  BusinessRelevanceCategoryValue
} from '@/types';

// the newest OpenAI model is "gpt-5" which was released August 7, 2025
const MODEL = 'gpt-5';

interface UniqueDomainRow {
  domain: string;
  label: string;
  importance: number;
  keywords: number;
  appearances: number;
}

interface DomainSerpRow {
  keyword: string;
  country: string;
  searchVolume: number | null;
  position: number;
  url: string;
  pageTitle: string;
  pageSnippet: string;
}

interface ClassifierResponse {
  domain: string;
  domainType: DomainTypeValue;
  pageIntent: PageIntentValue;
  productMatchScoreValue: number;
  productMatchScoreBucket: ProductMatchBucket;
  businessRelevanceCategory: BusinessRelevanceCategoryValue;
  explanationLink: string;
  explanationSummary: string;
}

/**
 * Summarizes SERP data to reduce token usage when sending to OpenAI.
 * - Limits to top 10 rows sorted by position (rank)
 * - Truncates pageSnippet to max 200 characters
 * - Keeps only essential fields for classification
 */
function summarizeSerpData(serpRows: DomainSerpRow[]): DomainSerpRow[] {
  if (!serpRows || serpRows.length === 0) {
    return [];
  }

  // Sort by position (rank) ascending - lower position = higher rank
  const sorted = [...serpRows].sort((a, b) => a.position - b.position);

  // Take top 10 rows
  const limited = sorted.slice(0, 10);

  // Truncate snippets and return optimized rows
  return limited.map(row => ({
    ...row,
    pageSnippet: row.pageSnippet?.substring(0, 200) || '',
    pageTitle: row.pageTitle?.substring(0, 150) || ''
  }));
}

const SYSTEM_PROMPT = `You are an AI classifier inside an SEO Intelligence application.

The goal of this tool is to enrich the **Unique Domains** table for a given client with
classification columns that work for ANY industry.

----------------------------------------
INPUTS
----------------------------------------

You receive three JSON inputs:

1) CLIENT_PROFILE_JSON
   - This is the AI Client Profile for the currently selected client from the Client Master.
   - It includes (names may vary but the meaning is as follows):
     - businessOverview / industryType
     - productLines                // what this client sells or provides
     - targetCustomers             // who they serve
     - targetGeographies
     - topicClusters:
         - coreTopics
         - adjacentTopics
         - negativeTopics
     - domainTypePatterns:
         - oemManufacturerIndicators
         - serviceProviderIndicators
         - marketplaceIndicators
         - endCustomerIndicators
         - educationalMediaIndicators
     - classificationIntentHints:
         - transactionalKeywords
         - informationalKeywords
         - directoryKeywords

   This profile can describe ANY domain:
   - B2B OEM (e.g. textile machinery),
   - educational platform,
   - SaaS,
   - healthcare,
   - consumer product, etc.
   You MUST NOT hard-code any specific industry. Always infer relevance
   from THIS profile only.

2) UNIQUE_DOMAIN_ROW
   - One row from the Unique Domains table for this client, with fields:
     - domain          // root domain, e.g. "saurer.com"
     - label           // short text label already generated (may or may not help)
     - importance      // numeric Domain Importance Score (already calculated)
     - keywords        // number of unique keywords where this domain appears
     - appearances     // number of SERP rows where this domain appears

   These columns MUST NOT be changed; they are read-only context.
   We only ADD new classification columns.

3) DOMAIN_SERP_ROWS
   - Array of SERP rows for this domain from the SERP Results table.
   - Each item may contain:
     - keyword
     - country
     - searchVolume
     - position       // rank in SERP
     - url
     - pageTitle
     - pageSnippet

   Use these to understand what kind of pages this domain ranks with.

----------------------------------------
OUTPUT COLUMNS TO GENERATE (NEW)
----------------------------------------

You must generate values for the following NEW columns on the Unique Domains page:

1) domainType
   - How this domain behaves in the ecosystem.
   - Allowed values:
     - "OEM / Manufacturer / Product Provider"
     - "Service Provider / Agency / Integrator"
     - "Marketplace / Directory / Portal"
     - "End Customer / Buyer Organization"
     - "Educational / Media / Research"
     - "Brand / Platform / Corporate Site"
     - "Irrelevant Industry"
     - "Unknown"

2) pageIntent
   - Typical intent of pages where this domain appears in SERP.
   - Allowed values:
     - "Transactional"
     - "Commercial Investigation"
     - "Informational"
     - "Directory / Listing"
     - "Navigational / Brand"
     - "Irrelevant Intent"
     - "Unknown"

3) productMatchScoreValue
   - Numeric 0.00–1.00 representing how well this domain's content
     matches the client's productLines and coreTopics.
   - Guidance:
     - 0.80–1.00 → High match (very close to client offering)
     - 0.40–0.79 → Medium match (adjacent or related)
     - 0.01–0.39 → Low match (weak or partial relation)
     - 0.00      → No match (fits negativeTopics or unrelated industry)

4) productMatchScoreBucket
   - Bucketed version of productMatchScoreValue.
   - Allowed values:
     - "High"
     - "Medium"
     - "Low"
     - "None"

5) businessRelevanceCategory
   - Final classification of this domain for this client.
   - Allowed values:
     - "Direct Competitor"
     - "Adjacent / Weak Competitor"
     - "Potential Customer / Lead"
     - "Marketplace / Channel"
     - "Service Provider / Partner"
     - "Educational / Content Only"
     - "Brand / Navigational Only"
     - "Irrelevant"
     - "Needs Manual Review"

6) explanationLink
   - Always set to:
     "#how-this-score-was-calculated"

7) explanationSummary
   - Short 2–4 sentence explanation (human-readable) of **why** you chose:
     domainType, pageIntent, productMatchScoreValue/Bucket, and
     businessRelevanceCategory for this domain.

----------------------------------------
CLASSIFICATION LOGIC
----------------------------------------

A. Decide domainType:

Use CLIENT_PROFILE_JSON.domainTypePatterns along with:
- businessOverview / industryType
- productLines, targetCustomers
- DOMAIN_SERP_ROWS pageTitle + pageSnippet

Rules (generic, adapt using the profile):

- If the domain appears to OFFER products or services similar to client.productLines
  or solving the same core problems, based on indicators and SERP content:
    → domainType = "OEM / Manufacturer / Product Provider"
      or "Brand / Platform / Corporate Site" if it is clearly a main brand/platform site.

- If indicators suggest consultants, agencies, integrators, installers, service
  firms, maintenance providers, etc.:
    → domainType = "Service Provider / Agency / Integrator".

- If indicators or known marketplace brands suggest procurement portals,
  B2B directories, listing sites:
    → domainType = "Marketplace / Directory / Portal".

- If indicators match organizations that look like buyers/users as described
  in targetCustomers (mills, schools, hospitals, factories, students, etc.):
    → domainType = "End Customer / Buyer Organization".

- If indicators and content show news, articles, academic material,
  research, blogs, knowledge bases:
    → domainType = "Educational / Media / Research".

- If the site is mainly a corporate identity for a broader brand or
  platform (e.g., holding company, generic brand site) and not clearly a
  competitor or customer:
    → domainType = "Brand / Platform / Corporate Site".

- If the content clearly belongs to a sector described in negativeTopics or
  an unrelated industry:
    → domainType = "Irrelevant Industry".

- If you cannot reliably decide:
    → domainType = "Unknown".

B. Determine pageIntent:

Use classificationIntentHints and inspect pageTitle, pageSnippet, url.

- If pages contain strong cues of selling or generating enquiries:
    words like those in transactionalKeywords, plus "price", "buy", "quotation",
    "RFQ", "demo", "enquire", "sign up", "request a quote":
      → pageIntent = "Transactional".

- If pages compare providers, contain "top 10", "best X", "reviews",
  "vs", "compare", or similar:
      → pageIntent = "Commercial Investigation".

- If pages explain concepts, how something works, guides, methods, tutorials,
  documentation, research, etc., using informationalKeywords:
      → pageIntent = "Informational".

- If pages list many providers or entities in a category directory, B2B portal,
  trade listing, etc., using directoryKeywords:
      → pageIntent = "Directory / Listing".

- If the most representative URLs are home pages, brand profiles, logins, or
  obvious navigational targets when searching the brand:
      → pageIntent = "Navigational / Brand".

- If the main intent is clearly about topics in negativeTopics or a completely
  unrelated user goal:
      → pageIntent = "Irrelevant Intent".

- If still unclear:
      → pageIntent = "Unknown".

C. Compute productMatchScoreValue and productMatchScoreBucket:

Compare:
- client.productLines + topicClusters.coreTopics
- topicClusters.adjacentTopics
- topicClusters.negativeTopics
- DOMAIN_SERP_ROWS pageTitle + pageSnippet + keywords

Rules:
- Start at 0.
- Move toward 1.0 if the domain's content frequently mentions or
  aligns with productLines and coreTopics for this client.
- If most overlap is with adjacentTopics (same ecosystem but not
  identical offering), keep in 0.40–0.79 band.
- If there is only light or indirect relation, keep in 0.01–0.39.
- If the content primarily fits negativeTopics or a totally different space,
  force score to 0.00.

Then convert to bucket:
- 0.80–1.00 → "High"
- 0.40–0.79 → "Medium"
- 0.01–0.39 → "Low"
- 0.00      → "None"

D. Decide businessRelevanceCategory using domainType + pageIntent + productMatchScoreBucket:

- Direct Competitor:
    IF domainType is "OEM / Manufacturer / Product Provider"
       OR (domainType = "Brand / Platform / Corporate Site" AND they clearly
           sell an overlapping core offering),
       AND pageIntent is "Transactional" or "Commercial Investigation",
       AND productMatchScoreBucket = "High".

- Adjacent / Weak Competitor:
    IF domainType indicates a provider (OEM, Product Provider, Brand/Platform),
       AND productMatchScoreBucket = "Medium",
       AND pageIntent is NOT "Irrelevant Intent".

- Potential Customer / Lead:
    IF domainType = "End Customer / Buyer Organization",
       AND productMatchScoreBucket in {"High","Medium"},
       AND pageIntent is NOT "Irrelevant Intent".

- Marketplace / Channel:
    IF domainType = "Marketplace / Directory / Portal",
       AND pageIntent in {"Directory / Listing","Transactional"},
       AND productMatchScoreBucket in {"High","Medium"}.

- Service Provider / Partner:
    IF domainType = "Service Provider / Agency / Integrator",
       AND productMatchScoreBucket in {"High","Medium"}.

- Educational / Content Only:
    IF domainType = "Educational / Media / Research"
       OR pageIntent = "Informational",
       AND productMatchScoreBucket in {"High","Medium"},
       AND the domain is not clearly a direct competitor.

- Brand / Navigational Only:
    IF pageIntent = "Navigational / Brand"
       AND productMatchScoreBucket in {"Low","None"}
       AND domainType is NOT clearly a key competitor or key customer.

- Irrelevant:
    IF productMatchScoreBucket = "None"
       OR pageIntent = "Irrelevant Intent"
       OR domainType = "Irrelevant Industry".

- Needs Manual Review:
    IF none of the above confidently apply,
       BUT productMatchScoreBucket is NOT "None"
       OR importance (from UNIQUE_DOMAIN_ROW) is very high.

----------------------------------------
OUTPUT FORMAT
----------------------------------------

Return a SINGLE JSON object:

{
  "domain": "<copy from UNIQUE_DOMAIN_ROW.domain>",
  "domainType": "<one allowed domainType value>",
  "pageIntent": "<one allowed pageIntent value>",
  "productMatchScoreValue": <0.00-1.00>,
  "productMatchScoreBucket": "High" | "Medium" | "Low" | "None",
  "businessRelevanceCategory": "<one allowed businessRelevanceCategory value>",
  "explanationLink": "#how-this-score-was-calculated",
  "explanationSummary": "2–4 sentences explaining why this domainType, pageIntent, product match, and business relevance were chosen, referencing the client profile and the typical SERP pages for this domain."
}`;

import { getActiveCredentialByService } from '@/lib/apiCredentialsStore';

export async function classifyDomain(
  clientProfile: ClientAIProfile,
  domainRow: UniqueDomainRow,
  serpRows: DomainSerpRow[]
): Promise<DomainClassification> {
  const credential = await getActiveCredentialByService('OPENAI', clientProfile.clientCode);
  const apiKey = credential?.apiKey || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured in Settings or Environment Variables');
  }

  const openai = new OpenAI({ apiKey });

  // Optimize SERP data to reduce token usage
  const optimizedSerpRows = summarizeSerpData(serpRows);

  console.log(`[DomainClassifier] SERP data optimized: ${serpRows.length} rows -> ${optimizedSerpRows.length} rows for ${domainRow.domain}`);

  const userPrompt = `Here are the three JSON inputs for classification:

1) CLIENT_PROFILE_JSON:
${JSON.stringify(clientProfile, null, 2)}

2) UNIQUE_DOMAIN_ROW:
${JSON.stringify(domainRow, null, 2)}

3) DOMAIN_SERP_ROWS:
${JSON.stringify(optimizedSerpRows, null, 2)}

Based on the classification logic, generate the classification output for this domain.`;

  console.log('[DomainClassifier] Classifying domain:', domainRow.domain);

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 2048,
    });

    const textContent = response.choices[0]?.message?.content;

    if (!textContent) {
      throw new Error('No content in OpenAI response');
    }

    console.log('[DomainClassifier] Response received for:', domainRow.domain);

    let parsedResponse: ClassifierResponse;
    try {
      parsedResponse = JSON.parse(textContent);
    } catch (e) {
      console.error('[DomainClassifier] Failed to parse response:', textContent);
      throw new Error('Failed to parse OpenAI response as JSON');
    }

    const classification: DomainClassification = {
      id: `class-${clientProfile.clientCode}-${domainRow.domain.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`,
      clientCode: clientProfile.clientCode,
      domain: domainRow.domain,
      domainType: parsedResponse.domainType || 'Unknown',
      pageIntent: parsedResponse.pageIntent || 'Unknown',
      productMatchScoreValue: Math.max(0, Math.min(1, parsedResponse.productMatchScoreValue || 0)),
      productMatchScoreBucket: parsedResponse.productMatchScoreBucket || 'None',
      businessRelevanceCategory: parsedResponse.businessRelevanceCategory || 'Needs Manual Review',
      explanationLink: '#how-this-score-was-calculated',
      explanationSummary: parsedResponse.explanationSummary || 'Classification completed.',
      classifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log('[DomainClassifier] Classification complete for:', domainRow.domain);

    return classification;
  } catch (error: any) {
    console.error('[DomainClassifier] API Error:', error.message);

    if (error.status === 401) {
      throw new Error('Invalid OpenAI API key');
    }

    if (error.status === 429) {
      throw new Error('OpenAI API rate limit exceeded. Please wait and try again.');
    }

    throw error;
  }
}

export async function classifyDomains(
  clientProfile: ClientAIProfile,
  domainRows: UniqueDomainRow[],
  serpRowsByDomain: Record<string, DomainSerpRow[]>,
  onProgress?: (completed: number, total: number, domain: string) => void
): Promise<DomainClassification[]> {
  const results: DomainClassification[] = [];

  for (let i = 0; i < domainRows.length; i++) {
    const domainRow = domainRows[i];
    const serpRows = serpRowsByDomain[domainRow.domain.toLowerCase()] || [];

    try {
      const classification = await classifyDomain(clientProfile, domainRow, serpRows);
      results.push(classification);

      if (onProgress) {
        onProgress(i + 1, domainRows.length, domainRow.domain);
      }
    } catch (error) {
      console.error(`[DomainClassifier] Failed to classify ${domainRow.domain}:`, error);
      throw error;
    }
  }

  return results;
}
