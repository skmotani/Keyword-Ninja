/**
 * LLM Intent Confirmation API
 * POST /api/intent/llm-confirm
 * 
 * Manual LLM verification for a single cluster
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { generateLLMPrompt, ClusterIntentResult } from '@/lib/intentEngine';

// Lazy initialization of OpenAI client
let openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
    if (!openai) {
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openai;
}

const getResultsPath = (clientCode: string) =>
    path.join(process.cwd(), 'src', 'lib', `intent_results_${clientCode}.json`);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { clientCode, clusterId, cluster }: {
            clientCode: string;
            clusterId: string;
            cluster: ClusterIntentResult;
        } = body;

        if (!clientCode || !clusterId || !cluster) {
            return NextResponse.json({
                success: false,
                error: 'clientCode, clusterId, and cluster required'
            }, { status: 400 });
        }

        // Generate LLM prompt
        const { systemPrompt, userPrompt } = generateLLMPrompt(cluster);

        // Call OpenAI
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
        if (!content) {
            return NextResponse.json({
                success: false,
                error: 'No response from LLM'
            }, { status: 500 });
        }

        const llmResult = JSON.parse(content) as {
            primary_intent: string;
            secondary_intent: string | null;
            confidence_adjustment: number;
            notes: string;
        };

        // Update stored results if they exist
        try {
            const resultsPath = getResultsPath(clientCode);
            const data = await fs.readFile(resultsPath, 'utf-8');
            const results = JSON.parse(data);

            const idx = results.clusters.findIndex((c: ClusterIntentResult) => c.clusterId === clusterId);
            if (idx !== -1) {
                const original = results.clusters[idx];
                const override = llmResult.primary_intent !== original.intentPrimary;

                results.clusters[idx] = {
                    ...original,
                    intentPrimary: override ? llmResult.primary_intent : original.intentPrimary,
                    intentSecondary: llmResult.secondary_intent,
                    confidence: Math.max(0, Math.min(100, original.confidence + llmResult.confidence_adjustment)),
                    llmChecked: true,
                    llmOverride: override,
                    llmNotes: llmResult.notes
                };

                await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
            }
        } catch {
            // Results file doesn't exist, that's ok
        }

        return NextResponse.json({
            success: true,
            data: {
                clusterId,
                llmResult,
                override: llmResult.primary_intent !== cluster.intentPrimary
            }
        });

    } catch (error) {
        console.error('LLM confirmation error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'LLM confirmation failed'
        }, { status: 500 });
    }
}
