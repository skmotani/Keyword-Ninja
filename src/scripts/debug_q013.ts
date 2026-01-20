
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

async function main() {
    console.log("Fetching Q013 Data for Meera (01)...");

    // Read Data Helpers
    const read = (f: string) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf-8'));

    // safe read
    const clients = read('clients.json');
    const competitors = read('competitors.json');

    let domainCredibility = [];
    try {
        domainCredibility = read('domain_credibility.json');
    } catch {
        // try root
        domainCredibility = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'domain_credibility.json'), 'utf-8'));
    }

    // Get Meera
    const meera = clients.find((c: any) => c.code === '01');

    const meeraDomains = meera.domains.map((d: string) => d.toLowerCase().trim().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, ''));

    // Get Main Competitors
    const mainComps = competitors.filter((c: any) => c.clientCode === '01' && c.competitionType === 'Main Competitor' && c.isActive);

    // Aggregate ETV by Brand
    const brandMap = new Map<string, { etv: number, domains: string[], isSelf: boolean }>();

    // Helper to process domain
    const processDomain = (rawDomain: string, brandName: string, isSelf: boolean) => {
        const domain = rawDomain.toLowerCase().trim().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
        const record = domainCredibility.find((r: any) => r.domain?.toLowerCase() === domain);
        // Correct path for ETV based on file inspection
        const etv = record?.whoisJson?.metrics?.organic?.etv || 0;

        const key = brandName.trim();

        if (!brandMap.has(key)) {
            brandMap.set(key, { etv: 0, domains: [], isSelf });
        }
        const entry = brandMap.get(key)!;
        entry.etv += etv;
        if (!entry.domains.includes(domain)) entry.domains.push(domain);
        if (isSelf) entry.isSelf = true;
    }

    // Process Meera
    for (const d of meera.domains) {
        processDomain(d, meera.name, true);
    }

    // Process Competitors
    for (const comp of mainComps) {
        const brand = comp.officialBrandName || comp.brandNames?.[0] || comp.name;
        processDomain(comp.domain, brand, false);
    }

    // Sort
    const sorted = Array.from(brandMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.etv - a.etv);

    // Output to JSON file
    fs.writeFileSync(path.join(process.cwd(), 'q013_data.json'), JSON.stringify(sorted, null, 2));
    console.log('Data written to q013_data.json');
}

main().catch(console.error);
