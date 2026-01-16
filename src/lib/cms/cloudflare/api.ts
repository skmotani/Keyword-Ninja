// CMS Cloudflare - API Client

export interface CloudflareConfig {
    apiToken: string;
    accountId?: string;
    zoneId?: string;
}

export interface CFZone {
    id: string;
    name: string;
    status: string;
    paused: boolean;
    type: string;
    nameServers: string[];
}

export interface CFDnsRecord {
    id: string;
    type: 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'NS';
    name: string;
    content: string;
    ttl: number;
    proxied: boolean;
}

export interface CFApiResult<T> {
    success: boolean;
    data?: T;
    errors?: Array<{ code: number; message: string }>;
}

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

// Create Cloudflare API client
export function createCFClient(config: CloudflareConfig) {
    const headers = {
        'Authorization': `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
    };

    async function request<T>(
        endpoint: string,
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
        body?: unknown
    ): Promise<CFApiResult<T>> {
        try {
            const response = await fetch(`${CF_API_BASE}${endpoint}`, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
            });

            const data = await response.json();

            if (!data.success) {
                return {
                    success: false,
                    errors: data.errors || [{ code: response.status, message: 'Unknown error' }],
                };
            }

            return {
                success: true,
                data: data.result,
            };
        } catch (error) {
            return {
                success: false,
                errors: [{ code: 0, message: error instanceof Error ? error.message : 'Network error' }],
            };
        }
    }

    return {
        // Verify API token
        async verifyToken(): Promise<CFApiResult<{ status: string }>> {
            return request('/user/tokens/verify');
        },

        // List zones
        async listZones(): Promise<CFApiResult<CFZone[]>> {
            return request('/zones');
        },

        // Get zone details
        async getZone(zoneId: string): Promise<CFApiResult<CFZone>> {
            return request(`/zones/${zoneId}`);
        },

        // List DNS records
        async listDnsRecords(zoneId: string): Promise<CFApiResult<CFDnsRecord[]>> {
            return request(`/zones/${zoneId}/dns_records`);
        },

        // Create DNS record
        async createDnsRecord(
            zoneId: string,
            record: Omit<CFDnsRecord, 'id'>
        ): Promise<CFApiResult<CFDnsRecord>> {
            return request(`/zones/${zoneId}/dns_records`, 'POST', record);
        },

        // Update DNS record
        async updateDnsRecord(
            zoneId: string,
            recordId: string,
            record: Partial<CFDnsRecord>
        ): Promise<CFApiResult<CFDnsRecord>> {
            return request(`/zones/${zoneId}/dns_records/${recordId}`, 'PATCH', record);
        },

        // Delete DNS record
        async deleteDnsRecord(
            zoneId: string,
            recordId: string
        ): Promise<CFApiResult<{ id: string }>> {
            return request(`/zones/${zoneId}/dns_records/${recordId}`, 'DELETE');
        },

        // Purge cache
        async purgeCache(zoneId: string, urls?: string[]): Promise<CFApiResult<{ id: string }>> {
            const body = urls ? { files: urls } : { purge_everything: true };
            return request(`/zones/${zoneId}/purge_cache`, 'POST', body);
        },

        // Purge cache for specific page
        async purgePage(zoneId: string, pageUrl: string): Promise<CFApiResult<{ id: string }>> {
            return request(`/zones/${zoneId}/purge_cache`, 'POST', { files: [pageUrl] });
        },
    };
}

// Validate Cloudflare API token format
export function validateApiToken(token: string): boolean {
    // Cloudflare API tokens are 40 characters
    return /^[a-zA-Z0-9_-]{40}$/.test(token);
}

// Mask API token for display
export function maskApiToken(token: string): string {
    if (token.length < 8) return '***';
    return token.slice(0, 4) + '...' + token.slice(-4);
}
