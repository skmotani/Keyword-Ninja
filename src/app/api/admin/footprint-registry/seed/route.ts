// Footprint Registry - Seed Default Surfaces

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// Default surface registry entries
const DEFAULT_SURFACES = [
    // ... (lines 8-364 implied unchanged, not replacing them)
    // We only need to replace the import section and the map function section.
    // But replace_file_content needs contiguous block. The map function is at the end. Import is at the start.
    // I can do in two chunks or use multi_replace.
    // Let's use multi_replace since I need to add import AND change the map loop.

    // ============ OWNED ============
    {
        surfaceKey: 'WEBSITE',
        label: 'Website Reachable',
        category: 'owned',
        importanceTier: 'CRITICAL',
        basePoints: 18,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'HTTP 200 response with valid HTML content and SSL certificate',
        presenceRules: { present: 'HTTP 200 + SSL', partial: 'HTTP 200 no SSL', absent: 'No response or error' },
        tooltipTemplates: {
            why: 'Your website is the foundation of your online presence.',
            how: 'Direct HTTP request to domain with SSL verification.',
            actionPresent: 'Ensure fast load times and mobile responsiveness.',
            actionAbsent: 'Set up a professional website immediately.',
        },
        officialnessRequired: false,
        evidenceFields: ['url', 'httpStatus', 'hasSSL', 'title'],
    },
    {
        surfaceKey: 'SCHEMA_ORG',
        label: 'Schema.org Markup',
        category: 'owned',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'JSON-LD or Microdata schema blocks with Organization/LocalBusiness type',
        presenceRules: { present: 'Organization schema found', partial: 'Other schema types only', absent: 'No schema' },
        tooltipTemplates: {
            why: 'Structured data helps search engines understand your business.',
            how: 'Parse HTML for JSON-LD and Microdata blocks.',
            actionAbsent: 'Add Organization schema to your homepage.',
        },
        officialnessRequired: false,
    },
    {
        surfaceKey: 'ROBOTS_TXT',
        label: 'Robots.txt Present',
        category: 'owned',
        importanceTier: 'LOW',
        basePoints: 2,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'Valid robots.txt file at /robots.txt',
        officialnessRequired: false,
    },
    {
        surfaceKey: 'SITEMAP_XML',
        label: 'Sitemap.xml Present',
        category: 'owned',
        importanceTier: 'LOW',
        basePoints: 2,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'Valid XML sitemap at /sitemap.xml or referenced in robots.txt',
        officialnessRequired: false,
    },

    // ============ SEARCH ============
    {
        surfaceKey: 'GOOGLE_ORGANIC_BRAND',
        label: 'Google Brand Search',
        category: 'search',
        importanceTier: 'CRITICAL',
        basePoints: 10,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['"{brand}"', '{brand} {industry}', '{brand} official site'],
        maxQueries: 2,
        confirmationArtifact: 'Brand website appears in top 3 organic results for brand name query',
        presenceRules: { present: 'Domain in top 3', partial: 'Domain in top 10', absent: 'Not found' },
        tooltipTemplates: {
            why: 'Brand searches show intent - customers looking specifically for you.',
            actionAbsent: 'Improve SEO and build brand awareness.',
        },
        evidenceFields: ['url', 'title', 'snippet', 'position'],
    },
    {
        surfaceKey: 'GOOGLE_NEWS_MENTIONS',
        label: 'Google News Mentions',
        category: 'search',
        importanceTier: 'HIGH',
        basePoints: 6,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['{brand} news', '{brand} announcement', '{brand} press release'],
        confirmationArtifact: 'News articles mentioning brand from reputable sources',
        officialnessRequired: false,
    },
    {
        surfaceKey: 'GOOGLE_IMAGES_BRAND',
        label: 'Google Images',
        category: 'search',
        importanceTier: 'LOW',
        basePoints: 2,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['{brand} logo', '{brand} products'],
        confirmationArtifact: 'Brand images appear in image search results',
        officialnessRequired: false,
    },
    {
        surfaceKey: 'GOOGLE_AUTOCOMPLETE',
        label: 'Google Autocomplete',
        category: 'search',
        importanceTier: 'MEDIUM',
        basePoints: 3,
        sourceType: 'DATAFORSEO_AUTOCOMPLETE',
        searchEngine: 'google',
        queryTemplates: ['{brand}'],
        confirmationArtifact: 'Brand name appears in autocomplete suggestions',
        officialnessRequired: false,
        evidenceFields: ['suggestion'],
    },
    {
        surfaceKey: 'BING_ORGANIC_BRAND',
        label: 'Bing Brand Search',
        category: 'search',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'bing',
        queryTemplates: ['"{brand}"', '{brand} official'],
        confirmationArtifact: 'Brand website in top 10 Bing results',
    },

    // ============ SOCIAL ============
    {
        surfaceKey: 'LINKEDIN_COMPANY',
        label: 'LinkedIn Company Page',
        category: 'social',
        importanceTier: 'CRITICAL',
        basePoints: 10,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:linkedin.com/company "{brand}"', '{brand} linkedin'],
        confirmationArtifact: 'LinkedIn company page URL with matching brand name',
        tooltipTemplates: {
            why: 'LinkedIn is essential for B2B credibility and recruitment.',
            actionAbsent: 'Create a LinkedIn Company Page and keep it updated.',
        },
        evidenceFields: ['url', 'title'],
    },
    {
        surfaceKey: 'YOUTUBE_CHANNEL',
        label: 'YouTube Channel',
        category: 'video',
        importanceTier: 'HIGH',
        basePoints: 8,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:youtube.com "{brand}"', '{brand} youtube channel'],
        confirmationArtifact: 'YouTube channel URL with brand name',
        tooltipTemplates: {
            why: 'Video content builds trust and increases engagement.',
            actionAbsent: 'Create a YouTube channel with product demos or tutorials.',
        },
    },
    {
        surfaceKey: 'FACEBOOK_PAGE',
        label: 'Facebook Page',
        category: 'social',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:facebook.com "{brand}"'],
        confirmationArtifact: 'Facebook business page with matching brand',
    },
    {
        surfaceKey: 'INSTAGRAM_PROFILE',
        label: 'Instagram Profile',
        category: 'social',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:instagram.com "{brand}"'],
        confirmationArtifact: 'Instagram profile with brand name',
    },
    {
        surfaceKey: 'X_PROFILE',
        label: 'X (Twitter) Profile',
        category: 'social',
        importanceTier: 'MEDIUM',
        basePoints: 3,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:x.com "{brand}"', 'site:twitter.com "{brand}"'],
        confirmationArtifact: 'X/Twitter profile with brand handle',
    },
    {
        surfaceKey: 'PINTEREST_PROFILE',
        label: 'Pinterest Profile',
        category: 'social',
        importanceTier: 'LOW',
        basePoints: 2,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:pinterest.com "{brand}"'],
        confirmationArtifact: 'Pinterest profile or boards with brand',
        industryOverrides: { 'home_decor': 1.0, 'fashion': 1.0, 'b2b_manufacturing': 0.2 },
    },

    // ============ COMMUNITY ============
    {
        surfaceKey: 'REDDIT_MENTIONS',
        label: 'Reddit Mentions',
        category: 'community',
        importanceTier: 'LOW',
        basePoints: 2,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:reddit.com "{brand}"'],
        confirmationArtifact: 'Reddit posts or comments mentioning brand',
        officialnessRequired: false,
    },
    {
        surfaceKey: 'QUORA_MENTIONS',
        label: 'Quora Mentions',
        category: 'community',
        importanceTier: 'LOW',
        basePoints: 2,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:quora.com "{brand}"'],
        confirmationArtifact: 'Quora questions or answers mentioning brand',
        officialnessRequired: false,
    },

    // ============ TRUST ============
    {
        surfaceKey: 'GBP_LISTING',
        label: 'Google Business Profile',
        category: 'trust',
        importanceTier: 'CRITICAL',
        basePoints: 10,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['{brand} {city}', '{brand} near me'],
        confirmationArtifact: 'Google Maps/Business listing with verified business',
        tooltipTemplates: {
            why: 'GBP is essential for local discovery and credibility.',
            actionAbsent: 'Claim and verify your Google Business Profile.',
        },
        geoOverrides: { 'local': 1.0, 'regional': 0.8, 'global': 0.3 },
    },
    {
        surfaceKey: 'TRUSTPILOT_PROFILE',
        label: 'Trustpilot Profile',
        category: 'trust',
        importanceTier: 'HIGH',
        basePoints: 5,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:trustpilot.com "{brand}"', '{brand} trustpilot reviews'],
        confirmationArtifact: 'Trustpilot business profile with reviews',
    },
    {
        surfaceKey: 'G2_PROFILE',
        label: 'G2 Profile',
        category: 'trust',
        importanceTier: 'HIGH',
        basePoints: 5,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:g2.com "{brand}"'],
        confirmationArtifact: 'G2 product listing with reviews',
        industryOverrides: { 'saas': 1.0, 'software': 1.0, 'retail': 0.1 },
    },
    {
        surfaceKey: 'CAPTERRA_PROFILE',
        label: 'Capterra Profile',
        category: 'trust',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:capterra.com "{brand}"'],
        confirmationArtifact: 'Capterra software listing',
        industryOverrides: { 'saas': 1.0, 'software': 1.0 },
    },

    // ============ AUTHORITY ============
    {
        surfaceKey: 'CRUNCHBASE_PROFILE',
        label: 'Crunchbase Profile',
        category: 'authority',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:crunchbase.com "{brand}"'],
        confirmationArtifact: 'Crunchbase company profile',
        industryOverrides: { 'startup': 1.0, 'tech': 0.8 },
    },
    {
        surfaceKey: 'WIKIPEDIA_PAGE',
        label: 'Wikipedia Page',
        category: 'authority',
        importanceTier: 'HIGH',
        basePoints: 8,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:wikipedia.org "{brand}"'],
        confirmationArtifact: 'Wikipedia article about company or brand',
        tooltipTemplates: {
            why: 'Wikipedia presence indicates notable brand recognition.',
            actionAbsent: 'Build notability through press coverage first.',
        },
    },

    // ============ MARKETPLACE ============
    {
        surfaceKey: 'INDIAMART_LISTING',
        label: 'IndiaMART Listing',
        category: 'marketplace',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:indiamart.com "{brand}"'],
        confirmationArtifact: 'IndiaMART supplier/product listing',
        geoOverrides: { 'india': 1.0, 'global': 0.2 },
        industryOverrides: { 'b2b_manufacturing': 1.0, 'wholesale': 1.0 },
    },
    {
        surfaceKey: 'ALIBABA_LISTING',
        label: 'Alibaba Listing',
        category: 'marketplace',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:alibaba.com "{brand}"'],
        confirmationArtifact: 'Alibaba supplier listing',
        industryOverrides: { 'b2b_manufacturing': 1.0, 'export': 1.0 },
    },

    // ============ TECHNICAL ============
    {
        surfaceKey: 'SPF_DKIM_DMARC',
        label: 'Email Authentication',
        category: 'technical',
        importanceTier: 'LOW',
        basePoints: 2,
        sourceType: 'DNS_LOOKUP',
        queryTemplates: [],
        confirmationArtifact: 'Valid SPF, DKIM, and DMARC DNS records',
        presenceRules: { present: 'All 3 present', partial: '1-2 present', absent: 'None' },
        officialnessRequired: false,
        enabled: false, // Disabled by default until DNS provider implemented
        notes: 'Requires DNS lookup capability. Enable when implemented.',
    },
];

