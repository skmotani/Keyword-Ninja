import { NextRequest, NextResponse } from 'next/server';
import { getAllAiProfiles, getAiProfileByClientCode } from '@/lib/clientAiProfileStore';

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
