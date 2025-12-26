
import { NextRequest, NextResponse } from 'next/server';
import { readClientSerpData } from '@/lib/clientSerpStore';
import { getKeywordApiDataByClientAndLocations } from '@/lib/keywordApiStore';
import { promises as fs } from 'fs';
import path from 'path';

// Helper to normalize domain
function normalizeDomain(url: string | null): string {
    if (!url) return '';
    try {
        let domain = url.trim();
        // Remove protocol
        domain = domain.replace(/^https?:\/\//i, '');
        // Remove www.
        domain = domain.replace(/^www\./i, '');
        // Remove everything after first slash
        domain = domain.split('/')[0];
        // Remove port if any
        domain = domain.split(':')[0];

        return domain.toLowerCase();
    } catch {
        return '';
    }
}

// Check isSelf
function isClientDomain(normDomain: string, clientDomainsNorm: string[]): boolean {
    if (!normDomain) return false;
    return clientDomainsNorm.some(cd => normDomain === cd || normDomain.endsWith('.' + cd));
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const clientCode = searchParams.get('clientCode');

    if (!clientCode) {
        return NextResponse.json({ success: false, error: 'Missing clientCode' }, { status: 400 });
    }

    try {
        // 1. Get Client Domains
        const clientsPath = path.join(process.cwd(), 'data', 'clients.json');
        const clientsData = await fs.readFile(clientsPath, 'utf-8');
        const clients = JSON.parse(clientsData);
        const client = clients.find((c: any) => c.code === clientCode);

        if (!client) {
            return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
        }

        const rawClientDomains = client.domains || (client.mainDomain ? [client.mainDomain] : []);
        const clientDomainsNorm = rawClientDomains.map((d: string) => normalizeDomain(d));

        // 2. Read Client SERP Data & Keyword API Data
        const [serpData, apiData] = await Promise.all([
            readClientSerpData(clientCode),
            getKeywordApiDataByClientAndLocations(clientCode, [2356, 2840]) // IN=2356, GL=2840
        ]);

        const keywords = serpData.keywords || [];

        // Create Metadata Lookup: key = locationCode_keywordLower
        const metaMap = new Map<string, any>();
        for (const rec of apiData) {
            const key = `${rec.locationCode}_${rec.keywordText.trim().toLowerCase()}`;
            metaMap.set(key, rec);
        }

        const rows: any[] = [];

        // 3. Process Rows
        for (const k of keywords) {
            const kLower = k.keyword.trim().toLowerCase();

            // Process IN
            if (k.serp?.IN) {
                const results = k.serp.IN.results || [];
                // Calculate Rank
                let rank: number | null = null;
                let rankUrl: string | null = null;

                // Extract Top 10 Competitors
                const competitors: { domain: string, url: string, isSelf: boolean }[] = [];

                for (let i = 0; i < Math.min(results.length, 10); i++) {
                    const item = results[i];
                    const norm = normalizeDomain(item.domain || item.url);
                    const isSelf = isClientDomain(norm, clientDomainsNorm);
                    competitors.push({
                        domain: norm,
                        url: item.url,
                        isSelf
                    });
                }

                // Fill remaining if less than 10
                while (competitors.length < 10) {
                    competitors.push({ domain: '', url: '', isSelf: false });
                }

                // Check Best Rank in ALL results (up to 100)
                for (const item of results) {
                    const norm = normalizeDomain(item.domain || item.url);
                    if (isClientDomain(norm, clientDomainsNorm)) {
                        if (rank === null || item.rank_group < rank) {
                            rank = item.rank_group;
                            rankUrl = item.url;
                        }
                    }
                }

                // Get Meta for IN (2356)
                const meta = metaMap.get(`2356_${kLower}`);

                rows.push({
                    id: `${k.keyword}_IN`,
                    keyword: k.keyword,
                    location: 'IN',
                    searchVolume: meta?.searchVolume ?? null,
                    cpc: meta?.cpc ?? null,
                    competition: meta?.competition ?? null,
                    rank,
                    rankUrl,
                    googleUrl: `https://www.google.co.in/search?q=${encodeURIComponent(k.keyword)}&gl=IN`,
                    competitors
                });
            }

            // Process GL
            if (k.serp?.GL) {
                const results = k.serp.GL.results || [];
                // Calculate Rank
                let rank: number | null = null;
                let rankUrl: string | null = null;

                // Extract Top 10 Competitors
                const competitors: { domain: string, url: string, isSelf: boolean }[] = [];

                for (let i = 0; i < Math.min(results.length, 10); i++) {
                    const item = results[i];
                    const norm = normalizeDomain(item.domain || item.url);
                    const isSelf = isClientDomain(norm, clientDomainsNorm);
                    competitors.push({
                        domain: norm,
                        url: item.url,
                        isSelf
                    });
                }
                // Fill remaining if less than 10
                while (competitors.length < 10) {
                    competitors.push({ domain: '', url: '', isSelf: false });
                }

                // Check Best Rank
                for (const item of results) {
                    const norm = normalizeDomain(item.domain || item.url);
                    if (isClientDomain(norm, clientDomainsNorm)) {
                        if (rank === null || item.rank_group < rank) {
                            rank = item.rank_group;
                            rankUrl = item.url;
                        }
                    }
                }

                // Get Meta for GL (2840)
                const meta = metaMap.get(`2840_${kLower}`);

                rows.push({
                    id: `${k.keyword}_GL`,
                    keyword: k.keyword,
                    location: 'GL',
                    searchVolume: meta?.searchVolume ?? null,
                    cpc: meta?.cpc ?? null,
                    competition: meta?.competition ?? null,
                    rank,
                    rankUrl,
                    googleUrl: `https://www.google.com/search?q=${encodeURIComponent(k.keyword)}&gl=US`,
                    competitors
                });
            }
        }

        return NextResponse.json({ success: true, data: rows });

    } catch (e: any) {
        console.error('API Error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
