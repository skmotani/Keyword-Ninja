import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { Client, CanonicalEntity, CanonicalEntityStatus } from '@/types';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');

function getClients(): Client[] {
    try {
        const data = fs.readFileSync(CLIENTS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

function saveClients(clients: Client[]): void {
    fs.writeFileSync(CLIENTS_FILE, JSON.stringify(clients, null, 2));
}

// GET /api/clients/[id]/canonical-entity - Fetch canonical entity for a client
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const clients = getClients();
    const client = clients.find(c => c.id === id);

    if (!client) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({
        canonicalEntity: client.canonicalEntity || null,
        canonicalEntityStatus: client.canonicalEntityStatus || null,
    });
}

// PUT /api/clients/[id]/canonical-entity - Update canonical entity for a client
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const body = await request.json();
    const { canonicalEntity, canonicalEntityStatus } = body as {
        canonicalEntity?: CanonicalEntity | null;
        canonicalEntityStatus?: CanonicalEntityStatus | null;
    };

    const clients = getClients();
    const clientIndex = clients.findIndex(c => c.id === id);

    if (clientIndex === -1) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Update only the provided fields
    if (canonicalEntity !== undefined) {
        clients[clientIndex].canonicalEntity = canonicalEntity;
    }
    if (canonicalEntityStatus !== undefined) {
        clients[clientIndex].canonicalEntityStatus = canonicalEntityStatus;
    }

    saveClients(clients);

    return NextResponse.json({
        success: true,
        canonicalEntity: clients[clientIndex].canonicalEntity,
        canonicalEntityStatus: clients[clientIndex].canonicalEntityStatus,
    });
}

// PATCH /api/clients/[id]/canonical-entity - Partially update canonical entity
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const body = await request.json();
    const { action, ...data } = body as { action?: string;[key: string]: unknown };

    const clients = getClients();
    const clientIndex = clients.findIndex(c => c.id === id);

    if (clientIndex === -1) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const client = clients[clientIndex];

    // Handle "mark as reviewed" action
    if (action === 'markReviewed') {
        clients[clientIndex].canonicalEntityStatus = {
            status: 'reviewed',
            lastReviewedAt: new Date().toISOString(),
            lastReviewedBy: data.userId as string || 'admin',
        };
        saveClients(clients);
        return NextResponse.json({
            success: true,
            canonicalEntityStatus: clients[clientIndex].canonicalEntityStatus,
        });
    }

    // Handle partial updates to nested fields
    if (data.section && data.updates) {
        const section = data.section as keyof CanonicalEntity;
        const updates = data.updates as Record<string, unknown>;

        if (!client.canonicalEntity) {
            return NextResponse.json({ error: 'Canonical entity not generated yet' }, { status: 400 });
        }

        // Merge updates into the section
        clients[clientIndex].canonicalEntity = {
            ...client.canonicalEntity,
            [section]: {
                ...(client.canonicalEntity[section] as Record<string, unknown>),
                ...updates,
            },
        };

        saveClients(clients);
        return NextResponse.json({
            success: true,
            canonicalEntity: clients[clientIndex].canonicalEntity,
        });
    }

    return NextResponse.json({ error: 'Invalid PATCH request' }, { status: 400 });
}
