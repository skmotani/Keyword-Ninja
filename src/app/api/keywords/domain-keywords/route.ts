import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

interface DomainKeyword {
    id?: string;
    clientCode: string;
    domain: string;
    keyword: string;
    position: number;
    searchVolume: number;
    locationCode?: string;
    url?: string;
    fetchedAt?: string;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const clientCode = searchParams.get('clientCode');

        const filePath = path.join(DATA_DIR, 'domain_keywords.json');
        const data = await fs.readFile(filePath, 'utf-8');
        const allKeywords: DomainKeyword[] = JSON.parse(data);

        let keywords = allKeywords;

        // Filter by client code if provided
        if (clientCode) {
            keywords = keywords.filter(k => k.clientCode === clientCode);
        }

        return NextResponse.json({
            success: true,
            keywords,
            count: keywords.length
        });
    } catch (error) {
        console.error('Failed to read domain keywords:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to read domain keywords', keywords: [] },
            { status: 500 }
        );
    }
}
