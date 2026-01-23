/**
 * Digital Footprint Scan Engine (HARDENED)
 * 
 * Executes AUTO_READY surfaces via crawl/DNS
 * Pre-creates all result rows for completeness
 * Uses standardized evidence schema for auditability
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { CanonicalEntity } from '@/types';
import * as dns from 'dns';
import { promisify } from 'util';

const resolveTxt = promisify(dns.resolveTxt);

// --- TYPES ---

export interface ScanConfig {
    clientId: string;
    clientName: string;
    mode: 'CRAWL_ONLY' | 'CRAWL_PLUS_PROVIDER';
    entity: CanonicalEntity | null;
}

export type ResultStatus =
    | 'PRESENT_CONFIRMED'
    | 'PRESENT_PARTIAL'
    | 'ABSENT'
    | 'NEEDS_ENTITY_INPUT'
    | 'MANUAL_REQUIRED'
    | 'REQUIRES_PROVIDER'
    | 'ERROR'
    | 'SKIPPED'
    | 'QUEUED';

// --- STANDARDIZED EVIDENCE SCHEMA ---

export interface StandardEvidence {
    target: {
        attemptedUrl: string | null;
        method: 'CRAWL' | 'DNS' | 'MANUAL' | null;
        provider: 'CRAWL' | 'DNS' | 'MANUAL' | 'OWNER_API' | 'SERP_PROVIDER' | null;
    };
    fetch: {
        httpStatus: number | null;
        finalUrl: string | null;
        redirectChain: string[];
        contentType: string | null;
        fetchedAt: string;
        timeoutMs: number;
    };
    match: {
        confidence: number;
        matchSignals: string[];
        mismatchSignals: string[];
    };
    extracted: {
        title: string | null;
        schemaTypes: string[];
        sameAsCount: number;
        detectedArtifacts: Record<string, unknown>;
        keyFields: Record<string, unknown>;
    };
    integrity: {
        contentHash: string | null;
        htmlSampleSnippet: string | null;
    };
    errors: {
        code: string | null;
        message: string | null;
        blockReason: string | null;
    };
    // DNS-specific fields
    dns?: {
        recordType: string;
        host: string;
        values: string[];
        parsedFlags: Record<string, unknown>;
    };
    // Missing input tracking
    missingFields?: string[];
}

// --- SOCIAL PLATFORM PATTERNS (for blocking detection) ---

const SOCIAL_PLATFORMS = ['linkedin', 'instagram', 'facebook', 'x.com', 'twitter', 'youtube', 'tiktok', 'pinterest'];

function isSocialPlatform(url: string): boolean {
    const lowerUrl = url.toLowerCase();
    return SOCIAL_PLATFORMS.some(p => lowerUrl.includes(p));
}

function isBlockingResponse(httpStatus: number, contentType: string | null, html?: string): string | null {
    // Common blocking patterns
    if (httpStatus === 401) return 'AUTH_REQUIRED';
    if (httpStatus === 403) return 'FORBIDDEN';
    if (httpStatus === 429) return 'RATE_LIMITED';
    if (httpStatus === 451) return 'LEGAL_BLOCK';

    // Check for consent/captcha pages
    if (html) {
        const lowerHtml = html.toLowerCase();
        if (lowerHtml.includes('captcha') || lowerHtml.includes('recaptcha')) return 'CAPTCHA';
        if (lowerHtml.includes('consent') && lowerHtml.includes('cookie')) return 'CONSENT_WALL';
        if (lowerHtml.includes('login') && lowerHtml.includes('sign in')) return 'LOGIN_REQUIRED';
    }

    return null;
}

// --- URL BUILDING ---

export function buildTargetUrl(
    entity: CanonicalEntity | null,
    rule: {
        surfaceKey: string;
        canonicalInputNeeded: string | null;
        discoveryApproach: string | null;
        checkMode: string | null;
    }
): { url: string | null; inputMissing: string[] } {
    const missingFields: string[] = [];

    if (!entity) {
        return { url: null, inputMissing: ['entity_profile'] };
    }

    const canonicalDomain = entity.web?.canonicalDomain;
    if (!canonicalDomain) {
        return { url: null, inputMissing: ['canonical_domain'] };
    }

    const surfaceKey = rule.surfaceKey;
    const inputNeeded = rule.canonicalInputNeeded?.toLowerCase();

    // Check for known profile URLs from entity
    const profileUrls: Record<string, { url: string | null; field: string }> = {
        'linkedin': {
            url: entity.profiles?.social?.linkedinCompanySlug
                ? `https://www.linkedin.com/company/${entity.profiles.social.linkedinCompanySlug}`
                : null,
            field: 'linkedin_slug'
        },
        'youtube': {
            url: entity.profiles?.social?.youtubeHandle
                ? `https://www.youtube.com/@${entity.profiles.social.youtubeHandle}`
                : null,
            field: 'youtube_handle'
        },
        'x': {
            url: entity.profiles?.social?.xHandle
                ? `https://x.com/${entity.profiles.social.xHandle}`
                : null,
            field: 'x_handle'
        },
        'twitter': {
            url: entity.profiles?.social?.xHandle
                ? `https://x.com/${entity.profiles.social.xHandle}`
                : null,
            field: 'x_handle'
        },
        'instagram': {
            url: entity.profiles?.social?.instagramHandle
                ? `https://www.instagram.com/${entity.profiles.social.instagramHandle}`
                : null,
            field: 'instagram_handle'
        },
        'facebook': {
            url: entity.profiles?.social?.facebookPage || null,
            field: 'facebook_page'
        },
        'crunchbase': { url: entity.profiles?.directories?.crunchbaseUrl || null, field: 'crunchbase_url' },
        'g2': { url: entity.profiles?.directories?.g2Url || null, field: 'g2_url' },
        'capterra': { url: entity.profiles?.directories?.capterraUrl || null, field: 'capterra_url' },
        'trustpilot': { url: entity.profiles?.directories?.trustpilotUrl || null, field: 'trustpilot_url' },
        'clutch': { url: entity.profiles?.directories?.clutchUrl || null, field: 'clutch_url' },
        'wikipedia': { url: entity.profiles?.knowledgeGraph?.wikipediaUrl || null, field: 'wikipedia_url' },
    };

    // Check if surface key matches a known profile
    for (const [key, { url, field }] of Object.entries(profileUrls)) {
        if (surfaceKey.toLowerCase().includes(key)) {
            if (url) {
                return { url, inputMissing: [] };
            } else {
                return { url: null, inputMissing: [field] };
            }
        }
    }

    // Check for deterministic paths based on surface key patterns
    const deterministicPaths: Record<string, string> = {
        'ROBOTS_TXT': '/robots.txt',
        'SITEMAP_XML': '/sitemap.xml',
        'SITEMAP': '/sitemap.xml',
        'LLMS_TXT': '/llms.txt',
        'AI_TXT': '/.well-known/ai.txt',
        'SECURITY_TXT': '/.well-known/security.txt',
        'FAVICON': '/favicon.ico',
        'APPLE_TOUCH_ICON': '/apple-touch-icon.png',
        'MANIFEST_JSON': '/manifest.json',
        'WEBMANIFEST': '/site.webmanifest',
        'HUMANS_TXT': '/humans.txt',
        'ADS_TXT': '/ads.txt',
        'APP_ADS_TXT': '/app-ads.txt',
        'CONTACT': '/contact',
        'ABOUT': '/about',
        'PRIVACY': '/privacy',
    };

    for (const [pattern, path] of Object.entries(deterministicPaths)) {
        if (surfaceKey.includes(pattern)) {
            return { url: `https://${canonicalDomain}${path}`, inputMissing: [] };
        }
    }

    // For homepage/website crawl
    if (surfaceKey.includes('WEBSITE') || surfaceKey.includes('HOMEPAGE') ||
        surfaceKey.includes('OWNED') || rule.checkMode === 'crawl_site') {
        return { url: `https://${canonicalDomain}`, inputMissing: [] };
    }

    // Check if we need specific input that's missing
    if (inputNeeded) {
        const inputMap: Record<string, () => string | null | undefined> = {
            'linkedin_slug': () => entity.profiles?.social?.linkedinCompanySlug,
            'youtube_handle': () => entity.profiles?.social?.youtubeHandle,
            'x_handle': () => entity.profiles?.social?.xHandle,
            'instagram_handle': () => entity.profiles?.social?.instagramHandle,
            'wikidata_qid': () => entity.profiles?.knowledgeGraph?.wikidataQid,
            'gbp_place_id': () => entity.profiles?.googleBusiness?.placeId,
        };

        for (const [key, getter] of Object.entries(inputMap)) {
            if (inputNeeded.includes(key)) {
                const value = getter();
                if (!value) {
                    missingFields.push(key);
                }
            }
        }

        if (missingFields.length > 0) {
            return { url: null, inputMissing: missingFields };
        }
    }

    // Default: try canonical domain for crawl
    if (rule.checkMode === 'crawl_url' || !rule.checkMode) {
        return { url: `https://${canonicalDomain}`, inputMissing: [] };
    }

    return { url: null, inputMissing: ['unknown_input'] };
}

// --- HTTP CRAWLER (HARDENED) ---

const CRAWL_TIMEOUT_MS = 15000;

export async function crawlUrl(url: string): Promise<StandardEvidence> {
    const fetchedAt = new Date().toISOString();
    const redirectChain: string[] = [];

    const evidence: StandardEvidence = {
        target: {
            attemptedUrl: url,
            method: 'CRAWL',
            provider: 'CRAWL',
        },
        fetch: {
            httpStatus: null,
            finalUrl: null,
            redirectChain: [],
            contentType: null,
            fetchedAt,
            timeoutMs: CRAWL_TIMEOUT_MS,
        },
        match: {
            confidence: 50,
            matchSignals: [],
            mismatchSignals: [],
        },
        extracted: {
            title: null,
            schemaTypes: [],
            sameAsCount: 0,
            detectedArtifacts: {},
            keyFields: {},
        },
        integrity: {
            contentHash: null,
            htmlSampleSnippet: null,
        },
        errors: {
            code: null,
            message: null,
            blockReason: null,
        },
    };

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), CRAWL_TIMEOUT_MS);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'KeywordNinja-FootprintScanner/1.0 (+https://keyword.ninja)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            redirect: 'follow',
            signal: controller.signal,
        });

        clearTimeout(timeout);

        // Track redirect
        if (response.url !== url) {
            redirectChain.push(url, response.url);
        }

        const contentType = response.headers.get('content-type');

        evidence.fetch.httpStatus = response.status;
        evidence.fetch.finalUrl = response.url;
        evidence.fetch.redirectChain = redirectChain;
        evidence.fetch.contentType = contentType;

        // For HTML responses, extract more info
        let html = '';
        if (contentType?.includes('text/html') || contentType?.includes('application/xhtml')) {
            html = await response.text();
            evidence.integrity.contentHash = simpleHash(html);
            evidence.integrity.htmlSampleSnippet = html.slice(0, 500);

            // Extract title
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch) {
                evidence.extracted.title = titleMatch[1].trim();
            }

            // Extract schema.org types
            evidence.extracted.schemaTypes = extractSchemaTypes(html);

            // Extract meta description
            const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
            if (descMatch) {
                evidence.extracted.keyFields.metaDescription = descMatch[1];
            }

            // Check for sameAs links
            evidence.extracted.sameAsCount = (html.match(/sameAs/gi) || []).length;

            // Check for blocking on social platforms
            if (isSocialPlatform(url)) {
                const blockReason = isBlockingResponse(response.status, contentType, html);
                if (blockReason) {
                    evidence.errors.blockReason = blockReason;
                }
            }
        }

        // For XML (sitemaps)
        if (contentType?.includes('text/xml') || contentType?.includes('application/xml')) {
            const xml = await response.text();
            const urlCount = (xml.match(/<loc>/g) || []).length;
            evidence.extracted.detectedArtifacts.urlCount = urlCount;
            evidence.integrity.contentHash = simpleHash(xml);
        }

        // For robots.txt
        if (url.endsWith('/robots.txt') && response.status === 200) {
            const text = await response.text();
            evidence.extracted.detectedArtifacts.hasSitemap = text.toLowerCase().includes('sitemap:');
            evidence.extracted.detectedArtifacts.hasDisallow = text.toLowerCase().includes('disallow:');
            evidence.integrity.contentHash = simpleHash(text);
        }

        return evidence;

    } catch (error) {
        evidence.errors.code = 'FETCH_ERROR';
        evidence.errors.message = error instanceof Error ? error.message : 'Unknown error';

        if (error instanceof Error && error.name === 'AbortError') {
            evidence.errors.code = 'TIMEOUT';
        }

        return evidence;
    }
}

// --- DNS RESOLVER (HARDENED) ---

export async function queryDns(domain: string, recordType: string): Promise<StandardEvidence> {
    const fetchedAt = new Date().toISOString();

    // Determine the DNS query domain based on record type
    let queryDomain = domain;
    if (recordType === 'DMARC') queryDomain = `_dmarc.${domain}`;
    else if (recordType === 'DKIM') queryDomain = `default._domainkey.${domain}`;
    else if (recordType === 'MTA-STS') queryDomain = `_mta-sts.${domain}`;
    else if (recordType === 'BIMI') queryDomain = `default._bimi.${domain}`;
    else if (recordType === 'TLS-RPT') queryDomain = `_smtp._tls.${domain}`;

    const evidence: StandardEvidence = {
        target: {
            attemptedUrl: queryDomain,
            method: 'DNS',
            provider: 'DNS',
        },
        fetch: {
            httpStatus: null,
            finalUrl: null,
            redirectChain: [],
            contentType: null,
            fetchedAt,
            timeoutMs: 5000,
        },
        match: {
            confidence: 50,
            matchSignals: [],
            mismatchSignals: [],
        },
        extracted: {
            title: null,
            schemaTypes: [],
            sameAsCount: 0,
            detectedArtifacts: {},
            keyFields: {},
        },
        integrity: {
            contentHash: null,
            htmlSampleSnippet: null,
        },
        errors: {
            code: null,
            message: null,
            blockReason: null,
        },
        dns: {
            recordType,
            host: queryDomain,
            values: [],
            parsedFlags: {},
        },
    };

    try {
        const records = await resolveTxt(queryDomain);
        const flatRecords = records.map(r => r.join(''));

        evidence.dns!.values = flatRecords;
        evidence.dns!.parsedFlags = parseSecurityRecord(recordType, flatRecords);

        return evidence;

    } catch (error) {
        evidence.errors.code = 'DNS_ERROR';
        evidence.errors.message = error instanceof Error ? error.message : 'DNS lookup failed';

        if (error instanceof Error) {
            if (error.message.includes('ENOTFOUND')) evidence.errors.code = 'NXDOMAIN';
            if (error.message.includes('ENODATA')) evidence.errors.code = 'NO_RECORD';
        }

        return evidence;
    }
}

function parseSecurityRecord(recordType: string, records: string[]): Record<string, unknown> {
    const parsed: Record<string, unknown> = {};

    if (records.length === 0) {
        parsed.exists = false;
        return parsed;
    }

    parsed.exists = true;
    const record = records[0];

    if (recordType === 'DMARC') {
        const policyMatch = record.match(/p=([^;]+)/);
        parsed.dmarcPolicy = policyMatch ? policyMatch[1] : 'none';
        parsed.isStrict = parsed.dmarcPolicy === 'reject' || parsed.dmarcPolicy === 'quarantine';
        const ruaMatch = record.match(/rua=([^;]+)/);
        if (ruaMatch) parsed.reportingAddress = ruaMatch[1];
    } else if (recordType === 'SPF') {
        parsed.spfPresent = record.startsWith('v=spf1');
        parsed.hasHardFail = record.includes('-all');
        parsed.hasSoftFail = record.includes('~all');
    } else if (recordType === 'DKIM') {
        parsed.dkimPresent = record.includes('p=');
    } else if (recordType === 'MTA-STS') {
        parsed.mtaStsPresent = record.includes('v=STSv1');
    } else if (recordType === 'BIMI') {
        parsed.bimiPresent = record.includes('v=BIMI1');
        const lMatch = record.match(/l=([^;]+)/);
        if (lMatch) parsed.logoUrl = lMatch[1];
    }

    return parsed;
}

// --- STATUS DETERMINATION (HARDENED) ---

export function determineStatus(
    evidence: StandardEvidence,
    isSocialUrl: boolean
): ResultStatus {
    // Check for errors
    if (evidence.errors.code) {
        if (evidence.errors.code === 'NXDOMAIN' || evidence.errors.code === 'NO_RECORD') {
            return 'ABSENT';
        }
        if (evidence.errors.code === 'TIMEOUT') {
            return 'ERROR';
        }
        return 'ERROR';
    }

    // DNS check
    if (evidence.target.method === 'DNS') {
        if (evidence.dns?.parsedFlags.exists === false) {
            return 'ABSENT';
        }
        if (evidence.dns?.parsedFlags.isStrict || evidence.dns?.parsedFlags.hasHardFail) {
            return 'PRESENT_CONFIRMED';
        }
        return 'PRESENT_PARTIAL';
    }

    // HTTP crawl check
    const httpStatus = evidence.fetch.httpStatus;

    if (httpStatus === null || httpStatus === 0) {
        return 'ERROR';
    }

    // Social platform blocking → MANUAL_REQUIRED (not ABSENT)
    if (isSocialUrl && evidence.errors.blockReason) {
        return 'MANUAL_REQUIRED';
    }

    // Blocking responses for social platforms
    if (isSocialUrl && (httpStatus === 401 || httpStatus === 403)) {
        return 'MANUAL_REQUIRED';
    }

    if (httpStatus >= 200 && httpStatus < 300) {
        // Check for rich content signals
        if (evidence.extracted.schemaTypes.length > 0 ||
            evidence.extracted.sameAsCount > 0 ||
            Object.keys(evidence.extracted.detectedArtifacts).length > 0) {
            return 'PRESENT_CONFIRMED';
        }
        return 'PRESENT_PARTIAL';
    }

    if (httpStatus === 404 || httpStatus === 410) {
        return 'ABSENT';
    }

    if (httpStatus >= 400) {
        return 'PRESENT_PARTIAL';
    }

    return 'PRESENT_PARTIAL';
}

// --- CONFIDENCE SCORING (CONSISTENT) ---

export function calculateConfidence(
    evidence: StandardEvidence,
    entity: CanonicalEntity | null,
    status: ResultStatus
): { confidence: number; matchSignals: string[]; mismatchSignals: string[] } {
    let confidence = 50; // Base
    const matchSignals: string[] = [];
    const mismatchSignals: string[] = [];

    if (!evidence || status === 'ERROR' || status === 'ABSENT') {
        return { confidence: 20, matchSignals: [], mismatchSignals: [] };
    }

    if (status === 'NEEDS_ENTITY_INPUT' || status === 'MANUAL_REQUIRED' || status === 'QUEUED') {
        return { confidence: 30, matchSignals: [], mismatchSignals: [] };
    }

    // +30 for domain match
    if (evidence.fetch.finalUrl && entity?.web?.canonicalDomain) {
        try {
            const finalDomain = new URL(evidence.fetch.finalUrl).hostname.replace(/^www\./, '');
            const canonicalDomain = entity.web.canonicalDomain.replace(/^www\./, '');

            if (finalDomain === canonicalDomain || finalDomain.endsWith('.' + canonicalDomain)) {
                confidence += 30;
                matchSignals.push('domain_match');
            } else {
                mismatchSignals.push('domain_mismatch');
            }
        } catch {
            // URL parsing error
        }
    }

    // +10 for legal name match (if available in page title)
    if (evidence.extracted.title && entity?.names?.legal) {
        const titleLower = evidence.extracted.title.toLowerCase();
        const legalLower = entity.names.legal.toLowerCase();
        if (titleLower.includes(legalLower) || legalLower.includes(titleLower.split(' ')[0])) {
            confidence += 10;
            matchSignals.push('legal_name_match');
        }
    }

    // +10 for schema.org presence
    if (evidence.extracted.schemaTypes.length > 0) {
        confidence += 10;
        matchSignals.push('schema_org_present');
    }

    // +10 for sameAs links
    if (evidence.extracted.sameAsCount > 0) {
        confidence += 10;
        matchSignals.push('sameas_links_found');
    }

    // +20 for DNS strict policies
    if (evidence.dns?.parsedFlags.isStrict || evidence.dns?.parsedFlags.hasHardFail) {
        confidence += 20;
        matchSignals.push('strict_policy');
    }

    // Clamp 0-100
    confidence = Math.min(100, Math.max(0, confidence));

    return { confidence, matchSignals, mismatchSignals };
}

// --- HELPERS ---

function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < Math.min(str.length, 10000); i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16);
}

function extractSchemaTypes(html: string): string[] {
    const types: Set<string> = new Set();

    // JSON-LD
    const jsonLdMatches = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([^<]+)<\/script>/gi));
    for (const match of jsonLdMatches) {
        try {
            const data = JSON.parse(match[1]);
            if (data['@type']) types.add(data['@type']);
        } catch {
            // Ignore parse errors
        }
    }

    // Microdata
    const itemtypeMatches = Array.from(html.matchAll(/itemtype=["']([^"']+)["']/gi));
    for (const match of itemtypeMatches) {
        const type = match[1].split('/').pop();
        if (type) types.add(type);
    }

    return Array.from(types);
}

// --- PLAN STATUS HELPER ---

function determinePlanStatus(
    evidenceProvider: string | null,
    sourceType: string | null,
    hasPlaybook: boolean,
    entity: CanonicalEntity | null,
    canonicalInputNeeded: string | null
): { status: ResultStatus; missingFields: string[] } {
    // Manual required
    if (hasPlaybook || sourceType === 'MANUAL_REVIEW' || evidenceProvider?.toUpperCase() === 'MANUAL') {
        return { status: 'MANUAL_REQUIRED', missingFields: [] };
    }

    // Requires provider
    if (['SERP_PROVIDER', 'SUGGEST_PROVIDER', 'OWNER_API'].includes(evidenceProvider?.toUpperCase() || '')) {
        return { status: 'REQUIRES_PROVIDER', missingFields: [] };
    }

    // Check for missing entity inputs
    if (!entity) {
        return { status: 'NEEDS_ENTITY_INPUT', missingFields: ['entity_profile'] };
    }

    if (!entity.web?.canonicalDomain) {
        return { status: 'NEEDS_ENTITY_INPUT', missingFields: ['canonical_domain'] };
    }

    // Auto-ready (will be set to QUEUED)
    return { status: 'QUEUED', missingFields: [] };
}

// --- MAIN SCAN EXECUTOR (HARDENED) ---

export async function executeScan(config: ScanConfig): Promise<string> {
    console.log(`🚀 Starting scan for client: ${config.clientName}`);

    // 1. Create scan record
    const scan = await (prisma.digitalFootprintScan as any).create({
        data: {
            clientId: config.clientId,
            clientName: config.clientName,
            mode: config.mode,
            status: 'RUNNING',
        },
    });

    console.log(`📋 Created scan: ${scan.id}`);

    // 2. Load ALL enabled surfaces with active rules
    const surfaces = await (prisma.footprintSurface as any).findMany({
        where: { enabled: true },
        include: {
            rules: {
                where: { isActive: true },
                include: { playbook: true },
                take: 1,
            },
        },
    });

    console.log(`📊 Found ${surfaces.length} enabled surfaces`);

    // 3. PRE-CREATE all result rows with placeholder statuses
    console.log('📝 Pre-creating result rows...');

    const resultRows: Array<{
        id: string;
        surfaceKey: string;
        surfaceLabel: string;
        category: string;
        importanceTier: string;
        status: ResultStatus;
        ruleId: string | null;
        evidenceProvider: string | null;
        checkMode: string | null;
        canonicalInputNeeded: string | null;
        missingFields: string[];
    }> = [];

    for (const surface of surfaces) {
        const rule = surface.rules[0];
        const { status, missingFields } = determinePlanStatus(
            rule?.evidenceProvider || null,
            rule?.sourceType || null,
            !!rule?.playbook,
            config.entity,
            rule?.canonicalInputNeeded || null
        );

        // Create result row with placeholder status
        const result = await (prisma.digitalFootprintScanResult as any).create({
            data: {
                scanId: scan.id,
                surfaceKey: surface.surfaceKey,
                surfaceRuleId: rule?.id,
                surfaceLabel: surface.label,
                category: surface.category,
                importanceTier: surface.importanceTier,
                status,
                confidence: status === 'QUEUED' ? 50 : 30,
                evidence: missingFields.length > 0
                    ? ({ missingFields } as unknown as Prisma.JsonObject)
                    : Prisma.DbNull,
            },
        });

        resultRows.push({
            id: result.id,
            surfaceKey: surface.surfaceKey,
            surfaceLabel: surface.label,
            category: surface.category,
            importanceTier: surface.importanceTier,
            status,
            ruleId: rule?.id || null,
            evidenceProvider: rule?.evidenceProvider || null,
            checkMode: rule?.checkMode || null,
            canonicalInputNeeded: rule?.canonicalInputNeeded || null,
            missingFields,
        });
    }

    console.log(`✅ Pre-created ${resultRows.length} result rows`);

    // 4. Process QUEUED surfaces (AUTO_READY)
    const queuedRows = resultRows.filter(r => r.status === 'QUEUED');
    console.log(`🔄 Processing ${queuedRows.length} QUEUED surfaces...`);

    const counts: Record<string, number> = {};

    for (const row of queuedRows) {
        let finalStatus: ResultStatus = row.status;
        let evidence: StandardEvidence | null = null;
        let errorMessage: string | null = null;

        try {
            const evidenceProvider = row.evidenceProvider?.toUpperCase();

            if (evidenceProvider === 'DNS' || row.checkMode?.includes('dns')) {
                // DNS scan
                const domain = config.entity?.web?.canonicalDomain;
                if (domain) {
                    let recordType = 'TXT';
                    if (row.surfaceKey.includes('DMARC')) recordType = 'DMARC';
                    else if (row.surfaceKey.includes('SPF')) recordType = 'SPF';
                    else if (row.surfaceKey.includes('DKIM')) recordType = 'DKIM';
                    else if (row.surfaceKey.includes('MTA_STS')) recordType = 'MTA-STS';
                    else if (row.surfaceKey.includes('BIMI')) recordType = 'BIMI';
                    else if (row.surfaceKey.includes('TLS_RPT')) recordType = 'TLS-RPT';

                    evidence = await queryDns(domain, recordType);
                    finalStatus = determineStatus(evidence, false);
                }
            } else {
                // HTTP crawl
                const urlResult = buildTargetUrl(config.entity, {
                    surfaceKey: row.surfaceKey,
                    canonicalInputNeeded: row.canonicalInputNeeded,
                    discoveryApproach: null,
                    checkMode: row.checkMode,
                });

                if (urlResult.url) {
                    const isSocialUrl = isSocialPlatform(urlResult.url);
                    evidence = await crawlUrl(urlResult.url);
                    finalStatus = determineStatus(evidence, isSocialUrl);
                } else {
                    finalStatus = 'NEEDS_ENTITY_INPUT';
                    evidence = {
                        target: { attemptedUrl: null, method: null, provider: null },
                        fetch: { httpStatus: null, finalUrl: null, redirectChain: [], contentType: null, fetchedAt: new Date().toISOString(), timeoutMs: 0 },
                        match: { confidence: 30, matchSignals: [], mismatchSignals: [] },
                        extracted: { title: null, schemaTypes: [], sameAsCount: 0, detectedArtifacts: {}, keyFields: {} },
                        integrity: { contentHash: null, htmlSampleSnippet: null },
                        errors: { code: null, message: null, blockReason: null },
                        missingFields: urlResult.inputMissing,
                    };
                }
            }

            // Calculate confidence with signals
            if (evidence) {
                const scoring = calculateConfidence(evidence, config.entity, finalStatus);
                evidence.match.confidence = scoring.confidence;
                evidence.match.matchSignals = scoring.matchSignals;
                evidence.match.mismatchSignals = scoring.mismatchSignals;
            }

        } catch (error) {
            finalStatus = 'ERROR';
            errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Error scanning ${row.surfaceKey}:`, error);
        }

        // Update counts
        counts[finalStatus] = (counts[finalStatus] || 0) + 1;

        // Update result row
        await (prisma.digitalFootprintScanResult as any).update({
            where: { id: row.id },
            data: {
                status: finalStatus,
                confidence: evidence?.match.confidence || 30,
                evidence: evidence ? (evidence as unknown as Prisma.JsonObject) : Prisma.DbNull,
                errorMessage,
                checkedAt: new Date(),
            },
        });

        process.stdout.write('.');
    }

    console.log('\n');

    // 5. Count non-queued rows
    for (const row of resultRows.filter(r => r.status !== 'QUEUED')) {
        counts[row.status] = (counts[row.status] || 0) + 1;
    }

    // 6. Update scan with summary
    const presentCount = (counts['PRESENT_CONFIRMED'] || 0) + (counts['PRESENT_PARTIAL'] || 0);
    const summary = {
        counts,
        total: surfaces.length,
        presentCount,
        absentCount: counts['ABSENT'] || 0,
        score: Math.round(((counts['PRESENT_CONFIRMED'] || 0) + (counts['PRESENT_PARTIAL'] || 0) * 0.5) / surfaces.length * 100),
    };

    await (prisma.digitalFootprintScan as any).update({
        where: { id: scan.id },
        data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            summary: summary as unknown as Prisma.JsonObject,
        },
    });

    console.log(`✅ Scan completed: ${scan.id}`);
    console.log(`   Total: ${surfaces.length}, Present: ${presentCount}, Absent: ${counts['ABSENT'] || 0}, Score: ${summary.score}%`);

    return scan.id;
}

