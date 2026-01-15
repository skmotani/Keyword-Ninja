import { NextRequest, NextResponse } from 'next/server';

// =============================================================================
// ENHANCED TF-IDF CLUSTERING API
// Features: Volume promotions, opportunity scoring, manual cluster support
// =============================================================================

interface KeywordInput {
    keyword: string;
    volume: number;
    position: number | null;
    bucket: string;
    locationCode: string;
}

interface ManualAssignment {
    keyword: string;
    cluster_id: string;
}

interface ClusteredKeyword {
    keyword_raw: string;
    keyword_norm: string;
    topic_text: string;
    volume: number;
    position: number | null;
    bucket: string;
    locationCode: string;
    cluster_id: string | null;
    cluster_label: string | null;
    unclustered_reason: string | null;
    is_manual: boolean;
}

interface OpportunityBreakdown {
    demand_score: number;
    visibility_gap_score: number;
    coverage_score: number;
    commerciality_score: number;
}

interface ClusterOutput {
    cluster_id: string;
    cluster_label: string;
    cluster_size: number;
    total_volume: number;
    avg_position: number;
    bucket_mix: Record<string, number>;
    cluster_origin: 'auto' | 'volume_combined' | 'volume_single' | 'manual' | 'hybrid';
    opportunity_score: number;
    opportunity_breakdown: OpportunityBreakdown;
    keywords: { keyword: string; volume: number; position: number | null; bucket: string }[];
    is_locked: boolean;
}

interface UnclusteredSummary {
    total: number;
    percentage: number;
    by_reason: {
        below_min_cluster_size: number;
        insufficient_similarity: number;
        empty_after_normalization: number;
        manual_removed: number;
    };
}

// =============================================================================
// GEO & COMMERCIAL TOKENS TO STRIP
// =============================================================================

const GEO_TOKENS = new Set([
    'near me', 'in india', 'in usa', 'in uk', 'in dubai', 'in china',
    'surat', 'ahmedabad', 'mumbai', 'delhi', 'chennai', 'bangalore', 'kolkata',
    'hyderabad', 'pune', 'jaipur', 'lucknow', 'kanpur', 'nagpur', 'indore',
    'thane', 'bhopal', 'vadodara', 'ghaziabad', 'ludhiana', 'rajkot', 'coimbatore',
    'tiruppur', 'erode', 'salem', 'madurai', 'trichy',
    'gujarat', 'maharashtra', 'tamil nadu', 'karnataka', 'rajasthan', 'kerala',
    'local', 'nearby', 'closest', 'city', 'state', 'country'
]);

const COMMERCIAL_MODIFIERS = new Set([
    'manufacturer', 'manufacturers', 'supplier', 'suppliers',
    'exporter', 'exporters', 'dealer', 'dealers',
    'distributor', 'distributors', 'company', 'companies',
    'price', 'prices', 'cost', 'costs', 'rate', 'rates',
    'quotation', 'quote', 'rfq', 'buy', 'purchase', 'order',
    'for sale', 'sale', 'wholesale', 'wholesaler',
    'vendor', 'vendors', 'trader', 'traders', 'shop', 'store', 'online'
]);

const STOPWORDS = new Set([
    'for', 'and', 'or', 'of', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'with',
    'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'best', 'top', 'most', 'good', 'great', 'new', 'used'
]);

// =============================================================================
// TEXT PROCESSING
// =============================================================================

