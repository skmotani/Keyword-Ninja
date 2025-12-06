import { NextRequest, NextResponse } from 'next/server';
import { deleteApiCredential } from '@/lib/apiCredentialsStore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { id } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Missing credential id' }, { status: 400 });
    }
    
    const deleted = await deleteApiCredential(id);
    
    if (!deleted) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting credential:', error);
    return NextResponse.json({ error: 'Failed to delete credential' }, { status: 500 });
  }
}
