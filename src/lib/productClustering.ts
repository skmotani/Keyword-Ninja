import { ClientAIProfile, DomainPageRecord } from '@/types';

export interface ProductClusterMapping {
  product: string;
  cluster: string;
  keywords: string[];
}

export interface ProductClassificationResult {
  matchedProduct: string | null;
  clusterName: string | null;
  matchedKeywords: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
}

export interface BatchProductClassificationResult {
  pageId: string;
  result: ProductClassificationResult;
}

export function extractProductsFromProfile(profile: ClientAIProfile): string[] {
  const products: Set<string> = new Set();
  
  if (profile.productLines && Array.isArray(profile.productLines)) {
    profile.productLines.forEach(p => products.add(p.toLowerCase().trim()));
  }
  
  if (profile.coreIdentity?.productLines && Array.isArray(profile.coreIdentity.productLines)) {
    profile.coreIdentity.productLines.forEach(p => products.add(p.toLowerCase().trim()));
  }
  
  if (profile.coreIdentity?.services && Array.isArray(profile.coreIdentity.services)) {
    profile.coreIdentity.services.forEach(s => products.add(s.toLowerCase().trim()));
  }
  
  return Array.from(products).filter(p => p.length > 0);
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractKeywordsFromProduct(product: string): string[] {
  const normalized = normalizeText(product);
  const words = normalized.split(' ').filter(w => w.length > 2);
  
  const keywords: string[] = [normalized];
  
  words.forEach(word => {
    if (word.length > 3) {
      keywords.push(word);
    }
  });
  
  const withoutCommonSuffixes = normalized
    .replace(/\s+(machine|machines|equipment|system|systems|service|services|solution|solutions)$/i, '')
    .trim();
  if (withoutCommonSuffixes.length > 2 && withoutCommonSuffixes !== normalized) {
    keywords.push(withoutCommonSuffixes);
  }
  
  return Array.from(new Set(keywords));
}

export function inferClusterFromProduct(product: string): string {
  const normalized = normalizeText(product);
  
  const clusterPatterns: { pattern: RegExp; cluster: string }[] = [
    { pattern: /twist(ing|er)?/i, cluster: 'Twisting Cluster' },
    { pattern: /wind(ing|er)?/i, cluster: 'Winding Cluster' },
    { pattern: /heat\s*set(ting)?/i, cluster: 'Heat Setting Cluster' },
    { pattern: /cotton/i, cluster: 'Cotton Processing Cluster' },
    { pattern: /filament/i, cluster: 'Filament Processing Cluster' },
    { pattern: /yarn/i, cluster: 'Yarn Processing Cluster' },
    { pattern: /coach(ing)?|class(es)?|cours(e|es)?|tuition/i, cluster: 'Coaching & Courses Cluster' },
    { pattern: /test\s*series|mock\s*test/i, cluster: 'Test Preparation Cluster' },
    { pattern: /notes?|pdf|study\s*material/i, cluster: 'Study Materials Cluster' },
    { pattern: /mentor(ship)?|doubt|guidance/i, cluster: 'Mentorship Cluster' },
    { pattern: /exam|eligibility|dates?|schedule/i, cluster: 'Exam Updates Cluster' },
    { pattern: /olympiad/i, cluster: 'Olympiad Cluster' },
    { pattern: /jee|iit/i, cluster: 'JEE Preparation Cluster' },
    { pattern: /neet/i, cluster: 'NEET Preparation Cluster' },
    { pattern: /chemistry/i, cluster: 'Chemistry Cluster' },
    { pattern: /cbse|board/i, cluster: 'Board Exams Cluster' },
  ];
  
  for (const { pattern, cluster } of clusterPatterns) {
    if (pattern.test(normalized)) {
      return cluster;
    }
  }
  
  const words = normalized.split(' ');
  if (words.length > 0) {
    const firstWord = words[0];
    return `${firstWord.charAt(0).toUpperCase() + firstWord.slice(1)} Cluster`;
  }
  
  return 'General Cluster';
}

export function buildClusterMapping(products: string[]): ProductClusterMapping[] {
  return products.map(product => ({
    product,
    cluster: inferClusterFromProduct(product),
    keywords: extractKeywordsFromProduct(product),
  }));
}

export function classifyPageProduct(
  pageURL: string,
  clusterMappings: ProductClusterMapping[]
): ProductClassificationResult {
  const urlLower = normalizeText(pageURL);
  
  let bestMatch: {
    product: string;
    cluster: string;
    matchedKeywords: string[];
    score: number;
  } | null = null;
  
  for (const mapping of clusterMappings) {
    const matchedKeywords: string[] = [];
    let score = 0;
    
    for (const keyword of mapping.keywords) {
      if (urlLower.includes(keyword)) {
        matchedKeywords.push(keyword);
        score += keyword.length;
        
        if (keyword === mapping.product) {
          score += 10;
        }
      }
    }
    
    if (matchedKeywords.length > 0) {
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          product: mapping.product,
          cluster: mapping.cluster,
          matchedKeywords,
          score,
        };
      }
    }
  }
  
  if (!bestMatch) {
    return {
      matchedProduct: null,
      clusterName: null,
      matchedKeywords: [],
      confidence: 'NONE',
    };
  }
  
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  if (bestMatch.matchedKeywords.length >= 2 || bestMatch.score >= 15) {
    confidence = 'HIGH';
  } else if (bestMatch.matchedKeywords.some(k => k.length >= 6)) {
    confidence = 'MEDIUM';
  }
  
  return {
    matchedProduct: bestMatch.product,
    clusterName: bestMatch.cluster,
    matchedKeywords: bestMatch.matchedKeywords,
    confidence,
  };
}

