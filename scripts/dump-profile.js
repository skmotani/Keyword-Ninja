/**
 * Dump full AI profile structure to understand data format
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Checking AI profile for client O2...\n');
    
    // Get O2's AI profile (note: capital O, not zero)
    const profile = await prisma.clientAIProfile.findFirst({
        where: { clientCode: 'O2' }
    });
    
    if (!profile) {
        console.log('No profile found for O2');
        return;
    }
    
    console.log('Profile found!');
    console.log('clientCode:', profile.clientCode);
    console.log('domain:', profile.domain);
    console.log('createdAt:', profile.createdAt);
    
    // Check the profile field
    console.log('\n--- Profile field type:', typeof profile.profile);
    console.log('--- Profile field keys:', profile.profile ? Object.keys(profile.profile) : 'null');
    
    // Check for term dictionary in various possible locations
    const p = profile.profile;
    
    console.log('\n--- Checking for term dictionary...');
    console.log('p.ai_kw_builder_term_dictionary:', p?.ai_kw_builder_term_dictionary ? 'EXISTS' : 'NOT FOUND');
    console.log('p.termDictionary:', p?.termDictionary ? 'EXISTS' : 'NOT FOUND');
    console.log('p.terms:', p?.terms ? 'EXISTS' : 'NOT FOUND');
    console.log('p.buckets:', p?.buckets ? 'EXISTS' : 'NOT FOUND');
    
    // Dump the full structure (first 2000 chars)
    const fullJson = JSON.stringify(profile.profile, null, 2);
    console.log('\n--- Full profile structure (first 3000 chars):');
    console.log(fullJson.substring(0, 3000));
    
    if (fullJson.length > 3000) {
        console.log('\n... [truncated, total length:', fullJson.length, ']');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
