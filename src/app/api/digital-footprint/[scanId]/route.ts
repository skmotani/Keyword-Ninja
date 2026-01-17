import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: { scanId: string } }
) {
    try {
        const { scanId } = params;

        const scan = await prisma.footprintScan.findUnique({
            where: { id: scanId },
            include: {
                domainScans: {
                    include: {
                        surfaceResults: {
                            orderBy: [
                                { category: 'asc' },
                                { pointsMax: 'desc' },
                            ],
                        },
                    },
                },
            },
        });

        if (!scan) {
            return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
        }

        // Transform for frontend
        const result = {
            id: scan.id,
            createdAt: scan.createdAt,
            status: scan.status,
            totalDomains: scan.totalDomains,
            finishedDomains: scan.finishedDomains,
            domains: scan.domainScans.map(ds => ({
                id: ds.id,
                domain: ds.domainNormalized,
                profile: {
                    brandName: ds.brandName,
                    businessType: ds.businessType,
                    industry: ds.industry,
                    geoScope: ds.geoScope,
                    variants: ds.brandVariants,
                },
                score: {
                    total: ds.scoreTotal,
                    max: ds.scoreMax,
                    percentage: ds.scoreMax > 0 ? Math.round((ds.scoreTotal / ds.scoreMax) * 100) : 0,
                },
                crawlStatus: ds.crawlStatus,
                surfaces: ds.surfaceResults.map(sr => ({
                    key: sr.surfaceKey,
                    label: sr.label,
                    category: sr.category,
                    status: sr.status,
                    relevance: sr.relevance,
                    pointsAwarded: sr.pointsAwarded,
                    pointsMax: sr.pointsMax,
                    confidence: sr.confidence,
                    tooltips: {
                        why: sr.tooltipWhy,
                        how: sr.tooltipHow,
                        action: sr.tooltipAction,
                    },
                    evidence: sr.evidenceJson,
                })),
            })),
        };

        return NextResponse.json(result);

    } catch (error) {
        console.error('Get scan error:', error);
        return NextResponse.json(
            { error: 'Failed to get scan' },
            { status: 500 }
        );
    }
}
