// Sitemap.xml for client feed
// /feed/[clientSlug]/sitemap.xml/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSitemap } from '@/lib/cms/seo/sitemap';

interface Params {
    params: { clientSlug: string };
}

export async function GET(request: NextRequest, { params }: Params) {
    try {
        const { clientSlug } = params;

        // Get client config
        const cmsConfig = await prisma.cmsClientConfig.findUnique({
            where: { slug: clientSlug },
            include: {
                client: {
                    include: {
                        cmsPages: {
                            where: { status: 'published' },
                            select: {
                                slug: true,
                                updatedAt: true,
                                status: true,
                            },
                        },
                    },
                },
            },
        });

        if (!cmsConfig) {
            return new NextResponse('Client not found', { status: 404 });
        }

        const baseUrl = `https://${cmsConfig.client.mainDomain}`;

        const urls = cmsConfig.client.cmsPages.map((page) => ({
            loc: `${baseUrl}/feed/${clientSlug}/${page.slug}`,
            lastmod: page.updatedAt.toISOString().split('T')[0],
            changefreq: 'weekly' as const,
            priority: 0.8,
        }));

        // Add the feed index page
        urls.unshift({
            loc: `${baseUrl}/feed/${clientSlug}`,
            lastmod: new Date().toISOString().split('T')[0],
            changefreq: 'daily' as const,
            priority: 1.0,
        });

        const sitemapXml = generateSitemap({
            baseUrl,
            urls,
        });

        return new NextResponse(sitemapXml, {
            headers: {
                'Content-Type': 'application/xml',
                'Cache-Control': 'public, max-age=3600, s-maxage=3600',
            },
        });
    } catch (error) {
        console.error('Sitemap generation error:', error);
        return new NextResponse('Error generating sitemap', { status: 500 });
    }
}
