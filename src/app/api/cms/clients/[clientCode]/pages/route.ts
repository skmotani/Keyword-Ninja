// GET /api/cms/clients/[clientCode]/pages - List pages for client
// POST /api/cms/clients/[clientCode]/pages - Create new page

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface Params {
    params: { clientCode: string };
}

// List pages for client
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const { clientCode } = params;
        const url = new URL(request.url);
        const status = url.searchParams.get('status');
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        const pages = await prisma.cmsPage.findMany({
            where: {
                clientCode,
                ...(status ? { status } : {}),
            },
            include: {
                topic: {
                    select: { name: true, primaryKeyword: true },
                },
                template: {
                    select: { name: true, type: true },
                },
                createdBy: {
                    select: { name: true },
                },
                _count: {
                    select: { versions: true },
                },
            },
            orderBy: { updatedAt: 'desc' },
            take: limit,
            skip: offset,
        });

        const total = await prisma.cmsPage.count({
            where: {
                clientCode,
                ...(status ? { status } : {}),
            },
        });

        return NextResponse.json({
            pages: pages.map((page) => ({
                id: page.id,
                title: page.title,
                slug: page.slug,
                status: page.status,
                templateName: page.template.name,
                templateType: page.template.type,
                topicName: page.topic?.name,
                primaryKeyword: page.topic?.primaryKeyword,
                versionCount: page._count.versions,
                createdBy: page.createdBy?.name,
                publishedAt: page.publishedAt,
                scheduledAt: page.scheduledAt,
                updatedAt: page.updatedAt,
                createdAt: page.createdAt,
            })),
            total,
            limit,
            offset,
        });
    } catch (error) {
        console.error('CMS Pages GET error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch pages' },
            { status: 500 }
        );
    }
}

// Create new page
export async function POST(request: NextRequest, { params }: Params) {
    try {
        const { clientCode } = params;
        const body = await request.json();

        const {
            title,
            slug,
            templateId,
            topicId,
            content,
            metaDescription,
            metaKeywords,
            status = 'draft',
        } = body;

        // Validate required fields
        if (!title || !slug || !templateId) {
            return NextResponse.json(
                { error: 'Title, slug, and templateId are required' },
                { status: 400 }
            );
        }

        // Check for duplicate slug
        const existing = await prisma.cmsPage.findUnique({
            where: {
                clientCode_slug: { clientCode, slug },
            },
        });

        if (existing) {
            return NextResponse.json(
                { error: 'A page with this slug already exists' },
                { status: 409 }
            );
        }

        // Create page
        const page = await prisma.cmsPage.create({
            data: {
                clientCode,
                templateId,
                topicId,
                title,
                slug,
                content: content || {},
                metaDescription,
                metaKeywords,
                status,
            },
        });

        // Create initial version
        await prisma.cmsPageVersion.create({
            data: {
                pageId: page.id,
                version: 1,
                title: page.title,
                content: page.content as object,
                changeNote: 'Initial version',
            },
        });

        // Update topic status if linked
        if (topicId) {
            await prisma.cmsTopic.update({
                where: { id: topicId },
                data: { status: 'in_progress' },
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
        console.error('CMS Pages POST error:', error);
        return NextResponse.json(
            { error: 'Failed to create page' },
            { status: 500 }
        );
    }
}
