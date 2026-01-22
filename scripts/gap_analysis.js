const fs = require('fs');

const dks = JSON.parse(fs.readFileSync('data/domain_keywords.json'));
const clients = JSON.parse(fs.readFileSync('data/clients.json'));

const client = clients.find(c => c.code === '01');
const selfDomains = new Set(
    [client.mainDomain, ...(client.domains || [])]
        .filter(Boolean)
        .map(d => d.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, ''))
);

console.log('Self domains:', Array.from(selfDomains));

const clientKws = dks.filter(d => d.clientCode === '01');
const allKeywords = [...new Set(clientKws.map(k => k.keyword))];

// Keywords where self domain ranks
const selfRankingKws = new Set(
    clientKws
        .filter(k => {
            const domain = (k.domain || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
            return selfDomains.has(domain) && k.position > 0;
        })
        .map(k => k.keyword)
);

// Gap keywords = all keywords minus self-ranking keywords
const gapKeywords = allKeywords.filter(k => !selfRankingKws.has(k));

console.log('\n--- GAP ANALYSIS ---');
console.log('Total unique keywords tracked:', allKeywords.length);
console.log('Keywords where SELF ranks:', selfRankingKws.size);
console.log('GAP keywords (Self absent):', gapKeywords.length);
console.log('\nSample GAP keywords:');
gapKeywords.slice(0, 15).forEach(kw => console.log('  -', kw));
