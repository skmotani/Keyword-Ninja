// Surface Registry - Defines all surfaces for digital footprint audit
// This module can load from database registry OR fallback to hardcoded defaults

import { prisma } from '@/lib/prisma';

export type SurfaceCategory = 'owned' | 'search' | 'social' | 'video' | 'community' | 'trust' | 'authority' | 'marketplace' | 'technical' | 'ai';
export type SurfaceStatus = 'present' | 'partial' | 'absent' | 'unknown';
export type Relevance = 'high' | 'medium' | 'low';

export interface SurfaceDefinition {
    key: string;
    label: string;
    category: SurfaceCategory;
    basePoints: number;
    defaultRelevance: Relevance;
    queryTemplates: string[];
    sourceType: string;
    searchEngine?: string;
    maxQueries: number;
    confirmationArtifact?: string;
    officialnessRequired: boolean;
    tooltips: {
        why?: string;
        how?: string;
        actionPresent?: string;
        actionAbsent?: string;
    };
    industryOverrides?: Record<string, number>;
    geoOverrides?: Record<string, number>;
}

// Convert importance tier to relevance
function tierToRelevance(tier: string): Relevance {
    switch (tier) {
        case 'CRITICAL':
        case 'HIGH':
            return 'high';
        case 'MEDIUM':
            return 'medium';
        default:
            return 'low';
    }
}

// Load surfaces from database registry (enabled only)
export async function getSurfacesFromRegistry(): Promise<SurfaceDefinition[]> {
    try {
        const registrySurfaces = await (prisma.footprintSurfaceRegistry as any).findMany({
            where: { enabled: true },
            orderBy: [
                { importanceTier: 'asc' },
                { category: 'asc' },
            ],
        });

        return registrySurfaces.map(s => ({
            key: s.surfaceKey,
            label: s.label,
            category: s.category as SurfaceCategory,
            basePoints: s.basePoints,
            defaultRelevance: tierToRelevance(s.importanceTier),
            queryTemplates: (s.queryTemplates as string[]) || [],
            sourceType: s.sourceType,
            searchEngine: s.searchEngine || undefined,
            maxQueries: s.maxQueries,
            confirmationArtifact: s.confirmationArtifact,
            officialnessRequired: s.officialnessRequired,
            tooltips: (s.tooltipTemplates as Record<string, string>) || {},
            industryOverrides: s.industryOverrides as Record<string, number> | undefined,
            geoOverrides: s.geoOverrides as Record<string, number> | undefined,
        }));
    } catch (error) {
        console.error('Failed to load surfaces from registry, using fallback:', error);
        return Object.values(FALLBACK_SURFACES);
    }
}

