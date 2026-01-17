import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const PHOTOS_DIR = path.join(process.cwd(), 'data', 'client-photos');
const CLIENTS_FILE = path.join(process.cwd(), 'data', 'clients.json');

interface Client {
    id: string;
    code: string;
    [key: string]: unknown;
}

async function readClients(): Promise<Client[]> {
    try {
        const data = await fs.readFile(CLIENTS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

// GET - Serve a photo file
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; filename: string }> }
) {
    try {
        const { id, filename } = await params;

        // Find client to get code
        const clients = await readClients();
        const client = clients.find(c => c.id === id);

        if (!client) {
            return NextResponse.json(
                { error: 'Client not found' },
                { status: 404 }
            );
        }

        const filePath = path.join(PHOTOS_DIR, client.code, filename);

        try {
            const file = await fs.readFile(filePath);

            // Determine content type from extension
            const ext = filename.split('.').pop()?.toLowerCase();
            let contentType = 'image/jpeg';
            if (ext === 'png') contentType = 'image/png';
            else if (ext === 'gif') contentType = 'image/gif';
            else if (ext === 'webp') contentType = 'image/webp';
            else if (ext === 'svg') contentType = 'image/svg+xml';

            return new NextResponse(file, {
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': 'public, max-age=31536000',
                },
            });
        } catch {
            return NextResponse.json(
                { error: 'Photo not found' },
                { status: 404 }
            );
        }
    } catch (error) {
        console.error('Failed to serve photo:', error);
        return NextResponse.json(
            { error: 'Failed to serve photo' },
            { status: 500 }
        );
    }
}
