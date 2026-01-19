
const fs = require('fs');
const path = require('path');

const DATA_DIR = 'd:\\Shakti Cursor\\Keyword-Ninja\\data';

async function preview() {
    try {
        const clientCode = '01'; // Meera

        // 1. Read Data
        const profiles = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'client_ai_profiles.json'), 'utf8'));
        const domainKeywords = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'domain_keywords.json'), 'utf8'));
        const clients = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'clients.json'), 'utf8'));

        // 2. Get 'Include | Learn' Terms (Bucket = 'review')
        const profile = profiles.find(p => p.clientCode === clientCode);
        const termsObj = profile.ai_kw_builder_term_dictionary.terms;
        const terms = Array.isArray(termsObj) ? termsObj : Object.values(termsObj);

        const learnTerms = terms
            .filter(t => t.bucket === 'review')
            .map(t => (t.name || t.term).toLowerCase());

        console.log(`Found ${learnTerms.length} 'Include | Learn' (review) terms.`);

        // 3. Get Self Domains
        const clientData = clients.find(c => c.code === clientCode);
        const normalizeDomain = (d) => d.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase().replace(/\/$/, '');
        const selfDomains = new Set((clientData.domains || []).map(normalizeDomain));

        // 4. Filter Keywords
        const clientDK = domainKeywords.filter(dk => dk.clientCode === clientCode);

        // 5. Aggregate Volume (IN + GL)
        const volumeMap = new Map();
        clientDK.forEach(dk => {
            const kw = dk.keyword.toLowerCase();
            const vol = dk.searchVolume || 0;
            if (!volumeMap.has(kw)) volumeMap.set(kw, { IN: 0, GL: 0 });

            if (dk.locationCode === 'IN' || dk.locationCode === '2356') {
                if (vol > volumeMap.get(kw).IN) volumeMap.get(kw).IN = vol;
            } else if (dk.locationCode === 'GL' || dk.locationCode === '2840') {
                if (vol > volumeMap.get(kw).GL) volumeMap.get(kw).GL = vol;
            }
        });

        // 6. Find Best Position (Self Domains)
        const positionMap = new Map();
        clientDK.forEach(dk => {
            const normD = normalizeDomain(dk.domain);
            if (!selfDomains.has(normD)) return;

            const kw = dk.keyword.toLowerCase();
            const pos = dk.position;
            if (pos === null) return;

            if (!positionMap.has(kw)) positionMap.set(kw, { IN: null, GL: null });

            if (dk.locationCode === 'IN' || dk.locationCode === '2356') {
                const current = positionMap.get(kw).IN;
                if (current === null || pos < current) positionMap.get(kw).IN = pos;
            } else if (dk.locationCode === 'GL' || dk.locationCode === '2840') {
                const current = positionMap.get(kw).GL;
                if (current === null || pos < current) positionMap.get(kw).GL = pos;
            }
        });

        // 7. Match Terms to Metrics
        const results = learnTerms.map(term => {
            const vols = volumeMap.get(term) || { IN: 0, GL: 0 };
            const pos = positionMap.get(term) || { IN: null, GL: null };
            return {
                keyword: term,
                volumeIN: vols.IN,
                volumeGL: vols.GL,
                totalVolume: vols.IN + vols.GL,
                posIN: pos.IN,
                posGL: pos.GL
            };
        });

        // 8. Sort & Limit
        results.sort((a, b) => b.totalVolume - a.totalVolume);
        const top20 = results.slice(0, 20);

        // 9. Output Table

        const output = [];
        output.push(`Top 20 "Include | Learn" Keywords Preview:`);
        output.push('------------------------------------------------------------------------------------------------');
        output.push('| Rank | Keyword                          | Total Vol | Vol (IN) | Vol (GL) | Pos (IN) | Pos (GL) |');
        output.push('------------------------------------------------------------------------------------------------');
        top20.forEach((r, i) => {
            const k = r.keyword.padEnd(32).slice(0, 32);
            const tv = String(r.totalVolume).padStart(9);
            const vin = String(r.volumeIN).padStart(8);
            const vgl = String(r.volumeGL).padStart(8);
            const pin = (r.posIN === null ? '-' : r.posIN).toString().padStart(8);
            const pgl = (r.posGL === null ? '-' : r.posGL).toString().padStart(8);
            output.push(`| ${(i + 1).toString().padStart(4)} | ${k} | ${tv} | ${vin} | ${vgl} | ${pin} | ${pgl} |`);
        });
        output.push('------------------------------------------------------------------------------------------------');

        fs.writeFileSync(path.join(DATA_DIR, 'preview_output.txt'), output.join('\n'));
        console.log('Output written to preview_output.txt');

    } catch (e) {
        console.error(e);
    }
}

preview();
