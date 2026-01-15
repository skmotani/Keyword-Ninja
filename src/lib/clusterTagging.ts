import OpenAI from 'openai';

export type ClusterSourceType = 'RULE' | 'AI';

export interface ClusterExplanation {
  source: ClusterSourceType;
  rulesApplied?: string[];
  reasoning: string;
  urlPath: string;
  pathSegments: string[];
  genericSegmentsRemoved: string[];
  selectedSegment?: string;
  aiPromptSnippet?: string;
  aiResponseSnippet?: string;
}

export interface ClusterTagResult {
  cluster: string;
  clusterSource: ClusterSourceType;
  clusterExplanation: ClusterExplanation;
}

export interface DomainTopPageRow {
  domain: string;
  pageUrl: string;
  pageType?: string | null;
  estTrafficEtv?: number | null;
  keywordsCount?: number | null;
  pageTitle?: string | null;
  topKeyword?: string | null;
}

const GENERIC_SEGMENTS = [
  '',
  'en', 'de', 'fr', 'in', 'us', 'uk', 'es', 'pt', 'it', 'nl', 'pl', 'ru', 'ja', 'zh', 'ko',
  'products', 'product', 'services', 'service',
  'solutions', 'solution', 'catalog', 'catalogue',
  'blog', 'news', 'article', 'articles', 'insights', 'posts', 'post',
  'category', 'categories', 'archive', 'archives', 'tag', 'tags',
  'info', 'page', 'pages', 'home', 'index',
  'shop', 'store', 'buy', 'order',
  'resources', 'resource', 'docs', 'documentation',
  'about', 'contact', 'support', 'help', 'faq',
  'gallery', 'media', 'images', 'videos',
  'collections', 'collection',
];

const UTILITY_PAGE_TYPES = ['ACCOUNT_AUTH', 'CAREERS_HR', 'LEGAL_POLICY', 'SUPPORT_CONTACT'];

const CONTENT_PREFIXES_TO_TRIM = [
  'what-is-',
  'how-to-',
  'types-of-',
  'best-',
  'top-',
  'guide-to-',
  'introduction-to-',
  'understanding-',
];

function extractPathFromUrl(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.pathname;
  } catch {
    const match = url.match(/^(?:https?:\/\/)?(?:[^\/]+)(\/.*)?$/);
    return match?.[1] || '/';
  }
}

function normalizeToKebabCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function isNumericOrMeaningless(segment: string): boolean {
  const normalized = segment.replace(/-/g, '');
  if (/^\d+$/.test(normalized)) return true;
  if (normalized.length <= 2) return true;
  if (/^[a-f0-9]{8,}$/i.test(normalized)) return true;
  return false;
}

function trimContentPrefixes(segment: string): string {
  let result = segment.toLowerCase();
  for (const prefix of CONTENT_PREFIXES_TO_TRIM) {
    if (result.startsWith(prefix)) {
      result = result.slice(prefix.length);
      break;
    }
  }
  return result;
}

