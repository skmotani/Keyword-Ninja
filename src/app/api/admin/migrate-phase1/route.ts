import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const DATA_DIR = path.join(process.cwd(), 'data');

/**
 * API endpoint to run Phase 1 migration from browser
 * GET /api/admin/migrate-phase1
 * 
 * This imports data from:
 * - client_ai_profiles.json → ClientAIProfile, TermDictionary, DictionaryTerm
 * - competitors.json → Competitor
 */
export async function GET(req: NextRequest) {
    const results: any = {
        started: new Date().toISOString(),
        profiles: { success: 0, errors: [] as string[] },
        dictionaries: { success: 0, terms: 0 },
        competitors: { success: 0, errors: [] as string[] },
        verification: {}
    };

    try {
        // ========== MIGRATE CLIENT AI PROFILES ==========
        const profilesPath = path.join(DATA_DIR, 'client_ai_profiles.json');
        if (fs.existsSync(profilesPath)) {
            const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));

            for (const profile of profiles) {
                try {
                    // Check if client exists
                    const client = await prisma.client.findUnique({
                        where: { code: profile.clientCode }
                    });

                    if (!client) {
                        results.profiles.errors.push(`Client ${profile.clientCode} not found`);
                        continue;
                    }

                    // Extract dictionary
                    const dictionary = profile.ai_kw_builder_term_dictionary;
                    const terms = Array.isArray(dictionary?.terms)
                        ? dictionary.terms
                        : Object.values(dictionary?.terms || {});

                    // Prepare profile data
                    const { ai_kw_builder_term_dictionary, clientCode, companyName, mainDomain,
                        productCategories, serviceOfferings, targetMarkets, assistantInstructions,
                        ...otherProfileData } = profile;

                    // Upsert profile
                    const dbProfile = await prisma.clientAIProfile.upsert({
                        where: { clientCode: profile.clientCode },
                        update: {
                            companyName: companyName || 'Unknown',
                            mainDomain,
                            productCategories: productCategories || undefined,
                            serviceOfferings: serviceOfferings || undefined,
                            targetMarkets: targetMarkets || undefined,
                            assistantInstructions,
                            profileData: Object.keys(otherProfileData).length > 0 ? otherProfileData : undefined,
                            updatedAt: new Date()
                        },
                        create: {
                            clientCode: profile.clientCode,
                            companyName: companyName || 'Unknown',
                            mainDomain,
                            productCategories: productCategories || undefined,
                            serviceOfferings: serviceOfferings || undefined,
                            targetMarkets: targetMarkets || undefined,
                            assistantInstructions,
                            profileData: Object.keys(otherProfileData).length > 0 ? otherProfileData : undefined
                        }
                    });
                    results.profiles.success++;

                    // Migrate dictionary terms
                    if (terms.length > 0) {
                        // Delete existing dictionary
                        await prisma.termDictionary.deleteMany({
                            where: { profileId: dbProfile.id }
                        });

                        // Create new dictionary with terms
                        const dbDictionary = await prisma.termDictionary.create({
                            data: {
                                profileId: dbProfile.id,
                                version: dictionary?.version || 1,
                                domain: dictionary?.domain || mainDomain,
                                industryKey: dictionary?.industryKey || 'general'
                            }
                        });
                        results.dictionaries.success++;

                        // Insert terms
                        const termData = (terms as any[])
                            .filter(t => t.term || t.name)
                            .map(t => ({
                                dictionaryId: dbDictionary.id,
                                term: t.term || t.name || '',
                                bucket: t.bucket || 'unassigned',
                                ngramType: t.ngramType || 'full',
                                source: t.source || 'user',
                                confidence: t.confidence || 0,
                                locked: t.locked || false
                            }));

                        if (termData.length > 0) {
                            await prisma.dictionaryTerm.createMany({
                                data: termData,
                                skipDuplicates: true
                            });
                            results.dictionaries.terms += termData.length;
                        }
                    }
                } catch (e: any) {
                    results.profiles.errors.push(`${profile.clientCode}: ${e.message}`);
                }
            }
        }

        // ========== MIGRATE COMPETITORS ==========
        const competitorsPath = path.join(DATA_DIR, 'competitors.json');
        if (fs.existsSync(competitorsPath)) {
            const competitors = JSON.parse(fs.readFileSync(competitorsPath, 'utf-8'));

            for (const comp of competitors) {
                try {
                    const client = await prisma.client.findUnique({
                        where: { code: comp.clientCode }
                    });

                    if (!client) {
                        continue; // Skip silently for competitors
                    }

                    await prisma.competitor.upsert({
                        where: {
                            clientCode_domain: {
                                clientCode: comp.clientCode,
                                domain: comp.domain
                            }
                        },
                        update: {
                            brandName: comp.brandName,
                            competitionType: comp.competitionType,
                            label: comp.label,
                            notes: comp.notes,
                            isActive: comp.isActive ?? true,
                            updatedAt: new Date()
                        },
                        create: {
                            clientCode: comp.clientCode,
                            domain: comp.domain,
                            brandName: comp.brandName,
                            competitionType: comp.competitionType,
                            label: comp.label,
                            notes: comp.notes,
                            isActive: comp.isActive ?? true
                        }
                    });
                    results.competitors.success++;
                } catch (e: any) {
                    results.competitors.errors.push(`${comp.domain}: ${e.message}`);
                }
            }
        }

        // ========== VERIFICATION ==========
        results.verification = {
            clientAIProfiles: await prisma.clientAIProfile.count(),
            termDictionaries: await prisma.termDictionary.count(),
            dictionaryTerms: await prisma.dictionaryTerm.count(),
            competitors: await prisma.competitor.count(),
            bucketBreakdown: await prisma.dictionaryTerm.groupBy({
                by: ['bucket'],
                _count: { bucket: true }
            })
        };

        results.completed = new Date().toISOString();
        results.status = 'SUCCESS';

        return NextResponse.json(results, { status: 200 });

    } catch (error: any) {
        results.error = error.message;
        results.status = 'FAILED';
        return NextResponse.json(results, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
}
