/**
 * Bootstrap Footprint Registry
 * 
 * One-time script to populate the normalized footprint registry from:
 * 1. JSON registry file (82 surfaces with catalog metadata)
 * 2. CSV methods file (operational rules for scanning)
 * 
 * STRICT VALIDATION:
 * - Fails if duplicate surfaceKeys in CSV
 * - Fails if CSV keys != JSON keys
 * - Uses transaction for rule activation
 * 
 * Usage: npm run footprint:bootstrap
 */

import { PrismaClient, Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// --- Configuration ---
const REGISTRY_JSON_PATH = path.join(process.cwd(), 'data/Extra Files/footprint-registry (2).json');
const METHODS_CSV_PATH = path.join(process.cwd(), 'data/Extra Files/footprint_surface_methods_82_updated.csv');

// --- Types ---
interface RegistryEntry {
    id: string;
    surfaceKey: string;
    label: string;
    category: string;
    importanceTier: string;
    basePoints: number;
    defaultRelevanceWeight: number;
    sourceType: string;
    searchEngine: string | null;
    queryTemplates: string[];
    maxQueries: number;
    confirmationArtifact: string;
    presenceRules: Record<string, string> | null;
    officialnessRules: Record<string, string> | null;
    officialnessRequired: boolean;
    evidenceFields: string[] | null;
    tooltipTemplates: Record<string, string> | null;
    enabled: boolean;
    notes: string | null;
    industryOverrides: Record<string, number> | null;
    geoOverrides: Record<string, number> | null;
    launchYear: number | null;
    technicalName: string | null;
    businessImpact: { impactLevel?: string; absenceImpact?: string; partialImpact?: string } | null;
}

interface MethodsRow {
    surfaceKey: string;
    checkMode: string;
    crawlOnlyFeasible: string;
    canonicalInputNeeded: string;
    discoveryApproach: string;
    presenceLogic: string;
    partialLogic: string;
    evidenceProvider: string;
    dataforseoRecommended: string;
    dataforseoEndpoint: string;
    recommendedEvidenceArtifact: string;
    crawlFallbackIfNoDFS: string;
    metricsPossible: string;
    lastUpdatedExtraction: string;
    notes: string;
}

// --- CSV Parser ---
function parseCSV(content: string): MethodsRow[] {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]);
    const rows: MethodsRow[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (!values[0] || !values[0].trim()) continue; // Skip empty rows

        const row: Record<string, string> = {};
        headers.forEach((header, idx) => {
            row[header.trim()] = values[idx]?.trim() || '';
        });
        rows.push(row as unknown as MethodsRow);
    }

    return rows;
}

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);

    return result;
}

