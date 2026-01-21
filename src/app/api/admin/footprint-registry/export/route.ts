// Footprint Registry - Export API

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// SEO meaning descriptions for each surface type (same as frontend)
function getSurfaceSeoMeaning(surfaceKey: string, label: string, category: string): string {
    const key = surfaceKey.toLowerCase();
    const labelLower = label.toLowerCase();

    const meanings: Record<string, string> = {
        'linkedin': 'Professional network presence. Builds B2B trust, showcases expertise, enables employee advocacy.',
        'facebook': 'Social proof and community engagement. Affects local SEO, enables reviews.',
        'twitter': 'Real-time brand presence. Tweets can appear in search results.',
        'instagram': 'Visual brand identity. High engagement rates, influences younger demographics.',
        'youtube': 'Video SEO powerhouse. 2nd largest search engine. Videos rank in Google.',
        'pinterest': 'Visual discovery engine. Drives referral traffic, especially for lifestyle brands.',
        'tiktok': 'Emerging search behavior. Gen Z uses TikTok for search.',
        'whatsapp': 'High-conversion contact surface; supports lead capture and customer trust.',
        'google': 'Core search visibility indicator. Fundamental to organic traffic.',
        'gbp': 'Google Business Profile. Critical for local SEO and map pack rankings.',
        'bing': 'Secondary search engine. Powers Yahoo search.',
        'knowledge_panel': 'Brand entity surface; impacts brand SERP trust and AI/LLM understanding.',
        'maps_pack': 'Local brand discovery surface; supports trust and navigation.',
        'wikipedia': 'Highest authority backlink. Wikipedia citations signal notable entity.',
        'wikidata': 'Structured entity graph for machines/LLMs.',
        'trustpilot': 'Third-party review platform. Star ratings appear as rich snippets.',
        'g2': 'B2B software review platform. Reviews affect buyer decisions.',
        'clutch': 'Third-party validation for B2B services.',
        'bbb': 'Better Business Bureau. Trust signal for US consumers.',
        'glassdoor': 'Employer reputation. Affects recruiting and brand perception.',
        'crunchbase': 'Business data authority. Shows company legitimacy.',
        'reddit': 'Community discussions. Reddit threads rank for long-tail queries.',
        'quora': 'Q&A platform. Answers rank for question-based searches.',
        'website': 'Core web presence. Foundation of all SEO.',
        'ssl': 'HTTPS security. Google ranking factor since 2014.',
        'schema': 'Structured data markup. Enables rich snippets in search results.',
        'sitemap': 'XML Sitemap. Helps search engines discover pages.',
        'gsc': 'Proof of site ownership + indexing diagnostics.',
        'perplexity': 'AI search engine. Citations drive referral traffic.',
        'chatgpt': 'AI assistant mentions. Affects brand discovery and trust.',
        'core_web_vitals': 'Performance UX baseline; impacts rankings.',
        'cwv': 'Performance UX baseline; impacts rankings.',
        'dmarc': 'Email domain trust; reduces spoofing.',
    };

    for (const [keyword, meaning] of Object.entries(meanings)) {
        if (key.includes(keyword) || labelLower.includes(keyword)) {
            return meaning;
        }
    }

    const categoryMeanings: Record<string, string> = {
        'owned': 'Owned media asset. Direct control over content.',
        'search': 'Search engine visibility. Direct impact on organic traffic.',
        'social': 'Social media presence. Builds community and engagement.',
        'video': 'Video content presence. High engagement format.',
        'community': 'Community platform presence.',
        'trust': 'Trust signal platform. Third-party validation.',
        'authority': 'Authority indicator. Signals credibility.',
        'marketplace': 'Marketplace presence. Reaches buyers.',
        'technical': 'Technical SEO foundation.',
        'ai': 'AI platform presence.',
        'aeo': 'Answer Engine Optimization.',
        'performance_security': 'Performance and security signals.',
        'eeat_entity': 'E-E-A-T + Entity signals.',
    };

    return categoryMeanings[category] || 'Digital footprint surface.';
}

// GET - Export all surfaces as JSON or CSV
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const format = searchParams.get('format') || 'json';

        const surfaces = await prisma.footprintSurfaceRegistry.findMany({
            orderBy: [
                { category: 'asc' },
                { importanceTier: 'asc' },
                { surfaceKey: 'asc' },
            ],
        });

        if (format === 'csv') {
            // Generate Excel-compatible CSV matching ALL table columns
            // Table columns: On, Key, Label, Cat, Est, Imp, Why It Matters, Pts, Src
            const headers = [
                'On', 'Key', 'Label', 'Cat', 'Est', 'Imp', 'Why It Matters', 'Pts', 'Src',
            ];

            const escapeCSV = (val: string | null | undefined): string => {
                if (val === null || val === undefined) return '';
                const str = String(val);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            };

            const rows = surfaces.map(s => [
                s.enabled ? 'Yes' : 'No',                                           // On
                s.surfaceKey,                                                        // Key
                escapeCSV(s.label),                                                  // Label
                s.category,                                                          // Cat
                s.launchYear || '',                                                  // Est
                s.importanceTier,                                                    // Imp
                escapeCSV(getSurfaceSeoMeaning(s.surfaceKey, s.label, s.category)), // Why It Matters
                s.basePoints,                                                        // Pts
                s.sourceType,                                                        // Src
            ].join(','));

            // Add BOM for Excel UTF-8 compatibility
            const BOM = '\uFEFF';
            const csv = BOM + [headers.join(','), ...rows].join('\n');

            return new NextResponse(csv, {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': 'attachment; filename="footprint-registry.csv"',
                },
            });
        }

        // Default: JSON
        return NextResponse.json(surfaces, {
            headers: {
                'Content-Disposition': 'attachment; filename="footprint-registry.json"',
            },
        });

    } catch (error) {
        console.error('Export failed:', error);
        return NextResponse.json({ error: 'Export failed' }, { status: 500 });
    }
}
