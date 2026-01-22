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
        pageIntentPages: { success: 0, errors: 0 },
        pageIntentSummaries: { success: 0, errors: 0 },
        verification: {}
    };

    try {
        // ========== MIGRATE PAGE INTENT PAGES ==========
        const pagesPath = path.join(DATA_DIR, 'page_intent_pages.json');
        if (fs.existsSync(pagesPath)) {
            console.log('Loading page_intent_pages.json...');
            const records = JSON.parse(fs.readFileSync(pagesPath, 'utf-8'));
            console.log(`Found ${records.length} page intent pages to migrate`);

            for (let i = 0; i < records.length; i += BATCH_SIZE) {
                const batch = records.slice(i, i + BATCH_SIZE);
                for (const r of batch) {
                    try {
                        await prisma.pageIntentPage.upsert({
                            where: { id: r.id },
                            update: {
                                clientCode: r.clientCode,
                                url: r.url,
                                intentData: {
                                    domain: r.domain,
                                    intent: r.intent
                                },
                                updatedAt: new Date()
                            },
                            create: {
                                id: r.id,
                                clientCode: r.clientCode,
                                url: r.url,
                                intentData: {
                                    domain: r.domain,
                                    intent: r.intent
                                },
                                createdAt: r.createdAt ? new Date(r.createdAt) : new Date()
                            }
                        });
                        results.pageIntentPages.success++;
                    } catch (e: any) {
                        results.pageIntentPages.errors++;
                        if (results.pageIntentPages.errors <= 3) {
                            console.error(`Page intent page error: ${e.message}`);
                        }
                    }
                }
            }
        }

        // ========== MIGRATE PAGE INTENT SUMMARIES ==========
        const summariesPath = path.join(DATA_DIR, 'page_intent_summaries.json');
        if (fs.existsSync(summariesPath)) {
            console.log('Loading page_intent_summaries.json...');
            const records = JSON.parse(fs.readFileSync(summariesPath, 'utf-8'));
            console.log(`Found ${records.length} page intent summaries to migrate`);

            for (const r of records) {
                try {
                    await prisma.pageIntentSummary.upsert({
                        where: { id: r.id },
                        update: {
                            clientCode: r.clientCode,
                            url: r.domain, // Using domain as URL for summaries
                            summaryJson: {
                                totalPages: r.totalPages,
                                problemAwareSolutionCount: r.problemAwareSolutionCount,
                                educationalInformationalCount: r.educationalInformationalCount,
                                commercialInvestigationCount: r.commercialInvestigationCount,
                                trustProofCount: r.trustProofCount,
                                brandNavigationCount: r.brandNavigationCount,
                                transactionalCount: r.transactionalCount
                            },
                            updatedAt: new Date()
                        },
                        create: {
                            id: r.id,
                            clientCode: r.clientCode,
                            url: r.domain,
                            summaryJson: {
                                totalPages: r.totalPages,
                                problemAwareSolutionCount: r.problemAwareSolutionCount,
                                educationalInformationalCount: r.educationalInformationalCount,
                                commercialInvestigationCount: r.commercialInvestigationCount,
                                trustProofCount: r.trustProofCount,
                                brandNavigationCount: r.brandNavigationCount,
                                transactionalCount: r.transactionalCount
                            },
                            createdAt: r.createdAt ? new Date(r.createdAt) : new Date()
                        }
                    });
                    results.pageIntentSummaries.success++;
                } catch (e: any) {
                    results.pageIntentSummaries.errors++;
                    console.error(`Page intent summary error: ${e.message}`);
                }
            }
        }

        // ========== VERIFICATION ==========
        const [pagesCount, summariesCount] = await Promise.all([
            prisma.pageIntentPage.count(),
            prisma.pageIntentSummary.count()
        ]);

        results.verification = {
            pageIntentPages: pagesCount,
            pageIntentSummaries: summariesCount
        };

        results.completed = new Date().toISOString();
        results.status = 'SUCCESS';

        return NextResponse.json(results);
    } catch (error: any) {
        console.error('Phase 7 migration error:', error);
        results.error = error.message;
        results.status = 'FAILED';
        return NextResponse.json(results, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
}
