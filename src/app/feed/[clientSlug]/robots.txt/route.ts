// Robots.txt for client feed
// /feed/[clientSlug]/robots.txt/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateRobotsTxt } from '@/lib/cms/seo/sitemap';

interface Params {
    params: { clientSlug: string };
}

export async function GET(request: NextRequest, { params }: Params) {
    try {
        const { clientSlug } = params;

        // Get client config
        const cmsConfig = await prisma.cmsClientConfig.findUnique({
            where: { slug: clientSlug },
            include: { client: true },
        });

        if (!cmsConfig) {
            return new NextResponse('Client not found', { status: 404 });
        }

        const baseUrl = `https://${cmsConfig.client.mainDomain}`;

        // Use custom robots.txt if configured, otherwise generate
        const robotsTxt = cmsConfig.robotsTxt || generateRobotsTxt({
            baseUrl,
            clientSlug,
            disallowPaths: [
                '/api/',
                '/admin/',
                '/cms/',
                '/*.json$',
            ],
        });

        return new NextResponse(robotsTxt, {
            headers: {
                'Content-Type': 'text/plain',
                'Cache-Control': 'public, max-age=86400, s-maxage=86400',
            },
        });
    } catch (error) {
        console.error('Robots.txt generation error:', error);
        return new NextResponse('Error generating robots.txt', { status: 500 });
    }
}
