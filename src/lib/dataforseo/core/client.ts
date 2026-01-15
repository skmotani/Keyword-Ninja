/**
 * DataForSEO HTTP Client
 * Unified client with retry logic, rate limiting, and comprehensive error handling
 * Version: 1.0.0
 */

import {
    DataForSEOCredentials,
    DataForSEOConfig,
    DataForSEOResponse,
    DataForSEOError,
    DEFAULT_CONFIG,
    ERROR_CODES,
    LocationCode,
} from './types';
import { createAuthHeader, getDataForSEOCredentials } from './credentials';
import {
    createLogEntry,
    markSuccess,
    markError,
    markRetrying,
    saveLogEntry,
    startNewCorrelation,
} from './logger';

console.log('[DataForSEO] Client module loaded');

// ============================================================================
// RATE LIMITER
// ============================================================================

class RateLimiter {
    private timestamps: number[] = [];
    private readonly maxRequests: number;
    private readonly windowMs: number = 60000; // 1 minute

    constructor(maxRequestsPerMinute: number) {
        this.maxRequests = maxRequestsPerMinute;
        console.log(`[DataForSEO RateLimiter] Initialized: ${maxRequestsPerMinute} requests/minute`);
    }

    async waitForSlot(): Promise<void> {
        const now = Date.now();

        // Remove timestamps older than window
        this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);

        if (this.timestamps.length >= this.maxRequests) {
            const oldestTimestamp = this.timestamps[0];
            const waitTime = this.windowMs - (now - oldestTimestamp) + 100; // Add 100ms buffer

            console.log(`[DataForSEO RateLimiter] Rate limit reached. Waiting ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));

            return this.waitForSlot(); // Check again after waiting
        }

        this.timestamps.push(now);
    }

    getAvailableSlots(): number {
        const now = Date.now();
        this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);
        return Math.max(0, this.maxRequests - this.timestamps.length);
    }
}

// Global rate limiter instance
const rateLimiter = new RateLimiter(DEFAULT_CONFIG.rateLimitPerMinute);

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

function classifyError(
    httpStatus: number | undefined,
    apiStatusCode: number | undefined,
    message: string
): { code: string; retryable: boolean } {
    // HTTP-level errors
    if (httpStatus) {
        if (httpStatus === 401 || httpStatus === 403) {
            return { code: ERROR_CODES.UNAUTHORIZED, retryable: false };
        }
        if (httpStatus === 429) {
            return { code: ERROR_CODES.RATE_LIMITED, retryable: true };
        }
        if (httpStatus >= 500) {
            return { code: ERROR_CODES.SERVER_ERROR, retryable: true };
        }
        if (httpStatus === 404) {
            return { code: ERROR_CODES.NOT_FOUND, retryable: false };
        }
    }

    // API-level errors (DataForSEO specific)
    if (apiStatusCode) {
        if (apiStatusCode === 40001 || apiStatusCode === 40002) {
            return { code: ERROR_CODES.UNAUTHORIZED, retryable: false };
        }
        if (apiStatusCode === 40501 || apiStatusCode === 40502) {
            return { code: ERROR_CODES.INVALID_REQUEST, retryable: false };
        }
        if (apiStatusCode === 40601) {
            return { code: ERROR_CODES.RATE_LIMITED, retryable: true };
        }
        if (apiStatusCode >= 50000) {
            return { code: ERROR_CODES.SERVER_ERROR, retryable: true };
        }
    }

    // Message-based classification
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('timeout') || lowerMessage.includes('aborted')) {
        return { code: ERROR_CODES.TIMEOUT, retryable: true };
    }
    if (lowerMessage.includes('network') || lowerMessage.includes('fetch failed')) {
        return { code: ERROR_CODES.NETWORK_ERROR, retryable: true };
    }

    return { code: ERROR_CODES.SERVER_ERROR, retryable: false };
}

// ============================================================================
// MAIN CLIENT CLASS
// ============================================================================

export class DataForSEOClient {
    private credentials: DataForSEOCredentials | null = null;
    private config: DataForSEOConfig;
    private clientCode?: string;

    constructor(config?: Partial<DataForSEOConfig>, clientCode?: string) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.clientCode = clientCode;
        console.log(`[DataForSEO Client] Initialized for client: ${clientCode || 'ANY'}`);
    }

    /**
     * Ensure credentials are loaded
     */
    private async ensureCredentials(): Promise<DataForSEOCredentials> {
        if (!this.credentials) {
            this.credentials = await getDataForSEOCredentials(this.clientCode);
        }
        return this.credentials;
    }

    /**
     * Execute an API request with retry logic
     */
    async request<T = unknown>(
        endpoint: string,
        payload?: unknown,
        options: {
            method?: 'GET' | 'POST';
            domain?: string;
            locationCode?: LocationCode;
        } = {}
    ): Promise<DataForSEOResponse<T>> {
        const credentials = await this.ensureCredentials();
        const method = options.method || (payload ? 'POST' : 'GET');
        const correlationId = startNewCorrelation();

        // Create initial log entry
        const logEntry = createLogEntry(endpoint, method, {
            domain: options.domain,
            locationCode: options.locationCode,
            clientCode: this.clientCode,
        });

        let lastError: Error | null = null;
        let attempt = 0;

        while (attempt < this.config.maxRetries) {
            attempt++;
            const startTime = Date.now();

            try {
                // Wait for rate limit slot
                await rateLimiter.waitForSlot();

                // Execute the request
                const result = await this.executeRequest<T>(endpoint, method, payload, credentials);
                const durationMs = Date.now() - startTime;

                // Log success
                const successEntry = markSuccess(logEntry, {
                    durationMs,
                    httpStatus: 200,
                    apiStatusCode: result.status_code,
                    apiStatusMessage: result.status_message,
                    cost: result.cost,
                });
                await saveLogEntry(successEntry);

                return result;

            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                const durationMs = Date.now() - startTime;

                // Extract error details
                const httpStatus = (error as any).httpStatus;
                const apiStatusCode = (error as any).apiStatusCode;
                const { code, retryable } = classifyError(httpStatus, apiStatusCode, lastError.message);

                // Should we retry?
                if (retryable && attempt < this.config.maxRetries) {
                    const retryEntry = markRetrying(
                        logEntry,
                        attempt,
                        `${code}: ${lastError.message}. Retrying...`
                    );
                    await saveLogEntry(retryEntry);

                    // Exponential backoff
                    const backoffMs = this.config.retryDelayMs * attempt;
                    console.log(`[DataForSEO Client] Retry ${attempt}/${this.config.maxRetries} in ${backoffMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                    continue;
                }

                // Final failure - log and throw
                const errorEntry = markError(logEntry, {
                    durationMs,
                    httpStatus,
                    apiStatusCode,
                    errorType: code,
                    errorMessage: lastError.message,
                    retryCount: attempt,
                });
                await saveLogEntry(errorEntry);

                throw new DataForSEOError(
                    lastError.message,
                    code,
                    httpStatus,
                    apiStatusCode,
                    endpoint,
                    retryable
                );
            }
        }