export function classifyPagesBatch(
  pages: DomainPageRecord[],
  profile: ClientAIProfile
): BatchProductClassificationResult[] {
  const products = extractProductsFromProfile(profile);
  const clusterMappings = buildClusterMapping(products);
  
  return pages.map(page => ({
    pageId: page.id,
    result: classifyPageProduct(page.pageURL, clusterMappings),
  }));
}

export function getClusterBadgeColor(clusterName: string | null | undefined): string {
  if (!clusterName) return 'bg-gray-100 text-gray-600';
  
  const clusterColors: Record<string, string> = {
    'Twisting Cluster': 'bg-purple-100 text-purple-800',
    'Winding Cluster': 'bg-blue-100 text-blue-800',
    'Heat Setting Cluster': 'bg-orange-100 text-orange-800',
    'Cotton Processing Cluster': 'bg-green-100 text-green-800',
    'Filament Processing Cluster': 'bg-cyan-100 text-cyan-800',
    'Yarn Processing Cluster': 'bg-teal-100 text-teal-800',
    'Coaching & Courses Cluster': 'bg-indigo-100 text-indigo-800',
    'Test Preparation Cluster': 'bg-violet-100 text-violet-800',
    'Study Materials Cluster': 'bg-amber-100 text-amber-800',
    'Mentorship Cluster': 'bg-rose-100 text-rose-800',
    'Exam Updates Cluster': 'bg-sky-100 text-sky-800',
    'Olympiad Cluster': 'bg-fuchsia-100 text-fuchsia-800',
    'JEE Preparation Cluster': 'bg-red-100 text-red-800',
    'NEET Preparation Cluster': 'bg-emerald-100 text-emerald-800',
    'Chemistry Cluster': 'bg-lime-100 text-lime-800',
    'Board Exams Cluster': 'bg-yellow-100 text-yellow-800',
    'General Cluster': 'bg-gray-100 text-gray-700',
  };
  
  return clusterColors[clusterName] || 'bg-slate-100 text-slate-700';
}

export function getProductBadgeColor(matchedProduct: string | null | undefined): string {
  if (!matchedProduct) return 'bg-gray-100 text-gray-500';
  return 'bg-blue-50 text-blue-700';
}

export interface ClusterSummary {
  clusterName: string;
  totalPages: number;
  totalETV: number;
  avgETV: number;
  products: string[];
  intentBreakdown: {
    transactional: number;
    commercialResearch: number;
    informational: number;
    other: number;
  };
  priorityTierBreakdown: {
    tier1: number;
    tier2: number;
    tier3: number;
    tier4: number;
    tier5: number;
  };
}

