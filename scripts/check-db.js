const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();

    const tables = [
        'client',
        'competitor',
        'domainProfile',
        'curatedKeyword',
        'clientPosition',
        'domainKeyword',
        'domainPage',
        'serpResult',
        'dashboardQuery',
        'dashboardQueryGroup',
        'keywordTag',
        'domainCredibility',
        'pageIntentSummary',
        'pageIntentPage'
    ];

    console.log('\n=== PostgreSQL Table Row Counts ===\n');

    for (const table of tables) {
        try {
            const count = await prisma[table].count();
            console.log(`${table}: ${count} rows`);
        } catch (e) {
            console.log(`${table}: ERROR - ${e.message.split('\n')[0]}`);
        }
    }

    await prisma.$disconnect();
}

main();
