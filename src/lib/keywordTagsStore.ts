import { promises as fs } from 'fs';
import path from 'path';
import { KeywordTag } from '@/types';
import { prisma } from '@/lib/prisma';

const USE_POSTGRES = process.env.USE_POSTGRES_KEYWORD_TAGS === 'true';
const DATA_DIR = path.join(process.cwd(), 'data');
const TAGS_FILE = 'keyword_tags.json';

export function normalizeKeyword(keyword: string): string {
    return keyword.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function generateTagId(clientCode: string, keyword: string): string {
    return `${clientCode}_${normalizeKeyword(keyword)}`;
}

async function ensureDataDir() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (e) {
        // ignore
    }
}

export async function readTags(clientCode: string): Promise<Record<string, KeywordTag>> {
    if (USE_POSTGRES) {
        const records = await prisma.keywordTag.findMany({
            where: { clientCode }
        });
        const clientTags: Record<string, KeywordTag> = {};
        for (const r of records) {
            const tag = {
                id: r.id,
                clientCode: r.clientCode,
                keyword: r.keyword,
                normalizedKeyword: r.normalizedKeyword,
                tag: r.tag,
                bucket: r.bucket,
                notes: r.notes ?? undefined,
                updatedAt: r.updatedAt.toISOString(),
                source: r.source ?? undefined,
            } as any as KeywordTag;
            clientTags[normalizeKeyword(r.keyword)] = tag;
        }
        return clientTags;
    }

    try {
        const filePath = path.join(DATA_DIR, TAGS_FILE);
        const data = await fs.readFile(filePath, 'utf-8');
        const allTags = JSON.parse(data) as Record<string, KeywordTag>;

        const clientTags: Record<string, KeywordTag> = {};
        for (const tag of Object.values(allTags)) {
            if (tag.clientCode === clientCode) {
                clientTags[normalizeKeyword(tag.keyword)] = tag;
            }
        }
        return clientTags;
    } catch (error) {
        return {};
    }
}

export async function saveTags(newTags: KeywordTag[]): Promise<void> {
    if (USE_POSTGRES) {
        for (const tag of newTags) {
            const t = tag as any;
            await prisma.keywordTag.upsert({
                where: { id: t.id },
                update: {
                    tag: t.tag,
                    bucket: t.bucket,
                    notes: t.notes,
                    source: t.source,
                    updatedAt: new Date(),
                },
                create: {
                    id: t.id,
                    clientCode: t.clientCode,
                    keyword: t.keyword,
                    normalizedKeyword: t.normalizedKeyword,
                    tag: t.tag,
                    bucket: t.bucket,
                    notes: t.notes,
                    source: t.source,
                }
            });
        }
        return;
    }

    await ensureDataDir();
    const filePath = path.join(DATA_DIR, TAGS_FILE);
    let allTags: Record<string, KeywordTag> = {};

    try {
        const data = await fs.readFile(filePath, 'utf-8');
        allTags = JSON.parse(data);
    } catch (error) {
        allTags = {};
    }

    for (const tag of newTags) {
        allTags[tag.id] = tag;
    }

    await fs.writeFile(filePath, JSON.stringify(allTags, null, 2), 'utf-8');
}
