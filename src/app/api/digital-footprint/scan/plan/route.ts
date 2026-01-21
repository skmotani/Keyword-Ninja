/**
 * Execution Plan API (FIXED AUTO_READY Classification)
 * 
 * POST /api/digital-footprint/scan/plan
 * 
 * Generates a categorized plan showing which surfaces are auto-runnable vs need input
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClients } from '@/lib/db';
import { Client, CanonicalEntity } from '@/types';

// Plan statuses
type PlanStatus =
    | 'AUTO_READY'           // Can run now (evidenceProvider in CRAWL/DNS and required entity inputs exist)
    | 'NEEDS_ENTITY_INPUT'   // canonicalInputNeeded required but missing from client entity profile  
    | 'MANUAL_REQUIRED'      // sourceType=MANUAL_REVIEW OR evidenceProvider=MANUAL OR playbook exists
    | 'REQUIRES_PROVIDER'    // evidenceProvider in (SERP_PROVIDER, SUGGEST_PROVIDER, OWNER_API)
    | 'DISABLED';            // surface.enabled=false

interface SurfacePlanItem {
    surfaceKey: string;
    label: string;
    category: string;
    importanceTier: string;
    planStatus: PlanStatus;
    missingEntityFields: string[];
    recommendedNextAction: string;
    ruleMetadata: {
        crawlOnlyFeasible: string | null;
        evidenceProvider: string | null;
        dataforseoRecommended: boolean;
        checkMode: string | null;
        canonicalInputNeeded: string | null;
    };
    playbookPreview?: {
        title: string;
        shortInstructions: string;
    } | null;
}

interface CategoryGroup {
    category: string;
    surfaces: SurfacePlanItem[];
    counts: {
        AUTO_READY: number;
        NEEDS_ENTITY_INPUT: number;
        MANUAL_REQUIRED: number;
        REQUIRES_PROVIDER: number;
        DISABLED: number;
        total: number;
    };
}

interface ExecutionPlanResponse {
    clientId: string;
    clientName: string;
    hasCanonicalEntity: boolean;
    canonicalDomain: string | null;
    categories: CategoryGroup[];
    totals: {
        AUTO_READY: number;
        NEEDS_ENTITY_INPUT: number;
        MANUAL_REQUIRED: number;
        REQUIRES_PROVIDER: number;
        DISABLED: number;
        total: number;
    };
    entityCompleteness: {
        totalFields: number;
        filledFields: number;
        percentage: number;
    };
    _debug?: {
        loadedFields: Record<string, string | null>;
        classificationSamples: Array<{ surfaceKey: string; status: PlanStatus; reason: string }>;
    };
}

// Map canonical input types to entity profile paths
function getEntityFieldValue(entity: CanonicalEntity | null | undefined, inputNeeded: string | null): string | null {
    if (!entity || !inputNeeded) return null;

    const normalizedInput = inputNeeded.toLowerCase().replace(/[-\s]/g, '_').trim();

    const inputMap: Record<string, () => string | null | undefined> = {
        'domain': () => entity.web?.canonicalDomain,
        'canonical_domain': () => entity.web?.canonicalDomain,
        'canonicaldomain': () => entity.web?.canonicalDomain,
        'handle': () => null,
        'linkedin_slug': () => entity.profiles?.social?.linkedinCompanySlug,
        'linkedin_company_slug': () => entity.profiles?.social?.linkedinCompanySlug,
        'linkedincompanyslug': () => entity.profiles?.social?.linkedinCompanySlug,
        'youtube_handle': () => entity.profiles?.social?.youtubeHandle,
        'youtubehandle': () => entity.profiles?.social?.youtubeHandle,
        'instagram_handle': () => entity.profiles?.social?.instagramHandle,
        'instagramhandle': () => entity.profiles?.social?.instagramHandle,
        'x_handle': () => entity.profiles?.social?.xHandle,
        'xhandle': () => entity.profiles?.social?.xHandle,
        'twitter_handle': () => entity.profiles?.social?.xHandle,
        'facebook_page': () => entity.profiles?.social?.facebookPage,
        'facebookpage': () => entity.profiles?.social?.facebookPage,
        'wikidata_qid': () => entity.profiles?.knowledgeGraph?.wikidataQid,
        'wikidataqid': () => entity.profiles?.knowledgeGraph?.wikidataQid,
        'gbp_place_id': () => entity.profiles?.googleBusiness?.placeId,
        'gbp_cid': () => entity.profiles?.googleBusiness?.cid,
        'crunchbase_url': () => entity.profiles?.directories?.crunchbaseUrl,
        'g2_url': () => entity.profiles?.directories?.g2Url,
        'capterra_url': () => entity.profiles?.directories?.capterraUrl,
        'trustpilot_url': () => entity.profiles?.directories?.trustpilotUrl,
        'clutch_url': () => entity.profiles?.directories?.clutchUrl,
        'brand': () => entity.names?.brand,
        'brand_name': () => entity.names?.brand,
        'brandname': () => entity.names?.brand,
        'phone': () => entity.contact?.primaryPhoneE164,
        'primary_phone': () => entity.contact?.primaryPhoneE164,
    };

    // Direct match
    const getter = inputMap[normalizedInput];
    if (getter) {
        const value = getter();
        return value || null;
    }

    // Fallback: if input contains 'domain', use canonicalDomain
    if (normalizedInput.includes('domain')) {
        return entity.web?.canonicalDomain || null;
    }

    return null;
}

// Get list of missing entity fields based on canonicalInputNeeded
function getMissingEntityFields(
    entity: CanonicalEntity | null | undefined,
    canonicalInputNeeded: string | null
): string[] {
    // If no specific input needed, assume domain-only which we check separately
    if (!canonicalInputNeeded) return [];

    // Parse comma-separated inputs
    const inputs = canonicalInputNeeded.split(',').map(s => s.trim()).filter(Boolean);
    const missing: string[] = [];

    for (const input of inputs) {
        const value = getEntityFieldValue(entity, input);
        if (!value) {
            missing.push(input);
        }
    }

    return missing;
}

// Calculate entity completeness
function calculateEntityCompleteness(entity: CanonicalEntity | null | undefined): { totalFields: number; filledFields: number; percentage: number } {
    if (!entity) {
        return { totalFields: 15, filledFields: 0, percentage: 0 };
    }

    const fields = [
        entity.web?.canonicalDomain,
        entity.names?.brand,
        entity.profiles?.social?.linkedinCompanySlug,
        entity.profiles?.social?.youtubeHandle,
        entity.profiles?.social?.xHandle,
        entity.profiles?.social?.instagramHandle,
        entity.profiles?.social?.facebookPage,
        entity.profiles?.googleBusiness?.placeId,
        entity.profiles?.knowledgeGraph?.wikidataQid,
        entity.profiles?.directories?.crunchbaseUrl,
        entity.profiles?.directories?.g2Url,
        entity.profiles?.directories?.trustpilotUrl,
        entity.profiles?.directories?.clutchUrl,
        entity.contact?.primaryPhoneE164,
        entity.location?.hq?.city,
    ];

    const filled = fields.filter(f => f && f.trim()).length;
    return {
        totalFields: fields.length,
        filledFields: filled,
        percentage: Math.round((filled / fields.length) * 100),
    };
}

// Determine if a surface is AUTO_READY based on evidenceProvider and entity availability
function classifySurface(
    surface: { enabled: boolean; surfaceKey: string },
    rule: {
        sourceType: string | null;
        evidenceProvider: string | null;
        canonicalInputNeeded: string | null;
        dataforseoRecommended?: boolean;
        playbook?: unknown;
    } | null,
    entity: CanonicalEntity | null | undefined,
    hasCanonicalDomain: boolean
): { status: PlanStatus; reason: string; missingFields: string[] } {
    const playbook = rule?.playbook;
    const evidenceProvider = rule?.evidenceProvider?.toUpperCase() || '';
    const sourceType = rule?.sourceType?.toUpperCase() || '';
    const canonicalInputNeeded = rule?.canonicalInputNeeded;

    // 1. Disabled surface
    if (!surface.enabled) {
        return { status: 'DISABLED', reason: 'Surface disabled', missingFields: [] };
    }

    // 2. Manual required (playbook or explicit manual)
    if (sourceType === 'MANUAL_REVIEW' || evidenceProvider === 'MANUAL' || playbook) {
        return { status: 'MANUAL_REQUIRED', reason: 'Manual verification required', missingFields: [] };
    }

    // 3. Requires external provider
    if (['SERP_PROVIDER', 'SUGGEST_PROVIDER', 'OWNER_API'].includes(evidenceProvider)) {
        return { status: 'REQUIRES_PROVIDER', reason: `Requires ${evidenceProvider}`, missingFields: [] };
    }

    // 4. CRAWL or DNS based - check if we have required inputs
    if (evidenceProvider === 'CRAWL' || evidenceProvider === 'DNS' || !evidenceProvider) {
        // For CRAWL/DNS surfaces, domain is usually the main requirement
        // If canonicalInputNeeded is specified, check those fields
        if (canonicalInputNeeded) {
            const missingFields = getMissingEntityFields(entity, canonicalInputNeeded);
            if (missingFields.length > 0) {
                return {
                    status: 'NEEDS_ENTITY_INPUT',
                    reason: `Missing: ${missingFields.join(', ')}`,
                    missingFields
                };
            }
            // All required inputs present
            return { status: 'AUTO_READY', reason: 'All required inputs available', missingFields: [] };
        }

        // No specific input needed - just need domain for most CRAWL/DNS surfaces
        if (hasCanonicalDomain) {
            return { status: 'AUTO_READY', reason: 'Domain available, no specific input needed', missingFields: [] };
        } else {
            return { status: 'NEEDS_ENTITY_INPUT', reason: 'Missing canonical domain', missingFields: ['domain'] };
        }
    }

    // 5. Fallback - check for missing inputs
    if (canonicalInputNeeded) {
        const missingFields = getMissingEntityFields(entity, canonicalInputNeeded);
        if (missingFields.length > 0) {
            return { status: 'NEEDS_ENTITY_INPUT', reason: `Missing: ${missingFields.join(', ')}`, missingFields };
        }
    }

    // 6. Default to AUTO_READY if nothing else matched and domain exists
    if (hasCanonicalDomain) {
        return { status: 'AUTO_READY', reason: 'Default - domain available', missingFields: [] };
    }

    return { status: 'NEEDS_ENTITY_INPUT', reason: 'No domain configured', missingFields: ['domain'] };
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { clientId, debug } = body;

        if (!clientId) {
            return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
        }

        // Load client
        const clients = await getClients();
        const client = clients.find((c: Client) => c.id === clientId);

        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        const entity = client.canonicalEntity as CanonicalEntity | null;
        const canonicalDomain = entity?.web?.canonicalDomain || null;
        const hasCanonicalDomain = !!canonicalDomain;

        console.log(`[PLAN] Client: ${client.name}, Domain: ${canonicalDomain || 'NONE'}`);

        // Load all surfaces with active rules
        const surfaces = await prisma.footprintSurface.findMany({
            include: {
                rules: {
                    where: { isActive: true },
                    include: { playbook: true },
                    take: 1,
                },
            },
            orderBy: [
                { category: 'asc' },
                { importanceTier: 'asc' },
            ],
        });

        console.log(`[PLAN] Loaded ${surfaces.length} surfaces`);

        // Build plan items
        const planItems: SurfacePlanItem[] = [];
        const classificationSamples: Array<{ surfaceKey: string; status: PlanStatus; reason: string }> = [];

        for (const surface of surfaces) {
            const rule = surface.rules[0];

            // Use new classification logic
            const { status: planStatus, reason, missingFields } = classifySurface(
                { enabled: surface.enabled, surfaceKey: surface.surfaceKey },
                rule ? {
                    sourceType: rule.sourceType,
                    evidenceProvider: rule.evidenceProvider,
                    canonicalInputNeeded: rule.canonicalInputNeeded,
                    dataforseoRecommended: rule.dataforseoRecommended,
                    playbook: rule.playbook,
                } : null,
                entity,
                hasCanonicalDomain
            );

            // Collect samples for debug (first 5 of each status)
            const samplesOfStatus = classificationSamples.filter(s => s.status === planStatus);
            if (samplesOfStatus.length < 5) {
                classificationSamples.push({ surfaceKey: surface.surfaceKey, status: planStatus, reason });
            }

            let recommendedNextAction = '';
            switch (planStatus) {
                case 'AUTO_READY':
                    recommendedNextAction = 'Ready to run automated scan';
                    break;
                case 'NEEDS_ENTITY_INPUT':
                    recommendedNextAction = `Add to Entity ID: ${missingFields.join(', ')}`;
                    break;
                case 'MANUAL_REQUIRED':
                    recommendedNextAction = 'Follow manual verification steps';
                    break;
                case 'REQUIRES_PROVIDER':
                    recommendedNextAction = rule?.dataforseoRecommended
                        ? 'Configure DataForSEO or run manual fallback'
                        : 'Configure API provider or run manual';
                    break;
                case 'DISABLED':
                    recommendedNextAction = 'Enable this surface in registry';
                    break;
            }

            planItems.push({
                surfaceKey: surface.surfaceKey,
                label: surface.label,
                category: surface.category,
                importanceTier: surface.importanceTier,
                planStatus,
                missingEntityFields: missingFields,
                recommendedNextAction,
                ruleMetadata: {
                    crawlOnlyFeasible: rule?.crawlOnlyFeasible || null,
                    evidenceProvider: rule?.evidenceProvider || null,
                    dataforseoRecommended: rule?.dataforseoRecommended || false,
                    checkMode: rule?.checkMode || null,
                    canonicalInputNeeded: rule?.canonicalInputNeeded || null,
                },
                playbookPreview: rule?.playbook ? {
                    title: `Verification Guide: ${surface.label}`,
                    shortInstructions: rule.playbook.instructionsMarkdown.slice(0, 200) + '...',
                } : null,
            });
        }

        // Group by category
        const categoryMap = new Map<string, SurfacePlanItem[]>();
        for (const item of planItems) {
            const existing = categoryMap.get(item.category) || [];
            existing.push(item);
            categoryMap.set(item.category, existing);
        }

        // Build category groups with counts
        const categories: CategoryGroup[] = Array.from(categoryMap.entries()).map(([category, items]) => {
            const counts = {
                AUTO_READY: items.filter(i => i.planStatus === 'AUTO_READY').length,
                NEEDS_ENTITY_INPUT: items.filter(i => i.planStatus === 'NEEDS_ENTITY_INPUT').length,
                MANUAL_REQUIRED: items.filter(i => i.planStatus === 'MANUAL_REQUIRED').length,
                REQUIRES_PROVIDER: items.filter(i => i.planStatus === 'REQUIRES_PROVIDER').length,
                DISABLED: items.filter(i => i.planStatus === 'DISABLED').length,
                total: items.length,
            };

            return { category, surfaces: items, counts };
        });

        // Calculate totals
        const totals = {
            AUTO_READY: planItems.filter(i => i.planStatus === 'AUTO_READY').length,
            NEEDS_ENTITY_INPUT: planItems.filter(i => i.planStatus === 'NEEDS_ENTITY_INPUT').length,
            MANUAL_REQUIRED: planItems.filter(i => i.planStatus === 'MANUAL_REQUIRED').length,
            REQUIRES_PROVIDER: planItems.filter(i => i.planStatus === 'REQUIRES_PROVIDER').length,
            DISABLED: planItems.filter(i => i.planStatus === 'DISABLED').length,
            total: planItems.length,
        };

        console.log(`[PLAN] Totals: AUTO_READY=${totals.AUTO_READY}, NEEDS_INPUT=${totals.NEEDS_ENTITY_INPUT}, MANUAL=${totals.MANUAL_REQUIRED}, PROVIDER=${totals.REQUIRES_PROVIDER}`);

        // Sanity check: if domain exists and there are enabled surfaces, AUTO_READY should be > 0
        if (hasCanonicalDomain && totals.total > totals.DISABLED && totals.AUTO_READY === 0) {
            console.warn(`[PLAN] WARNING: Domain exists but AUTO_READY=0. Classification bug suspected.`);
        }

        const response: ExecutionPlanResponse = {
            clientId: client.id,
            clientName: client.name,
            hasCanonicalEntity: !!entity,
            canonicalDomain,
            categories,
            totals,
            entityCompleteness: calculateEntityCompleteness(entity),
        };

        // Add debug info if requested
        if (debug) {
            response._debug = {
                loadedFields: {
                    canonicalDomain,
                    brand: entity?.names?.brand || null,
                    linkedinSlug: entity?.profiles?.social?.linkedinCompanySlug || null,
                    youtubeHandle: entity?.profiles?.social?.youtubeHandle || null,
                    xHandle: entity?.profiles?.social?.xHandle || null,
                },
                classificationSamples,
            };
        }

        return NextResponse.json(response);

    } catch (error) {
        console.error('Execution plan error:', error);
        return NextResponse.json(
            { error: 'Failed to generate execution plan', details: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 }
        );
    }
}
