// GET /api/cms/clients/[clientCode]/pages/[pageId] - Get page details
// PUT /api/cms/clients/[clientCode]/pages/[pageId] - Update page
// DELETE /api/cms/clients/[clientCode]/pages/[pageId] - Delete page

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface Params {
    params: { clientCode: string; pageId: string };
}

// Get page details
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const { pageId } = params;

        const page = await prisma.cmsPage.findUnique({
            where: { id: pageId },
            include: {
                topic: true,
                template: true,
                versions: {
                    orderBy: { version: 'desc' },
                    take: 10,
                    include: {
                        createdBy: {
                            select: { name: true },
                        },
                    },
                },
                createdBy: {
                    select: { id: true, name: true, email: true },
                },
                reviewedBy: {
                    select: { id: true, name: true, email: true },
                },
            },
        });

        if (!page) {
            return NextResponse.json(
                { error: 'Page not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(page);
    } catch (error) {
        console.error('CMS Page GET error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch page' },
            { status: 500 }
        );
    }
}

// Update page
export async function PUT(request: NextRequest, { params }: Params) {
    try {
        const { pageId } = params;
        const body = await request.json();

        const {
            title,
            slug,
            content,
            metaDescription,
            metaKeywords,
            canonicalUrl,
            structuredData,
            ogTitle,
            ogDescription,
            ogImage,
            status,
            scheduledAt,
            changeNote,
        } = body;

        // Get current page for version comparison
        const currentPage = await prisma.cmsPage.findUnique({
            where: { id: pageId },
        });

        if (!currentPage) {
            return NextResponse.json(
                { error: 'Page not found' },
                { status: 404 }
            );
        }

        // Update page
        const page = await prisma.cmsPage.update({
            where: { id: pageId },
            data: {
                title,
                slug,
                content,
                metaDescription,
                metaKeywords,
                canonicalUrl,
                structuredData,
                ogTitle,
                ogDescription,
                ogImage,
                status,
                scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
                publishedAt: status === 'published' && !currentPage.publishedAt
                    ? new Date()
                    : undefined,
            },
        });

        // Create new version if content changed
        if (content && JSON.stringify(content) !== JSON.stringify(currentPage.content)) {
            const lastVersion = await prisma.cmsPageVersion.findFirst({
                where: { pageId },
                orderBy: { version: 'desc' },
            });

            await prisma.cmsPageVersion.create({
                data: {
                    pageId,
                    version: (lastVersion?.version || 0) + 1,
                    title: page.title,
                    content: content as object,
                    changeNote,
                },
            });
        }

        // Update topic status if page is published
        if (status === 'published' && page.topicId) {
            await prisma.cmsTopic.update({
                where: { id: page.topicId },
                data: { status: 'completed' },
            });
        }

        return NextResponse.json({
            success: true,
            page: {
                id: page.id,
                title: page.title,
                slug: page.slug,
                status: page.status,
            },
        });
    } catch (error) {
        console.error('CMS Page PUT error:', error);
        return NextResponse.json(
            { error: 'Failed to update page' },
            { status: 500 }
        );
    }
}

// Delete page
export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const { pageId } = params;

        // Get page to check for linked topic
        const page = await prisma.cmsPage.findUnique({
            where: { id: pageId },
        });

        if (!page) {
            return NextResponse.json(
                { error: 'Page not found' },
                { status: 404 }
            );
        }

        // Delete page (versions will cascade delete)
        await prisma.cmsPage.delete({
            where: { id: pageId },
        });

        // Reset topic status if linked
        if (page.topicId) {
            await prisma.cmsTopic.update({
                where: { id: page.topicId },
                data: { status: 'pending' },
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('CMS Page DELETE error:', error);
        return NextResponse.json(
            { error: 'Failed to delete page' },
            { status: 500 }
        );
    }
}
