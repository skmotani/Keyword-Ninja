import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { DomainPageRecord, ClientAIProfile } from '@/types';
import { extractPageClassificationConfig } from '@/lib/pageClassificationConfig';
import { classifyPageWithRules, PageRow } from '@/lib/pageClassificationRules';
import { classifyPageWithAi, AiClassificationResult } from '@/lib/pageClassificationAi';

const DOMAIN_PAGES_PATH = path.join(process.cwd(), 'data', 'domain_pages.json');
const CLIENT_AI_PROFILES_PATH = path.join(process.cwd(), 'data', 'client_ai_profiles.json');

async function readDomainPages(): Promise<DomainPageRecord[]> {
  try {
    const data = await fs.readFile(DOMAIN_PAGES_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeDomainPages(records: DomainPageRecord[]): Promise<void> {
  await fs.writeFile(DOMAIN_PAGES_PATH, JSON.stringify(records, null, 2));
}

async function getClientAiProfile(clientCode: string): Promise<ClientAIProfile | null> {
  try {
    const data = await fs.readFile(CLIENT_AI_PROFILES_PATH, 'utf-8');
    const profiles: ClientAIProfile[] = JSON.parse(data);
    return profiles.find((p) => p.clientCode === clientCode) || null;
  } catch {
    return null;
  }
}

function convertToPageRow(record: DomainPageRecord): PageRow {
  return {
    domain: record.domain,
    location: record.locationCode,
    pageUrl: record.pageURL,
    keyword: null,
    estTraffic: record.estTrafficETV,
    etv: record.estTrafficETV,
    pageTitle: null,
    pageSnippet: null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientCode, useAi = false, forceReclassify = false, pageIds = [] } = body;

    if (!clientCode) {
      return NextResponse.json(
        { success: false, error: 'clientCode is required' },
        { status: 400 }
      );
    }

    const allRecords = await readDomainPages();
    const clientRecords = allRecords.filter((r) => r.clientCode === clientCode);

    if (clientRecords.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No domain pages found for this client' },
        { status: 404 }
      );
    }

    const aiProfile = await getClientAiProfile(clientCode);
    const config = extractPageClassificationConfig(aiProfile);

    let recordsToClassify: DomainPageRecord[];

    if (pageIds && pageIds.length > 0) {
      recordsToClassify = clientRecords.filter((r) => pageIds.includes(r.id));
    } else if (forceReclassify) {
      recordsToClassify = clientRecords;
    } else if (useAi) {
      recordsToClassify = clientRecords.filter((r) => r.needsAiReview === true);
    } else {
      recordsToClassify = clientRecords.filter(
        (r) => !r.pageType || r.needsAiReview === true
      );
    }

    if (recordsToClassify.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No records need classification',
        stats: {
          total: clientRecords.length,
          ruleClassified: 0,
          aiClassified: 0,
          errors: 0,
        },
      });
    }

    let ruleClassifiedCount = 0;
    let aiClassifiedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    const recordMap = new Map(allRecords.map((r) => [r.id, r]));

    for (const record of recordsToClassify) {
      try {
        const pageRow = convertToPageRow(record);

        const ruleResult = classifyPageWithRules(pageRow, config);

        let finalResult: typeof ruleResult | AiClassificationResult = ruleResult;
        let classifiedWithAi = false;

        if (useAi && ruleResult.needsAiReview) {
          const aiResult = await classifyPageWithAi(pageRow, config, ruleResult);
          if (aiResult) {
            finalResult = aiResult;
            classifiedWithAi = true;
          }
        }

        const existingRecord = recordMap.get(record.id);
        if (existingRecord) {
          existingRecord.pageType = finalResult.pageType;
          existingRecord.pageIntent = finalResult.pageIntent;
          existingRecord.isSeoRelevant = finalResult.isSeoRelevant;
          existingRecord.classificationMethod = finalResult.classificationMethod;
          existingRecord.classificationConfidence = finalResult.classificationConfidence;
          existingRecord.needsAiReview = finalResult.needsAiReview;
          existingRecord.seoAction = finalResult.seoAction;
          existingRecord.classificationExplanation = finalResult.explanation;
        }

        if (classifiedWithAi) {
          aiClassifiedCount++;
        } else {
          ruleClassifiedCount++;
        }
      } catch (error) {
        errorCount++;
        errors.push(`Error classifying ${record.pageURL}: ${error}`);
        console.error(`Error classifying page ${record.id}:`, error);
      }
    }

    const updatedRecords = Array.from(recordMap.values());
    await writeDomainPages(updatedRecords);

    return NextResponse.json({
      success: true,
      message: `Classification completed for ${ruleClassifiedCount + aiClassifiedCount} records`,
      stats: {
        total: clientRecords.length,
        processed: recordsToClassify.length,
        ruleClassified: ruleClassifiedCount,
        aiClassified: aiClassifiedCount,
        errors: errorCount,
        needsAiReview: updatedRecords.filter(
          (r) => r.clientCode === clientCode && r.needsAiReview === true
        ).length,
      },
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (error) {
    console.error('Error in page classification:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const clientCode = searchParams.get('clientCode');

  if (!clientCode) {
    return NextResponse.json(
      { success: false, error: 'clientCode is required' },
      { status: 400 }
    );
  }

  const allRecords = await readDomainPages();
  const clientRecords = allRecords.filter((r) => r.clientCode === clientCode);

  const stats = {
    total: clientRecords.length,
    classified: clientRecords.filter((r) => r.pageType).length,
    unclassified: clientRecords.filter((r) => !r.pageType).length,
    needsAiReview: clientRecords.filter((r) => r.needsAiReview === true).length,
    byMethod: {
      rule: clientRecords.filter((r) => r.classificationMethod === 'RULE').length,
      ai: clientRecords.filter((r) => r.classificationMethod === 'AI').length,
    },
    byPageType: {} as Record<string, number>,
    byPageIntent: {} as Record<string, number>,
    bySeoAction: {} as Record<string, number>,
  };

  clientRecords.forEach((r) => {
    if (r.pageType) {
      stats.byPageType[r.pageType] = (stats.byPageType[r.pageType] || 0) + 1;
    }
    if (r.pageIntent) {
      stats.byPageIntent[r.pageIntent] = (stats.byPageIntent[r.pageIntent] || 0) + 1;
    }
    if (r.seoAction) {
      stats.bySeoAction[r.seoAction] = (stats.bySeoAction[r.seoAction] || 0) + 1;
    }
  });

  return NextResponse.json({
    success: true,
    stats,
  });
}
