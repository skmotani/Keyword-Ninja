/**
 * Intent Classification Engine
 * Rule-based, deterministic, explainable intent classification for SEO keywords
 */

import intentDictionary from './intent_dictionary_v1.json';

// =============================================================================
// TYPES
// =============================================================================

export interface IntentSignal {
    intent: string;
    phrase: string;
    weight: number;
    source: 'phrase' | 'regex' | 'bucket_prior' | 'brand';
}

export interface KeywordIntentResult {
    keyword: string;
    volume: number;
    position: number | null;
    bucket: string;
    intentPrimary: string;
    intentSecondary: string | null;
    intentScores: Record<string, number>;
    intentProbs: Record<string, number>;
    confidence: number;
    matchedRules: string[];
    reasonCodes: string[];
}

export interface ClusterIntentResult {
    clusterId: string;
    clusterName: string;
    intentPrimary: string;
    intentSecondary: string | null;
    distribution: Record<string, number>;
    confidence: number;
    reasonCodes: string[];
    llmChecked: boolean;
    llmOverride: boolean;
    llmNotes: string | null;
    keywords: KeywordIntentResult[];
    totalVolume: number;
    keywordCount: number;
}

export interface IntentClassificationResult {
    clientCode: string;
    timestamp: string;
    clusters: ClusterIntentResult[];
    summary: Record<string, { clusters: number; keywords: number; volume: number }>;
}

// =============================================================================
// NORMALIZATION
// =============================================================================

export function normalizeKeyword(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// =============================================================================
// SIGNAL EXTRACTION
// =============================================================================

export function extractSignals(
    keyword: string,
    bucket: string,
    brandList: string[] = []
): IntentSignal[] {
    const signals: IntentSignal[] = [];
    const normalized = normalizeKeyword(keyword);
    const intents = intentDictionary.intents as Record<string, {
        weight: number;
        phrases: string[];
        regex?: string[];
        brand_signal?: boolean;
    }>;

    // Check each intent
    for (const [intentName, intentConfig] of Object.entries(intents)) {
        // Phrase matching
        for (const phrase of intentConfig.phrases) {
            if (normalized.includes(phrase.toLowerCase())) {
                signals.push({
                    intent: intentName,
                    phrase: phrase,
                    weight: intentConfig.weight,
                    source: 'phrase'
                });
            }
        }

        // Regex matching
        if (intentConfig.regex) {
            for (const pattern of intentConfig.regex) {
                try {
                    const regex = new RegExp(pattern, 'i');
                    if (regex.test(normalized)) {
                        signals.push({
                            intent: intentName,
                            phrase: pattern,
                            weight: intentConfig.weight * 1.2, // Regex matches are slightly stronger
                            source: 'regex'
                        });
                    }
                } catch {
                    // Invalid regex, skip
                }
            }
        }

        // Brand signal for navigational
        if (intentConfig.brand_signal && brandList.length > 0) {
            for (const brand of brandList) {
                if (normalized.includes(brand.toLowerCase())) {
                    signals.push({
                        intent: 'navigational',
                        phrase: `brand:${brand}`,
                        weight: 3,
                        source: 'brand'
                    });
                }
            }
        }
    }

    // Add bucket priors (weak signals)
    const bucketPriors = intentDictionary.bucket_priors as Record<string, Record<string, number>>;
    const bucketKey = bucket.split('|')[0].toLowerCase().trim(); // e.g., "include" from "Include | Buy"

    if (bucketPriors[bucketKey]) {
        for (const [intent, prior] of Object.entries(bucketPriors[bucketKey])) {
            signals.push({
                intent,
                phrase: `bucket:${bucket}`,
                weight: prior,
                source: 'bucket_prior'
            });
        }
    }

    return signals;
}

// =============================================================================
// SCORING
// =============================================================================

export function computeIntentScores(signals: IntentSignal[]): Record<string, number> {
    const scores: Record<string, number> = {
        transactional: 0,
        commercial_investigation: 0,
        informational: 0,
        navigational: 0,
        local_geo: 0,
        support: 0,
        noise: 0
    };

    for (const signal of signals) {
        if (scores[signal.intent] !== undefined) {
            scores[signal.intent] += signal.weight;
        }
    }

    return scores;
}

export function softmaxProbabilities(scores: Record<string, number>): Record<string, number> {
    const maxScore = Math.max(...Object.values(scores));
    const expScores: Record<string, number> = {};
    let sumExp = 0;

    for (const [intent, score] of Object.entries(scores)) {
        // Subtract max for numerical stability
        const exp = Math.exp(score - maxScore);
        expScores[intent] = exp;
        sumExp += exp;
    }

    const probs: Record<string, number> = {};
    for (const [intent, exp] of Object.entries(expScores)) {
        probs[intent] = sumExp > 0 ? exp / sumExp : 1 / Object.keys(scores).length;
    }

    return probs;
}

// =============================================================================
// CONFIDENCE SCORING
// =============================================================================

function sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
}

