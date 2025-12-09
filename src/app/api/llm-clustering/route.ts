import { NextRequest, NextResponse } from 'next/server';
import { runLlmClusteringForDomainPages } from '@/lib/llmClustering';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientCode, locationCode, maxUrls, batchSize, runLabel } = body;

    if (!clientCode) {
      return NextResponse.json(
        { success: false, error: 'clientCode is required' },
        { status: 400 }
      );
    }

    const result = await runLlmClusteringForDomainPages({
      clientCode,
      locationCode,
      maxUrls: maxUrls ? Number(maxUrls) : undefined,
      batchSize: batchSize ? Number(batchSize) : 80,
      runLabel: runLabel || `${new Date().toISOString().split('T')[0]}-${clientCode}`,
    });

    return NextResponse.json({
      success: result.success,
      totalProcessed: result.totalProcessed,
      totalBatches: result.totalBatches,
      clustersCreated: result.clustersCreated,
      sampleLabels: result.sampleLabels,
      errors: result.errors,
    });
  } catch (error) {
    console.error('LLM clustering API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
