const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const queries = await prisma.dashboardQuery.findMany({
        select: { id: true, title: true }
    });
    console.log('Queries in PostgreSQL database:');
    console.log('Total:', queries.length);
    queries.forEach(q => console.log(`  - ${q.id}: ${q.title}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
