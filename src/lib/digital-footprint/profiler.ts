// OpenAI Profiler - Generates business profile and surface relevance weights

import OpenAI from 'openai';
import { CrawlData } from './crawler';
import { getAllSurfaces } from './surfaces';

export interface BusinessProfile {
    brandName: string;
    brandVariants: string[];
    businessType: 'B2B' | 'B2C' | 'D2C' | 'Marketplace' | 'SaaS' | 'Services' | 'Other';
    industry: string;
    geoScope: 'local' | 'national' | 'global';
    surfaceWeights: Record<string, number>;  // 0-1 weight per surface key
    notes: string;
    confidence: 'high' | 'medium' | 'low';
}

const PROFILE_PROMPT = `You are analyzing a business to determine their digital presence strategy.

Given the website data and domain, generate a business profile JSON.

Rules:
- brandName: The primary brand name (NOT the domain)
- brandVariants: 5-15 variations including abbreviations, common misspellings, product names
- businessType: One of B2B, B2C, D2C, Marketplace, SaaS, Services, Other
- industry: Specific industry (e.g., "Industrial Machinery", "Home Furniture", "IT Consulting")
- geoScope: local (city/region), national (one country), global
- surfaceWeights: For each surface, rate 0-1 based on relevance:
  - B2B machinery: LinkedIn high (0.9), YouTube medium (0.6), Pinterest very low (0.1)
  - Consumer products: Instagram high (0.8), Pinterest high (0.8), LinkedIn low (0.3)
  - Local services: GBP_REVIEWS high (1.0), national social media lower
- notes: Brief explanation of your reasoning
- confidence: Based on data quality

IMPORTANT: Pinterest should be LOW (0.1-0.2) for B2B/industrial, HIGH (0.7-0.9) for visual consumer products.

Return ONLY valid JSON, no markdown.`;

interface ProfileInput {
    domain: string;
    crawlData?: CrawlData;
    hints?: string;
}

export async function generateBusinessProfile(
    input: ProfileInput,
    openaiApiKey?: string
): Promise<BusinessProfile> {
    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
        // Fallback profile if no API key
        return generateFallbackProfile(input);
    }

    const openai = new OpenAI({ apiKey });

    const surfaces = getAllSurfaces();
    const surfaceList = surfaces.map(s => `${s.key}: ${s.label}`).join('\n');

    const contextParts = [
        `Domain: ${input.domain}`,
    ];

    if (input.crawlData) {
        if (input.crawlData.title) {
            contextParts.push(`Website Title: ${input.crawlData.title}`);
        }
        if (input.crawlData.metaDescription) {
            contextParts.push(`Meta Description: ${input.crawlData.metaDescription}`);
        }
        if (input.crawlData.brandSignals?.length) {
            contextParts.push(`Brand Signals: ${input.crawlData.brandSignals.map(b => b.value).join(', ')}`);
        }
        if (input.crawlData.schemaBlocks?.length) {
            contextParts.push(`Schema Types: ${input.crawlData.schemaBlocks.map(s => s.type).join(', ')}`);
        }
    }

    if (input.hints) {
        contextParts.push(`User Hints: ${input.hints}`);
    }

    contextParts.push(`\nSurfaces to weight (0-1):\n${surfaceList}`);

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: PROFILE_PROMPT },
                { role: 'user', content: contextParts.join('\n') },
            ],
            temperature: 0.3,
            max_tokens: 1000,
        });

        const content = completion.choices[0]?.message?.content || '';

        // Parse JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);

            // Ensure all surfaces have weights
            const surfaceWeights: Record<string, number> = {};
            for (const surface of surfaces) {
                surfaceWeights[surface.key] = parsed.surfaceWeights?.[surface.key] ?? 0.5;
            }

            return {
                brandName: parsed.brandName || extractBrandFromDomain(input.domain),
                brandVariants: parsed.brandVariants || [],
                businessType: parsed.businessType || 'Other',
                industry: parsed.industry || 'Unknown',
                geoScope: parsed.geoScope || 'national',
                surfaceWeights,
                notes: parsed.notes || '',
                confidence: parsed.confidence || 'medium',
            };
        }
    } catch (error) {
        console.error('OpenAI profile generation error:', error);
    }

    return generateFallbackProfile(input);
}

function generateFallbackProfile(input: ProfileInput): BusinessProfile {
    const brand = input.crawlData?.brandSignals?.[0]?.value || extractBrandFromDomain(input.domain);

    // Default weights (balanced)
    const surfaces = getAllSurfaces();
    const surfaceWeights: Record<string, number> = {};
    for (const surface of surfaces) {
        surfaceWeights[surface.key] = surface.defaultRelevance === 'high' ? 0.8 :
            surface.defaultRelevance === 'medium' ? 0.5 : 0.3;
    }

    return {
        brandName: brand,
        brandVariants: [brand],
        businessType: 'Other',
        industry: 'Unknown',
        geoScope: 'national',
        surfaceWeights,
        notes: 'Fallback profile generated without AI analysis',
        confidence: 'low',
    };
}

function extractBrandFromDomain(domain: string): string {
    // Extract brand from domain (e.g., motani.com -> Motani)
    const parts = domain.split('.');
    const name = parts[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
}
