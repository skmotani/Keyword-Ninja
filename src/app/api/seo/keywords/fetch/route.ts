import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getActiveCredentialByService } from '@/lib/apiCredentialsStore';
import { getManualKeywords } from '@/lib/db';
import {
  normalizeKeyword,
  replaceKeywordApiDataForClientAndLocations,
  saveApiLog,
} from '@/lib/keywordApiStore';
import { fetchKeywordsFromDataForSEOBatch, sanitizeKeywordForAPI, getLocationCodeMapping } from '@/lib/dataforseoClient';
import { KeywordApiDataRecord } from '@/types';

interface LocationStats {
  originalKeywords: number;
  skippedKeywords: number;
  sanitizedKeywordsSent: number;
  recordsCreated: number;
  duplicatesRemoved: number;
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

    const password = process.env.DATAFORSEO_PASSWORD;
    if (!password) {
      return NextResponse.json(
        { error: 'DataForSEO password not configured. Please add DATAFORSEO_PASSWORD to secrets.' },
        { status: 400 }
      );
    }

    const allManualKeywords = await getManualKeywords();
    const activeKeywords = allManualKeywords.filter(
      k => k.clientCode === clientCode && k.isActive
    );

    if (activeKeywords.length === 0) {
      return NextResponse.json(
        { error: 'No active manual keywords found for this client' },
        { status: 400 }
      );
    }

    const keywordTexts = activeKeywords.map(k => k.keywordText);
    const originalCount = keywordTexts.length;

    const sanitizedToOriginalsMap = new Map<string, string[]>();
    const sanitizedKeywords: string[] = [];
    
    let skippedCount = 0;
    for (const originalKeyword of keywordTexts) {
      const sanitized = sanitizeKeywordForAPI(originalKeyword);
      if (sanitized !== null && sanitized.length > 0) {
        if (!sanitizedToOriginalsMap.has(sanitized)) {
          sanitizedToOriginalsMap.set(sanitized, [originalKeyword]);
          sanitizedKeywords.push(sanitized);
        } else {
          sanitizedToOriginalsMap.get(sanitized)!.push(originalKeyword);
        }
      } else {
        skippedCount++;
      }
    }
    
    if (skippedCount > 0) {
      console.log('[Fetch] Skipped', skippedCount, 'keywords with invalid characters or too many words');
    }

    if (sanitizedKeywords.length === 0) {
      return NextResponse.json(
        { error: 'No valid keywords to fetch. All keywords were filtered out due to invalid characters or being too long.' },
        { status: 400 }
      );
    }

    console.log('[Fetch] Calling DataForSEO API for', sanitizedKeywords.length, 'sanitized keywords across', locCodes.length, 'locations');

    const { locationResults, rawResponse } = await fetchKeywordsFromDataForSEOBatch(
      { username: credential.username, password },
      sanitizedKeywords,
      locCodes
    );

    const logFilename = await saveApiLog(clientCode, locCodes, rawResponse);
    console.log('[Fetch] Saved API response log:', logFilename);

    const now = new Date().toISOString();
    const snapshotDate = now.split('T')[0];

    const allNewRecords: KeywordApiDataRecord[] = [];
    const statsPerLocation: Record<string, LocationStats> = {};
    const locationCodeMapping = getLocationCodeMapping();

    for (const locResult of locationResults) {
      const dedupeMap = new Map<string, KeywordApiDataRecord>();
      let duplicatesRemoved = 0;

      for (const result of locResult.results) {
        const originalKeywords = sanitizedToOriginalsMap.get(result.keyword) || [result.keyword];
        
        for (const originalKeyword of originalKeywords) {
          const normalizedKey = `${locResult.numericLocationCode}:${normalizeKeyword(originalKeyword)}`;
          
          if (dedupeMap.has(normalizedKey)) {
            duplicatesRemoved++;
            continue;
          }
          
          const record: KeywordApiDataRecord = {
            id: uuidv4(),
            clientCode,
            keywordText: originalKeyword,
            normalizedKeyword: normalizeKeyword(originalKeyword),
            searchVolume: result.search_volume,
            cpc: result.cpc,
            competition: result.competition,
            lowTopOfPageBid: result.low_top_of_page_bid,
            highTopOfPageBid: result.high_top_of_page_bid,
            locationCode: locResult.numericLocationCode,
            languageCode: locResult.languageCode,
            sourceApi: 'DATAFORSEO',
            snapshotDate,
            lastPulledAt: now,
          };
          
          dedupeMap.set(normalizedKey, record);
        }
      }

      const locationRecords = Array.from(dedupeMap.values());
      allNewRecords.push(...locationRecords);

      statsPerLocation[locResult.locationCode] = {
        originalKeywords: originalCount,
        skippedKeywords: skippedCount,
        sanitizedKeywordsSent: sanitizedKeywords.length,
        recordsCreated: locationRecords.length,
        duplicatesRemoved,
      };
    }

    const numericLocationCodes = locCodes.map(lc => locationCodeMapping[lc] || 2840);
    await replaceKeywordApiDataForClientAndLocations(clientCode, numericLocationCodes, allNewRecords);

    return NextResponse.json({
      success: true,
      message: `Successfully fetched data for ${allNewRecords.length} keywords from DataForSEO`,
      count: allNewRecords.length,
      stats: statsPerLocation,
      lastPulledAt: now,
      logFile: logFilename,
    });
  } catch (error) {
    console.error('Error fetching keyword data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch keyword data: ${errorMessage}` },
      { status: 500 }
    );
  }
}
