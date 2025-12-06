import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getActiveCredentialByService } from '@/lib/apiCredentialsStore';
import { getManualKeywords } from '@/lib/db';
import {
  normalizeKeyword,
  replaceKeywordApiDataForClientAndLocation,
  saveApiLog,
} from '@/lib/keywordApiStore';
import { fetchKeywordsFromDataForSEO } from '@/lib/dataforseoClient';
import { KeywordApiDataRecord } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientCode, locationCode } = body;

    if (!clientCode || !locationCode) {
      return NextResponse.json(
        { error: 'clientCode and locationCode are required' },
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
    const normalizedKeywords = keywordTexts.map(normalizeKeyword);

    console.log('[Fetch] Calling DataForSEO API for', normalizedKeywords.length, 'keywords');

    const { results, rawResponse } = await fetchKeywordsFromDataForSEO(
      { username: credential.username, password },
      normalizedKeywords,
      locationCode
    );

    const logFilename = await saveApiLog(clientCode, locationCode, rawResponse);
    console.log('[Fetch] Saved API response log:', logFilename);

    const now = new Date().toISOString();
    const snapshotDate = now.split('T')[0];

    const newRecords: KeywordApiDataRecord[] = results.map((result) => ({
      id: uuidv4(),
      clientCode,
      keywordText: result.keyword,
      normalizedKeyword: normalizeKeyword(result.keyword),
      searchVolume: result.search_volume,
      cpc: result.cpc,
      competitionIndex: result.competition !== null ? Math.round(result.competition * 100) : null,
      competitionLevel: result.competition_level,
      monthlySearches: result.monthly_searches?.map(ms => ({
        year: ms.year,
        month: ms.month,
        searchVolume: ms.search_volume,
      })) || null,
      locationCode,
      sourceApi: 'DATAFORSEO',
      snapshotDate,
      lastPulledAt: now,
    }));

    await replaceKeywordApiDataForClientAndLocation(clientCode, locationCode, newRecords);

    return NextResponse.json({
      success: true,
      message: `Successfully fetched data for ${newRecords.length} keywords from DataForSEO`,
      count: newRecords.length,
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
