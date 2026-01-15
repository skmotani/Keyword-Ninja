/**
 * TEST ENDPOINT - Phase 1-4 Verification
 * 
 * Usage:
 *   GET /api/test-dataforseo                         - Basic tests (free)
 *   GET /api/test-dataforseo?domain=google.com       - With domain test (~$0.004)
 *   GET /api/test-dataforseo?domain=google.com&save=true - Test storage
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    LOCATION_CODES,
    DATAFORSEO_MODULE_VERSION,
    fetchDomainCredibility,
    toCredibilityRecord,
    getDiagnosticsSummary,
    getDataForSEOClient,
    validateCredentials,
    getDataForSEOCredentials,
    maskCredentials,
} from '@/lib/dataforseo/index';
import {
    saveCredibilityRecords,
    getCredibilityByClient,
    getCredibilitySummary,
    CREDIBILITY_STORE_VERSION,
} from '@/lib/storage/domainCredibilityStore';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const testDomain = searchParams.get('domain');
    const saveData = searchParams.get('save') === 'true';

    const results: Record<string, unknown> = {
        phase: 'Phase 4 - Storage & Production API',
        timestamp: new Date().toISOString(),
        moduleVersion: DATAFORSEO_MODULE_VERSION,
        storeVersion: CREDIBILITY_STORE_VERSION,
        testDomain: testDomain || '(add ?domain=example.com for full test)',
        saveData,
        tests: {},
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Test 1: Core module loaded
    // ─────────────────────────────────────────────────────────────────────────
    try {
        results.tests = {
            ...results.tests as object,
            moduleLoaded: {
                success: true,
                version: DATAFORSEO_MODULE_VERSION,
                indiaCode: LOCATION_CODES.IN,
            },
        };
    } catch (error) {
        results.tests = { ...results.tests as object, moduleLoaded: { success: false, error: String(error) } };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 2: Credentials
    // ─────────────────────────────────────────────────────────────────────────
    try {
        const creds = await getDataForSEOCredentials();
        const validation = await validateCredentials(creds);
        results.tests = {
            ...results.tests as object,
            credentials: {
                success: validation.valid,
                username: maskCredentials(creds).username,
                balance: validation.balance,
            },
        };
    } catch (error) {
        results.tests = { ...results.tests as object, credentials: { success: false, error: String(error) } };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 3: Storage module
    // ─────────────────────────────────────────────────────────────────────────
    try {
        const testClientCode = '_test_client_';
        const existingRecords = await getCredibilityByClient(testClientCode);
        const summary = await getCredibilitySummary(testClientCode);

        results.tests = {
            ...results.tests as object,
            storageModule: {
                success: true,
                version: CREDIBILITY_STORE_VERSION,
                testClientRecords: existingRecords.length,
                summaryWorks: summary !== null,
            },
        };
    } catch (error) {
        results.tests = { ...results.tests as object, storageModule: { success: false, error: String(error) } };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 4: Full credibility fetch + save (only if domain provided)
    // ─────────────────────────────────────────────────────────────────────────
    if (testDomain) {
        try {
            const credibility = await fetchDomainCredibility(testDomain, { locationCode: 'IN' });

            let saveResult = null;
            if (saveData) {
                const record = toCredibilityRecord(credibility, '_test_client_', {
                    domainType: 'competitor',
                    label: 'Test Domain',
                });
                saveResult = await saveCredibilityRecords([record]);
            }

            results.tests = {
                ...results.tests as object,
                credibilityFetch: {
                    success: credibility.errors.length === 0,
                    domain: credibility.domain,
                    domainAgeYears: credibility.domainAgeYears,
                    referringDomains: credibility.referringDomains,
                    totalBacklinks: credibility.totalBacklinks,
                    dofollowBacklinks: credibility.dofollowBacklinks,
                    paidKeywordsCount: credibility.paidKeywordsCount,
                    organicKeywordsCount: credibility.organicKeywordsCount,
                    errors: credibility.errors,
                    savedToStorage: saveData ? (saveResult !== null) : 'skipped (add &save=true)',
                },
            };
        } catch (error) {
            results.tests = { ...results.tests as object, credibilityFetch: { success: false, error: String(error) } };
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Summary
    // ─────────────────────────────────────────────────────────────────────────
    const tests = results.tests as Record<string, { success: boolean }>;
    const passedCount = Object.values(tests).filter(t => t.success).length;
    const totalCount = Object.values(tests).length;

    const diagnostics = await getDiagnosticsSummary();

    return NextResponse.json({
        ...results,
        diagnostics: {
            totalApiCalls: diagnostics.totalCalls,
            successfulCalls: diagnostics.successfulCalls,
            failedCalls: diagnostics.failedCalls,
            totalCost: diagnostics.totalCost,
        },
        summary: {
            passed: passedCount,
            total: totalCount,
            allTestsPassed: passedCount === totalCount,
            readyForPhase5: passedCount === totalCount,
            nextStep: passedCount === totalCount
                ? 'Ready for Phase 5: Domain Authority UI Page'
                : 'Fix failing tests before proceeding',
        },
    });
}
