import { NextRequest, NextResponse } from 'next/server';
import {
  getDomainOverviewData,
  getDomainOverviewByClient,
  getDomainOverviewByClientAndLocation,
} from '@/lib/domainOverviewStore';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientCode = searchParams.get('clientCode');
    const locationCode = searchParams.get('locationCode');

    let records;

    if (clientCode && locationCode) {
      records = await getDomainOverviewByClientAndLocation(clientCode, locationCode);
    } else if (clientCode) {
      records = await getDomainOverviewByClient(clientCode);
    } else {
      records = await getDomainOverviewData();
    }

    return NextResponse.json({
      success: true,
      count: records.length,
      records,
    });
  } catch (error) {
    console.error('Error fetching domain overview data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch domain overview data: ${errorMessage}` },
      { status: 500 }
    );
  }
}
