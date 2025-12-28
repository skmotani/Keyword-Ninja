import { NextResponse } from 'next/server';
import { getDomainCredibility, saveDomainCredibility, DomainCredibilityRecord } from '@/lib/storage/domainCredibilityStore';
import { fetchWhoisOverview, fetchBacklinksSummary, fetchPaidKeywords } from '@/lib/dataforseoCredibility';

interface DomainRequest {
    domain: string;
    name?: string;
    type: 'client' | 'competitor' | 'other';
}

interface FetchRequest {
    clientCode: string;
    domains: DomainRequest[];
    forceRefresh?: boolean;
}

const FRESHNESS_DAYS = 7;

function isFresh(dateStr: string) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays < FRESHNESS_DAYS;
}

function normalizeDomain(d: string) {
    return d.toLowerCase()
        .replace(/^(https?:\/\/)?(www\.)?/, '')
        .replace(/\/.*$/, '');
}

function calculateAge(createdDate: string | undefined) {
    if (!createdDate) return undefined;
    const created = new Date(createdDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const years = diffTime / (1000 * 60 * 60 * 24 * 365.25);
    return parseFloat(years.toFixed(1));
}

async function processDomain(req: DomainRequest, clientCode: string, force: boolean): Promise<DomainCredibilityRecord> {
    const normDomain = normalizeDomain(req.domain);

    // 1. Check Cache
    if (!force) {
        const cached = await getDomainCredibility(clientCode, normDomain);
        if (cached && isFresh(cached.lastPulledAt)) {
            return cached;
        }
    }

    // 2. Fetch Live
    try {
        const [whois, backlinks, ads] = await Promise.all([
            fetchWhoisOverview(normDomain).catch(e => ({ error: e.message })),
            fetchBacklinksSummary(normDomain).catch(e => ({ error: e.message })),
            fetchPaidKeywords(normDomain).catch(e => ({ error: e.message }))
        ]);

        const createdDate = whois?.created_date || whois?.creation_date;

        const record: DomainCredibilityRecord = {
            clientCode,
            domain: normDomain,
            name: req.name || normDomain,
            type: req.type,
            lastPulledAt: new Date().toISOString(),

            // WHOIS
            createdDate: createdDate,
            domainAgeYears: calculateAge(createdDate),
            whoisJson: whois,

            // Backlinks
            referringDomains: backlinks?.referring_domains,
            totalBacklinks: backlinks?.backlinks,
            dofollowBacklinks: backlinks?.dofollow_backlinks,
            nofollowBacklinks: backlinks?.nofollow_backlinks,
            backlinksSummaryJson: backlinks,

            // Ads
            paidKeywords: ads?.total_count ?? (Array.isArray(ads?.items) ? ads.items.length : 0),
            adsKeywordsJson: ads
        };

        return record;

    } catch (e: any) {
        console.error(`Failed to fetch for ${normDomain}`, e);
        // Return error / partial state?
        // Returning a fallback record to avoid UI crash
        return {
            clientCode,
            domain: normDomain,
            name: req.name,
            type: req.type,
            lastPulledAt: new Date().toISOString(),
            // Indicate error in a field? We can use the json fields for that or add an error field.
            // For now, empty values imply failure or no data.
        };
    }
}

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as FetchRequest;
        const { clientCode, domains, forceRefresh } = body;

        if (!clientCode || !domains || !Array.isArray(domains)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        // Run sequentially to be safe with rate limits / concurrency
        const results: DomainCredibilityRecord[] = [];
        const concurrency = 3;

        for (let i = 0; i < domains.length; i += concurrency) {
            const chunk = domains.slice(i, i + concurrency);
            const chunkResults = await Promise.all(chunk.map(d => processDomain(d, clientCode, !!forceRefresh)));
            results.push(...chunkResults);
        }

        // Save batch
        await saveDomainCredibility(results);

        return NextResponse.json({
            clientCode,
            lastPulledAt: new Date().toISOString(),
            results
        });

    } catch (error: any) {
        console.error("API Error", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
