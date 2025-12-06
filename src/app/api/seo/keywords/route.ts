import { NextRequest, NextResponse } from 'next/server';
import { getKeywordApiData } from '@/lib/keywordApiStore';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientCode = searchParams.get('clientCode');
    const locationCodes = searchParams.get('locationCodes');

    let records = await getKeywordApiData();
    
    if (clientCode) {
      records = records.filter(r => r.clientCode === clientCode);
    }
    if (locationCodes) {
      const locationList = locationCodes.split(',').map(l => l.trim());
      records = records.filter(r => locationList.includes(r.locationCode));
    }

    return NextResponse.json(records);
  } catch (error) {
    console.error('Error fetching keyword API data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch keyword API data' },
      { status: 500 }
    );
  }
}
