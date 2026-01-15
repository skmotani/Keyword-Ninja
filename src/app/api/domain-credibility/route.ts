/**
 * Domain Credibility API Route - Smart Fetch Version
 * 
 * GET  - Retrieve stored credibility data (no API cost)
 * POST - Smart Fetch fresh data (costs money, but optimizing for existing data)
 */

import { NextRequest, NextResponse } from 'next/server';
import { smartFetchDomain, createFetchPlan } from '@/lib/dataforseo/services/smart-fetch';
import {
    getCredibilityByClientAndLocation,
    saveCredibilityRecords,
    getCredibilitySummary,
    getLastFetchedAt,
} from '@/lib/storage/domainCredibilityStore';
import { checkBalance } from '@/lib/dataforseo/core/balance';
import { API_PRICING, logApiCall } from '@/lib/dataforseo/core/usage-tracker';
import { DomainCredibilityRecord, LocationCode } from '@/lib/dataforseo/core/types';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// GET: Retrieve stored data (FREE - no API cost)
// ============================================================================

export async function GET(request: NextRequest) {
    console.log('[API /domain-credibility] GET request');

    try {
        const { searchParams } = new URL(request.url);
        const clientCode = searchParams.get('clientCode');
        const locationCode = (searchParams.get('location') || 'IN') as LocationCode;

        if (!clientCode) {
            return NextResponse.json(
                { success: false, error: 'clientCode query parameter is required' },
                { status: 400 }
            );
        }

        console.log(`[API /domain-credibility] Loading data for client=${clientCode}, location=${locationCode}`);

        // Load from storage (no API cost)
        const records = await getCredibilityByClientAndLocation(clientCode, locationCode);
        const summary = await getCredibilitySummary(clientCode, locationCode);
        const lastFetchedAt = await getLastFetchedAt(clientCode, locationCode);

        // Calculate data age
        let dataAgeHours: number | null = null;
        if (lastFetchedAt) {
            const ageMs = Date.now() - new Date(lastFetchedAt).getTime();
            dataAgeHours = Math.round((ageMs / (1000 * 60 * 60)) * 10) / 10;
        }

        console.log(`[API /domain-credibility] Returning ${records.length} records`);

        return NextResponse.json({
            success: true,
            clientCode,
            locationCode,
            records,
            summary,
            lastFetchedAt,
            dataAgeHours,
            message: records.length > 0
                ? `Loaded ${records.length} domains from storage`
                : 'No stored data. Click "Fetch Data" to retrieve.',
        });

    } catch (error) {
        console.error('[API /domain-credibility] GET error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { success: false, error: `Failed to load credibility data: ${message}` },
            { status: 500 }
        );
    }
}

// ============================================================================
// POST: Smart Fetch (Only fetches missing data)
// ============================================================================

