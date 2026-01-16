// GET /api/cms/clients - List clients with CMS config
// POST /api/cms/clients - Create new client with CMS config

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// List all clients with CMS stats
export async function GET(request: NextRequest) {
    try {
        const clients = await prisma.client.findMany({
            where: { isActive: true },
            include: {
                cmsConfig: true,
                _count: {
                    select: {
                        cmsPages: true,
                        cmsTopics: true,
                    },
                },
            },
            orderBy: { name: 'asc' },
        });

        const formattedClients = clients.map((client) => ({
            id: client.id,
            code: client.code,
            name: client.name,
            mainDomain: client.mainDomain,
            domains: client.domains,
            industry: client.industry,
            isActive: client.isActive,
            cmsEnabled: !!client.cmsConfig,
            cmsSlug: client.cmsConfig?.slug,
            pageCount: client._count.cmsPages,
            topicCount: client._count.cmsTopics,
        }));

        return NextResponse.json(formattedClients);
    } catch (error) {
        console.error('CMS Clients GET error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch clients' },
            { status: 500 }
        );
    }
}

// Create new client with CMS config
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            name,
            code,
            mainDomain,
            domains = [],
            industry,
            notes,
            // CMS Config
            cmsSlug,
            cfApiToken,
            cfZoneId,
            autoPublish = false,
            requireReview = true,
        } = body;

        // Validate required fields
        if (!name || !code) {
            return NextResponse.json(
                { error: 'Name and code are required' },
                { status: 400 }
            );
        }

        // Check for duplicate code
        const existing = await prisma.client.findUnique({
            where: { code },
        });

        if (existing) {
            return NextResponse.json(
                { error: 'Client code already exists' },
                { status: 409 }
            );
        }

        // Create client with optional CMS config
        const client = await prisma.client.create({
            data: {
                name,
                code,
                mainDomain,
                domains,
                industry,
                notes,
                isActive: true,
                // Create CMS config if slug provided
                cmsConfig: cmsSlug
                    ? {
                        create: {
                            slug: cmsSlug,
                            cfApiToken,
                            cfZoneId,
                            autoPublish,
                            requireReview,
                        },
                    }
                    : undefined,
            },
            include: {
                cmsConfig: true,
            },
        });

        return NextResponse.json({
            success: true,
            client: {
                id: client.id,
                code: client.code,
                name: client.name,
                cmsSlug: client.cmsConfig?.slug,
            },
        });
    } catch (error) {
        console.error('CMS Clients POST error:', error);
        return NextResponse.json(
            { error: 'Failed to create client' },
            { status: 500 }
        );
    }
}
