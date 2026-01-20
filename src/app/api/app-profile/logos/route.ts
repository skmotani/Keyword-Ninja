import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';

// In production (Railway), use the mounted volume at /app/data
// Locally, use public/uploads for easy serving
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const UPLOAD_DIR = IS_PRODUCTION
    ? path.join('/app', 'data', 'uploads', 'logos')
    : path.join(process.cwd(), 'public', 'uploads', 'logos');

// Ensure upload directory exists
async function ensureUploadDir() {
    try {
        await mkdir(UPLOAD_DIR, { recursive: true });
    } catch {
        // Directory exists
    }
}

// POST /api/app-profile/logos - Upload a new logo
export async function POST(request: Request) {
    try {
        await ensureUploadDir();

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const name = formData.get('name') as string || 'Logo';
        const isPrimary = formData.get('isPrimary') === 'true';

        if (!file) {
            return NextResponse.json(
                { success: false, error: 'No file provided' },
                { status: 400 }
            );
        }

        // Generate unique filename
        const ext = path.extname(file.name);
        const filename = `logo_${Date.now()}${ext}`;
        const filepath = path.join(UPLOAD_DIR, filename);

        // In production, serve via API; locally, serve from public
        const url = IS_PRODUCTION
            ? `/api/app-profile/logos/serve?file=${filename}`
            : `/uploads/logos/${filename}`;

        // Write file to disk
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filepath, buffer);

        // Get or create profile
        let profile = await prisma.appProfile.findUnique({ where: { key: 'primary' } });
        if (!profile) {
            profile = await prisma.appProfile.create({
                data: { key: 'primary', appName: 'Keyword Ninja' }
            });
        }

        // If setting as primary, unset other primaries first
        if (isPrimary) {
            await prisma.appLogo.updateMany({
                where: { profileId: profile.id },
                data: { isPrimary: false }
            });
        }

        // Create logo record
        const logo = await prisma.appLogo.create({
            data: {
                profileId: profile.id,
                name,
                filename,
                mimeType: file.type,
                size: file.size,
                url,
                isPrimary
            }
        });

        return NextResponse.json({ success: true, logo });
    } catch (error) {
        console.error('Failed to upload logo:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to upload logo' },
            { status: 500 }
        );
    }
}

// DELETE /api/app-profile/logos?id=xxx - Delete a logo
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Logo ID required' },
                { status: 400 }
            );
        }

        // Get logo to delete file
        const logo = await prisma.appLogo.findUnique({ where: { id } });
        if (!logo) {
            return NextResponse.json(
                { success: false, error: 'Logo not found' },
                { status: 404 }
            );
        }

        // Delete file from disk
        try {
            const filepath = path.join(UPLOAD_DIR, logo.filename);
            await unlink(filepath);
        } catch {
            // File may not exist
        }

        // Delete from database
        await prisma.appLogo.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete logo:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete logo' },
            { status: 500 }
        );
    }
}

// PATCH /api/app-profile/logos?id=xxx - Update logo (set primary)
export async function PATCH(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const body = await request.json();

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Logo ID required' },
                { status: 400 }
            );
        }

        const logo = await prisma.appLogo.findUnique({ where: { id } });
        if (!logo) {
            return NextResponse.json(
                { success: false, error: 'Logo not found' },
                { status: 404 }
            );
        }

        // If setting as primary, unset others first
        if (body.isPrimary) {
            await prisma.appLogo.updateMany({
                where: { profileId: logo.profileId },
                data: { isPrimary: false }
            });
        }

        const updated = await prisma.appLogo.update({
            where: { id },
            data: {
                name: body.name ?? undefined,
                isPrimary: body.isPrimary ?? undefined
            }
        });

        return NextResponse.json({ success: true, logo: updated });
    } catch (error) {
        console.error('Failed to update logo:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update logo' },
            { status: 500 }
        );
    }
}