function normalizeKeyword(keyword: string): string {
    return keyword.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildTopicText(keywordNorm: string): string {
    let text = keywordNorm;

    // Remove multi-word geo phrases
    GEO_TOKENS.forEach(geo => {
        if (geo.includes(' ')) {
            text = text.replace(new RegExp(`\\b${geo}\\b`, 'gi'), ' ');
        }
    });

    // Split and filter words
    const words = text.split(/\s+/).filter(word => {
        if (word.length < 2) return false;
        if (GEO_TOKENS.has(word)) return false;
        if (COMMERCIAL_MODIFIERS.has(word)) return false;
        if (STOPWORDS.has(word)) return false;
        return true;
    });

    return words.join(' ').trim();
}

function tokenize(text: string): string[] {
    return text.split(/\s+/).filter(w => w.length > 1);
}

function tokenizeWithBigrams(text: string): string[] {
    const words = tokenize(text);
    const tokens = [...words];
    for (let i = 0; i < words.length - 1; i++) {
        tokens.push(`${words[i]}_${words[i + 1]}`);
    }
    return tokens;
}

// =============================================================================
// TF-IDF
// =============================================================================

interface TfIdfVector { [term: string]: number; }

function computeTfIdf(documents: string[]): TfIdfVector[] {
    const tokenizedDocs = documents.map(tokenizeWithBigrams);
    const docCount = tokenizedDocs.length;
    if (docCount === 0) return [];

    const docFreq: Record<string, number> = {};
    tokenizedDocs.forEach(tokens => {
        new Set(tokens).forEach(token => {
            docFreq[token] = (docFreq[token] || 0) + 1;
        });
    });

    return tokenizedDocs.map(tokens => {
        const vector: TfIdfVector = {};
        if (tokens.length === 0) return vector;

        const termCounts: Record<string, number> = {};
        tokens.forEach(token => { termCounts[token] = (termCounts[token] || 0) + 1; });

        const maxTf = Math.max(...Object.values(termCounts), 1);
        Object.entries(termCounts).forEach(([term, count]) => {
            const tf = count / maxTf;
            const idf = Math.log((docCount + 1) / (docFreq[term] + 1)) + 1;
            vector[term] = tf * idf;
        });

        return vector;
    });
}

function cosineSimilarity(v1: TfIdfVector, v2: TfIdfVector): number {
    const terms = new Set([...Object.keys(v1), ...Object.keys(v2)]);
    let dot = 0, norm1 = 0, norm2 = 0;
    terms.forEach(term => {
        const val1 = v1[term] || 0, val2 = v2[term] || 0;
        dot += val1 * val2;
        norm1 += val1 * val1;
        norm2 += val2 * val2;
    });
    const denom = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denom === 0 ? 0 : dot / denom;
}

// =============================================================================
// AGGLOMERATIVE CLUSTERING
// =============================================================================

function agglomerativeClustering(vectors: TfIdfVector[], simThreshold: number): number[] {
    const n = vectors.length;
    if (n === 0) return [];
    if (n === 1) return [0];

    const similarities: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        similarities[i][i] = 1;
        for (let j = i + 1; j < n; j++) {
            const sim = cosineSimilarity(vectors[i], vectors[j]);
            similarities[i][j] = sim;
            similarities[j][i] = sim;
        }
    }

    let clusters: number[] = Array.from({ length: n }, (_, i) => i);
    const clusterMembers: Map<number, Set<number>> = new Map();
    for (let i = 0; i < n; i++) clusterMembers.set(i, new Set([i]));

    let changed = true;
    while (changed) {
        changed = false;
        const activeIds = Array.from(new Set(clusters)).filter(c => clusterMembers.has(c));
        let bestI = -1, bestJ = -1, bestSim = simThreshold;

        for (let ai = 0; ai < activeIds.length; ai++) {
            for (let aj = ai + 1; aj < activeIds.length; aj++) {
                const ci = activeIds[ai], cj = activeIds[aj];
                const mI = clusterMembers.get(ci)!, mJ = clusterMembers.get(cj)!;
                let total = 0, count = 0;
                mI.forEach(mi => mJ.forEach(mj => { total += similarities[mi][mj]; count++; }));
                const avg = count > 0 ? total / count : 0;
                if (avg > bestSim) { bestSim = avg; bestI = ci; bestJ = cj; }
            }
        }

        if (bestI >= 0 && bestJ >= 0) {
            const mJ = clusterMembers.get(bestJ)!, mI = clusterMembers.get(bestI)!;
            mJ.forEach(idx => { clusters[idx] = bestI; mI.add(idx); });
            clusterMembers.delete(bestJ);
            changed = true;
        }
    }

    return clusters;
}

// =============================================================================
// GRANULARITY TO THRESHOLD (MONOTONIC)
// Higher granularity = tighter = higher similarity threshold = more clusters
// =============================================================================

