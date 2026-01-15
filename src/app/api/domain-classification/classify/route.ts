import { NextRequest, NextResponse } from 'next/server';
import { classifyDomain } from '@/lib/domainClassifier';
import { saveClassification, saveClassifications } from '@/lib/domainClassificationStore';
import { getAiProfileByClientCode } from '@/lib/clientAiProfileStore';
import { ClientAIProfile, DomainClassification } from '@/types';

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

function normalizeDomain(domain: string): string {
  return domain.toLowerCase().trim().replace(/^www\./, '');
}

function isClientOwnDomain(domain: string, clientDomains: string[]): boolean {
  const normalizedDomain = normalizeDomain(domain);
  return clientDomains.some(clientDomain => {
    const normalizedClientDomain = normalizeDomain(clientDomain);
    return normalizedDomain === normalizedClientDomain ||
           normalizedDomain.endsWith('.' + normalizedClientDomain) ||
           normalizedClientDomain.endsWith('.' + normalizedDomain);
  });
}

function createSelfClassification(clientCode: string, domain: string, clientName: string): DomainClassification {
  return {
    id: `class-${clientCode}-${domain.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`,
    clientCode,
    domain,
    domainType: 'Brand / Platform / Corporate Site',
    pageIntent: 'Navigational / Brand',
    productMatchScoreValue: 1.0,
    productMatchScoreBucket: 'High',
    businessRelevanceCategory: 'Self',
    explanationLink: '#how-this-score-was-calculated',
    explanationSummary: `This is ${clientName}'s own domain. It has been automatically classified as "Self" since it belongs to the client.`,
    classifiedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
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

    if (isClientOwnDomain(domainRow.domain, clientProfile.primaryDomains)) {
      console.log(`[Domain Classification] Domain ${domainRow.domain} is client's own domain - marking as Self`);
      
      const classification = createSelfClassification(
        clientCode,
        domainRow.domain,
        clientProfile.clientName
      );
      
      await saveClassification(classification);
      
      return NextResponse.json({
        success: true,
        classification,
        isSelf: true,
      });
    }

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
