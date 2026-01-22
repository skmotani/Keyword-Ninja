import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

const BATCH_SIZE = 50;

export async function GET(req: NextRequest) {
    const results: any = {
        started: new Date().toISOString(),
        clientPositionsSerp: { success: 0, errors: 0 },
        domainCredibility: { success: 0, errors: 0 },
        domainProfiles: { success: 0, errors: 0 },
        pageIntentSummaries: { success: 0, errors: 0 },
        pageIntentPages: { success: 0, errors: 0 },
        keywordApiData: { success: 0, errors: 0 },
        pageConfigs: { success: 0, errors: 0 },
        verification: {}
    };

    try {
        // ========== MIGRATE CLIENT POSITIONS SERP ==========
        const serpPath = path.join(DATA_DIR, 'client_positions_serp.json');
        if (fs.existsSync(serpPath)) {
            console.log('Loading client_positions_serp.json...');
            const records = JSON.parse(fs.readFileSync(serpPath, 'utf-8'));
            console.log(`Found ${records.length} SERP positions to migrate`);
            
            for (let i = 0; i < records.length; i += BATCH_SIZE) {
                const batch = records.slice(i, i + BATCH_SIZE);
                for (const r of batch) {
                    try {
                        await prisma.clientPositionSerp.upsert({
                            where: {
                                clientCode_keyword_selectedDomain_locationType: {
                                    clientCode: r.clientCode,
                                    keyword: r.keyword,
                                    selectedDomain: r.selectedDomain || '',
                                    locationType: r.locationType || 'IN'
                                }
                            },
                            update: {
                                rank: r.rank ?? undefined,
                                rankLabel: r.rankLabel || undefined,
                                rankDomain: r.rankDomain || undefined,
                                searchVolume: r.searchVolume ?? undefined,
                                competition: r.competition || undefined,
                                checkUrl: r.checkUrl || undefined,
                                lastPulledAt: r.lastPulledAt ? new Date(r.lastPulledAt) : undefined,
                                source: r.source || undefined,
                                c1: r.c1 || undefined,
                                c2: r.c2 || undefined,
                                c3: r.c3 || undefined,
                                c4: r.c4 || undefined,
                                c5: r.c5 || undefined,
                                c6: r.c6 || undefined,
                                c7: r.c7 || undefined,
                                c8: r.c8 || undefined,
                                c9: r.c9 || undefined,
                                c10: r.c10 || undefined,
                                updatedAt: new Date()
                            },
                            create: {
                                id: r.id,
                                clientCode: r.clientCode,
                                keyword: r.keyword,
                                selectedDomain: r.selectedDomain || '',
                                locationType: r.locationType || 'IN',
                                rank: r.rank ?? undefined,
                                rankLabel: r.rankLabel || undefined,
                                rankDomain: r.rankDomain || undefined,
                                searchVolume: r.searchVolume ?? undefined,
                                competition: r.competition || undefined,
                                checkUrl: r.checkUrl || undefined,
                                lastPulledAt: r.lastPulledAt ? new Date(r.lastPulledAt) : undefined,
                                source: r.source || undefined,
                                c1: r.c1 || undefined,
                                c2: r.c2 || undefined,
                                c3: r.c3 || undefined,
                                c4: r.c4 || undefined,
                                c5: r.c5 || undefined,
                                c6: r.c6 || undefined,
                                c7: r.c7 || undefined,
                                c8: r.c8 || undefined,
                                c9: r.c9 || undefined,
                                c10: r.c10 || undefined
                            }
                        });
                        results.clientPositionsSerp.success++;
                    } catch (e: any) {
                        results.clientPositionsSerp.errors++;
                        if (results.clientPositionsSerp.errors <= 3) {
                            console.error(`SERP position error: ${e.message}`);
                        }
                    }
                }
            }
        }

        // ========== MIGRATE DOMAIN CREDIBILITY ==========
        const credPath = path.join(DATA_DIR, 'domain_credibility.json');
        if (fs.existsSync(credPath)) {
            console.log('Loading domain_credibility.json...');
            const records = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
            console.log(`Found ${records.length} domain credibility records to migrate`);
            
            for (const r of records) {
                try {
                    await prisma.domainCredibility.upsert({
                        where: {
                            clientCode_domain: {
                                clientCode: r.clientCode,
                                domain: r.domain
                            }
                        },
                        update: {
                            name: r.name || undefined,
                            type: r.type || undefined,
                            lastPulledAt: r.lastPulledAt ? new Date(r.lastPulledAt) : undefined,
                            whoisJson: r.whoisJson || undefined,
                            backlinksSummaryJson: r.backlinksSummaryJson || undefined,
                            paidKeywords: r.paidKeywords ?? undefined,
                            adsKeywordsJson: r.adsKeywordsJson || undefined,
                            updatedAt: new Date()
                        },
                        create: {
                            clientCode: r.clientCode,
                            domain: r.domain,
                            name: r.name || undefined,
                            type: r.type || undefined,
                            lastPulledAt: r.lastPulledAt ? new Date(r.lastPulledAt) : undefined,
                            whoisJson: r.whoisJson || undefined,
                            backlinksSummaryJson: r.backlinksSummaryJson || undefined,
                            paidKeywords: r.paidKeywords ?? undefined,
                            adsKeywordsJson: r.adsKeywordsJson || undefined
                        }
                    });
                    results.domainCredibility.success++;
                } catch (e: any) {
                    results.domainCredibility.errors++;
                    if (results.domainCredibility.errors <= 3) {
                        console.error(`Credibility error: ${e.message}`);
                    }
                }
            }
        }

        // ========== MIGRATE DOMAIN PROFILES ==========
        const profilesPath = path.join(DATA_DIR, 'domainProfiles.json');
        if (fs.existsSync(profilesPath)) {
            console.log('Loading domainProfiles.json...');
            const records = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));
            console.log(`Found ${records.length} domain profiles to migrate`);
            
            for (const r of records) {
                try {
                    await prisma.domainProfile.upsert({
                        where: {
                            clientCode_domain: {
                                clientCode: r.clientCode,
                                domain: r.domain
                            }
                        },
                        update: {
                            title: r.title || undefined,
                            metaDescription: r.metaDescription || undefined,
                            inferredCategory: r.inferredCategory || undefined,
                            topKeywords: r.topKeywords || undefined,
                            organicTraffic: r.organicTraffic ?? undefined,
                            organicKeywordsCount: r.organicKeywordsCount ?? undefined,
                            backlinksCount: r.backlinksCount ?? undefined,
                            referringDomainsCount: r.referringDomainsCount ?? undefined,
                            domainRank: r.domainRank ?? undefined,
                            fetchStatus: r.fetchStatus || undefined,
                            errorMessage: r.errorMessage || undefined,
                            lastFetchedAt: r.lastFetchedAt ? new Date(r.lastFetchedAt) : undefined,
                            updatedAt: new Date()
                        },
                        create: {
                            id: r.id,
                            clientCode: r.clientCode,
                            domain: r.domain,
                            title: r.title || undefined,
                            metaDescription: r.metaDescription || undefined,
                            inferredCategory: r.inferredCategory || undefined,
                            topKeywords: r.topKeywords || undefined,
                            organicTraffic: r.organicTraffic ?? undefined,
                            organicKeywordsCount: r.organicKeywordsCount ?? undefined,
                            backlinksCount: r.backlinksCount ?? undefined,
                            referringDomainsCount: r.referringDomainsCount ?? undefined,
                            domainRank: r.domainRank ?? undefined,
                            fetchStatus: r.fetchStatus || undefined,
                            errorMessage: r.errorMessage || undefined,
                            lastFetchedAt: r.lastFetchedAt ? new Date(r.lastFetchedAt) : undefined
                        }
                    });
                    results.domainProfiles.success++;
                } catch (e: any) {
                    results.domainProfiles.errors++;
                    if (results.domainProfiles.errors <= 3) {
                        console.error(`Profile error: ${e.message}`);
                    }
                }
            }
        }

        // ========== MIGRATE PAGE CONFIGS ==========
        const configsPath = path.join(DATA_DIR, 'pageConfigs.json');
        if (fs.existsSync(configsPath)) {
            console.log('Loading pageConfigs.json...');
            const records = JSON.parse(fs.readFileSync(configsPath, 'utf-8'));
            console.log(`Found ${records.length} page configs to migrate`);
            
            for (const r of records) {
                try {
                    await prisma.pageConfig.upsert({
                        where: { path: r.path },
                        update: {
                            userDescription: r.userDescription || undefined,
                            comments: r.comments || undefined,
                            updatedAt: new Date()
                        },
                        create: {
                            path: r.path,
                            userDescription: r.userDescription || undefined,
                            comments: r.comments || undefined
                        }
                    });
                    results.pageConfigs.success++;
                } catch (e: any) {
                    results.pageConfigs.errors++;
                    if (results.pageConfigs.errors <= 3) {
                        console.error(`PageConfig error: ${e.message}`);
                    }
                }
            }
        }

        // ========== VERIFICATION ==========
        const [serpCount, credCount, profileCount, configCount] = await Promise.all([
            prisma.clientPositionSerp.count(),
            prisma.domainCredibility.count(),
            prisma.domainProfile.count(),
            prisma.pageConfig.count()
        ]);

        results.verification = {
            clientPositionsSerp: serpCount,
            domainCredibility: credCount,
            domainProfiles: profileCount,
            pageConfigs: configCount
        };

        results.completed = new Date().toISOString();
        results.status = 'SUCCESS';

        return NextResponse.json(results);
    } catch (error: any) {
        console.error('Phase 5 migration error:', error);
        results.error = error.message;
        results.status = 'FAILED';
        return NextResponse.json(results, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
}
