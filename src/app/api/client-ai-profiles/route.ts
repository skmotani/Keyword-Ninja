import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

export async function GET() {
    try {
        const filePath = path.join(DATA_DIR, 'client_ai_profiles.json');
        const data = await fs.readFile(filePath, 'utf-8');
        const profiles = JSON.parse(data);

        return NextResponse.json({
            success: true,
            profiles,
            count: profiles.length
        });
    } catch (error) {
        console.error('Failed to read AI profiles:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to read AI profiles', profiles: [] },
            { status: 500 }
        );
    }
}