export function aggregateClusterStats(pages: DomainPageRecord[]): ClusterSummary[] {
  const clusterMap = new Map<string, {
    pages: DomainPageRecord[];
    products: Set<string>;
  }>();
  
  for (const page of pages) {
    if (!page.clusterName) continue;
    
    if (!clusterMap.has(page.clusterName)) {
      clusterMap.set(page.clusterName, {
        pages: [],
        products: new Set(),
      });
    }
    
    const cluster = clusterMap.get(page.clusterName)!;
    cluster.pages.push(page);
    if (page.matchedProduct) {
      cluster.products.add(page.matchedProduct);
    }
  }
  
  const summaries: ClusterSummary[] = [];
  
  const clusterEntries = Array.from(clusterMap.entries());
  for (let i = 0; i < clusterEntries.length; i++) {
    const [clusterName, data] = clusterEntries[i];
    const totalETV = data.pages.reduce((sum: number, p: DomainPageRecord) => sum + (p.estTrafficETV || 0), 0);
    const avgETV = data.pages.length > 0 ? totalETV / data.pages.length : 0;
    
    const intentBreakdown = {
      transactional: 0,
      commercialResearch: 0,
      informational: 0,
      other: 0,
    };
    
    const priorityTierBreakdown = {
      tier1: 0,
      tier2: 0,
      tier3: 0,
      tier4: 0,
      tier5: 0,
    };
    
    for (const page of data.pages) {
      switch (page.pageIntent) {
        case 'TRANSACTIONAL':
          intentBreakdown.transactional++;
          break;
        case 'COMMERCIAL_RESEARCH':
          intentBreakdown.commercialResearch++;
          break;
        case 'INFORMATIONAL':
          intentBreakdown.informational++;
          break;
        default:
          intentBreakdown.other++;
      }
      
      switch (page.priorityTier) {
        case 'TIER_1_IMMEDIATE':
          priorityTierBreakdown.tier1++;
          break;
        case 'TIER_2_HIGH':
          priorityTierBreakdown.tier2++;
          break;
        case 'TIER_3_MEDIUM':
          priorityTierBreakdown.tier3++;
          break;
        case 'TIER_4_MONITOR':
          priorityTierBreakdown.tier4++;
          break;
        case 'TIER_5_IGNORE':
          priorityTierBreakdown.tier5++;
          break;
      }
    }
    
    summaries.push({
      clusterName,
      totalPages: data.pages.length,
      totalETV: Math.round(totalETV),
      avgETV: Math.round(avgETV * 100) / 100,
      products: Array.from(data.products),
      intentBreakdown,
      priorityTierBreakdown,
    });
  }
  
  return summaries.sort((a, b) => b.totalETV - a.totalETV);
}

export function calculateClusterPriorityTier(summary: ClusterSummary): string {
  const { totalETV, intentBreakdown, totalPages } = summary;
  
  const transactionalRatio = totalPages > 0 ? intentBreakdown.transactional / totalPages : 0;
  const commercialRatio = totalPages > 0 ? intentBreakdown.commercialResearch / totalPages : 0;
  
  if (totalETV > 1000 && (transactionalRatio > 0.3 || commercialRatio > 0.4)) {
    return 'IMMEDIATE';
  }
  
  if (totalETV > 500 && (transactionalRatio > 0.2 || commercialRatio > 0.3)) {
    return 'HIGH';
  }
  
  if (totalETV > 100 || transactionalRatio > 0.1 || commercialRatio > 0.2) {
    return 'MEDIUM';
  }
  
  if (totalETV > 0 || intentBreakdown.informational > 0) {
    return 'MONITOR';
  }
  
  return 'IGNORE';
}

export function getClusterPriorityBadgeColor(priority: string): string {
  const colors: Record<string, string> = {
    'IMMEDIATE': 'bg-red-100 text-red-800',
    'HIGH': 'bg-orange-100 text-orange-800',
    'MEDIUM': 'bg-yellow-100 text-yellow-800',
    'MONITOR': 'bg-blue-100 text-blue-800',
    'IGNORE': 'bg-gray-100 text-gray-500',
  };
  return colors[priority] || 'bg-gray-100 text-gray-600';
}