function granularityToThreshold(granularity: number): number {
    // granularity 0   → threshold 0.25 (very loose, few clusters)
    // granularity 100 → threshold 0.70 (tight, many clusters)
    return 0.25 + (granularity / 100) * 0.45;
}

// =============================================================================
// OPPORTUNITY SCORING (NON-LLM)
// =============================================================================

function computeOpportunityScore(
    totalVolume: number,
    avgPosition: number,
    keywordCount: number,
    buyPercentage: number,
    volumeP75: number,
    volumeP95: number
): { score: number; breakdown: OpportunityBreakdown } {
    // Demand score (volume)
    let demand_score: number;
    if (totalVolume >= volumeP95) demand_score = 100;
    else if (totalVolume >= volumeP75) demand_score = 70;
    else if (totalVolume >= volumeP75 / 2) demand_score = 40;
    else demand_score = 20;

    // Visibility gap (higher position = more opportunity)
    let visibility_gap_score: number;
    if (avgPosition > 20) visibility_gap_score = 100;
    else if (avgPosition > 10) visibility_gap_score = 70;
    else if (avgPosition > 5) visibility_gap_score = 40;
    else visibility_gap_score = 20;

    // Coverage (keyword count)
    let coverage_score: number;
    if (keywordCount >= 20) coverage_score = 100;
    else if (keywordCount >= 10) coverage_score = 70;
    else if (keywordCount >= 5) coverage_score = 40;
    else coverage_score = 20;

    // Commerciality (% buy keywords)
    let commerciality_score: number;
    if (buyPercentage >= 70) commerciality_score = 100;
    else if (buyPercentage >= 50) commerciality_score = 70;
    else if (buyPercentage >= 30) commerciality_score = 40;
    else commerciality_score = 20;

    const score = Math.round(
        0.35 * demand_score +
        0.35 * visibility_gap_score +
        0.20 * coverage_score +
        0.10 * commerciality_score
    );

    return {
        score,
        breakdown: { demand_score, visibility_gap_score, coverage_score, commerciality_score }
    };
}

// =============================================================================
// CLUSTER LABEL GENERATION
// =============================================================================

function generateClusterLabel(keywords: ClusteredKeyword[]): string {
    const sorted = [...keywords].sort((a, b) => (b.volume || 0) - (a.volume || 0));
    if (sorted.length === 0) return 'Cluster';

    let label = sorted[0].keyword_raw
        .replace(/\s+(manufacturer|supplier|dealer|price|cost)s?$/i, '')
        .trim();

    return label.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').substring(0, 50);
}

// =============================================================================
// MAIN CLUSTERING FUNCTION
// =============================================================================

