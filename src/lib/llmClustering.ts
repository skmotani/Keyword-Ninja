import OpenAI from 'openai';
import { promises as fs } from 'fs';
import path from 'path';
import { DomainPageRecord } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DOMAIN_PAGES_FILE = path.join(DATA_DIR, 'domain_pages.json');

export type UrlItem = {
  id: string;
  url: string;
};

export type LlmCluster = {
  cluster_id: string;
  cluster_label: string;
  cluster_description: string;
  member_ids: string[];
};

export type LlmClusterResult = {
  clusters: LlmCluster[];
};

const SYSTEM_PROMPT = `You are an expert in SEO and information architecture for industrial, manufacturing, and B2B websites.

Your job is to group a set of URLs into a small number of meaningful topic clusters.

IMPORTANT RULES FOR CONSISTENCY:

1. You will be called many times with different batches from the SAME overall dataset of thousands of URLs.
2. Your clustering must be STABLE across batches:
   - Use broad, reusable categories.
   - Avoid overly specific one-off cluster names.
   - If a topic resembles a previous cluster, use the SAME style of label.

3. What you should use to infer topic:
   - Words in the URL path (slug)
   - Machine/application terms (twister, winder, texturizing, dty, carpet, suture, rope, etc.)
   - Blog/guide patterns (/blog/, /guide/, /article/)
   - Corporate paths (/about/, /contact/, /investor/, /export/, /corporate/, etc.)
   - Obvious product identifiers (/product/, /machine/, /solution/)

4. What you must NOT do:
   - Do not invent content that is not implied by the URL.
   - Do not create 1 cluster per URL unless unavoidable.
   - Do not use random or batch-specific labels — be consistent and reusable.

5. Ideal cluster types (examples):
   - "Spun & Staple Yarn Twisters"
   - "Filament / DTY / ATY Texturing Machines"
   - "Winding & Yarn Preparation Machines"
   - "Rope / Cordage & Net Machines"
   - "Carpet / BCF / Heatset Yarn"
   - "Weaving Looms"
   - "Dyeing / Printing / Finishing Machines"
   - "Spinning / Carding / Rotor & Fiber Prep"
   - "Embroidery, Sewing & Thread Products"
   - "Industrial Blog Articles / Guides"
   - "Corporate / Investor / Contact"
   - "Tooling, Gauges, Measuring Instruments"
   - "Spare Parts & Accessories"
   - "Miscellaneous Industrial Machinery"

   You may create additional labels IF they are broad and make real-world industrial/product sense.

6. Output requirements:
   - Return valid JSON ONLY.
   - Use this structure:

   {
     "clusters": [
       {
         "cluster_id": "C1",
         "cluster_label": "Spun & Staple Yarn Twisters",
         "cluster_description": "URLs related to spun yarn and staple fiber twister machines including TFO, ring, and specialty twisters.",
         "member_ids": ["12", "17", "33"]
       },
       {
         "cluster_id": "C2",
         "cluster_label": "Winding & Yarn Preparation Machines",
         "cluster_description": "Cone-to-cone winding, assembly winding, and similar yarn preparation machinery.",
         "member_ids": ["19", "25"]
       }
     ]
   }

   - Each ID must appear in EXACTLY one cluster.
   - member_ids must be strings.
   - For each batch, create between 12 and 18 clusters (medium granularity).`;

function buildUserPrompt(items: UrlItem[]): string {
  const itemsText = items
    .map((item, idx) => `${idx + 1}) ID=${item.id}\n   URL: ${item.url}`)
    .join('\n\n');

  return `We are building stable, meaningful SEO topic clusters for a large set of URLs.

Here is one batch of URLs. Each item has an ID and a URL.

TASK:
1. Group these URLs into 12–18 broad topic clusters (medium granularity).
2. Use stable, reusable cluster labels that would still make sense across future batches from the same dataset.
3. Assign every ID to exactly ONE cluster.
4. Return ONLY the JSON as specified in the system message.

Items:
${itemsText}`;
}

function repairJson(jsonStr: string): string {
  let fixed = jsonStr;
  
  // Remove any trailing commas before ] or }
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
  
  // Fix unescaped newlines in strings
  fixed = fixed.replace(/(?<!\\)\\n/g, '\\n');
  
  // Fix truncated JSON - try to close unclosed brackets
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/\]/g) || []).length;
  const openBraces = (fixed.match(/\{/g) || []).length;
  const closeBraces = (fixed.match(/\}/g) || []).length;
  
  // Add missing closing brackets
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    fixed += ']';
  }
  for (let i = 0; i < openBraces - closeBraces; i++) {
    fixed += '}';
  }
  
  // Remove incomplete last array element if JSON is truncated mid-object
  // Match pattern: {...}, { incomplete... and remove the incomplete part
  fixed = fixed.replace(/,\s*\{[^}]*$/g, '');
  
  return fixed;
}

