/**
 * Fetch Plan API
 * POST /api/domain-credibility/plan - Calculate cost before fetching
 */

import { NextRequest, NextResponse } from 'next/server';
import { createFetchPlan, analyzeExistingData } from '@/lib/dataforseo/services/smart-fetch';
import { getCredibilityByClientAndLocation } from '@/lib/storage/domainCredibilityStore';
import { checkBalance } from '@/lib/dataforseo/core/balance';
import { API_PRICING } from '@/lib/dataforseo/core/usage-tracker';
import { LocationCode } from '@/lib/dataforseo/core/types';

interface PlanRequestBody {
    clientCode: string;
    domains: string[];
    locationCode?: LocationCode;
}

export async function POST(request: NextRequest) {
    try {
        const body: PlanRequestBody = await request.json();

        if (!body.clientCode || !body.domains?.length) {
            return NextResponse.json(
                { success: false, error: 'clientCode and domains are required' },
                { status: 400 }
            );
        }

        const locationCode = body.locationCode || 'IN';

        // Get existing data
        const existingRecords = await getCredibilityByClientAndLocation(body.clientCode, locationCode);

        // Build domain list with existing data
        const domainsWithData = body.domains.map(domain => {
            const cleanDomain = domain.toLowerCase().trim().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
            const existing = existingRecords.find(r =>
                r.domain.toLowerCase().replace(/^www\./, '') === cleanDomain.replace(/^www\./, '')
            );
            return {
                domain: cleanDomain,
                existingData: existing || null,
            };
        });

        // Create fetch plan
        const plan = createFetchPlan(domainsWithData);

        // Get current balance
        let balance = null;
        let canAfford = true;
        try {
            const balanceInfo = await checkBalance();
            balance = balanceInfo.balance;
            canAfford = balance >= plan.estimatedCost.total;
        } catch (e) {
            console.warn('Could not check balance:', e);
        }

        return NextResponse.json({
            success: true,
            plan: {
                summary: {
                    totalDomains: plan.totalDomains,
                    domainsNeedingFetch: plan.domainsNeedingFetch,
                    domainsComplete: plan.domainsComplete,
                    apiCalls: plan.apiCallsNeeded,
                    cost: plan.estimatedCost,
                },
                domains: plan.domains.map(d => ({
                    domain: d.domain,
                    needsWhois: d.needsWhois,
                    needsBacklinks: d.needsBacklinks,
                    needsLabs: d.needsLabs,
                    cost: d.estimatedCost,
                    status: d.estimatedCost === 0 ? 'complete' : 'needs_fetch',
                })),
            },
            balance,
            canAfford,
            pricing: API_PRICING,
        });

    } catch (error) {
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