        // Should not reach here
        throw lastError || new Error('Unknown error after retries');
    }

    /**
     * Execute a single HTTP request (no retry logic here)
     */
    private async executeRequest<T>(
        endpoint: string,
        method: 'GET' | 'POST',
        payload: unknown,
        credentials: DataForSEOCredentials
    ): Promise<DataForSEOResponse<T>> {
        const url = `${this.config.baseUrl}/${endpoint}`;
        const authHeader = createAuthHeader(credentials);

        // Setup timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
            const headers: Record<string, string> = {
                'Authorization': authHeader,
            };

            const fetchOptions: RequestInit = {
                method,
                headers,
                signal: controller.signal,
            };

            // POST requests need JSON body
            if (method === 'POST' && payload) {
                headers['Content-Type'] = 'application/json';
                // DataForSEO expects array for POST
                const bodyData = Array.isArray(payload) ? payload : [payload];
                fetchOptions.body = JSON.stringify(bodyData);
            }

            console.log(`[DataForSEO Client] ${method} ${endpoint}`);

            const response = await fetch(url, fetchOptions);
            clearTimeout(timeoutId);

            const responseText = await response.text();

            // HTTP error
            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                (error as any).httpStatus = response.status;
                (error as any).responseBody = responseText.substring(0, 200);
                throw error;
            }

            // Parse JSON
            let data: DataForSEOResponse<T>;
            try {
                data = JSON.parse(responseText);
            } catch {
                const error = new Error(`Invalid JSON response`);
                (error as any).httpStatus = response.status;
                throw error;
            }

            // API-level error
            if (data.status_code && data.status_code >= 40000) {
                const error = new Error(data.status_message || `API Error ${data.status_code}`);
                (error as any).apiStatusCode = data.status_code;
                throw error;
            }

            return data;

        } catch (error) {
            clearTimeout(timeoutId);

            // Handle abort (timeout)
            if (error instanceof Error && error.name === 'AbortError') {
                const timeoutError = new Error(`Request timeout after ${this.config.timeout}ms`);
                (timeoutError as any).httpStatus = 408;
                throw timeoutError;
            }

            throw error;
        }
    }

    /**
     * Get available rate limit slots
     */
    getAvailableSlots(): number {
        return rateLimiter.getAvailableSlots();
    }
}

// ============================================================================
// SINGLETON FACTORY
// ============================================================================

let defaultClient: DataForSEOClient | null = null;

/**
 * Get or create the default DataForSEO client
 */
export function getDataForSEOClient(clientCode?: string): DataForSEOClient {
    // Always create new if clientCode is specified
    if (clientCode) {
        return new DataForSEOClient(undefined, clientCode);
    }

    // Return singleton for default client
    if (!defaultClient) {
        defaultClient = new DataForSEOClient();
    }
    return defaultClient;
}

/**
 * Create a new DataForSEO client with custom config
 */
export function createDataForSEOClient(
    config?: Partial<DataForSEOConfig>,
    clientCode?: string
): DataForSEOClient {
    return new DataForSEOClient(config, clientCode);
}

// ============================================================================
// DIAGNOSTIC EXPORT
// ============================================================================

export const CLIENT_VERSION = '1.0.0';
console.log(`[DataForSEO] Client version: ${CLIENT_VERSION}`);
