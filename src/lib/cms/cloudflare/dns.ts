// CMS Cloudflare - DNS Management

import { createCFClient, CFDnsRecord, CloudflareConfig } from './api';

export interface DnsSetupResult {
    success: boolean;
    records: CFDnsRecord[];
    errors?: string[];
}

// DNS record templates for feed subdomain setup
export const DNS_TEMPLATES = {
    // Point feed.domain.com to the main app
    feedSubdomain: (targetIp: string): Omit<CFDnsRecord, 'id'> => ({
        type: 'A',
        name: 'feed',
        content: targetIp,
        ttl: 1, // Auto (Cloudflare managed)
        proxied: true,
    }),

    // CNAME for feed subdomain pointing to Railway/Vercel
    feedCname: (targetHost: string): Omit<CFDnsRecord, 'id'> => ({
        type: 'CNAME',
        name: 'feed',
        content: targetHost,
        ttl: 1,
        proxied: true,
    }),

    // TXT record for verification
    verificationTxt: (clientCode: string): Omit<CFDnsRecord, 'id'> => ({
        type: 'TXT',
        name: '_cms-verify',
        content: `cms-client=${clientCode}`,
        ttl: 3600,
        proxied: false,
    }),
};

// Setup DNS for a new client
export async function setupClientDns(
    config: CloudflareConfig,
    clientCode: string,
    options: {
        useRailway?: boolean;
        railwayDomain?: string;
        customIp?: string;
    } = {}
): Promise<DnsSetupResult> {
    if (!config.zoneId) {
        return {
            success: false,
            records: [],
            errors: ['Zone ID is required'],
        };
    }

    const client = createCFClient(config);
    const records: CFDnsRecord[] = [];
    const errors: string[] = [];

    try {
        // Create feed subdomain record
        let feedRecord: Omit<CFDnsRecord, 'id'>;

        if (options.useRailway && options.railwayDomain) {
            feedRecord = DNS_TEMPLATES.feedCname(options.railwayDomain);
        } else if (options.customIp) {
            feedRecord = DNS_TEMPLATES.feedSubdomain(options.customIp);
        } else {
            return {
                success: false,
                records: [],
                errors: ['Either Railway domain or custom IP is required'],
            };
        }

        const feedResult = await client.createDnsRecord(config.zoneId, feedRecord);
        if (feedResult.success && feedResult.data) {
            records.push(feedResult.data);
        } else {
            errors.push(`Failed to create feed record: ${feedResult.errors?.[0]?.message}`);
        }

        // Create verification TXT record
        const txtRecord = DNS_TEMPLATES.verificationTxt(clientCode);
        const txtResult = await client.createDnsRecord(config.zoneId, txtRecord);
        if (txtResult.success && txtResult.data) {
            records.push(txtResult.data);
        } else {
            errors.push(`Failed to create TXT record: ${txtResult.errors?.[0]?.message}`);
        }

        return {
            success: errors.length === 0,
            records,
            errors: errors.length > 0 ? errors : undefined,
        };
    } catch (error) {
        return {
            success: false,
            records,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
        };
    }
}

// Verify DNS is properly configured
export async function verifyDnsSetup(
    config: CloudflareConfig,
    clientCode: string
): Promise<{ verified: boolean; issues: string[] }> {
    if (!config.zoneId) {
        return { verified: false, issues: ['Zone ID is required'] };
    }

    const client = createCFClient(config);
    const issues: string[] = [];

    try {
        const recordsResult = await client.listDnsRecords(config.zoneId);

        if (!recordsResult.success || !recordsResult.data) {
            return { verified: false, issues: ['Failed to fetch DNS records'] };
        }

        const records = recordsResult.data;

        // Check for feed subdomain
        const feedRecord = records.find(
            (r) => r.name.startsWith('feed') && (r.type === 'A' || r.type === 'CNAME')
        );
        if (!feedRecord) {
            issues.push('Missing feed subdomain record (A or CNAME)');
        } else if (!feedRecord.proxied) {
            issues.push('Feed subdomain is not proxied through Cloudflare');
        }

        // Check for verification TXT
        const txtRecord = records.find(
            (r) => r.name.includes('_cms-verify') && r.type === 'TXT'
        );
        if (!txtRecord) {
            issues.push('Missing CMS verification TXT record');
        } else if (!txtRecord.content.includes(clientCode)) {
            issues.push('TXT record has incorrect client code');
        }

        return {
            verified: issues.length === 0,
            issues,
        };
    } catch (error) {
        return {
            verified: false,
            issues: [error instanceof Error ? error.message : 'Unknown error'],
        };
    }
}

// Get friendly DNS status
export function getDnsStatus(record: CFDnsRecord): {
    status: 'active' | 'pending' | 'error';
    message: string;
} {
    if (!record.proxied && (record.type === 'A' || record.type === 'CNAME')) {
        return {
            status: 'pending',
            message: 'DNS record not proxied through Cloudflare',
        };
    }

    return {
        status: 'active',
        message: 'DNS record is active',
    };
}