// Fallback hardcoded surfaces (used when registry is empty or unavailable)
export const FALLBACK_SURFACES: Record<string, SurfaceDefinition> = {
    // === OWNED ===
    WEBSITE: {
        key: 'WEBSITE',
        label: 'Website Accessible',
        category: 'owned',
        basePoints: 18,
        defaultRelevance: 'high',
        queryTemplates: [],
        sourceType: 'WEBSITE_CRAWL',
        maxQueries: 0,
        officialnessRequired: false,
        tooltips: {
            why: 'A working website with SSL is the foundation of your digital presence.',
            how: 'Direct HTTP check of your domain for accessibility and SSL certificate.',
            actionPresent: 'Ensure your website loads fast and has proper meta tags.',
            actionAbsent: 'Secure a domain and set up a professional website immediately.',
        },
    },
    SCHEMA: {
        key: 'SCHEMA',
        label: 'Schema Markup',
        category: 'owned',
        basePoints: 4,
        defaultRelevance: 'medium',
        queryTemplates: [],
        sourceType: 'WEBSITE_CRAWL',
        maxQueries: 0,
        officialnessRequired: false,
        tooltips: {
            why: 'Schema markup helps search engines understand your business better.',
            how: 'Parsed JSON-LD and Microdata from your website HTML.',
            actionPresent: 'Expand schema to include Products, FAQs, and Reviews.',
            actionAbsent: 'Add Organization and LocalBusiness schema to your website.',
        },
    },
    GOOGLE_BRAND: {
        key: 'GOOGLE_BRAND',
        label: 'Google Brand Search',
        category: 'search',
        basePoints: 8,
        defaultRelevance: 'high',
        queryTemplates: ['"{brand}" "{domain}"', '"{brand}" official site'],
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        maxQueries: 2,
        officialnessRequired: true,
        tooltips: {
            why: 'When people search your brand, you should dominate the results.',
            how: 'Google SERP search for your brand name and domain.',
            actionPresent: 'Monitor your brand SERP and claim knowledge panel if available.',
            actionAbsent: 'Build brand mentions and ensure your site is indexed.',
        },
    },
    LINKEDIN: {
        key: 'LINKEDIN',
        label: 'LinkedIn Company',
        category: 'social',
        basePoints: 10,
        defaultRelevance: 'high',
        queryTemplates: ['"{brand}" site:linkedin.com/company', '"{brand}" linkedin'],
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        maxQueries: 2,
        officialnessRequired: true,
        tooltips: {
            why: 'LinkedIn is crucial for B2B credibility and recruiting.',
            how: 'Search for company profile on LinkedIn.',
            actionPresent: 'Post regularly and encourage employee advocacy.',
            actionAbsent: 'Create a LinkedIn Company Page immediately.',
        },
    },
    YOUTUBE: {
        key: 'YOUTUBE',
        label: 'YouTube Channel',
        category: 'video',
        basePoints: 8,
        defaultRelevance: 'medium',
        queryTemplates: ['"{brand}" site:youtube.com', '"{brand}" youtube channel'],
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        maxQueries: 2,
        officialnessRequired: true,
        tooltips: {
            why: 'YouTube is the second largest search engine.',
            how: 'Search for brand channel and videos on YouTube.',
            actionPresent: 'Create educational content and product demos.',
            actionAbsent: 'Start a YouTube channel with product videos.',
        },
    },
    GBP_REVIEWS: {
        key: 'GBP_REVIEWS',
        label: 'Google Business / Reviews',
        category: 'trust',
        basePoints: 10,
        defaultRelevance: 'high',
        queryTemplates: ['"{brand}" reviews', '"{brand}" "{city}" reviews'],
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        maxQueries: 2,
        officialnessRequired: true,
        tooltips: {
            why: 'Google reviews directly impact local search rankings and trust.',
            how: 'Search for reviews and Google Business Profile indicators.',
            actionPresent: 'Respond to all reviews and request new ones.',
            actionAbsent: 'Claim your Google Business Profile immediately.',
        },
    },
};

// Legacy exports for backward compatibility
export const SURFACES = FALLBACK_SURFACES;

// Get all surfaces as array (uses fallback)
export function getAllSurfaces(): SurfaceDefinition[] {
    return Object.values(FALLBACK_SURFACES);
}

// Get surfaces by category
export function getSurfacesByCategory(category: SurfaceCategory): SurfaceDefinition[] {
    return getAllSurfaces().filter(s => s.category === category);
}

// Calculate total possible points
export function getTotalBasePoints(): number {
    return getAllSurfaces().reduce((sum, s) => sum + s.basePoints, 0);
}

// Status factor for scoring
export function getStatusFactor(status: SurfaceStatus): number {
    switch (status) {
        case 'present': return 1.0;
        case 'partial': return 0.5;
        case 'absent': return 0.0;
        case 'unknown': return 0.0;
    }
}

// Calculate total possible points from registry
export async function getTotalBasePointsFromRegistry(): Promise<number> {
    const surfaces = await getSurfacesFromRegistry();
    return surfaces.reduce((sum, s) => sum + s.basePoints, 0);
}

