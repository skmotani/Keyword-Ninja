
const fs = require('fs');
const path = require('path');

const filePath = 'd:\\Shakti Cursor\\Keyword-Ninja\\data\\client_ai_profiles.json';

try {
    const data = fs.readFileSync(filePath, 'utf8');
    const profiles = JSON.parse(data);

    profiles.forEach(p => {
        console.log(`Profile: ${p.clientCode}`);
        const dict = p.ai_kw_builder_term_dictionary;
        if (!dict || !dict.terms) {
            console.log('  No term dictionary found.');
            return;
        }

        const counts = {};
        const examples = {};

        // terms is usually an array in the JSON I saw earlier check both
        let terms = dict.terms;
        if (!Array.isArray(terms)) {
            terms = Object.values(terms);
        }

        terms.forEach(t => {
            const bucket = t.bucket || 'undefined';
            counts[bucket] = (counts[bucket] || 0) + 1;
            if (!examples[bucket]) examples[bucket] = [];
            if (examples[bucket].length < 3) examples[bucket].push(t.term);
        });

        console.log('  Bucket Counts:', counts);
        console.log('  Examples:', JSON.stringify(examples, null, 2));
    });

} catch (e) {
    console.error(e);
}
