import { NextRequest, NextResponse } from 'next/server';
import { getActiveCredentialByService } from '@/lib/apiCredentialsStore';
import { upsertDomainProfile } from '@/lib/domainProfileStore';
import { fetchDomainOverview } from '@/lib/dataforseoClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientCode, domain, locationCode = 'IN' } = body;

    if (!clientCode) {
      return NextResponse.json(
        { error: 'clientCode is required' },
        { status: 400 }
      );
    }

    if (!domain) {
      return NextResponse.json(
        { error: 'domain is required' },
        { status: 400 }
      );
    }

    const credential = await getActiveCredentialByService('DATAFORSEO', clientCode);
    if (!credential) {
      return NextResponse.json(
        { error: 'No active DATAFORSEO API credential found. Please configure an API credential in Settings first.' },
        { status: 400 }
      );
    }

    if (!credential.username) {
      return NextResponse.json(
        { error: 'DataForSEO credential is missing username' },
        { status: 400 }
      );
    }

    const password = process.env.DATAFORSEO_PASSWORD;
    if (!password) {
      return NextResponse.json(
        { error: 'DataForSEO password not configured. Please add DATAFORSEO_PASSWORD to secrets.' },
        { status: 400 }
      );
    }

    await upsertDomainProfile(clientCode, domain, { fetchStatus: 'fetching' });

    console.log('[Domain Profile Fetch] Starting fetch for:', { clientCode, domain, locationCode });

    try {
      const overviewResult = await fetchDomainOverview(
        { username: credential.username, password },
        domain,
        locationCode
      );

      const now = new Date().toISOString();
      const updatedProfile = await upsertDomainProfile(clientCode, domain, {
        title: overviewResult.title,
        metaDescription: overviewResult.metaDescription,
        organicTraffic: overviewResult.organicTraffic,
        organicKeywordsCount: overviewResult.organicKeywordsCount,
        backlinksCount: overviewResult.backlinksCount,
        referringDomainsCount: overviewResult.referringDomainsCount,
        domainRank: overviewResult.domainRank,
        topKeywords: overviewResult.topKeywords,
        inferredCategory: overviewResult.inferredCategory,
        fetchStatus: 'success',
        errorMessage: null,
        lastFetchedAt: now,
      });

      console.log('[Domain Profile Fetch] Successfully fetched profile for:', domain);

      return NextResponse.json({
        success: true,
        profile: updatedProfile,
        message: `Successfully fetched domain overview for ${domain}`,
      });
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      console.error('[Domain Profile Fetch] Error fetching domain overview:', errorMessage);

      await upsertDomainProfile(clientCode, domain, {
        fetchStatus: 'error',
        errorMessage: errorMessage,
      });

      return NextResponse.json(
        { error: `Failed to fetch domain overview: ${errorMessage}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in domain profile fetch:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to process request: ${errorMessage}` },
      { status: 500 }
    );
  }
}