// --- Validation Functions ---
function validateInputs(
    registryData: RegistryEntry[],
    methodsRows: MethodsRow[]
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 1. Check for duplicates in CSV
    const csvKeyCount = new Map<string, number>();
    for (const row of methodsRows) {
        const key = row.surfaceKey.trim();
        csvKeyCount.set(key, (csvKeyCount.get(key) || 0) + 1);
    }

    const duplicates = Array.from(csvKeyCount.entries())
        .filter(([_, count]) => count > 1)
        .map(([key, count]) => `${key} (${count}x)`);

    if (duplicates.length > 0) {
        errors.push(`❌ DUPLICATE surfaceKeys in CSV:\n   ${duplicates.join('\n   ')}`);
    }

    // 2. Build key sets
    const jsonKeys = new Set(registryData.map(e => e.surfaceKey.trim()));
    const csvKeys = new Set(methodsRows.map(r => r.surfaceKey.trim()));

    // 3. Find CSV keys not in JSON
    const csvNotInJson = Array.from(csvKeys).filter(k => !jsonKeys.has(k));
    if (csvNotInJson.length > 0) {
        errors.push(`❌ CSV keys NOT in JSON registry:\n   ${csvNotInJson.join('\n   ')}`);
    }

    // 4. Find JSON keys not in CSV
    const jsonNotInCsv = Array.from(jsonKeys).filter(k => !csvKeys.has(k));
    if (jsonNotInCsv.length > 0) {
        errors.push(`❌ JSON keys NOT in CSV:\n   ${jsonNotInCsv.join('\n   ')}`);
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

// --- Main Bootstrap Function ---
async function bootstrap() {
    console.log('🚀 Starting Footprint Registry Bootstrap...\n');
    console.log('━'.repeat(50));

    // 1. Load JSON registry
    console.log(`📄 Loading registry JSON from:\n   ${REGISTRY_JSON_PATH}`);
    if (!fs.existsSync(REGISTRY_JSON_PATH)) {
        throw new Error(`Registry JSON not found: ${REGISTRY_JSON_PATH}`);
    }
    const registryData: RegistryEntry[] = JSON.parse(fs.readFileSync(REGISTRY_JSON_PATH, 'utf-8'));
    console.log(`   ✓ Found ${registryData.length} surfaces in JSON registry\n`);

    // 2. Load CSV methods
    console.log(`📄 Loading methods CSV from:\n   ${METHODS_CSV_PATH}`);
    if (!fs.existsSync(METHODS_CSV_PATH)) {
        throw new Error(`Methods CSV not found: ${METHODS_CSV_PATH}`);
    }
    const csvContent = fs.readFileSync(METHODS_CSV_PATH, 'utf-8');
    const methodsRows = parseCSV(csvContent);
    console.log(`   ✓ Found ${methodsRows.length} rows in methods CSV\n`);

    // 3. STRICT VALIDATION
    console.log('🔍 Validating inputs...');
    const validation = validateInputs(registryData, methodsRows);

    if (!validation.valid) {
        console.error('\n' + '━'.repeat(50));
        console.error('❌ VALIDATION FAILED\n');
        for (const error of validation.errors) {
            console.error(error + '\n');
        }
        console.error('━'.repeat(50));
        console.error('\nFix the above issues and re-run.\n');
        process.exit(1);
    }

    console.log('   ✓ VALIDATION OK: CSV keys == JSON keys');
    console.log(`   ✓ ${registryData.length} surfaces, ${methodsRows.length} rules, 0 duplicates\n`);

    // Create lookup map for CSV methods
    const methodsMap = new Map<string, MethodsRow>();
    for (const row of methodsRows) {
        methodsMap.set(row.surfaceKey.trim(), row);
    }

    // Counters
    let surfacesCreated = 0;
    let surfacesUpdated = 0;
    let rulesCreated = 0;
    let overridesCreated = 0;
    let playbooksCreated = 0;

    console.log('📊 Processing surfaces...\n');

    for (const entry of registryData) {
        const csvRow = methodsMap.get(entry.surfaceKey.trim());

        // Use transaction for atomic rule activation
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // 1. Upsert FootprintSurface (catalog)
            const surface = await tx.footprintSurface.upsert({
                where: { surfaceKey: entry.surfaceKey },
                create: {
                    surfaceKey: entry.surfaceKey,
                    label: entry.label,
                    category: entry.category,
                    importanceTier: entry.importanceTier,
                    basePoints: entry.basePoints,
                    defaultRelevanceWeight: entry.defaultRelevanceWeight,
                    enabled: entry.enabled,
                    tooltipTemplates: entry.tooltipTemplates || Prisma.DbNull,
                    notes: entry.notes,
                    launchYear: entry.launchYear,
                    technicalName: entry.technicalName,
                    businessImpact: entry.businessImpact || Prisma.DbNull,
                },
                update: {
                    label: entry.label,
                    category: entry.category,
                    importanceTier: entry.importanceTier,
                    basePoints: entry.basePoints,
                    defaultRelevanceWeight: entry.defaultRelevanceWeight,
                    enabled: entry.enabled,
                    tooltipTemplates: entry.tooltipTemplates || Prisma.DbNull,
                    notes: entry.notes,
                    launchYear: entry.launchYear,
                    technicalName: entry.technicalName,
                    businessImpact: entry.businessImpact || Prisma.DbNull,
                },
            });

            // 2. Get existing rules to determine version
            const existingRules = await tx.footprintSurfaceRule.findMany({
                where: { surfaceId: surface.id },
            });

            if (existingRules.length === 0) {
                surfacesCreated++;
            } else {
                surfacesUpdated++;
            }

            // 3. Deactivate any existing active rules (within transaction)
            await tx.footprintSurfaceRule.updateMany({
                where: { surfaceId: surface.id, isActive: true },
                data: { isActive: false },
            });

            // 4. Create new rule with next version
            const maxVersion = existingRules.length > 0
                ? Math.max(...existingRules.map((r: { ruleVersion: number }) => r.ruleVersion))
                : 0;
            const newVersion = maxVersion + 1;

            const rule = await tx.footprintSurfaceRule.create({
                data: {
                    surfaceId: surface.id,
                    ruleVersion: newVersion,
                    isActive: true,

                    // From JSON registry
                    sourceType: entry.sourceType,
                    searchEngine: entry.searchEngine,
                    queryTemplates: entry.queryTemplates,
                    maxQueries: entry.maxQueries,
                    confirmationArtifact: entry.confirmationArtifact || '',
                    presenceRules: entry.presenceRules || Prisma.DbNull,
                    officialnessRules: entry.officialnessRules || Prisma.DbNull,
                    officialnessRequired: entry.officialnessRequired,
                    evidenceFields: entry.evidenceFields || Prisma.DbNull,

                    // From CSV methods
                    checkMode: csvRow?.checkMode || null,
                    crawlOnlyFeasible: csvRow?.crawlOnlyFeasible || null,
                    canonicalInputNeeded: csvRow?.canonicalInputNeeded || null,
                    discoveryApproach: csvRow?.discoveryApproach || null,
                    presenceLogic: csvRow?.presenceLogic || null,
                    partialLogic: csvRow?.partialLogic || null,
                    evidenceProvider: csvRow?.evidenceProvider || null,
                    dataforseoRecommended: csvRow?.dataforseoRecommended === 'YES',
                    dataforseoEndpoint: csvRow?.dataforseoEndpoint || null,
                    recommendedEvidenceArtifact: csvRow?.recommendedEvidenceArtifact || null,
                    crawlFallbackIfNoDFS: csvRow?.crawlFallbackIfNoDFS || null,
                    metricsPossible: csvRow?.metricsPossible || null,
                    lastUpdatedExtraction: csvRow?.lastUpdatedExtraction || null,
                    ruleNotes: csvRow?.notes || null,
                },
            });
            rulesCreated++;

            // 5. Create overrides from geoOverrides/industryOverrides
            if (entry.geoOverrides) {
                for (const [key, multiplier] of Object.entries(entry.geoOverrides)) {
                    await tx.footprintSurfaceRuleOverride.create({
                        data: {
                            surfaceRuleId: rule.id,
                            overrideType: 'geo',
                            overrideKey: key,
                            multiplier: multiplier as number,
                        },
                    });
                    overridesCreated++;
                }
            }

            if (entry.industryOverrides) {
                for (const [key, multiplier] of Object.entries(entry.industryOverrides)) {
                    await tx.footprintSurfaceRuleOverride.create({
                        data: {
                            surfaceRuleId: rule.id,
                            overrideType: 'industry',
                            overrideKey: key,
                            multiplier: multiplier as number,
                        },
                    });
                    overridesCreated++;
                }
            }

            // 6. Auto-generate manual playbook for manual-required surfaces
            const needsPlaybook =
                entry.sourceType === 'MANUAL_REVIEW' ||
                csvRow?.crawlOnlyFeasible === 'NO' ||
                csvRow?.evidenceProvider === 'MANUAL' ||
                csvRow?.evidenceProvider === 'SERP_PROVIDER' ||
                csvRow?.evidenceProvider === 'OWNER_API';

            if (needsPlaybook) {
                const instructionParts: string[] = [];
                instructionParts.push(`# Verification Guide: ${entry.label}\n`);
                instructionParts.push(`**Surface Key:** \`${entry.surfaceKey}\`\n`);
                instructionParts.push(`**Source Type:** ${entry.sourceType}\n`);

                if (csvRow?.presenceLogic) {
                    instructionParts.push(`\n## How to Verify Presence\n${csvRow.presenceLogic}\n`);
                }

                if (csvRow?.partialLogic) {
                    instructionParts.push(`\n## What Counts as Partial\n${csvRow.partialLogic}\n`);
                }

                if (csvRow?.crawlFallbackIfNoDFS) {
                    instructionParts.push(`\n## Fallback Method\n${csvRow.crawlFallbackIfNoDFS}\n`);
                }

                instructionParts.push(`\n## Evidence Required\nUpload screenshot/URL as evidence.\n`);

                await tx.footprintSurfaceManualPlaybook.create({
                    data: {
                        surfaceRuleId: rule.id,
                        instructionsMarkdown: instructionParts.join(''),
                        requiredEvidence: {
                            fields: [
                                { name: 'url', type: 'url', required: false },
                                { name: 'screenshot', type: 'file', required: false },
                                { name: 'notes', type: 'text', required: true },
                            ],
                            uploadsAllowed: true,
                            screenshotRequired: false,
                        },
                        validationChecklist: [
                            'Verified presence on target platform',
                            'Confirmed brand/domain match',
                            'Captured screenshot or URL evidence',
                        ],
                        exampleQueries: entry.queryTemplates.length > 0 ? entry.queryTemplates : Prisma.DbNull,
                    },
                });
                playbooksCreated++;
            }
        });

        process.stdout.write('.');
    }

    console.log('\n\n' + '━'.repeat(50));
    console.log('✅ BOOTSTRAP COMPLETE!\n');
    console.log(`   📦 Surfaces created:  ${surfacesCreated}`);
    console.log(`   🔄 Surfaces updated:  ${surfacesUpdated}`);
    console.log(`   📋 Rules created:     ${rulesCreated}`);
    console.log(`   🎯 Overrides created: ${overridesCreated}`);
    console.log(`   📖 Playbooks created: ${playbooksCreated}`);
    console.log('\n   ✓ VALIDATION OK: CSV keys == JSON keys');
    console.log('━'.repeat(50) + '\n');
}

// --- Run ---
bootstrap()
    .catch((e) => {
        console.error('❌ Bootstrap failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
