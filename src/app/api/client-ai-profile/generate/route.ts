import { NextRequest, NextResponse } from 'next/server';
import { buildClientInputData, generateClientAIProfile } from '@/lib/openaiClient';
import { saveAiProfile, getAiProfileByClientCode } from '@/lib/clientAiProfileStore';
import { DomainProfile } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientCode, clientName, notes, domains, domainProfiles } = body;

    if (!clientCode || !clientName || !domains || !Array.isArray(domains)) {
      return NextResponse.json(
        { error: 'clientCode, clientName, and domains are required' },
        { status: 400 }
      );
    }

    if (domains.length === 0) {
      return NextResponse.json(
        { error: 'At least one domain is required' },
        { status: 400 }
      );
    }

    console.log(`[AI Profile] Generating profile for client ${clientCode} with ${domains.length} domains`);

    const clientInputData = buildClientInputData(
      clientCode,
      clientName,
      notes,
      domains,
      domainProfiles as DomainProfile[] || []
    );

    const { profile, domainsUsed } = await generateClientAIProfile(clientInputData);

    await saveAiProfile(profile);

    console.log(`[AI Profile] Profile saved for client ${clientCode}`);

    return NextResponse.json({
      success: true,
      profile,
      domainsUsed,
      message: `AI profile generated using ${domainsUsed.length} domain(s)`,
    });
  } catch (error) {
    console.error('[AI Profile] Error generating profile:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to generate AI profile: ${errorMessage}` },
      { status: 500 }
    );
  }
}
