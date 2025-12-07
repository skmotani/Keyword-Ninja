import fs from 'fs';
import path from 'path';
import { DomainClassification } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const CLASSIFICATIONS_FILE = path.join(DATA_DIR, 'domain_classifications.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readClassifications(): DomainClassification[] {
  ensureDataDir();
  if (!fs.existsSync(CLASSIFICATIONS_FILE)) {
    return [];
  }
  const data = fs.readFileSync(CLASSIFICATIONS_FILE, 'utf-8');
  return JSON.parse(data);
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
