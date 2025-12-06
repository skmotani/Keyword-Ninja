import { promises as fs } from 'fs';
import path from 'path';
import { SerpResult } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const SERP_DATA_FILE = 'serp_results.json';
const SERP_LOGS_DIR = path.join(DATA_DIR, 'serp_logs');

async function ensureSerpLogsDir(): Promise<void> {
  try {
    await fs.access(SERP_LOGS_DIR);
  } catch {
    await fs.mkdir(SERP_LOGS_DIR, { recursive: true });
  }
}

async function readSerpData(): Promise<SerpResult[]> {
  try {
    const filePath = path.join(DATA_DIR, SERP_DATA_FILE);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as SerpResult[];
  } catch (error) {
    return [];
  }
}

async function writeSerpData(records: SerpResult[]): Promise<void> {
  const filePath = path.join(DATA_DIR, SERP_DATA_FILE);
  await fs.writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8');
}

export async function getSerpData(): Promise<SerpResult[]> {
  return readSerpData();
}

export async function getSerpDataByClientAndLocations(
  clientCode: string,
  locationCodes: number[]
): Promise<SerpResult[]> {
  const records = await readSerpData();
  return records.filter(r => r.clientCode === clientCode && locationCodes.includes(r.locationCode));
}

const STRING_TO_NUMERIC: Record<string, number> = {
  'IN': 2356, 'India': 2356, 'in': 2356,
  'GL': 2840, 'US': 2840, 'Global': 2840, 'gl': 2840, 'us': 2840,
  'UK': 2826, 'uk': 2826,
  'AU': 2036, 'au': 2036,
  'CA': 2124, 'ca': 2124,
};

function canonicalizeLocationCode(locCode: number | string): number {
  if (typeof locCode === 'number') {
    return locCode;
  }
  const numericEquiv = STRING_TO_NUMERIC[locCode];
  if (numericEquiv) {
    return numericEquiv;
  }
  const parsed = parseInt(locCode, 10);
  return isNaN(parsed) ? 0 : parsed;
}

export async function replaceSerpDataForClientAndLocations(
  clientCode: string,
  locationCodes: number[],
  newRecords: SerpResult[]
): Promise<void> {
  const allRecords = await readSerpData();
  
  const canonicalizedLocationCodes = locationCodes.map(lc => canonicalizeLocationCode(lc));
  
  const normalizedNewRecords = newRecords.map(r => ({
    ...r,
    locationCode: canonicalizeLocationCode(r.locationCode),
  }));
  
  const filteredRecords = allRecords.filter(r => {
    if (r.clientCode !== clientCode) return true;
    const canonicalLoc = canonicalizeLocationCode(r.locationCode);
    return !canonicalizedLocationCodes.includes(canonicalLoc);
  });
  
  const updatedRecords = [...filteredRecords, ...normalizedNewRecords];
  await writeSerpData(updatedRecords);
}

export async function saveSerpApiLog(
  clientCode: string,
  locationCodes: string[],
  rawResponse: string
): Promise<string> {
  await ensureSerpLogsDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const locationsStr = locationCodes.join('_');
  const filename = `serp_${clientCode}_${locationsStr}_${timestamp}.json`;
  const filePath = path.join(SERP_LOGS_DIR, filename);
  await fs.writeFile(filePath, rawResponse, 'utf-8');
  return filename;
}

export async function getSerpApiLogs(): Promise<string[]> {
  try {
    await ensureSerpLogsDir();
    const files = await fs.readdir(SERP_LOGS_DIR);
    return files.filter(f => f.endsWith('.json')).sort().reverse();
  } catch {
    return [];
  }
}
