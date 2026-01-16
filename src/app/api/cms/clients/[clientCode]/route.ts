// GET /api/cms/clients/[clientCode] - Get client details
// PUT /api/cms/clients/[clientCode] - Update client
// DELETE /api/cms/clients/[clientCode] - Delete client

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface Params {
    params: { clientCode: string };
}

// Get client details with CMS stats
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const { clientCode } = params;

        const client = await prisma.client.findUnique({
            where: { code: clientCode },
            include: {
                cmsConfig: true,
                cmsPages: {
                    select: {
                        id: true,
                        title: true,
                        slug: true,
                        status: true,
                        publishedAt: true,
                        updatedAt: true,
                    },
                    orderBy: { updatedAt: 'desc' },
                    take: 10,
                },
                cmsTopics: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        searchVolume: true,
                    },
                    where: { status: 'pending' },
                    take: 10,
                },
                _count: {
                    select: {
                        cmsPages: true,
                        cmsTopics: true,
                    },
                },
            },
        });

        if (!client) {
            return NextResponse.json(
                { error: 'Client not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            id: client.id,
            code: client.code,
            name: client.name,
            mainDomain: client.mainDomain,
            domains: client.domains,
            industry: client.industry,
            notes: client.notes,
            isActive: client.isActive,
            businessMetrics: client.businessMetrics,
            cmsConfig: client.cmsConfig,
            recentPages: client.cmsPages,
            pendingTopics: client.cmsTopics,
            stats: {
                pageCount: client._count.cmsPages,
                topicCount: client._count.cmsTopics,
                publishedCount: client.cmsPages.filter((p) => p.status === 'published').length,
            },
        });
    } catch (error) {
        console.error('CMS Client GET error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch client' },
            { status: 500 }
        );
    }
}

// Update client and/or CMS config
export async function PUT(request: NextRequest, { params }: Params) {
    try {
        const { clientCode } = params;
        const body = await request.json();

        const {
            name,
            mainDomain,
            domains,
            industry,
            notes,
            isActive,
            businessMetrics,
            // CMS Config updates
            cmsConfig,
        } = body;

        // Update client
        const client = await prisma.client.update({
            where: { code: clientCode },
            data: {
                name,
                mainDomain,
                domains,
                industry,
                notes,
                isActive,
                businessMetrics,
            },
        });

        // Update CMS config if provided
        if (cmsConfig) {
            await prisma.cmsClientConfig.upsert({
                where: { clientCode },
                update: {
                    slug: cmsConfig.slug,
                    logo: cmsConfig.logo,
                    cfApiToken: cmsConfig.cfApiToken,
                    cfZoneId: cmsConfig.cfZoneId,
                    cfAccountId: cmsConfig.cfAccountId,
                    defaultOgImage: cmsConfig.defaultOgImage,
                    robotsTxt: cmsConfig.robotsTxt,
                    gaTrackingId: cmsConfig.gaTrackingId,
                    gscPropertyUrl: cmsConfig.gscPropertyUrl,
                    autoPublish: cmsConfig.autoPublish,
                    requireReview: cmsConfig.requireReview,
                    openaiApiKey: cmsConfig.openaiApiKey,
                },
                create: {
                    clientCode,
                    slug: cmsConfig.slug || clientCode,
                    ...cmsConfig,
                },
            });
        }

        return NextResponse.json({
            success: true,
            client: {
                id: client.id,
                code: client.code,
                name: client.name,
            },
        });
    } catch (error) {
        console.error('CMS Client PUT error:', error);
        return NextResponse.json(
            { error: 'Failed to update client' },
            { status: 500 }
        );
    }
}

// Delete client (soft delete by setting isActive = false)
export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const { clientCode } = params;
        const url = new URL(request.url);
        const hardDelete = url.searchParams.get('hard') === 'true';

        if (hardDelete) {
            // Hard delete - removes all related data
            await prisma.client.delete({
                where: { code: clientCode },
            });
        } else {
            // Soft delete
            await prisma.client.update({
                where: { code: clientCode },
                data: { isActive: false },
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('CMS Client DELETE error:', error);
        return NextResponse.json(
            { error: 'Failed to delete client' },
            { status: 500 }
        );
    }
}
