// POST /api/cms/sync-clients - Sync clients from JSON to Prisma

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getClients } from '@/lib/db';

export async function POST() {
    try {
        // Get clients from JSON files
        const jsonClients = await getClients();

        if (!jsonClients || jsonClients.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No clients found in JSON files'
            });
        }

        const results = {
            synced: 0,
            updated: 0,
            errors: [] as string[],
        };

        for (const client of jsonClients) {
            try {
                // Check if client already exists in Prisma
                const existing = await prisma.client.findUnique({
                    where: { code: client.code },
                });

                if (existing) {
                    // Update existing client
                    await prisma.client.update({
                        where: { code: client.code },
                        data: {
                            name: client.name,
                            mainDomain: client.mainDomain || null,
                            domains: client.domains || [],
                            industry: client.industry || null,
                            notes: client.notes || null,
                            isActive: client.isActive !== false,
                            businessMetrics: client.businessMetrics
                                ? (client.businessMetrics as Prisma.InputJsonValue)
                                : Prisma.DbNull,
                        },
                    });
                    results.updated++;
                } else {
                    // Create new client in Prisma
                    await prisma.client.create({
                        data: {
                            code: client.code,
                            name: client.name,
                            mainDomain: client.mainDomain || null,
                            domains: client.domains || [],
                            industry: client.industry || null,
                            notes: client.notes || null,
                            isActive: client.isActive !== false,
                            businessMetrics: client.businessMetrics
                                ? (client.businessMetrics as Prisma.InputJsonValue)
                                : Prisma.DbNull,
                        },
                    });
                    results.synced++;
                }
            } catch (clientError) {
                results.errors.push(
                    `${client.code}: ${clientError instanceof Error ? clientError.message : 'Unknown error'}`
                );
            }
        }

        return NextResponse.json({
            success: true,
            message: `Synced ${results.synced} new, updated ${results.updated} existing`,
            ...results,
            totalInJson: jsonClients.length,
        });
    } catch (error) {
        console.error('Sync clients error:', error);
        return NextResponse.json(
            { error: 'Failed to sync clients' },
            { status: 500 }
        );
    }
}

// GET to check sync status
export async function GET() {
    try {
        const jsonClients = await getClients();
        const prismaClients = await prisma.client.findMany({
            select: { code: true, name: true },
        });

        const jsonCodes = new Set(jsonClients.map((c: { code: string }) => c.code));
        const prismaCodes = new Set(prismaClients.map((c) => c.code));

        const missingInPrisma = Array.from(jsonCodes).filter((c) => !prismaCodes.has(c));

        return NextResponse.json({
            jsonCount: jsonClients.length,
            prismaCount: prismaClients.length,
            missingInPrisma,
            synced: missingInPrisma.length === 0,
        });
    } catch (error) {
        console.error('Sync status error:', error);
        return NextResponse.json(
            { error: 'Failed to check sync status' },
            { status: 500 }
        );
    }
}
