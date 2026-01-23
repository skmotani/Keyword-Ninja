/**
 * List all AI profiles in the database
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('='.repeat(60));
    console.log('All AI Profiles in Database');
    console.log('='.repeat(60));
    
    const profiles = await prisma.clientAIProfile.findMany();
    
    console.log(`\nTotal profiles: ${profiles.length}\n`);
    
    for (const p of profiles) {
        const termDict = p.profile?.ai_kw_builder_term_dictionary;
        const termCount = termDict?.terms ? Object.keys(termDict.terms).length : 0;
        console.log(`Client: ${p.clientCode} | Domain: ${p.domain} | Terms: ${termCount}`);
        
        if (termCount > 0) {
            // Count buckets
            const buckets = {};
            for (const [, term] of Object.entries(termDict.terms)) {
                const b = term.bucket || 'none';
                buckets[b] = (buckets[b] || 0) + 1;
            }
            console.log(`   Buckets: ${JSON.stringify(buckets)}`);
        }
    }
    
    // Also list all clients
    console.log('\n' + '='.repeat(60));
    console.log('All Clients in Database');
    console.log('='.repeat(60));
    
    const clients = await prisma.client.findMany();
    console.log(`\nTotal clients: ${clients.length}\n`);
    
    for (const c of clients) {
        console.log(`Code: ${c.code} | Name: ${c.name} | Domain: ${c.mainDomain}`);
    }
    
    console.log('\n' + '='.repeat(60));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
