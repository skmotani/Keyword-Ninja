/**
 * API: POST /api/keywords/page-intent-analysis/fetch
 * 
 * Fetches sitemap URLs for selected domains and classifies them using OpenAI.
 * Persists results to page-level and domain-level storage.
 */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { fetchSitemapUrls } from '@/lib/sitemapFetcher';
import { upsertSummary, bulkUpsertPages } from '@/lib/storage/pageIntentStore';
import { getActiveCredentialByService } from '@/lib/apiCredentialsStore';
import {
    PageIntentBucket,
    PageIntentDetail,
    PageIntentDomainSummary,
    PageIntentFetchResult,
    PAGE_INTENT_BUCKETS
} from '@/types/pageIntent';

const BATCH_SIZE = 50; // URLs per OpenAI call

// Default prompt template - {{BUCKET_DESCRIPTIONS}} and {{URLS}} are placeholders
const DEFAULT_INTENT_PROMPT = `You are an SEO expert analyzing website URLs to classify them into funnel stages.

Classify each URL into ONE of these intent buckets:
{{BUCKET_DESCRIPTIONS}}

Bucket Definitions:
1. problem_aware_solution_tofu - Pages addressing problems/pain points, "how to solve X" type content
2. educational_informational_tofu - Blog posts, guides, educational resources, general industry information
3. commercial_investigation_mofu - Comparison pages, reviews, "best X for Y", product research content
4. trust_proof_mofu - Case studies, testimonials, about us, certifications, awards
5. brand_navigation_bofu - Homepage, contact, locations, careers, press, company navigation
6. transactional_bofu - Product pages, pricing, buy now, checkout, cart, quote requests

Analyze these URLs and respond with a JSON array. Each object should have "url" and "intent" fields.
Only use the exact bucket codes listed above.

URLs to classify:
{{URLS}}

Respond ONLY with a valid JSON array, no other text:`;

interface FetchRequestBody {
    clientCode: string;
    domains: string[];
    customPrompt?: string; // Optional custom prompt template
}

/**
 * Get OpenAI API key from credentials store or environment
 */
