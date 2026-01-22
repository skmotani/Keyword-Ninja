/**
 * Phase 1 Migration Script: JSON → PostgreSQL
 * 
 * Migrates:
 * - client_ai_profiles.json → ClientAIProfile, TermDictionary, DictionaryTerm
 * - competitors.json → Competitor
 * 
 * Run with: npx ts-node scripts/migrate-phase1.ts
 * 
 * SAFETY:
 * - Does not delete JSON files
 * - Logs all operations
 * - Can be run multiple times (upserts)
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const DATA_DIR = path.join(process.cwd(), 'data');

interface JsonProfile {
    clientCode: string;
    companyName: string;
    mainDomain?: string;
    productCategories?: string[];
    serviceOfferings?: any;
    targetMarkets?: any;
    assistantInstructions?: string;
    ai_kw_builder_term_dictionary?: {
        version?: number;
        domain?: string;
        industryKey?: string;
        terms?: Array<{
            term: string;
            bucket: string;
            ngramType?: string;
            source?: string;
            confidence?: number;
            locked?: boolean;
        }>;
    };
    [key: string]: any;
}

interface JsonCompetitor {
    clientCode: string;
    domain: string;
    brandName?: string;
    competitionType?: string;
    label?: string;
    notes?: string;
    isActive?: boolean;
}

async function migrateClientAIProfiles() {
    console.log('\n=== Migrating Client AI Profiles ===');

    const filePath = path.join(DATA_DIR, 'client_ai_profiles.json');
    if (!fs.existsSync(filePath)) {
        console.log('❌ client_ai_profiles.json not found');
        return { profiles: 0, dictionaries: 0, terms: 0 };
    }

    const profiles: JsonProfile[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    console.log(`📂 Found ${profiles.length} profiles to migrate`);

    let profileCount = 0;
    let dictionaryCount = 0;
    let termCount = 0;

    for (const profile of profiles) {
        try {
            // Check if client exists in Client table
            const client = await prisma.client.findUnique({
                where: { code: profile.clientCode }
            });

            if (!client) {
                console.log(`⚠️ Client ${profile.clientCode} not found in Client table - skipping profile`);
                continue;
            }

            // Extract dictionary before creating profile
            const dictionary = profile.ai_kw_builder_term_dictionary;
            const terms = Array.isArray(dictionary?.terms)
                ? dictionary.terms
                : Object.values(dictionary?.terms || {});

            // Create profileData without the dictionary (it goes in separate table)
            const { ai_kw_builder_term_dictionary, clientCode, companyName, mainDomain,
                productCategories, serviceOfferings, targetMarkets, assistantInstructions,
                ...otherProfileData } = profile;

            // Upsert ClientAIProfile
            const dbProfile = await prisma.clientAIProfile.upsert({
                where: { clientCode: profile.clientCode },
                update: {
                    companyName: companyName || 'Unknown',
                    mainDomain,
                    productCategories: productCategories || null,
                    serviceOfferings: serviceOfferings || null,
                    targetMarkets: targetMarkets || null,
                    assistantInstructions,
                    profileData: Object.keys(otherProfileData).length > 0 ? otherProfileData : null,
                    updatedAt: new Date()
                },
                create: {
                    clientCode: profile.clientCode,
                    companyName: companyName || 'Unknown',
                    mainDomain,
                    productCategories: productCategories || null,
                    serviceOfferings: serviceOfferings || null,
                    targetMarkets: targetMarkets || null,
                    assistantInstructions,
                    profileData: Object.keys(otherProfileData).length > 0 ? otherProfileData : null
                }
            });
            profileCount++;
            console.log(`  ✅ Profile: ${profile.clientCode} (${companyName})`);

            // Migrate term dictionary if exists
            if (terms.length > 0) {
                // Delete existing dictionary and terms (cascade delete)
                await prisma.termDictionary.deleteMany({
                    where: { profileId: dbProfile.id }
                });

                // Create new dictionary
                const dbDictionary = await prisma.termDictionary.create({
                    data: {
                        profileId: dbProfile.id,
                        version: dictionary?.version || 1,
                        domain: dictionary?.domain || mainDomain,
                        industryKey: dictionary?.industryKey || 'general'
                    }
                });
                dictionaryCount++;

                // Batch insert terms (for performance)
                const termData = terms.map((t: any) => ({
                    dictionaryId: dbDictionary.id,
                    term: t.term || t.name || '',
                    bucket: t.bucket || 'unassigned',
                    ngramType: t.ngramType || 'full',
                    source: t.source || 'user',
                    confidence: t.confidence || 0,
                    locked: t.locked || false
                })).filter((t: any) => t.term); // Filter out empty terms

                if (termData.length > 0) {
                    await prisma.dictionaryTerm.createMany({
                        data: termData,
                        skipDuplicates: true
                    });
                    termCount += termData.length;
                    console.log(`     📚 Dictionary: ${termData.length} terms`);
                }
            }

        } catch (error) {
            console.error(`  ❌ Error migrating ${profile.clientCode}:`, error);
        }
    }

    return { profiles: profileCount, dictionaries: dictionaryCount, terms: termCount };
}

async function migrateCompetitors() {
    console.log('\n=== Migrating Competitors ===');

    const filePath = path.join(DATA_DIR, 'competitors.json');
    if (!fs.existsSync(filePath)) {
        console.log('❌ competitors.json not found');
        return { competitors: 0 };
    }

    const competitors: JsonCompetitor[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    console.log(`📂 Found ${competitors.length} competitors to migrate`);

    let count = 0;
    const errors: string[] = [];

    for (const comp of competitors) {
        try {
            // Check if client exists
            const client = await prisma.client.findUnique({
                where: { code: comp.clientCode }
            });

            if (!client) {
                errors.push(`Client ${comp.clientCode} not found`);
                continue;
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
            count++;
        } catch (error) {
            errors.push(`${comp.domain}: ${error}`);
        }
    }

    if (errors.length > 0) {
        console.log(`⚠️ ${errors.length} errors (first 5):`);
        errors.slice(0, 5).forEach(e => console.log(`   - ${e}`));
    }

    console.log(`  ✅ Migrated ${count} competitors`);
    return { competitors: count };
}

async function main() {
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║  Phase 1 Migration: JSON → PostgreSQL          ║');
    console.log('║  Started:', new Date().toISOString(), '       ║');
    console.log('╚════════════════════════════════════════════════╝');

    try {
        const profileResults = await migrateClientAIProfiles();
        const competitorResults = await migrateCompetitors();

        console.log('\n╔════════════════════════════════════════════════╗');
        console.log('║  MIGRATION SUMMARY                              ║');
        console.log('╠════════════════════════════════════════════════╣');
        console.log(`║  Profiles:      ${profileResults.profiles.toString().padEnd(30)}║`);
        console.log(`║  Dictionaries:  ${profileResults.dictionaries.toString().padEnd(30)}║`);
        console.log(`║  Terms:         ${profileResults.terms.toString().padEnd(30)}║`);
        console.log(`║  Competitors:   ${competitorResults.competitors.toString().padEnd(30)}║`);
        console.log('╚════════════════════════════════════════════════╝');

        // Verification queries
        console.log('\n=== Verification ===');
        const dbProfiles = await prisma.clientAIProfile.count();
        const dbDictionaries = await prisma.termDictionary.count();
        const dbTerms = await prisma.dictionaryTerm.count();
        const dbCompetitors = await prisma.competitor.count();

        console.log(`Database counts after migration:`);
        console.log(`  ClientAIProfile: ${dbProfiles}`);
        console.log(`  TermDictionary: ${dbDictionaries}`);
        console.log(`  DictionaryTerm: ${dbTerms}`);
        console.log(`  Competitor: ${dbCompetitors}`);

        // Bucket breakdown
        const bucketCounts = await prisma.dictionaryTerm.groupBy({
            by: ['bucket'],
            _count: { bucket: true }
        });
        console.log(`\nTerm bucket breakdown:`);
        bucketCounts.forEach(b => {
            console.log(`  ${b.bucket}: ${b._count.bucket}`);
        });

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
