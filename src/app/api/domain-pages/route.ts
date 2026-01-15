import { NextRequest, NextResponse } from 'next/server';
import {
  getDomainPagesData,
  getDomainPagesByClient,
  getDomainPagesByClientAndLocation,
  getDomainPagesByClientLocationAndDomain,
} from '@/lib/domainOverviewStore';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientCode = searchParams.get('clientCode');
    const locationCode = searchParams.get('locationCode');
    const domain = searchParams.get('domain');

    let records;

    if (clientCode && locationCode && domain) {
      records = await getDomainPagesByClientLocationAndDomain(clientCode, locationCode, domain);
    } else if (clientCode && locationCode) {
      records = await getDomainPagesByClientAndLocation(clientCode, locationCode);
    } else if (clientCode) {
      records = await getDomainPagesByClient(clientCode);
    } else {
      records = await getDomainPagesData();
    }

    return NextResponse.json({
      success: true,
      count: records.length,
      records,
    });
  } catch (error) {
    console.error('Error fetching domain pages data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch domain pages data: ${errorMessage}` },
      { status: 500 }
    );
  }
}
