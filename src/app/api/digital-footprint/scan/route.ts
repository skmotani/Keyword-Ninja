import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    parseDomainsInput,
    crawlWebsite,
    generateBusinessProfile,
    collectAllEvidence,
    calculateFootprintScore,
    SURFACES
} from '@/lib/digital-footprint';

export const maxDuration = 120; // 2 minutes max

interface ScanRequest {
    domains: string;
    hints?: string;
}

export async function POST(request: NextRequest) {
    try {
        const body: ScanRequest = await request.json();

        if (!body.domains?.trim()) {
            return NextResponse.json({ error: 'Domains required' }, { status: 400 });
        }

        // Parse and normalize domains
        const domains = parseDomainsInput(body.domains, 5);

        if (domains.length === 0) {
            return NextResponse.json({ error: 'No valid domains found' }, { status: 400 });
        }

        // Create scan record
        const scan = await prisma.footprintScan.create({
            data: {
                domainsRaw: body.domains,
                hintsRaw: body.hints || null,
                totalDomains: domains.length,
                status: 'running',
            },
        });

        // Process each domain
        const domainResults = [];

        for (const domain of domains) {
            try {
                // Step 1: Crawl website
                const crawlResult = await crawlWebsite(domain);

                // Step 2: Generate profile
                const profile = await generateBusinessProfile({
                    domain,
                    crawlData: crawlResult.data,
                    hints: body.hints,
                });

                // Create domain scan record
                const domainScan = await prisma.domainScan.create({
                    data: {
                        scanId: scan.id,
                        domainRaw: domain,
                        domainNormalized: domain,
                        crawlStatus: crawlResult.success ? 'success' : 'failed',
                        finalUrl: crawlResult.finalUrl,
                        httpStatus: crawlResult.httpStatus,
                        crawlDataJson: crawlResult.data || null,
                        profileJson: profile,
                        businessType: profile.businessType,
                        industry: profile.industry,
                        geoScope: profile.geoScope,
                        brandName: profile.brandName,
                        brandVariants: profile.brandVariants,
                    },
                });

                // Step 3: Collect evidence for all surfaces
                const evidence = await collectAllEvidence(profile, domain, crawlResult.data);

                // Step 4: Calculate scores
                const score = calculateFootprintScore(evidence, profile);

                // Save surface results
                for (const ev of evidence) {
                    const surface = SURFACES[ev.surfaceKey];
                    const surfaceScore = score.surfaces.find(s => s.surfaceKey === ev.surfaceKey);

                    await prisma.surfaceResult.create({
                        data: {
                            domainScanId: domainScan.id,
                            category: surface?.category || 'unknown',
                            surfaceKey: ev.surfaceKey,
                            label: surface?.label || ev.surfaceKey,
                            status: ev.status,
                            confidence: ev.confidence,
                            weight: surfaceScore?.weight || 1,
                            relevance: surfaceScore?.relevance,
                            pointsAwarded: surfaceScore?.pointsAwarded || 0,
                            pointsMax: surfaceScore?.pointsMax || 0,
                            source: ev.source,
                            method: ev.method,
                            tooltipWhy: surface?.tooltips.why,
                            tooltipHow: surface?.tooltips.how,
                            tooltipAction: ev.status === 'present'
                                ? surface?.tooltips.actionPresent
                                : surface?.tooltips.actionAbsent,
                            evidenceJson: ev.evidence,
                            queriesUsedJson: ev.queriesUsed,
                        },
                    });
                }

                // Update domain scan with scores
                await prisma.domainScan.update({
                    where: { id: domainScan.id },
                    data: {
                        scoreTotal: score.totalAwarded,
                        scoreMax: score.totalMax,
                    },
                });

                domainResults.push({
                    domain,
                    success: true,
                    profile,
                    score,
                });

                // Update progress
                await prisma.footprintScan.update({
                    where: { id: scan.id },
                    data: { finishedDomains: { increment: 1 } },
                });

            } catch (error) {
                console.error(`Error processing domain ${domain}:`, error);
                domainResults.push({
                    domain,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        // Mark scan as complete
        await prisma.footprintScan.update({
            where: { id: scan.id },
            data: { status: 'completed' },
        });

        return NextResponse.json({
            scanId: scan.id,
            domains: domainResults,
        });

    } catch (error) {
        console.error('Scan error:', error);
        return NextResponse.json(
            { error: 'Failed to run scan' },
            { status: 500 }
        );
    }
}