async function getOpenAIApiKey(): Promise<string | null> {
    // Try to get credential from store first
    const credential = await getActiveCredentialByService('OPENAI');

    // Use stored key or fallback to env var
    const apiKey = credential?.apiKey || credential?.apiKeyMasked || process.env.OPENAI_API_KEY;

    if (!apiKey || apiKey.startsWith('****')) {
        // Double check if process.env has it if the stored one was masked
        if (!process.env.OPENAI_API_KEY) {
            return null;
        }
    }

    // Use the valid key (either from store or env)
    const finalApiKey = (credential?.apiKey && !credential.apiKey.startsWith('****'))
        ? credential.apiKey
        : process.env.OPENAI_API_KEY;

    return finalApiKey || null;
}

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        const body: FetchRequestBody = await request.json();
        const { clientCode, domains, customPrompt } = body;

        console.log(`[PageIntentFetch] POST request - clientCode: ${clientCode}, domains: ${domains?.length || 0}, customPrompt: ${customPrompt ? 'yes' : 'no'}`);


        // Validation
        if (!clientCode) {
            return NextResponse.json(
                { error: 'clientCode is required' },
                { status: 400 }
            );
        }

        if (!domains || !Array.isArray(domains) || domains.length === 0) {
            return NextResponse.json(
                { error: 'domains array is required and must not be empty' },
                { status: 400 }
            );
        }

        // Get OpenAI API key from credentials store
        const apiKey = await getOpenAIApiKey();
        if (!apiKey) {
            return NextResponse.json(
                { error: 'OpenAI API key not configured. Please set OPENAI_API_KEY in Settings → API Credentials.' },
                { status: 500 }
            );
        }

        const results: PageIntentFetchResult[] = [];
        const errors: string[] = [];

        // Process each domain
        for (const domain of domains) {
            console.log(`[PageIntentFetch] ===========================================`);
            console.log(`[PageIntentFetch] Processing domain: ${domain}`);

            try {
                // Step 1: Fetch sitemap URLs
                console.log(`[PageIntentFetch] Step 1: Calling fetchSitemapUrls for ${domain}...`);
                const sitemapResult = await fetchSitemapUrls(domain);

                console.log(`[PageIntentFetch] Sitemap result for ${domain}:`);
                console.log(`[PageIntentFetch]   - URLs found: ${sitemapResult.urls.length}`);
                console.log(`[PageIntentFetch]   - Errors: ${sitemapResult.errors.length > 0 ? sitemapResult.errors.join(', ') : 'none'}`);
                if (sitemapResult.urls.length > 0) {
                    console.log(`[PageIntentFetch]   - Sample URLs: ${sitemapResult.urls.slice(0, 3).join(', ')}`);
                }

                if (sitemapResult.urls.length === 0) {
                    console.log(`[PageIntentFetch] No URLs found for ${domain}`);
                    errors.push(`${domain}: No sitemap URLs found`);
                    results.push({
                        domain,
                        totalPages: 0,
                        problemAwareSolutionCount: 0,
                        educationalInformationalCount: 0,
                        commercialInvestigationCount: 0,
                        trustProofCount: 0,
                        brandNavigationCount: 0,
                        transactionalCount: 0,
                        error: 'No sitemap URLs found',
                    });
                    continue;
                }

                console.log(`[PageIntentFetch] Found ${sitemapResult.urls.length} URLs for ${domain}`);

                // Step 2: Classify URLs with OpenAI in batches
                const classifiedPages: PageIntentDetail[] = [];
                const urlBatches = chunkArray(sitemapResult.urls, BATCH_SIZE);

                for (let i = 0; i < urlBatches.length; i++) {
                    const batch = urlBatches[i];
                    console.log(`[PageIntentFetch] Classifying batch ${i + 1}/${urlBatches.length} (${batch.length} URLs)`);

                    try {
                        const classifications = await classifyUrlsWithOpenAI(batch, apiKey, customPrompt);

                        for (const classification of classifications) {
                            classifiedPages.push({
                                id: uuidv4(),
                                clientCode,
                                domain,
                                url: classification.url,
                                intent: classification.intent,
                                createdAt: new Date().toISOString(),
                            });
                        }
                    } catch (batchError) {
                        const errorMsg = batchError instanceof Error ? batchError.message : String(batchError);
                        console.error(`[PageIntentFetch] ❌ Batch ${i + 1} failed for ${domain}:`);
                        console.error(`[PageIntentFetch]    Error: ${errorMsg}`);
                        if (batchError instanceof Error && batchError.stack) {
                            console.error(`[PageIntentFetch]    Stack: ${batchError.stack.split('\n').slice(0, 3).join(' | ')}`);
                        }
                        errors.push(`${domain}: Batch ${i + 1} classification failed - ${errorMsg}`);
                    }
                }

                // Step 3: Aggregate counts
                const counts = aggregateCounts(classifiedPages);
                const totalPages = classifiedPages.length;

                // Step 4: Persist page-level data
                await bulkUpsertPages(classifiedPages);

                // Step 5: Persist domain summary
                const summary: PageIntentDomainSummary = {
                    id: uuidv4(),
                    clientCode,
                    domain,
                    totalPages,
                    ...counts,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                await upsertSummary(summary);

                results.push({
                    domain,
                    totalPages,
                    ...counts,
                });

                console.log(`[PageIntentFetch] Completed ${domain}: ${totalPages} pages classified`);
            } catch (domainError) {
                console.error(`[PageIntentFetch] Error processing ${domain}:`, domainError);
                errors.push(`${domain}: ${domainError instanceof Error ? domainError.message : 'Unknown error'}`);
                results.push({
                    domain,
                    totalPages: 0,
                    problemAwareSolutionCount: 0,
                    educationalInformationalCount: 0,
                    commercialInvestigationCount: 0,
                    trustProofCount: 0,
                    brandNavigationCount: 0,
                    transactionalCount: 0,
                    error: domainError instanceof Error ? domainError.message : 'Unknown error',
                });
            }
        }

        console.log(`[PageIntentFetch] Completed in ${Date.now() - startTime}ms`);

        return NextResponse.json({
            clientCode,
            results,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error) {
        console.error('[PageIntentFetch] Error:', error);
        return NextResponse.json(
            { error: 'Failed to process request', details: String(error) },
            { status: 500 }
        );
    }
}

/**
 * Classify URLs using OpenAI
 */
async function classifyUrlsWithOpenAI(
    urls: string[],
    openaiApiKey: string,
    customPromptTemplate?: string
): Promise<{ url: string; intent: PageIntentBucket }[]> {
    const bucketDescriptions = PAGE_INTENT_BUCKETS.map(b => `- ${b.code}: ${b.label}`).join('\n');
    const urlsList = urls.map((u, i) => `${i + 1}. ${u}`).join('\n');

    // Use custom prompt if provided, otherwise use default
    let prompt: string;
    if (customPromptTemplate) {
        // Replace placeholders in custom prompt
        prompt = customPromptTemplate
            .replace('{{BUCKET_DESCRIPTIONS}}', bucketDescriptions)
            .replace('{{URLS}}', urlsList);
    } else {
        // Use the default prompt template
        prompt = DEFAULT_INTENT_PROMPT
            .replace('{{BUCKET_DESCRIPTIONS}}', bucketDescriptions)
            .replace('{{URLS}}', urlsList);
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'user', content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 4000,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error('Empty response from OpenAI');
    }

    // Parse the JSON response
    try {
        // Extract JSON array from response (handle potential markdown code blocks)
        let jsonStr = content.trim();
        if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.slice(7);
        }
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.slice(3);
        }
        if (jsonStr.endsWith('```')) {
            jsonStr = jsonStr.slice(0, -3);
        }
        jsonStr = jsonStr.trim();

        const parsed = JSON.parse(jsonStr);

        // Validate and normalize the response
        const validBuckets = new Set(PAGE_INTENT_BUCKETS.map(b => b.code));
        const results: { url: string; intent: PageIntentBucket }[] = [];

        for (const item of parsed) {
            if (item.url && item.intent && validBuckets.has(item.intent)) {
                results.push({
                    url: item.url,
                    intent: item.intent as PageIntentBucket,
                });
            } else if (item.url) {
                // Default to educational if intent is invalid
                results.push({
                    url: item.url,
                    intent: 'educational_informational_tofu',
                });
            }
        }

        // If we got fewer results than URLs, fill in missing ones
        const resultUrlSet = new Set(results.map(r => r.url));
        for (const url of urls) {
            if (!resultUrlSet.has(url)) {
                results.push({
                    url,
                    intent: 'educational_informational_tofu',
                });
            }
        }

        return results;
    } catch (parseError) {
        console.error('[PageIntentFetch] Failed to parse OpenAI response:', content);
        throw new Error(`Failed to parse OpenAI response: ${parseError}`);
    }
}

/**
 * Aggregate intent counts from classified pages
 */
function aggregateCounts(pages: PageIntentDetail[]): {
    problemAwareSolutionCount: number;
    educationalInformationalCount: number;
    commercialInvestigationCount: number;
    trustProofCount: number;
    brandNavigationCount: number;
    transactionalCount: number;
} {
    const counts = {
        problemAwareSolutionCount: 0,
        educationalInformationalCount: 0,
        commercialInvestigationCount: 0,
        trustProofCount: 0,
        brandNavigationCount: 0,
        transactionalCount: 0,
    };

    for (const page of pages) {
        switch (page.intent) {
            case 'problem_aware_solution_tofu':
                counts.problemAwareSolutionCount++;
                break;
            case 'educational_informational_tofu':
                counts.educationalInformationalCount++;
                break;
            case 'commercial_investigation_mofu':
                counts.commercialInvestigationCount++;
                break;
            case 'trust_proof_mofu':
                counts.trustProofCount++;
                break;
            case 'brand_navigation_bofu':
                counts.brandNavigationCount++;
                break;
            case 'transactional_bofu':
                counts.transactionalCount++;
                break;
        }
    }

    return counts;
}

/**
 * Split array into chunks
 */
function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}
