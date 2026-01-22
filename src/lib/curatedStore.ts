import { promises as fs } from 'fs';
import path from 'path';
import { CuratedKeyword, ClientPosition } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/prisma';

// Feature flags for PostgreSQL
const USE_POSTGRES_CLIENT_POSITIONS = process.env.USE_POSTGRES_CLIENT_POSITIONS === 'true';
const USE_POSTGRES_CURATED_KEYWORDS = process.env.USE_POSTGRES_CURATED_KEYWORDS === 'true';

const DATA_DIR = path.join(process.cwd(), 'data');
const CURATED_KEYWORDS_FILE = 'curated_keywords.json';
const CLIENT_POSITIONS_FILE = 'client_positions.json';

// --- CURATED KEYWORDS ---

async function readCuratedKeywords(): Promise<CuratedKeyword[]> {
    if (USE_POSTGRES_CURATED_KEYWORDS) {
        const records = await prisma.curatedKeyword.findMany();
        return records.map(r => ({
            id: r.id,
            clientCode: r.clientCode,
            keyword: r.keyword,
            source: 'Manual',
            notes: r.notes ?? undefined,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
        }));
    }
    try {
        const filePath = path.join(DATA_DIR, CURATED_KEYWORDS_FILE);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as CuratedKeyword[];
    } catch {
        return [];
    }
}

async function writeCuratedKeywords(records: CuratedKeyword[]): Promise<void> {
    if (USE_POSTGRES_CURATED_KEYWORDS) return; // PostgreSQL handles writes individually
    const filePath = path.join(DATA_DIR, CURATED_KEYWORDS_FILE);
    await fs.writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8');
}

export async function getCuratedKeywords(clientCode?: string): Promise<CuratedKeyword[]> {
    if (USE_POSTGRES_CURATED_KEYWORDS) {
        const where = clientCode ? { clientCode } : {};
        const records = await prisma.curatedKeyword.findMany({ where });
        return records.map(r => ({
            id: r.id,
            clientCode: r.clientCode,
            keyword: r.keyword,
            source: 'Manual',
            notes: r.notes ?? undefined,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
        }));
    }
    const records = await readCuratedKeywords();
    if (clientCode) {
        return records.filter(r => r.clientCode === clientCode);
    }
    return records;
}

