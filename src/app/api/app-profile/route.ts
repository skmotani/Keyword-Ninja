import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/app-profile - Fetch app profile with logos
export async function GET() {
    try {
        // Get or create the primary profile
        let profile = await prisma.appProfile.findUnique({
            where: { key: 'primary' },
            include: { logos: { orderBy: { createdAt: 'desc' } } }
        });

        if (!profile) {
            // Create default profile
            profile = await prisma.appProfile.create({
                data: {
                    key: 'primary',
                    appName: 'Keyword Ninja',
                    tagline: 'SEO Intelligence Platform',
                    punchline: 'Your SEO Partner for Growth',
                    metaTitle: 'Keyword Ninja - SEO Intelligence Platform',
                    metaDescription: 'Advanced SEO analysis and keyword research tool for digital marketers.',
                    customFields: {}
                },
                include: { logos: true }
            });
        }

        return NextResponse.json({ success: true, profile });
    } catch (error) {
        console.error('Failed to fetch app profile:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch app profile' },
            { status: 500 }
        );
    }
}

// PUT /api/app-profile - Update app profile
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { appName, tagline, punchline, metaTitle, metaDescription, customFields } = body;

        const profile = await prisma.appProfile.upsert({
            where: { key: 'primary' },
            update: {
                appName: appName ?? undefined,
                tagline: tagline ?? undefined,
                punchline: punchline ?? undefined,
                metaTitle: metaTitle ?? undefined,
                metaDescription: metaDescription ?? undefined,
                customFields: customFields ?? undefined,
            },
            create: {
                key: 'primary',
                appName: appName || 'Keyword Ninja',
                tagline,
                punchline,
                metaTitle,
                metaDescription,
                customFields: customFields || {}
            },
            include: { logos: true }
        });

        return NextResponse.json({ success: true, profile });
    } catch (error) {
        console.error('Failed to update app profile:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update app profile' },
            { status: 500 }
        );
    }
}
