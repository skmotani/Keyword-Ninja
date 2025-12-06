import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getCompetitors, createCompetitor, updateCompetitor, deleteCompetitor } from '@/lib/db';
import { Competitor } from '@/types';

export async function GET() {
  const competitors = await getCompetitors();
  return NextResponse.json(competitors);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  const newCompetitor: Competitor = {
    id: uuidv4(),
    clientCode: body.clientCode,
    name: body.name,
    domain: body.domain,
    notes: body.notes || '',
    isActive: true,
  };
  
  await createCompetitor(newCompetitor);
  return NextResponse.json(newCompetitor, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, ...updates } = body;
  
  const updated = await updateCompetitor(id, updates);
  if (!updated) {
    return NextResponse.json({ error: 'Competitor not found' }, { status: 404 });
  }
  
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  
  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }
  
  const deleted = await deleteCompetitor(id);
  if (!deleted) {
    return NextResponse.json({ error: 'Competitor not found' }, { status: 404 });
  }
  
  return NextResponse.json({ success: true });
}
