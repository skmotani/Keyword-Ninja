/**
 * DataForSEO Module - Main Entry Point
 * 
 * Usage:
 * ```typescript
 * import { fetchDomainCredibility, getDataForSEOClient } from '@/lib/dataforseo';
 * 
 * // Fetch complete credibility data
 * const credibility = await fetchDomainCredibility('example.com');
 * 
 * // Or use individual endpoints
 * import { fetchWhoisOverview, fetchBacklinksSummary } from '@/lib/dataforseo';
 * ```
 */

console.log('[DataForSEO] Main module loading...');

// ============================================================================
// CORE EXPORTS
// ============================================================================

// Types
export * from './core/types';

// Client
export {
    DataForSEOClient,
    getDataForSEOClient,
    createDataForSEOClient,
    CLIENT_VERSION,
} from './core/client';

// Credentials
export {
    getDataForSEOCredentials,
    createAuthHeader,
    validateCredentials,
    maskCredentials,
    CREDENTIALS_VERSION,
} from './core/credentials';

// Logger
export {
    startNewCorrelation,
    getCorrelationId,
    createLogEntry,
    markSuccess,
    markError,
    markRetrying,
    saveLogEntry,
    getLogEntries,
    getDiagnosticsSummary,
    clearLogs,
    LOGGER_VERSION,
} from './core/logger';

// ============================================================================
// ENDPOINT EXPORTS
// ============================================================================

// Whois
export {
    fetchWhoisOverview,
    WHOIS_VERSION,
} from './endpoints/whois';
export type { WhoisResult } from './endpoints/whois';

// Backlinks
export {
    fetchBacklinksSummary,
    BACKLINKS_VERSION,
} from './endpoints/backlinks';
export type { BacklinksResult } from './endpoints/backlinks';

// Labs
export {
    fetchDomainRankOverview,
    LABS_VERSION,
} from './endpoints/labs';
export type { LabsResult } from './endpoints/labs';

// Credibility (Combined)
export {
    fetchDomainCredibility,
    toCredibilityRecord,
    CREDIBILITY_VERSION,
} from './endpoints/credibility';
export type { CredibilityFetchOptions } from './endpoints/credibility';

// ============================================================================
// UTILITY HELPERS
// ============================================================================

import { LOCATION_CODES, LANGUAGE_CODES, LocationCode } from './core/types';

/**
 * Get numeric location code from string code
 */
export function getLocationCode(code: LocationCode | string): number {
    return LOCATION_CODES[code as LocationCode] || LOCATION_CODES.IN;
}

/**
 * Get language code for a location
 */
export function getLanguageCode(locationCode: LocationCode | string): string {
    return LANGUAGE_CODES[locationCode as LocationCode] || 'en';
}

/**
 * Clean a domain string
 */
export function cleanDomain(domain: string): string {
    return domain
        .toLowerCase()
        .trim()
        .replace(/^(https?:\/\/)?(www\.)?/, '')
        .replace(/\/.*$/, '')
        .replace(/\s+/g, '');
}

// ============================================================================
// VERSION
// ============================================================================

export const DATAFORSEO_MODULE_VERSION = '1.0.0';
console.log(`[DataForSEO] Module version: ${DATAFORSEO_MODULE_VERSION}`);
console.log('[DataForSEO] Main module loaded successfully');
