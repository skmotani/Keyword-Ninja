import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getActiveCredentialByServiceType } from '@/lib/apiCredentialsStore';
import { getManualKeywords } from '@/lib/db';
import {
  normalizeKeyword,
  fetchKeywordDataFromProvider,
  replaceKeywordApiDataForClientAndLocation,
} from '@/lib/keywordApiStore';
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

    const credential = await getActiveCredentialByServiceType('SEO_DATA');
    if (!credential) {
      return NextResponse.json(
        { error: 'No active SEO_DATA API credential found. Please configure an API credential first.' },
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

    const metricsData = await fetchKeywordDataFromProvider(normalizedKeywords, locationCode);

    const now = new Date().toISOString();
    const snapshotDate = now.split('T')[0];

    const newRecords: KeywordApiDataRecord[] = metricsData.map((metrics) => ({
      id: uuidv4(),
      clientCode,
      keywordText: metrics.keywordText,
      normalizedKeyword: normalizeKeyword(metrics.keywordText),
      searchVolume: metrics.searchVolume,
      cpc: metrics.cpc,
      competitionIndex: metrics.competitionIndex,
      locationCode,
      sourceApi: 'DATAFORSEO',
      snapshotDate,
      lastPulledAt: now,
    }));

    await replaceKeywordApiDataForClientAndLocation(clientCode, locationCode, newRecords);

    return NextResponse.json({
      success: true,
      message: `Successfully fetched data for ${newRecords.length} keywords`,
      count: newRecords.length,
      lastPulledAt: now,
    });
  } catch (error) {
    console.error('Error fetching keyword data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch keyword data' },
      { status: 500 }
    );
  }
}
