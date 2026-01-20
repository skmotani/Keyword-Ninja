import fs from 'fs';
import path from 'path';
import { getCredibilityByClient } from '../lib/storage/domainCredibilityStore';

async function runPrototype() {
    const clientCode = '01'; // Meera
    console.log(`[Q001 Prototype] Starting for client: ${clientCode}`);

    // 1. Read Client Master
    const clientsPath = path.join(process.cwd(), 'data', 'clients.json');
    const clientsRaw = fs.readFileSync(clientsPath, 'utf-8');
    const clients = JSON.parse(clientsRaw);

    const client = clients.find((c: any) => c.code === clientCode);
    if (!client) {
        console.error('Client not found!');
        return;
    }

    console.log(`[Q001 Prototype] Found Client: ${client.name}`);

    // 2. Read AI Client Profile
    const aiProfilesPath = path.join(process.cwd(), 'data', 'client_ai_profiles.json');
    let aiProfile = null;
    if (fs.existsSync(aiProfilesPath)) {
        const aiProfilesRaw = fs.readFileSync(aiProfilesPath, 'utf-8');
        const aiProfiles = JSON.parse(aiProfilesRaw);
        aiProfile = aiProfiles.find((p: any) => p.clientCode === clientCode);
    }

    if (aiProfile) {
        console.log(`[Q001 Prototype] Found AI Profile for ${client.name}`);
    } else {
        console.warn(`[Q001 Prototype] AI Profile NOT found for ${client.name}`);
    }

    // 3. Get Domain Credibility
    const credibilityRecords = await getCredibilityByClient(clientCode);
    console.log(`[Q001 Prototype] Credibility Records Found: ${credibilityRecords.length}`);

    // 4. Assemble Data (Deduplicated)
    const domainsData: any[] = [];
    const seenDomains = new Set<string>();

    client.domains.forEach((domain: string) => {
        // Clean domain for matching
        const cleanDomain = domain.toLowerCase().trim().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');

        if (seenDomains.has(cleanDomain)) return;
        seenDomains.add(cleanDomain);

        const record = credibilityRecords.find(r => r.domain.toLowerCase() === cleanDomain);

        // Extract metrics safely
        const organicMetrics = (record as any)?.whoisJson?.metrics?.organic || {};
        const organicTraffic = organicMetrics.count || (record as any)?.organicTraffic || 0;
        // Approximation for total ranked keywords if not explicit
        const organicKeywords = organicMetrics.pos_1_100 || (
            (organicMetrics.pos_1 || 0) +
            (organicMetrics.pos_2_3 || 0) +
            (organicMetrics.pos_4_10 || 0) +
            (organicMetrics.pos_11_20 || 0) +
            (organicMetrics.pos_21_30 || 0) +
            (organicMetrics.pos_31_40 || 0) +
            (organicMetrics.pos_41_50 || 0) +
            (organicMetrics.pos_51_60 || 0) +
            (organicMetrics.pos_61_70 || 0) +
            (organicMetrics.pos_71_80 || 0) +
            (organicMetrics.pos_81_90 || 0) +
            (organicMetrics.pos_91_100 || 0)
        ) || (record as any)?.organicKeywords || 0;

        domainsData.push({
            domain: domain,
            cleanDomain: cleanDomain,
            organicTraffic: organicTraffic,
            organicKeywords: organicKeywords,
            source: record ? 'domain_credibility.json' : 'Missing'
        });
    });

    // Use AI Profile data if available, fall back to N/A
    const result = {
        meta: {
            title: "Q001: About Client Business",
            client: client.name,
            generatedAt: new Date().toISOString()
        },
        businessOverview: {
            summary: aiProfile?.shortSummary || "N/A",
            businessModel: aiProfile?.businessModel || "N/A",
            industry: aiProfile?.industryType || "N/A"
        },
        productMarket: {
            products: aiProfile?.productLines || [],
            segments: aiProfile?.targetCustomerSegments || [],
            geographies: aiProfile?.targetGeographies || []
        },
        assets: {
            brandPhotos: client.brandPhotos || []
        },
        domains: domainsData
    };

    // console.log(JSON.stringify(result, null, 2));

    console.log('\n=== Q001: CLIENT BUSINESS OVERVIEW ===\n');
    console.log(`Client: ${result.meta.client}`); // Just name, no code
    console.log(`Generated: ${result.meta.generatedAt}\n`);

    console.log('--- 1. BUSINESS OVERVIEW ---');
    console.table({
        'Summary': result.businessOverview.summary.substring(0, 100) + '...',
        'Business Model': result.businessOverview.businessModel,
        'Industry': result.businessOverview.industry
    });

    console.log('\n--- 2. PRODUCT & MARKET ---');
    console.log('Products:', result.productMarket.products.join(', '));
    console.log('Target Customer Segments:', result.productMarket.segments.join(', '));
    console.log('Geographies:', result.productMarket.geographies.join(', '));

    console.log('\n--- 3. ASSETS ---');
    console.log(`Brand Photos: ${result.assets.brandPhotos.length} photos available`);
    result.assets.brandPhotos.forEach((p: string) => console.log(` - ${p}`));

    console.log('\n--- 4. DOMAINS METRICS ---');
    // Removed Source column
    console.table(result.domains.map(d => ({
        Domain: d.domain,
        'Organic Traffic': d.organicTraffic,
        'Organic Keywords': d.organicKeywords
    })));
}

runPrototype().catch(console.error);
