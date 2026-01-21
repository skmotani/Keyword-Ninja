/**
 * Get Digital Footprint Scan Results (HARDENED)
 * 
 * GET /api/digital-footprint/scan/[scanId]
 * 
 * Returns scan summary, grouped results, and prioritized action plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
    params: Promise<{ scanId: string }>;
}

// --- IMPACT/EFFORT SCORING ---

const TIER_IMPACT: Record<string, number> = {
    'CRITICAL': 100,
    'HIGH': 70,
    'MEDIUM': 40,
    'LOW': 10,
};

function getEffortScore(evidenceProvider: string | null, checkMode: string | null, surfaceKey: string): number {
    // DNS fixes = 2
    if (evidenceProvider === 'DNS' || checkMode?.includes('dns')) return 2;

    // On-site files = 2-3
    if (surfaceKey.includes('ROBOTS') || surfaceKey.includes('SITEMAP') ||
        surfaceKey.includes('SCHEMA') || surfaceKey.includes('STRUCTURED')) return 2;

    // Create profiles = 3
    if (surfaceKey.includes('LINKEDIN') || surfaceKey.includes('YOUTUBE') ||
        surfaceKey.includes('INSTAGRAM') || surfaceKey.includes('FACEBOOK') ||
        surfaceKey.includes('TWITTER') || surfaceKey.includes('CRUNCHBASE')) return 3;

    // SERP/provider-only items = 4
    if (evidenceProvider === 'SERP_PROVIDER' || evidenceProvider === 'SUGGEST_PROVIDER') return 4;

    // Content strategy = 5
    if (checkMode === 'manual' || checkMode === 'content_review') return 5;

    return 3; // Default
}

function getFixLinkType(surfaceKey: string, evidenceProvider: string | null): string {
    if (evidenceProvider === 'DNS' || surfaceKey.includes('DMARC') ||
        surfaceKey.includes('SPF') || surfaceKey.includes('DKIM')) return 'DNS';

    if (surfaceKey.includes('ROBOTS') || surfaceKey.includes('SITEMAP') ||
        surfaceKey.includes('SCHEMA') || surfaceKey.includes('LLMS')) return 'WEBSITE_PATH';

    if (surfaceKey.includes('LINKEDIN') || surfaceKey.includes('YOUTUBE') ||
        surfaceKey.includes('INSTAGRAM') || surfaceKey.includes('FACEBOOK')) return 'ENTITY_ID';

    return 'MANUAL';
}

function getFixLinkTarget(surfaceKey: string, fixLinkType: string, clientId: string): string | null {
    if (fixLinkType === 'DNS') return 'Configure in your DNS provider';
    if (fixLinkType === 'WEBSITE_PATH') {
        if (surfaceKey.includes('ROBOTS')) return '/robots.txt';
        if (surfaceKey.includes('SITEMAP')) return '/sitemap.xml';
        if (surfaceKey.includes('LLMS')) return '/llms.txt';
        if (surfaceKey.includes('SCHEMA')) return 'Add JSON-LD to <head>';
        return 'Edit on website';
    }
    if (fixLinkType === 'ENTITY_ID') return `/clients`;
    return null;
}

// --- ACTION ITEM INTERFACE ---

interface ActionItem {
    surfaceKey: string;
    label: string;
    category: string;
    tier: string;
    status: string;
    whyItMatters: string;
    remediationSteps: string[];
    fixLinkType: 'ENTITY_ID' | 'WEBSITE_PATH' | 'DNS' | 'MANUAL';
    fixLinkTarget: string | null;
    impact: number;
    effort: number;
    priorityScore: number;
}

// --- API HANDLER ---

export async function GET(
    request: NextRequest,
    context: RouteParams
) {
    try {
        const { scanId } = await context.params;

        if (!scanId) {
            return NextResponse.json({ error: 'scanId is required' }, { status: 400 });
        }

        // Load scan with results
        const scan = await prisma.digitalFootprintScan.findUnique({
            where: { id: scanId },
            include: {
                results: {
                    orderBy: [
                        { category: 'asc' },
                        { importanceTier: 'asc' },
                    ],
                },
            },
        });

        if (!scan) {
            return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
        }

        // Load surface rules for evidence provider info
        const surfaces = await prisma.footprintSurface.findMany({
            include: {
                rules: {
                    where: { isActive: true },
                    take: 1,
                },
            },
        });
        const surfaceMap = new Map(surfaces.map(s => [s.surfaceKey, s]));

        // Group results by category
        const categoryMap = new Map<string, typeof scan.results>();
        for (const result of scan.results) {
            const cat = result.category || 'other';
            const existing = categoryMap.get(cat) || [];
            existing.push(result);
            categoryMap.set(cat, existing);
        }

        const categories = Array.from(categoryMap.entries()).map(([category, results]) => {
            const counts = {
                PRESENT_CONFIRMED: results.filter(r => r.status === 'PRESENT_CONFIRMED').length,
                PRESENT_PARTIAL: results.filter(r => r.status === 'PRESENT_PARTIAL').length,
                ABSENT: results.filter(r => r.status === 'ABSENT').length,
                NEEDS_ENTITY_INPUT: results.filter(r => r.status === 'NEEDS_ENTITY_INPUT').length,
                MANUAL_REQUIRED: results.filter(r => r.status === 'MANUAL_REQUIRED').length,
                REQUIRES_PROVIDER: results.filter(r => r.status === 'REQUIRES_PROVIDER').length,
                ERROR: results.filter(r => r.status === 'ERROR').length,
                QUEUED: results.filter(r => r.status === 'QUEUED').length,
                total: results.length,
            };

            return { category, results, counts };
        });

        // Build action plan with impact/effort/priorityScore
        const actionPlan = buildActionPlan(scan.results, surfaceMap, scan.clientId);

        // Calculate totals that ADD UP to total results
        const totals = {
            total: scan.results.length,
            presentCount: scan.results.filter(r =>
                r.status === 'PRESENT_CONFIRMED' || r.status === 'PRESENT_PARTIAL'
            ).length,
            absentCount: scan.results.filter(r => r.status === 'ABSENT').length,
            needsInputCount: scan.results.filter(r => r.status === 'NEEDS_ENTITY_INPUT').length,
            manualRequired: scan.results.filter(r =>
                r.status === 'MANUAL_REQUIRED' || r.status === 'REQUIRES_PROVIDER'
            ).length,
            errorCount: scan.results.filter(r => r.status === 'ERROR').length,
        };

        return NextResponse.json({
            scan: {
                id: scan.id,
                clientId: scan.clientId,
                clientName: scan.clientName,
                mode: scan.mode,
                status: scan.status,
                startedAt: scan.startedAt,
                completedAt: scan.completedAt,
                summary: scan.summary,
            },
            categories,
            actionPlan,
            totals,
        });

    } catch (error) {
        console.error('Get scan error:', error);
        return NextResponse.json(
            { error: 'Failed to get scan results' },
            { status: 500 }
        );
    }
}

// --- ACTION PLAN BUILDER ---

function buildActionPlan(
    results: Array<{
        surfaceKey: string;
        surfaceLabel: string | null;
        surfaceRuleId: string | null;
        category: string | null;
        importanceTier: string | null;
        status: string;
        evidence: unknown;
    }>,
    surfaceMap: Map<string, {
        surfaceKey: string;
        businessImpact: unknown;
        notes: string | null;
        rules: Array<{ evidenceProvider: string | null; checkMode: string | null }>;
    }>,
    clientId: string
): {
    criticalFixes: ActionItem[];
    quickWins: ActionItem[];
    entityFixes: ActionItem[];
    securityFixes: ActionItem[];
    allSorted: ActionItem[];
} {
    const allItems: ActionItem[] = [];

    for (const result of results) {
        // Skip present items
        if (result.status === 'PRESENT_CONFIRMED') continue;

        const surface = surfaceMap.get(result.surfaceKey);
        const rule = surface?.rules[0];
        const tier = result.importanceTier || 'LOW';
        const status = result.status;

        // Calculate impact and effort
        const impact = TIER_IMPACT[tier] || 10;
        const effort = getEffortScore(rule?.evidenceProvider || null, rule?.checkMode || null, result.surfaceKey);
        const priorityScore = Math.round((impact / effort) * 10) / 10;

        // Get fix link info
        const fixLinkType = getFixLinkType(result.surfaceKey, rule?.evidenceProvider || null) as ActionItem['fixLinkType'];
        const fixLinkTarget = getFixLinkTarget(result.surfaceKey, fixLinkType, clientId);

        // Build why it matters
        const businessImpact = surface?.businessImpact as { summary?: string } | null;
        const whyItMatters = businessImpact?.summary ||
            surface?.notes ||
            getDefaultWhyItMatters(result.surfaceKey, status);

        // Build remediation steps
        const remediationSteps = getRemediationSteps(result.surfaceKey, status, result.evidence);

        allItems.push({
            surfaceKey: result.surfaceKey,
            label: result.surfaceLabel || result.surfaceKey,
            category: result.category || 'other',
            tier,
            status,
            whyItMatters,
            remediationSteps,
            fixLinkType,
            fixLinkTarget,
            impact,
            effort,
            priorityScore,
        });
    }

    // Sort by priorityScore descending
    allItems.sort((a, b) => b.priorityScore - a.priorityScore);

    // Categorize
    const criticalFixes = allItems.filter(i =>
        i.tier === 'CRITICAL' && (i.status === 'ABSENT' || i.status === 'PRESENT_PARTIAL')
    );

    const quickWins = allItems.filter(i =>
        i.tier === 'HIGH' && i.status === 'PRESENT_PARTIAL' && i.effort <= 3
    );

    const entityFixes = allItems.filter(i => i.status === 'NEEDS_ENTITY_INPUT');

    const securityFixes = allItems.filter(i =>
        (i.surfaceKey.includes('DMARC') || i.surfaceKey.includes('SPF') ||
            i.surfaceKey.includes('DKIM') || i.surfaceKey.includes('BIMI')) &&
        (i.status === 'ABSENT' || i.status === 'PRESENT_PARTIAL')
    );

    return { criticalFixes, quickWins, entityFixes, securityFixes, allSorted: allItems };
}

function getDefaultWhyItMatters(surfaceKey: string, status: string): string {
    const reasons: Record<string, string> = {
        'GOOGLE_BUSINESS': 'GBP is essential for local search visibility and trust signals',
        'LINKEDIN': 'LinkedIn is critical for B2B credibility and professional networking',
        'WEBSITE': 'Your homepage is the foundation of your digital presence',
        'ROBOTS': 'Robots.txt controls how search engines crawl your site',
        'SITEMAP': 'Sitemaps help search engines discover and index your content',
        'SCHEMA': 'Structured data enables rich snippets and better search visibility',
        'DMARC': 'DMARC protects your domain from email spoofing and phishing',
        'SPF': 'SPF validates which mail servers can send email for your domain',
        'DKIM': 'DKIM adds cryptographic signatures to verify email authenticity',
        'BIMI': 'BIMI displays your brand logo in email clients, improving trust',
    };

    for (const [key, reason] of Object.entries(reasons)) {
        if (surfaceKey.includes(key)) return reason;
    }

    if (status === 'ABSENT') return 'This surface is missing from your digital footprint';
    if (status === 'PRESENT_PARTIAL') return 'This surface needs improvement for full effectiveness';
    return 'This surface contributes to your overall digital presence';
}

function getRemediationSteps(surfaceKey: string, status: string, evidence: unknown): string[] {
    // DNS security
    if (surfaceKey.includes('DMARC')) {
        if (status === 'ABSENT') {
            return [
                'Add a DMARC TXT record to your DNS',
                'Start with p=none for monitoring',
                'Progress to p=quarantine then p=reject',
            ];
        }
        const ev = evidence as { dns?: { parsedFlags?: { dmarcPolicy?: string } } } | null;
        if (ev?.dns?.parsedFlags?.dmarcPolicy === 'none') {
            return [
                'Upgrade DMARC policy from p=none to p=quarantine',
                'Monitor reports for legitimate mail sources',
                'Move to p=reject for full protection',
            ];
        }
    }

    if (surfaceKey.includes('SPF')) {
        return [
            'Create SPF TXT record listing authorized mail servers',
            'Include all services that send email on your behalf',
            'End with -all (hard fail) for strict enforcement',
        ];
    }

    // Technical SEO
    if (surfaceKey.includes('ROBOTS')) {
        return [
            'Create robots.txt at your domain root',
            'Add sitemap reference',
            'Configure crawl rules appropriately',
        ];
    }

    if (surfaceKey.includes('SITEMAP')) {
        return [
            'Generate an XML sitemap with all important URLs',
            'Submit to Google Search Console',
            'Reference in robots.txt',
        ];
    }

    if (surfaceKey.includes('SCHEMA')) {
        return [
            'Add Organization schema with sameAs links',
            'Include logo, name, and contact info',
            'Test with Google Rich Results Test',
        ];
    }

    // Social profiles
    if (surfaceKey.includes('LINKEDIN') || surfaceKey.includes('YOUTUBE') ||
        surfaceKey.includes('INSTAGRAM') || surfaceKey.includes('FACEBOOK')) {
        if (status === 'ABSENT') {
            return [
                `Create/claim your ${surfaceKey.replace(/_/g, ' ').toLowerCase()} presence`,
                'Verify ownership following platform guidelines',
                'Complete all required profile fields',
            ];
        }
        return [
            'Complete all incomplete profile fields',
            'Add schema.org markup linking to this profile',
            'Verify NAP consistency across properties',
        ];
    }

    // Default
    if (status === 'ABSENT') {
        return ['Create this presence following best practices'];
    }
    return ['Review and optimize this surface'];
}