// POST - Seed or reset to default surfaces
export async function POST() {
    try {
        // Delete all existing entries
        await prisma.footprintSurfaceRegistry.deleteMany();

        // Insert defaults
        const created = await prisma.footprintSurfaceRegistry.createMany({
            data: DEFAULT_SURFACES.map(s => {
                // Explicitly cast the source object to any to access optional properties safely
                const src = s as any;
                return {
                    surfaceKey: src.surfaceKey,
                    label: src.label,
                    category: src.category,
                    importanceTier: src.importanceTier,
                    basePoints: src.basePoints,
                    defaultRelevanceWeight: 1.0,
                    sourceType: src.sourceType,
                    searchEngine: src.searchEngine || null,
                    queryTemplates: (src.queryTemplates || []) as Prisma.InputJsonValue,
                    maxQueries: src.maxQueries || 2,
                    confirmationArtifact: src.confirmationArtifact,
                    presenceRules: src.presenceRules ? (src.presenceRules as Prisma.InputJsonValue) : Prisma.DbNull,
                    officialnessRules: src.officialnessRules ? (src.officialnessRules as Prisma.InputJsonValue) : Prisma.DbNull,
                    officialnessRequired: src.officialnessRequired ?? true,
                    evidenceFields: src.evidenceFields ? (src.evidenceFields as Prisma.InputJsonValue) : Prisma.DbNull,
                    tooltipTemplates: src.tooltipTemplates ? (src.tooltipTemplates as Prisma.InputJsonValue) : Prisma.DbNull,
                    enabled: src.enabled ?? true,
                    notes: src.notes || null,
                    industryOverrides: src.industryOverrides ? (src.industryOverrides as Prisma.InputJsonValue) : Prisma.DbNull,
                    geoOverrides: src.geoOverrides ? (src.geoOverrides as Prisma.InputJsonValue) : Prisma.DbNull,
                };
            }),
        });

        return NextResponse.json({
            success: true,
            message: `Seeded ${created.count} surfaces`,
            count: created.count,
        });
    } catch (error) {
        console.error('Failed to seed registry:', error);
        return NextResponse.json({ error: 'Failed to seed registry' }, { status: 500 });
    }
}
