import { NextRequest, NextResponse } from 'next/server';
import { getAllAiProfiles, getAiProfileByClientCode, saveAiProfile } from '@/lib/clientAiProfileStore';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientCode = searchParams.get('clientCode');

  try {
    if (clientCode) {
      const profile = await getAiProfileByClientCode(clientCode);
      if (!profile) {
        return NextResponse.json(null);
      }
      return NextResponse.json(profile);
    }

    const profiles = await getAllAiProfiles();
    return NextResponse.json(profiles);
  } catch (error) {
    console.error('Error fetching AI profiles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI profiles' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.clientCode) {
      return NextResponse.json(
        { error: 'clientCode is required' },
        { status: 400 }
      );
    }

    // --- GUARD PROMPT REQUIREMENT: Kill Harvest Terms ---
    // Prevent writes to matchingDictionary (Manual Rules)
    if (body.matchingDictionary) {
      return NextResponse.json(
        { error: 'HARVEST_TERMS_DISABLED', message: 'Harvest Terms / Manual Dictionary updates are deprecated. Use Tag All (Rules).' },
        { status: 400 } // Or 410 Gone? 400 is fine for Bad Request.
      );
    }
    // ----------------------------------------------------

    await saveAiProfile(body);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating AI profile:', error);
    return NextResponse.json(
      { error: 'Failed to update AI profile' },
      { status: 500 }
    );
  }
}
