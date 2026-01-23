/**
 * Debug script to check client02's AI profile term dictionary
 * This is what MANUAL_001 and MANUAL_002 use to determine Include|Buy and Include|Learn keywords
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('='.repeat(60));
    console.log('Client02 AI Profile Term Dictionary Debug');
    console.log('='.repeat(60));
    
    // Get client02's AI profile
    const profile = await prisma.clientAIProfile.findFirst({
        where: { clientCode: '02' }
    });
    
    if (!profile) {
        console.log('❌ No AI profile found for client02');
        return;
    }
    
    console.log('\n📋 AI Profile found for client02');
    console.log('   Domain:', profile.domain);
    console.log('   Created:', profile.createdAt);
    
    // Check the term dictionary (this is what MANUAL_001/002 use)
    const profileData = profile.profile;
    const termDictionary = profileData?.ai_kw_builder_term_dictionary;
    
    if (!termDictionary || !termDictionary.terms) {
        console.log('\n❌ No ai_kw_builder_term_dictionary found in profile!');
        console.log('   This is why MANUAL_001 and MANUAL_002 show 0 keywords.');
        console.log('   The term dictionary needs to be created via the AI Keyword Builder.');
        return;
    }
    
    const terms = termDictionary.terms;
    console.log('\n📊 Term Dictionary found with', Object.keys(terms).length, 'terms');
    
    // Count by bucket
    const bucketCounts = {};
    for (const [key, term] of Object.entries(terms)) {
        const bucket = term.bucket || 'unassigned';
        bucketCounts[bucket] = (bucketCounts[bucket] || 0) + 1;
    }
    
    console.log('\n📦 Terms by bucket:');
    for (const [bucket, count] of Object.entries(bucketCounts)) {
        const label = bucket === 'include' ? 'Include | Buy' :
                      bucket === 'review' ? 'Include | Learn' :
                      bucket === 'brand' ? 'Brand | Nav' :
                      bucket === 'exclude' ? 'Exclude | Noise' : bucket;
        console.log(`   ${label}: ${count}`);
    }
    
    // Show sample Include|Buy terms
    const includeBuyTerms = Object.entries(terms)
        .filter(([, term]) => term.bucket === 'include')
        .slice(0, 5);
    
    if (includeBuyTerms.length > 0) {
        console.log('\n✅ Sample Include|Buy terms:');
        includeBuyTerms.forEach(([key, term]) => {
            console.log(`   - ${term.name || term.term}`);
        });
    }
    
    // Now check domain keywords for client02
    console.log('\n' + '='.repeat(60));
    console.log('Domain Keywords Check');
    console.log('='.repeat(60));
    
    const domainKeywords = await prisma.domainKeyword.findMany({
        where: { clientCode: '02' }
    });
    
    console.log(`\nTotal domain keywords for client02: ${domainKeywords.length}`);
    
    // Check tag2 distribution
    const tag2Counts = {};
    for (const dk of domainKeywords) {
        const tag = dk.tag2 || 'untagged';
        tag2Counts[tag] = (tag2Counts[tag] || 0) + 1;
    }
    
    console.log('\n📦 Keywords by tag2:');
    for (const [tag, count] of Object.entries(tag2Counts)) {
        console.log(`   ${tag}: ${count}`);
    }
    
    // Location codes
    const locationCounts = {};
    for (const dk of domainKeywords) {
        const loc = dk.locationCode || 'unknown';
        locationCounts[loc] = (locationCounts[loc] || 0) + 1;
    }
    
    console.log('\n🌍 Keywords by location:');
    for (const [loc, count] of Object.entries(locationCounts)) {
        console.log(`   ${loc}: ${count}`);
    }
    
    // Check if the term dictionary terms match any keywords
    if (includeBuyTerms.length > 0) {
        console.log('\n🔍 Checking if Include|Buy terms exist in domain_keywords...');
        let matchCount = 0;
        for (const [, term] of includeBuyTerms) {
            const termName = (term.name || term.term).toLowerCase();
            const found = domainKeywords.some(dk => dk.keyword.toLowerCase() === termName);
            if (found) matchCount++;
            console.log(`   "${term.name || term.term}": ${found ? '✅ Found' : '❌ Not found'}`);
        }
        console.log(`   Match rate: ${matchCount}/${includeBuyTerms.length}`);
    }
    
    console.log('\n' + '='.repeat(60));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
