import { NextRequest, NextResponse } from 'next/server';
import {
  getDomainPagesByClient,
  getDomainPagesByClientAndLocation,
  getDomainPagesByClientLocationAndDomain,
  updateDomainPagesById,
} from '@/lib/domainOverviewStore';
import { getAiProfileByClientCode } from '@/lib/clientAiProfileStore';
import {
  classifyPagesBatch,
  extractProductsFromProfile,
  buildClusterMapping,
} from '@/lib/productClustering';
import { DomainPageRecord } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientCode, locationCode, domain, forceReclassify } = body;

    if (!clientCode) {
      return NextResponse.json(
        { error: 'clientCode is required' },
        { status: 400 }
      );
    }

    const profile = await getAiProfileByClientCode(clientCode);
    if (!profile) {
      return NextResponse.json(
        { error: `No AI profile found for client: ${clientCode}. Please generate an AI profile first.` },
        { status: 404 }
      );
    }

    const products = extractProductsFromProfile(profile);
    if (products.length === 0) {
      return NextResponse.json(
        { error: 'No product lines found in client AI profile. Please ensure the profile has productLines defined.' },
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

    const pagesToClassify = forceReclassify
      ? pages
      : pages.filter((p) => !p.matchedProduct && !p.productClassifiedAt);

    if (pagesToClassify.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All pages have already been classified. Use forceReclassify=true to reclassify.',
        updatedCount: 0,
        alreadyClassified: pages.length,
      });
    }

    const classificationResults = classifyPagesBatch(pagesToClassify, profile);

    const now = new Date().toISOString();
    const updates = classificationResults.map((result) => ({
      id: result.pageId,
      data: {
        matchedProduct: result.result.matchedProduct,
        clusterName: result.result.clusterName,
        productClassifiedAt: now,
      },
    }));

    const updatedCount = await updateDomainPagesById(updates);

    const clusterMappings = buildClusterMapping(products);
    const clusterBreakdown = summarizeClusterResults(classificationResults);
    const productBreakdown = summarizeProductResults(classificationResults);

    return NextResponse.json({
      success: true,
      message: `Product classification completed for ${updatedCount} pages`,
      updatedCount,
      summary: {
        totalPages: pages.length,
        pagesClassified: pagesToClassify.length,
        pagesWithMatch: classificationResults.filter((r) => r.result.matchedProduct).length,
        pagesNoMatch: classificationResults.filter((r) => !r.result.matchedProduct).length,
        productsFound: products,
        clustersAvailable: clusterMappings.map((m) => m.cluster),
        clusterBreakdown,
        productBreakdown,
      },
    });
  } catch (error) {
    console.error('Error classifying products:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to classify products: ${errorMessage}` },
      { status: 500 }
    );
  }
}

interface ClassificationResult {
  pageId: string;
  result: {
    matchedProduct: string | null;
    clusterName: string | null;
  };
}

function summarizeClusterResults(
  results: ClassificationResult[]
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const result of results) {
    const cluster = result.result.clusterName || 'Unclassified';
    counts[cluster] = (counts[cluster] || 0) + 1;
  }

  return counts;
}

function summarizeProductResults(
  results: ClassificationResult[]
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const result of results) {
    const product = result.result.matchedProduct || 'No Match';
    counts[product] = (counts[product] || 0) + 1;
  }

  return counts;
}
