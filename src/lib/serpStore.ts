import { promises as fs } from 'fs';
import path from 'path';
import { ClientPositionSerpRecord } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const DATA_DIR = path.join(process.cwd(), 'data');
const SERP_POSITIONS_FILE = 'client_positions_serp.json';

async function readSerpRecords(): Promise<ClientPositionSerpRecord[]> {
  try {
    const filePath = path.join(DATA_DIR, SERP_POSITIONS_FILE);
    const data = await fs.readFile(filePath, 'utf-8');
    const raw = JSON.parse(data);

    // On-the-fly Migration: GLOBAL -> GL
    // This ensures legacy data is read correctly as GL
    return raw.map((r: any) => ({
      ...r,
      locationType: r.locationType === 'GLOBAL' ? 'GL' : r.locationType
    })) as ClientPositionSerpRecord[];
  } catch {
    return [];
  }
}

async function writeSerpRecords(records: ClientPositionSerpRecord[]): Promise<void> {
  const filePath = path.join(DATA_DIR, SERP_POSITIONS_FILE);
  await fs.writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8');
}

export async function getClientPositionSerpRecords(
  clientCode: string,
  selectedDomain?: string,
  locationType?: 'IN' | 'GL'
): Promise<ClientPositionSerpRecord[]> {
  const all = await readSerpRecords();
  return all.filter(r =>
    r.clientCode === clientCode &&
    (!selectedDomain || r.selectedDomain === selectedDomain) &&
    (!locationType || r.locationType === locationType)
  );
}

export async function upsertClientPositionSerpRecords(
  newRecords: Omit<ClientPositionSerpRecord, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<void> {
  const all = await readSerpRecords();
  const timestamp = new Date().toISOString();

  // Composite key: clientCode + keyword + selectedDomain + locationType
  const getKey = (r: { clientCode: string, keyword: string, selectedDomain: string, locationType: string }) =>
    `${r.clientCode}|${r.keyword.toLowerCase()}|${r.selectedDomain.toLowerCase()}|${r.locationType}`;

  const newMap = new Map();
  newRecords.forEach(r => {
    newMap.set(getKey(r), r);
  });

  const updatedList = all.map(existing => {
    const key = getKey(existing);
    if (newMap.has(key)) {
      const update = newMap.get(key);
      newMap.delete(key);
      return {
        ...existing,
        ...update,
        updatedAt: timestamp
      };
    }
    return existing;
  });

  // Add remaining new records
  newMap.forEach((val) => {
    updatedList.push({
      id: uuidv4(),
      ...val,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  });

  await writeSerpRecords(updatedList);
}

// --------------------------------------------------------
// SERP RESULTS (Detailed Top 10) - serp_results.json
// --------------------------------------------------------

const SERP_RESULTS_FILE = 'serp_results.json';
import { SerpResult } from '@/types';

async function readSerpResultRecords(): Promise<SerpResult[]> {
  try {
    const filePath = path.join(DATA_DIR, SERP_RESULTS_FILE);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as SerpResult[];
  } catch {
    return [];
  }
}

async function writeSerpResultRecords(records: SerpResult[]): Promise<void> {
  const filePath = path.join(DATA_DIR, SERP_RESULTS_FILE);
  await fs.writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8');
}

export async function getSerpDataByClientAndLocations(
  clientCode: string,
  locationCodes: number[]
): Promise<SerpResult[]> {
  const all = await readSerpResultRecords();
  return all.filter(r =>
    r.clientCode === clientCode &&
    locationCodes.includes(r.locationCode)
  );
}

export async function replaceSerpDataForClientAndLocations(
  clientCode: string,
  locationCodes: number[],
  newRecords: SerpResult[]
): Promise<void> {
  const all = await readSerpResultRecords();

  // Remove existing records for this client + locations
  // filtering out strictly what matches BOTH client AND one of the locations
  const filtered = all.filter(r =>
    !(r.clientCode === clientCode && locationCodes.includes(r.locationCode))
  );

  // Append new records
  const updated = [...filtered, ...newRecords];

  await writeSerpResultRecords(updated);
}

export async function saveSerpApiLog(clientCode: string, locCodes: string[], rawResponse: any): Promise<string> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `serp_fetch_${clientCode}_${timestamp}.json`;
    const logDir = path.join(DATA_DIR, 'api_logs');

    await fs.mkdir(logDir, { recursive: true });
    await fs.writeFile(path.join(logDir, filename), JSON.stringify({
      clientCode,
      locCodes,
      timestamp,
      response: rawResponse
    }, null, 2));

    return filename;
  } catch (e) {
    console.error('Failed to save SERP log', e);
    return 'error_saving_log.json';
  }
}
