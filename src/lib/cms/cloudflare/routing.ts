// CMS Cloudflare - Feed Routing Configuration

export interface FeedRouteConfig {
    clientSlug: string;
    enabled: boolean;
    customDomain?: string;
    subdomain: string;
    basePath: string;
    cacheSettings: CacheSettings;
}

export interface CacheSettings {
    ttl: number;          // Cache TTL in seconds
    bypassCookie?: string; // Cookie name to bypass cache
    purgeOnPublish: boolean;
}

// Default cache settings
export const DEFAULT_CACHE_SETTINGS: CacheSettings = {
    ttl: 3600, // 1 hour
    bypassCookie: 'cms_preview',
    purgeOnPublish: true,
};

// Build feed URL for a page
export function buildFeedUrl(
    config: FeedRouteConfig,
    pageSlug: string
): string {
    const domain = config.customDomain || `${config.subdomain}.${getBaseDomain()}`;
    return `https://${domain}${config.basePath}/${config.clientSlug}/${pageSlug}`;
}

// Get base domain from environment or default
function getBaseDomain(): string {
    return process.env.NEXT_PUBLIC_BASE_DOMAIN || 'keyword-ninja.app';
}

// Generate Cloudflare page rules for client
export function generatePageRules(config: FeedRouteConfig): {
    pattern: string;
    actions: Record<string, unknown>;
}[] {
    const basePattern = config.customDomain
        ? `${config.customDomain}${config.basePath}/${config.clientSlug}/*`
        : `*${config.basePath}/${config.clientSlug}/*`;

    return [
        {
            pattern: basePattern,
            actions: {
                cache_level: 'cache_everything',
                edge_cache_ttl: config.cacheSettings.ttl,
                browser_cache_ttl: Math.min(config.cacheSettings.ttl, 14400), // Max 4 hours for browser
                origin_cache_control: true,
            },
        },
        // Bypass cache for preview
        {
            pattern: `${basePattern}?preview=*`,
            actions: {
                cache_level: 'bypass',
                disable_apps: true,
            },
        },
    ];
}

// Validate custom domain format
export function validateCustomDomain(domain: string): {
    valid: boolean;
    error?: string;
} {
    // Basic domain validation
    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

    if (!domain) {
        return { valid: false, error: 'Domain is required' };
    }

    if (domain.startsWith('http')) {
        return { valid: false, error: 'Domain should not include protocol (http/https)' };
    }

    if (domain.includes('/')) {
        return { valid: false, error: 'Domain should not include path' };
    }

    if (!domainRegex.test(domain)) {
        return { valid: false, error: 'Invalid domain format' };
    }

    return { valid: true };
}

// Generate sitemap URL for client
export function getSitemapUrl(config: FeedRouteConfig): string {
    const domain = config.customDomain || `${config.subdomain}.${getBaseDomain()}`;
    return `https://${domain}${config.basePath}/${config.clientSlug}/sitemap.xml`;
}

// Generate robots.txt URL for client
export function getRobotsUrl(config: FeedRouteConfig): string {
    const domain = config.customDomain || `${config.subdomain}.${getBaseDomain()}`;
    return `https://${domain}${config.basePath}/${config.clientSlug}/robots.txt`;
}

// Build preview URL for unpublished page
export function buildPreviewUrl(
    config: FeedRouteConfig,
    pageSlug: string,
    previewToken: string
): string {
    return `${buildFeedUrl(config, pageSlug)}?preview=${previewToken}`;
}

// Generate client feed configuration
export function createClientFeedConfig(
    clientSlug: string,
    options?: Partial<FeedRouteConfig>
): FeedRouteConfig {
    return {
        clientSlug,
        enabled: true,
        subdomain: 'feed',
        basePath: '/feed',
        cacheSettings: DEFAULT_CACHE_SETTINGS,
        ...options,
    };
}
