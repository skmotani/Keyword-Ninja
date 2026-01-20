import { NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';

// In production (Railway), files are stored in the volume at /app/data
const UPLOAD_DIR = path.join('/app', 'data', 'uploads', 'logos');

// GET /api/app-profile/logos/serve?file=xxx - Serve a logo file from volume
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const filename = searchParams.get('file');

        if (!filename) {
            return NextResponse.json(
                { error: 'File parameter required' },
                { status: 400 }
            );
        }

        // Sanitize filename to prevent directory traversal
        const sanitizedFilename = path.basename(filename);
        const filepath = path.join(UPLOAD_DIR, sanitizedFilename);

        // Check if file exists
        try {
            await stat(filepath);
        } catch {
            return NextResponse.json(
                { error: 'File not found' },
                { status: 404 }
            );
        }

        // Read and serve the file
        const fileBuffer = await readFile(filepath);

        // Determine content type from extension
        const ext = path.extname(sanitizedFilename).toLowerCase();
        const contentTypes: Record<string, string> = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
        };
        const contentType = contentTypes[ext] || 'application/octet-stream';

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error) {
        console.error('Failed to serve logo:', error);
        return NextResponse.json(
            { error: 'Failed to serve file' },
            { status: 500 }
        );
    }
}
