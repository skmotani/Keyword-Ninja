const fs = require('fs');
const path = require('path');

const profilePath = path.join(__dirname, 'data', 'client_ai_profiles.json');
const raw = fs.readFileSync(profilePath, 'utf8');
const profiles = JSON.parse(raw);

const profile = profiles.find(p => p.clientCode === '01');
if (!profile) {
    console.log('Profile 01 not found');
    process.exit(1);
}

const terms = profile.ai_kw_builder_term_dictionary.terms;
const excluded = terms.filter(t => t.bucket === 'exclude' || (t.bucket && t.bucket.includes('noise')));

console.log('Total Excluded Terms:', excluded.length);
console.log('Excluded Terms List:', excluded.map(t => t.term).join(', '));

const problematic = ['industries', 'ltd', 'limited', 'pvt', 'private', 'meera', 'inc', 'corp', 'co'];
const foundProblematic = excluded.filter(t => problematic.includes(t.term.toLowerCase()));

if (foundProblematic.length > 0) {
    console.log('\n!!! FOUND PROBLEMATIC EXCLUDED TERMS !!!');
    console.log(foundProblematic.map(t => t.term));
} else {
    console.log('\nNo common corporate suffixes found in exclude list.');
}
