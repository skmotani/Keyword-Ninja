import { promises as fs } from 'fs';
import path from 'path';
import { DomainProfile, TopKeywordEntry } from '@/types';
import { prisma } from '@/lib/prisma';

const USE_POSTGRES = process.env.USE_POSTGRES_DOMAIN_PROFILES === 'true';
const DATA_DIR = path.join(process.cwd(), 'data');
const FILENAME = 'domainProfiles.json';

async function readData(): Promise<DomainProfile[]> {
  if (USE_POSTGRES) {
    const records = await (prisma.domainProfile as any).findMany();
    return records.map(r => ({
      id: r.id,
      clientCode: r.clientCode,
      domain: r.domain,
      title: r.title,
      metaDescription: r.metaDescription,
      inferredCategory: r.inferredCategory,
      topKeywords: (r.topKeywords as unknown as TopKeywordEntry[]) ?? [],
      organicTraffic: r.organicTraffic,
      organicKeywordsCount: r.organicKeywordsCount,
      backlinksCount: r.backlinksCount,
      referringDomainsCount: r.referringDomainsCount,
      domainRank: r.domainRank,
      fetchStatus: r.fetchStatus as any ?? 'pending',
      errorMessage: r.errorMessage,
      lastFetchedAt: r.lastFetchedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }
  try {
    const filePath = path.join(DATA_DIR, FILENAME);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as DomainProfile[];
  } catch (error) {
    return [];
  }
}

async function writeData(data: DomainProfile[]): Promise<void> {
  if (USE_POSTGRES) return; // PostgreSQL handles writes individually
  const filePath = path.join(DATA_DIR, FILENAME);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function getDomainProfiles(): Promise<DomainProfile[]> {
  return readData();
}

export async function getDomainProfilesByClient(clientCode: string): Promise<DomainProfile[]> {
  if (USE_POSTGRES) {
    const records = await (prisma.domainProfile as any).findMany({ where: { clientCode } });
    return records.map(r => ({
      id: r.id,
      clientCode: r.clientCode,
      domain: r.domain,
      title: r.title,
      metaDescription: r.metaDescription,
      inferredCategory: r.inferredCategory,
      topKeywords: (r.topKeywords as unknown as TopKeywordEntry[]) ?? [],
      organicTraffic: r.organicTraffic,
      organicKeywordsCount: r.organicKeywordsCount,
      backlinksCount: r.backlinksCount,
      referringDomainsCount: r.referringDomainsCount,
      domainRank: r.domainRank,
      fetchStatus: r.fetchStatus as any ?? 'pending',
      errorMessage: r.errorMessage,
      lastFetchedAt: r.lastFetchedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }
  const profiles = await readData();
  return profiles.filter(p => p.clientCode === clientCode);
}

export async function getDomainProfile(clientCode: string, domain: string): Promise<DomainProfile | undefined> {
  if (USE_POSTGRES) {
    const normalizedDomain = domain.toLowerCase().trim();
    const record = await (prisma.domainProfile as any).findFirst({
      where: { clientCode, domain: { equals: normalizedDomain, mode: 'insensitive' } }
    });
    if (!record) return undefined;
    return {
      id: record.id,
      clientCode: record.clientCode,
      domain: record.domain,
      title: record.title,
      metaDescription: record.metaDescription,
      inferredCategory: record.inferredCategory,
      topKeywords: (record.topKeywords as unknown as TopKeywordEntry[]) ?? [],
      organicTraffic: record.organicTraffic,
      organicKeywordsCount: record.organicKeywordsCount,
      backlinksCount: record.backlinksCount,
      referringDomainsCount: record.referringDomainsCount,
      domainRank: record.domainRank,
      fetchStatus: record.fetchStatus as any ?? 'pending',
      errorMessage: record.errorMessage,
      lastFetchedAt: record.lastFetchedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
  const profiles = await readData();
  const normalizedDomain = domain.toLowerCase().trim();
  return profiles.find(
    p => p.clientCode === clientCode && p.domain.toLowerCase().trim() === normalizedDomain
  );
}

export async function getDomainProfileById(id: string): Promise<DomainProfile | undefined> {
  if (USE_POSTGRES) {
    const record = await (prisma.domainProfile as any).findUnique({ where: { id } });
    if (!record) return undefined;
    return {
      id: record.id,
      clientCode: record.clientCode,
      domain: record.domain,
      title: record.title,
      metaDescription: record.metaDescription,
      inferredCategory: record.inferredCategory,
      topKeywords: (record.topKeywords as unknown as TopKeywordEntry[]) ?? [],
      organicTraffic: record.organicTraffic,
      organicKeywordsCount: record.organicKeywordsCount,
      backlinksCount: record.backlinksCount,
      referringDomainsCount: record.referringDomainsCount,
      domainRank: record.domainRank,
      fetchStatus: record.fetchStatus as any ?? 'pending',
      errorMessage: record.errorMessage,
      lastFetchedAt: record.lastFetchedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
  const profiles = await readData();
  return profiles.find(p => p.id === id);
}

export async function createDomainProfile(profile: DomainProfile): Promise<DomainProfile> {
  if (USE_POSTGRES) {
    await (prisma.domainProfile as any).create({
      data: {
        id: profile.id,
        clientCode: profile.clientCode,
        domain: profile.domain,
        title: profile.title,
        metaDescription: profile.metaDescription,
        inferredCategory: profile.inferredCategory,
        topKeywords: profile.topKeywords as any,
        organicTraffic: profile.organicTraffic,
        organicKeywordsCount: profile.organicKeywordsCount,
        backlinksCount: profile.backlinksCount,
        referringDomainsCount: profile.referringDomainsCount,
        domainRank: profile.domainRank,
        fetchStatus: profile.fetchStatus,
        errorMessage: profile.errorMessage,
        lastFetchedAt: profile.lastFetchedAt,
      }
    });
    return profile;
  }
  const profiles = await readData();
  profiles.push(profile);
  await writeData(profiles);
  return profile;
}

export async function updateDomainProfile(id: string, updates: Partial<DomainProfile>): Promise<DomainProfile | null> {
  if (USE_POSTGRES) {
    const record = await (prisma.domainProfile as any).update({
      where: { id },
      data: {
        ...updates,
        topKeywords: updates.topKeywords as any,
        updatedAt: new Date(),
      }
    });
    return {
      id: record.id,
      clientCode: record.clientCode,
      domain: record.domain,
      title: record.title,
      metaDescription: record.metaDescription,
      inferredCategory: record.inferredCategory,
      topKeywords: (record.topKeywords as unknown as TopKeywordEntry[]) ?? [],
      organicTraffic: record.organicTraffic,
      organicKeywordsCount: record.organicKeywordsCount,
      backlinksCount: record.backlinksCount,
      referringDomainsCount: record.referringDomainsCount,
      domainRank: record.domainRank,
      fetchStatus: record.fetchStatus as any ?? 'pending',
      errorMessage: record.errorMessage,
      lastFetchedAt: record.lastFetchedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
  const profiles = await readData();
  const index = profiles.findIndex(p => p.id === id);
  if (index === -1) return null;
  profiles[index] = { ...profiles[index], ...updates, updatedAt: new Date().toISOString() };
  await writeData(profiles);
  return profiles[index];
}

export async function upsertDomainProfile(clientCode: string, domain: string, updates: Partial<DomainProfile>): Promise<DomainProfile> {
  if (USE_POSTGRES) {
    const normalizedDomain = domain.toLowerCase().trim();
    const existing = await (prisma.domainProfile as any).findFirst({
      where: { clientCode, domain: { equals: normalizedDomain, mode: 'insensitive' } }
    });

    if (existing) {
      const record = await (prisma.domainProfile as any).update({
        where: { id: existing.id },
        data: { ...updates, topKeywords: updates.topKeywords as any, updatedAt: new Date() }
      });
      return {
        id: record.id,
        clientCode: record.clientCode,
        domain: record.domain,
        title: record.title,
        metaDescription: record.metaDescription,
        inferredCategory: record.inferredCategory,
        topKeywords: (record.topKeywords as unknown as TopKeywordEntry[]) ?? [],
        organicTraffic: record.organicTraffic,
        organicKeywordsCount: record.organicKeywordsCount,
        backlinksCount: record.backlinksCount,
        referringDomainsCount: record.referringDomainsCount,
        domainRank: record.domainRank,
        fetchStatus: record.fetchStatus as any ?? 'pending',
        errorMessage: record.errorMessage,
        lastFetchedAt: record.lastFetchedAt?.toISOString() ?? null,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      };
    } else {
      const newId = crypto.randomUUID();
      const record = await (prisma.domainProfile as any).create({
        data: {
          id: newId,
          clientCode,
          domain,
          title: updates.title ?? null,
          metaDescription: updates.metaDescription ?? null,
          inferredCategory: updates.inferredCategory ?? null,
          topKeywords: (updates.topKeywords ?? []) as any,
          organicTraffic: updates.organicTraffic ?? null,
          organicKeywordsCount: updates.organicKeywordsCount ?? null,
          backlinksCount: updates.backlinksCount ?? null,
          referringDomainsCount: updates.referringDomainsCount ?? null,
          domainRank: updates.domainRank ?? null,
          fetchStatus: updates.fetchStatus ?? 'pending',
          errorMessage: updates.errorMessage ?? null,
          lastFetchedAt: updates.lastFetchedAt ?? null,
        }
      });
      return {
        id: record.id,
        clientCode: record.clientCode,
        domain: record.domain,
        title: record.title,
        metaDescription: record.metaDescription,
        inferredCategory: record.inferredCategory,
        topKeywords: (record.topKeywords as unknown as TopKeywordEntry[]) ?? [],
        organicTraffic: record.organicTraffic,
        organicKeywordsCount: record.organicKeywordsCount,
        backlinksCount: record.backlinksCount,
        referringDomainsCount: record.referringDomainsCount,
        domainRank: record.domainRank,
        fetchStatus: record.fetchStatus as any ?? 'pending',
        errorMessage: record.errorMessage,
        lastFetchedAt: record.lastFetchedAt?.toISOString() ?? null,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      };
    }
  }

  const profiles = await readData();
  const normalizedDomain = domain.toLowerCase().trim();
  const index = profiles.findIndex(
    p => p.clientCode === clientCode && p.domain.toLowerCase().trim() === normalizedDomain
  );

  const now = new Date().toISOString();

  if (index === -1) {
    const newProfile: DomainProfile = {
      id: crypto.randomUUID(),
      clientCode,
      domain,
      title: null,
      metaDescription: null,
      inferredCategory: null,
      topKeywords: [],
      organicTraffic: null,
      organicKeywordsCount: null,
      backlinksCount: null,
      referringDomainsCount: null,
      domainRank: null,
      fetchStatus: 'pending',
      errorMessage: null,
      lastFetchedAt: null,
      createdAt: now,
      updatedAt: now,
      ...updates
    };
    profiles.push(newProfile);
    await writeData(profiles);
    return newProfile;
  } else {
    profiles[index] = { ...profiles[index], ...updates, updatedAt: now };
    await writeData(profiles);
    return profiles[index];
  }
}

export async function deleteDomainProfile(id: string): Promise<boolean> {
  if (USE_POSTGRES) {
    try {
      await (prisma.domainProfile as any).delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
  const profiles = await readData();
  const filtered = profiles.filter(p => p.id !== id);
  if (filtered.length === profiles.length) return false;
  await writeData(filtered);
  return true;
}

export async function deleteDomainProfilesByClient(clientCode: string): Promise<number> {
  if (USE_POSTGRES) {
    const result = await (prisma.domainProfile as any).deleteMany({ where: { clientCode } });
    return result.count;
  }
  const profiles = await readData();
  const filtered = profiles.filter(p => p.clientCode !== clientCode);
  const deletedCount = profiles.length - filtered.length;
  await writeData(filtered);
  return deletedCount;
}

