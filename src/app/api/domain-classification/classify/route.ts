import { NextRequest, NextResponse } from 'next/server';
import { classifyDomain } from '@/lib/domainClassifier';
import { saveClassification, saveClassifications } from '@/lib/domainClassificationStore';
import { getAiProfileByClientCode } from '@/lib/clientAiProfileStore';
import { ClientAIProfile } from '@/types';

interface DomainRowInput {
  domain: string;
  label: string;
  importance: number;
  keywords: number;
  appearances: number;
}

interface SerpRowInput {
  keyword: string;
  country: string;
  searchVolume: number | null;
  position: number;
  url: string;
  pageTitle: string;
  pageSnippet: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientCode, domainRow, serpRows } = body;

    if (!clientCode || !domainRow) {
      return NextResponse.json(
        { error: 'clientCode and domainRow are required' },
        { status: 400 }
      );
    }

    const clientProfile = await getAiProfileByClientCode(clientCode);
    
    if (!clientProfile) {
      return NextResponse.json(
        { error: 'No AI profile found for this client. Please generate an AI profile first.' },
        { status: 400 }
      );
    }

    console.log(`[Domain Classification] Classifying domain ${domainRow.domain} for client ${clientCode}`);

    const classification = await classifyDomain(
      clientProfile,
      domainRow as DomainRowInput,
      (serpRows || []) as SerpRowInput[]
    );

    await saveClassification(classification);

    console.log(`[Domain Classification] Classification saved for ${domainRow.domain}`);

    return NextResponse.json({
      success: true,
      classification,
    });
  } catch (error) {
    console.error('[Domain Classification] Error classifying domain:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to classify domain: ${errorMessage}` },
      { status: 500 }
    );
  }
}
