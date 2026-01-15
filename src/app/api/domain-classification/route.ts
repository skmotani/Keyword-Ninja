import { NextRequest, NextResponse } from 'next/server';
import { getClassificationsByClientCode, getAllClassifications } from '@/lib/domainClassificationStore';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientCode = searchParams.get('clientCode');
    
    if (clientCode) {
      const classifications = getClassificationsByClientCode(clientCode);
      return NextResponse.json(classifications);
    }
    
    const allClassifications = getAllClassifications();
    return NextResponse.json(allClassifications);
  } catch (error) {
    console.error('[Domain Classification] Error fetching classifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch classifications' },
      { status: 500 }
    );
  }
}
