
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

async function main() {
    console.log('--- Debugging Q013 V2 ---');

    // MOCK DATA LOADING
    const clients = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'clients.json'), 'utf8'));
    const competitors = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'competitors.json'), 'utf8'));
    // Read domain_credibility.json directly to mock getCredibilityByClientAndLocation
    const allCredibility = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'domain_credibility.json'), 'utf8'));
    // Filter for client 01 but ignore locationCode for now as we suspect it might be issue, 
    // OR filter strictly if we want to reproduce store behavior.
    // Debug store said 79 records found for IN.
    // Let's use strict filter to match Store behavior? 
    // Wait, Store filtered by locationCode='IN', but JSON has NO locationCode.
    // This implies debug_store.ts worked because it imported the REAL store which somehow handled it (maybe default?).
    // I can't import real store easily? 
    // I'll just use ALL records for client 01 to be safe/lenient like the first debug script.
    const domainCredibility = allCredibility.filter((r: any) => r.clientCode === '01');

    console.log(`Loaded ${domainCredibility.length} credibility records for 01`);

    // PARAMS
    const params = { clientCode: '01' };

    // --- LOGIC FROM ROUTE.TS (executeBrandETVQuery) ---
    // Get Meera (client 01)
    const client = clients.find((c: any) => c.code === params.clientCode);
    if (!client) {
        throw new Error(`Client not found: ${params.clientCode}`);
    }

    // Get Main Competitors
    const mainComps = competitors.filter((c: any) =>
        c.clientCode === params.clientCode &&
        c.competitionType === 'Main Competitor' &&
        c.isActive
    );
    console.log(`Found ${mainComps.length} Main Competitors`);

    // Helper to get ETV (From route.ts)
    const getETV = (domain: string) => {
        const cleanDomain = domain.toLowerCase().trim().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
        const record = domainCredibility.find((r: any) => r.domain.toLowerCase() === cleanDomain);

        if (record) {
            // Log only first match for debugging
            // console.log(`Matched: ${cleanDomain}`);
        }

        // Robust access to ETV
        const etv = (record as any)?.whoisJson?.metrics?.organic?.etv || (record as any)?.organicCost || 0;
        return etv;
    };

    // Aggregation Map
    const brandMap = new Map<string, any>();

    const processDomain = (domain: string, brandName: string, logo: string | null, isSelf: boolean) => {
        const etv = getETV(domain);
        const key = brandName.trim();

        if (!brandMap.has(key)) {
            brandMap.set(key, {
                etv: 0,
                domains: [],
                logo: logo,
                isSelf,
                primaryDomain: domain
            });
        }

        const entry = brandMap.get(key)!;
        entry.etv += etv;
        if (!entry.domains.includes(domain)) entry.domains.push(domain);
        if (!entry.logo && logo) entry.logo = logo;
        if (isSelf) entry.isSelf = true;
    };

    // Process Client
    for (const d of client.domains) {
        processDomain(d, client.name, client.brandPhotos?.[0] || null, true);
    }

    // Process Competitors
    for (const comp of mainComps) {
        const brand = comp.officialBrandName || comp.brandNames?.[0] || comp.name;
        processDomain(comp.domain, brand, comp.logos?.[0] || null, false);
    }

    // Sort brands by ETV (desc)
    const sortedBrands = Array.from(brandMap.entries())
        .map(([name, data]) => ({ brandName: name, ...data }))
        .sort((a, b) => b.etv - a.etv);

    console.log('Sorted Brands:', sortedBrands.map(b => `${b.brandName}: ${b.etv}`).join(', '));
    // ----------------------------------------------------
}

main().catch(console.error);
