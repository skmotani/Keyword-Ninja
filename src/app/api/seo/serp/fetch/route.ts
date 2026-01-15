import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getActiveCredentialByService } from '@/lib/apiCredentialsStore';
import { getKeywordApiDataByClientAndLocations } from '@/lib/keywordApiStore';
import { replaceSerpDataForClientAndLocations, saveSerpApiLog } from '@/lib/serpStore';
import { fetchSerpFromDataForSEO, getLocationCodeMapping, sanitizeKeywordForAPI } from '@/lib/dataforseoClient';
import { SerpResult } from '@/types';

interface LocationStats {
  keywordsProcessed: number;
  resultsCreated: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientCode, locationCodes } = body;

    if (!clientCode) {
      return NextResponse.json(
        { error: 'clientCode is required' },
        { status: 400 }
      );
    }

    const locCodes: string[] = Array.isArray(locationCodes)
      ? locationCodes
      : (locationCodes ? [locationCodes] : ['IN', 'GL']);

    if (locCodes.length === 0) {
      return NextResponse.json(
        { error: 'At least one locationCode is required' },
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

    const password = credential?.password || process.env.DATAFORSEO_PASSWORD;
    if (!password) {
      return NextResponse.json(
        { error: 'DataForSEO password not configured. Please add DATAFORSEO_PASSWORD to secrets.' },
        { status: 400 }
      );
    }

    const locationCodeMapping = getLocationCodeMapping();
    const numericLocationCodes = locCodes.map(lc => locationCodeMapping[lc] || 2840);

    const keywordRecords = await getKeywordApiDataByClientAndLocations(clientCode, numericLocationCodes);

    if (keywordRecords.length === 0) {
      return NextResponse.json(
        { error: 'No keywords found in Keyword API Data for this client. Please fetch keyword data first.' },
        { status: 400 }
      );
    }

    const uniqueKeywords = Array.from(new Set(keywordRecords.map(r => r.keywordText)));

    const sanitizedKeywords: string[] = [];
    for (const keyword of uniqueKeywords) {
      const sanitized = sanitizeKeywordForAPI(keyword);
      if (sanitized !== null && sanitized.length > 0) {
        sanitizedKeywords.push(sanitized);
      }
    }

    if (sanitizedKeywords.length === 0) {
      return NextResponse.json(
        { error: 'No valid keywords to fetch SERP data for.' },
        { status: 400 }
      );
    }

    console.log('[SERP Fetch] Fetching SERP for', sanitizedKeywords.length, 'keywords across', locCodes.length, 'locations');

    const { locationResults, rawResponse } = await fetchSerpFromDataForSEO(
      { username: credential.username, password },
      sanitizedKeywords,
      locCodes
    );

    const logFilename = await saveSerpApiLog(clientCode, locCodes, rawResponse);
    console.log('[SERP Fetch] Saved API response log:', logFilename);

    const now = new Date().toISOString();
    const allNewRecords: SerpResult[] = [];
    const statsPerLocation: Record<string, LocationStats> = {};

    for (const locResult of locationResults) {
      let resultsCreated = 0;
      let keywordsProcessed = 0;

      for (const keywordResult of locResult.results) {
        keywordsProcessed++;

        for (const item of keywordResult.items) {
          const record: SerpResult = {
            id: uuidv4(),
            clientCode,
            keyword: keywordResult.keyword,
            locationCode: locResult.numericLocationCode,
            languageCode: locResult.languageCode,
            rank: item.rank_group,
            rankAbsolute: item.rank_absolute,
            url: item.url || '',
            title: item.title || '',
            description: item.description || '',
            domain: item.domain || '',
            breadcrumb: item.breadcrumb || null,
            isFeaturedSnippet: item.is_featured_snippet || false,
            isImage: item.is_image || false,
            isVideo: item.is_video || false,
            highlighted: item.highlighted || [],
            etv: item.etv || null,
            estimatedPaidTrafficCost: item.estimated_paid_traffic_cost || null,
            fetchedAt: now,
          };

          allNewRecords.push(record);
          resultsCreated++;
        }
      }

      statsPerLocation[locResult.locationCode] = {
        keywordsProcessed,
        resultsCreated,
      };
    }

    await replaceSerpDataForClientAndLocations(clientCode, numericLocationCodes, allNewRecords);

    return NextResponse.json({
      success: true,
      message: `Successfully fetched SERP data: ${allNewRecords.length} results`,
      count: allNewRecords.length,
      stats: statsPerLocation,
      lastPulledAt: now,
      logFile: logFilename,
    });
  } catch (error) {
    console.error('Error fetching SERP data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch SERP data: ${errorMessage}` },
      { status: 500 }
    );
  }
}
