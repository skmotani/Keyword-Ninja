const fs = require('fs');

// Read data
const dks = JSON.parse(fs.readFileSync('data/domain_keywords.json'));
const clients = JSON.parse(fs.readFileSync('data/clients.json'));
const aiProfiles = JSON.parse(fs.readFileSync('data/client_ai_profiles.json'));

const clientCode = '01';
const client = clients.find(c => c.code === clientCode);

// Self domains
const normalizeDomain = d => (d || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
const selfDomains = new Set([client.mainDomain, ...(client.domains || [])].filter(Boolean).map(normalizeDomain));
console.log('Self domains:', Array.from(selfDomains));

// Get AI profile term dictionary
const profile = aiProfiles.find(p => p.clientCode === clientCode);
const terms = profile?.ai_kw_builder_term_dictionary?.terms || {};

// Build term -> bucket map
const termBucketMap = new Map();
for (const [, term] of Object.entries(terms)) {
    const termName = (term.name || term.term || '').toLowerCase();
    const bucket = term.bucket || 'unassigned';
    if (termName) termBucketMap.set(termName, bucket);
}

// Normalize bucket
const normalizeBucket = (bucket) => {
    const b = bucket.toLowerCase().trim();
    if (b === 'include' || b === 'include | buy' || b === 'include|buy') return 'Include | Buy';
    if (b === 'review' || b === 'include | learn' || b === 'include|learn') return 'Include | Learn';
    if (b === 'brand' || b === 'brand | nav' || b === 'brand|nav') return 'Brand | Nav';
    return 'Unassigned';
};

// Get bucket for keyword
const getBucket = (keyword) => {
    const kw = keyword.toLowerCase();
    if (termBucketMap.has(kw)) return normalizeBucket(termBucketMap.get(kw));
    for (const [term, bucket] of termBucketMap.entries()) {
        if (kw.includes(term)) return normalizeBucket(bucket);
    }
    return 'Unassigned';
};

// Get client keywords
const clientKws = dks.filter(d => d.clientCode === clientCode);

// Get unique keywords with their volumes
const keywordVolumes = new Map();
const keywordsWithRanking = new Set();

for (const dk of clientKws) {
    const kw = dk.keyword;
    const vol = dk.searchVolume || 0;

    // Track volume (take max)
    if (!keywordVolumes.has(kw) || keywordVolumes.get(kw) < vol) {
        keywordVolumes.set(kw, vol);
    }

    // Track if ANY domain (self or competitor) is ranking
    if (dk.position && dk.position > 0 && dk.position <= 50) {
        keywordsWithRanking.add(kw);
    }
}

console.log('\nTotal unique keywords:', keywordVolumes.size);
console.log('Keywords with ANY ranking (1-50):', keywordsWithRanking.size);

// Calculate P50 (median)
const volumes = Array.from(keywordVolumes.values()).sort((a, b) => a - b);
const p50Index = Math.floor(volumes.length * 0.50);
const p50 = volumes[p50Index];
console.log('P50 (median) volume threshold:', p50);

// Find "orphan" keywords - high volume, no one ranking
const INCLUDED_BUCKETS = ['Include | Buy', 'Include | Learn'];
const orphanKeywords = [];

for (const [keyword, volume] of keywordVolumes.entries()) {
    if (volume < p50) continue; // Skip low volume
    if (keywordsWithRanking.has(keyword)) continue; // Skip if anyone is ranking

    const bucket = getBucket(keyword);
    if (!INCLUDED_BUCKETS.includes(bucket)) continue;

    orphanKeywords.push({ keyword, volume, bucket });
}

// Sort by volume desc
orphanKeywords.sort((a, b) => b.volume - a.volume);

console.log('\n======================================');
console.log('ORPHAN KEYWORDS (High Vol, No Ranking)');
console.log('======================================');
console.log('Count:', orphanKeywords.length);
console.log('\nTop 30:');
orphanKeywords.slice(0, 30).forEach((kw, i) => {
    console.log(`${i + 1}. [${kw.bucket}] ${kw.keyword} - Vol: ${kw.volume.toLocaleString()}`);
});

if (orphanKeywords.length > 30) {
    console.log(`\n... and ${orphanKeywords.length - 30} more`);
}
