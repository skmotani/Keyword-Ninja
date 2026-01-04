/**
 * DataForSEO Diagnostic Logger
 * Self-diagnostic logging system for API call tracking and debugging
 * Version: 1.0.0
 */

import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
    ApiLogEntry,
    ApiLogLevel,
    ApiLogStatus,
    ApiDiagnosticsSummary,
    LocationCode,
} from './types';

console.log('[DataForSEO] Logger module loaded');

// ============================================================================
// CONFIGURATION
// ============================================================================

const LOG_DIR = path.join(process.cwd(), 'data', 'api_logs');
const LOG_FILE = 'dataforseo_diagnostics.json';
const MAX_LOG_ENTRIES = 500; // Keep last 500 entries
const MAX_RESPONSE_SNIPPET_LENGTH = 300;

// ============================================================================
// IN-MEMORY CACHE
// ============================================================================

let logCache: ApiLogEntry[] = [];
let cacheLoaded = false;
let currentCorrelationId: string = uuidv4();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function ensureLogDir(): Promise<void> {
    try {
        await fs.access(LOG_DIR);
    } catch {
        await fs.mkdir(LOG_DIR, { recursive: true });
        console.log(`[DataForSEO Logger] Created log directory: ${LOG_DIR}`);
    }
}

async function loadLogs(): Promise<ApiLogEntry[]> {
    if (cacheLoaded) return logCache;

    try {
        await ensureLogDir();
        const filePath = path.join(LOG_DIR, LOG_FILE);
        const data = await fs.readFile(filePath, 'utf-8');
        logCache = JSON.parse(data) as ApiLogEntry[];
        cacheLoaded = true;
        console.log(`[DataForSEO Logger] Loaded ${logCache.length} existing log entries`);
        return logCache;
    } catch {
        logCache = [];
        cacheLoaded = true;
        console.log('[DataForSEO Logger] Starting with empty log');
        return logCache;
    }
}

async function saveLogs(entries: ApiLogEntry[]): Promise<void> {
    await ensureLogDir();
    const filePath = path.join(LOG_DIR, LOG_FILE);

    // Trim to max entries (keep most recent)
    const trimmedEntries = entries.slice(-MAX_LOG_ENTRIES);
    logCache = trimmedEntries;

    await fs.writeFile(filePath, JSON.stringify(trimmedEntries, null, 2), 'utf-8');
}

function truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '... [truncated]';
}

// ============================================================================
// PUBLIC API - Correlation
// ============================================================================

/**
 * Start a new correlation context (call at beginning of a user action)
 */
export function startNewCorrelation(): string {
    currentCorrelationId = uuidv4();
    console.log(`[DataForSEO Logger] New correlation: ${currentCorrelationId}`);
    return currentCorrelationId;
}

/**
 * Get the current correlation ID
 */
export function getCorrelationId(): string {
    return currentCorrelationId;
}

// ============================================================================
// PUBLIC API - Log Entry Management
// ============================================================================

/**
 * Create a new log entry (starts in PENDING state)
 */
export function createLogEntry(
    endpoint: string,
    method: 'GET' | 'POST',
    options: {
        domain?: string;
        locationCode?: LocationCode;
        clientCode?: string;
    } = {}
): ApiLogEntry {
    return {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        level: 'INFO',
        status: 'PENDING',
        endpoint,
        method,
        domain: options.domain,
        locationCode: options.locationCode,
        durationMs: 0,
        retryCount: 0,
        correlationId: currentCorrelationId,
        clientCode: options.clientCode,
    };
}

/**
 * Mark log entry as SUCCESS
 */
export function markSuccess(
    entry: ApiLogEntry,
    result: {
        durationMs: number;
        httpStatus: number;
        apiStatusCode: number;
        apiStatusMessage: string;
        cost?: number;
    }
): ApiLogEntry {
    return {
        ...entry,
        status: 'SUCCESS',
        level: 'INFO',
        durationMs: result.durationMs,
        httpStatus: result.httpStatus,
        apiStatusCode: result.apiStatusCode,
        apiStatusMessage: result.apiStatusMessage,
        cost: result.cost,
    };
}

/**
 * Mark log entry as FAILED
 */
export function markError(
    entry: ApiLogEntry,
    error: {
        durationMs: number;
        httpStatus?: number;
        apiStatusCode?: number;
        apiStatusMessage?: string;
        errorType: string;
        errorMessage: string;
        retryCount?: number;
    }
): ApiLogEntry {
    return {
        ...entry,
        status: 'FAILED',
        level: 'ERROR',
        durationMs: error.durationMs,
        httpStatus: error.httpStatus,
        apiStatusCode: error.apiStatusCode,
        apiStatusMessage: error.apiStatusMessage,
        errorType: error.errorType,
        errorMessage: error.errorMessage,
        retryCount: error.retryCount ?? entry.retryCount,
    };
}

