import { NextRequest, NextResponse } from 'next/server';
import { getKeywordApiData } from '@/lib/keywordApiStore';

const STRING_TO_NUMERIC: Record<string, number> = {
  'IN': 2356, 'India': 2356, 'in': 2356,
  'GL': 2840, 'US': 2840, 'Global': 2840, 'gl': 2840, 'us': 2840,
  'UK': 2826, 'uk': 2826,
  'AU': 2036, 'au': 2036,
  'CA': 2124, 'ca': 2124,
};

const NUMERIC_TO_STRING: Record<number, string[]> = {
  2356: ['IN', 'India', 'in'],
  2840: ['GL', 'US', 'Global', 'gl', 'us'],
  2826: ['UK', 'uk'],
  2036: ['AU', 'au'],
  2124: ['CA', 'ca'],
};

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
      
      const allStringsToMatch = new Set<string>();
      for (const numCode of numericLocations) {
        const strings = NUMERIC_TO_STRING[numCode] || [];
        strings.forEach(s => allStringsToMatch.add(s));
      }
      
      records = records.filter(r => {
        if (typeof r.locationCode === 'number') {
          return numericLocations.includes(r.locationCode);
        }
        const locStr = r.locationCode as unknown as string;
        if (allStringsToMatch.has(locStr)) {
          return true;
        }
        const numericEquiv = STRING_TO_NUMERIC[locStr];
        return numericEquiv ? numericLocations.includes(numericEquiv) : false;
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
