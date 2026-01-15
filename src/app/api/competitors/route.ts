import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getCompetitors, createCompetitor, updateCompetitor, deleteCompetitor } from '@/lib/db';
import { Competitor } from '@/types';

export async function GET() {
  const competitors = await getCompetitors();
  return NextResponse.json(competitors);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const existingCompetitors = await getCompetitors();

  // Helper function to check for duplicates
  const isDuplicate = (clientCode: string, domain: string) => {
    const cleanDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
    return existingCompetitors.some(c =>
      c.clientCode === clientCode &&
      c.domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '') === cleanDomain
    );
  };

  if (body.bulk && Array.isArray(body.competitors)) {
    const createdCompetitors: Competitor[] = [];
    const skipped: string[] = [];

    for (const comp of body.competitors) {
      // Skip duplicates
      if (isDuplicate(comp.clientCode, comp.domain)) {
        skipped.push(comp.domain);
        continue;
      }

      const newCompetitor: Competitor = {
        id: uuidv4(),
        clientCode: comp.clientCode,
        name: comp.name,
        domain: comp.domain,
        notes: comp.notes || '',
        isActive: true,
        source: comp.source || 'Manual Entry',
        importanceScore: comp.importanceScore,
        domainType: comp.domainType,
        pageIntent: comp.pageIntent,
        productMatchScoreValue: comp.productMatchScoreValue,
        productMatchScoreBucket: comp.productMatchScoreBucket,
        businessRelevanceCategory: comp.businessRelevanceCategory,
        explanationSummary: comp.explanationSummary,
        addedAt: new Date().toISOString(),
        competitionType: comp.competitionType,
        competitorForProducts: comp.competitorForProducts,
      };
      await createCompetitor(newCompetitor);
      createdCompetitors.push(newCompetitor);
      // Add to existingCompetitors to catch duplicates within the batch
      existingCompetitors.push(newCompetitor);
    }
    return NextResponse.json({
      added: createdCompetitors.length,
      skipped: skipped.length,
      skippedDomains: skipped,
      competitors: createdCompetitors
    }, { status: 201 });
  }

  // Check for duplicate before single add
  if (isDuplicate(body.clientCode, body.domain)) {
    return NextResponse.json({
      error: 'Duplicate competitor',
      message: `Domain "${body.domain}" already exists for this client`
    }, { status: 409 });
  }

  const newCompetitor: Competitor = {
    id: uuidv4(),
    clientCode: body.clientCode,
    name: body.name,
    domain: body.domain,
    notes: body.notes || '',
    isActive: true,
    source: body.source || 'Manual Entry',
    importanceScore: body.importanceScore,
    domainType: body.domainType,
    pageIntent: body.pageIntent,
    productMatchScoreValue: body.productMatchScoreValue,
    productMatchScoreBucket: body.productMatchScoreBucket,
    businessRelevanceCategory: body.businessRelevanceCategory,
    explanationSummary: body.explanationSummary,
    addedAt: new Date().toISOString(),
    competitionType: body.competitionType,
    competitorForProducts: body.competitorForProducts,
  };

  await createCompetitor(newCompetitor);
  return NextResponse.json(newCompetitor, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, ...updates } = body;

  const updated = await updateCompetitor(id, updates);
  if (!updated) {
    return NextResponse.json({ error: 'Competitor not found' }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  const deleted = await deleteCompetitor(id);
  if (!deleted) {
    return NextResponse.json({ error: 'Competitor not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
