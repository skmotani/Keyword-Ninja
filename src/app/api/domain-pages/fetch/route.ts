import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getActiveCredentialByService } from '@/lib/apiCredentialsStore';
import { getCompetitors } from '@/lib/db';
import {
  replaceDomainPagesForClientLocationAndDomains,
  saveDomainApiLog,
  cleanDomain,
} from '@/lib/domainOverviewStore';
import { fetchDomainRankedKeywordsBatch } from '@/lib/dataforseoClient';
import { DomainPageRecord } from '@/types';

const ALL_LOCATIONS = ['IN', 'GL'];
const KEYWORDS_LIMIT = 200;

function estimateCTR(position: number): number {
  const ctrByPosition: Record<number, number> = {
    1: 0.32,
    2: 0.17,
    3: 0.11,
    4: 0.08,
    5: 0.06,
    6: 0.05,
    7: 0.04,
    8: 0.03,
    9: 0.025,
    10: 0.02,
  };
  if (position <= 0) return 0;
  if (position <= 10) return ctrByPosition[position] || 0.02;
  if (position <= 20) return 0.01;
  if (position <= 30) return 0.005;
  return 0.002;
}

interface PageAggregate {
  pageURL: string;
  keywordsCount: number;
  estTrafficETV: number;
}

function aggregateKeywordsByPage(keywords: { keyword: string; position: number | null; searchVolume: number | null; url: string | null }[], limit: number): PageAggregate[] {
  const pageMap = new Map<string, PageAggregate>();

  for (const kw of keywords) {
    if (!kw.url) continue;
    
    const existing = pageMap.get(kw.url);
    const searchVolume = kw.searchVolume || 0;
    const position = kw.position || 100;
    const estTraffic = Math.round(searchVolume * estimateCTR(position));

    if (existing) {
      existing.keywordsCount += 1;
      existing.estTrafficETV += estTraffic;
    } else {
      pageMap.set(kw.url, {
        pageURL: kw.url,
        keywordsCount: 1,
        estTrafficETV: estTraffic,
      });
    }
  }

  const pages = Array.from(pageMap.values());
  pages.sort((a, b) => b.estTrafficETV - a.estTrafficETV);
  return pages.slice(0, limit);
}

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

    const pageLimit: number = limit || 30;

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

    console.log('[Domain Pages Fetch] Deriving top pages from ranked keywords for', uniqueDomains.length, 'domains, locations:', ALL_LOCATIONS.join(', '));

    const now = new Date().toISOString();
    const snapshotDate = now.split('T')[0];
    const allRecords: DomainPageRecord[] = [];
    const logFilenames: string[] = [];
    const locationStats: { location: string; pages: number; domainsWithPages: number }[] = [];

    for (const locCode of ALL_LOCATIONS) {
      console.log(`[Domain Pages Fetch] Fetching ranked keywords for location: ${locCode}`);

      const batchResults = await fetchDomainRankedKeywordsBatch(
        { username: credential.username, password },
        uniqueDomains,
        locCode,
        KEYWORDS_LIMIT
      );

      const rawResponses = batchResults.map(r => ({ domain: r.domain, keywordsCount: r.keywords.length }));
      const logFilename = await saveDomainApiLog(clientCode, [locCode], 'pages', JSON.stringify(rawResponses, null, 2));
      logFilenames.push(logFilename);
      console.log(`[Domain Pages Fetch] Saved log for ${locCode}:`, logFilename);

      const newRecords: DomainPageRecord[] = [];
      
      for (const result of batchResults) {
        const topPages = aggregateKeywordsByPage(result.keywords, pageLimit);
        
        for (const page of topPages) {
          newRecords.push({
            id: uuidv4(),
            clientCode,
            domain: result.domain,
            label: result.domain,
            locationCode: result.locationCode,
            languageCode: result.languageCode,
            pageURL: page.pageURL,
            estTrafficETV: page.estTrafficETV,
            keywordsCount: page.keywordsCount,
            fetchedAt: now,
            snapshotDate,
          });
        }
        
        if (topPages.length > 0) {
          console.log(`[Domain Pages Fetch] ${result.domain} (${locCode}): ${topPages.length} pages from ${result.keywords.length} keywords`);
        }
      }

      await replaceDomainPagesForClientLocationAndDomains(
        clientCode,
        locCode,
        uniqueDomains,
        newRecords
      );

      const domainsWithPages = batchResults.filter(r => r.keywords.length > 0).length;
      allRecords.push(...newRecords);
      locationStats.push({ location: locCode, pages: newRecords.length, domainsWithPages });
    }

    const totalDomainsWithPages = locationStats.reduce((sum, s) => sum + s.domainsWithPages, 0);

    return NextResponse.json({
      success: true,
      message: `Successfully derived ${allRecords.length} top pages from ranked keywords across ${ALL_LOCATIONS.length} locations`,
      totalPages: allRecords.length,
      domainsProcessed: uniqueDomains.length,
      totalDomainsWithPages,
      locations: ALL_LOCATIONS,
      locationStats,
      lastFetchedAt: now,
      logFiles: logFilenames,
    });
  } catch (error) {
    console.error('Error fetching domain pages:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch domain pages: ${errorMessage}` },
      { status: 500 }
    );
  }
}
