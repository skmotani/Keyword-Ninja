import { NextRequest, NextResponse } from 'next/server';
import {
  getDomainPagesByClient,
  getDomainPagesByClientAndLocation,
  getDomainPagesByClientLocationAndDomain,
  updateDomainPagesById,
} from '@/lib/domainOverviewStore';
import { calculatePriorityBatch } from '@/lib/priorityScoring';
import { DomainPageRecord } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientCode, locationCode, domain } = body;

    if (!clientCode) {
      return NextResponse.json(
        { error: 'clientCode is required' },
        { status: 400 }
      );
    }

    let pages: DomainPageRecord[];

    if (clientCode && locationCode && domain) {
      pages = await getDomainPagesByClientLocationAndDomain(clientCode, locationCode, domain);
    } else if (clientCode && locationCode) {
      pages = await getDomainPagesByClientAndLocation(clientCode, locationCode);
    } else {
      pages = await getDomainPagesByClient(clientCode);
    }

    if (pages.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pages found for the specified filters',
        updatedCount: 0,
      });
    }

    const priorityResults = calculatePriorityBatch(pages);

    const now = new Date().toISOString();
    const updates = pages.map((page) => {
      const result = priorityResults.get(page.id);
      if (!result) {
        return { id: page.id, data: {} };
      }
      return {
        id: page.id,
        data: {
          priorityScore: result.priorityScore,
          priorityTier: result.priorityTier,
          priorityScoreBreakdown: result.breakdown,
          priorityCalculatedAt: now,
        },
      };
    }).filter((u) => Object.keys(u.data).length > 0);

    const updatedCount = await updateDomainPagesById(updates);

    return NextResponse.json({
      success: true,
      message: `Priority scores calculated for ${updatedCount} pages`,
      updatedCount,
      summary: {
        totalPages: pages.length,
        tiersBreakdown: summarizeTiers(priorityResults),
      },
    });
  } catch (error) {
    console.error('Error computing priority scores:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to compute priority scores: ${errorMessage}` },
      { status: 500 }
    );
  }
}

function summarizeTiers(
  results: Map<string, { priorityTier: string }>
): Record<string, number> {
  const counts: Record<string, number> = {
    TIER_1_IMMEDIATE: 0,
    TIER_2_HIGH: 0,
    TIER_3_MEDIUM: 0,
    TIER_4_MONITOR: 0,
    TIER_5_IGNORE: 0,
  };

  const values = Array.from(results.values());
  for (const result of values) {
    if (result.priorityTier in counts) {
      counts[result.priorityTier]++;
    }
  }

  return counts;
}
