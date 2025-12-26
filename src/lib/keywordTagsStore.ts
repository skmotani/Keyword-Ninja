import { promises as fs } from 'fs';
import path from 'path';
import { KeywordTag } from '@/types';

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
