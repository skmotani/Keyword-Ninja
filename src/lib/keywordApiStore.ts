import { promises as fs } from 'fs';
import path from 'path';
import { KeywordApiDataRecord } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const KEYWORD_API_DATA_FILE = 'keyword_api_data.json';
const API_LOGS_DIR = path.join(DATA_DIR, 'api_logs');

async function ensureApiLogsDir(): Promise<void> {
  try {
    await fs.access(API_LOGS_DIR);
  } catch {
    await fs.mkdir(API_LOGS_DIR, { recursive: true });
  }
}

async function readKeywordApiData(): Promise<KeywordApiDataRecord[]> {
  try {
    const filePath = path.join(DATA_DIR, KEYWORD_API_DATA_FILE);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as KeywordApiDataRecord[];
  } catch (error) {
    return [];
  }
}

async function writeKeywordApiData(records: KeywordApiDataRecord[]): Promise<void> {
  const filePath = path.join(DATA_DIR, KEYWORD_API_DATA_FILE);
  await fs.writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8');
}

export async function getKeywordApiData(): Promise<KeywordApiDataRecord[]> {
  return readKeywordApiData();
}

export async function getKeywordApiDataByClientAndLocation(
  clientCode: string,
  locationCode: number
): Promise<KeywordApiDataRecord[]> {
  const records = await readKeywordApiData();
  return records.filter(r => r.clientCode === clientCode && r.locationCode === locationCode);
}

export async function getKeywordApiDataByClientAndLocations(
  clientCode: string,
  locationCodes: number[]
): Promise<KeywordApiDataRecord[]> {
  const records = await readKeywordApiData();
  return records.filter(r => r.clientCode === clientCode && locationCodes.includes(r.locationCode));
}

export async function getLastPulledAtForClientAndLocation(
  clientCode: string,
  locationCode: number
): Promise<string | null> {
  const records = await getKeywordApiDataByClientAndLocation(clientCode, locationCode);
  if (records.length === 0) return null;
  
  const sorted = records.sort((a, b) => 
    new Date(b.lastPulledAt).getTime() - new Date(a.lastPulledAt).getTime()
  );
  return sorted[0].lastPulledAt;
}

export async function replaceKeywordApiDataForClientAndLocation(
  clientCode: string,
  locationCode: number,
  newRecords: KeywordApiDataRecord[]
): Promise<void> {
  const allRecords = await readKeywordApiData();
  const filteredRecords = allRecords.filter(
    r => !(r.clientCode === clientCode && r.locationCode === locationCode)
  );
  const updatedRecords = [...filteredRecords, ...newRecords];
  await writeKeywordApiData(updatedRecords);
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

export async function replaceKeywordApiDataForClientAndLocations(
  clientCode: string,
  locationCodes: number[],
  newRecords: KeywordApiDataRecord[]
): Promise<void> {
  const allRecords = await readKeywordApiData();
  
  const normalizedNewRecords = newRecords.map(r => ({
    ...r,
    locationCode: canonicalizeLocationCode(r.locationCode),
  }));
  
  const filteredRecords = allRecords.filter(r => {
    if (r.clientCode !== clientCode) return true;
    const canonicalLoc = canonicalizeLocationCode(r.locationCode);
    return !locationCodes.includes(canonicalLoc);
  });
  
  const updatedRecords = [...filteredRecords, ...normalizedNewRecords];
  await writeKeywordApiData(updatedRecords);
}

export function normalizeKeyword(keyword: string): string {
  return keyword.trim().replace(/\s+/g, ' ').toLowerCase();
}

export async function saveApiLog(
  clientCode: string,
  locationCodes: string[],
  rawResponse: string
): Promise<string> {
  await ensureApiLogsDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const locationsStr = locationCodes.join('_');
  const filename = `dataforseo_${clientCode}_${locationsStr}_${timestamp}.json`;
  const filePath = path.join(API_LOGS_DIR, filename);
  await fs.writeFile(filePath, rawResponse, 'utf-8');
  return filename;
}

export async function getApiLogs(): Promise<string[]> {
  try {
    await ensureApiLogsDir();
    const files = await fs.readdir(API_LOGS_DIR);
    return files.filter(f => f.endsWith('.json')).sort().reverse();
  } catch {
    return [];
  }
}

export async function getApiLogContent(filename: string): Promise<string | null> {
  try {
    const filePath = path.join(API_LOGS_DIR, filename);
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}
