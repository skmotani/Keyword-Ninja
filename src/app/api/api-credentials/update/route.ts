import { NextRequest, NextResponse } from 'next/server';
import { updateApiCredential, maskValue } from '@/lib/apiCredentialsStore';

function ensureMasked(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('****')) return value;
  return maskValue(value, 4);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing credential id' }, { status: 400 });
    }

    if (updates.authType === 'USERNAME_PASSWORD') {
      if (updates.username === '' || updates.passwordMasked === '') {
        return NextResponse.json(
          { error: 'USERNAME_PASSWORD auth requires username and passwordMasked' },
          { status: 400 }
        );
      }
    }

    if (updates.authType === 'API_KEY') {
      if (updates.apiKeyMasked === '') {
        return NextResponse.json(
          { error: 'API_KEY auth requires apiKeyMasked' },
          { status: 400 }
        );
      }
    }

    if (updates.passwordMasked) {
      if (!updates.passwordMasked.startsWith('****')) {
        updates.password = updates.passwordMasked;
      }
      updates.passwordMasked = ensureMasked(updates.passwordMasked);
    }
    if (updates.apiKeyMasked) {
      if (!updates.apiKeyMasked.startsWith('****')) {
        updates.apiKey = updates.apiKeyMasked;
      }
      updates.apiKeyMasked = ensureMasked(updates.apiKeyMasked);
    }
    if (updates.customConfig && updates.customConfig !== '****config') {
      updates.customConfig = '****config';
    }

    const updated = await updateApiCredential(id, updates);

    if (!updated) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating credential:', error);
    return NextResponse.json({ error: 'Failed to update credential' }, { status: 500 });
  }
}
