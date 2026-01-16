// POST /api/cms/generate - Generate AI content for CMS pages

import { NextRequest, NextResponse } from 'next/server';
import {
    generateBlogContent,
    generateEcommerceContent,
    regenerateSection,
    BlogGenerationInput,
    EcommerceGenerationInput,
} from '@/lib/cms/ai';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            type,          // 'blog' | 'ecommerce'
            action,        // 'generate' | 'regenerate'
            section,       // For regenerate: 'hero' | 'body' | 'faqs' | 'categoryDescription'
            currentContent,// For regenerate: current section content
            instructions,  // For regenerate: user instructions
            topic,
            primaryKeyword,
            keywords,
            searchVolume,
            intentType,
            clientInfo,
            apiKey,        // Optional: custom API key
        } = body;

        // Validate required fields
        if (!type || !action) {
            return NextResponse.json(
                { error: 'Missing required fields: type, action' },
                { status: 400 }
            );
        }

        if (!topic || !primaryKeyword) {
            return NextResponse.json(
                { error: 'Missing required fields: topic, primaryKeyword' },
                { status: 400 }
            );
        }

        // Build input object
        const input: BlogGenerationInput | EcommerceGenerationInput = {
            topic,
            primaryKeyword,
            keywords: keywords || [],
            searchVolume: searchVolume || 0,
            intentType: intentType || 'informational',
            clientInfo: clientInfo || {
                name: 'Company',
                industry: 'General',
                tone: 'Professional',
            },
        };

        // Handle regeneration
        if (action === 'regenerate') {
            if (!section) {
                return NextResponse.json(
                    { error: 'Section is required for regeneration' },
                    { status: 400 }
                );
            }

            const result = await regenerateSection(
                type,
                section,
                currentContent || '',
                input,
                instructions,
                { apiKey }
            );

            if (!result.success) {
                return NextResponse.json(
                    { error: result.error || 'Regeneration failed' },
                    { status: 500 }
                );
            }

            return NextResponse.json({
                success: true,
                section,
                data: result.data,
                usage: result.usage,
            });
        }

        // Handle full page generation
        let result;
        if (type === 'blog') {
            result = await generateBlogContent(input as BlogGenerationInput, { apiKey });
        } else if (type === 'ecommerce') {
            result = await generateEcommerceContent(input as EcommerceGenerationInput, { apiKey });
        } else {
            return NextResponse.json(
                { error: 'Invalid type. Must be "blog" or "ecommerce"' },
                { status: 400 }
            );
        }

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || 'Generation failed' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            type,
            data: result.data,
            usage: result.usage,
        });
    } catch (error) {
        console.error('CMS Generate API Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
