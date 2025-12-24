import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getActiveCredentialByService } from '@/lib/apiCredentialsStore';
import { getCompetitors } from '@/lib/db';
import {
  replaceDomainKeywordsForClientLocationAndDomains,
  saveDomainApiLog,
  cleanDomain,
} from '@/lib/domainOverviewStore';
import { fetchDomainRankedKeywordsBatch, DOM_TOP_KEYWORDS_LIMIT } from '@/lib/dataforseoClient';
import { DomainKeywordRecord } from '@/types';

const ALL_LOCATIONS = ['IN', 'GL'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientCode, domains: providedDomains, limit } = body;

    if (!clientCode) {
      return NextResponse.json(
        { error: 'clientCode is required' },
        { status: 400 }
      );
    }

    const keywordLimit: number = limit || DOM_TOP_KEYWORDS_LIMIT;

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

    const password = credential?.password || process.env.DATAFORSEO_PASSWORD;
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

    console.log('[Domain Keywords Fetch] Fetching top', keywordLimit, 'keywords for', uniqueDomains.length, 'domains, locations:', ALL_LOCATIONS.join(', '));

    const now = new Date().toISOString();
    const snapshotDate = now.split('T')[0];
    const allRecords: DomainKeywordRecord[] = [];
    const logFilenames: string[] = [];
    const locationStats: { location: string; keywords: number; domainsWithKeywords: number }[] = [];

    for (const locCode of ALL_LOCATIONS) {
      console.log(`[Domain Keywords Fetch] Fetching for location: ${locCode}`);

      const batchResults = await fetchDomainRankedKeywordsBatch(
        { username: credential.username, password },
        uniqueDomains,
        locCode,
        keywordLimit
      );

      const rawResponses = batchResults.map(r => ({ domain: r.domain, response: r.rawResponse }));
      const logFilename = await saveDomainApiLog(clientCode, [locCode], 'keywords', JSON.stringify(rawResponses, null, 2));
      logFilenames.push(logFilename);
      console.log(`[Domain Keywords Fetch] Saved API response log for ${locCode}:`, logFilename);

      const newRecords: DomainKeywordRecord[] = [];

      for (const result of batchResults) {
        for (const kw of result.keywords) {
          newRecords.push({
            id: uuidv4(),
            clientCode,
            domain: result.domain,
            label: result.domain,
            locationCode: result.locationCode,
            languageCode: result.languageCode,
            keyword: kw.keyword,
            position: kw.position,
            searchVolume: kw.searchVolume,
            cpc: kw.cpc,
            url: kw.url,
            fetchedAt: now,
            snapshotDate,
          });
        }
      }

      await replaceDomainKeywordsForClientLocationAndDomains(
        clientCode,
        locCode,
        uniqueDomains,
        newRecords
      );

      const domainsWithKeywords = batchResults.filter(r => r.keywords.length > 0).length;
      allRecords.push(...newRecords);
      locationStats.push({ location: locCode, keywords: newRecords.length, domainsWithKeywords });
    }

    const totalDomainsWithKeywords = locationStats.reduce((sum, s) => sum + s.domainsWithKeywords, 0);

    return NextResponse.json({
      success: true,
      message: `Successfully fetched ${allRecords.length} keywords across ${ALL_LOCATIONS.length} locations`,
      totalKeywords: allRecords.length,
      domainsProcessed: uniqueDomains.length,
      totalDomainsWithKeywords,
      locations: ALL_LOCATIONS,
      locationStats,
      lastFetchedAt: now,
      logFiles: logFilenames,
    });
  } catch (error) {
    console.error('Error fetching domain keywords:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch domain keywords: ${errorMessage}` },
      { status: 500 }
    );
  }
}
