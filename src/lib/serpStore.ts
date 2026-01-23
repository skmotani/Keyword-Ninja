import { promises as fs } from 'fs';
import path from 'path';
import { ClientPositionSerpRecord, SerpResult } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/prisma';

const USE_POSTGRES_CLIENT_POSITIONS_SERP = process.env.USE_POSTGRES_CLIENT_POSITIONS_SERP === 'true';
const USE_POSTGRES_SERP_RESULTS = process.env.USE_POSTGRES_SERP_RESULTS === 'true';

const DATA_DIR = path.join(process.cwd(), 'data');
const SERP_POSITIONS_FILE = 'client_positions_serp.json';
const SERP_RESULTS_FILE = 'serp_results.json';

// --------------------------------------------------------
// CLIENT POSITIONS SERP (client_positions_serp.json)
// --------------------------------------------------------

async function readSerpRecords(): Promise<ClientPositionSerpRecord[]> {
  if (USE_POSTGRES_CLIENT_POSITIONS_SERP) {
    const records = await (prisma.clientPositionSerp as any).findMany();
    return records.map((r: any) => ({
      id: r.id,
      clientCode: r.clientCode,
      keyword: r.keyword,
      selectedDomain: r.selectedDomain,
      locationType: r.locationType as 'IN' | 'GL',
      rank: r.rank,
      url: r.url,
      fetchedAt: r.fetchedAt,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }
  try {
    const filePath = path.join(DATA_DIR, SERP_POSITIONS_FILE);
    const data = await fs.readFile(filePath, 'utf-8');
    const raw = JSON.parse(data);
    return raw.map((r: any) => ({
      ...r,
      locationType: r.locationType === 'GLOBAL' ? 'GL' : r.locationType
    })) as ClientPositionSerpRecord[];
  } catch {
    return [];
  }
}

async function writeSerpRecords(records: ClientPositionSerpRecord[]): Promise<void> {
  if (USE_POSTGRES_CLIENT_POSITIONS_SERP) return;
  const filePath = path.join(DATA_DIR, SERP_POSITIONS_FILE);
  await fs.writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8');
}

export async function getClientPositionSerpRecords(
  clientCode: string,
  selectedDomain?: string,
  locationType?: 'IN' | 'GL'
): Promise<ClientPositionSerpRecord[]> {
  if (USE_POSTGRES_CLIENT_POSITIONS_SERP) {
    const where: any = { clientCode };
    if (selectedDomain) where.selectedDomain = selectedDomain;
    if (locationType) where.locationType = locationType;

    const records = await (prisma.clientPositionSerp as any).findMany({ where });
    return records.map((r: any) => ({
      id: r.id,
      clientCode: r.clientCode,
      keyword: r.keyword,
      selectedDomain: r.selectedDomain,
      locationType: r.locationType as 'IN' | 'GL',
      rank: r.rank,
      url: r.url,
      fetchedAt: r.fetchedAt,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }
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
  if (USE_POSTGRES_CLIENT_POSITIONS_SERP) {
    for (const r of newRecords) {
      const existing = await (prisma.clientPositionSerp as any).findFirst({
        where: {
          clientCode: r.clientCode,
          keyword: { equals: r.keyword, mode: 'insensitive' },
          selectedDomain: { equals: r.selectedDomain, mode: 'insensitive' },
          locationType: r.locationType
        }
      });

      if (existing) {
        await (prisma.clientPositionSerp as any).update({
          where: { id: existing.id },
          data: { rank: r.rank, url: (r as any).url, fetchedAt: (r as any).fetchedAt, updatedAt: new Date() }
        });
      } else {
        await (prisma.clientPositionSerp as any).create({
          data: {
            clientCode: r.clientCode,
            keyword: r.keyword,
            selectedDomain: r.selectedDomain,
            locationType: r.locationType,
            rank: r.rank,
            url: (r as any).url,
            fetchedAt: (r as any).fetchedAt,
          }
        });
      }
    }
    return;
  }

  const all = await readSerpRecords();
  const timestamp = new Date().toISOString();

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

async function readSerpResultRecords(): Promise<SerpResult[]> {
  if (USE_POSTGRES_SERP_RESULTS) {
    const records = await (prisma.serpResult as any).findMany();
    return records.map((r: any) => ({
      id: r.id,
      clientCode: r.clientCode,
      keyword: r.keyword,
      locationCode: r.locationCode,
      rank: r.rank,
      domain: r.domain,
      url: r.url,
      title: r.title ?? '',
      description: r.description ?? '',
      serpData: r.serpData as any,
      fetchedAt: r.fetchedAt,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }
  try {
    const filePath = path.join(DATA_DIR, SERP_RESULTS_FILE);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as SerpResult[];
  } catch {
    return [];
  }
}

async function writeSerpResultRecords(records: SerpResult[]): Promise<void> {
  if (USE_POSTGRES_SERP_RESULTS) return;
  const filePath = path.join(DATA_DIR, SERP_RESULTS_FILE);
  await fs.writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8');
}

export async function getSerpDataByClientAndLocations(
  clientCode: string,
  locationCodes: number[]
): Promise<SerpResult[]> {
  if (USE_POSTGRES_SERP_RESULTS) {
    const records = await (prisma.serpResult as any).findMany({
      where: { clientCode, locationCode: { in: locationCodes } }
    });
    return records.map((r: any) => ({
      id: r.id,
      clientCode: r.clientCode,
      keyword: r.keyword,
      locationCode: r.locationCode,
      rank: r.rank,
      domain: r.domain,
      url: r.url,
      title: r.title ?? '',
      description: r.description ?? '',
      serpData: r.serpData as any,
      fetchedAt: r.fetchedAt,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }
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
  if (USE_POSTGRES_SERP_RESULTS) {
    // Delete existing records
    await (prisma.serpResult as any).deleteMany({
      where: { clientCode, locationCode: { in: locationCodes } }
    });
    // Insert new records
    for (const r of newRecords) {
      await (prisma.serpResult as any).create({
        data: {
          id: r.id,
          clientCode: r.clientCode,
          keyword: r.keyword,
          locationCode: r.locationCode,
          rank: r.rank,
          domain: r.domain,
          url: r.url,
          title: r.title,
          description: r.description,
          serpData: (r as any).serpData,
          fetchedAt: r.fetchedAt,
        }
      });
    }
    return;
  }

  const all = await readSerpResultRecords();
  const filtered = all.filter(r =>
    !(r.clientCode === clientCode && locationCodes.includes(r.locationCode))
  );
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

