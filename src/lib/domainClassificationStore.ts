import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { DomainClassification } from '@/types';

// Feature flag for PostgreSQL
const USE_POSTGRES_DOMAIN_CLASSIFICATIONS = process.env.USE_POSTGRES_DOMAIN_CLASSIFICATIONS === 'true';

// Prisma singleton
let prisma: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const CLASSIFICATIONS_FILE = path.join(DATA_DIR, 'domain_classifications.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readClassifications(): DomainClassification[] {
  // Use PostgreSQL when feature flag is enabled
  if (USE_POSTGRES_DOMAIN_CLASSIFICATIONS) {
    // Note: This is synchronous for backward compat - Prisma will be async
    // This function will be converted to async in future refactor
    console.warn('readClassifications called with PostgreSQL flag but needs async refactor');
  }

  ensureDataDir();
  if (!fs.existsSync(CLASSIFICATIONS_FILE)) {
    return [];
  }
  const data = fs.readFileSync(CLASSIFICATIONS_FILE, 'utf-8');
  return JSON.parse(data);
}

// Async version for PostgreSQL
async function readClassificationsAsync(): Promise<DomainClassification[]> {
  if (USE_POSTGRES_DOMAIN_CLASSIFICATIONS) {
    try {
      const db = getPrisma();
      const classifications = await db.domainClassification.findMany();
      return classifications.map(c => ({
        id: c.id,
        clientCode: c.clientCode,
        domain: c.domain,
        domainType: c.domainType || undefined,
        pageIntent: c.pageIntent || undefined,
        productMatchScoreValue: c.productMatchScoreValue ?? undefined,
        productMatchScoreBucket: c.productMatchScoreBucket || undefined,
        businessRelevanceCategory: c.businessRelevanceCategory || undefined,
        explanationLink: c.explanationLink || undefined,
        explanationSummary: c.explanationSummary || undefined,
        classifiedAt: c.classifiedAt?.toISOString() || undefined,
        updatedAt: c.updatedAt.toISOString()
      })) as DomainClassification[];
    } catch (e) {
      console.error('Failed to read classifications from PostgreSQL:', e);
      return [];
    }
  }

  return readClassifications();
}

function writeClassifications(classifications: DomainClassification[]) {
  ensureDataDir();
  fs.writeFileSync(CLASSIFICATIONS_FILE, JSON.stringify(classifications, null, 2));
}

export function getAllClassifications(): DomainClassification[] {
  return readClassifications();
}

export function getClassificationsByClientCode(clientCode: string): DomainClassification[] {
  const all = readClassifications();
  return all.filter(c => c.clientCode === clientCode);
}

export function getClassificationByDomain(clientCode: string, domain: string): DomainClassification | null {
  const all = readClassifications();
  const normalizedDomain = domain.toLowerCase().trim();
  return all.find(
    c => c.clientCode === clientCode && c.domain.toLowerCase().trim() === normalizedDomain
  ) || null;
}

export function saveClassification(classification: DomainClassification): void {
  const all = readClassifications();
  const normalizedDomain = classification.domain.toLowerCase().trim();

  const existingIndex = all.findIndex(
    c => c.clientCode === classification.clientCode &&
      c.domain.toLowerCase().trim() === normalizedDomain
  );

  if (existingIndex >= 0) {
    all[existingIndex] = {
      ...classification,
      updatedAt: new Date().toISOString(),
    };
  } else {
    all.push(classification);
  }

  writeClassifications(all);
}

export function saveClassifications(classifications: DomainClassification[]): void {
  const all = readClassifications();

  for (const classification of classifications) {
    const normalizedDomain = classification.domain.toLowerCase().trim();
    const existingIndex = all.findIndex(
      c => c.clientCode === classification.clientCode &&
        c.domain.toLowerCase().trim() === normalizedDomain
    );

    if (existingIndex >= 0) {
      all[existingIndex] = {
        ...classification,
        updatedAt: new Date().toISOString(),
      };
    } else {
      all.push(classification);
    }
  }

  writeClassifications(all);
}

export function deleteClassification(clientCode: string, domain: string): boolean {
  const all = readClassifications();
  const normalizedDomain = domain.toLowerCase().trim();

  const filtered = all.filter(
    c => !(c.clientCode === clientCode && c.domain.toLowerCase().trim() === normalizedDomain)
  );

  if (filtered.length < all.length) {
    writeClassifications(filtered);
    return true;
  }
  return false;
}

export function deleteClassificationsByClient(clientCode: string): number {
  const all = readClassifications();
  const filtered = all.filter(c => c.clientCode !== clientCode);
  const deletedCount = all.length - filtered.length;

  if (deletedCount > 0) {
    writeClassifications(filtered);
  }
  return deletedCount;
}
