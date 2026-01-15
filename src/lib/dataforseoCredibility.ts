import { fetchDfs, getDfsCredentials } from './dataforseoStandard';

export async function fetchWhoisOverview(domain: string) {
    const creds = await getDfsCredentials();
    if (!creds) throw new Error('No DataForSEO credentials');

    const payload = [{
        limit: 1,
        offset: 0,
        filters: [["domain", "=", domain]]
    }];

    const response = await fetchDfs('domain_analytics/whois/overview/live', payload, creds);
    return response?.tasks?.[0]?.result?.[0]?.items?.[0] || null;
}

export async function fetchBacklinksSummary(domain: string) {
    const creds = await getDfsCredentials();
    if (!creds) throw new Error('No DataForSEO credentials');

    const payload = [{
        target: domain,
        internal_list_limit: 1
    }];

    const response = await fetchDfs('backlinks/summary/live', payload, creds);
    return response?.tasks?.[0]?.result?.[0] || null;
}

export async function fetchPaidKeywords(domain: string, locationCode: number = 2840) { // Default US(2840) or IN(356)? User said 356 in prompt.
    // User prompt said: "Request (India default; allow future global toggle later): location_code: 356"
    // So I will default to 356.
    const creds = await getDfsCredentials();
    if (!creds) throw new Error('No DataForSEO credentials');

    const payload = [{
        target: domain,
        location_code: 356,
        language_code: "en",
        limit: 1 // We just want the count
    }];

    const response = await fetchDfs('keywords_data/google_ads/keywords_for_site/live', payload, creds);
    return response?.tasks?.[0]?.result?.[0] || null;
}
