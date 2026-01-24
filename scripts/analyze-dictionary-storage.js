/**
 * Dictionary/Tagging Storage Analysis Script
 * 
 * This script identifies all different keyword classification mechanisms and finds orphaned data.
 * 
 * Storage Mechanisms Found:
 * 1. keyword_tags.json (legacy) - Old tagging system
 * 2. DomainKeyword.tag2 column - Product Relevance Filter results
 * 3. TermDictionary + DictionaryTerm tables - AI Keyword Builder buckets
 * 
 * The MANUAL_001/002 queries use mechanism #3 (TermDictionary buckets)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeStorage() {
    console.log('='.repeat(70));
    console.log('DICTIONARY & TAGGING STORAGE ANALYSIS');
    console.log('='.repeat(70));
    
    // 1. Check TermDictionary (used by MANUAL_001/002)
    console.log('\n## 1. TermDictionary Storage (Prisma - AI Keyword Builder)');
    console.log('-'.repeat(70));
    
    const dictionaries = await prisma.termDictionary.findMany({
        include: { 
            terms: true,
            profile: { select: { clientCode: true } }
        }
    });
    
    console.log(`Total dictionaries: ${dictionaries.length}`);
    
    for (const dict of dictionaries) {
        const clientCode = dict.profile?.clientCode || 'Unknown';
        console.log(`\n  Client: ${clientCode}`);
        console.log(`  Dictionary ID: ${dict.id}`);
        console.log(`  Version: ${dict.version}`);
        console.log(`  Total terms: ${dict.terms.length}`);
        
        // Count by bucket
        const bucketCounts = {};
        for (const term of dict.terms) {
            const bucket = term.bucket || 'unassigned';
            bucketCounts[bucket] = (bucketCounts[bucket] || 0) + 1;
        }
        
        console.log(`  Buckets:`);
        for (const [bucket, count] of Object.entries(bucketCounts).sort()) {
            const label = bucket === 'include' ? 'Include | Buy' :
                          bucket === 'review' ? 'Include | Learn' :
                          bucket === 'brand' ? 'Brand | Nav' :
                          bucket === 'exclude' ? 'Exclude | Noise' : bucket;
            console.log(`    - ${label}: ${count}`);
        }
    }
    
    // 2. Check DomainKeyword.tag2 (Product Relevance Filter)
    console.log('\n## 2. DomainKeyword.tag2 Storage (Product Relevance Filter)');
    console.log('-'.repeat(70));
    
    const tag2Counts = await prisma.$queryRaw`
        SELECT "clientCode", tag2, COUNT(*) as count 
        FROM "DomainKeyword" 
        WHERE tag2 IS NOT NULL AND tag2 != ''
        GROUP BY "clientCode", tag2
        ORDER BY "clientCode", tag2
    `;
    
    if (tag2Counts.length === 0) {
        console.log('No tag2 values found in DomainKeyword table.');
    } else {
        console.log(`Found ${tag2Counts.length} client-tag2 combinations:`);
        let currentClient = null;
        for (const row of tag2Counts) {
            if (row.clientCode !== currentClient) {
                currentClient = row.clientCode;
                console.log(`\n  Client: ${currentClient}`);
            }
            console.log(`    - ${row.tag2}: ${row.count}`);
        }
    }
    
    // 3. Check KeywordTag table (legacy tags)
    console.log('\n## 3. KeywordTag Table (Legacy System)');
    console.log('-'.repeat(70));
    
    try {
        const keywordTagCount = await prisma.keywordTag.count();
        console.log(`Total KeywordTag records: ${keywordTagCount}`);
        
        if (keywordTagCount > 0) {
            const tagDistribution = await prisma.keywordTag.groupBy({
                by: ['clientCode'],
                _count: true
            });
            
            console.log('\nRecords by client:');
            for (const row of tagDistribution) {
                console.log(`  - Client ${row.clientCode}: ${row._count} tags`);
            }
        }
    } catch (e) {
        console.log('KeywordTag table might not exist or has error:', e.message);
    }
    
    // 4. Find potential conflicts/orphans
    console.log('\n## 4. POTENTIAL CONFLICTS/ORPHANS');
    console.log('-'.repeat(70));
    
    // Get all client codes from different sources
    const profileClients = await prisma.clientAIProfile.findMany({ select: { clientCode: true } });
    const dictionaryClients = new Set(dictionaries.map(d => d.profile?.clientCode));
    const domainKeywordClients = await prisma.$queryRaw`
        SELECT DISTINCT "clientCode" FROM "DomainKeyword"
    `;
    
    console.log('\nClients with AI Profiles:', profileClients.map(p => p.clientCode).join(', '));
    console.log('Clients with Term Dictionaries:', [...dictionaryClients].join(', '));
    console.log('Clients with Domain Keywords:', domainKeywordClients.map(r => r.clientCode).join(', '));
    
    // Find clients with profiles but no dictionaries
    const profilesWithoutDicts = profileClients.filter(p => !dictionaryClients.has(p.clientCode));
    if (profilesWithoutDicts.length > 0) {
        console.log('\n⚠️ Clients with AI Profile but NO Term Dictionary:');
        for (const p of profilesWithoutDicts) {
            console.log(`   - ${p.clientCode}`);
        }
    }
    
    // Find dictionaries with zero or minimal terms
    const emptyDicts = dictionaries.filter(d => d.terms.length === 0);
    const minimalDicts = dictionaries.filter(d => d.terms.length > 0 && d.terms.length < 10);
    
    if (emptyDicts.length > 0) {
        console.log('\n⚠️ Empty dictionaries (0 terms):');
        for (const d of emptyDicts) {
            console.log(`   - Client ${d.profile?.clientCode}: Dictionary ID ${d.id}`);
        }
    }
    
    if (minimalDicts.length > 0) {
        console.log('\n⚠️ Minimal dictionaries (<10 terms):');
        for (const d of minimalDicts) {
            console.log(`   - Client ${d.profile?.clientCode}: ${d.terms.length} terms`);
        }
    }
    
    // 5. Recommendations
    console.log('\n## 5. RECOMMENDATIONS');
    console.log('-'.repeat(70));
    
    console.log(`
Based on the analysis:

1. AUTHORITATIVE SOURCE for MANUAL_001/002:
   → TermDictionary + DictionaryTerm tables
   → These are saved via AI Keyword Builder "Save Dictionary" button
   → Uses bucket values: 'include', 'review', 'brand', 'exclude'

2. SECONDARY SOURCE (Product Relevance Filter):
   → DomainKeyword.tag2 column
   → Uses values like 'Include | Buy', 'Include | Learn', etc.
   → NOT used by MANUAL_001/002 currently

3. LEGACY (can be removed):
   → keyword_tags.json file
   → KeywordTag table (if exists)
   → These are from the old tagging phase

SUGGESTED CLEANUP:
- keyword_tags.json can be archived/deleted if KeywordTag is migrated
- Consider syncing DomainKeyword.tag2 with TermDictionary for consistency
`);
    
    console.log('='.repeat(70));
}

analyzeStorage()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