function runClustering(
    keywords: KeywordInput[],
    granularity: number,
    minClusterSize: number,
    clusterPolicy: 'topic' | 'bucket-separated',
    manualAssignments: ManualAssignment[],
    lockedClusters: string[],
    bucketPrefix?: string
): {
    clusteredKeywords: ClusteredKeyword[];
    clusters: ClusterOutput[];
    unclusteredSummary: UnclusteredSummary;
} {
    const prefix = bucketPrefix ? `${bucketPrefix}_` : '';

    // Build manual map
    const manualMap: Record<string, string> = {};
    manualAssignments.forEach(a => { manualMap[a.keyword.toLowerCase()] = a.cluster_id; });

    // Process keywords
    const processed: ClusteredKeyword[] = keywords.map(kw => {
        const keyword_norm = normalizeKeyword(kw.keyword);
        const topic_text = buildTopicText(keyword_norm);
        const manualCluster = manualMap[kw.keyword.toLowerCase()];

        return {
            keyword_raw: kw.keyword,
            keyword_norm,
            topic_text,
            volume: kw.volume,
            position: kw.position,
            bucket: kw.bucket,
            locationCode: kw.locationCode,
            cluster_id: manualCluster || null,
            cluster_label: null,
            unclustered_reason: null,
            is_manual: !!manualCluster
        };
    });

    // Separate manual vs auto keywords
    const manualKeywords = processed.filter(p => p.is_manual);
    const autoKeywords = processed.filter(p => !p.is_manual);

    // Handle empty topic_text
    autoKeywords.forEach(p => {
        if (!p.topic_text || p.topic_text.length === 0) {
            p.unclustered_reason = 'empty_after_normalization';
        }
    });

    // Get clusterable keywords
    const clusterableIndices: number[] = [];
    const clusterableTexts: string[] = [];
    autoKeywords.forEach((p, idx) => {
        if (!p.unclustered_reason) {
            clusterableIndices.push(idx);
            clusterableTexts.push(p.topic_text);
        }
    });

    // Calculate volume thresholds for promotions
    const allVolumes = keywords.map(k => k.volume).filter(v => v > 0).sort((a, b) => a - b);
    const p75Idx = Math.floor(allVolumes.length * 0.75);
    const p80Idx = Math.floor(allVolumes.length * 0.80);
    const volumeP75 = allVolumes[p75Idx] || 300;
    const volumeP80 = allVolumes[p80Idx] || 500;
    const volumeP95 = allVolumes[Math.floor(allVolumes.length * 0.95)] || 1000;

    // Combined volume threshold for micro-clusters
    const combinedVolumeThreshold = Math.max(volumeP75, 800);
    // Single keyword volume threshold for singletons
    const singleVolumeThreshold = Math.max(volumeP80, 300);

    if (clusterableIndices.length === 0) {
        // No clusterable keywords
        return buildEmptyResult(processed, manualKeywords, prefix, volumeP75, volumeP95);
    }

    // TF-IDF and clustering
    const vectors = computeTfIdf(clusterableTexts);
    const simThreshold = granularityToThreshold(granularity);
    const rawAssignments = agglomerativeClustering(vectors, simThreshold);

    // Group by raw cluster
    const rawGroups: Map<number, number[]> = new Map();
    rawAssignments.forEach((cid, i) => {
        if (!rawGroups.has(cid)) rawGroups.set(cid, []);
        rawGroups.get(cid)!.push(clusterableIndices[i]);
    });

    // Validate clusters with priority:
    // 1. Size >= minClusterSize (auto)
    // 2. Combined volume >= threshold (volume_combined)
    // 3. Single keyword volume >= threshold (volume_single)

    const validatedClusters: Map<string, {
        indices: number[];
        origin: 'auto' | 'volume_combined' | 'volume_single'
    }> = new Map();

    let clusterCounter = 0;

    rawGroups.forEach((indices, rawId) => {
        const clusterKeywords = indices.map(i => autoKeywords[i]);
        const size = clusterKeywords.length;
        const totalVol = clusterKeywords.reduce((s, k) => s + k.volume, 0);

        let origin: 'auto' | 'volume_combined' | 'volume_single' = 'auto';
        let isValid = false;

        if (size >= minClusterSize) {
            isValid = true;
            origin = 'auto';
        } else if (size > 1 && totalVol >= combinedVolumeThreshold) {
            isValid = true;
            origin = 'volume_combined';
        } else if (size === 1 && clusterKeywords[0].volume >= singleVolumeThreshold) {
            isValid = true;
            origin = 'volume_single';
        }

        if (isValid) {
            const cid = `${prefix}${clusterCounter++}`;
            validatedClusters.set(cid, { indices, origin });
        } else {
            // Mark as unclustered
            indices.forEach(idx => {
                if (size < minClusterSize) {
                    autoKeywords[idx].unclustered_reason = 'below_min_cluster_size';
                } else {
                    autoKeywords[idx].unclustered_reason = 'insufficient_similarity';
                }
            });
        }
    });

    // Assign cluster IDs to keywords
    validatedClusters.forEach((data, cid) => {
        data.indices.forEach(idx => {
            autoKeywords[idx].cluster_id = cid;
        });
    });

    // Build cluster outputs
    const clustersList: ClusterOutput[] = [];

    // Process auto clusters
    validatedClusters.forEach((data, cid) => {
        const members = data.indices.map(i => autoKeywords[i]);
        const label = generateClusterLabel(members);
        members.forEach(m => m.cluster_label = label);

        const totalVol = members.reduce((s, m) => s + m.volume, 0);
        const positions = members.filter(m => m.position).map(m => m.position!);
        const avgPos = positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : 0;

        const bucketMix: Record<string, number> = {};
        members.forEach(m => bucketMix[m.bucket] = (bucketMix[m.bucket] || 0) + 1);

        const buyCount = bucketMix['include'] || 0;
        const buyPct = members.length > 0 ? (buyCount / members.length) * 100 : 0;

        const { score, breakdown } = computeOpportunityScore(
            totalVol, avgPos, members.length, buyPct, volumeP75, volumeP95
        );

        clustersList.push({
            cluster_id: cid,
            cluster_label: label,
            cluster_size: members.length,
            total_volume: totalVol,
            avg_position: Math.round(avgPos * 10) / 10,
            bucket_mix: bucketMix,
            cluster_origin: data.origin,
            opportunity_score: score,
            opportunity_breakdown: breakdown,
            keywords: members.map(m => ({
                keyword: m.keyword_raw,
                volume: m.volume,
                position: m.position,
                bucket: m.bucket
            })),
            is_locked: lockedClusters.includes(cid)
        });
    });

    // Process manual clusters (create if needed)
    const manualClusterIds = new Set(manualKeywords.map(k => k.cluster_id!));
    manualClusterIds.forEach(cid => {
        const members = manualKeywords.filter(k => k.cluster_id === cid);
        if (members.length === 0) return;

        // Check if cluster already exists from auto
        const existingIdx = clustersList.findIndex(c => c.cluster_id === cid);
        if (existingIdx >= 0) {
            // Merge manual keywords into existing cluster
            const existing = clustersList[existingIdx];
            members.forEach(m => {
                existing.keywords.push({
                    keyword: m.keyword_raw,
                    volume: m.volume,
                    position: m.position,
                    bucket: m.bucket
                });
                existing.bucket_mix[m.bucket] = (existing.bucket_mix[m.bucket] || 0) + 1;
            });
            existing.cluster_size += members.length;
            existing.total_volume += members.reduce((s, m) => s + m.volume, 0);
            existing.cluster_origin = 'hybrid';
        } else {
            // Create new manual cluster
            const label = generateClusterLabel(members);
            members.forEach(m => m.cluster_label = label);

            const totalVol = members.reduce((s, m) => s + m.volume, 0);
            const positions = members.filter(m => m.position).map(m => m.position!);
            const avgPos = positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : 0;

            const bucketMix: Record<string, number> = {};
            members.forEach(m => bucketMix[m.bucket] = (bucketMix[m.bucket] || 0) + 1);

            const buyCount = bucketMix['include'] || 0;
            const buyPct = members.length > 0 ? (buyCount / members.length) * 100 : 0;

            const { score, breakdown } = computeOpportunityScore(
                totalVol, avgPos, members.length, buyPct, volumeP75, volumeP95
            );

            clustersList.push({
                cluster_id: cid,
                cluster_label: label,
                cluster_size: members.length,
                total_volume: totalVol,
                avg_position: Math.round(avgPos * 10) / 10,
                bucket_mix: bucketMix,
                cluster_origin: 'manual',
                opportunity_score: score,
                opportunity_breakdown: breakdown,
                keywords: members.map(m => ({
                    keyword: m.keyword_raw,
                    volume: m.volume,
                    position: m.position,
                    bucket: m.bucket
                })),
                is_locked: lockedClusters.includes(cid)
            });
        }
    });

    // Sort clusters by opportunity score
    clustersList.sort((a, b) => b.opportunity_score - a.opportunity_score);

    // Combine all keywords
    const allKeywords = [...autoKeywords, ...manualKeywords];

    // Build unclustered summary
    const unclustered = allKeywords.filter(k => k.unclustered_reason);
    const byReason = {
        below_min_cluster_size: unclustered.filter(k => k.unclustered_reason === 'below_min_cluster_size').length,
        insufficient_similarity: unclustered.filter(k => k.unclustered_reason === 'insufficient_similarity').length,
        empty_after_normalization: unclustered.filter(k => k.unclustered_reason === 'empty_after_normalization').length,
        manual_removed: unclustered.filter(k => k.unclustered_reason === 'manual_removed').length
    };

    return {
        clusteredKeywords: allKeywords,
        clusters: clustersList,
        unclusteredSummary: {
            total: unclustered.length,
            percentage: allKeywords.length > 0 ? Math.round((unclustered.length / allKeywords.length) * 100) : 0,
            by_reason: byReason
        }
    };
}

