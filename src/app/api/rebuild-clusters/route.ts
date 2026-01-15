import { NextRequest, NextResponse } from 'next/server';
import { DomainPageRecord } from '@/types';
import { tagPageCluster, ClusterTagResult } from '@/lib/clusterTagging';
import {
  getDomainPagesByClient,
  getDomainPagesByClientAndLocation,
  getDomainPagesData,
} from '@/lib/domainOverviewStore';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DOMAIN_PAGES_FILE = path.join(DATA_DIR, 'domain_pages.json');

async function writeDomainPages(records: DomainPageRecord[]): Promise<void> {
  await fs.writeFile(DOMAIN_PAGES_FILE, JSON.stringify(records, null, 2), 'utf-8');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientCode, locationCode, useAI = false } = body;
    
    if (!clientCode) {
      return NextResponse.json(
        { success: false, error: 'clientCode is required' },
        { status: 400 }
      );
    }

    const openaiApiKey = useAI ? process.env.OPENAI_API_KEY : undefined;
    
    const allRecords = await getDomainPagesData();
    
    let targetRecords: DomainPageRecord[];
    if (locationCode) {
      targetRecords = await getDomainPagesByClientAndLocation(clientCode, locationCode);
    } else {
      targetRecords = await getDomainPagesByClient(clientCode);
    }
    
    if (targetRecords.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No records found to process',
        processed: 0,
        total: 0,
      });
    }

    let processedCount = 0;
    const now = new Date().toISOString();
    const targetIds = new Set(targetRecords.map(r => r.id));
    
    for (const record of allRecords) {
      if (!targetIds.has(record.id)) continue;
      
      try {
        const tagResult: ClusterTagResult = await tagPageCluster(
          {
            domain: record.domain,
            pageUrl: record.pageURL,
            pageType: record.pageType,
            estTrafficEtv: record.estTrafficETV,
            keywordsCount: record.keywordsCount,
            pageTitle: null,
            topKeyword: null,
          },
          openaiApiKey
        );
        
        record.cluster = tagResult.cluster;
        record.clusterName = tagResult.cluster;
        record.clusterSource = tagResult.clusterSource;
        record.clusterExplanation = tagResult.clusterExplanation;
        record.clusterTaggedAt = now;
        
        processedCount++;
      } catch (error) {
        console.error(`Error tagging page ${record.pageURL}:`, error);
      }
    }
    
    await writeDomainPages(allRecords);

    return NextResponse.json({
      success: true,
      message: `Rebuilt clusters for ${processedCount} pages`,
      processed: processedCount,
      total: targetRecords.length,
    });
  } catch (error) {
    console.error('Rebuild clusters error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