export function computeKeywordConfidence(
    probs: Record<string, number>,
    matchedRulesCount: number,
    volume: number
): { confidence: number; reasonCodes: string[] } {
    const sorted = Object.entries(probs).sort((a, b) => b[1] - a[1]);
    const p1 = sorted[0]?.[1] || 0;
    const p2 = sorted[1]?.[1] || 0;
    const margin = p1 - p2;

    // Evidence strength
    const evidence = matchedRulesCount + Math.log(1 + volume) / 10;

    // Contradiction detection
    let contradiction = 0;
    if (probs.informational > 0.3 && probs.transactional > 0.3) {
        contradiction = 0.5;
    }
    if (probs.noise > 0.3 && (probs.transactional > 0.3 || probs.informational > 0.3)) {
        contradiction = 0.7;
    }

    const weights = intentDictionary.weights;
    const rawConfidence = 100 * (
        weights.margin_weight * margin +
        weights.evidence_weight * sigmoid(evidence) -
        weights.contradiction_penalty * contradiction
    );

    const confidence = Math.max(0, Math.min(100, rawConfidence));

    const reasonCodes: string[] = [];
    if (margin < 0.15) reasonCodes.push('LOW_MARGIN');
    if (matchedRulesCount < 2) reasonCodes.push('LOW_EVIDENCE');
    if (contradiction > 0.3) reasonCodes.push('HIGH_CONTRADICTION');

    return { confidence: Math.round(confidence), reasonCodes };
}

// =============================================================================
// KEYWORD-LEVEL CLASSIFICATION
// =============================================================================

export function classifyKeyword(
    keyword: string,
    volume: number,
    position: number | null,
    bucket: string,
    brandList: string[] = []
): KeywordIntentResult {
    const signals = extractSignals(keyword, bucket, brandList);
    const scores = computeIntentScores(signals);
    const probs = softmaxProbabilities(scores);

    // Get primary and secondary intents
    const sorted = Object.entries(probs).sort((a, b) => b[1] - a[1]);
    const intentPrimary = sorted[0]?.[0] || 'informational';
    const intentSecondary = sorted[1]?.[1] >= 0.20 ? sorted[1]?.[0] : null;

    // Matched rules for explanation
    const matchedRules = signals
        .filter(s => s.source !== 'bucket_prior')
        .map(s => s.phrase);

    // Confidence
    const { confidence, reasonCodes } = computeKeywordConfidence(probs, matchedRules.length, volume);

    return {
        keyword,
        volume,
        position,
        bucket,
        intentPrimary,
        intentSecondary,
        intentScores: scores,
        intentProbs: probs,
        confidence,
        matchedRules: Array.from(new Set(matchedRules)),
        reasonCodes
    };
}

// =============================================================================
// CLUSTER-LEVEL AGGREGATION
// =============================================================================

export function aggregateClusterIntent(
    clusterId: string,
    clusterName: string,
    keywords: KeywordIntentResult[]
): ClusterIntentResult {
    if (keywords.length === 0) {
        return {
            clusterId,
            clusterName,
            intentPrimary: 'informational',
            intentSecondary: null,
            distribution: {},
            confidence: 0,
            reasonCodes: ['EMPTY_CLUSTER'],
            llmChecked: false,
            llmOverride: false,
            llmNotes: null,
            keywords,
            totalVolume: 0,
            keywordCount: 0
        };
    }

    // Volume-weighted aggregation
    const intentTotals: Record<string, number> = {};
    let totalWeight = 0;

    for (const kw of keywords) {
        const weight = Math.log(1 + kw.volume);
        totalWeight += weight;

        for (const [intent, prob] of Object.entries(kw.intentProbs)) {
            intentTotals[intent] = (intentTotals[intent] || 0) + prob * weight;
        }
    }

    // Normalize to distribution
    const distribution: Record<string, number> = {};
    for (const [intent, total] of Object.entries(intentTotals)) {
        distribution[intent] = totalWeight > 0 ? total / totalWeight : 0;
    }

    // Primary and secondary
    const sorted = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
    const intentPrimary = sorted[0]?.[0] || 'informational';
    const intentSecondary = sorted[1]?.[1] >= 0.20 ? sorted[1]?.[0] : null;

    // Cluster confidence
    const margin = (sorted[0]?.[1] || 0) - (sorted[1]?.[1] || 0);
    const consistency = keywords.filter(kw => kw.intentPrimary === intentPrimary).length / keywords.length;
    const contradictionRate = keywords.filter(kw => kw.reasonCodes.includes('HIGH_CONTRADICTION')).length / keywords.length;

    const weights = intentDictionary.weights;
    const rawConfidence = 100 * (
        weights.margin_weight * margin +
        weights.consistency_weight * consistency -
        0.2 * contradictionRate
    );
    const confidence = Math.max(0, Math.min(100, Math.round(rawConfidence)));

    // Reason codes
    const reasonCodes: string[] = [];
    if (margin < 0.12) reasonCodes.push('LOW_MARGIN');
    if (consistency < 0.6) reasonCodes.push('MIXED_INTENT_CLUSTER');
    if (contradictionRate > 0.2) reasonCodes.push('HIGH_CONTRADICTION_RATE');
    if (distribution.noise > 0.3) reasonCodes.push('HIGH_NOISE_RATE');

    return {
        clusterId,
        clusterName,
        intentPrimary,
        intentSecondary,
        distribution,
        confidence,
        reasonCodes,
        llmChecked: false,
        llmOverride: false,
        llmNotes: null,
        keywords,
        totalVolume: keywords.reduce((s, k) => s + k.volume, 0),
        keywordCount: keywords.length
    };
}

