import { promises as fs } from 'fs';
import path from 'path';
import { KeywordApiDataRecord } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const KEYWORD_API_DATA_FILE = 'keyword_api_data.json';

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
}

export async function fetchKeywordDataFromProvider(
  keywords: string[],
  locationCode: string
): Promise<KeywordMetrics[]> {
  return keywords.map(keyword => ({
    keywordText: keyword,
    searchVolume: Math.floor(Math.random() * 10000) + 100,
    cpc: parseFloat((Math.random() * 5 + 0.1).toFixed(2)),
    competitionIndex: parseFloat((Math.random() * 100).toFixed(1)),
  }));
}
