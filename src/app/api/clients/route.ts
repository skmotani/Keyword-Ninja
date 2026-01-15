import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getClients, createClient, updateClient, deleteClient } from '@/lib/db';
import { Client } from '@/types';

export async function GET() {
  const clients = await getClients();
  return NextResponse.json(clients);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  let domains: string[] = [];
  if (body.domains && Array.isArray(body.domains)) {
    domains = body.domains.filter((d: string) => d && d.trim()).slice(0, 5);
  } else if (body.mainDomain) {
    domains = [body.mainDomain];
  }
  
  const newClient: Client = {
    id: uuidv4(),
    code: body.code,
    name: body.name,
    mainDomain: domains[0] || '',
    domains: domains,
    notes: body.notes || '',
    isActive: true,
  };
  
  await createClient(newClient);
  return NextResponse.json(newClient, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, ...updates } = body;
  
  if (updates.domains && Array.isArray(updates.domains)) {
    updates.domains = updates.domains.filter((d: string) => d && d.trim()).slice(0, 5);
    if (updates.domains.length > 0) {
      updates.mainDomain = updates.domains[0];
    }
  }
  
  const updated = await updateClient(id, updates);
  if (!updated) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }
  
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  
  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }
  
  const deleted = await deleteClient(id);
  if (!deleted) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }
  
  return NextResponse.json({ success: true });
}
