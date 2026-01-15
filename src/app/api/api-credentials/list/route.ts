import { NextResponse } from 'next/server';
import { getApiCredentials } from '@/lib/apiCredentialsStore';

export async function GET() {
  try {
    const credentials = await getApiCredentials();
    return NextResponse.json(credentials);
  } catch (error) {
    console.error('Error fetching credentials:', error);
    return NextResponse.json({ error: 'Failed to fetch credentials' }, { status: 500 });
  }
}
