import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

const BATCH_SIZE = 100;

export async function GET(req: NextRequest) {
    const results: any = {
        started: new Date().toISOString(),
        serpResults: { success: 0, errors: 0 },
        keywordTags: { success: 0, errors: 0 },
        domainOverview: { success: 0, errors: 0 },
        verification: {}
    };

    try {
        // ========== MIGRATE SERP RESULTS ==========
        const serpPath = path.join(DATA_DIR, 'serp_results.json');
        if (fs.existsSync(serpPath)) {
            console.log('Loading serp_results.json...');
            const serpResults = JSON.parse(fs.readFileSync(serpPath, 'utf-8'));
            console.log(`Found ${serpResults.length} SERP results to migrate`);

            for (let i = 0; i < serpResults.length; i += BATCH_SIZE) {
                const batch = serpResults.slice(i, i + BATCH_SIZE);

                for (const serp of batch) {
                    try {
                        await prisma.serpResult.create({
                            data: {
                                id: serp.id,
                                clientCode: serp.clientCode,
                                keyword: serp.keyword,
                                locationCode: serp.locationCode ?? undefined,
                                languageCode: serp.languageCode || undefined,
                                rank: serp.rank ?? undefined,
                                rankAbsolute: serp.rankAbsolute ?? undefined,
                                url: serp.url || undefined,
                                title: serp.title || undefined,
                                description: serp.description || undefined,
                                domain: serp.domain || undefined,
                                breadcrumb: serp.breadcrumb || undefined,
                                isFeaturedSnippet: serp.isFeaturedSnippet ?? false,
                                isImage: serp.isImage ?? false,
                                isVideo: serp.isVideo ?? false,
                                highlighted: serp.highlighted || undefined,
                                etv: serp.etv ?? undefined,
                                estimatedPaidTrafficCost: serp.estimatedPaidTrafficCost ?? undefined,
                                fetchedAt: serp.fetchedAt ? new Date(serp.fetchedAt) : undefined
                            }
                        });
                        results.serpResults.success++;
                    } catch (e: any) {
                        // Skip duplicates
                        if (e.code === 'P2002') {
                            results.serpResults.success++;
                        } else {
                            results.serpResults.errors++;
                            if (results.serpResults.errors <= 3) {
                                console.error(`SERP error: ${e.message}`);
                            }
                        }
                    }
                }

                if ((i + BATCH_SIZE) % 500 === 0) {
                    console.log(`SERP progress: ${i + BATCH_SIZE}/${serpResults.length}`);
                }
            }
        }

        // ========== MIGRATE KEYWORD TAGS ==========
        const tagsPath = path.join(DATA_DIR, 'keyword_tags.json');
        if (fs.existsSync(tagsPath)) {
            console.log('Loading keyword_tags.json...');
            const tagsObj = JSON.parse(fs.readFileSync(tagsPath, 'utf-8'));
            const tagEntries = Object.entries(tagsObj);
            console.log(`Found ${tagEntries.length} keyword tags to migrate`);

            for (let i = 0; i < tagEntries.length; i += BATCH_SIZE) {
                const batch = tagEntries.slice(i, i + BATCH_SIZE);

                for (const [_, tag] of batch) {
                    const t = tag as any;
                    try {
                        await prisma.keywordTag.upsert({
                            where: { id: t.id },
                            update: {
                                clientCode: t.clientCode,
                                profileVersion: t.profileVersion || undefined,
                                keyword: t.keyword,
                                fitStatus: t.fitStatus || undefined,
                                productLine: t.productLine || undefined,
                                rationale: t.rationale || undefined,
                                modelRunId: t.modelRunId || undefined,
                                updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date()
                            },
                            create: {
                                id: t.id,
                                clientCode: t.clientCode,
                                profileVersion: t.profileVersion || undefined,
                                keyword: t.keyword,
                                fitStatus: t.fitStatus || undefined,
                                productLine: t.productLine || undefined,
                                rationale: t.rationale || undefined,
                                modelRunId: t.modelRunId || undefined,
                                createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
                                updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date()
                            }
                        });
                        results.keywordTags.success++;
                    } catch (e: any) {
                        results.keywordTags.errors++;
                        if (results.keywordTags.errors <= 3) {
                            console.error(`Tag error: ${e.message}`);
                        }
                    }
                }

                if ((i + BATCH_SIZE) % 1000 === 0) {
                    console.log(`Tags progress: ${i + BATCH_SIZE}/${tagEntries.length}`);
                }
            }
        }

        // ========== MIGRATE DOMAIN OVERVIEW ==========
        const overviewPath = path.join(DATA_DIR, 'domain_overview.json');
        if (fs.existsSync(overviewPath)) {
            console.log('Loading domain_overview.json...');
            const overviews = JSON.parse(fs.readFileSync(overviewPath, 'utf-8'));
            console.log(`Found ${overviews.length} domain overviews to migrate`);

            for (const overview of overviews) {
                try {
                    await prisma.domainOverview.upsert({
                        where: {
                            clientCode_domain_locationCode: {
                                clientCode: overview.clientCode,
                                domain: overview.domain,
                                locationCode: overview.locationCode || 'IN'
                            }
                        },
                        update: {
                            label: overview.label || undefined,
                            languageCode: overview.languageCode || undefined,
                            organicTrafficETV: overview.organicTrafficETV ?? undefined,
                            organicKeywordsCount: overview.organicKeywordsCount ?? undefined,
                            fetchedAt: overview.fetchedAt ? new Date(overview.fetchedAt) : undefined,
                            snapshotDate: overview.snapshotDate || undefined,
                            updatedAt: new Date()
                        },
                        create: {
                            id: overview.id,
                            clientCode: overview.clientCode,
                            domain: overview.domain,
                            label: overview.label || undefined,
                            locationCode: overview.locationCode || 'IN',
                            languageCode: overview.languageCode || undefined,
                            organicTrafficETV: overview.organicTrafficETV ?? undefined,
                            organicKeywordsCount: overview.organicKeywordsCount ?? undefined,
                            fetchedAt: overview.fetchedAt ? new Date(overview.fetchedAt) : undefined,
                            snapshotDate: overview.snapshotDate || undefined
                        }
                    });
                    results.domainOverview.success++;
                } catch (e: any) {
                    results.domainOverview.errors++;
                    if (results.domainOverview.errors <= 3) {
                        console.error(`Overview error: ${e.message}`);
                    }
                }
            }
        }

        // ========== VERIFICATION ==========
        const [serpCount, tagCount, overviewCount] = await Promise.all([
            prisma.serpResult.count(),
            prisma.keywordTag.count(),
            prisma.domainOverview.count()
        ]);

        results.verification = {
            serpResults: serpCount,
            keywordTags: tagCount,
            domainOverview: overviewCount
        };

        results.completed = new Date().toISOString();
        results.status = 'SUCCESS';

        return NextResponse.json(results);
    } catch (error: any) {
        console.error('Phase 3 migration error:', error);
        results.error = error.message;
        results.status = 'FAILED';
        return NextResponse.json(results, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
}
