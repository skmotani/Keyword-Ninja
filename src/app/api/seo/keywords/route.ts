import { NextRequest, NextResponse } from 'next/server';
import { getKeywordApiData } from '@/lib/keywordApiStore';

const STRING_TO_NUMERIC: Record<string, number> = {
  'IN': 2356, 'India': 2356, 'in': 2356,
  'GL': 2840, 'US': 2840, 'Global': 2840, 'gl': 2840, 'us': 2840,
  'UK': 2826, 'uk': 2826,
  'AU': 2036, 'au': 2036,
  'CA': 2124, 'ca': 2124,
};

function canonicalizeLocationCode(locCode: number | string): number {
  if (typeof locCode === 'number') {
    return locCode;
  }
  const numericEquiv = STRING_TO_NUMERIC[locCode];
  if (numericEquiv) {
    return numericEquiv;
  }
  const parsed = parseInt(locCode, 10);
  return isNaN(parsed) ? 0 : parsed;
}

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
      const numericLocations = locationList.map(l => STRING_TO_NUMERIC[l] || parseInt(l, 10));
      
      records = records.filter(r => {
        const canonicalLoc = canonicalizeLocationCode(r.locationCode);
        return numericLocations.includes(canonicalLoc);
      });
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
