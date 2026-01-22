import { promises as fs } from 'fs';
import path from 'path';
import { Client, Competitor, ManualKeyword } from '@/types';
import { PrismaClient, Competitor as PrismaCompetitor } from '@prisma/client';

const DATA_DIR = path.join(process.cwd(), 'data');

// Feature flag for PostgreSQL migration  
const USE_POSTGRES_COMPETITORS = process.env.USE_POSTGRES_COMPETITORS === 'true';

// Prisma singleton
let prisma: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

// Convert Prisma competitor to app type
function prismaToCompetitor(pc: PrismaCompetitor): Competitor {
  return {
    id: pc.id,
    domain: pc.domain,
    clientCode: pc.clientCode,
    brandName: pc.brandName || undefined,
    competitionType: pc.competitionType || undefined,
    label: pc.label || undefined,
    notes: pc.notes || undefined,
    source: 'PostgreSQL',
    createdAt: pc.createdAt.toISOString(),
    updatedAt: pc.updatedAt.toISOString()
  } as Competitor;
}



async function readJsonFile<T>(filename: string): Promise<T[]> {
  try {
    const filePath = path.join(DATA_DIR, filename);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as T[];
  } catch (error) {
    return [];
  }
}

async function writeJsonFile<T>(filename: string, data: T[]): Promise<void> {
  const filePath = path.join(DATA_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function getClients(): Promise<Client[]> {
  return readJsonFile<Client>('clients.json');
}

export async function getClient(id: string): Promise<Client | undefined> {
  const clients = await getClients();
  return clients.find(c => c.id === id);
}

export async function createClient(client: Client): Promise<Client> {
  const clients = await getClients();
  clients.push(client);
  await writeJsonFile('clients.json', clients);
  return client;
}

export async function updateClient(id: string, updates: Partial<Client>): Promise<Client | null> {
  const clients = await getClients();
  const index = clients.findIndex(c => c.id === id);
  if (index === -1) return null;
  clients[index] = { ...clients[index], ...updates };
  await writeJsonFile('clients.json', clients);
  return clients[index];
}

export async function deleteClient(id: string): Promise<boolean> {
  const clients = await getClients();
  const filteredClients = clients.filter(c => c.id !== id);
  if (filteredClients.length === clients.length) return false;
  await writeJsonFile('clients.json', filteredClients);
  return true;
}

export async function getCompetitors(): Promise<Competitor[]> {
  const competitors = await readJsonFile<Competitor>('competitors.json');
  return competitors.map(c => ({
    ...c,
    source: c.source || 'Manual Entry',
  }));
}

export async function getCompetitor(id: string): Promise<Competitor | undefined> {
  const competitors = await getCompetitors();
  return competitors.find(c => c.id === id);
}

export async function createCompetitor(competitor: Competitor): Promise<Competitor> {
  const competitors = await getCompetitors();
  competitors.push(competitor);
  await writeJsonFile('competitors.json', competitors);
  return competitor;
}

export async function updateCompetitor(id: string, updates: Partial<Competitor>): Promise<Competitor | null> {
  const competitors = await getCompetitors();
  const index = competitors.findIndex(c => c.id === id);
  if (index === -1) return null;
  competitors[index] = { ...competitors[index], ...updates };
  await writeJsonFile('competitors.json', competitors);
  return competitors[index];
}

export async function deleteCompetitor(id: string): Promise<boolean> {
  const competitors = await getCompetitors();
  const filteredCompetitors = competitors.filter(c => c.id !== id);
  if (filteredCompetitors.length === competitors.length) return false;
  await writeJsonFile('competitors.json', filteredCompetitors);
  return true;
}

export async function getManualKeywords(): Promise<ManualKeyword[]> {
  const keywords = await readJsonFile<ManualKeyword>('manualKeywords.json');
  return keywords.map(k => ({
    ...k,
    source: k.source || 'Manual Entry',
  }));
}

export async function getManualKeyword(id: string): Promise<ManualKeyword | undefined> {
  const keywords = await getManualKeywords();
  return keywords.find(k => k.id === id);
}

export async function createManualKeyword(keyword: ManualKeyword): Promise<ManualKeyword> {
  const keywords = await getManualKeywords();
  keywords.push(keyword);
  await writeJsonFile('manualKeywords.json', keywords);
  return keyword;
}

export async function updateManualKeyword(id: string, updates: Partial<ManualKeyword>): Promise<ManualKeyword | null> {
  const keywords = await getManualKeywords();
  const index = keywords.findIndex(k => k.id === id);
  if (index === -1) return null;
  keywords[index] = { ...keywords[index], ...updates };
  await writeJsonFile('manualKeywords.json', keywords);
  return keywords[index];
}


export async function deleteManualKeyword(id: string): Promise<boolean> {
  const keywords = await getManualKeywords();
  const filteredKeywords = keywords.filter(k => k.id !== id);
  if (filteredKeywords.length === keywords.length) return false;
  await writeJsonFile('manualKeywords.json', filteredKeywords);
  return true;
}

// Page Config Persistence
export interface PageComment {
  id: string;
  text: string;
  status?: 'pending' | 'completed'; // Added for task tracking
  createdAt: string;
  updatedAt: string;
}

export interface PageConfig {
  path: string; // The URL path acts as the ID
  userDescription?: string;
  comments?: PageComment[];
  updatedAt: string;
}

export async function getPageConfigs(): Promise<PageConfig[]> {
  return readJsonFile<PageConfig>('pageConfigs.json');
}

export async function getPageConfig(path: string): Promise<PageConfig | undefined> {
  const configs = await getPageConfigs();
  return configs.find(c => c.path === path);
}

const pageConfigLock = { locked: false };
async function acquireLock() {
  while (pageConfigLock.locked) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  pageConfigLock.locked = true;
}
function releaseLock() {
  pageConfigLock.locked = false;
}

export async function savePageConfig(config: PageConfig): Promise<PageConfig> {
  await acquireLock();
  try {
    const configs = await getPageConfigs();
    const index = configs.findIndex(c => c.path === config.path);

    if (index >= 0) {
      configs[index] = { ...configs[index], ...config, updatedAt: new Date().toISOString() };
    } else {
      configs.push({ ...config, updatedAt: new Date().toISOString() });
    }

    await writeJsonFile('pageConfigs.json', configs);
    return index >= 0 ? configs[index] : configs[configs.length - 1];
  } finally {
    releaseLock();
  }
}