export async function clusterUrlsWithLlm(
  items: UrlItem[],
  options?: {
    batchLabel?: string;
    maxRetries?: number;
  }
): Promise<LlmClusterResult> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const maxRetries = options?.maxRetries ?? 2;
  
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const openai = new OpenAI({ apiKey: openaiApiKey });
  
  const userPrompt = buildUserPrompt(items);

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 8000, // Increased to prevent truncation
        response_format: { type: 'json_object' }, // Force JSON output
      });

      const content = response.choices[0]?.message?.content?.trim() || '';
      
      if (!content) {
        throw new Error('Empty response from LLM');
      }
      
      // Try to extract JSON object
      let jsonStr = content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      let parsed: LlmClusterResult;
      try {
        parsed = JSON.parse(jsonStr) as LlmClusterResult;
      } catch (parseError) {
        // Try to repair the JSON
        console.log(`Attempting JSON repair for batch (attempt ${attempt + 1})...`);
        const repairedJson = repairJson(jsonStr);
        parsed = JSON.parse(repairedJson) as LlmClusterResult;
      }
      
      if (!parsed.clusters || !Array.isArray(parsed.clusters)) {
        throw new Error('Invalid LLM response structure: missing clusters array');
      }

      // Validate cluster structure
      for (const cluster of parsed.clusters) {
        if (!cluster.cluster_id || !cluster.cluster_label || !Array.isArray(cluster.member_ids)) {
          throw new Error('Invalid cluster structure in response');
        }
      }

      return parsed;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.error(`LLM clustering attempt ${attempt + 1} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  
  console.error('LLM clustering error after all retries:', lastError);
  throw lastError;
}

async function readDomainPages(): Promise<DomainPageRecord[]> {
  try {
    const data = await fs.readFile(DOMAIN_PAGES_FILE, 'utf-8');
    return JSON.parse(data) as DomainPageRecord[];
  } catch {
    return [];
  }
}

async function writeDomainPages(records: DomainPageRecord[]): Promise<void> {
  await fs.writeFile(DOMAIN_PAGES_FILE, JSON.stringify(records, null, 2), 'utf-8');
}

export interface LlmClusteringOptions {
  clientCode?: string;
  locationCode?: string;
  maxUrls?: number;
  batchSize?: number;
  runLabel?: string;
}

export interface LlmClusteringResult {
  success: boolean;
  totalProcessed: number;
  totalBatches: number;
  clustersCreated: number;
  sampleLabels: string[];
  errors: string[];
}

export async function runLlmClusteringForDomainPages(
  options: LlmClusteringOptions = {}
): Promise<LlmClusteringResult> {
  const {
    clientCode,
    locationCode,
    maxUrls,
    batchSize = 80,
    runLabel = new Date().toISOString().split('T')[0] + '-run1',
  } = options;

  const result: LlmClusteringResult = {
    success: false,
    totalProcessed: 0,
    totalBatches: 0,
    clustersCreated: 0,
    sampleLabels: [],
    errors: [],
  };

  try {
    const allRecords = await readDomainPages();
    
    let targetRecords = allRecords.filter(r => {
      if (clientCode && r.clientCode !== clientCode) return false;
      if (locationCode && r.locationCode !== locationCode) return false;
      return true;
    });

    if (maxUrls && maxUrls > 0) {
      targetRecords = targetRecords.slice(0, maxUrls);
    }

    if (targetRecords.length === 0) {
      result.success = true;
      return result;
    }

    const recordMap = new Map(allRecords.map(r => [r.id, r]));
    const allLabels = new Set<string>();

    for (let i = 0; i < targetRecords.length; i += batchSize) {
      const batch = targetRecords.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const batchLabel = `B${batchNum}`;

      console.log(`Processing batch ${batchNum} with ${batch.length} URLs...`);

      const items: UrlItem[] = batch.map(r => ({
        id: r.id,
        url: r.pageURL,
      }));

      try {
        const clusterResult = await clusterUrlsWithLlm(items, { batchLabel });

        for (const cluster of clusterResult.clusters) {
          allLabels.add(cluster.cluster_label);
          result.clustersCreated++;

          for (const memberId of cluster.member_ids) {
            const record = recordMap.get(memberId);
            if (record) {
              record.llmClusterId = `${runLabel}-${cluster.cluster_id}`;
              record.llmClusterLabel = cluster.cluster_label;
              record.llmClusterDescription = cluster.cluster_description;
              record.llmClusterBatchId = batchLabel;
              record.llmClusterRunId = runLabel;
            }
          }
        }

        result.totalBatches++;
        result.totalProcessed += batch.length;
      } catch (error) {
        const errorMsg = `Batch ${batchNum} failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
      }
    }

    await writeDomainPages(Array.from(recordMap.values()));

    result.sampleLabels = Array.from(allLabels).slice(0, 10);
    result.success = result.errors.length === 0;

    console.log(`LLM Clustering complete: ${result.totalProcessed} URLs, ${result.totalBatches} batches, ${result.clustersCreated} clusters`);

    return result;
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return result;
  }
}
