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
        keywordApiData: { success: 0, errors: 0 },
        curatedKeywords: { success: 0, errors: 0 },
        dashboardQueryGroups: { success: 0, errors: 0 },
        dashboardQueries: { success: 0, errors: 0 },
        dashboardQueryCustomizations: { success: 0, errors: 0 },
        exportPageRegistry: { success: 0, errors: 0 },
        exportColumnRegistry: { success: 0, errors: 0 },
        verification: {}
    };

    try {
        // ========== MIGRATE KEYWORD API DATA ==========
        const keywordApiPath = path.join(DATA_DIR, 'keyword_api_data.json');
        if (fs.existsSync(keywordApiPath)) {
            console.log('Loading keyword_api_data.json...');
            const records = JSON.parse(fs.readFileSync(keywordApiPath, 'utf-8'));
            console.log(`Found ${records.length} keyword API records to migrate`);

            for (let i = 0; i < records.length; i += BATCH_SIZE) {
                const batch = records.slice(i, i + BATCH_SIZE);
                for (const r of batch) {
                    try {
                        await prisma.keywordApiDataV2.upsert({
                            where: {
                                clientCode_keywordText_locationCode: {
                                    clientCode: r.clientCode,
                                    keywordText: r.keywordText,
                                    locationCode: r.locationCode ?? 0
                                }
                            },
                            update: {
                                normalizedKeyword: r.normalizedKeyword || undefined,
                                searchVolume: r.searchVolume ?? undefined,
                                cpc: r.cpc ?? undefined,
                                competition: r.competition || undefined,
                                lowTopOfPageBid: r.lowTopOfPageBid ?? undefined,
                                highTopOfPageBid: r.highTopOfPageBid ?? undefined,
                                languageCode: r.languageCode || undefined,
                                sourceApi: r.sourceApi || undefined,
                                snapshotDate: r.snapshotDate || undefined,
                                lastPulledAt: r.lastPulledAt ? new Date(r.lastPulledAt) : undefined,
                                updatedAt: new Date()
                            },
                            create: {
                                id: r.id,
                                clientCode: r.clientCode,
                                keywordText: r.keywordText,
                                normalizedKeyword: r.normalizedKeyword || undefined,
                                searchVolume: r.searchVolume ?? undefined,
                                cpc: r.cpc ?? undefined,
                                competition: r.competition || undefined,
                                lowTopOfPageBid: r.lowTopOfPageBid ?? undefined,
                                highTopOfPageBid: r.highTopOfPageBid ?? undefined,
                                locationCode: r.locationCode ?? 0,
                                languageCode: r.languageCode || undefined,
                                sourceApi: r.sourceApi || undefined,
                                snapshotDate: r.snapshotDate || undefined,
                                lastPulledAt: r.lastPulledAt ? new Date(r.lastPulledAt) : undefined
                            }
                        });
                        results.keywordApiData.success++;
                    } catch (e: any) {
                        results.keywordApiData.errors++;
                        if (results.keywordApiData.errors <= 3) {
                            console.error(`Keyword API error: ${e.message}`);
                        }
                    }
                }
            }
        }

        // ========== MIGRATE CURATED KEYWORDS ==========
        const curatedPath = path.join(DATA_DIR, 'curated_keywords.json');
        if (fs.existsSync(curatedPath)) {
            console.log('Loading curated_keywords.json...');
            const records = JSON.parse(fs.readFileSync(curatedPath, 'utf-8'));
            console.log(`Found ${records.length} curated keywords to migrate`);

            for (const r of records) {
                try {
                    await prisma.curatedKeyword.upsert({
                        where: {
                            clientCode_keyword: {
                                clientCode: r.clientCode,
                                keyword: r.keyword
                            }
                        },
                        update: {
                            notes: r.notes || undefined,
                            updatedAt: new Date()
                        },
                        create: {
                            id: r.id,
                            clientCode: r.clientCode,
                            keyword: r.keyword,
                            notes: r.notes || undefined
                        }
                    });
                    results.curatedKeywords.success++;
                } catch (e: any) {
                    results.curatedKeywords.errors++;
                }
            }
        }

        // ========== MIGRATE DASHBOARD QUERY GROUPS ==========
        const groupsPath = path.join(DATA_DIR, 'dashboard_query_groups.json');
        if (fs.existsSync(groupsPath)) {
            console.log('Loading dashboard_query_groups.json...');
            const records = JSON.parse(fs.readFileSync(groupsPath, 'utf-8'));
            console.log(`Found ${records.length} query groups to migrate`);

            for (const r of records) {
                try {
                    await prisma.dashboardQueryGroup.upsert({
                        where: { id: r.id },
                        update: {
                            name: r.name,
                            description: r.description || undefined,
                            displayOrder: r.order ?? 0,
                            updatedAt: new Date()
                        },
                        create: {
                            id: r.id,
                            name: r.name,
                            description: r.description || undefined,
                            displayOrder: r.order ?? 0
                        }
                    });
                    results.dashboardQueryGroups.success++;
                } catch (e: any) {
                    results.dashboardQueryGroups.errors++;
                    console.error(`Query group error: ${e.message}`);
                }
            }
        }

        // ========== MIGRATE DASHBOARD QUERIES ==========
        const queriesPath = path.join(DATA_DIR, 'dashboard_queries.json');
        if (fs.existsSync(queriesPath)) {
            console.log('Loading dashboard_queries.json...');
            const records = JSON.parse(fs.readFileSync(queriesPath, 'utf-8'));
            console.log(`Found ${records.length} queries to migrate`);

            for (const r of records) {
                try {
                    await prisma.dashboardQuery.upsert({
                        where: { id: r.id },
                        update: {
                            queryNumber: r.queryNumber || undefined,
                            groupId: r.groupId || undefined,
                            title: r.title,
                            description: r.description || undefined,
                            tooltip: r.tooltip || undefined,
                            status: r.status || undefined,
                            queryType: r.queryType || undefined,
                            config: r.config || undefined,
                            sourceInfo: r.sourceInfo || undefined,
                            isActive: r.isActive ?? true,
                            updatedAt: new Date()
                        },
                        create: {
                            id: r.id,
                            queryNumber: r.queryNumber || undefined,
                            groupId: r.groupId || undefined,
                            title: r.title,
                            description: r.description || undefined,
                            tooltip: r.tooltip || undefined,
                            status: r.status || undefined,
                            queryType: r.queryType || undefined,
                            config: r.config || undefined,
                            sourceInfo: r.sourceInfo || undefined,
                            isActive: r.isActive ?? true
                        }
                    });
                    results.dashboardQueries.success++;
                } catch (e: any) {
                    results.dashboardQueries.errors++;
                    console.error(`Query error: ${e.message}`);
                }
            }
        }

        // ========== MIGRATE DASHBOARD QUERY CUSTOMIZATIONS ==========
        const customPath = path.join(DATA_DIR, 'dashboard_query_customizations.json');
        if (fs.existsSync(customPath)) {
            console.log('Loading dashboard_query_customizations.json...');
            const data = JSON.parse(fs.readFileSync(customPath, 'utf-8'));
            // File has nested structure: { queries: [...], categories: [...], queryOrder: {...} }
            const queries = data.queries || data;
            console.log(`Found ${Array.isArray(queries) ? queries.length : 0} customizations to migrate`);

            if (Array.isArray(queries)) {
                for (const r of queries) {
                    try {
                        // Customizations file doesn't have clientCode, it's global
                        await prisma.dashboardQueryCustomization.upsert({
                            where: {
                                clientCode_queryId: {
                                    clientCode: 'GLOBAL',
                                    queryId: r.queryId
                                }
                            },
                            update: {
                                customTitle: r.customTitle || undefined,
                                customConfig: r.pageContent ? { pageTitle: r.pageTitle, pageContent: r.pageContent } : undefined,
                                isHidden: r.isHidden ?? false,
                                updatedAt: new Date()
                            },
                            create: {
                                clientCode: 'GLOBAL',
                                queryId: r.queryId,
                                customTitle: r.customTitle || undefined,
                                customConfig: r.pageContent ? { pageTitle: r.pageTitle, pageContent: r.pageContent } : undefined,
                                isHidden: r.isHidden ?? false
                            }
                        });
                        results.dashboardQueryCustomizations.success++;
                    } catch (e: any) {
                        results.dashboardQueryCustomizations.errors++;
                    }
                }
            }
        }

        // ========== MIGRATE EXPORT PAGE REGISTRY ==========
        const pageRegPath = path.join(DATA_DIR, 'export_page_registry.json');
        if (fs.existsSync(pageRegPath)) {
            console.log('Loading export_page_registry.json...');
            const records = JSON.parse(fs.readFileSync(pageRegPath, 'utf-8'));
            console.log(`Found ${records.length} export pages to migrate`);

            for (const r of records) {
                try {
                    // File uses pageKey not pageId
                    const pageId = r.pageKey || r.pageId;
                    if (!pageId) continue;

                    await prisma.exportPageRegistry.upsert({
                        where: { pageId: pageId },
                        update: {
                            displayName: r.pageName || r.displayName,
                            dataSourceRef: r.dataSourceRef || undefined,
                            description: r.description || undefined,
                            columns: r.columns || undefined,
                            isActive: r.status === 'ACTIVE',
                            updatedAt: new Date()
                        },
                        create: {
                            pageId: pageId,
                            displayName: r.pageName || r.displayName,
                            dataSourceRef: r.dataSourceRef || undefined,
                            description: r.description || undefined,
                            columns: r.columns || undefined,
                            isActive: r.status === 'ACTIVE'
                        }
                    });
                    results.exportPageRegistry.success++;
                } catch (e: any) {
                    results.exportPageRegistry.errors++;
                    console.error(`Export page error: ${e.message}`);
                }
            }
        }

        // ========== MIGRATE EXPORT COLUMN REGISTRY ==========
        const colRegPath = path.join(DATA_DIR, 'export_column_registry.json');
        if (fs.existsSync(colRegPath)) {
            console.log('Loading export_column_registry.json...');
            const records = JSON.parse(fs.readFileSync(colRegPath, 'utf-8'));
            console.log(`Found ${records.length} export columns to migrate`);

            for (const r of records) {
                try {
                    await prisma.exportColumnRegistry.upsert({
                        where: {
                            pageId_columnName: {
                                pageId: r.pageId,
                                columnName: r.columnName
                            }
                        },
                        update: {
                            displayName: r.displayName,
                            dataType: r.dataType || undefined,
                            sourceField: r.sourceField || undefined,
                            metricMatchKey: r.metricMatchKey || undefined,
                            isActive: r.isActive ?? true,
                            updatedAt: new Date()
                        },
                        create: {
                            pageId: r.pageId,
                            columnName: r.columnName,
                            displayName: r.displayName,
                            dataType: r.dataType || undefined,
                            sourceField: r.sourceField || undefined,
                            metricMatchKey: r.metricMatchKey || undefined,
                            isActive: r.isActive ?? true
                        }
                    });
                    results.exportColumnRegistry.success++;
                } catch (e: any) {
                    results.exportColumnRegistry.errors++;
                }
            }
        }

        // ========== VERIFICATION ==========
        const [kwCount, curatedCount, groupCount, queryCount, customCount, pageRegCount, colRegCount] = await Promise.all([
            prisma.keywordApiDataV2.count(),
            prisma.curatedKeyword.count(),
            prisma.dashboardQueryGroup.count(),
            prisma.dashboardQuery.count(),
            prisma.dashboardQueryCustomization.count(),
            prisma.exportPageRegistry.count(),
            prisma.exportColumnRegistry.count()
        ]);

        results.verification = {
            keywordApiData: kwCount,
            curatedKeywords: curatedCount,
            dashboardQueryGroups: groupCount,
            dashboardQueries: queryCount,
            dashboardQueryCustomizations: customCount,
            exportPageRegistry: pageRegCount,
            exportColumnRegistry: colRegCount
        };

        results.completed = new Date().toISOString();
        results.status = 'SUCCESS';

        return NextResponse.json(results);
    } catch (error: any) {
        console.error('Phase 6 migration error:', error);
        results.error = error.message;
        results.status = 'FAILED';
        return NextResponse.json(results, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
}