export async function addCuratedKeywords(newRecords: Omit<CuratedKeyword, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<CuratedKeyword[]> {
    if (USE_POSTGRES_CURATED_KEYWORDS) {
        const added: CuratedKeyword[] = [];
        for (const r of newRecords) {
            try {
                const record = await prisma.curatedKeyword.create({
                    data: {
                        clientCode: r.clientCode,
                        keyword: r.keyword,
                        notes: r.notes,
                    }
                });
                added.push({
                    id: record.id,
                    clientCode: record.clientCode,
                    keyword: record.keyword,
                    source: 'Manual',
                    notes: record.notes ?? undefined,
                    createdAt: record.createdAt.toISOString(),
                    updatedAt: record.updatedAt.toISOString(),
                });
            } catch {
                // Skip duplicates (unique constraint violation)
            }
        }
        return added;
    }

    const allRecords = await readCuratedKeywords();
    const timestamp = new Date().toISOString();

    const added: CuratedKeyword[] = newRecords.map(r => ({
        id: uuidv4(),
        ...r,
        createdAt: timestamp,
        updatedAt: timestamp
    }));

    const existingMap = new Set(allRecords.map(r => `${r.clientCode}|${r.keyword.toLowerCase()}`));
    const uniqueToAdd = added.filter(r => !existingMap.has(`${r.clientCode}|${r.keyword.toLowerCase()}`));

    if (uniqueToAdd.length > 0) {
        await writeCuratedKeywords([...allRecords, ...uniqueToAdd]);
    }

    return uniqueToAdd;
}

export async function updateCuratedKeyword(id: string, updates: Partial<CuratedKeyword>): Promise<CuratedKeyword | null> {
    if (USE_POSTGRES_CURATED_KEYWORDS) {
        try {
            const record = await prisma.curatedKeyword.update({
                where: { id },
                data: { notes: updates.notes, updatedAt: new Date() }
            });
            return {
                id: record.id,
                clientCode: record.clientCode,
                keyword: record.keyword,
                source: 'Manual',
                notes: record.notes ?? undefined,
                createdAt: record.createdAt.toISOString(),
                updatedAt: record.updatedAt.toISOString(),
            };
        } catch {
            return null;
        }
    }
    const all = await readCuratedKeywords();
    const index = all.findIndex(r => r.id === id);
    if (index === -1) return null;

    const updated = { ...all[index], ...updates, updatedAt: new Date().toISOString() };
    all[index] = updated;
    await writeCuratedKeywords(all);
    return updated;
}

export async function deleteCuratedKeyword(id: string): Promise<void> {
    if (USE_POSTGRES_CURATED_KEYWORDS) {
        try {
            await prisma.curatedKeyword.delete({ where: { id } });
        } catch {
            // Already deleted or doesn't exist
        }
        return;
    }
    const all = await readCuratedKeywords();
    const filtered = all.filter(r => r.id !== id);
    if (filtered.length !== all.length) {
        await writeCuratedKeywords(filtered);
    }
}

// --- CLIENT POSITIONS ---

async function readClientPositions(): Promise<ClientPosition[]> {
    if (USE_POSTGRES_CLIENT_POSITIONS) {
        const positions = await prisma.clientPosition.findMany();
        return positions.map(p => ({
            id: p.id,
            clientCode: p.clientCode,
            keywordOrTheme: p.keywordOrTheme,
            currentPosition: p.currentPosition || '-',
            competitor: p.competitor || '',
            source: p.source || 'Manual',
            notes: p.notes || '',
            asOfDate: p.asOfDate || '',
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString()
        })) as ClientPosition[];
    }

    try {
        const filePath = path.join(DATA_DIR, CLIENT_POSITIONS_FILE);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as ClientPosition[];
    } catch {
        return [];
    }
}

async function writeClientPositions(records: ClientPosition[]): Promise<void> {
    if (USE_POSTGRES_CLIENT_POSITIONS) return; // PostgreSQL handles writes individually
    const filePath = path.join(DATA_DIR, CLIENT_POSITIONS_FILE);
    await fs.writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8');
}

export async function getClientPositions(clientCode?: string): Promise<ClientPosition[]> {
    if (USE_POSTGRES_CLIENT_POSITIONS) {
        const where = clientCode ? { clientCode } : {};
        const positions = await prisma.clientPosition.findMany({ where });
        return positions.map(p => ({
            id: p.id,
            clientCode: p.clientCode,
            keywordOrTheme: p.keywordOrTheme,
            currentPosition: p.currentPosition || '-',
            competitor: p.competitor || '',
            source: p.source || 'Manual',
            notes: p.notes || '',
            asOfDate: p.asOfDate || '',
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString()
        })) as ClientPosition[];
    }
    const records = await readClientPositions();
    if (clientCode) {
        return records.filter(r => r.clientCode === clientCode);
    }
    return records;
}

export async function addClientPositions(newRecords: Omit<ClientPosition, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<ClientPosition[]> {
    if (USE_POSTGRES_CLIENT_POSITIONS) {
        const added: ClientPosition[] = [];
        for (const r of newRecords) {
            const record = await prisma.clientPosition.create({
                data: {
                    clientCode: r.clientCode,
                    keywordOrTheme: r.keywordOrTheme,
                    currentPosition: r.currentPosition,
                    competitor: r.competitor,
                    source: r.source,
                    notes: r.notes,
                    asOfDate: r.asOfDate,
                }
            });
            added.push({
                id: record.id,
                clientCode: record.clientCode,
                keywordOrTheme: record.keywordOrTheme,
                currentPosition: record.currentPosition || '-',
                competitor: record.competitor || '',
                source: record.source || 'Manual',
                notes: record.notes || '',
                asOfDate: record.asOfDate || '',
                createdAt: record.createdAt.toISOString(),
                updatedAt: record.updatedAt.toISOString()
            });
        }
        return added;
    }

    const allRecords = await readClientPositions();
    const timestamp = new Date().toISOString();

    const added: ClientPosition[] = newRecords.map(r => ({
        id: uuidv4(),
        ...r,
        createdAt: timestamp,
        updatedAt: timestamp
    }));

    await writeClientPositions([...allRecords, ...added]);
    return added;
}

export async function updateClientPosition(id: string, updates: Partial<ClientPosition>): Promise<ClientPosition | null> {
    if (USE_POSTGRES_CLIENT_POSITIONS) {
        try {
            const record = await prisma.clientPosition.update({
                where: { id },
                data: {
                    currentPosition: updates.currentPosition,
                    competitor: updates.competitor,
                    source: updates.source,
                    notes: updates.notes,
                    asOfDate: updates.asOfDate,
                    updatedAt: new Date()
                }
            });
            return {
                id: record.id,
                clientCode: record.clientCode,
                keywordOrTheme: record.keywordOrTheme,
                currentPosition: record.currentPosition || '-',
                competitor: record.competitor || '',
                source: record.source || 'Manual',
                notes: record.notes || '',
                asOfDate: record.asOfDate || '',
                createdAt: record.createdAt.toISOString(),
                updatedAt: record.updatedAt.toISOString()
            };
        } catch {
            return null;
        }
    }
    const all = await readClientPositions();
    const index = all.findIndex(r => r.id === id);
    if (index === -1) return null;

    const updated = { ...all[index], ...updates, updatedAt: new Date().toISOString() };
    all[index] = updated;
    await writeClientPositions(all);
    return updated;
}

export async function deleteClientPosition(id: string): Promise<void> {
    if (USE_POSTGRES_CLIENT_POSITIONS) {
        try {
            await prisma.clientPosition.delete({ where: { id } });
        } catch {
            // Already deleted or doesn't exist
        }
        return;
    }
    const all = await readClientPositions();
    const filtered = all.filter(r => r.id !== id);
    if (filtered.length !== all.length) {
        await writeClientPositions(filtered);
    }
}
