// POST /api/cms/templates/seed - Seed default system templates

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const SYSTEM_TEMPLATES = [
    {
        name: 'Blog Article',
        slug: 'blog-article',
        description: 'Standard blog article with hero, table of contents, body, FAQ, and author bio sections',
        type: 'blog',
        thumbnail: '/templates/blog-article.png',
        sections: [
            { id: 'hero', type: 'hero', title: 'Hero Section', required: true },
            { id: 'toc', type: 'toc', title: 'Table of Contents', required: false },
            { id: 'body', type: 'body', title: 'Main Content', required: true },
            { id: 'faq', type: 'faq', title: 'FAQ Section', required: false },
            { id: 'author', type: 'author', title: 'Author Bio', required: false },
            { id: 'related', type: 'related', title: 'Related Posts', required: false },
        ],
        styles: {
            maxWidth: '800px',
            fontFamily: 'Inter, sans-serif',
        },
    },
    {
        name: 'E-commerce Category',
        slug: 'ecommerce-category',
        description: 'Product category page with hero, filters, product grid, and reviews',
        type: 'ecommerce',
        thumbnail: '/templates/ecommerce-category.png',
        sections: [
            { id: 'hero', type: 'hero', title: 'Category Hero', required: true },
            { id: 'filters', type: 'filters', title: 'Product Filters', required: false },
            { id: 'product_grid', type: 'product_grid', title: 'Product Grid', required: true },
            { id: 'category_desc', type: 'category_desc', title: 'Category Description', required: false },
            { id: 'reviews', type: 'reviews', title: 'Customer Reviews', required: false },
        ],
        styles: {
            maxWidth: '1200px',
            gridColumns: 4,
        },
    },
    {
        name: 'Landing Page',
        slug: 'landing-page',
        description: 'Conversion-focused landing page with hero, features, testimonials, and CTA',
        type: 'landing',
        thumbnail: '/templates/landing-page.png',
        sections: [
            { id: 'hero', type: 'hero', title: 'Hero with CTA', required: true },
            { id: 'features', type: 'features', title: 'Features Grid', required: false },
            { id: 'testimonials', type: 'testimonials', title: 'Testimonials', required: false },
            { id: 'pricing', type: 'pricing', title: 'Pricing Table', required: false },
            { id: 'cta', type: 'cta', title: 'Call to Action', required: true },
        ],
        styles: {
            maxWidth: '1000px',
        },
    },
    {
        name: 'Comparison Article',
        slug: 'comparison-article',
        description: 'Product or service comparison with table, pros/cons, and winner section',
        type: 'comparison',
        thumbnail: '/templates/comparison.png',
        sections: [
            { id: 'hero', type: 'hero', title: 'Comparison Hero', required: true },
            { id: 'overview', type: 'body', title: 'Overview', required: true },
            { id: 'comparison_table', type: 'comparison_table', title: 'Comparison Table', required: true },
            { id: 'detailed', type: 'body', title: 'Detailed Analysis', required: false },
            { id: 'winner', type: 'winner', title: 'Winner Section', required: false },
            { id: 'faq', type: 'faq', title: 'FAQ', required: false },
        ],
        styles: {
            maxWidth: '900px',
        },
    },
    {
        name: 'Glossary Term',
        slug: 'glossary-term',
        description: 'Definition-style page for glossary or knowledge base entries',
        type: 'glossary',
        thumbnail: '/templates/glossary.png',
        sections: [
            { id: 'term', type: 'term', title: 'Term Definition', required: true },
            { id: 'explanation', type: 'body', title: 'Detailed Explanation', required: true },
            { id: 'examples', type: 'examples', title: 'Examples', required: false },
            { id: 'related_terms', type: 'related_terms', title: 'Related Terms', required: false },
        ],
        styles: {
            maxWidth: '700px',
        },
    },
];

export async function POST() {
    try {
        const results = [];

        for (const template of SYSTEM_TEMPLATES) {
            const result = await (prisma.cmsTemplate as any).upsert({
                where: { slug: template.slug },
                update: {
                    name: template.name,
                    description: template.description,
                    type: template.type,
                    thumbnail: template.thumbnail,
                    sections: template.sections,
                    styles: template.styles,
                    isSystem: true,
                    isActive: true,
                },
                create: {
                    ...template,
                    isSystem: true,
                    isActive: true,
                },
            });
            results.push({ id: result.id, name: result.name, slug: result.slug });
        }

        return NextResponse.json({
            success: true,
            seeded: results.length,
            templates: results,
        });
    } catch (error) {
        console.error('CMS Templates Seed error:', error);
        return NextResponse.json(
            { error: 'Failed to seed templates' },
            { status: 500 }
        );
    }
}