export function tagPageClusterSync(row: DomainTopPageRow): ClusterTagResult | null {
  const path = extractPathFromUrl(row.pageUrl);
  const segments = path.split('/');
  
  const explanation: ClusterExplanation = {
    source: 'RULE',
    rulesApplied: [],
    reasoning: '',
    urlPath: path,
    pathSegments: [...segments],
    genericSegmentsRemoved: [],
  };

  if (path === '/' || path === '' || segments.filter(s => s).length === 0) {
    return {
      cluster: '__home__',
      clusterSource: 'RULE',
      clusterExplanation: {
        ...explanation,
        rulesApplied: ['HOMEPAGE_DETECTION'],
        reasoning: 'Clustered as __home__ because URL path is empty/root (homepage).',
      },
    };
  }

  if (row.pageType === 'COMPANY_ABOUT') {
    const nonGenericSegments = segments.filter(
      s => s && !GENERIC_SEGMENTS.includes(s.toLowerCase())
    );
    if (nonGenericSegments.length === 0 || 
        nonGenericSegments.every(s => ['about', 'about-us', 'company', 'who-we-are'].includes(s.toLowerCase()))) {
      return {
        cluster: '__brand_corporate__',
        clusterSource: 'RULE',
        clusterExplanation: {
          ...explanation,
          rulesApplied: ['BRAND_CORPORATE_PAGE'],
          reasoning: 'Clustered as __brand_corporate__ because page type is COMPANY_ABOUT with no specific topic segment.',
        },
      };
    }
  }

  if (row.pageType && UTILITY_PAGE_TYPES.includes(row.pageType)) {
    return {
      cluster: '__utility__',
      clusterSource: 'RULE',
      clusterExplanation: {
        ...explanation,
        rulesApplied: ['UTILITY_PAGE_TYPE'],
        reasoning: `Clustered as __utility__ because page type is ${row.pageType} (utility page).`,
      },
    };
  }

  const filteredSegments: string[] = [];
  const removedSegments: string[] = [];

  for (const segment of segments) {
    const lower = segment.toLowerCase();
    if (GENERIC_SEGMENTS.includes(lower)) {
      if (segment) removedSegments.push(segment);
    } else if (segment) {
      filteredSegments.push(segment);
    }
  }

  explanation.genericSegmentsRemoved = removedSegments;

  for (const segment of filteredSegments) {
    if (!isNumericOrMeaningless(segment)) {
      const trimmed = trimContentPrefixes(segment);
      const clusterName = normalizeToKebabCase(trimmed);
      
      if (clusterName.length >= 3) {
        return {
          cluster: clusterName,
          clusterSource: 'RULE',
          clusterExplanation: {
            ...explanation,
            source: 'RULE',
            rulesApplied: ['PATH_SEGMENT_CLUSTERING'],
            reasoning: 'Cluster derived from the first meaningful URL path segment after removing generic segments.',
            selectedSegment: segment,
          },
        };
      }
    }
  }

  return null;
}

