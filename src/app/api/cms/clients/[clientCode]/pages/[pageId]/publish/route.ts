// POST /api/cms/clients/[clientCode]/pages/[pageId]/publish - Publish page

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { submitSingleUrl, generateIndexNowKey } from '@/lib/cms/seo/indexnow';

interface Params {
    params: { clientCode: string; pageId: string };
}

export async function POST(request: NextRequest, { params }: Params) {
    try {
        const { clientCode, pageId } = params;
        const body = await request.json();
        const { action = 'publish', scheduledAt } = body;

        // Get page
        const page = await prisma.cmsPage.findUnique({
            where: { id: pageId },
            include: {
                client: {
                    include: { cmsConfig: true },
                },
            },
        });

        if (!page) {
            return NextResponse.json(
                { error: 'Page not found' },
                { status: 404 }
            );
        }

        let newStatus = page.status;
        let publishedAt = page.publishedAt;

        switch (action) {
            case 'publish':
                newStatus = 'published';
                publishedAt = new Date();
                break;

            case 'schedule':
                if (!scheduledAt) {
                    return NextResponse.json(
                        { error: 'scheduledAt is required for scheduling' },
                        { status: 400 }
                    );
                }
                newStatus = 'scheduled';
                break;

            case 'unpublish':
                newStatus = 'draft';
                break;

            case 'archive':
                newStatus = 'archived';
                break;

            case 'submit_review':
                newStatus = 'review';
                break;

            default:
                return NextResponse.json(
                    { error: 'Invalid action' },
                    { status: 400 }
                );
        }

        // Update page status
        const updatedPage = await prisma.cmsPage.update({
            where: { id: pageId },
            data: {
                status: newStatus,
                publishedAt: action === 'publish' ? publishedAt : undefined,
                scheduledAt: action === 'schedule' ? new Date(scheduledAt) : undefined,
                archivedAt: action === 'archive' ? new Date() : undefined,
            },
        });

        // Update topic status
        if (page.topicId) {
            let topicStatus = 'in_progress';
            if (newStatus === 'published') topicStatus = 'completed';
            if (newStatus === 'archived') topicStatus = 'skipped';

            await prisma.cmsTopic.update({
                where: { id: page.topicId },
                data: { status: topicStatus },
            });
        }

        // Submit to IndexNow if published and config exists
        let indexNowResult = null;
        if (action === 'publish' && page.client.cmsConfig?.cfZoneId) {
            const cmsConfig = page.client.cmsConfig;
            const domain = page.client.mainDomain;

            if (domain) {
                const pageUrl = `https://${domain}/feed/${cmsConfig.slug}/${page.slug}`;
                // Use a generated key or stored one
                const indexNowKey = generateIndexNowKey();

                indexNowResult = await submitSingleUrl(domain, indexNowKey, pageUrl);
            }
        }

        // Create publish job record
        await prisma.cmsPublishJob.create({
            data: {
                clientCode,
                pageId,
                type: action === 'publish' ? 'single_page' : action,
                status: 'completed',
                result: JSON.parse(JSON.stringify({
                    action,
                    newStatus,
                    indexNow: indexNowResult,
                })) as Prisma.InputJsonValue,
                completedAt: new Date(),
            },
        });

        return NextResponse.json({
            success: true,
            page: {
                id: updatedPage.id,
                status: updatedPage.status,
                publishedAt: updatedPage.publishedAt,
                scheduledAt: updatedPage.scheduledAt,
            },
            indexNow: indexNowResult,
        });
    } catch (error) {
        console.error('CMS Publish error:', error);
        return NextResponse.json(
            { error: 'Failed to publish page' },
            { status: 500 }
        );
    }
}
