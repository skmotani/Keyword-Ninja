import { promises as fs } from 'fs';
import path from 'path';
import { DomainOverviewRecord, DomainPageRecord, DomainKeywordRecord } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DOMAIN_OVERVIEW_FILE = 'domain_overview.json';
const DOMAIN_PAGES_FILE = 'domain_pages.json';
const DOMAIN_KEYWORDS_FILE = 'domain_keywords.json';
const DOMAIN_LOGS_DIR = path.join(DATA_DIR, 'domain_logs');

async function ensureDomainLogsDir(): Promise<void> {
  try {
    await fs.access(DOMAIN_LOGS_DIR);
  } catch {
    await fs.mkdir(DOMAIN_LOGS_DIR, { recursive: true });
  }
}

async function readDomainOverview(): Promise<DomainOverviewRecord[]> {
  try {
    const filePath = path.join(DATA_DIR, DOMAIN_OVERVIEW_FILE);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as DomainOverviewRecord[];
  } catch {
    return [];
  }
}

async function writeDomainOverview(records: DomainOverviewRecord[]): Promise<void> {
  const filePath = path.join(DATA_DIR, DOMAIN_OVERVIEW_FILE);
  await fs.writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8');
}

async function readDomainPages(): Promise<DomainPageRecord[]> {
  try {
    const filePath = path.join(DATA_DIR, DOMAIN_PAGES_FILE);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as DomainPageRecord[];
  } catch {
    return [];
  }
}

async function writeDomainPages(records: DomainPageRecord[]): Promise<void> {
  const filePath = path.join(DATA_DIR, DOMAIN_PAGES_FILE);
  await fs.writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8');
}

async function readDomainKeywords(): Promise<DomainKeywordRecord[]> {
  try {
    const filePath = path.join(DATA_DIR, DOMAIN_KEYWORDS_FILE);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as DomainKeywordRecord[];
  } catch {
    return [];
  }
}

async function writeDomainKeywords(records: DomainKeywordRecord[]): Promise<void> {
  const filePath = path.join(DATA_DIR, DOMAIN_KEYWORDS_FILE);
  await fs.writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8');
}

export async function getDomainOverviewData(): Promise<DomainOverviewRecord[]> {
  return readDomainOverview();
}

export async function getDomainOverviewByClient(clientCode: string): Promise<DomainOverviewRecord[]> {
  const records = await readDomainOverview();
  return records.filter(r => r.clientCode === clientCode);
}

export async function getDomainOverviewByClientAndLocation(
  clientCode: string,
  locationCode: string
): Promise<DomainOverviewRecord[]> {
  const records = await readDomainOverview();
  return records.filter(r => r.clientCode === clientCode && r.locationCode === locationCode);
}

export async function getDomainOverviewByClientLocationAndDomain(
  clientCode: string,
  locationCode: string,
  domain: string
): Promise<DomainOverviewRecord | null> {
  const records = await readDomainOverview();
  return records.find(r => 
    r.clientCode === clientCode && 
    r.locationCode === locationCode && 
    r.domain === domain
  ) || null;
}

export async function getLastFetchedAtForDomainOverview(
  clientCode: string,
  locationCode: string
): Promise<string | null> {
  const records = await getDomainOverviewByClientAndLocation(clientCode, locationCode);
  if (records.length === 0) return null;
  
  const sorted = records.sort((a, b) => 
    new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime()
  );
  return sorted[0].fetchedAt;
}

export async function replaceDomainOverviewForClientAndLocation(
  clientCode: string,
  locationCode: string,
  newRecords: DomainOverviewRecord[]
): Promise<void> {
  const allRecords = await readDomainOverview();
  const filteredRecords = allRecords.filter(
    r => !(r.clientCode === clientCode && r.locationCode === locationCode)
  );
  const updatedRecords = [...filteredRecords, ...newRecords];
  await writeDomainOverview(updatedRecords);
}

export async function replaceDomainOverviewForClientLocationAndDomains(
  clientCode: string,
  locationCode: string,
  domains: string[],
  newRecords: DomainOverviewRecord[]
): Promise<void> {
  const allRecords = await readDomainOverview();
  const filteredRecords = allRecords.filter(
    r => !(r.clientCode === clientCode && r.locationCode === locationCode && domains.includes(r.domain))
  );
  const updatedRecords = [...filteredRecords, ...newRecords];
  await writeDomainOverview(updatedRecords);
}

export async function getDomainPagesData(): Promise<DomainPageRecord[]> {
  return readDomainPages();
}

export async function getDomainPagesByClient(clientCode: string): Promise<DomainPageRecord[]> {
  const records = await readDomainPages();
  return records.filter(r => r.clientCode === clientCode);
}

export async function getDomainPagesByClientAndLocation(
  clientCode: string,
  locationCode: string
): Promise<DomainPageRecord[]> {
  const records = await readDomainPages();
  return records.filter(r => r.clientCode === clientCode && r.locationCode === locationCode);
}

