'use client';

import { useState, useEffect, useCallback } from 'react';

// Types
interface Surface {
    id: string;
    surfaceKey: string;
    label: string;
    category: string;
    importanceTier: string;
    basePoints: number;
    defaultRelevanceWeight: number;
    sourceType: string;
    searchEngine: string | null;
    queryTemplates: string[];
    maxQueries: number;
    confirmationArtifact: string;
    presenceRules: Record<string, unknown> | null;
    officialnessRules: Record<string, unknown> | null;
    officialnessRequired: boolean;
    evidenceFields: string[] | null;
    tooltipTemplates: Record<string, unknown> | null;
    enabled: boolean;
    notes: string | null;
    industryOverrides: Record<string, number> | null;
    geoOverrides: Record<string, number> | null;
    // Historical metadata
    launchYear: number | null;
    technicalName: string | null;
    businessImpact: { impactLevel?: string; absenceImpact?: string; partialImpact?: string } | null;
    createdAt: string;
    updatedAt: string;
}

interface Meta {
    total: number;
    enabled: number;
    disabled: number;
    categoryCounts: Record<string, number>;
    tierCounts: Record<string, number>;
    sourceTypeCounts: Record<string, number>;
}

interface TestResult {
    queries: string[];
    results: Array<{ url: string; title: string; snippet?: string; position?: number }>;
    evaluation: { status: string; officialness: boolean; confidence: number };
    scorePreview: { basePoints: number; weight: number; statusFactor: number; finalScore: number };
    error?: string;
}

// Constants
const CATEGORIES = ['owned', 'search', 'social', 'video', 'community', 'trust', 'authority', 'marketplace', 'technical', 'ai', 'aeo', 'performance_security', 'eeat_entity'];
const IMPORTANCE_TIERS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const SOURCE_TYPES = ['WEBSITE_CRAWL', 'DATAFORSEO_SERP', 'DATAFORSEO_AUTOCOMPLETE', 'PLATFORM_API', 'DNS_LOOKUP', 'THIRD_PARTY', 'GSC_API', 'BING_WMT_API', 'PAGESPEED_API', 'MANUAL_REVIEW'];
const SEARCH_ENGINES = ['google', 'bing', 'youtube', 'yahoo', 'baidu', 'naver'];

