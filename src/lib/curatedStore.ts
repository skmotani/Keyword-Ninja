import { promises as fs } from 'fs';
import path from 'path';
import { CuratedKeyword, ClientPosition } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const DATA_DIR = path.join(process.cwd(), 'data');
const CURATED_KEYWORDS_FILE = 'curated_keywords.json';
const CLIENT_POSITIONS_FILE = 'client_positions.json';

// --- CURATED KEYWORDS ---

async function readCuratedKeywords(): Promise<CuratedKeyword[]> {
    try {
        const filePath = path.join(DATA_DIR, CURATED_KEYWORDS_FILE);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as CuratedKeyword[];
    } catch {
        return [];
    }
}

async function writeCuratedKeywords(records: CuratedKeyword[]): Promise<void> {
    const filePath = path.join(DATA_DIR, CURATED_KEYWORDS_FILE);
    await fs.writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8');
}

export async function getCuratedKeywords(clientCode?: string): Promise<CuratedKeyword[]> {
    const records = await readCuratedKeywords();
    if (clientCode) {
        return records.filter(r => r.clientCode === clientCode);
    }
    return records;
}

export async function addCuratedKeywords(newRecords: Omit<CuratedKeyword, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<CuratedKeyword[]> {
    const allRecords = await readCuratedKeywords();
    const timestamp = new Date().toISOString();

    const added: CuratedKeyword[] = newRecords.map(r => ({
        id: uuidv4(),
        ...r,
        createdAt: timestamp,
        updatedAt: timestamp
    }));

    // Deduplication: Remove existing records that match (clientCode, keyword) from the NEW list? 
    // OR overwrite? Prompt says "Deduplicate by (client_code, keyword)".
    // Usually this means if it exists, don't add, or update. 
    // Let's assume we maintain uniqueness.

    const existingMap = new Set(allRecords.map(r => `${r.clientCode}|${r.keyword.toLowerCase()}`));
    const uniqueToAdd = added.filter(r => !existingMap.has(`${r.clientCode}|${r.keyword.toLowerCase()}`));

    if (uniqueToAdd.length > 0) {
        await writeCuratedKeywords([...allRecords, ...uniqueToAdd]);
    }

    return uniqueToAdd;
}

export async function updateCuratedKeyword(id: string, updates: Partial<CuratedKeyword>): Promise<CuratedKeyword | null> {
    const all = await readCuratedKeywords();
    const index = all.findIndex(r => r.id === id);
    if (index === -1) return null;

    const updated = { ...all[index], ...updates, updatedAt: new Date().toISOString() };
    all[index] = updated;
    await writeCuratedKeywords(all);
    return updated;
}

export async function deleteCuratedKeyword(id: string): Promise<void> {
    const all = await readCuratedKeywords();
    const filtered = all.filter(r => r.id !== id);
    if (filtered.length !== all.length) {
        await writeCuratedKeywords(filtered);
    }
}

// --- CLIENT POSITIONS ---

async function readClientPositions(): Promise<ClientPosition[]> {
    try {
        const filePath = path.join(DATA_DIR, CLIENT_POSITIONS_FILE);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as ClientPosition[];
    } catch {
        return [];
    }
}

async function writeClientPositions(records: ClientPosition[]): Promise<void> {
    const filePath = path.join(DATA_DIR, CLIENT_POSITIONS_FILE);
    await fs.writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8');
}

export async function getClientPositions(clientCode?: string): Promise<ClientPosition[]> {
    const records = await readClientPositions();
    if (clientCode) {
        return records.filter(r => r.clientCode === clientCode);
    }
    return records;
}

export async function addClientPositions(newRecords: Omit<ClientPosition, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<ClientPosition[]> {
    const allRecords = await readClientPositions();
    const timestamp = new Date().toISOString();

    const added: ClientPosition[] = newRecords.map(r => ({
        id: uuidv4(),
        ...r,
        createdAt: timestamp,
        updatedAt: timestamp
    }));

    // Deduplication not strictly strictly required by prompt but good practice? 
    // Prompt doesn't explicitly asking for dedupe for Positions, only Keywords. "Deduplicate by (client_code, keyword)" was for Keywords.
    // For Positions, history might be allowed? "Track curated client positioning... as_of_date".
    // Multiple entries for same keyword on different dates is likely valid history.
    // So we just append.

    await writeClientPositions([...allRecords, ...added]);
    return added;
}

export async function updateClientPosition(id: string, updates: Partial<ClientPosition>): Promise<ClientPosition | null> {
    const all = await readClientPositions();
    const index = all.findIndex(r => r.id === id);
    if (index === -1) return null;

    const updated = { ...all[index], ...updates, updatedAt: new Date().toISOString() };
    all[index] = updated;
    await writeClientPositions(all);
    return updated;
}

export async function deleteClientPosition(id: string): Promise<void> {
    const all = await readClientPositions();
    const filtered = all.filter(r => r.id !== id);
    if (filtered.length !== all.length) {
        await writeClientPositions(filtered);
    }
}
