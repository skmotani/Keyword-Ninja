import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getActiveCredentialByService } from '@/lib/apiCredentialsStore';
import { getCompetitors } from '@/lib/db';
import {
  replaceDomainOverviewForClientLocationAndDomains,
  saveDomainApiLog,
  cleanDomain,
} from '@/lib/domainOverviewStore';
import { fetchDomainRankOverviewBatch } from '@/lib/dataforseoClient';
import { DomainOverviewRecord } from '@/types';

const ALL_LOCATIONS = ['IN', 'GL'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientCode, domains: providedDomains } = body;

    if (!clientCode) {
      return NextResponse.json(
        { error: 'clientCode is required' },
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

    let domains: string[] = providedDomains || [];
    
    if (domains.length === 0) {
      const allCompetitors = await getCompetitors();
      const clientCompetitors = allCompetitors.filter(
        c => c.clientCode === clientCode && c.isActive
      );
      domains = clientCompetitors.map(c => c.domain);
    }

    if (domains.length === 0) {
      return NextResponse.json(
        { error: 'No domains found to fetch. Please add competitors for this client or provide domains.' },
        { status: 400 }
      );
    }

    const cleanedDomains = domains.map(cleanDomain);
    const uniqueDomains = Array.from(new Set(cleanedDomains));

    console.log('[Domain Overview Fetch] Fetching for', uniqueDomains.length, 'domains, locations:', ALL_LOCATIONS.join(', '));

    const now = new Date().toISOString();
    const snapshotDate = now.split('T')[0];
    const allRecords: DomainOverviewRecord[] = [];
    const logFilenames: string[] = [];
    const locationStats: { location: string; count: number }[] = [];

    for (const locCode of ALL_LOCATIONS) {
      console.log(`[Domain Overview Fetch] Fetching for location: ${locCode}`);
      
      const batchResult = await fetchDomainRankOverviewBatch(
        { username: credential.username, password },
        uniqueDomains,
        locCode
      );

      const logFilename = await saveDomainApiLog(clientCode, [locCode], 'overview', batchResult.rawResponse);
      logFilenames.push(logFilename);
      console.log(`[Domain Overview Fetch] Saved API response log for ${locCode}:`, logFilename);

      const newRecords: DomainOverviewRecord[] = batchResult.results.map(item => ({
        id: uuidv4(),
        clientCode,
        domain: item.domain,
        label: item.domain,
        locationCode: batchResult.locationCode,
        languageCode: batchResult.languageCode,
        organicTrafficETV: item.organicTrafficETV,
        organicKeywordsCount: item.organicKeywordsCount,
        fetchedAt: now,
        snapshotDate,
      }));

      await replaceDomainOverviewForClientLocationAndDomains(
        clientCode,
        locCode,
        uniqueDomains,
        newRecords
      );

      allRecords.push(...newRecords);
      locationStats.push({ location: locCode, count: newRecords.length });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully fetched domain overview for ${uniqueDomains.length} domains across ${ALL_LOCATIONS.length} locations`,
      totalRecords: allRecords.length,
      domainsProcessed: uniqueDomains.length,
      locations: ALL_LOCATIONS,
      locationStats,
      lastFetchedAt: now,
      logFiles: logFilenames,
    });
  } catch (error) {
    console.error('Error fetching domain overview:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch domain overview: ${errorMessage}` },
      { status: 500 }
    );
  }
}
