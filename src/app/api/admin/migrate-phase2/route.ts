import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

// Batch size for bulk inserts
const BATCH_SIZE = 100;

export async function GET(req: NextRequest) {
    const results: any = {
        started: new Date().toISOString(),
        domainKeywords: { success: 0, errors: 0, skipped: 0 },
        domainPages: { success: 0, errors: 0, skipped: 0 },
        verification: {}
    };

    try {
        // ========== MIGRATE DOMAIN KEYWORDS ==========
        const keywordsPath = path.join(DATA_DIR, 'domain_keywords.json');
        if (fs.existsSync(keywordsPath)) {
            console.log('Loading domain_keywords.json...');
            const keywords = JSON.parse(fs.readFileSync(keywordsPath, 'utf-8'));
            console.log(`Found ${keywords.length} domain keywords to migrate`);

            // Process in batches
            for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
                const batch = keywords.slice(i, i + BATCH_SIZE);

                for (const kw of batch) {
                    try {
                        await prisma.domainKeyword.upsert({
                            where: {
                                clientCode_domain_keyword_locationCode: {
                                    clientCode: kw.clientCode,
                                    domain: kw.domain,
                                    keyword: kw.keyword,
                                    locationCode: kw.locationCode || 'US'
                                }
                            },
                            update: {
                                label: kw.label || undefined,
                                languageCode: kw.languageCode || undefined,
                                position: kw.position ?? undefined,
                                searchVolume: kw.searchVolume ?? undefined,
                                cpc: kw.cpc ?? undefined,
                                url: kw.url || undefined,
                                fetchedAt: kw.fetchedAt ? new Date(kw.fetchedAt) : undefined,
                                snapshotDate: kw.snapshotDate || undefined,
                                tagId: kw.tagId || undefined,
                                tagData: kw.tagData || undefined,
                                updatedAt: new Date()
                            },
                            create: {
                                id: kw.id,
                                clientCode: kw.clientCode,
                                domain: kw.domain,
                                label: kw.label || undefined,
                                locationCode: kw.locationCode || 'US',
                                languageCode: kw.languageCode || undefined,
                                keyword: kw.keyword,
                                position: kw.position ?? undefined,
                                searchVolume: kw.searchVolume ?? undefined,
                                cpc: kw.cpc ?? undefined,
                                url: kw.url || undefined,
                                fetchedAt: kw.fetchedAt ? new Date(kw.fetchedAt) : undefined,
                                snapshotDate: kw.snapshotDate || undefined,
                                tagId: kw.tagId || undefined,
                                tagData: kw.tagData || undefined
                            }
                        });
                        results.domainKeywords.success++;
                    } catch (e: any) {
                        results.domainKeywords.errors++;
                        if (results.domainKeywords.errors <= 5) {
                            console.error(`Keyword error: ${e.message}`);
                        }
                    }
                }

                // Log progress every 1000 records
                if ((i + BATCH_SIZE) % 1000 === 0) {
                    console.log(`Domain keywords progress: ${i + BATCH_SIZE}/${keywords.length}`);
                }
            }
        }

        // ========== MIGRATE DOMAIN PAGES ==========
        const pagesPath = path.join(DATA_DIR, 'domain_pages.json');
        if (fs.existsSync(pagesPath)) {
            console.log('Loading domain_pages.json...');
            const pages = JSON.parse(fs.readFileSync(pagesPath, 'utf-8'));
            console.log(`Found ${pages.length} domain pages to migrate`);

            for (let i = 0; i < pages.length; i += BATCH_SIZE) {
                const batch = pages.slice(i, i + BATCH_SIZE);

                for (const page of batch) {
                    try {
                        await prisma.domainPage.upsert({
                            where: {
                                clientCode_domain_pageURL: {
                                    clientCode: page.clientCode,
                                    domain: page.domain,
                                    pageURL: page.pageURL
                                }
                            },
                            update: {
                                label: page.label || undefined,
                                locationCode: page.locationCode || undefined,
                                languageCode: page.languageCode || undefined,
                                estTrafficETV: page.estTrafficETV ?? undefined,
                                keywordsCount: page.keywordsCount ?? undefined,
                                fetchedAt: page.fetchedAt ? new Date(page.fetchedAt) : undefined,
                                snapshotDate: page.snapshotDate || undefined,
                                pageType: page.pageType || undefined,
                                pageIntent: page.pageIntent || undefined,
                                isSeoRelevant: page.isSeoRelevant ?? undefined,
                                classificationMethod: page.classificationMethod || undefined,
                                classificationConfidence: page.classificationConfidence || undefined,
                                needsAiReview: page.needsAiReview ?? undefined,
                                seoAction: page.seoAction || undefined,
                                classificationExplanation: page.classificationExplanation || undefined,
                                priorityScore: page.priorityScore ?? undefined,
                                priorityTier: page.priorityTier || undefined,
                                priorityScoreBreakdown: page.priorityScoreBreakdown || undefined,
                                priorityCalculatedAt: page.priorityCalculatedAt ? new Date(page.priorityCalculatedAt) : undefined,
                                matchedProduct: page.matchedProduct || undefined,
                                clusterName: page.clusterName || undefined,
                                productClassifiedAt: page.productClassifiedAt ? new Date(page.productClassifiedAt) : undefined,
                                cluster: page.cluster || undefined,
                                clusterSource: page.clusterSource || undefined,
                                clusterExplanation: page.clusterExplanation || undefined,
                                clusterTaggedAt: page.clusterTaggedAt ? new Date(page.clusterTaggedAt) : undefined,
                                llmClusterId: page.llmClusterId || undefined,
                                llmClusterLabel: page.llmClusterLabel || undefined,
                                llmClusterDescription: page.llmClusterDescription || undefined,
                                llmClusterBatchId: page.llmClusterBatchId || undefined,
                                llmClusterRunId: page.llmClusterRunId || undefined,
                                updatedAt: new Date()
                            },
                            create: {
                                id: page.id,
                                clientCode: page.clientCode,
                                domain: page.domain,
                                label: page.label || undefined,
                                locationCode: page.locationCode || undefined,
                                languageCode: page.languageCode || undefined,
                                pageURL: page.pageURL,
                                estTrafficETV: page.estTrafficETV ?? undefined,
                                keywordsCount: page.keywordsCount ?? undefined,
                                fetchedAt: page.fetchedAt ? new Date(page.fetchedAt) : undefined,
                                snapshotDate: page.snapshotDate || undefined,
                                pageType: page.pageType || undefined,
                                pageIntent: page.pageIntent || undefined,
                                isSeoRelevant: page.isSeoRelevant ?? undefined,
                                classificationMethod: page.classificationMethod || undefined,
                                classificationConfidence: page.classificationConfidence || undefined,
                                needsAiReview: page.needsAiReview ?? undefined,
                                seoAction: page.seoAction || undefined,
                                classificationExplanation: page.classificationExplanation || undefined,
                                priorityScore: page.priorityScore ?? undefined,
                                priorityTier: page.priorityTier || undefined,
                                priorityScoreBreakdown: page.priorityScoreBreakdown || undefined,
                                priorityCalculatedAt: page.priorityCalculatedAt ? new Date(page.priorityCalculatedAt) : undefined,
                                matchedProduct: page.matchedProduct || undefined,
                                clusterName: page.clusterName || undefined,
                                productClassifiedAt: page.productClassifiedAt ? new Date(page.productClassifiedAt) : undefined,
                                cluster: page.cluster || undefined,
                                clusterSource: page.clusterSource || undefined,
                                clusterExplanation: page.clusterExplanation || undefined,
                                clusterTaggedAt: page.clusterTaggedAt ? new Date(page.clusterTaggedAt) : undefined,
                                llmClusterId: page.llmClusterId || undefined,
                                llmClusterLabel: page.llmClusterLabel || undefined,
                                llmClusterDescription: page.llmClusterDescription || undefined,
                                llmClusterBatchId: page.llmClusterBatchId || undefined,
                                llmClusterRunId: page.llmClusterRunId || undefined
                            }
                        });
                        results.domainPages.success++;
                    } catch (e: any) {
                        results.domainPages.errors++;
                        if (results.domainPages.errors <= 5) {
                            console.error(`Page error: ${e.message}`);
                        }
                    }
                }

                // Log progress
                if ((i + BATCH_SIZE) % 500 === 0) {
                    console.log(`Domain pages progress: ${i + BATCH_SIZE}/${pages.length}`);
                }
            }
        }

        // ========== VERIFICATION ==========
        const [keywordCount, pageCount] = await Promise.all([
            prisma.domainKeyword.count(),
            prisma.domainPage.count()
        ]);

        results.verification = {
            domainKeywords: keywordCount,
            domainPages: pageCount
        };

        results.completed = new Date().toISOString();
        results.status = 'SUCCESS';

        return NextResponse.json(results);
    } catch (error: any) {
        console.error('Phase 2 migration error:', error);
        results.error = error.message;
        results.status = 'FAILED';
        return NextResponse.json(results, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
}
