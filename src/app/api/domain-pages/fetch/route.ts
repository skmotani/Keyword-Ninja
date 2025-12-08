import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getActiveCredentialByService } from '@/lib/apiCredentialsStore';
import { getCompetitors } from '@/lib/db';
import {
  replaceDomainPagesForClientLocationAndDomains,
  saveDomainApiLog,
  cleanDomain,
} from '@/lib/domainOverviewStore';
import { 
  fetchDomainTopPages, 
  fetchDomainRankedKeywords,
  DomainTopPageItem,
} from '@/lib/dataforseoClient';
import { DomainPageRecord } from '@/types';

const ALL_LOCATIONS = ['IN', 'GL'];
const KEYWORDS_LIMIT = 500;
const DEFAULT_PAGE_LIMIT = 30;

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

function aggregateKeywordsByPage(
  keywords: { keyword: string; position: number | null; searchVolume: number | null; url: string | null }[], 
  limit: number
): PageAggregate[] {
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

interface DomainFetchResult {
  domain: string;
  locationCode: string;
  languageCode: string;
  pages: DomainTopPageItem[];
  method: 'domain_pages' | 'ranked_keywords';
  keywordsFetched?: number;
}

async function fetchDomainPagesHybrid(
  credentials: { username: string; password: string },
  domain: string,
  locationCode: string,
  pageLimit: number
): Promise<DomainFetchResult> {
  const result = await fetchDomainTopPages(credentials, domain, locationCode, pageLimit);
  
  if (result.pages.length > 0) {
    console.log(`[Domain Pages Hybrid] ${domain} (${locationCode}): Got ${result.pages.length} pages from domain_pages/live API`);
    return {
      domain: result.domain,
      locationCode: result.locationCode,
      languageCode: result.languageCode,
      pages: result.pages,
      method: 'domain_pages',
    };
  }
  
  console.log(`[Domain Pages Hybrid] ${domain} (${locationCode}): domain_pages/live returned no data, falling back to ranked_keywords`);
  
  const keywordsResult = await fetchDomainRankedKeywords(credentials, domain, locationCode, KEYWORDS_LIMIT);
  
  if (keywordsResult.keywords.length === 0) {
    console.log(`[Domain Pages Hybrid] ${domain} (${locationCode}): ranked_keywords also returned no data - domain may not be in DataForSEO database`);
    return {
      domain: keywordsResult.domain,
      locationCode: keywordsResult.locationCode,
      languageCode: keywordsResult.languageCode,
      pages: [],
      method: 'ranked_keywords',
      keywordsFetched: 0,
    };
  }
  
  const aggregatedPages = aggregateKeywordsByPage(keywordsResult.keywords, pageLimit);
  
  console.log(`[Domain Pages Hybrid] ${domain} (${locationCode}): Derived ${aggregatedPages.length} pages from ${keywordsResult.keywords.length} ranked keywords`);
  
  return {
    domain: keywordsResult.domain,
    locationCode: keywordsResult.locationCode,
    languageCode: keywordsResult.languageCode,
    pages: aggregatedPages.map(p => ({
      pageURL: p.pageURL,
      estTrafficETV: p.estTrafficETV,
      keywordsCount: p.keywordsCount,
    })),
    method: 'ranked_keywords',
    keywordsFetched: keywordsResult.keywords.length,
  };
}

async function fetchDomainPagesBatchHybrid(
  credentials: { username: string; password: string },
  domains: string[],
  locationCode: string,
  pageLimit: number
): Promise<DomainFetchResult[]> {
  const results: DomainFetchResult[] = [];
  
  for (const domain of domains) {
    const result = await fetchDomainPagesHybrid(credentials, domain, locationCode, pageLimit);
    results.push(result);
  }
  
  return results;
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

    const pageLimit: number = limit || DEFAULT_PAGE_LIMIT;

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
    
    const duplicatesRemoved = domains.length - uniqueDomains.length;
    if (duplicatesRemoved > 0) {
      console.log(`[Domain Pages Fetch] Removed ${duplicatesRemoved} duplicate domains (www/non-www normalization)`);
    }

    console.log('[Domain Pages Fetch] Processing', uniqueDomains.length, 'unique domains across locations:', ALL_LOCATIONS.join(', '));

    const now = new Date().toISOString();
    const snapshotDate = now.split('T')[0];
    const allRecords: DomainPageRecord[] = [];
    const logFilenames: string[] = [];
    const locationStats: { 
      location: string; 
      pages: number; 
      domainsWithPages: number;
      domainPagesApiCount: number;
      rankedKeywordsApiCount: number;
      domainsWithNoData: string[];
    }[] = [];

    for (const locCode of ALL_LOCATIONS) {
      console.log(`[Domain Pages Fetch] Processing location: ${locCode}`);

      const batchResults = await fetchDomainPagesBatchHybrid(
        { username: credential.username, password },
        uniqueDomains,
        locCode,
        pageLimit
      );

      const logData = batchResults.map(r => ({ 
        domain: r.domain, 
        pagesCount: r.pages.length,
        method: r.method,
        keywordsFetched: r.keywordsFetched,
      }));
      const logFilename = await saveDomainApiLog(clientCode, [locCode], 'pages', JSON.stringify(logData, null, 2));
      logFilenames.push(logFilename);
      console.log(`[Domain Pages Fetch] Saved log for ${locCode}:`, logFilename);

      const newRecords: DomainPageRecord[] = [];
      
      for (const result of batchResults) {
        for (const page of result.pages) {
          newRecords.push({
            id: uuidv4(),
            clientCode,
            domain: result.domain,
            label: result.domain,
            locationCode: result.locationCode,
            languageCode: result.languageCode,
            pageURL: page.pageURL,
            estTrafficETV: page.estTrafficETV ?? 0,
            keywordsCount: page.keywordsCount ?? 0,
            fetchedAt: now,
            snapshotDate,
          });
        }
      }

      await replaceDomainPagesForClientLocationAndDomains(
        clientCode,
        locCode,
        uniqueDomains,
        newRecords
      );

      const domainsWithPages = batchResults.filter(r => r.pages.length > 0).length;
      const domainPagesApiCount = batchResults.filter(r => r.method === 'domain_pages' && r.pages.length > 0).length;
      const rankedKeywordsApiCount = batchResults.filter(r => r.method === 'ranked_keywords' && r.pages.length > 0).length;
      const domainsWithNoData = batchResults.filter(r => r.pages.length === 0).map(r => r.domain);
      
      allRecords.push(...newRecords);
      locationStats.push({ 
        location: locCode, 
        pages: newRecords.length, 
        domainsWithPages,
        domainPagesApiCount,
        rankedKeywordsApiCount,
        domainsWithNoData,
      });
      
      console.log(`[Domain Pages Fetch] ${locCode} summary: ${newRecords.length} pages from ${domainsWithPages} domains (domain_pages: ${domainPagesApiCount}, ranked_keywords: ${rankedKeywordsApiCount})`);
      if (domainsWithNoData.length > 0) {
        console.log(`[Domain Pages Fetch] ${locCode} domains with no data: ${domainsWithNoData.join(', ')}`);
      }
    }

    const allDomainsWithNoDataIN = locationStats.find(s => s.location === 'IN')?.domainsWithNoData || [];
    const allDomainsWithNoDataGL = locationStats.find(s => s.location === 'GL')?.domainsWithNoData || [];
    const domainsWithNoDataBothLocations = allDomainsWithNoDataIN.filter(d => allDomainsWithNoDataGL.includes(d));

    return NextResponse.json({
      success: true,
      message: `Successfully fetched ${allRecords.length} top pages across ${ALL_LOCATIONS.length} locations`,
      totalPages: allRecords.length,
      domainsRequested: domains.length,
      uniqueDomainsProcessed: uniqueDomains.length,
      duplicatesRemoved,
      locations: ALL_LOCATIONS,
      locationStats: locationStats.map(s => ({
        location: s.location,
        pages: s.pages,
        domainsWithPages: s.domainsWithPages,
        domainPagesApiCount: s.domainPagesApiCount,
        rankedKeywordsApiCount: s.rankedKeywordsApiCount,
        domainsWithNoData: s.domainsWithNoData.length,
      })),
      domainsWithNoDataBothLocations,
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