export default function FootprintRegistryPage() {
    // State
    const [surfaces, setSurfaces] = useState<Surface[]>([]);
    const [meta, setMeta] = useState<Meta | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [filterCategory, setFilterCategory] = useState<string[]>([]);
    const [filterSourceType, setFilterSourceType] = useState<string[]>([]);
    const [filterTier, setFilterTier] = useState<string[]>([]);
    const [filterEnabled, setFilterEnabled] = useState<string>('all');
    const [searchText, setSearchText] = useState('');
    const [sortBy, setSortBy] = useState('importanceTier');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [showFilters, setShowFilters] = useState(false);
    const [groupByCategory, setGroupByCategory] = useState(false);
    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

    // Modals
    const [showDetail, setShowDetail] = useState<Surface | null>(null);
    const [showEdit, setShowEdit] = useState<Surface | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showNotesModal, setShowNotesModal] = useState<Surface | null>(null);
    const [notesText, setNotesText] = useState('');

    // Test Query
    const [testDomain, setTestDomain] = useState('');
    const [testBrand, setTestBrand] = useState('');
    const [testResult, setTestResult] = useState<TestResult | null>(null);
    const [testing, setTesting] = useState(false);

    // Fetch surfaces
    const fetchSurfaces = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterCategory.length) params.set('category', filterCategory.join(','));
            if (filterSourceType.length) params.set('sourceType', filterSourceType.join(','));
            if (filterTier.length) params.set('importanceTier', filterTier.join(','));
            if (filterEnabled !== 'all') params.set('enabled', filterEnabled);
            if (searchText) params.set('search', searchText);
            params.set('sortBy', sortBy);
            params.set('sortOrder', sortOrder);

            const res = await fetch(`/api/admin/footprint-registry?${params}`);
            const data = await res.json();
            setSurfaces(data.surfaces || []);
            setMeta(data.meta || null);
        } catch (err) {
            setError('Failed to load registry');
        } finally {
            setLoading(false);
        }
    }, [filterCategory, filterSourceType, filterTier, filterEnabled, searchText, sortBy, sortOrder]);

    useEffect(() => {
        fetchSurfaces();
    }, [fetchSurfaces]);

    // Toggle enabled
    const toggleEnabled = async (surface: Surface) => {
        try {
            await fetch(`/api/admin/footprint-registry/${surface.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !surface.enabled }),
            });
            fetchSurfaces();
        } catch {
            setError('Failed to update');
        }
    };

    // Sync new surfaces (add missing, keep existing)
    const syncNewSurfaces = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/admin/footprint-registry/seed', { method: 'POST' });
            const data = await res.json();
            if (data.added > 0) {
                alert(`Added ${data.added} new surfaces! Total: ${data.total}`);
            } else {
                alert('All surfaces are already up to date.');
            }
            fetchSurfaces();
        } catch {
            setError('Failed to sync surfaces');
        } finally {
            setLoading(false);
        }
    };

    // Full reset to defaults (delete all and recreate)
    const resetToDefaults = async () => {
        try {
            setLoading(true);
            await fetch('/api/admin/footprint-registry/seed?reset=true', { method: 'POST' });
            setShowResetConfirm(false);
            fetchSurfaces();
        } catch {
            setError('Failed to reset');
        } finally {
            setLoading(false);
        }
    };

    // Run test query
    const runTest = async () => {
        if (!showDetail || !testDomain || !testBrand) return;
        setTesting(true);
        setTestResult(null);
        try {
            const res = await fetch('/api/admin/footprint-registry/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    surfaceId: showDetail.id,
                    domain: testDomain,
                    brand: testBrand,
                }),
            });
            const data = await res.json();
            setTestResult(data);
        } catch {
            setError('Test failed');
        } finally {
            setTesting(false);
        }
    };

    // Toggle category collapse
    const toggleCategoryCollapse = (category: string) => {
        setCollapsedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(category)) {
                newSet.delete(category);
            } else {
                newSet.add(category);
            }
            return newSet;
        });
    };

    // Collapse all categories
    const collapseAllCategories = () => {
        setCollapsedCategories(new Set(CATEGORIES));
    };

    // Expand all categories
    const expandAllCategories = () => {
        setCollapsedCategories(new Set());
    };

    // Open Google search for surface key
    const openKeySearch = (surface: Surface) => {
        const query = `what is ${surface.label} SEO how to implement for my business advantages benefits`;
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        window.open(url, '_blank');
    };

    // Save notes for a surface
    const saveNotes = async () => {
        if (!showNotesModal) return;
        try {
            await fetch(`/api/admin/footprint-registry/${showNotesModal.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: notesText }),
            });
            // Update local state
            setSurfaces(prev => prev.map(s =>
                s.id === showNotesModal.id ? { ...s, notes: notesText } : s
            ));
            setShowNotesModal(null);
            setNotesText('');
        } catch {
            setError('Failed to save notes');
        }
    };

    // Open notes modal
    const openNotesModal = (surface: Surface) => {
        setShowNotesModal(surface);
        setNotesText(surface.notes || '');
    };

    // Delete surface
    const deleteSurface = async (id: string) => {
        if (!confirm('Delete this surface?')) return;
        try {
            await fetch(`/api/admin/footprint-registry/${id}`, { method: 'DELETE' });
            setShowDetail(null);
            fetchSurfaces();
        } catch {
            setError('Failed to delete');
        }
    };

    // Badge colors
    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-300';
            case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-300';
            case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            default: return 'bg-gray-100 text-gray-600 border-gray-300';
        }
    };

    const getCategoryColor = (cat: string) => {
        const colors: Record<string, string> = {
            owned: 'bg-green-100 text-green-700',
            search: 'bg-blue-100 text-blue-700',
            social: 'bg-purple-100 text-purple-700',
            video: 'bg-pink-100 text-pink-700',
            community: 'bg-indigo-100 text-indigo-700',
            trust: 'bg-amber-100 text-amber-700',
            authority: 'bg-teal-100 text-teal-700',
            marketplace: 'bg-cyan-100 text-cyan-700',
            technical: 'bg-slate-100 text-slate-700',
            ai: 'bg-violet-100 text-violet-700',
            aeo: 'bg-fuchsia-100 text-fuchsia-700',
            performance_security: 'bg-rose-100 text-rose-700',
            eeat_entity: 'bg-emerald-100 text-emerald-700',
        };
        return colors[cat] || 'bg-gray-100 text-gray-700';
    };

    // Favicon URL mapping based on surface key or label
    const getSurfaceFavicon = (surface: Surface): string | null => {
        const key = surface.surfaceKey.toLowerCase();
        const label = surface.label.toLowerCase();

        // Platform domain mappings for favicons
        const platformDomains: Record<string, string> = {
            'linkedin': 'linkedin.com',
            'google': 'google.com',
            'facebook': 'facebook.com',
            'twitter': 'twitter.com',
            'x_': 'x.com',
            'instagram': 'instagram.com',
            'youtube': 'youtube.com',
            'tiktok': 'tiktok.com',
            'pinterest': 'pinterest.com',
            'reddit': 'reddit.com',
            'quora': 'quora.com',
            'wikipedia': 'wikipedia.org',
            'github': 'github.com',
            'amazon': 'amazon.com',
            'yelp': 'yelp.com',
            'trustpilot': 'trustpilot.com',
            'glassdoor': 'glassdoor.com',
            'crunchbase': 'crunchbase.com',
            'bbb': 'bbb.org',
            'g2': 'g2.com',
            'capterra': 'capterra.com',
            'clutch': 'clutch.co',
            'tripadvisor': 'tripadvisor.com',
            'bing': 'bing.com',
            'yahoo': 'yahoo.com',
            'duckduckgo': 'duckduckgo.com',
            'discord': 'discord.com',
            'slack': 'slack.com',
            'medium': 'medium.com',
            'substack': 'substack.com',
            'spotify': 'spotify.com',
            'apple': 'apple.com',
            'playstore': 'play.google.com',
            'appstore': 'apps.apple.com',
            'shopify': 'shopify.com',
            'etsy': 'etsy.com',
            'ebay': 'ebay.com',
            'alibaba': 'alibaba.com',
            'indiamart': 'indiamart.com',
            'justdial': 'justdial.com',
            'zomato': 'zomato.com',
            'swiggy': 'swiggy.com',
            'maps': 'maps.google.com',
            'gbp': 'business.google.com',
            'news': 'news.google.com',
            'perplexity': 'perplexity.ai',
            'chatgpt': 'chat.openai.com',
            'openai': 'openai.com',
        };

        // Find matching platform
        for (const [platform, domain] of Object.entries(platformDomains)) {
            if (key.includes(platform) || label.includes(platform)) {
                return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
            }
        }

        // No favicon available
        return null;
    };

    // SEO meaning descriptions for each surface type
    const getSurfaceSeoMeaning = (surface: Surface): string => {
        const key = surface.surfaceKey.toLowerCase();
        const label = surface.label.toLowerCase();

        const meanings: Record<string, string> = {
            // Social & Professional
            'linkedin': 'Professional network presence. Builds B2B trust, showcases expertise, enables employee advocacy. Google often ranks LinkedIn profiles on page 1 for brand searches.',
            'facebook': 'Social proof and community engagement. Affects local SEO, enables reviews, and shows brand activity. Links from Facebook can drive referral traffic.',
            'twitter': 'Real-time brand presence. Tweets can appear in search results, builds thought leadership, and enables direct customer engagement.',
            'instagram': 'Visual brand identity. High engagement rates, influences younger demographics, and can drive e-commerce through shopping features.',
            'youtube': 'Video SEO powerhouse. 2nd largest search engine. Videos rank in Google, increase dwell time, and provide rich snippets in SERPs.',
            'pinterest': 'Visual discovery engine. Drives referral traffic, especially for lifestyle and e-commerce brands. Pins have long content lifespan.',
            'tiktok': 'Emerging search behavior. Gen Z uses TikTok for search. Viral potential and brand awareness at scale.',
            'whatsapp': 'High-conversion contact surface (India/global); supports lead capture and customer trust.',

            // Search Presence
            'google': 'Core search visibility indicator. Being indexed and ranking well on Google is fundamental to organic traffic.',
            'gbp': 'Google Business Profile. Critical for local SEO. Affects map pack rankings, enables reviews, and provides business info directly in search.',
            'bing': 'Secondary search engine (~3% market share). Powers Yahoo search. Easier to rank, different demographics than Google.',
            'knowledge_panel': 'Brand entity surface; impacts brand SERP trust, navigation, and AI/LLM entity understanding.',
            'maps_pack': 'Local brand discovery surface; supports trust, navigation and "near me" intent even for B2B.',
            'people_also_ask': 'Question-based visibility surface; informs content strategy and captures mid-funnel intent.',
            'perspectives': 'Visibility inside discussion-heavy SERP features; supports reputation and social proof discovery.',

            // Trust & Authority
            'wikipedia': 'Highest authority backlink. Wikipedia citations signal notable entity. Extremely difficult to earn; presence indicates establishment.',
            'wikidata': 'Structured entity graph for machines/LLMs; stabilizes brand facts and relationships.',
            'trustpilot': 'Third-party review platform. Star ratings can appear as rich snippets in Google, building click-through rate and trust.',
            'g2': 'B2B software review platform. Reviews affect buyer decisions. G2 pages rank highly for "[product] reviews" searches.',
            'clutch': 'Third-party validation for B2B services/products; improves conversion trust and brand authority.',
            'goodfirms': 'Third-party review directory; supports trust and referral discovery.',
            'bbb': 'Better Business Bureau accreditation. Trust signal for US consumers. Rating can appear in Knowledge Panel.',
            'glassdoor': 'Employer reputation. Affects recruiting and brand perception. Glassdoor pages rank for "[company] reviews".',
            'ambitionbox': 'India employer reputation surface; impacts brand trust and hiring pipeline.',
            'justdial': 'India local discovery + credibility listing for many commercial categories.',
            'crunchbase': 'Business data authority. Shows company legitimacy, funding, and structure. Often cited by journalists.',

            // Community & Forums
            'reddit': 'Community discussions. Reddit threads rank for long-tail queries. Brand mentions affect reputation and drive traffic.',
            'quora': 'Q&A platform. Answers rank in Google for question-based searches. Establishes expertise on topics.',
            'industry_forum': 'Reputation and long-tail discovery via niche communities; can influence AI citations.',

            // Technical SEO
            'website': 'Core web presence. Foundation of all SEO. Must be crawlable, fast, secure, and mobile-friendly.',
            'ssl': 'HTTPS security. Google ranking factor since 2014. Builds user trust and is required for Chrome display.',
            'robots': 'Robots.txt file. Controls crawler access. Missing or misconfigured blocks indexing.',
            'sitemap': 'XML Sitemap. Helps search engines discover pages. Essential for large sites and new content.',
            'schema': 'Structured data markup. Enables rich snippets (stars, FAQs, breadcrumbs) in search results.',
            'spf': 'Email authentication. SPF/DKIM/DMARC prevent spoofing. Affects email deliverability and brand protection.',
            'dns': 'Domain configuration. Proper DNS setup affects site speed, security, and email delivery.',
            'dmarc': 'Email domain trust; reduces spoofing, improves deliverability and brand integrity.',
            'bimi': 'Brand trust in email; improves recognition and phishing resistance (requires DMARC).',
            'mta_sts': 'Email transport security; improves domain trust and reduces downgrade attacks.',
            'tls_rpt': 'Reporting for email TLS issues; supports deliverability monitoring.',

            // Owned / Analytics
            'gsc': 'Proof of site ownership + direct indexing/crawl diagnostics (coverage, sitemaps, manual actions, rich results).',
            'webmaster': 'Ownership + crawl/index diagnostics for search ecosystem.',
            'ga4': 'Measurement foundation for SEO→lead attribution; supports CRO, content ROI, and channel diagnostics.',
            'gtm': 'Stable instrumentation for analytics/events without frequent code deploys; improves measurement hygiene.',
            'about': 'Entity and trust clarity for users + crawlers; required for credibility and conversions in B2B.',
            'contact': 'Entity and trust clarity for users + crawlers; required for credibility and conversions in B2B.',
            'privacy': 'Trust baseline; reduces risk and improves legitimacy signals for enterprise buyers and AI systems.',
            'terms': 'Trust baseline; reduces risk and improves legitimacy signals for enterprise buyers and AI systems.',

            // Content & News
            'news': 'Google News coverage. Press mentions build authority, drive traffic, and create backlinks.',
            'blog': 'Content marketing hub. Drives organic traffic, captures long-tail keywords, and demonstrates expertise.',
            'podcast': 'Audio content presence. Growing discovery channel. Apple/Spotify listings increase brand touchpoints.',
            'image': 'Image search presence. Images rank in Google Image Search and can appear in main SERPs.',
            'shorts': 'Short-form discovery layer; can rank separately and expand reach for product/brand queries.',
            'video_schema': 'Enables video rich results + clearer indexing of embedded videos.',
            'video_sitemap': 'Helps discovery/indexing of video assets at scale; improves video SEO reliability.',

            // Marketplace
            'amazon': 'E-commerce giant. Product listings rank in Google. Reviews affect buyer decisions.',
            'indiamart': 'India B2B marketplace. Important for manufacturers and exporters in Indian market.',
            'tradeindia': 'India B2B marketplace discovery; supports supplier verification and lead gen.',
            'exportersindia': 'Exporter discovery surface; supports international inbound and directory citations.',
            'globalsources': 'Global B2B directory/marketplace; strengthens authority + export lead flow.',
            'kompass': 'International business directory; can appear in brand/category queries and AI citations.',

            // AI & AEO
            'perplexity': 'AI search engine. Citations in Perplexity answers drive referral traffic from AI-native users.',
            'chatgpt': 'AI assistant mentions. Being recommended by ChatGPT affects brand discovery and trust.',
            'llms': 'AI-crawler guidance for content consumption; improves LLM ingestion usability (emerging).',
            'faq_schema': 'Supports question-answer retrieval and rich results; helps AEO and mid-funnel queries.',
            'sameas': 'Connects official profiles/listings; improves entity reconciliation for Google + LLMs.',

            // Performance & Security
            'core_web_vitals': 'Performance UX baseline; impacts rankings, crawl efficiency, and conversion rates.',
            'cwv': 'Performance UX baseline; impacts rankings, crawl efficiency, and conversion rates.',
            'pagespeed': 'Performance UX baseline; impacts rankings, crawl efficiency, and conversion rates.',
            'security_headers': 'Security posture trust signal; reduces risk and improves enterprise confidence.',
            'hsts': 'Security posture trust signal; reduces risk and improves enterprise confidence.',
            'csp': 'Security posture trust signal; reduces risk and improves enterprise confidence.',
        };

        // Find matching meaning
        for (const [keyword, meaning] of Object.entries(meanings)) {
            if (key.includes(keyword) || label.includes(keyword)) {
                return meaning;
            }
        }

        // Category-based fallbacks
        const categoryMeanings: Record<string, string> = {
            'owned': 'Owned media asset. Direct control over content and messaging. Foundation of digital presence.',
            'search': 'Search engine visibility. Direct impact on organic traffic and brand discovery.',
            'social': 'Social media presence. Builds community, engagement, and brand awareness.',
            'video': 'Video content presence. High engagement format. Videos rank in Google and drive traffic.',
            'community': 'Community platform presence. Enables user discussions and word-of-mouth marketing.',
            'trust': 'Trust signal platform. Third-party validation that builds credibility with customers.',
            'authority': 'Authority indicator. Signals establishment and credibility to search engines.',
            'marketplace': 'Marketplace presence. Reaches customers with buying intent.',
            'technical': 'Technical SEO foundation. Ensures proper crawling, indexing, and site health.',
            'ai': 'AI platform presence. Emerging search behavior and brand discovery channel.',
            'aeo': 'Answer Engine Optimization. Structured data and content for AI/LLM discoverability.',
            'performance_security': 'Performance and security signals. Core Web Vitals, security headers, and trust infrastructure.',
            'eeat_entity': 'E-E-A-T + Entity signals. Experience, Expertise, Authority, Trust indicators that strengthen brand credibility and AI understanding.',
        };

        return categoryMeanings[surface.category] || 'Digital footprint surface that contributes to overall online presence and discoverability.';
    };

    // Group surfaces by category
    const groupedSurfaces = groupByCategory
        ? CATEGORIES.reduce((acc, cat) => {
            const catSurfaces = surfaces.filter(s => s.category === cat);
            if (catSurfaces.length > 0) acc[cat] = catSurfaces;
            return acc;
        }, {} as Record<string, Surface[]>)
        : null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">📋 Footprint Registry</h1>
                    <p className="text-gray-600 mt-1">Master list of surfaces used for digital footprint scans.</p>
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <span>⚡</span>
                        <span>The digital landscape evolves rapidly. New surfaces (AI search, platforms, marketplaces) emerge yearly. Keep this registry updated to ensure comprehensive footprint coverage.</span>
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowCreate(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                        + Add Surface
                    </button>
                    <a
                        href="/api/admin/footprint-registry/export?format=csv"
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                    >
                        📥 Export Excel
                    </a>
                    <button
                        onClick={syncNewSurfaces}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                        title="Add any missing surfaces from the seed file without deleting existing ones"
                    >
                        ➕ Sync New
                    </button>
                    <button
                        onClick={() => setShowResetConfirm(true)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                        title="Delete all and recreate from seed file"
                    >
                        🔄 Reset
                    </button>
                </div>
            </div>

            {/* KPI Strip */}
            {meta && (
                <div className="bg-white rounded-xl shadow-sm border p-4">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="px-4 py-2 bg-slate-100 rounded-lg">
                            <div className="text-2xl font-bold text-slate-800">{surfaces.length}</div>
                            <div className="text-xs text-slate-500">Showing</div>
                        </div>
                        <div className="px-4 py-2 bg-blue-50 rounded-lg border-2 border-blue-300">
                            <div className="text-2xl font-bold text-blue-700">{surfaces.reduce((sum, s) => sum + s.basePoints, 0)}</div>
                            <div className="text-xs text-blue-600">Total Points</div>
                        </div>
                        <div className="px-4 py-2 bg-green-50 rounded-lg">
                            <div className="text-2xl font-bold text-green-700">{surfaces.filter(s => s.enabled).length}</div>
                            <div className="text-xs text-green-600">Enabled</div>
                        </div>
                        <div className="px-4 py-2 bg-gray-50 rounded-lg">
                            <div className="text-2xl font-bold text-gray-500">{surfaces.filter(s => !s.enabled).length}</div>
                            <div className="text-xs text-gray-400">Disabled</div>
                        </div>
                        <div className="border-l pl-4 flex flex-wrap gap-2">
                            {Object.entries(meta.tierCounts).map(([tier, count]) => (
                                <span key={tier} className={`px-2 py-1 rounded text-xs font-medium border ${getTierColor(tier)}`}>
                                    {tier}: {count}
                                </span>
                            ))}
                        </div>
                        <div className="border-l pl-4 flex flex-wrap gap-1">
                            {Object.entries(meta.categoryCounts).map(([cat, count]) => (
                                <span key={cat} className={`px-2 py-0.5 rounded text-xs ${getCategoryColor(cat)}`}>
                                    {cat}: {count}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Filter Toggle */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium"
                >
                    {showFilters ? '▼ Hide Filters' : '▶ Show Filters'}
                </button>
                <input
                    type="text"
                    placeholder="Search key or label..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="px-4 py-2 border rounded-lg w-64"
                />
                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 border rounded-lg"
                >
                    <option value="importanceTier">Sort: Importance</option>
                    <option value="basePoints">Sort: Points</option>
                    <option value="category">Sort: Category</option>
                    <option value="label">Sort: Label</option>
                    <option value="updatedAt">Sort: Updated</option>
                </select>
                <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-3 py-2 border rounded-lg hover:bg-gray-50"
                >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
                <button
                    onClick={() => setGroupByCategory(!groupByCategory)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${groupByCategory
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    {groupByCategory ? '📁 Grouped' : '📋 Flat'}
                </button>
                {groupByCategory && (
                    <button
                        onClick={collapsedCategories.size > 0 ? expandAllCategories : collapseAllCategories}
                        className={`px-3 py-2 rounded-lg text-sm ${collapsedCategories.size > 0
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        title={collapsedCategories.size > 0 ? 'Expand all categories' : 'Collapse all categories'}
                    >
                        {collapsedCategories.size > 0 ? '⊞ Expand All' : '⊟ Collapse All'}
                    </button>
                )}
            </div>

            {/* Filters Panel */}
            {showFilters && (
                <div className="bg-white rounded-xl shadow-sm border p-4 grid grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                        <div className="flex flex-wrap gap-1">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setFilterCategory(prev =>
                                        prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                                    )}
                                    className={`px-2 py-0.5 rounded text-xs ${filterCategory.includes(cat) ? 'bg-blue-600 text-white' : 'bg-gray-100'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Source Type</label>
                        <div className="flex flex-wrap gap-1">
                            {SOURCE_TYPES.map(st => (
                                <button
                                    key={st}
                                    onClick={() => setFilterSourceType(prev =>
                                        prev.includes(st) ? prev.filter(s => s !== st) : [...prev, st]
                                    )}
                                    className={`px-2 py-0.5 rounded text-xs ${filterSourceType.includes(st) ? 'bg-blue-600 text-white' : 'bg-gray-100'
                                        }`}
                                >
                                    {st.replace('DATAFORSEO_', 'DFS_')}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Importance</label>
                        <div className="flex flex-wrap gap-1">
                            {IMPORTANCE_TIERS.map(tier => (
                                <button
                                    key={tier}
                                    onClick={() => setFilterTier(prev =>
                                        prev.includes(tier) ? prev.filter(t => t !== tier) : [...prev, tier]
                                    )}
                                    className={`px-2 py-0.5 rounded text-xs border ${filterTier.includes(tier) ? 'bg-blue-600 text-white border-blue-600' : getTierColor(tier)
                                        }`}
                                >
                                    {tier}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                        <select
                            value={filterEnabled}
                            onChange={(e) => setFilterEnabled(e.target.value)}
                            className="w-full px-3 py-1 border rounded"
                        >
                            <option value="all">All</option>
                            <option value="true">Enabled Only</option>
                            <option value="false">Disabled Only</option>
                        </select>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    {error}
                    <button onClick={() => setError(null)} className="ml-4 underline">Dismiss</button>
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div>
                    <table className="w-full text-xs">
                        <thead className="bg-slate-100 text-slate-700">
                            <tr>
                                <th className="px-1.5 py-2 text-left w-10">On</th>
                                <th
                                    className="px-1.5 py-2 text-left cursor-pointer hover:bg-slate-200 select-none max-w-[120px]"
                                    onClick={() => { setSortBy('surfaceKey'); setSortOrder(sortBy === 'surfaceKey' && sortOrder === 'asc' ? 'desc' : 'asc'); }}
                                >
                                    Key {sortBy === 'surfaceKey' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    className="px-1.5 py-2 text-left cursor-pointer hover:bg-slate-200 select-none"
                                    onClick={() => { setSortBy('label'); setSortOrder(sortBy === 'label' && sortOrder === 'asc' ? 'desc' : 'asc'); }}
                                >
                                    Label {sortBy === 'label' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    className="px-1.5 py-2 text-left cursor-pointer hover:bg-slate-200 select-none"
                                    onClick={() => { setSortBy('category'); setSortOrder(sortBy === 'category' && sortOrder === 'asc' ? 'desc' : 'asc'); }}
                                >
                                    Cat {sortBy === 'category' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    className="px-1.5 py-2 text-center cursor-pointer hover:bg-slate-200 select-none"
                                    onClick={() => { setSortBy('launchYear'); setSortOrder(sortBy === 'launchYear' && sortOrder === 'asc' ? 'desc' : 'asc'); }}
                                    title="Year launched"
                                >
                                    Est {sortBy === 'launchYear' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-1.5 py-2 text-center" title="Business impact level">
                                    Imp
                                </th>
                                <th className="px-1.5 py-2 text-left" title="What you lose without this surface">
                                    Why It Matters
                                </th>
                                <th
                                    className="px-1.5 py-2 text-center cursor-pointer hover:bg-slate-200 select-none"
                                    onClick={() => { setSortBy('basePoints'); setSortOrder(sortBy === 'basePoints' && sortOrder === 'asc' ? 'desc' : 'asc'); }}
                                >
                                    Pts {sortBy === 'basePoints' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    className="px-1.5 py-2 text-left cursor-pointer hover:bg-slate-200 select-none"
                                    onClick={() => { setSortBy('sourceType'); setSortOrder(sortBy === 'sourceType' && sortOrder === 'asc' ? 'desc' : 'asc'); }}
                                >
                                    Src {sortBy === 'sourceType' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-1.5 py-2 text-center w-16">Act</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={10} className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
                            ) : surfaces.length === 0 ? (
                                <tr><td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                                    No surfaces found. <button onClick={resetToDefaults} className="text-blue-600 underline">Seed defaults</button>
                                </td></tr>
                            ) : groupByCategory && groupedSurfaces ? (
                                // Grouped view
                                Object.entries(groupedSurfaces).map(([category, catSurfaces]) => (
                                    <>
                                        {/* Category Header Row - Clickable for collapse */}
                                        <tr
                                            key={`cat-${category}`}
                                            className="bg-slate-200 cursor-pointer hover:bg-slate-300"
                                            onClick={() => toggleCategoryCollapse(category)}
                                        >
                                            <td colSpan={10} className="px-2 py-1.5 font-semibold text-slate-700 text-xs">
                                                <span className="mr-2 text-gray-500">
                                                    {collapsedCategories.has(category) ? '▶' : '▼'}
                                                </span>
                                                <span className={`px-1 py-0.5 rounded text-[10px] ${getCategoryColor(category)}`}>
                                                    {category.toUpperCase()}
                                                </span>
                                                <span className="ml-2 text-[10px] text-slate-500">({catSurfaces.length})</span>
                                            </td>
                                        </tr>
                                        {/* Surfaces in this category - hidden when collapsed */}
                                        {!collapsedCategories.has(category) && catSurfaces.map(surface => (
                                            <tr key={surface.id} className="hover:bg-gray-50">
                                                <td className="px-1.5 py-1.5">
                                                    <button
                                                        onClick={() => toggleEnabled(surface)}
                                                        className={`w-8 h-4 rounded-full transition-colors ${surface.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                                                    >
                                                        <span className={`block w-3 h-3 bg-white rounded-full shadow transform transition-transform ${surface.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                                    </button>
                                                </td>
                                                <td className="px-1.5 py-1.5 max-w-[100px]">
                                                    <button
                                                        onClick={() => openKeySearch(surface)}
                                                        className="font-mono text-[10px] text-blue-600 hover:underline truncate block"
                                                        title={surface.surfaceKey}
                                                    >
                                                        {surface.surfaceKey.length > 18 ? surface.surfaceKey.slice(0, 15) + '...' : surface.surfaceKey}
                                                    </button>
                                                </td>
                                                <td className="px-1.5 py-1.5 font-medium text-[11px]" title={surface.label}>
                                                    {surface.label}
                                                </td>
                                                <td className="px-1.5 py-1.5">
                                                    <span className={`px-1 py-0.5 rounded text-[10px] ${getCategoryColor(surface.category)}`}>
                                                        {surface.category}
                                                    </span>
                                                </td>
                                                <td className="px-1.5 py-1.5 text-center" title={surface.technicalName || 'Unknown'}>
                                                    <span className="text-[11px] text-gray-600">{surface.launchYear || '—'}</span>
                                                </td>
                                                <td className="px-1.5 py-1.5 text-center">
                                                    {surface.businessImpact?.impactLevel ? (
                                                        <span className={`px-1 py-0.5 rounded text-[10px] ${surface.businessImpact.impactLevel === 'critical' ? 'bg-red-100 text-red-700' :
                                                            surface.businessImpact.impactLevel === 'high' ? 'bg-orange-100 text-orange-700' :
                                                                surface.businessImpact.impactLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                                                            }`}>
                                                            {surface.businessImpact.impactLevel.slice(0, 4).toUpperCase()}
                                                        </span>
                                                    ) : <span className="text-gray-400">—</span>}
                                                </td>
                                                <td className="px-1.5 py-1.5 text-[10px] text-gray-600 max-w-[180px]">
                                                    <span className="line-clamp-1" title={surface.businessImpact?.absenceImpact || ''}>{surface.businessImpact?.absenceImpact || '—'}</span>
                                                </td>
                                                <td className="px-1.5 py-1.5 text-center font-bold text-[11px]">{surface.basePoints}</td>
                                                <td className="px-1.5 py-1.5 text-[10px]">{surface.sourceType.replace('DATAFORSEO_', '').replace('MANUAL_REVIEW', 'MAN').replace('WEBSITE_CRAWL', 'CRAWL').slice(0, 8)}</td>
                                                <td className="px-1.5 py-1.5 text-center">
                                                    <button onClick={() => setShowDetail(surface)} className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] hover:bg-blue-200 mr-0.5" title="View details">👁</button>
                                                    <button onClick={() => deleteSurface(surface.id)} className="px-1 py-0.5 bg-red-100 text-red-700 rounded text-[10px] hover:bg-red-200" title="Delete">×</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </>
                                ))
                            ) : (
                                // Flat view
                                surfaces.map(surface => (
                                    <tr key={surface.id} className="hover:bg-gray-50">
                                        <td className="px-1.5 py-1.5">
                                            <button
                                                onClick={() => toggleEnabled(surface)}
                                                className={`w-8 h-4 rounded-full transition-colors ${surface.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                                            >
                                                <span className={`block w-3 h-3 bg-white rounded-full shadow transform transition-transform ${surface.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                            </button>
                                        </td>
                                        <td className="px-1.5 py-1.5 max-w-[100px]">
                                            <button
                                                onClick={() => openKeySearch(surface)}
                                                className="font-mono text-[10px] text-blue-600 hover:underline truncate block"
                                                title={surface.surfaceKey}
                                            >
                                                {surface.surfaceKey.length > 18 ? surface.surfaceKey.slice(0, 15) + '...' : surface.surfaceKey}
                                            </button>
                                        </td>
                                        <td className="px-1.5 py-1.5 font-medium text-[11px]" title={surface.label}>
                                            {surface.label}
                                        </td>
                                        <td className="px-1.5 py-1.5">
                                            <span className={`px-1 py-0.5 rounded text-[10px] ${getCategoryColor(surface.category)}`}>
                                                {surface.category}
                                            </span>
                                        </td>
                                        <td className="px-1.5 py-1.5 text-center" title={surface.technicalName || 'Unknown'}>
                                            <span className="text-[11px] text-gray-600">{surface.launchYear || '—'}</span>
                                        </td>
                                        <td className="px-1.5 py-1.5 text-center">
                                            {surface.businessImpact?.impactLevel ? (
                                                <span className={`px-1 py-0.5 rounded text-[10px] ${surface.businessImpact.impactLevel === 'critical' ? 'bg-red-100 text-red-700' :
                                                    surface.businessImpact.impactLevel === 'high' ? 'bg-orange-100 text-orange-700' :
                                                        surface.businessImpact.impactLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {surface.businessImpact.impactLevel.slice(0, 4).toUpperCase()}
                                                </span>
                                            ) : <span className="text-gray-400">—</span>}
                                        </td>
                                        <td className="px-1.5 py-1.5 text-[10px] text-gray-600 max-w-[180px]">
                                            <span className="line-clamp-1" title={surface.businessImpact?.absenceImpact || ''}>{surface.businessImpact?.absenceImpact || '—'}</span>
                                        </td>
                                        <td className="px-1.5 py-1.5 text-center font-bold text-[11px]">{surface.basePoints}</td>
                                        <td className="px-1.5 py-1.5 text-[10px]">{surface.sourceType.replace('DATAFORSEO_', '').replace('MANUAL_REVIEW', 'MAN').replace('WEBSITE_CRAWL', 'CRAWL').slice(0, 8)}</td>
                                        <td className="px-1.5 py-1.5 text-center">
                                            <button onClick={() => setShowDetail(surface)} className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] hover:bg-blue-200 mr-0.5" title="View details">👁</button>
                                            <button onClick={() => deleteSurface(surface.id)} className="px-1 py-0.5 bg-red-100 text-red-700 rounded text-[10px] hover:bg-red-200" title="Delete">×</button>
                                        </td>
                                    </tr>
                                )))}
                        </tbody>
                    </table>
                </div>
            </div >

            {/* Detail Drawer */}
            {
                showDetail && (
                    <div className="fixed inset-0 bg-black/30 flex justify-end z-50">
                        <div className="w-[600px] bg-white h-full overflow-y-auto shadow-xl">
                            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                                <div>
                                    <h2 className="text-xl font-bold">{showDetail.label}</h2>
                                    <p className="text-sm text-gray-500 font-mono">{showDetail.surfaceKey}</p>
                                </div>
                                <button onClick={() => { setShowDetail(null); setTestResult(null); }} className="text-2xl">×</button>
                            </div>
                            <div className="p-6 space-y-6">
                                {/* Info Grid */}
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div><span className="text-gray-500">Category:</span> <span className={`px-2 py-0.5 rounded ${getCategoryColor(showDetail.category)}`}>{showDetail.category}</span></div>
                                    <div><span className="text-gray-500">Tier:</span> <span className={`px-2 py-0.5 rounded border ${getTierColor(showDetail.importanceTier)}`}>{showDetail.importanceTier}</span></div>
                                    <div><span className="text-gray-500">Base Points:</span> <strong>{showDetail.basePoints}</strong></div>
                                    <div><span className="text-gray-500">Weight:</span> {showDetail.defaultRelevanceWeight}</div>
                                    <div><span className="text-gray-500">Source:</span> {showDetail.sourceType}</div>
                                    <div><span className="text-gray-500">Engine:</span> {showDetail.searchEngine || 'N/A'}</div>
                                    <div><span className="text-gray-500">Max Queries:</span> {showDetail.maxQueries}</div>
                                    <div><span className="text-gray-500">Officialness Required:</span> {showDetail.officialnessRequired ? 'Yes' : 'No'}</div>
                                </div>

                                {/* Query Templates */}
                                <div>
                                    <h3 className="font-semibold mb-2">Query Templates</h3>
                                    <div className="bg-gray-50 p-3 rounded text-sm font-mono space-y-1">
                                        {showDetail.queryTemplates?.length > 0 ? showDetail.queryTemplates.map((t, i) => (
                                            <div key={i}>{t}</div>
                                        )) : <div className="text-gray-400">None</div>}
                                    </div>
                                </div>

                                {/* Confirmation Artifact */}
                                <div>
                                    <h3 className="font-semibold mb-2">Confirmation Artifact</h3>
                                    <div className="bg-gray-50 p-3 rounded text-sm">{showDetail.confirmationArtifact}</div>
                                </div>

                                {/* Test Query Panel */}
                                <div className="border-t pt-4">
                                    <h3 className="font-semibold mb-3">🧪 Test Query</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            type="text"
                                            placeholder="Domain (e.g., motani.com)"
                                            value={testDomain}
                                            onChange={(e) => setTestDomain(e.target.value)}
                                            className="px-3 py-2 border rounded"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Brand name"
                                            value={testBrand}
                                            onChange={(e) => setTestBrand(e.target.value)}
                                            className="px-3 py-2 border rounded"
                                        />
                                    </div>
                                    <button
                                        onClick={runTest}
                                        disabled={testing || !testDomain || !testBrand}
                                        className="mt-3 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                                    >
                                        {testing ? 'Testing...' : 'Run Test'}
                                    </button>

                                    {/* Test Results */}
                                    {testResult && (
                                        <div className="mt-4 bg-gray-50 rounded p-4 space-y-3">
                                            <div>
                                                <strong>Queries Used:</strong>
                                                <div className="font-mono text-xs mt-1">{testResult.queries?.join(' | ') || 'None'}</div>
                                            </div>
                                            <div>
                                                <strong>Status:</strong>{' '}
                                                <span className={`px-2 py-0.5 rounded text-xs ${testResult.evaluation.status === 'present' ? 'bg-green-100 text-green-700' :
                                                    testResult.evaluation.status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                                                        testResult.evaluation.status === 'absent' ? 'bg-red-100 text-red-700' :
                                                            'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {testResult.evaluation.status.toUpperCase()}
                                                </span>
                                                {testResult.evaluation.officialness && <span className="ml-2 text-green-600">✓ Official</span>}
                                            </div>
                                            <div>
                                                <strong>Score Preview:</strong>{' '}
                                                <span className="font-bold">{testResult.scorePreview.finalScore}</span>
                                                <span className="text-gray-500 text-xs ml-2">
                                                    ({testResult.scorePreview.basePoints} × {testResult.scorePreview.weight} × {testResult.scorePreview.statusFactor})
                                                </span>
                                            </div>
                                            {testResult.results?.length > 0 && (
                                                <div>
                                                    <strong>Evidence ({testResult.results.length}):</strong>
                                                    <div className="mt-1 space-y-1 max-h-40 overflow-y-auto">
                                                        {testResult.results.map((r, i) => (
                                                            <a key={i} href={r.url} target="_blank" rel="noopener" className="block text-xs text-blue-600 hover:underline truncate">
                                                                {r.title || r.url}
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {testResult.error && (
                                                <div className="text-red-600 text-sm">Error: {testResult.error}</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Reset Confirm Modal */}
            {
                showResetConfirm && (
                    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
                            <h2 className="text-xl font-bold mb-4">⚠️ Reset to Defaults?</h2>
                            <p className="text-gray-600 mb-6">This will delete all current surfaces and restore the default set. This cannot be undone.</p>
                            <div className="flex gap-3">
                                <button onClick={() => setShowResetConfirm(false)} className="flex-1 px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">Cancel</button>
                                <button onClick={resetToDefaults} className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Reset</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Notes Modal */}
            {
                showNotesModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl p-6 w-[500px] shadow-2xl">
                            <h3 className="text-lg font-bold mb-2">📝 Notes for {showNotesModal.label}</h3>
                            <p className="text-sm text-gray-500 font-mono mb-4">{showNotesModal.surfaceKey}</p>
                            <textarea
                                value={notesText}
                                onChange={(e) => setNotesText(e.target.value)}
                                className="w-full h-40 border rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Add implementation notes, priorities, action items, or important points..."
                            />
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => { setShowNotesModal(null); setNotesText(''); }}
                                    className="flex-1 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveNotes}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    💾 Save Notes
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
