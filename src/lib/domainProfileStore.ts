import { promises as fs } from 'fs';
import path from 'path';
import { DomainProfile } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const FILENAME = 'domainProfiles.json';

async function readData(): Promise<DomainProfile[]> {
  try {
    const filePath = path.join(DATA_DIR, FILENAME);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as DomainProfile[];
  } catch (error) {
    return [];
  }
}

async function writeData(data: DomainProfile[]): Promise<void> {
  const filePath = path.join(DATA_DIR, FILENAME);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function getDomainProfiles(): Promise<DomainProfile[]> {
  return readData();
}

export async function getDomainProfilesByClient(clientCode: string): Promise<DomainProfile[]> {
  const profiles = await readData();
  return profiles.filter(p => p.clientCode === clientCode);
}

export async function getDomainProfile(clientCode: string, domain: string): Promise<DomainProfile | undefined> {
  const profiles = await readData();
  const normalizedDomain = domain.toLowerCase().trim();
  return profiles.find(
    p => p.clientCode === clientCode && p.domain.toLowerCase().trim() === normalizedDomain
  );
}

export async function getDomainProfileById(id: string): Promise<DomainProfile | undefined> {
  const profiles = await readData();
  return profiles.find(p => p.id === id);
}

export async function createDomainProfile(profile: DomainProfile): Promise<DomainProfile> {
  const profiles = await readData();
  profiles.push(profile);
  await writeData(profiles);
  return profile;
}

export async function updateDomainProfile(id: string, updates: Partial<DomainProfile>): Promise<DomainProfile | null> {
  const profiles = await readData();
  const index = profiles.findIndex(p => p.id === id);
  if (index === -1) return null;
  profiles[index] = { ...profiles[index], ...updates, updatedAt: new Date().toISOString() };
  await writeData(profiles);
  return profiles[index];
}

export async function upsertDomainProfile(clientCode: string, domain: string, updates: Partial<DomainProfile>): Promise<DomainProfile> {
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
  const profiles = await readData();
  const filtered = profiles.filter(p => p.id !== id);
  if (filtered.length === profiles.length) return false;
  await writeData(filtered);
  return true;
}

export async function deleteDomainProfilesByClient(clientCode: string): Promise<number> {
  const profiles = await readData();
  const filtered = profiles.filter(p => p.clientCode !== clientCode);
  const deletedCount = profiles.length - filtered.length;
  await writeData(filtered);
  return deletedCount;
}
