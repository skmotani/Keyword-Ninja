import { promises as fs } from 'fs';
import path from 'path';
import { KeywordApiDataRecord, MonthlySearch } from '@/types';

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
  locationCode: string
): Promise<KeywordApiDataRecord[]> {
  const records = await readKeywordApiData();
  return records.filter(r => r.clientCode === clientCode && r.locationCode === locationCode);
}

export async function getKeywordApiDataByClientAndLocations(
  clientCode: string,
  locationCodes: string[]
): Promise<KeywordApiDataRecord[]> {
  const records = await readKeywordApiData();
  return records.filter(r => r.clientCode === clientCode && locationCodes.includes(r.locationCode));
}

export async function getLastPulledAtForClientAndLocation(
  clientCode: string,
  locationCode: string
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
  locationCode: string,
  newRecords: KeywordApiDataRecord[]
): Promise<void> {
  const allRecords = await readKeywordApiData();
  const filteredRecords = allRecords.filter(
    r => !(r.clientCode === clientCode && r.locationCode === locationCode)
  );
  const updatedRecords = [...filteredRecords, ...newRecords];
  await writeKeywordApiData(updatedRecords);
}

export function normalizeKeyword(keyword: string): string {
  return keyword.trim().replace(/\s+/g, ' ').toLowerCase();
}

export interface KeywordMetrics {
  keywordText: string;
  searchVolume: number | null;
  cpc: number | null;
  competitionIndex: number | null;
  competitionLevel: string | null;
  monthlySearches: MonthlySearch[] | null;
}

export async function saveApiLog(
  clientCode: string,
  locationCode: string,
  rawResponse: string
): Promise<string> {
  await ensureApiLogsDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `dataforseo_${clientCode}_${locationCode}_${timestamp}.json`;
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