function buildEmptyResult(
    processed: ClusteredKeyword[],
    manualKeywords: ClusteredKeyword[],
    prefix: string,
    volumeP75: number,
    volumeP95: number
) {
    return {
        clusteredKeywords: processed,
        clusters: [],
        unclusteredSummary: {
            total: processed.length,
            percentage: 100,
            by_reason: {
                below_min_cluster_size: 0,
                insufficient_similarity: 0,
                empty_after_normalization: processed.filter(p => p.unclustered_reason === 'empty_after_normalization').length,
                manual_removed: 0
            }
        }
    };
}

// =============================================================================
// API HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            keywords,
            granularity = 50,
            minClusterSize = 2,
            clusterPolicy = 'topic',
            manualAssignments = [],
            lockedClusters = []
        } = body as {
            keywords: KeywordInput[];
            granularity?: number;
            minClusterSize?: number;
            clusterPolicy?: 'topic' | 'bucket-separated';
            manualAssignments?: ManualAssignment[];
            lockedClusters?: string[];
        };

        if (!keywords || keywords.length === 0) {
            return NextResponse.json({ error: 'No keywords provided' }, { status: 400 });
        }

        console.log(`[Cluster API] ${keywords.length} keywords, granularity=${granularity}, minSize=${minClusterSize}`);

        let allKeywords: ClusteredKeyword[] = [];
        let allClusters: ClusterOutput[] = [];

        if (clusterPolicy === 'bucket-separated') {
            const bucketGroups: Map<string, KeywordInput[]> = new Map();
            keywords.forEach(kw => {
                const bucket = kw.bucket || 'unassigned';
                if (!bucketGroups.has(bucket)) bucketGroups.set(bucket, []);
                bucketGroups.get(bucket)!.push(kw);
            });

            bucketGroups.forEach((bucketKws, bucket) => {
                const prefix = bucket.toUpperCase().replace(/[^A-Z]/g, '');
                const result = runClustering(bucketKws, granularity, minClusterSize, clusterPolicy, manualAssignments, lockedClusters, prefix);
                allKeywords.push(...result.clusteredKeywords);
                allClusters.push(...result.clusters);
            });
        } else {
            const result = runClustering(keywords, granularity, minClusterSize, clusterPolicy, manualAssignments, lockedClusters);
            allKeywords = result.clusteredKeywords;
            allClusters = result.clusters;
        }

        allClusters.sort((a, b) => b.opportunity_score - a.opportunity_score);

        const unclustered = allKeywords.filter(k => k.unclustered_reason);

        const stats = {
            keywords_considered: keywords.length,
            clusters_created: allClusters.length,
            clustered_keywords: allKeywords.filter(k => k.cluster_id).length,
            unclustered_keywords: unclustered.length,
            unclustered_percentage: keywords.length > 0 ? Math.round((unclustered.length / keywords.length) * 100) : 0,
            similarity_threshold: granularityToThreshold(granularity)
        };

        const byReason = {
            below_min_cluster_size: unclustered.filter(k => k.unclustered_reason === 'below_min_cluster_size').length,
            insufficient_similarity: unclustered.filter(k => k.unclustered_reason === 'insufficient_similarity').length,
            empty_after_normalization: unclustered.filter(k => k.unclustered_reason === 'empty_after_normalization').length,
            manual_removed: unclustered.filter(k => k.unclustered_reason === 'manual_removed').length
        };

        console.log(`[Cluster API] Result: ${stats.clusters_created} clusters, ${stats.clustered_keywords} clustered, ${stats.unclustered_keywords} unclustered`);

        return NextResponse.json({
            success: true,
            stats,
            clusters: allClusters,
            keywords: allKeywords,
            unclustered_summary: { total: unclustered.length, percentage: stats.unclustered_percentage, by_reason: byReason }
        });

    } catch (error) {
        console.error('[Cluster API] Error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Clustering failed' }, { status: 500 });
    }
}
