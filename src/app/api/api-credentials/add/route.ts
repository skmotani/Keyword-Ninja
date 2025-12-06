import { NextRequest, NextResponse } from 'next/server';
import { addApiCredential, maskValue } from '@/lib/apiCredentialsStore';
import { ApiCredential } from '@/types';

function ensureMasked(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('****')) return value;
  return maskValue(value, 4);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { serviceType, authType, label } = body;
    
    if (!serviceType || !authType || !label) {
      return NextResponse.json(
        { error: 'Missing required fields: serviceType, authType, label' },
        { status: 400 }
      );
    }
    
    if (authType === 'USERNAME_PASSWORD') {
      if (!body.username || !body.passwordMasked) {
        return NextResponse.json(
          { error: 'USERNAME_PASSWORD auth requires username and passwordMasked' },
          { status: 400 }
        );
      }
    }
    
    if (authType === 'API_KEY') {
      if (!body.apiKeyMasked) {
        return NextResponse.json(
          { error: 'API_KEY auth requires apiKeyMasked' },
          { status: 400 }
        );
      }
    }
    
    const credentialData: Omit<ApiCredential, 'id' | 'createdAt' | 'updatedAt'> = {
      userId: body.userId || 'admin',
      serviceType,
      authType,
      label,
      username: body.username,
      passwordMasked: ensureMasked(body.passwordMasked),
      apiKeyMasked: ensureMasked(body.apiKeyMasked),
      customConfig: body.customConfig ? '****config' : undefined,
      clientCode: body.clientCode,
      notes: body.notes,
      isActive: body.isActive ?? true,
    };
    
    const newCredential = await addApiCredential(credentialData);
    return NextResponse.json(newCredential, { status: 201 });
  } catch (error) {
    console.error('Error adding credential:', error);
    return NextResponse.json({ error: 'Failed to add credential' }, { status: 500 });
  }
}
