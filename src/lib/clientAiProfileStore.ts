import { promises as fs } from 'fs';
import path from 'path';
import { ClientAIProfile } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const AI_PROFILES_FILE = 'client_ai_profiles.json';

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

export async function getAllAiProfiles(): Promise<ClientAIProfile[]> {
  return readAiProfiles();
}

export async function getAiProfileByClientCode(clientCode: string): Promise<ClientAIProfile | null> {
  const profiles = await readAiProfiles();
  return profiles.find(p => p.clientCode === clientCode) || null;
}

export async function saveAiProfile(profile: ClientAIProfile): Promise<void> {
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
  const profiles = await readAiProfiles();
  const filteredProfiles = profiles.filter(p => p.clientCode !== clientCode);
  
  if (filteredProfiles.length === profiles.length) {
    return false;
  }
  
  await writeAiProfiles(filteredProfiles);
  return true;
}
