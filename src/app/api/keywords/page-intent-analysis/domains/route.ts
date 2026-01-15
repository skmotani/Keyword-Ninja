/**
 * API: GET /api/keywords/page-intent-analysis/domains
 * 
 * Returns domains with intent summary data for a given client.
 * Joins competitors data with intent summaries if available.
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getSummariesByClient } from '@/lib/storage/pageIntentStore';
import { DomainIntentSummaryRow, computePercent } from '@/types/pageIntent';

const DATA_DIR = path.join(process.cwd(), 'data');

interface Client {
    id: string;
    code: string;
    name: string;
    mainDomain?: string;
    domains?: string[];
    isActive: boolean;
}

interface Competitor {
    id: string;
    clientCode: string;
    name: string;
    domain: string;
    isActive: boolean;
}

async function readJsonFile<T>(filename: string): Promise<T[]> {
    try {
        const filePath = path.join(DATA_DIR, filename);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`[PageIntentDomains] Error reading ${filename}:`, error);
        return [];
    }
}

export async function GET(request: NextRequest) {
    const startTime = Date.now();
    const searchParams = request.nextUrl.searchParams;
    const clientCode = searchParams.get('clientCode');

    console.log(`[PageIntentDomains] GET request - clientCode: ${clientCode}`);

    if (!clientCode) {
        return NextResponse.json(
            { error: 'clientCode query parameter is required' },
            { status: 400 }
        );
    }

    try {
        // Load clients and competitors
        const [clients, competitors] = await Promise.all([
            readJsonFile<Client>('clients.json'),
            readJsonFile<Competitor>('competitors.json'),
        ]);

        // Find the client
        const client = clients.find(c => c.code === clientCode);
        if (!client) {
            return NextResponse.json(
                { error: `Client not found: ${clientCode}` },
                { status: 404 }
            );
        }

        // Get client's own domains
        const clientDomains: { domain: string; name: string; isClientDomain: boolean }[] = [];

        if (client.mainDomain) {
            clientDomains.push({
                domain: client.mainDomain,
                name: client.name,
                isClientDomain: true,
            });
        }

        if (client.domains && Array.isArray(client.domains)) {
            for (const d of client.domains) {
                if (d && !clientDomains.some(cd => cd.domain === d)) {
                    clientDomains.push({
                        domain: d,
                        name: client.name,
                        isClientDomain: true,
                    });
                }
            }
        }

        // Get competitors for this client
        const clientCompetitors = competitors.filter(c => c.clientCode === clientCode && c.isActive);

        // Combine into domain list
        const allDomains: { domain: string; companyName: string; isClientDomain: boolean }[] = [
            ...clientDomains.map(cd => ({ domain: cd.domain, companyName: cd.name, isClientDomain: true })),
            ...clientCompetitors.map(c => ({ domain: c.domain, companyName: c.name, isClientDomain: false })),
        ];

        // Deduplicate by domain
        const uniqueDomains = Array.from(
            new Map(allDomains.map(d => [d.domain.toLowerCase(), d])).values()
        );

        // Load intent summaries for this client
        const summaries = await getSummariesByClient(clientCode);
        const summaryMap = new Map(summaries.map(s => [s.domain.toLowerCase(), s]));

        // Build response rows
        const rows: DomainIntentSummaryRow[] = uniqueDomains.map(d => {
            const summary = summaryMap.get(d.domain.toLowerCase());
            const totalPages = summary?.totalPages || null;

            return {
                clientCode,
                clientName: client.name,
                companyName: d.companyName,
                domain: d.domain,
                totalPages,
                problemAwareSolutionCount: summary?.problemAwareSolutionCount || 0,
                problemAwareSolutionPercent: computePercent(summary?.problemAwareSolutionCount || 0, totalPages),
                educationalInformationalCount: summary?.educationalInformationalCount || 0,
                educationalInformationalPercent: computePercent(summary?.educationalInformationalCount || 0, totalPages),
                commercialInvestigationCount: summary?.commercialInvestigationCount || 0,
                commercialInvestigationPercent: computePercent(summary?.commercialInvestigationCount || 0, totalPages),
                trustProofCount: summary?.trustProofCount || 0,
                trustProofPercent: computePercent(summary?.trustProofCount || 0, totalPages),
                brandNavigationCount: summary?.brandNavigationCount || 0,
                brandNavigationPercent: computePercent(summary?.brandNavigationCount || 0, totalPages),
                transactionalCount: summary?.transactionalCount || 0,
                transactionalPercent: computePercent(summary?.transactionalCount || 0, totalPages),
                hasDetails: !!summary,
                lastFetchedAt: summary?.updatedAt,
            };
        });

        console.log(`[PageIntentDomains] Returning ${rows.length} domains in ${Date.now() - startTime}ms`);

        return NextResponse.json(rows);
    } catch (error) {
        console.error('[PageIntentDomains] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch domain data', details: String(error) },
            { status: 500 }
        );
    }
}
