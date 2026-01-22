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
        clientPositions: { success: 0, errors: 0 },
        domainClassifications: { success: 0, errors: 0 },
        manualKeywords: { success: 0, errors: 0 },
        verification: {}
    };

    try {
        // ========== MIGRATE CLIENT POSITIONS ==========
        const positionsPath = path.join(DATA_DIR, 'client_positions.json');
        if (fs.existsSync(positionsPath)) {
            console.log('Loading client_positions.json...');
            const positions = JSON.parse(fs.readFileSync(positionsPath, 'utf-8'));
            console.log(`Found ${positions.length} client positions to migrate`);

            for (const pos of positions) {
                try {
                    await prisma.clientPosition.create({
                        data: {
                            id: pos.id,
                            clientCode: pos.clientCode,
                            keywordOrTheme: pos.keywordOrTheme,
                            currentPosition: pos.currentPosition || undefined,
                            competitor: pos.competitor || undefined,
                            source: pos.source || undefined,
                            notes: pos.notes || undefined,
                            asOfDate: pos.asOfDate || undefined,
                            createdAt: pos.createdAt ? new Date(pos.createdAt) : new Date(),
                            updatedAt: pos.updatedAt ? new Date(pos.updatedAt) : new Date()
                        }
                    });
                    results.clientPositions.success++;
                } catch (e: any) {
                    if (e.code === 'P2002') {
                        results.clientPositions.success++;
                    } else {
                        results.clientPositions.errors++;
                        if (results.clientPositions.errors <= 3) {
                            console.error(`Position error: ${e.message}`);
                        }
                    }
                }
            }
        }

        // ========== MIGRATE DOMAIN CLASSIFICATIONS ==========
        const classificationsPath = path.join(DATA_DIR, 'domain_classifications.json');
        if (fs.existsSync(classificationsPath)) {
            console.log('Loading domain_classifications.json...');
            const classifications = JSON.parse(fs.readFileSync(classificationsPath, 'utf-8'));
            console.log(`Found ${classifications.length} domain classifications to migrate`);

            for (let i = 0; i < classifications.length; i += BATCH_SIZE) {
                const batch = classifications.slice(i, i + BATCH_SIZE);

                for (const cls of batch) {
                    try {
                        await prisma.domainClassification.upsert({
                            where: { id: cls.id },
                            update: {
                                clientCode: cls.clientCode,
                                domain: cls.domain,
                                domainType: cls.domainType || undefined,
                                pageIntent: cls.pageIntent || undefined,
                                productMatchScoreValue: cls.productMatchScoreValue ?? undefined,
                                productMatchScoreBucket: cls.productMatchScoreBucket || undefined,
                                businessRelevanceCategory: cls.businessRelevanceCategory || undefined,
                                explanationLink: cls.explanationLink || undefined,
                                explanationSummary: cls.explanationSummary || undefined,
                                classifiedAt: cls.classifiedAt ? new Date(cls.classifiedAt) : undefined,
                                updatedAt: cls.updatedAt ? new Date(cls.updatedAt) : new Date()
                            },
                            create: {
                                id: cls.id,
                                clientCode: cls.clientCode,
                                domain: cls.domain,
                                domainType: cls.domainType || undefined,
                                pageIntent: cls.pageIntent || undefined,
                                productMatchScoreValue: cls.productMatchScoreValue ?? undefined,
                                productMatchScoreBucket: cls.productMatchScoreBucket || undefined,
                                businessRelevanceCategory: cls.businessRelevanceCategory || undefined,
                                explanationLink: cls.explanationLink || undefined,
                                explanationSummary: cls.explanationSummary || undefined,
                                classifiedAt: cls.classifiedAt ? new Date(cls.classifiedAt) : undefined,
                                updatedAt: cls.updatedAt ? new Date(cls.updatedAt) : new Date()
                            }
                        });
                        results.domainClassifications.success++;
                    } catch (e: any) {
                        results.domainClassifications.errors++;
                        if (results.domainClassifications.errors <= 3) {
                            console.error(`Classification error: ${e.message}`);
                        }
                    }
                }
            }
        }

        // ========== MIGRATE MANUAL KEYWORDS ==========
        const keywordsPath = path.join(DATA_DIR, 'manualKeywords.json');
        if (fs.existsSync(keywordsPath)) {
            console.log('Loading manualKeywords.json...');
            const keywords = JSON.parse(fs.readFileSync(keywordsPath, 'utf-8'));
            console.log(`Found ${keywords.length} manual keywords to migrate`);

            for (const kw of keywords) {
                try {
                    await prisma.manualKeyword.upsert({
                        where: {
                            clientCode_keywordText: {
                                clientCode: kw.clientCode,
                                keywordText: kw.keywordText
                            }
                        },
                        update: {
                            notes: kw.notes || undefined,
                            isActive: kw.isActive ?? true,
                            source: kw.source || undefined,
                            updatedAt: new Date()
                        },
                        create: {
                            id: kw.id,
                            clientCode: kw.clientCode,
                            keywordText: kw.keywordText,
                            notes: kw.notes || undefined,
                            isActive: kw.isActive ?? true,
                            source: kw.source || undefined
                        }
                    });
                    results.manualKeywords.success++;
                } catch (e: any) {
                    results.manualKeywords.errors++;
                    if (results.manualKeywords.errors <= 3) {
                        console.error(`Manual keyword error: ${e.message}`);
                    }
                }
            }
        }

        // ========== VERIFICATION ==========
        const [posCount, classCount, kwCount] = await Promise.all([
            prisma.clientPosition.count(),
            prisma.domainClassification.count(),
            prisma.manualKeyword.count()
        ]);

        results.verification = {
            clientPositions: posCount,
            domainClassifications: classCount,
            manualKeywords: kwCount
        };

        results.completed = new Date().toISOString();
        results.status = 'SUCCESS';

        return NextResponse.json(results);
    } catch (error: any) {
        console.error('Phase 4 migration error:', error);
        results.error = error.message;
        results.status = 'FAILED';
        return NextResponse.json(results, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
}
