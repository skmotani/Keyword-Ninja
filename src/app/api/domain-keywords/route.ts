import { NextRequest, NextResponse } from 'next/server';
import {
  getDomainKeywordsData,
  getDomainKeywordsByClient,
  getDomainKeywordsByClientAndLocation,
  getDomainKeywordsByClientLocationAndDomain,
} from '@/lib/domainOverviewStore';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientCode = searchParams.get('clientCode');
    const locationCode = searchParams.get('locationCode');
    const domain = searchParams.get('domain');

    let records;

    if (clientCode && locationCode && domain) {
      records = await getDomainKeywordsByClientLocationAndDomain(clientCode, locationCode, domain);
    } else if (clientCode && locationCode) {
      records = await getDomainKeywordsByClientAndLocation(clientCode, locationCode);
    } else if (clientCode) {
      records = await getDomainKeywordsByClient(clientCode);
    } else {
      records = await getDomainKeywordsData();
    }

    return NextResponse.json({
      success: true,
      count: records.length,
      records,
    });
  } catch (error) {
    console.error('Error fetching domain keywords data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch domain keywords data: ${errorMessage}` },
      { status: 500 }
    );
  }
}