export async function POST(request: NextRequest) {
    console.log('[API /domain-credibility] POST - Smart Fetch');

    try {
        const body = await request.json();

        if (!body.clientCode || !body.domains?.length) {
            return NextResponse.json(
                { success: false, error: 'clientCode and domains required' },
                { status: 400 }
            );
        }

        const locationCode: LocationCode = body.locationCode || 'IN';
        const page = body.page || 'domain-authority';

        // Get existing data
        const existingRecords = await getCredibilityByClientAndLocation(body.clientCode, locationCode);

        // Build domains with existing data
        const domainsWithData = body.domains.map((d: any) => {
            const cleanDomain = d.domain.toLowerCase().trim().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
            const existing = existingRecords.find(r =>
                r.domain.toLowerCase().replace(/^www\./, '') === cleanDomain.replace(/^www\./, '')
            );
            return {
                domain: cleanDomain,
                type: d.type || 'competitor',
                label: d.label,
                existingData: existing || null,
            };
        });

        // Create fetch plan
        let plan = createFetchPlan(domainsWithData);

        // If force refetch, override plan
        if (body.forceRefetch === true) {
            console.log('[API] Force Refetch requested - marking all domains for full fetch');
            plan.domains.forEach(d => {
                d.needsWhois = true;
                d.needsBacklinks = true;
                d.needsLabs = true;
                d.estimatedCost = API_PRICING.whois.perDomain + API_PRICING.backlinks.perDomain + API_PRICING.labs.perDomain;
            });
            // Recalculate totals
            plan.domainsNeedingFetch = plan.domains.length;
            plan.domainsComplete = 0;
            plan.apiCallsNeeded.whois = plan.domains.length;
            plan.apiCallsNeeded.backlinks = plan.domains.length;
            plan.apiCallsNeeded.labs = plan.domains.length;
            plan.apiCallsNeeded.total = plan.domains.length * 3;
            plan.estimatedCost.whois = plan.domains.length * API_PRICING.whois.perDomain;
            plan.estimatedCost.backlinks = plan.domains.length * API_PRICING.backlinks.perDomain;
            plan.estimatedCost.labs = plan.domains.length * API_PRICING.labs.perDomain;
            plan.estimatedCost.total = plan.estimatedCost.whois + plan.estimatedCost.backlinks + plan.estimatedCost.labs;
        }

        console.log(`[API] Plan: ${plan.domainsNeedingFetch}/${plan.totalDomains} need fetch, est. cost: $${plan.estimatedCost.total.toFixed(3)}`);

        // Check balance before
        let balanceBefore: number | null = null;
        try {
            const beforeInfo = await checkBalance();
            balanceBefore = beforeInfo.balance;

            if (balanceBefore < plan.estimatedCost.total) {
                return NextResponse.json({
                    success: false,
                    error: `Insufficient balance. Need $${plan.estimatedCost.total.toFixed(2)}, have $${balanceBefore.toFixed(2)}`,
                    balance: balanceBefore,
                    estimatedCost: plan.estimatedCost.total,
                }, { status: 400 });
            }
        } catch (e) {
            console.warn('Could not check balance:', e);
        }

        // Smart fetch each domain
        const results: DomainCredibilityRecord[] = [];
        const errors: { domain: string; error: string }[] = [];
        let totalCost = 0;
        let apiCallsMade = { whois: 0, backlinks: 0, labs: 0 };

        for (const domainEntry of domainsWithData) {
            // Skip if already complete
            const domainPlan = plan.domains.find(p => p.domain === domainEntry.domain);
            if (domainPlan && domainPlan.estimatedCost === 0) {
                console.log(`[API] Skipping ${domainEntry.domain} - already complete`);
                if (domainEntry.existingData) {
                    results.push(domainEntry.existingData as DomainCredibilityRecord);
                }
                continue;
            }

            try {
                const fetchResult = await smartFetchDomain(
                    domainEntry.domain,
                    domainEntry.existingData,
                    {
                        clientCode: body.clientCode,
                        locationCode,
                        page,
                    }
                );

                // Create record
                const record: DomainCredibilityRecord = {
                    id: domainEntry.existingData?.id || uuidv4(),
                    clientCode: body.clientCode,
                    domain: domainEntry.domain,
                    domainType: domainEntry.type,
                    label: domainEntry.label,
                    locationCode,
                    ...fetchResult.data,
                    fetchedAt: new Date().toISOString(),
                    errors: fetchResult.errors,
                } as DomainCredibilityRecord;

                results.push(record);
                totalCost += fetchResult.cost;

                fetchResult.apisCalled.forEach(api => {
                    if (api === 'whois') apiCallsMade.whois++;
                    if (api === 'backlinks') apiCallsMade.backlinks++;
                    if (api === 'labs') apiCallsMade.labs++;
                });

                if (fetchResult.errors.length > 0) {
                    errors.push({ domain: domainEntry.domain, error: fetchResult.errors.join('; ') });
                }

                // Small delay between domains
                await new Promise(r => setTimeout(r, 100));

            } catch (error) {
                errors.push({ domain: domainEntry.domain, error: String(error) });
            }
        }

        // Save results
        if (results.length > 0) {
            await saveCredibilityRecords(results);
        }

        // Check balance after
        let balanceAfter: number | null = null;
        try {
            const afterInfo = await checkBalance();
            balanceAfter = afterInfo.balance;
        } catch (e) {
            console.warn('Could not check balance after:', e);
        }

        const actualCost = balanceBefore && balanceAfter ? balanceBefore - balanceAfter : totalCost;

        console.log(`[API] Complete: ${results.length} domains, $${actualCost.toFixed(4)} cost`);

        return NextResponse.json({
            success: true,
            recordsProcessed: results.length,
            recordsFetched: plan.domainsNeedingFetch,
            recordsSkipped: plan.domainsComplete,
            apiCalls: apiCallsMade,
            balanceBefore,
            balanceAfter,
            estimatedCost: plan.estimatedCost.total,
            actualCost,
            errors: errors.length > 0 ? errors : undefined,
        });

    } catch (error) {
        console.error('[API /domain-credibility] Error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
