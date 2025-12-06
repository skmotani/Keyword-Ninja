import { promises as fs } from 'fs';
import path from 'path';
import { ApiCredential } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const CREDENTIALS_FILE = 'api_credentials.json';

async function readCredentials(): Promise<ApiCredential[]> {
  try {
    const filePath = path.join(DATA_DIR, CREDENTIALS_FILE);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as ApiCredential[];
  } catch (error) {
    return [];
  }
}

async function writeCredentials(credentials: ApiCredential[]): Promise<void> {
  const filePath = path.join(DATA_DIR, CREDENTIALS_FILE);
  await fs.writeFile(filePath, JSON.stringify(credentials, null, 2), 'utf-8');
}

export async function getApiCredentials(): Promise<ApiCredential[]> {
  return readCredentials();
}

export async function getActiveCredentialByServiceType(serviceType: string): Promise<ApiCredential | null> {
  const credentials = await readCredentials();
  const credential = credentials.find(c => c.serviceType === serviceType && c.isActive);
  return credential || null;
}

export async function createApiCredential(credential: ApiCredential): Promise<ApiCredential> {
  const credentials = await readCredentials();
  credentials.push(credential);
  await writeCredentials(credentials);
  return credential;
}

export async function updateApiCredential(id: string, updates: Partial<ApiCredential>): Promise<ApiCredential | null> {
  const credentials = await readCredentials();
  const index = credentials.findIndex(c => c.id === id);
  if (index === -1) return null;
  credentials[index] = { ...credentials[index], ...updates, updatedAt: new Date().toISOString() };
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
