// CMS AI Content Generator

import OpenAI from 'openai';
import { buildBlogPrompt, BlogGenerationInput, BlogGenerationOutput } from './prompts/blog';
import { buildEcommercePrompt, EcommerceGenerationInput, EcommerceGenerationOutput } from './prompts/ecommerce';

export type ContentType = 'blog' | 'ecommerce';

export interface GenerationOptions {
    apiKey?: string;
    model?: string;
    temperature?: number;
}

export interface GenerationResult<T> {
    success: boolean;
    data?: T;
    error?: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

async function getOpenAIClient(apiKey?: string): Promise<OpenAI> {
    const key = apiKey || process.env.OPENAI_API_KEY;

    if (!key) {
        throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY in environment or pass it directly.');
    }

    return new OpenAI({ apiKey: key });
}

function cleanJsonResponse(response: string): string {
    // Remove markdown code blocks if present
    let cleaned = response.trim();
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
    }
    return cleaned.trim();
}

export async function generateBlogContent(
    input: BlogGenerationInput,
    options: GenerationOptions = {}
): Promise<GenerationResult<BlogGenerationOutput>> {
    try {
        const client = await getOpenAIClient(options.apiKey);
        const prompt = buildBlogPrompt(input);

        const response = await client.chat.completions.create({
            model: options.model || 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert SEO content writer. Always respond with valid JSON only, no markdown formatting.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: options.temperature ?? 0.7,
            max_tokens: 4000,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            return { success: false, error: 'Empty response from AI' };
        }

        const cleaned = cleanJsonResponse(content);
        const parsed = JSON.parse(cleaned) as BlogGenerationOutput;

        return {
            success: true,
            data: parsed,
            usage: {
                promptTokens: response.usage?.prompt_tokens || 0,
                completionTokens: response.usage?.completion_tokens || 0,
                totalTokens: response.usage?.total_tokens || 0,
            }
        };
    } catch (error) {
        console.error('Blog content generation error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}

export async function generateEcommerceContent(
    input: EcommerceGenerationInput,
    options: GenerationOptions = {}
): Promise<GenerationResult<EcommerceGenerationOutput>> {
    try {
        const client = await getOpenAIClient(options.apiKey);
        const prompt = buildEcommercePrompt(input);

        const response = await client.chat.completions.create({
            model: options.model || 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert e-commerce SEO content writer. Always respond with valid JSON only, no markdown formatting.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: options.temperature ?? 0.7,
            max_tokens: 3000,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            return { success: false, error: 'Empty response from AI' };
        }

        const cleaned = cleanJsonResponse(content);
        const parsed = JSON.parse(cleaned) as EcommerceGenerationOutput;

        return {
            success: true,
            data: parsed,
            usage: {
                promptTokens: response.usage?.prompt_tokens || 0,
                completionTokens: response.usage?.completion_tokens || 0,
                totalTokens: response.usage?.total_tokens || 0,
            }
        };
    } catch (error) {
        console.error('E-commerce content generation error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}

export async function regenerateSection(
    contentType: ContentType,
    section: string,
    currentContent: string,
    input: BlogGenerationInput | EcommerceGenerationInput,
    instructions?: string,
    options: GenerationOptions = {}
): Promise<GenerationResult<unknown>> {
    try {
        const client = await getOpenAIClient(options.apiKey);

        let prompt: string;
        if (contentType === 'blog') {
            const { buildBlogRegenerationPrompt } = await import('./prompts/blog');
            prompt = buildBlogRegenerationPrompt(
                section as 'hero' | 'body' | 'faqs',
                currentContent,
                input as BlogGenerationInput,
                instructions
            );
        } else {
            const { buildEcommerceRegenerationPrompt } = await import('./prompts/ecommerce');
            prompt = buildEcommerceRegenerationPrompt(
                section as 'hero' | 'categoryDescription' | 'faqs',
                currentContent,
                input as EcommerceGenerationInput,
                instructions
            );
        }

        const response = await client.chat.completions.create({
            model: options.model || 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert content writer. Respond with the requested format only.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: options.temperature ?? 0.7,
            max_tokens: 2000,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            return { success: false, error: 'Empty response from AI' };
        }

        // Try to parse as JSON, otherwise return as string
        try {
            const cleaned = cleanJsonResponse(content);
            const parsed = JSON.parse(cleaned);
            return {
                success: true,
                data: parsed,
                usage: {
                    promptTokens: response.usage?.prompt_tokens || 0,
                    completionTokens: response.usage?.completion_tokens || 0,
                    totalTokens: response.usage?.total_tokens || 0,
                }
            };
        } catch {
            // Return as string (for body content)
            return {
                success: true,
                data: content,
                usage: {
                    promptTokens: response.usage?.prompt_tokens || 0,
                    completionTokens: response.usage?.completion_tokens || 0,
                    totalTokens: response.usage?.total_tokens || 0,
                }
            };
        }
    } catch (error) {
        console.error('Section regeneration error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
