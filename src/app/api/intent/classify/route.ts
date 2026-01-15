/**
 * Intent Classification API
 * POST /api/intent/classify
 * 
 * Classifies saved clusters into intents using rule-based engine
 * with optional LLM verification for low-confidence cases
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import {
    classifyClusters,
    computeIntentSummary,
    shouldTriggerLLM,
    generateLLMPrompt,
    ClusterIntentResult,
    IntentClassificationResult
} from '@/lib/intentEngine';

// Lazy OpenAI initialization to prevent route from failing if API key is missing
let openai: any = null;
function getOpenAI() {
    if (!openai) {
        const OpenAI = require('openai').default;
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openai;
}

// Path to intent results storage
const getResultsPath = (clientCode: string) =>
    path.join(process.cwd(), 'src', 'lib', `intent_results_${clientCode}.json`);

// Load saved clusters from localStorage backup (passed in request)
// In production, this would come from database

interface ClusterKeyword {
    keyword: string;
    volume: number;
    position: number | null;
    bucket: string;
    locationCode: string;
}

interface SavedCluster {
    id: string;
    label: string;
    size: number;
    totalVolume: number;
    avgPosition: number;
    origin: string;
    keywords: ClusterKeyword[];
}

async function callLLMForVerification(cluster: ClusterIntentResult): Promise<{
    primary_intent: string;
    secondary_intent: string | null;
    confidence_adjustment: number;
    notes: string;
} | null> {
    try {
        const { systemPrompt, userPrompt } = generateLLMPrompt(cluster);

        const response = await getOpenAI().chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.3,
            max_tokens: 200,
            response_format: { type: 'json_object' }
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
            return JSON.parse(content);
        }
    } catch (error) {
        console.error('LLM verification failed:', error);
    }
    return null;
}

export async function POST(request: NextRequest) {
    try {
        console.log('[IntentClassify] Starting classification...');
        const body = await request.json();
        console.log('[IntentClassify] Request body parsed, clientCode:', body.clientCode, 'clusters count:', body.clusters?.length);

        const {
            clientCode,
            clusters,
            brandList = [],
            mode = 'rule_only'
        }: {
            clientCode: string;
            clusters: SavedCluster[];
            brandList?: string[];
            mode?: 'rule_only' | 'rule_plus_llm';
        } = body;

        if (!clientCode) {
            return NextResponse.json({ success: false, error: 'clientCode required' }, { status: 400 });
        }

        if (!clusters || !Array.isArray(clusters) || clusters.length === 0) {
            return NextResponse.json({ success: false, error: 'clusters array required' }, { status: 400 });
        }

        console.log('[IntentClassify] Validation passed. First cluster sample:', JSON.stringify(clusters[0], null, 2).slice(0, 500));

        // Transform clusters to engine format
        const engineClusters = clusters.map(c => ({
            id: c.id,
            label: c.label,
            keywords: (c.keywords || []).map(k => ({
                keyword: k.keyword,
                volume: k.volume || 0,
                position: k.position,
                bucket: k.bucket || 'include'
            }))
        }));

        console.log('[IntentClassify] Transformed to engine format. First engineCluster:', JSON.stringify(engineClusters[0], null, 2).slice(0, 500));

        // Run rule-based classification
        console.log('[IntentClassify] Calling classifyClusters...');
        let classifiedClusters = classifyClusters(engineClusters, brandList);
        console.log('[IntentClassify] Classification complete. Results count:', classifiedClusters.length);

        // LLM verification for low-confidence clusters if enabled
        if (mode === 'rule_plus_llm') {
            const llmCandidates = classifiedClusters.filter(c => shouldTriggerLLM(c));

            for (const cluster of llmCandidates) {
                const llmResult = await callLLMForVerification(cluster);

                if (llmResult) {
                    const idx = classifiedClusters.findIndex(c => c.clusterId === cluster.clusterId);
                    if (idx !== -1) {
                        const original = classifiedClusters[idx];
                        const override = llmResult.primary_intent !== original.intentPrimary;

                        classifiedClusters[idx] = {
                            ...original,
                            intentPrimary: override ? llmResult.primary_intent : original.intentPrimary,
                            intentSecondary: llmResult.secondary_intent,
                            confidence: Math.max(0, Math.min(100, original.confidence + llmResult.confidence_adjustment)),
                            llmChecked: true,
                            llmOverride: override,
                            llmNotes: llmResult.notes
                        };
                    }
                }
            }
        }

        // Compute summary
        const summary = computeIntentSummary(classifiedClusters);

        // Build result
        const result: IntentClassificationResult = {
            clientCode,
            timestamp: new Date().toISOString(),
            clusters: classifiedClusters,
            summary
        };

        // Persist results
        try {
            await fs.writeFile(getResultsPath(clientCode), JSON.stringify(result, null, 2));
        } catch (writeError) {
            console.error('Failed to persist results:', writeError);
        }

        return NextResponse.json({
            success: true,
            data: result,
            stats: {
                totalClusters: classifiedClusters.length,
                totalKeywords: classifiedClusters.reduce((s, c) => s + c.keywordCount, 0),
                llmVerified: classifiedClusters.filter(c => c.llmChecked).length,
                llmOverridden: classifiedClusters.filter(c => c.llmOverride).length,
                lowConfidence: classifiedClusters.filter(c => c.confidence < 60).length
            }
        });

    } catch (error) {
        console.error('Intent classification error:', error);
        console.error('Stack:', error instanceof Error ? error.stack : 'No stack');
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? `${error.message} - ${error.stack?.split('\n')[1]?.trim()}` : 'Classification failed'
        }, { status: 500 });
    }
}
