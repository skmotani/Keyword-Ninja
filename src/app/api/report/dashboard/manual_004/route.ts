// API: MANUAL_004 - Top 3 Surfaces by Category from Footprint Registry
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Top3SurfacesByCategoryData } from '@/types/dashboardTypes';

// SEO meaning descriptions
function getSurfaceSeoMeaning(surfaceKey: string, label: string, category: string): string {
    const key = surfaceKey.toLowerCase();
    const labelLower = label.toLowerCase();

    const meanings: Record<string, string> = {
        'linkedin': 'Professional network presence. Builds B2B trust.',
        'facebook': 'Social proof and community engagement.',
        'twitter': 'Real-time brand presence in search results.',
        'instagram': 'Visual brand identity, high engagement.',
        'youtube': 'Video SEO powerhouse, 2nd largest search engine.',
        'google': 'Core search visibility indicator.',
        'gbp': 'Google Business Profile, critical for local SEO.',
        'knowledge_panel': 'Brand entity surface for SERP trust.',
        'wikipedia': 'Highest authority backlink.',
        'wikidata': 'Structured entity graph for AI/LLMs.',
        'website': 'Core web presence, foundation of SEO.',
        'schema': 'Structured data for rich snippets.',
        'gsc': 'Site ownership + indexing diagnostics.',
        'perplexity': 'AI search engine citations.',
        'chatgpt': 'AI assistant brand mentions.',
        'trustpilot': 'Third-party review platform.',
        'g2': 'B2B software review platform.',
        'glassdoor': 'Employer reputation platform.',
        'reddit': 'Community discussions rank for long-tail.',
        'quora': 'Q&A answers rank for questions.',
        'ssl': 'HTTPS security ranking factor.',
        'sitemap': 'Page discovery for search engines.',
        'dmarc': 'Email domain trust.',
        'core_web_vitals': 'Performance impacts rankings.',
        'cwv': 'Performance impacts rankings.',
        'faq': 'Rich results and AEO opportunities.',
        'sameas': 'Entity reconciliation for Google + LLMs.',
        'author': 'Expert credibility for E-E-A-T.',
        'case_studies': 'Experience proof for B2B trust.',
    };

    for (const [keyword, meaning] of Object.entries(meanings)) {
        if (key.includes(keyword) || labelLower.includes(keyword)) {
            return meaning;
        }
    }

    const categoryMeanings: Record<string, string> = {
        'owned': 'Owned media asset. Direct control.',
        'search': 'Search engine visibility.',
        'social': 'Social media presence.',
        'video': 'Video content presence.',
        'community': 'Community platform presence.',
        'trust': 'Trust signal platform.',
        'authority': 'Authority indicator.',
        'marketplace': 'Marketplace presence.',
        'technical': 'Technical SEO foundation.',
        'ai': 'AI platform presence.',
        'aeo': 'Answer Engine Optimization.',
        'performance_security': 'Performance and security.',
        'eeat_entity': 'E-E-A-T + Entity signals.',
    };

    return categoryMeanings[category] || 'Digital footprint surface.';
}

// Category labels mapping
const CATEGORY_LABELS: Record<string, string> = {
    'owned': 'Owned Properties',
    'search': 'Search Presence',
    'social': 'Social Media',
    'video': 'Video Platforms',
    'community': 'Community & Forums',
    'trust': 'Trust & Reviews',
    'authority': 'Authority Signals',
    'marketplace': 'Marketplaces',
    'technical': 'Technical SEO',
    'ai': 'AI Platforms',
    'aeo': 'Answer Engine Optimization',
    'performance_security': 'Performance & Security',
    'eeat_entity': 'E-E-A-T & Entity',
};

// Importance tier display mapping
const IMPORTANCE_DISPLAY: Record<string, string> = {
    'CRITICAL': 'Critical',
    'HIGH': 'High',
    'MEDIUM': 'Medium',
    'LOW': 'Low',
};

export async function GET() {
    try {
        // Fetch all enabled surfaces ordered by points
        const surfaces = await (prisma.footprintSurfaceRegistry as any).findMany({
            where: { enabled: true },
            orderBy: { basePoints: 'desc' },
            select: {
                surfaceKey: true,
                label: true,
                category: true,
                importanceTier: true,
                basePoints: true,
            },
        });

        // Group by category and take top 3 from each
        const categoryGroups: Record<string, typeof surfaces> = {};
        for (const surface of surfaces) {
            if (!categoryGroups[surface.category]) {
                categoryGroups[surface.category] = [];
            }
            if (categoryGroups[surface.category].length < 3) {
                categoryGroups[surface.category].push(surface);
            }
        }

        // Build result structure
        const categories = Object.entries(categoryGroups)
            .filter(([, items]) => items.length > 0)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, items]) => ({
                category,
                categoryLabel: CATEGORY_LABELS[category] || category,
                surfaces: items.map(s => ({
                    label: s.label,
                    importance: IMPORTANCE_DISPLAY[s.importanceTier] || s.importanceTier,
                    points: s.basePoints,
                    whyItMatters: getSurfaceSeoMeaning(s.surfaceKey, s.label, s.category),
                })),
            }));

        const result: Top3SurfacesByCategoryData = {
            categories,
            summary: {
                totalCategories: categories.length,
                totalSurfaces: categories.reduce((sum, c) => sum + c.surfaces.length, 0),
                totalPoints: categories.reduce((sum, c) =>
                    sum + c.surfaces.reduce((s, surf) => s + surf.points, 0), 0),
            },
        };

        return NextResponse.json(result);
    } catch (error) {
        console.error('MANUAL_004 API error:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}