// =============================================================================
// BATCH CLASSIFICATION
// =============================================================================

export function classifyClusters(
    clusters: Array<{
        id: string;
        label: string;
        keywords: Array<{
            keyword: string;
            volume: number;
            position: number | null;
            bucket: string;
        }>;
    }>,
    brandList: string[] = []
): ClusterIntentResult[] {
    return clusters.map(cluster => {
        const keywordResults = cluster.keywords.map(kw =>
            classifyKeyword(kw.keyword, kw.volume, kw.position, kw.bucket, brandList)
        );
        return aggregateClusterIntent(cluster.id, cluster.label, keywordResults);
    });
}

// =============================================================================
// SUMMARY
// =============================================================================

export function computeIntentSummary(
    clusters: ClusterIntentResult[]
): Record<string, { clusters: number; keywords: number; volume: number }> {
    const summary: Record<string, { clusters: number; keywords: number; volume: number }> = {};

    const intents = ['transactional', 'commercial_investigation', 'informational', 'navigational', 'local_geo', 'support', 'noise'];
    for (const intent of intents) {
        summary[intent] = { clusters: 0, keywords: 0, volume: 0 };
    }

    for (const cluster of clusters) {
        const intent = cluster.intentPrimary;
        if (summary[intent]) {
            summary[intent].clusters++;
            summary[intent].keywords += cluster.keywordCount;
            summary[intent].volume += cluster.totalVolume;
        }
    }

    return summary;
}

// =============================================================================
// LLM PROMPT GENERATION
// =============================================================================

export function generateLLMPrompt(cluster: ClusterIntentResult): {
    systemPrompt: string;
    userPrompt: string;
} {
    const systemPrompt = `You are an SEO intent classifier. Given a cluster of keywords and their rule-based intent scores, confirm or adjust the primary intent classification. Be concise and return structured JSON only.`;

    const topKeywords = cluster.keywords
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 10)
        .map(k => `${k.keyword} (vol:${k.volume}, intent:${k.intentPrimary})`);

    const userPrompt = JSON.stringify({
        cluster_name: cluster.clusterName,
        top_keywords: topKeywords,
        rule_based_intent: cluster.intentPrimary,
        distribution: Object.fromEntries(
            Object.entries(cluster.distribution)
                .map(([k, v]) => [k, Math.round(v * 100) + '%'])
        ),
        confidence: cluster.confidence,
        reason_codes: cluster.reasonCodes,
        instruction: 'Confirm or adjust the primary_intent. Return JSON: { "primary_intent": "...", "secondary_intent": "...|null", "confidence_adjustment": -10..+10, "notes": "short explanation" }'
    }, null, 2);

    return { systemPrompt, userPrompt };
}

// =============================================================================
// SHOULD TRIGGER LLM
// =============================================================================

export function shouldTriggerLLM(cluster: ClusterIntentResult): boolean {
    const thresholds = intentDictionary.confidence_thresholds;

    if (cluster.confidence < thresholds.llm_trigger) return true;

    const sorted = Object.entries(cluster.distribution).sort((a, b) => b[1] - a[1]);
    const margin = (sorted[0]?.[1] || 0) - (sorted[1]?.[1] || 0);
    if (margin < 0.12) return true;

    if (cluster.reasonCodes.includes('MIXED_INTENT_CLUSTER') && cluster.totalVolume > 10000) return true;

    return false;
}
