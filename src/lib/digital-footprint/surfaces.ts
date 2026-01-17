// Surface Registry - Defines all surfaces for digital footprint audit

export type SurfaceCategory = 'owned' | 'search' | 'social' | 'trust' | 'authority';
export type SurfaceStatus = 'present' | 'partial' | 'absent' | 'unknown';
export type Relevance = 'high' | 'medium' | 'low';

export interface SurfaceDefinition {
    key: string;
    label: string;
    category: SurfaceCategory;
    basePoints: number;
    defaultRelevance: Relevance;
    queryTemplates: string[];
    tooltips: {
        why: string;
        how: string;
        actionPresent: string;
        actionAbsent: string;
    };
}

export const SURFACES: Record<string, SurfaceDefinition> = {
    // === OWNED (22 points) ===
    WEBSITE: {
        key: 'WEBSITE',
        label: 'Website Accessible',
        category: 'owned',
        basePoints: 18,
        defaultRelevance: 'high',
        queryTemplates: [],
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
        tooltips: {
            why: 'Schema markup helps search engines understand your business better.',
            how: 'Parsed JSON-LD and Microdata from your website HTML.',
            actionPresent: 'Expand schema to include Products, FAQs, and Reviews.',
            actionAbsent: 'Add Organization and LocalBusiness schema to your website.',
        },
    },

    // === SEARCH (22 points) ===
    GOOGLE_BRAND: {
        key: 'GOOGLE_BRAND',
        label: 'Google Brand Search',
        category: 'search',
        basePoints: 8,
        defaultRelevance: 'high',
        queryTemplates: ['"{brand}" "{domain}"', '"{brand}" official site'],
        tooltips: {
            why: 'When people search your brand, you should dominate the results.',
            how: 'Google SERP search for your brand name and domain.',
            actionPresent: 'Monitor your brand SERP and claim knowledge panel if available.',
            actionAbsent: 'Build brand mentions and ensure your site is indexed.',
        },
    },
    BING_BRAND: {
        key: 'BING_BRAND',
        label: 'Bing Brand Search',
        category: 'search',
        basePoints: 4,
        defaultRelevance: 'medium',
        queryTemplates: ['"{brand}" "{domain}"'],
        tooltips: {
            why: 'Bing powers many enterprise searches and Cortana.',
            how: 'Bing SERP search for your brand name.',
            actionPresent: 'Claim your Bing Places listing if applicable.',
            actionAbsent: 'Submit your site to Bing Webmaster Tools.',
        },
    },
    GOOGLE_NEWS: {
        key: 'GOOGLE_NEWS',
        label: 'News & PR Coverage',
        category: 'search',
        basePoints: 6,
        defaultRelevance: 'medium',
        queryTemplates: ['"{brand}" press release', '"{brand}" news', '"{brand}" announcement'],
        tooltips: {
            why: 'News coverage builds authority and trust signals.',
            how: 'Search for news articles and press mentions of your brand.',
            actionPresent: 'Maintain a regular PR cadence with newsworthy updates.',
            actionAbsent: 'Issue press releases for product launches and milestones.',
        },
    },
    GOOGLE_IMAGES: {
        key: 'GOOGLE_IMAGES',
        label: 'Google Images',
        category: 'search',
        basePoints: 2,
        defaultRelevance: 'low',
        queryTemplates: ['"{brand}" logo', '"{brand}" products'],
        tooltips: {
            why: 'Visual search is growing; your products should appear in image results.',
            how: 'Google Images search for your brand and products.',
            actionPresent: 'Optimize image alt tags and file names for SEO.',
            actionAbsent: 'Add high-quality images with proper metadata to your site.',
        },
    },
    GOOGLE_AUTOCOMPLETE: {
        key: 'GOOGLE_AUTOCOMPLETE',
        label: 'Autocomplete Suggestions',
        category: 'search',
        basePoints: 2,
        defaultRelevance: 'low',
        queryTemplates: ['{brand}'],
        tooltips: {
            why: 'Appearing in autocomplete increases discoverability.',
            how: 'Google Autocomplete API check for brand-related suggestions.',
            actionPresent: 'Monitor for negative suggestions and build positive ones.',
            actionAbsent: 'Increase brand search volume through marketing campaigns.',
        },
    },

    // === SOCIAL (28 points) ===
    LINKEDIN: {
        key: 'LINKEDIN',
        label: 'LinkedIn Company',
        category: 'social',
        basePoints: 10,
        defaultRelevance: 'high',
        queryTemplates: ['"{brand}" site:linkedin.com/company', '"{brand}" linkedin'],
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
        category: 'social',
        basePoints: 8,
        defaultRelevance: 'medium',
        queryTemplates: ['"{brand}" site:youtube.com', '"{brand}" youtube channel'],
        tooltips: {
            why: 'YouTube is the second largest search engine.',
            how: 'Search for brand channel and videos on YouTube.',
            actionPresent: 'Create educational content and product demos.',
            actionAbsent: 'Start a YouTube channel with product videos.',
        },
    },
    FACEBOOK: {
        key: 'FACEBOOK',
        label: 'Facebook Page',
        category: 'social',
        basePoints: 2,
        defaultRelevance: 'low',
        queryTemplates: ['"{brand}" site:facebook.com', '"{brand}" facebook page'],
        tooltips: {
            why: 'Facebook remains important for community and local presence.',
            how: 'Search for official Facebook page.',
            actionPresent: 'Respond to reviews and post updates.',
            actionAbsent: 'Create a Facebook Business Page.',
        },
    },
    INSTAGRAM: {
        key: 'INSTAGRAM',
        label: 'Instagram Profile',
        category: 'social',
        basePoints: 2,
        defaultRelevance: 'low',
        queryTemplates: ['"{brand}" site:instagram.com', '"{brand}" instagram'],
        tooltips: {
            why: 'Instagram builds visual brand identity.',
            how: 'Search for official Instagram profile.',
            actionPresent: 'Post consistently with branded hashtags.',
            actionAbsent: 'Create an Instagram business profile.',
        },
    },
    X_TWITTER: {
        key: 'X_TWITTER',
        label: 'X (Twitter) Profile',
        category: 'social',
        basePoints: 2,
        defaultRelevance: 'low',
        queryTemplates: ['"{brand}" site:x.com', '"{brand}" site:twitter.com'],
        tooltips: {
            why: 'X/Twitter is important for real-time engagement and news.',
            how: 'Search for official X/Twitter profile.',
            actionPresent: 'Engage with industry conversations.',
            actionAbsent: 'Create an X/Twitter profile.',
        },
    },
    PINTEREST: {
        key: 'PINTEREST',
        label: 'Pinterest Presence',
        category: 'social',
        basePoints: 4,
        defaultRelevance: 'low',
        queryTemplates: ['"{brand}" site:pinterest.com'],
        tooltips: {
            why: 'Pinterest drives significant traffic for visual products.',
            how: 'Search for pins and boards featuring your brand.',
            actionPresent: 'Create product pins with rich descriptions.',
            actionAbsent: 'Create a Pinterest business account if selling visual products.',
        },
    },
    REDDIT: {
        key: 'REDDIT',
        label: 'Reddit Mentions',
        category: 'social',
        basePoints: 2,
        defaultRelevance: 'low',
        queryTemplates: ['"{brand}" site:reddit.com'],
        tooltips: {
            why: 'Reddit discussions influence buying decisions.',
            how: 'Search for brand mentions on Reddit.',
            actionPresent: 'Monitor discussions and engage authentically.',
            actionAbsent: 'Consider AMA or community participation.',
        },
    },

    // === TRUST (12 points) ===
    GBP_REVIEWS: {
        key: 'GBP_REVIEWS',
        label: 'Google Business / Reviews',
        category: 'trust',
        basePoints: 10,
        defaultRelevance: 'high',
        queryTemplates: ['"{brand}" reviews', '"{brand}" "{city}" reviews'],
        tooltips: {
            why: 'Google reviews directly impact local search rankings and trust.',
            how: 'Search for reviews and Google Business Profile indicators.',
            actionPresent: 'Respond to all reviews and request new ones.',
            actionAbsent: 'Claim your Google Business Profile immediately.',
        },
    },
    TRUSTPILOT: {
        key: 'TRUSTPILOT',
        label: 'Trustpilot Reviews',
        category: 'trust',
        basePoints: 2,
        defaultRelevance: 'low',
        queryTemplates: ['"{brand}" site:trustpilot.com'],
        tooltips: {
            why: 'Trustpilot reviews appear in search results and build credibility.',
            how: 'Search for Trustpilot profile.',
            actionPresent: 'Actively collect and respond to reviews.',
            actionAbsent: 'Claim your Trustpilot profile.',
        },
    },

    // === AUTHORITY (4 points) ===
    PR_MENTIONS: {
        key: 'PR_MENTIONS',
        label: 'Industry Mentions',
        category: 'authority',
        basePoints: 4,
        defaultRelevance: 'medium',
        queryTemplates: ['"{brand}" manufacturer', '"{brand}" supplier', '"{brand}" "{industry}"'],
        tooltips: {
            why: 'Industry mentions and directory listings build domain authority.',
            how: 'Search for mentions in trade publications and directories.',
            actionPresent: 'Pursue guest posts and industry partnerships.',
            actionAbsent: 'Submit to relevant industry directories and portals.',
        },
    },
};

// Get all surfaces as array
export function getAllSurfaces(): SurfaceDefinition[] {
    return Object.values(SURFACES);
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
