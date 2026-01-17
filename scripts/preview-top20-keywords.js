// Script to preview Top 20 Keywords from Include | Buy and Include | Learn buckets
// With Client Position data

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const CLIENT_CODE = '01'; // Meera Industries

async function main() {
    console.log('Loading data files...\n');

    // Load client AI profiles
    const aiProfilesPath = path.join(DATA_DIR, 'client_ai_profiles.json');
    const aiProfiles = JSON.parse(fs.readFileSync(aiProfilesPath, 'utf8'));

    // Find the client profile
    const clientProfile = aiProfiles.find(p => p.clientCode === CLIENT_CODE);
    if (!clientProfile) {
        console.error(`Client profile not found for code: ${CLIENT_CODE}`);
        return;
    }

    // Get term dictionary with bucket assignments
    const termDictionary = clientProfile.ai_kw_builder_term_dictionary;
    if (!termDictionary || !termDictionary.terms) {
        console.error('No term dictionary found in client profile');
        return;
    }

    console.log(`Total terms in dictionary: ${Object.keys(termDictionary.terms).length}`);

    // Load clients.json to get client domains (Self)
    const clientsPath = path.join(DATA_DIR, 'clients.json');
    const clients = JSON.parse(fs.readFileSync(clientsPath, 'utf8'));
    const clientData = clients.find(c => c.code === CLIENT_CODE);

    // Normalize domains for matching (remove protocol, www., lowercase)
    const normalizeDomain = (d) => {
        if (!d) return '';
        return d.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase().replace(/\/$/, '');
    };

    const selfDomains = new Set((clientData?.domains || []).map(normalizeDomain));
    console.log(`Client Self domains: ${[...selfDomains].join(', ')}`);

    // Load domain keywords for volume and position data
    const domainKeywordsPath = path.join(DATA_DIR, 'domain_keywords.json');
    const domainKeywords = JSON.parse(fs.readFileSync(domainKeywordsPath, 'utf8'));

    // Filter domain keywords for this client
    const clientDomainKeywords = domainKeywords.filter(dk => dk.clientCode === CLIENT_CODE);
    console.log(`Client domain keywords: ${clientDomainKeywords.length}`);

    // Filter for ONLY Self domains (client's own domains)
    const selfDomainKeywords = clientDomainKeywords.filter(dk => {
        const normalizedDomain = normalizeDomain(dk.domain);
        return selfDomains.has(normalizedDomain);
    });
    console.log(`Self domain keywords (client domains only): ${selfDomainKeywords.length}`);

    // Create a map of keyword -> combined volume (IN + GL) from ALL domain keywords (for volume)
    // But positions come ONLY from Self domains
    const volumeMap = new Map();
    for (const dk of clientDomainKeywords) {
        const kw = dk.keyword.toLowerCase();
        const existing = volumeMap.get(kw);
        if (!existing) {
            volumeMap.set(kw, {
                keyword: dk.keyword,
                volumeIN: dk.locationCode === 'IN' ? (dk.searchVolume || 0) : 0,
                volumeGL: dk.locationCode === 'GL' ? (dk.searchVolume || 0) : 0,
            });
        } else {
            if (dk.locationCode === 'IN' && (dk.searchVolume || 0) > existing.volumeIN) {
                existing.volumeIN = dk.searchVolume || 0;
            }
            if (dk.locationCode === 'GL' && (dk.searchVolume || 0) > existing.volumeGL) {
                existing.volumeGL = dk.searchVolume || 0;
            }
        }
    }

    // Create position map from SELF domains only
    const selfPositionMap = new Map();
    for (const dk of selfDomainKeywords) {
        const kw = dk.keyword.toLowerCase();
        const existing = selfPositionMap.get(kw);
        if (!existing) {
            selfPositionMap.set(kw, {
                positionIN: dk.locationCode === 'IN' ? dk.position : null,
                positionGL: dk.locationCode === 'GL' ? dk.position : null,
                domainIN: dk.locationCode === 'IN' ? dk.domain : null,
                domainGL: dk.locationCode === 'GL' ? dk.domain : null,
            });
        } else {
            // Take best (lowest) position for each location
            if (dk.locationCode === 'IN' && (existing.positionIN === null || dk.position < existing.positionIN)) {
                existing.positionIN = dk.position;
                existing.domainIN = dk.domain;
            }
            if (dk.locationCode === 'GL' && (existing.positionGL === null || dk.position < existing.positionGL)) {
                existing.positionGL = dk.position;
                existing.domainGL = dk.domain;
            }
        }
    }

    // Filter terms by bucket (include = Include | Buy only)
    const terms = termDictionary.terms;
    const includeBuyTerms = [];

    for (const [key, term] of Object.entries(terms)) {
        if (term.bucket === 'include') {
            includeBuyTerms.push(term);
        }
    }

    console.log(`\n=== BUCKET COUNTS ===`);
    console.log(`Include | Buy: ${includeBuyTerms.length}`);

    // Use only Include | Buy bucket
    const allRelevantTerms = [...includeBuyTerms];

    // Enrich terms with keyword data (volume from all domains, position from Self domains only)
    const enrichedTerms = [];
    for (const term of allRelevantTerms) {
        const termName = term.name || term.term;
        if (!termName) continue;

        const volData = volumeMap.get(termName.toLowerCase());
        const posData = selfPositionMap.get(termName.toLowerCase());
        const totalVolume = (volData?.volumeIN || 0) + (volData?.volumeGL || 0);

        enrichedTerms.push({
            term: termName,
            bucket: 'Include | Buy',
            totalVolume: totalVolume,
            volumeIN: volData?.volumeIN || 0,
            volumeGL: volData?.volumeGL || 0,
            posIN: posData?.positionIN || '-',
            posGL: posData?.positionGL || '-'
        });
    }

    // Sort by COMBINED volume DESC and take top 20
    enrichedTerms.sort((a, b) => (b.totalVolume || 0) - (a.totalVolume || 0));
    const top20 = enrichedTerms.slice(0, 20);

    console.log('\n=== TOP 20 KEYWORDS (Combined IN + GL Volume) ===');
    console.log('Bucket: Include | Buy only\n');
    console.log('─'.repeat(120));
    console.log(
        'Rank'.padEnd(5) +
        'Keyword'.padEnd(35) +
        'In+Gl Vol'.padEnd(12) +
        'Vol IN'.padEnd(10) +
        'Vol GL'.padEnd(10) +
        'Self Pos IN'.padEnd(14) +
        'Self Pos GL'
    );
    console.log('─'.repeat(110));

    top20.forEach((item, idx) => {
        console.log(
            String(idx + 1).padEnd(5) +
            (item.term || '').substring(0, 33).padEnd(35) +
            String(item.totalVolume).padEnd(12) +
            String(item.volumeIN).padEnd(10) +
            String(item.volumeGL).padEnd(10) +
            String(item.posIN).padEnd(14) +
            String(item.posGL)
        );
    });

    console.log('─'.repeat(110));

    // Summary
    const includeBuyCount = top20.filter(t => t.bucket === 'Include | Buy').length;
    const includeLearnCount = top20.filter(t => t.bucket === 'Include | Learn').length;
    console.log(`\nSummary: ${includeBuyCount} Include|Buy, ${includeLearnCount} Include|Learn in Top 20`);

    // Write results to file for easy viewing
    const outputPath = path.join(DATA_DIR, 'preview_top20_include_buy.json');
    fs.writeFileSync(outputPath, JSON.stringify(top20, null, 2));
    console.log(`\nResults written to: ${outputPath}`);
}

main().catch(console.error);
