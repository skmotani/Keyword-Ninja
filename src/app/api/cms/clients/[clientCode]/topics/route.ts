// GET /api/cms/clients/[clientCode]/topics - List topics
// POST /api/cms/clients/[clientCode]/topics - Import topics from Intent Analysis

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface Params {
    params: { clientCode: string };
}

// List topics for client
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const { clientCode } = params;
        const url = new URL(request.url);
        const status = url.searchParams.get('status');
        const clusterId = url.searchParams.get('clusterId');

        const topics = await prisma.cmsTopic.findMany({
            where: {
                clientCode,
                ...(status ? { status } : {}),
                ...(clusterId ? { clusterId } : {}),
            },
            include: {
                cluster: {
                    select: { name: true },
                },
                page: {
                    select: { id: true, title: true, slug: true, status: true },
                },
            },
            orderBy: [
                { priority: 'desc' },
                { searchVolume: 'desc' },
            ],
        });

        // Calculate stats
        const stats = {
            total: topics.length,
            pending: topics.filter((t) => t.status === 'pending').length,
            inProgress: topics.filter((t) => t.status === 'in_progress').length,
            completed: topics.filter((t) => t.status === 'completed').length,
            skipped: topics.filter((t) => t.status === 'skipped').length,
        };

        return NextResponse.json({
            topics: topics.map((topic) => ({
                id: topic.id,
                name: topic.name,
                slug: topic.slug,
                primaryKeyword: topic.primaryKeyword,
                keywords: topic.keywords,
                searchVolume: topic.searchVolume,
                intentType: topic.intentType,
                intentScore: topic.intentScore,
                status: topic.status,
                priority: topic.priority,
                clusterName: topic.cluster?.name,
                page: topic.page,
                createdAt: topic.createdAt,
            })),
            stats,
        });
    } catch (error) {
        console.error('CMS Topics GET error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch topics' },
            { status: 500 }
        );
    }
}

// Import topics (from Intent Analysis or manual)
export async function POST(request: NextRequest, { params }: Params) {
    try {
        const { clientCode } = params;
        const body = await request.json();
        const { topics, clusterId, clusterName } = body;

        if (!topics || !Array.isArray(topics) || topics.length === 0) {
            return NextResponse.json(
                { error: 'Topics array is required' },
                { status: 400 }
            );
        }

        // Create or get cluster if provided
        let targetClusterId = clusterId;
        if (clusterName && !clusterId) {
            const cluster = await prisma.cmsCluster.upsert({
                where: {
                    clientCode_name: { clientCode, name: clusterName },
                },
                update: {},
                create: {
                    clientCode,
                    name: clusterName,
                },
            });
            targetClusterId = cluster.id;
        }

        // Generate unique slugs and insert topics
        const importedTopics = [];
        const errors = [];

        for (const topicData of topics) {
            try {
                // Generate slug from name
                const baseSlug = topicData.slug || topicData.name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '');

                // Check if slug exists and make unique if needed
                let slug = baseSlug;
                let counter = 1;
                while (true) {
                    const existing = await prisma.cmsTopic.findUnique({
                        where: { clientCode_slug: { clientCode, slug } },
                    });
                    if (!existing) break;
                    slug = `${baseSlug}-${counter}`;
                    counter++;
                }

                const topic = await prisma.cmsTopic.create({
                    data: {
                        clientCode,
                        clusterId: targetClusterId,
                        name: topicData.name,
                        slug,
                        primaryKeyword: topicData.primaryKeyword || topicData.name,
                        keywords: topicData.keywords || [],
                        searchVolume: topicData.searchVolume || 0,
                        intentType: topicData.intentType,
                        intentScore: topicData.intentScore,
                        priority: topicData.priority || 0,
                        sourceData: topicData.sourceData,
                        status: 'pending',
                    },
                });

                importedTopics.push(topic);
            } catch (err) {
                errors.push({
                    topic: topicData.name,
                    error: err instanceof Error ? err.message : 'Unknown error',
                });
            }
        }

        return NextResponse.json({
            success: true,
            imported: importedTopics.length,
            errors: errors.length > 0 ? errors : undefined,
            topics: importedTopics.map((t) => ({
                id: t.id,
                name: t.name,
                slug: t.slug,
            })),
        });
    } catch (error) {
        console.error('CMS Topics POST error:', error);
        return NextResponse.json(
            { error: 'Failed to import topics' },
            { status: 500 }
        );
    }
}
