import { prisma } from '../src/lib/prisma';

// SEO meaning descriptions
function getSurfaceSeoMeaning(surfaceKey: string, label: string, category: string): string {
    const key = surfaceKey.toLowerCase();
    const labelLower = label.toLowerCase();

    const meanings: Record<string, string> = {
        'linkedin': 'Professional network presence. Builds B2B trust.',
        'facebook': 'Social proof and community engagement.',
        'twitter': 'Real-time brand presence in search results.',
        'instagram': 'Visual brand identity, high engagement.',
        'youtube': 'Video SEO powerhouse, 2nd largest search engine.',
        'google': 'Core search visibility indicator.',
        'gbp': 'Google Business Profile, critical for local SEO.',
        'knowledge_panel': 'Brand entity surface for SERP trust.',
        'wikipedia': 'Highest authority backlink.',
        'wikidata': 'Structured entity graph for AI/LLMs.',
        'website': 'Core web presence, foundation of SEO.',
        'schema': 'Structured data for rich snippets.',
        'gsc': 'Site ownership + indexing diagnostics.',
        'perplexity': 'AI search engine citations.',
        'chatgpt': 'AI assistant brand mentions.',
    };

    for (const [keyword, meaning] of Object.entries(meanings)) {
        if (key.includes(keyword) || labelLower.includes(keyword)) {
            return meaning;
        }
    }
    return 'Digital footprint surface.';
}

async function main() {
    const surfaces = await prisma.footprintSurfaceRegistry.findMany({
        where: { enabled: true },
        orderBy: { basePoints: 'desc' },
        select: { surfaceKey: true, label: true, category: true, importanceTier: true, basePoints: true }
    });

    const categories = Array.from(new Set(surfaces.map(s => s.category))).sort();

    console.log('\n## Top 3 Surfaces by Points per Category\n');
    console.log('| Category | Label | Importance | Points | Why It Matters |');
    console.log('|----------|-------|------------|--------|----------------|');

    for (const cat of categories) {
        const top3 = surfaces.filter(s => s.category === cat).slice(0, 3);
        for (const s of top3) {
            const meaning = getSurfaceSeoMeaning(s.surfaceKey, s.label, s.category);
            console.log(`| ${cat} | ${s.label} | ${s.importanceTier} | ${s.basePoints} | ${meaning} |`);
        }
    }
}

main()
    .then(() => prisma.$disconnect())
    .catch(e => { console.error(e); prisma.$disconnect(); });
