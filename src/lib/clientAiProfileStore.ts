import { promises as fs } from 'fs';
import path from 'path';
import { ClientAIProfile } from '@/types';
import { PrismaClient, ClientAIProfile as PrismaAIProfile, TermDictionary, DictionaryTerm } from '@prisma/client';

const DATA_DIR = path.join(process.cwd(), 'data');
const AI_PROFILES_FILE = 'client_ai_profiles.json';

// Feature flag for PostgreSQL migration - set to true after migration is complete
const USE_POSTGRES = process.env.USE_POSTGRES_PROFILES === 'true';

// Prisma client singleton
let prisma: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

// ============================================
// JSON STORAGE (Legacy - for rollback)
// ============================================

async function readAiProfiles(): Promise<ClientAIProfile[]> {
  try {
    const filePath = path.join(DATA_DIR, AI_PROFILES_FILE);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as ClientAIProfile[];
  } catch (error) {
    return [];
  }
}

async function writeAiProfiles(profiles: ClientAIProfile[]): Promise<void> {
  const filePath = path.join(DATA_DIR, AI_PROFILES_FILE);
  await fs.writeFile(filePath, JSON.stringify(profiles, null, 2), 'utf-8');
}

// ============================================
// PRISMA STORAGE (PostgreSQL)
// ============================================

type PrismaProfileWithRelations = PrismaAIProfile & {
  termDictionary: (TermDictionary & { terms: DictionaryTerm[] }) | null;
};

function prismaToClientProfile(dbProfile: PrismaProfileWithRelations): ClientAIProfile {
  const terms = dbProfile.termDictionary?.terms || [];

  return {
    clientCode: dbProfile.clientCode,
    companyName: dbProfile.companyName,
    mainDomain: dbProfile.mainDomain || undefined,
    productCategories: dbProfile.productCategories as string[] | undefined,
    serviceOfferings: dbProfile.serviceOfferings as any,
    targetMarkets: dbProfile.targetMarkets as any,
    assistantInstructions: dbProfile.assistantInstructions || undefined,
    updatedAt: dbProfile.updatedAt.toISOString(),
    // Include additional profile data
    ...(dbProfile.profileData as object || {}),
    // Include term dictionary in expected format
    ai_kw_builder_term_dictionary: dbProfile.termDictionary ? {
      version: dbProfile.termDictionary.version,
      domain: dbProfile.termDictionary.domain || '',
      industryKey: dbProfile.termDictionary.industryKey || '',
      updatedAt: dbProfile.termDictionary.updatedAt.toISOString(),
      terms: terms.map(t => ({
        term: t.term,
        bucket: t.bucket,
        ngramType: t.ngramType,
        source: t.source || 'user',
        confidence: t.confidence,
        locked: t.locked
      }))
    } : undefined
  } as ClientAIProfile;
}

async function getAllAiProfilesFromPrisma(): Promise<ClientAIProfile[]> {
  const db = getPrisma();
  const profiles = await db.clientAIProfile.findMany({
    include: {
      termDictionary: {
        include: { terms: true }
      }
    }
  });
  return profiles.map(prismaToClientProfile);
}

async function getAiProfileByClientCodeFromPrisma(clientCode: string): Promise<ClientAIProfile | null> {
  const db = getPrisma();
  const profile = await db.clientAIProfile.findUnique({
    where: { clientCode },
    include: {
      termDictionary: {
        include: { terms: true }
      }
    }
  });
  return profile ? prismaToClientProfile(profile) : null;
}

async function saveAiProfileToPrisma(profile: ClientAIProfile): Promise<void> {
  const db = getPrisma();

  const {
    clientCode,
    companyName,
    mainDomain,
    productCategories,
    serviceOfferings,
    targetMarkets,
    assistantInstructions,
    ai_kw_builder_term_dictionary,
    ...otherData
  } = profile;

  // Upsert the profile
  const dbProfile = await db.clientAIProfile.upsert({
    where: { clientCode },
    update: {
      companyName: companyName || 'Unknown',
      mainDomain,
      productCategories: productCategories || undefined,
      serviceOfferings: serviceOfferings || undefined,
      targetMarkets: targetMarkets || undefined,
      assistantInstructions,
      profileData: Object.keys(otherData).length > 0 ? otherData : undefined,
      updatedAt: new Date()
    },
    create: {
      clientCode,
      companyName: companyName || 'Unknown',
      mainDomain,
      productCategories: productCategories || undefined,
      serviceOfferings: serviceOfferings || undefined,
      targetMarkets: targetMarkets || undefined,
      assistantInstructions,
      profileData: Object.keys(otherData).length > 0 ? otherData : undefined
    }
  });

  // Update term dictionary if provided
  if (ai_kw_builder_term_dictionary) {
    const terms = Array.isArray(ai_kw_builder_term_dictionary.terms)
      ? ai_kw_builder_term_dictionary.terms
      : Object.values(ai_kw_builder_term_dictionary.terms || {});

    // Delete existing dictionary (cascade deletes terms)
    await db.termDictionary.deleteMany({
      where: { profileId: dbProfile.id }
    });

    // Create new dictionary with terms
    if (terms.length > 0) {
      await db.termDictionary.create({
        data: {
          profileId: dbProfile.id,
          version: ai_kw_builder_term_dictionary.version || 1,
          domain: ai_kw_builder_term_dictionary.domain || mainDomain,
          industryKey: ai_kw_builder_term_dictionary.industryKey || 'general',
          terms: {
            create: terms
              .filter((t: any) => t.term)
              .map((t: any) => ({
                term: t.term,
                bucket: t.bucket || 'unassigned',
                ngramType: t.ngramType || 'full',
                source: t.source || 'user',
                confidence: t.confidence || 0,
                locked: t.locked || false
              }))
          }
        }
      });
    }
  }
}

async function deleteAiProfileFromPrisma(clientCode: string): Promise<boolean> {
  const db = getPrisma();
  try {
    await db.clientAIProfile.delete({
      where: { clientCode }
    });
    return true;
  } catch {
    return false;
  }
}

// ============================================
// EXPORTED FUNCTIONS (Switch based on feature flag)
// ============================================

export async function getAllAiProfiles(): Promise<ClientAIProfile[]> {
  if (USE_POSTGRES) {
    return getAllAiProfilesFromPrisma();
  }
  return readAiProfiles();
}

export async function getAiProfileByClientCode(clientCode: string): Promise<ClientAIProfile | null> {
  if (USE_POSTGRES) {
    return getAiProfileByClientCodeFromPrisma(clientCode);
  }
  const profiles = await readAiProfiles();
  return profiles.find(p => p.clientCode === clientCode) || null;
}

export async function saveAiProfile(profile: ClientAIProfile): Promise<void> {
  if (USE_POSTGRES) {
    await saveAiProfileToPrisma(profile);
    return;
  }

  // Legacy JSON storage
  const profiles = await readAiProfiles();
  const existingIndex = profiles.findIndex(p => p.clientCode === profile.clientCode);

  if (existingIndex >= 0) {
    profiles[existingIndex] = {
      ...profile,
      updatedAt: new Date().toISOString(),
    };
  } else {
    profiles.push(profile);
  }

  await writeAiProfiles(profiles);
}

export async function deleteAiProfile(clientCode: string): Promise<boolean> {
  if (USE_POSTGRES) {
    return deleteAiProfileFromPrisma(clientCode);
  }

  const profiles = await readAiProfiles();
  const filteredProfiles = profiles.filter(p => p.clientCode !== clientCode);

  if (filteredProfiles.length === profiles.length) {
    return false;
  }

  await writeAiProfiles(filteredProfiles);
  return true;
}
