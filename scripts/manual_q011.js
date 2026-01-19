const fs = require('fs');
const path = require('path');

const CLIENT_CODE = '01';
const DATA_DIR = path.join(__dirname, '../data');

function normalizeDomain(domain) {
    if (!domain) return '';
    return domain.toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '');
}

function readJson(filename) {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
}

// Map location codes to names (simplified mapping based on known codes)
const LOCATION_MAP = {
    '2356': 'India',
    '2840': 'Global',
    // Add others if needed or rely on fallback
};

async function execute() {
    console.log('Reading data files...');
    const competitors = readJson('competitors.json');
    const aiProfiles = readJson('client_ai_profiles.json');
    const domainKeywords = readJson('domain_keywords.json');

    console.log('Processing profile...');
    const profile = aiProfiles.find(p => p.clientCode === CLIENT_CODE);
    const termDictionary = profile?.ai_kw_builder_term_dictionary;
    const terms = termDictionary?.terms || [];

    // Build brand terms set
    const brandTerms = new Set(
        terms.filter(t => t.bucket === 'brand').map(t => t.term.toLowerCase().trim())
    );

    // Build exclude terms set
    // Check for 'exclude' or 'exclude | noise' buckets
    const excludeTerms = new Set(
        terms.filter(t => t.bucket && (t.bucket.toLowerCase() === 'exclude' || t.bucket.toLowerCase().includes('noise')))
            .map(t => t.term.toLowerCase().trim())
    );

    console.log(`Found ${brandTerms.size} base brand terms.`);
    console.log(`Found ${excludeTerms.size} exclude terms.`);

    // Get relevant competitors (Self + Main)
    const relevantCompetitors = competitors.filter(
        c => c.clientCode === CLIENT_CODE &&
            (c.competitionType === 'Self' || c.competitionType === 'Main Competitor') &&
            c.isActive
    );

    console.log(`Found ${relevantCompetitors.length} relevant competitors.`);

    // Add competitor brand names
    for (const comp of relevantCompetitors) {
        const compBrandNames = comp.brandNames || [];
        for (const bn of compBrandNames) {
            if (bn && bn.trim()) {
                brandTerms.add(bn.toLowerCase().trim());
            }
        }
    }

    console.log(`Total brand terms: ${brandTerms.size}`);

    // Keyword Matcher
    const brandTermsArray = Array.from(brandTerms);
    const excludeTermsArray = Array.from(excludeTerms);

    const keywordMatchesBrand = (keyword) => {
        const kwLower = keyword.toLowerCase().trim();

        // Check Exclusions First
        for (const term of excludeTermsArray) {
            if (kwLower.includes(term)) return false;
        }

        // Check Brand match
        for (const term of brandTermsArray) {
            if (kwLower.includes(term)) return true;
        }
        return false;
    };

    // Domain Info Map
    const domainInfoMap = new Map();
    for (const comp of relevantCompetitors) {
        const normalizedDomain = normalizeDomain(comp.domain);
        const brandName = comp.brandNames?.[0] || comp.name || comp.domain.replace(/\.(com|in|co\.in|org|net)$/i, '');
        domainInfoMap.set(normalizedDomain, {
            type: comp.competitionType,
            brandName
        });
    }

    const allDomains = new Set(relevantCompetitors.map(c => normalizeDomain(c.domain)));

    // Process Keywords
    const domainBrandData = new Map();

    console.log('Scanning domain keywords...');
    for (const kw of domainKeywords) {
        if (kw.clientCode !== CLIENT_CODE) continue;

        const normalizedDomain = normalizeDomain(kw.domain);
        if (!allDomains.has(normalizedDomain)) continue;
        if (kw.position === null || kw.position <= 0) continue;
        if (!keywordMatchesBrand(kw.keyword)) continue;

        const locationName = LOCATION_MAP[kw.locationCode] || kw.locationCode;
        const volume = kw.searchVolume || 0;

        if (!domainBrandData.has(normalizedDomain)) {
            domainBrandData.set(normalizedDomain, { keywords: [], totalVolume: 0 });
        }

        const domainData = domainBrandData.get(normalizedDomain);
        domainData.keywords.push({
            keyword: kw.keyword,
            location: locationName,
            position: kw.position,
            volume
        });
        domainData.totalVolume += volume;
    }

    // Build Results
    const domainResults = [];
    let totalBrandKeywords = 0;
    let totalBrandVolume = 0;

    for (const [normalizedDomain, data] of domainBrandData.entries()) {
        const info = domainInfoMap.get(normalizedDomain);
        if (!info) continue;

        data.keywords.sort((a, b) => b.volume - a.volume);

        const originalDomain = relevantCompetitors.find(
            c => normalizeDomain(c.domain) === normalizedDomain
        )?.domain || normalizedDomain;

        domainResults.push({
            domain: originalDomain,
            domainType: info.type,
            brandName: info.brandName,
            brandKeywordCount: data.keywords.length,
            totalBrandVolume: data.totalVolume,
            keywords: data.keywords.slice(0, 50)
        });

        totalBrandKeywords += data.keywords.length;
        totalBrandVolume += data.totalVolume;
    }

    domainResults.sort((a, b) => {
        if (a.domainType !== b.domainType) {
            return a.domainType === 'Self' ? -1 : 1;
        }
        return b.totalBrandVolume - a.totalBrandVolume;
    });

    const output = {
        summary: {
            totalDomains: domainResults.length,
            totalBrandKeywords,
            totalBrandVolume
        },
        domains: domainResults
    };

    const outputPath = path.join(__dirname, 'q011_output.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`Result written to ${outputPath}`);
}

execute();
