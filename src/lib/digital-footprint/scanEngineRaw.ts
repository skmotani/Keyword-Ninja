/**
 * Digital Footprint Scan Engine (RAW SQL VERSION)
 * 
 * Uses raw SQL queries to bypass stale Prisma client issues
 * Processes AUTO_READY surfaces and updates statuses
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { CanonicalEntity } from '@/types';
import { randomUUID } from 'crypto';
import * as dns from 'dns';
import { promisify } from 'util';

const resolveTxt = promisify(dns.resolveTxt);

// Types
export interface ScanConfig {
    clientId: string;
    clientName: string;
    mode: 'CRAWL_ONLY' | 'CRAWL_PLUS_PROVIDER';
    entity: CanonicalEntity | null;
}

type ResultStatus =
    | 'QUEUED'
    | 'PRESENT_CONFIRMED'
    | 'PRESENT_PARTIAL'
    | 'ABSENT'
    | 'MANUAL_REQUIRED'
    | 'NEEDS_ENTITY_INPUT'
    | 'REQUIRES_PROVIDER'
    | 'ERROR';

interface StandardEvidence {
    target: {
        attemptedUrl: string | null;
        method: 'CRAWL' | 'DNS' | 'MANUAL' | null;
        provider: string | null;
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
    dns?: {
        recordType: string;
        host: string;
        values: string[];
        parsedFlags: Record<string, unknown>;
    };
}

// Social platform detection
const SOCIAL_PLATFORMS = ['linkedin', 'instagram', 'facebook', 'x.com', 'twitter', 'youtube', 'tiktok', 'pinterest'];

function isSocialPlatform(url: string): boolean {
    const lower = url.toLowerCase();
    return SOCIAL_PLATFORMS.some(p => lower.includes(p));
}

// Crawl URL with timeout
const CRAWL_TIMEOUT_MS = 15000;

async function crawlUrl(url: string): Promise<StandardEvidence> {
    const startTime = Date.now();
    const evidence: StandardEvidence = {
        target: { attemptedUrl: url, method: 'CRAWL', provider: 'CRAWL' },
        fetch: { httpStatus: null, finalUrl: null, redirectChain: [], contentType: null, fetchedAt: new Date().toISOString(), timeoutMs: 0 },
        match: { confidence: 50, matchSignals: [], mismatchSignals: [] },
        extracted: { title: null, schemaTypes: [], sameAsCount: 0, detectedArtifacts: {}, keyFields: {} },
        integrity: { contentHash: null, htmlSampleSnippet: null },
        errors: { code: null, message: null, blockReason: null },
    };

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CRAWL_TIMEOUT_MS);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            redirect: 'follow',
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        evidence.fetch.httpStatus = response.status;
        evidence.fetch.finalUrl = response.url;
        evidence.fetch.contentType = response.headers.get('content-type');
        evidence.fetch.timeoutMs = Date.now() - startTime;

        // Check for blocking responses (401, 403)
        if (response.status === 401 || response.status === 403) {
            evidence.errors.code = 'BLOCKED';
            evidence.errors.blockReason = `HTTP ${response.status}`;
        }

        // Parse HTML for signals
        if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
            const html = await response.text();
            evidence.integrity.htmlSampleSnippet = html.slice(0, 500);

            // Extract title
            const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
            if (titleMatch) evidence.extracted.title = titleMatch[1].trim();

            // Simple hash
            evidence.integrity.contentHash = simpleHash(html);
        }

    } catch (error) {
        const err = error as Error;
        evidence.errors.code = 'FETCH_ERROR';
        evidence.errors.message = err.name === 'AbortError' ? 'Timeout' : err.message;
        evidence.fetch.timeoutMs = Date.now() - startTime;
    }

    return evidence;
}

// Simple hash function
function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}

// DNS query
async function queryDns(domain: string, recordType: string): Promise<StandardEvidence> {
    const evidence: StandardEvidence = {
        target: { attemptedUrl: null, method: 'DNS', provider: 'DNS' },
        fetch: { httpStatus: null, finalUrl: null, redirectChain: [], contentType: null, fetchedAt: new Date().toISOString(), timeoutMs: 0 },
        match: { confidence: 50, matchSignals: [], mismatchSignals: [] },
        extracted: { title: null, schemaTypes: [], sameAsCount: 0, detectedArtifacts: {}, keyFields: {} },
        integrity: { contentHash: null, htmlSampleSnippet: null },
        errors: { code: null, message: null, blockReason: null },
    };

    try {
        let host = domain;
        if (recordType === 'DMARC') host = `_dmarc.${domain}`;
        else if (recordType === 'MTA-STS') host = `_mta-sts.${domain}`;
        else if (recordType === 'TLS-RPT') host = `_smtp._tls.${domain}`;
        else if (recordType === 'BIMI') host = `default._bimi.${domain}`;

        const records = await resolveTxt(host);
        const flatRecords = records.map(r => r.join(''));

        evidence.dns = {
            recordType,
            host,
            values: flatRecords,
            parsedFlags: {},
        };

        // Check for specific records
        if (recordType === 'SPF' && flatRecords.some(r => r.includes('v=spf1'))) {
            evidence.match.matchSignals.push('SPF_PRESENT');
        }
        if (recordType === 'DMARC' && flatRecords.some(r => r.includes('v=DMARC1'))) {
            evidence.match.matchSignals.push('DMARC_PRESENT');
        }

    } catch (error) {
        const err = error as Error;
        evidence.errors.code = 'DNS_ERROR';
        evidence.errors.message = err.message;
    }

    return evidence;
}

// Determine status from evidence
function determineStatus(evidence: StandardEvidence, isSocialUrl: boolean): ResultStatus {
    // Check for errors
    if (evidence.errors.code) {
        if (evidence.errors.code === 'BLOCKED' && isSocialUrl) {
            return 'MANUAL_REQUIRED';
        }
        return 'ERROR';
    }

    // DNS check
    if (evidence.dns) {
        if (evidence.dns.values.length > 0 && evidence.match.matchSignals.length > 0) {
            return 'PRESENT_CONFIRMED';
        }
        if (evidence.dns.values.length > 0) {
            return 'PRESENT_PARTIAL';
        }
        return 'ABSENT';
    }

    // HTTP check
    const status = evidence.fetch.httpStatus;
    if (status === null) return 'ERROR';

    if (status === 401 || status === 403) {
        return isSocialUrl ? 'MANUAL_REQUIRED' : 'ABSENT';
    }

    if (status >= 200 && status < 300) {
        return 'PRESENT_CONFIRMED';
    }

    if (status >= 300 && status < 400) {
        return 'PRESENT_PARTIAL';
    }

    if (status === 404) {
        return 'ABSENT';
    }

    return 'ERROR';
}

// Build target URL for a surface
function buildTargetUrl(entity: CanonicalEntity | null, surfaceKey: string, canonicalInputNeeded: string | null): string | null {
    if (!entity?.web?.canonicalDomain) return null;

    const domain = entity.web.canonicalDomain;

    // Simple URL building based on surface key patterns
    const key = surfaceKey.toLowerCase();

    if (key.includes('homepage')) return `https://${domain}/`;
    if (key.includes('schema_org')) return `https://${domain}/`;
    if (key.includes('robots_txt')) return `https://${domain}/robots.txt`;
    if (key.includes('sitemap')) return `https://${domain}/sitemap.xml`;
    if (key.includes('security_txt')) return `https://${domain}/.well-known/security.txt`;
    if (key.includes('favicon')) return `https://${domain}/favicon.ico`;
    if (key.includes('linkedin') && entity.profiles?.social?.linkedinCompanySlug) {
        return `https://www.linkedin.com/company/${entity.profiles.social.linkedinCompanySlug}`;
    }
    if (key.includes('twitter') || key.includes('x_profile')) {
        if (entity.profiles?.social?.xHandle) return `https://x.com/${entity.profiles.social.xHandle}`;
    }
    if (key.includes('youtube') && entity.profiles?.social?.youtubeHandle) {
        return `https://www.youtube.com/@${entity.profiles.social.youtubeHandle}`;
    }
    if (key.includes('facebook') && entity.profiles?.social?.facebookPage) {
        return `https://www.facebook.com/${entity.profiles.social.facebookPage}`;
    }
    if (key.includes('instagram') && entity.profiles?.social?.instagramHandle) {
        return `https://www.instagram.com/${entity.profiles.social.instagramHandle}`;
    }

    // Default to homepage check
    return `https://${domain}/`;
}

// Main executor using raw SQL
export async function executeScanRaw(config: ScanConfig): Promise<string> {
    console.log(`🚀 [RAW] Starting scan for client: ${config.clientName}`);

    const scanId = randomUUID();
    const now = new Date();

    // 1. Create scan record via raw SQL
    await prisma.$executeRaw`
        INSERT INTO digital_footprint_scans 
        (id, "clientId", "clientName", mode, status, "startedAt", "createdAt", "updatedAt")
        VALUES (${scanId}, ${config.clientId}, ${config.clientName}, ${config.mode}, 'RUNNING', ${now}, ${now}, ${now})
    `;

    console.log(`📋 [RAW] Created scan: ${scanId}`);

    // 2. Load enabled surfaces with active rules via raw SQL
    const surfaces = await prisma.$queryRaw<Array<{
        id: string;
        surfaceKey: string;
        label: string;
        category: string;
        importanceTier: string;
        ruleId: string | null;
        evidenceProvider: string | null;
        sourceType: string | null;
        checkMode: string | null;
        canonicalInputNeeded: string | null;
        hasPlaybook: boolean;
    }>>`
        SELECT 
            fs.id,
            fs."surfaceKey",
            fs.label,
            fs.category,
            fs."importanceTier",
            fsr.id as "ruleId",
            fsr."evidenceProvider",
            fsr."sourceType",
            fsr."checkMode",
            fsr."canonicalInputNeeded",
            (fsp.id IS NOT NULL) as "hasPlaybook"
        FROM footprint_surfaces fs
        LEFT JOIN footprint_surface_rules fsr ON fs.id = fsr."surfaceId" AND fsr."isActive" = true
        LEFT JOIN footprint_surface_manual_playbooks fsp ON fsr.id = fsp."ruleId"
        WHERE fs.enabled = true
        ORDER BY fs.category, fs."importanceTier"
    `;

    console.log(`📊 [RAW] Found ${surfaces.length} enabled surfaces`);

    // 3. Pre-create result rows and track AUTO_READY
    const resultRows: Array<{
        id: string;
        surfaceKey: string;
        initialStatus: ResultStatus;
        ruleId: string | null;
        evidenceProvider: string | null;
        checkMode: string | null;
        canonicalInputNeeded: string | null;
    }> = [];

    let autoReadyCount = 0;

    for (const surface of surfaces) {
        // Determine initial status
        let initialStatus: ResultStatus = 'QUEUED';

        if (surface.hasPlaybook || surface.sourceType === 'MANUAL_REVIEW' || surface.evidenceProvider?.toUpperCase() === 'MANUAL') {
            initialStatus = 'MANUAL_REQUIRED';
        } else if (['SERP_PROVIDER', 'SUGGEST_PROVIDER', 'OWNER_API'].includes(surface.evidenceProvider?.toUpperCase() || '')) {
            initialStatus = 'REQUIRES_PROVIDER';
        } else if (!config.entity?.web?.canonicalDomain) {
            initialStatus = 'NEEDS_ENTITY_INPUT';
        } else {
            // AUTO_READY - will be processed
            autoReadyCount++;
        }

        const resultId = randomUUID();

        const emptyEvidence = JSON.stringify({});

        // Create result row
        await prisma.$executeRaw`
            INSERT INTO digital_footprint_scan_results 
            (id, "scanId", "surfaceKey", "surfaceLabel", "surfaceRuleId", category, "importanceTier", status, confidence, evidence, "createdAt", "updatedAt")
            VALUES (
                ${resultId}, 
                ${scanId}, 
                ${surface.surfaceKey}, 
                ${surface.label}, 
                ${surface.ruleId}, 
                ${surface.category}, 
                ${surface.importanceTier}, 
                ${initialStatus}, 
                ${initialStatus === 'QUEUED' ? 50 : 30}, 
                ${emptyEvidence}::jsonb,
                ${now}, 
                ${now}
            )
        `;

        if (initialStatus === 'QUEUED') {
            resultRows.push({
                id: resultId,
                surfaceKey: surface.surfaceKey,
                initialStatus,
                ruleId: surface.ruleId,
                evidenceProvider: surface.evidenceProvider,
                checkMode: surface.checkMode,
                canonicalInputNeeded: surface.canonicalInputNeeded,
            });
        }
    }

    console.log(`📝 [RAW] Pre-created ${surfaces.length} result rows, ${autoReadyCount} AUTO_READY surfaces`);

    // 4. Process AUTO_READY surfaces
    const counts: Record<string, number> = {};
    let processedCount = 0;

    for (const row of resultRows) {
        let finalStatus: ResultStatus = row.initialStatus;
        let evidence: StandardEvidence | null = null;

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

                    evidence = await queryDns(domain, recordType);
                    finalStatus = determineStatus(evidence, false);
                }
            } else {
                // HTTP crawl
                const targetUrl = buildTargetUrl(config.entity, row.surfaceKey, row.canonicalInputNeeded);

                if (targetUrl) {
                    const isSocialUrl = isSocialPlatform(targetUrl);
                    evidence = await crawlUrl(targetUrl);
                    finalStatus = determineStatus(evidence, isSocialUrl);
                } else {
                    finalStatus = 'NEEDS_ENTITY_INPUT';
                }
            }

        } catch (error) {
            finalStatus = 'ERROR';
            console.error(`   ❌ Error scanning ${row.surfaceKey}:`, error);
        }

        // Update counts
        counts[finalStatus] = (counts[finalStatus] || 0) + 1;

        // Update result row with final status
        const evidenceJson = JSON.stringify(evidence || {});
        await prisma.$executeRaw`
            UPDATE digital_footprint_scan_results
            SET 
                status = ${finalStatus},
                confidence = ${evidence?.match.confidence || 30},
                evidence = ${evidenceJson}::jsonb,
                "checkedAt" = ${new Date()},
                "updatedAt" = ${new Date()}
            WHERE id = ${row.id}
        `;

        processedCount++;
        console.log(`   ✓ [${processedCount}/${resultRows.length}] ${row.surfaceKey} → ${finalStatus}`);
    }

    // Count non-QUEUED statuses for surfaces that weren't AUTO_READY
    const nonQueuedCount = surfaces.length - autoReadyCount;
    for (let i = 0; i < nonQueuedCount; i++) {
        // These were set to their initial status
    }

    // 5. Update scan with summary
    const presentCount = (counts['PRESENT_CONFIRMED'] || 0) + (counts['PRESENT_PARTIAL'] || 0);
    const summary = {
        counts,
        total: surfaces.length,
        autoReady: autoReadyCount,
        processed: processedCount,
        presentCount,
        absentCount: counts['ABSENT'] || 0,
        score: surfaces.length > 0
            ? Math.round(((counts['PRESENT_CONFIRMED'] || 0) + (counts['PRESENT_PARTIAL'] || 0) * 0.5) / surfaces.length * 100)
            : 0,
    };

    const summaryJson = JSON.stringify(summary);
    await prisma.$executeRaw`
        UPDATE digital_footprint_scans
        SET 
            status = 'COMPLETED',
            "completedAt" = ${new Date()},
            summary = ${summaryJson}::jsonb,
            "updatedAt" = ${new Date()}
        WHERE id = ${scanId}
    `;

    console.log(`✅ [RAW] Scan completed: ${scanId}`);
    console.log(`   Total: ${surfaces.length}, AUTO_READY: ${autoReadyCount}, Processed: ${processedCount}`);
    console.log(`   Present: ${presentCount}, Absent: ${counts['ABSENT'] || 0}, Score: ${summary.score}%`);

    return scanId;
}
