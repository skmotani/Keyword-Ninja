import { NextRequest, NextResponse } from 'next/server';
import { getDomainProfiles, getDomainProfilesByClient, getDomainProfile } from '@/lib/domainProfileStore';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientCode = searchParams.get('clientCode');
  const domain = searchParams.get('domain');

  try {
    if (clientCode && domain) {
      const profile = await getDomainProfile(clientCode, domain);
      if (!profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      }
      return NextResponse.json(profile);
    }

    if (clientCode) {
      const profiles = await getDomainProfilesByClient(clientCode);
      return NextResponse.json(profiles);
    }

    const allProfiles = await getDomainProfiles();
    return NextResponse.json(allProfiles);
  } catch (error) {
    console.error('Error fetching domain profiles:', error);
    return NextResponse.json({ error: 'Failed to fetch domain profiles' }, { status: 500 });
  }
}
