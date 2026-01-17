import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const scans = await prisma.footprintScan.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
                domainScans: {
                    select: {
                        domainNormalized: true,
                        scoreTotal: true,
                        scoreMax: true,
                        brandName: true,
                    },
                },
            },
        });

        const result = scans.map(scan => ({
            id: scan.id,
            createdAt: scan.createdAt,
            status: scan.status,
            totalDomains: scan.totalDomains,
            finishedDomains: scan.finishedDomains,
            domains: scan.domainScans.map(ds => ({
                domain: ds.domainNormalized,
                brandName: ds.brandName,
                score: ds.scoreMax > 0 ? Math.round((ds.scoreTotal / ds.scoreMax) * 100) : 0,
            })),
        }));

        return NextResponse.json(result);

    } catch (error) {
        console.error('History error:', error);
        return NextResponse.json(
            { error: 'Failed to get history' },
            { status: 500 }
        );
    }
}
