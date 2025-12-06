import { NextRequest, NextResponse } from 'next/server';
import { toggleApiCredentialActive } from '@/lib/apiCredentialsStore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { id } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Missing credential id' }, { status: 400 });
    }
    
    const updated = await toggleApiCredentialActive(id);
    
    if (!updated) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }
    
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error toggling credential:', error);
    return NextResponse.json({ error: 'Failed to toggle credential' }, { status: 500 });
  }
}
