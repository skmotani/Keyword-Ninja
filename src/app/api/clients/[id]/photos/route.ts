import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const MAX_PHOTOS = 5;
const PHOTOS_DIR = path.join(process.cwd(), 'data', 'client-photos');
const CLIENTS_FILE = path.join(process.cwd(), 'data', 'clients.json');

interface Client {
    id: string;
    code: string;
    name: string;
    brandPhotos?: string[];
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

async function writeClients(clients: Client[]): Promise<void> {
    await fs.writeFile(CLIENTS_FILE, JSON.stringify(clients, null, 2), 'utf-8');
}

async function ensureDir(dir: string): Promise<void> {
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch {
        // Directory might already exist
    }
}

// POST - Upload a brand photo
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const clients = await readClients();
        const clientIndex = clients.findIndex(c => c.id === id);

        if (clientIndex === -1) {
            return NextResponse.json(
                { success: false, error: 'Client not found' },
                { status: 404 }
            );
        }

        const client = clients[clientIndex];
        const currentPhotos = client.brandPhotos || [];

        if (currentPhotos.length >= MAX_PHOTOS) {
            return NextResponse.json(
                { success: false, error: `Maximum ${MAX_PHOTOS} photos allowed` },
                { status: 400 }
            );
        }

        const formData = await request.formData();
        const file = formData.get('photo') as File;

        if (!file) {
            return NextResponse.json(
                { success: false, error: 'No photo file provided' },
                { status: 400 }
            );
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            return NextResponse.json(
                { success: false, error: 'File must be an image' },
                { status: 400 }
            );
        }

        // Create client photos directory
        const clientPhotosDir = path.join(PHOTOS_DIR, client.code);
        await ensureDir(clientPhotosDir);

        // Generate unique filename
        const ext = file.name.split('.').pop() || 'jpg';
        const timestamp = Date.now();
        const filename = `photo_${timestamp}.${ext}`;
        const filePath = path.join(clientPhotosDir, filename);
        const relativePath = `/api/clients/${id}/photos/${filename}`;

        // Save the file
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await fs.writeFile(filePath, buffer);

        // Update client record
        const updatedPhotos = [...currentPhotos, relativePath];
        clients[clientIndex].brandPhotos = updatedPhotos;
        await writeClients(clients);

        return NextResponse.json({
            success: true,
            photo: relativePath,
            photos: updatedPhotos,
        });
    } catch (error) {
        console.error('Failed to upload photo:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to upload photo' },
            { status: 500 }
        );
    }
}

// GET - List all photos for a client
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const clients = await readClients();
        const client = clients.find(c => c.id === id);

        if (!client) {
            return NextResponse.json(
                { success: false, error: 'Client not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            photos: client.brandPhotos || [],
        });
    } catch (error) {
        console.error('Failed to get photos:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to get photos' },
            { status: 500 }
        );
    }
}

// DELETE - Remove a photo
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const photoPath = searchParams.get('photo');

        if (!photoPath) {
            return NextResponse.json(
                { success: false, error: 'Photo path required' },
                { status: 400 }
            );
        }

        const clients = await readClients();
        const clientIndex = clients.findIndex(c => c.id === id);

        if (clientIndex === -1) {
            return NextResponse.json(
                { success: false, error: 'Client not found' },
                { status: 404 }
            );
        }

        const client = clients[clientIndex];
        const currentPhotos = client.brandPhotos || [];

        // Remove from array
        const updatedPhotos = currentPhotos.filter(p => p !== photoPath);

        // Try to delete file
        const filename = photoPath.split('/').pop();
        if (filename) {
            const filePath = path.join(PHOTOS_DIR, client.code, filename);
            try {
                await fs.unlink(filePath);
            } catch {
                // File might not exist
            }
        }

        // Update client record
        clients[clientIndex].brandPhotos = updatedPhotos;
        await writeClients(clients);

        return NextResponse.json({
            success: true,
            photos: updatedPhotos,
        });
    } catch (error) {
        console.error('Failed to delete photo:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete photo' },
            { status: 500 }
        );
    }
}
