/**
 * DataForSEO Core Types
 * Version: 1.0.0
 * 
 * DIAGNOSTIC: If this file loads correctly, you'll see:
 * "DataForSEO Types Loaded" in the console when imported
 */

console.log('[DataForSEO] Types module loaded');

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface DataForSEOCredentials {
    username: string;
    password: string;
}

export interface DataForSEOConfig {
    baseUrl: string;
    timeout: number;
    maxRetries: number;
    retryDelayMs: number;
    rateLimitPerMinute: number;
}

export const DEFAULT_CONFIG: DataForSEOConfig = {
    baseUrl: 'https://api.dataforseo.com/v3',
    timeout: 30000,      // 30 seconds
    maxRetries: 3,       // Retry failed requests up to 3 times
    retryDelayMs: 1000,  // Wait 1 second between retries (multiplied by attempt)
    rateLimitPerMinute: 2000,  // DataForSEO allows 2000 requests/minute
};

// ============================================================================
// LOCATION & LANGUAGE CODES
// ============================================================================

/**
 * CRITICAL: India = 2356, NOT 356
 * This was a bug in previous code
 */
export const LOCATION_CODES = {
    IN: 2356,   // India
    US: 2840,   // United States  
    GL: 2840,   // Global (uses US as proxy)
    UK: 2826,   // United Kingdom
    AU: 2036,   // Australia
    CA: 2124,   // Canada
} as const;

export const LANGUAGE_CODES = {
    IN: 'en',
    US: 'en',
    GL: 'en',
    UK: 'en',
    AU: 'en',
    CA: 'en',
} as const;

export type LocationCode = keyof typeof LOCATION_CODES;
export type NumericLocationCode = (typeof LOCATION_CODES)[LocationCode];

// ============================================================================
// API RESPONSE STRUCTURES
// ============================================================================

export interface DataForSEOBaseResponse {
    version: string;
    status_code: number;
    status_message: string;
    time: string;
    cost: number;
    tasks_count: number;
    tasks_error: number;
}

export interface DataForSEOTask<T = unknown> {
    id: string;
    status_code: number;
    status_message: string;
    time: string;
    cost: number;
    result_count: number;
    path: string[];
    data: Record<string, unknown>;
    result: T[] | null;
}

export interface DataForSEOResponse<T = unknown> extends DataForSEOBaseResponse {
    tasks: DataForSEOTask<T>[];
}

// ============================================================================
// DOMAIN CREDIBILITY TYPES
// ============================================================================

export interface DomainCredibilityData {
    domain: string;
    locationCode: LocationCode;

    // From Whois API
    domainAgeYears: number | null;
    createdDate: string | null;
    expirationDate: string | null;
    registrar: string | null;

    // From Backlinks API  
    referringDomains: number | null;
    totalBacklinks: number | null;
    dofollowBacklinks: number | null;
    nofollowBacklinks: number | null;
    backlinkSpamScore: number | null;
    domainRank: number | null;

    // From Labs API
    paidKeywordsCount: number | null;
    organicKeywordsCount: number | null;

    // From Labs API - Marketing Metrics (NEW)
    organicTraffic: number | null;        // Estimated monthly organic visits
    organicCost: number | null;           // Estimated traffic cost in USD
    organicTop3: number | null;           // Keywords in position 1-3
    organicTop10: number | null;          // Keywords in position 1-10
    organicTop100: number | null;         // Keywords in position 1-100
    keywordVisibilityScore: number | null; // Computed visibility (0-100)
    paidTraffic: number | null;           // Estimated paid traffic
    paidCost: number | null;              // Monthly ad spend

    // Meta
    fetchedAt: string;
    errors: string[];
}

export interface DomainCredibilityRecord extends DomainCredibilityData {
    id: string;
    clientCode: string;
    domainType: 'client' | 'competitor';
    label?: string;
}

// ============================================================================
// API LOGGING TYPES
// ============================================================================

export type ApiLogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type ApiLogStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'RETRYING';

export interface ApiLogEntry {
    id: string;
    timestamp: string;
    level: ApiLogLevel;
    status: ApiLogStatus;

    // Request info
    endpoint: string;
    method: 'GET' | 'POST';
    domain?: string;
    locationCode?: LocationCode;

    // Timing
    durationMs: number;
    retryCount: number;

    // Response info
    httpStatus?: number;
    apiStatusCode?: number;
    apiStatusMessage?: string;
    cost?: number;

    // Error info
    errorType?: string;
    errorMessage?: string;

    // Context
    correlationId: string;
    clientCode?: string;
}

export interface ApiDiagnosticsSummary {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    totalCost: number;
    averageDurationMs: number;
    callsByEndpoint: Record<string, number>;
    errorsByType: Record<string, number>;
    lastUpdated: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class DataForSEOError extends Error {
    constructor(
        message: string,
        public code: string,
        public httpStatus?: number,
        public apiStatusCode?: number,
        public endpoint?: string,
        public retryable: boolean = false
    ) {
        super(message);
        this.name = 'DataForSEOError';
    }
}

export const ERROR_CODES = {
    // Network errors
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',

    // Auth errors  
    UNAUTHORIZED: 'UNAUTHORIZED',
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

    // API errors
    RATE_LIMITED: 'RATE_LIMITED',
    INVALID_REQUEST: 'INVALID_REQUEST',
    NOT_FOUND: 'NOT_FOUND',
    SERVER_ERROR: 'SERVER_ERROR',

    // Data errors
    NO_CREDENTIALS: 'NO_CREDENTIALS',
    NO_DATA: 'NO_DATA',
    PARSE_ERROR: 'PARSE_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ============================================================================
// DIAGNOSTIC EXPORT
// ============================================================================

export const TYPES_VERSION = '1.0.0';
console.log(`[DataForSEO] Types version: ${TYPES_VERSION}`);
