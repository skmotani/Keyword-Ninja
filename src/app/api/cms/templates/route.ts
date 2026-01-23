// GET /api/cms/templates - List all templates
// POST /api/cms/templates - Create template (admin)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// List all templates
export async function GET() {
    try {
        const templates = await (prisma.cmsTemplate as any).findMany({
            where: { isActive: true },
            include: {
                _count: {
                    select: { pages: true },
                },
            },
            orderBy: [
                { isSystem: 'desc' },
                { name: 'asc' },
            ],
        });

        return NextResponse.json({
            templates: templates.map((template) => ({
                id: template.id,
                name: template.name,
                slug: template.slug,
                description: template.description,
                type: template.type,
                thumbnail: template.thumbnail,
                sections: template.sections,
                isSystem: template.isSystem,
                pageCount: template._count.pages,
            })),
        });
    } catch (error) {
        console.error('CMS Templates GET error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch templates' },
            { status: 500 }
        );
    }
}

// Create new template
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            name,
            slug,
            description,
            type,
            thumbnail,
            sections,
            styles,
        } = body;

        if (!name || !slug || !type) {
            return NextResponse.json(
                { error: 'Name, slug, and type are required' },
                { status: 400 }
            );
        }

        // Check for duplicate slug
        const existing = await (prisma.cmsTemplate as any).findUnique({
            where: { slug },
        });

        if (existing) {
            return NextResponse.json(
                { error: 'Template slug already exists' },
                { status: 409 }
            );
        }

        const template = await (prisma.cmsTemplate as any).create({
            data: {
                name,
                slug,
                description,
                type,
                thumbnail,
                sections: sections || [],
                styles: styles || {},
                isSystem: false,
                isActive: true,
            },
        });

        return NextResponse.json({
            success: true,
            template: {
                id: template.id,
                name: template.name,
                slug: template.slug,
            },
        });
    } catch (error) {
        console.error('CMS Templates POST error:', error);
        return NextResponse.json(
            { error: 'Failed to create template' },
            { status: 500 }
        );
    }
}