/**
 * Mark log entry as RETRYING
 */
export function markRetrying(
    entry: ApiLogEntry,
    retryCount: number,
    reason: string
): ApiLogEntry {
    return {
        ...entry,
        status: 'RETRYING',
        level: 'WARN',
        retryCount,
        errorMessage: reason,
    };
}

/**
 * Save a log entry to persistent storage and console
 */
export async function saveLogEntry(entry: ApiLogEntry): Promise<void> {
    const entries = await loadLogs();
    entries.push(entry);
    await saveLogs(entries);

    // Console output with emoji indicators
    const icon = entry.status === 'SUCCESS' ? '✅' :
        entry.status === 'FAILED' ? '❌' :
            entry.status === 'RETRYING' ? '🔄' : '⏳';

    const costStr = entry.cost ? ` | Cost: $${entry.cost.toFixed(4)}` : '';
    const domainStr = entry.domain ? ` | ${entry.domain}` : '';

    console.log(
        `[DFS ${icon}] ${entry.method} ${entry.endpoint}${domainStr} | ${entry.durationMs}ms${costStr} | ${entry.status}`
    );

    if (entry.status === 'FAILED') {
        console.error(`[DFS ERROR] ${entry.errorType}: ${entry.errorMessage}`);
    }
}

// ============================================================================
// PUBLIC API - Log Retrieval
// ============================================================================

/**
 * Get log entries with optional filtering
 */
export async function getLogEntries(options: {
    limit?: number;
    status?: ApiLogStatus;
    endpoint?: string;
    correlationId?: string;
    since?: Date;
} = {}): Promise<ApiLogEntry[]> {
    const entries = await loadLogs();

    let filtered = [...entries];

    if (options.status) {
        filtered = filtered.filter(e => e.status === options.status);
    }

    if (options.endpoint) {
        const ep = options.endpoint;
        filtered = filtered.filter(e => e.endpoint.includes(ep));
    }

    if (options.correlationId) {
        filtered = filtered.filter(e => e.correlationId === options.correlationId);
    }

    if (options.since) {
        const sinceTime = options.since.getTime();
        filtered = filtered.filter(e => new Date(e.timestamp).getTime() >= sinceTime);
    }

    // Sort by timestamp descending (most recent first)
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (options.limit) {
        filtered = filtered.slice(0, options.limit);
    }

    return filtered;
}

/**
 * Get diagnostics summary
 */
export async function getDiagnosticsSummary(since?: Date): Promise<ApiDiagnosticsSummary> {
    let entries = await loadLogs();

    if (since) {
        const sinceTime = since.getTime();
        entries = entries.filter(e => new Date(e.timestamp).getTime() >= sinceTime);
    }

    const successfulCalls = entries.filter(e => e.status === 'SUCCESS').length;
    const failedCalls = entries.filter(e => e.status === 'FAILED').length;
    const totalCost = entries.reduce((sum, e) => sum + (e.cost || 0), 0);
    const totalDuration = entries.reduce((sum, e) => sum + e.durationMs, 0);

    const callsByEndpoint: Record<string, number> = {};
    const errorsByType: Record<string, number> = {};

    for (const entry of entries) {
        // Simplify endpoint for grouping
        const endpoint = entry.endpoint.split('/').slice(0, 2).join('/');
        callsByEndpoint[endpoint] = (callsByEndpoint[endpoint] || 0) + 1;

        if (entry.status === 'FAILED' && entry.errorType) {
            errorsByType[entry.errorType] = (errorsByType[entry.errorType] || 0) + 1;
        }
    }

    return {
        totalCalls: entries.length,
        successfulCalls,
        failedCalls,
        totalCost: Math.round(totalCost * 10000) / 10000, // Round to 4 decimals
        averageDurationMs: entries.length > 0 ? Math.round(totalDuration / entries.length) : 0,
        callsByEndpoint,
        errorsByType,
        lastUpdated: new Date().toISOString(),
    };
}

/**
 * Clear all logs
 */
export async function clearLogs(): Promise<void> {
    logCache = [];
    cacheLoaded = true;
    await ensureLogDir();
    const filePath = path.join(LOG_DIR, LOG_FILE);
    await fs.writeFile(filePath, '[]', 'utf-8');
    console.log('[DataForSEO Logger] All logs cleared');
}

// ============================================================================
// DIAGNOSTIC EXPORT
// ============================================================================

export const LOGGER_VERSION = '1.0.0';
console.log(`[DataForSEO] Logger version: ${LOGGER_VERSION}`);
