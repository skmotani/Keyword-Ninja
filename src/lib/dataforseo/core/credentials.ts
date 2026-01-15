/**
 * DataForSEO Credentials Helper
 * Loads credentials from existing data/api_credentials.json
 * 
 * DIAGNOSTIC: Console logs credential loading status
 */

import { promises as fs } from 'fs';
import path from 'path';
import { DataForSEOCredentials, DataForSEOError, ERROR_CODES } from './types';

console.log('[DataForSEO] Credentials module loaded');

// ============================================================================
// TYPES (matching your existing api_credentials.json structure)
// ============================================================================

interface ApiCredential {
    id: string;
    userId: string;
    serviceType: 'DATAFORSEO' | 'SEO_SERP' | 'OPENAI' | 'GEMINI' | 'GROK' | 'GSC' | 'CUSTOM';
    authType: 'USERNAME_PASSWORD' | 'API_KEY' | 'OAUTH' | 'CUSTOM';
    username?: string;
    password?: string;
    apiKey?: string;
    label: string;
    clientCode?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

// ============================================================================
// CREDENTIAL LOADING
// ============================================================================

const CREDENTIALS_FILE = path.join(process.cwd(), 'data', 'api_credentials.json');

/**
 * Load all API credentials from storage
 */
async function loadAllCredentials(): Promise<ApiCredential[]> {
    try {
        console.log(`[DataForSEO] Loading credentials from: ${CREDENTIALS_FILE}`);
        const data = await fs.readFile(CREDENTIALS_FILE, 'utf-8');
        const credentials = JSON.parse(data) as ApiCredential[];
        console.log(`[DataForSEO] Found ${credentials.length} total credentials`);
        return credentials;
    } catch (error) {
        console.error('[DataForSEO] Failed to load credentials file:', error);
        return [];
    }
}

/**
 * Get DataForSEO credentials
 * Priority: Client-specific > Global active > Environment variables
 */
export async function getDataForSEOCredentials(
    clientCode?: string
): Promise<DataForSEOCredentials> {
    console.log(`[DataForSEO] Getting credentials for client: ${clientCode || 'ANY'}`);

    const allCredentials = await loadAllCredentials();

    // Filter to active DataForSEO credentials
    const dfsCredentials = allCredentials.filter(
        c => c.serviceType === 'DATAFORSEO' && c.isActive
    );

    console.log(`[DataForSEO] Found ${dfsCredentials.length} active DataForSEO credentials`);

    if (dfsCredentials.length === 0) {
        // Fall back to environment variables
        console.log('[DataForSEO] No stored credentials, checking environment variables...');
        const envUsername = process.env.DATAFORSEO_USERNAME || process.env.DFS_LOGIN;
        const envPassword = process.env.DATAFORSEO_PASSWORD || process.env.DFS_PASSWORD;

        if (envUsername && envPassword) {
            console.log('[DataForSEO] Using environment variable credentials');
            return { username: envUsername, password: envPassword };
        }

        console.error('[DataForSEO] NO CREDENTIALS FOUND!');
        throw new DataForSEOError(
            'No DataForSEO credentials found. Please configure in Settings or set environment variables.',
            ERROR_CODES.NO_CREDENTIALS
        );
    }

    // Priority 1: Client-specific credential
    if (clientCode) {
        const clientSpecific = dfsCredentials.find(c => c.clientCode === clientCode);
        if (clientSpecific?.username && clientSpecific?.password) {
            console.log(`[DataForSEO] Using client-specific credential: ${clientSpecific.label}`);
            return {
                username: clientSpecific.username,
                password: clientSpecific.password,
            };
        }
    }

    // Priority 2: Global credential (no clientCode)
    const globalCred = dfsCredentials.find(c => !c.clientCode);
    if (globalCred?.username && globalCred?.password) {
        console.log(`[DataForSEO] Using global credential: ${globalCred.label}`);
        return {
            username: globalCred.username,
            password: globalCred.password,
        };
    }

    // Priority 3: First available
    const firstCred = dfsCredentials[0];
    if (firstCred?.username && firstCred?.password) {
        console.log(`[DataForSEO] Using first available credential: ${firstCred.label}`);
        return {
            username: firstCred.username,
            password: firstCred.password,
        };
    }

    throw new DataForSEOError(
        'DataForSEO credentials found but username or password is missing.',
        ERROR_CODES.INVALID_CREDENTIALS
    );
}

/**
 * Create Basic Auth header value
 */
export function createAuthHeader(credentials: DataForSEOCredentials): string {
    const encoded = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
    return `Basic ${encoded}`;
}

/**
 * Mask credentials for safe logging
 */
export function maskCredentials(credentials: DataForSEOCredentials): { username: string; password: string } {
    return {
        username: credentials.username,
        password: credentials.password ? `****${credentials.password.slice(-4)}` : '****',
    };
}

/**
 * Test if credentials are valid by calling DataForSEO user_data endpoint
 */
export async function validateCredentials(
    credentials: DataForSEOCredentials
): Promise<{ valid: boolean; message: string; balance?: number }> {
    console.log('[DataForSEO] Validating credentials...');

    try {
        const authHeader = createAuthHeader(credentials);

        const response = await fetch('https://api.dataforseo.com/v3/appendix/user_data', {
            method: 'GET',
            headers: {
                'Authorization': authHeader,
            },
        });

        if (!response.ok) {
            if (response.status === 401) {
                console.error('[DataForSEO] Validation failed: Invalid credentials');
                return { valid: false, message: 'Invalid username or password' };
            }
            console.error(`[DataForSEO] Validation failed: HTTP ${response.status}`);
            return { valid: false, message: `HTTP Error: ${response.status}` };
        }

        const data = await response.json();

        if (data.status_code === 20000) {
            const balance = data.tasks?.[0]?.result?.[0]?.money?.balance;
            console.log(`[DataForSEO] Credentials valid! Balance: $${balance}`);
            return {
                valid: true,
                message: 'Credentials are valid',
                balance: balance,
            };
        }

        console.error(`[DataForSEO] Validation failed: ${data.status_message}`);
        return {
            valid: false,
            message: data.status_message || 'Unknown error',
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[DataForSEO] Validation error: ${message}`);
        return { valid: false, message: `Connection error: ${message}` };
    }
}

// ============================================================================
// DIAGNOSTIC EXPORT
// ============================================================================

export const CREDENTIALS_VERSION = '1.0.0';
console.log(`[DataForSEO] Credentials module version: ${CREDENTIALS_VERSION}`);
