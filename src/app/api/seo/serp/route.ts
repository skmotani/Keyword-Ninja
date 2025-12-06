import { NextRequest, NextResponse } from 'next/server';
import { getSerpDataByClientAndLocations } from '@/lib/serpStore';

const STRING_TO_NUMERIC: Record<string, number> = {
  'IN': 2356, 'India': 2356, 'in': 2356,
  'GL': 2840, 'US': 2840, 'Global': 2840, 'gl': 2840, 'us': 2840,
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientCode = searchParams.get('clientCode');
    const locationCodesParam = searchParams.get('locationCodes');

    if (!clientCode) {
      return NextResponse.json(
        { error: 'clientCode is required' },
        { status: 400 }
      );
    }

    let numericLocationCodes: number[] = [2356, 2840];
    if (locationCodesParam) {
      const codes = locationCodesParam.split(',').map(c => c.trim());
      numericLocationCodes = codes.map(c => STRING_TO_NUMERIC[c] || parseInt(c, 10) || 2840);
    }

    const records = await getSerpDataByClientAndLocations(clientCode, numericLocationCodes);
    return NextResponse.json(records);
  } catch (error) {
    console.error('Error fetching SERP data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch SERP data' },
      { status: 500 }
    );
  }
}
