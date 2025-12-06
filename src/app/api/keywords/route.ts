import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getManualKeywords, createManualKeyword, updateManualKeyword, deleteManualKeyword } from '@/lib/db';
import { ManualKeyword } from '@/types';

export async function GET() {
  const keywords = await getManualKeywords();
  return NextResponse.json(keywords);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  const newKeyword: ManualKeyword = {
    id: uuidv4(),
    clientCode: body.clientCode,
    keywordText: body.keywordText,
    notes: body.notes || '',
    isActive: true,
  };
  
  await createManualKeyword(newKeyword);
  return NextResponse.json(newKeyword, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, ...updates } = body;
  
  const updated = await updateManualKeyword(id, updates);
  if (!updated) {
    return NextResponse.json({ error: 'Keyword not found' }, { status: 404 });
  }
  
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  
  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }
  
  const deleted = await deleteManualKeyword(id);
  if (!deleted) {
    return NextResponse.json({ error: 'Keyword not found' }, { status: 404 });
  }
  
  return NextResponse.json({ success: true });
}