export async function getDomainPagesByClientLocationAndDomain(
  clientCode: string,
  locationCode: string,
  domain: string
): Promise<DomainPageRecord[]> {
  const records = await readDomainPages();
  return records.filter(r => 
    r.clientCode === clientCode && 
    r.locationCode === locationCode && 
    r.domain === domain
  );
}

export async function getLastFetchedAtForDomainPages(
  clientCode: string,
  locationCode: string
): Promise<string | null> {
  const records = await getDomainPagesByClientAndLocation(clientCode, locationCode);
  if (records.length === 0) return null;
  
  const sorted = records.sort((a, b) => 
    new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime()
  );
  return sorted[0].fetchedAt;
}

export async function replaceDomainPagesForClientAndLocation(
  clientCode: string,
  locationCode: string,
  newRecords: DomainPageRecord[]
): Promise<void> {
  const allRecords = await readDomainPages();
  const filteredRecords = allRecords.filter(
    r => !(r.clientCode === clientCode && r.locationCode === locationCode)
  );
  const updatedRecords = [...filteredRecords, ...newRecords];
  await writeDomainPages(updatedRecords);
}

export async function replaceDomainPagesForClientLocationAndDomains(
  clientCode: string,
  locationCode: string,
  domains: string[],
  newRecords: DomainPageRecord[]
): Promise<void> {
  const allRecords = await readDomainPages();
  const filteredRecords = allRecords.filter(
    r => !(r.clientCode === clientCode && r.locationCode === locationCode && domains.includes(r.domain))
  );
  const updatedRecords = [...filteredRecords, ...newRecords];
  await writeDomainPages(updatedRecords);
}

export async function getDomainKeywordsData(): Promise<DomainKeywordRecord[]> {
  return readDomainKeywords();
}

export async function getDomainKeywordsByClient(clientCode: string): Promise<DomainKeywordRecord[]> {
  const records = await readDomainKeywords();
  return records.filter(r => r.clientCode === clientCode);
}

export async function getDomainKeywordsByClientAndLocation(
  clientCode: string,
  locationCode: string
): Promise<DomainKeywordRecord[]> {
  const records = await readDomainKeywords();
  return records.filter(r => r.clientCode === clientCode && r.locationCode === locationCode);
}

export async function getDomainKeywordsByClientLocationAndDomain(
  clientCode: string,
  locationCode: string,
  domain: string
): Promise<DomainKeywordRecord[]> {
  const records = await readDomainKeywords();
  return records.filter(r => 
    r.clientCode === clientCode && 
    r.locationCode === locationCode && 
    r.domain === domain
  );
}

export async function getLastFetchedAtForDomainKeywords(
  clientCode: string,
  locationCode: string
): Promise<string | null> {
  const records = await getDomainKeywordsByClientAndLocation(clientCode, locationCode);
  if (records.length === 0) return null;
  
  const sorted = records.sort((a, b) => 
    new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime()
  );
  return sorted[0].fetchedAt;
}

export async function replaceDomainKeywordsForClientAndLocation(
  clientCode: string,
  locationCode: string,
  newRecords: DomainKeywordRecord[]
): Promise<void> {
  const allRecords = await readDomainKeywords();
  const filteredRecords = allRecords.filter(
    r => !(r.clientCode === clientCode && r.locationCode === locationCode)
  );
  const updatedRecords = [...filteredRecords, ...newRecords];
  await writeDomainKeywords(updatedRecords);
}

export async function replaceDomainKeywordsForClientLocationAndDomains(
  clientCode: string,
  locationCode: string,
  domains: string[],
  newRecords: DomainKeywordRecord[]
): Promise<void> {
  const allRecords = await readDomainKeywords();
  const filteredRecords = allRecords.filter(
    r => !(r.clientCode === clientCode && r.locationCode === locationCode && domains.includes(r.domain))
  );
  const updatedRecords = [...filteredRecords, ...newRecords];
  await writeDomainKeywords(updatedRecords);
}

export async function saveDomainApiLog(
  clientCode: string,
  locationCodes: string[],
  dataType: 'overview' | 'pages' | 'keywords',
  rawResponse: string
): Promise<string> {
  await ensureDomainLogsDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const locationsStr = locationCodes.join('_');
  const filename = `domain_${dataType}_${clientCode}_${locationsStr}_${timestamp}.json`;
  const filePath = path.join(DOMAIN_LOGS_DIR, filename);
  await fs.writeFile(filePath, rawResponse, 'utf-8');
  return filename;
}

export async function getDomainApiLogs(): Promise<string[]> {
  try {
    await ensureDomainLogsDir();
    const files = await fs.readdir(DOMAIN_LOGS_DIR);
    return files.filter(f => f.endsWith('.json')).sort().reverse();
  } catch {
    return [];
  }
}

export async function getDomainApiLogContent(filename: string): Promise<string | null> {
  try {
    const filePath = path.join(DOMAIN_LOGS_DIR, filename);
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export function cleanDomain(domain: string): string {
  return domain
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
    .trim();
}