export async function tagPageClusterWithAI(
  row: DomainTopPageRow,
  openaiApiKey?: string
): Promise<ClusterTagResult> {
  const ruleResult = tagPageClusterSync(row);
  if (ruleResult) {
    return ruleResult;
  }

  const path = extractPathFromUrl(row.pageUrl);
  const segments = path.split('/');

  const explanation: ClusterExplanation = {
    source: 'AI',
    reasoning: '',
    urlPath: path,
    pathSegments: [...segments],
    genericSegmentsRemoved: [],
  };

  if (!openaiApiKey) {
    return {
      cluster: '__unclassified__',
      clusterSource: 'RULE',
      clusterExplanation: {
        ...explanation,
        source: 'RULE',
        rulesApplied: ['NO_AI_KEY_FALLBACK'],
        reasoning: 'Could not determine cluster from URL and no AI API key available. Marked as unclassified.',
      },
    };
  }

  try {
    const openai = new OpenAI({ apiKey: openaiApiKey });

    const systemMessage = `You are a clustering helper. Given a page URL (and optionally title/keywords), your job is to generate a short, URL-like cluster key that represents the main topic of the page.
The cluster key must be:
- in lower-case
- words separated by hyphens (kebab-case)
- based on meaningful nouns from the URL path or page title (e.g. yarn-winder, two-for-one-twister, rope-making-machines).
Do not use brand names, company names, dates, or generic terms like "products" or "services".
Return ONLY a JSON object with a single field "cluster".`;

    const userMessage = JSON.stringify({
      url: row.pageUrl,
      pageTitle: row.pageTitle || null,
      topKeyword: row.topKeyword || null,
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 100,
    });

    const content = response.choices[0]?.message?.content?.trim() || '';
    
    let cluster = '__ai_unclassified__';
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.cluster && typeof parsed.cluster === 'string') {
          cluster = normalizeToKebabCase(parsed.cluster);
        }
      }
    } catch {
      const wordMatch = content.match(/[a-z][a-z0-9-]+/i);
      if (wordMatch) {
        cluster = normalizeToKebabCase(wordMatch[0]);
      }
    }

    return {
      cluster,
      clusterSource: 'AI',
      clusterExplanation: {
        source: 'AI',
        reasoning: 'Cluster generated using AI from page title/URL/keyword as a URL-like topic key.',
        urlPath: path,
        pathSegments: segments,
        genericSegmentsRemoved: [],
        aiPromptSnippet: userMessage.substring(0, 200),
        aiResponseSnippet: content.substring(0, 200),
      },
    };
  } catch (error) {
    return {
      cluster: '__ai_error__',
      clusterSource: 'AI',
      clusterExplanation: {
        source: 'AI',
        reasoning: `AI classification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        urlPath: path,
        pathSegments: segments,
        genericSegmentsRemoved: [],
      },
    };
  }
}

export async function tagPageCluster(
  row: DomainTopPageRow,
  openaiApiKey?: string
): Promise<ClusterTagResult> {
  return tagPageClusterWithAI(row, openaiApiKey);
}

export interface ClusterSummaryNew {
  clusterName: string;
  clusterEtv: number;
  clusterPageCount: number;
  clusterAiTaggedCount: number;
  clusterRuleTaggedCount: number;
  avgEtv: number;
  domains: string[];
  samplePages: Array<{
    pageUrl: string;
    estTrafficEtv: number | null;
    clusterSource: ClusterSourceType | null;
  }>;
}

export interface PageWithCluster {
  cluster: string | null;
  clusterSource: ClusterSourceType | null;
  estTrafficETV: number | null;
  domain: string;
  pageURL: string;
  pageType?: string | null;
  pageIntent?: string | null;
  priorityTier?: string | null;
}

export function aggregateClusterStatsNew(pages: PageWithCluster[]): ClusterSummaryNew[] {
  const clusterMap = new Map<string, {
    totalEtv: number;
    pageCount: number;
    aiCount: number;
    ruleCount: number;
    domains: Set<string>;
    samplePages: Array<{
      pageUrl: string;
      estTrafficEtv: number | null;
      clusterSource: ClusterSourceType | null;
    }>;
  }>();

  for (const page of pages) {
    const clusterName = page.cluster || '__untagged__';
    
    if (!clusterMap.has(clusterName)) {
      clusterMap.set(clusterName, {
        totalEtv: 0,
        pageCount: 0,
        aiCount: 0,
        ruleCount: 0,
        domains: new Set(),
        samplePages: [],
      });
    }

    const cluster = clusterMap.get(clusterName)!;
    cluster.totalEtv += page.estTrafficETV || 0;
    cluster.pageCount++;
    
    if (page.clusterSource === 'AI') {
      cluster.aiCount++;
    } else if (page.clusterSource === 'RULE') {
      cluster.ruleCount++;
    }
    
    cluster.domains.add(page.domain);
    
    if (cluster.samplePages.length < 5) {
      cluster.samplePages.push({
        pageUrl: page.pageURL,
        estTrafficEtv: page.estTrafficETV,
        clusterSource: page.clusterSource,
      });
    }
  }

  const summaries: ClusterSummaryNew[] = [];
  
  const clusterEntries = Array.from(clusterMap.entries());
  for (let i = 0; i < clusterEntries.length; i++) {
    const [clusterName, data] = clusterEntries[i];
    summaries.push({
      clusterName,
      clusterEtv: Math.round(data.totalEtv),
      clusterPageCount: data.pageCount,
      clusterAiTaggedCount: data.aiCount,
      clusterRuleTaggedCount: data.ruleCount,
      avgEtv: data.pageCount > 0 ? Math.round(data.totalEtv / data.pageCount) : 0,
      domains: Array.from(data.domains),
      samplePages: data.samplePages,
    });
  }

  return summaries.sort((a, b) => b.clusterEtv - a.clusterEtv);
}

export function matchClusterToProducts(
  clusterName: string,
  productLines: string[]
): { matched: boolean; matchedProduct: string | null } {
  if (clusterName.startsWith('__')) {
    return { matched: false, matchedProduct: null };
  }

  const normalizedCluster = clusterName.toLowerCase().replace(/-/g, ' ');
  
  for (const product of productLines) {
    const normalizedProduct = product.toLowerCase().replace(/-/g, ' ');
    
    if (normalizedCluster.includes(normalizedProduct) || 
        normalizedProduct.includes(normalizedCluster)) {
      return { matched: true, matchedProduct: product };
    }
    
    const clusterWords = normalizedCluster.split(' ').filter(w => w.length > 3);
    const productWords = normalizedProduct.split(' ').filter(w => w.length > 3);
    
    const matchingWords = clusterWords.filter(cw => 
      productWords.some(pw => cw.includes(pw) || pw.includes(cw))
    );
    
    if (matchingWords.length >= 1 && matchingWords.length >= clusterWords.length * 0.5) {
      return { matched: true, matchedProduct: product };
    }
  }

  return { matched: false, matchedProduct: null };
}
