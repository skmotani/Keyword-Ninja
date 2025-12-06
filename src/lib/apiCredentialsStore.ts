import { promises as fs } from 'fs';
import path from 'path';
import { ApiCredential } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const CREDENTIALS_FILE = 'api_credentials.json';

async function ensureDataDir(): Promise<void> {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

async function readCredentials(): Promise<ApiCredential[]> {
  try {
    await ensureDataDir();
    const filePath = path.join(DATA_DIR, CREDENTIALS_FILE);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as ApiCredential[];
  } catch {
    return [];
  }
}

async function writeCredentials(credentials: ApiCredential[]): Promise<void> {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, CREDENTIALS_FILE);
  await fs.writeFile(filePath, JSON.stringify(credentials, null, 2), 'utf-8');
}

export async function getApiCredentials(): Promise<ApiCredential[]> {
  return readCredentials();
}

export async function saveApiCredentials(credentials: ApiCredential[]): Promise<void> {
  await writeCredentials(credentials);
}

export async function addApiCredential(credential: Omit<ApiCredential, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiCredential> {
  const credentials = await readCredentials();
  const now = new Date().toISOString();
  const newCredential: ApiCredential = {
    ...credential,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  credentials.push(newCredential);
  await writeCredentials(credentials);
  return newCredential;
}

export async function updateApiCredential(id: string, updates: Partial<Omit<ApiCredential, 'id' | 'createdAt'>>): Promise<ApiCredential | null> {
  const credentials = await readCredentials();
  const index = credentials.findIndex(c => c.id === id);
  if (index === -1) return null;
  
  credentials[index] = {
    ...credentials[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await writeCredentials(credentials);
  return credentials[index];
}

export async function toggleApiCredentialActive(id: string): Promise<ApiCredential | null> {
  const credentials = await readCredentials();
  const index = credentials.findIndex(c => c.id === id);
  if (index === -1) return null;
  
  credentials[index] = {
    ...credentials[index],
    isActive: !credentials[index].isActive,
    updatedAt: new Date().toISOString(),
  };
  await writeCredentials(credentials);
  return credentials[index];
}

export async function deleteApiCredential(id: string): Promise<boolean> {
  const credentials = await readCredentials();
  const filtered = credentials.filter(c => c.id !== id);
  if (filtered.length === credentials.length) return false;
  await writeCredentials(filtered);
  return true;
}

export async function getActiveCredentialByService(
  serviceType: ApiCredential['serviceType'],
  clientCode?: string
): Promise<ApiCredential | null> {
  const credentials = await readCredentials();
  
  const matches = credentials.filter(c => 
    c.serviceType === serviceType && 
    c.isActive === true &&
    (!c.clientCode || c.clientCode === clientCode)
  );
  
  if (matches.length === 0) return null;
  
  const clientSpecific = matches.find(c => c.clientCode === clientCode);
  if (clientSpecific) return clientSpecific;
  
  const global = matches.find(c => !c.clientCode);
  return global || matches[0];
}

export function maskValue(value: string, visibleChars: number = 4): string {
  if (!value || value.length <= visibleChars) return '****';
  return '****' + value.slice(-visibleChars);
}
