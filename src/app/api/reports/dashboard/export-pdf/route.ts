import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getQueryById, getActiveQueries } from '@/lib/storage/dashboardQueryStore';
import { DashboardQueryResult } from '@/types/dashboardTypes';
import { Client } from '@/types';
import { POST as executeQuery } from '../execute/route';

const DATA_DIR = path.join(process.cwd(), 'data');

async function readClients(): Promise<Client[]> {
  try {
    const filePath = path.join(DATA_DIR, 'clients.json');
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as Client[];
  } catch {
    return [];
  }
}

// Helper to render any data as table or structured HTML
function renderDataAsHtml(queryType: string, data: any): string {
  if (!data) return '<p class="no-data">No data available</p>';

  // Handle different query types with custom rendering
  switch (queryType) {
    case 'top3-surfaces-by-category':
      return renderTop3SurfacesHtml(data);
    case 'client-business':
      return renderClientBusinessHtml(data);
    case 'home-page':
      return renderHomePageHtml(data);
    case 'top20-include-buy':
    case 'top20-include-learn':
      return renderTop20KeywordsHtml(data);
    case 'brand-keywords-matrix':
      return renderBrandPowerHtml(data);
    case 'keyword-opportunity-matrix':
      return renderKeywordOpportunityHtml(data);
    case 'competitor-balloon':
      return renderCompetitorBalloonHtml(data);
    default:
      return renderGenericDataHtml(data);
  }
}

function renderTop3SurfacesHtml(data: any): string {
  if (!data.categories || !Array.isArray(data.categories)) {
    return '<p>No surfaces data</p>';
  }

  let html = `
        <div class="summary-row">
            <span><strong>Categories:</strong> ${data.summary?.totalCategories || 0}</span>
            <span><strong>Surfaces:</strong> ${data.summary?.totalSurfaces || 0}</span>
            <span><strong>Total Points:</strong> ${data.summary?.totalPoints || 0}</span>
        </div>
        <div class="categories-grid">
    `;

  for (const cat of data.categories) {
    html += `
            <div class="category-card">
                <h4>${cat.categoryLabel} <span class="points-badge">${cat.totalPoints || 0} pts</span></h4>
                <table class="data-table">
                    <thead><tr><th>Surface</th><th>Importance</th><th>Points</th><th>Why It Matters</th></tr></thead>
                    <tbody>
                        ${cat.surfaces.map((s: any) => `
                            <tr>
                                <td>${s.label}</td>
                                <td><span class="importance-${s.importance.toLowerCase()}">${s.importance}</span></td>
                                <td>${s.points}</td>
                                <td class="small-text">${s.whyItMatters}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
  }

  html += '</div>';
  return html;
}

function renderClientBusinessHtml(data: any): string {
  let html = '<div class="business-info">';

  if (data.businessOverview) {
    html += `
            <div class="info-section">
                <h4>Business Overview</h4>
                <p><strong>Summary:</strong> ${data.businessOverview.summary || 'N/A'}</p>
                <p><strong>Business Model:</strong> ${data.businessOverview.businessModel || 'N/A'}</p>
                <p><strong>Industry:</strong> ${data.businessOverview.industry || 'N/A'}</p>
            </div>
        `;
  }

  if (data.productMarket) {
    html += `
            <div class="info-section">
                <h4>Product & Market</h4>
                <p><strong>Products:</strong> ${(data.productMarket.products || []).join(', ') || 'N/A'}</p>
                <p><strong>Segments:</strong> ${(data.productMarket.segments || []).join(', ') || 'N/A'}</p>
                <p><strong>Geographies:</strong> ${(data.productMarket.geographies || []).join(', ') || 'N/A'}</p>
            </div>
        `;
  }

  if (data.domains && data.domains.length > 0) {
    html += `
            <div class="info-section">
                <h4>Domains</h4>
                <table class="data-table">
                    <thead><tr><th>Domain</th><th>Organic Traffic</th><th>Keywords</th></tr></thead>
                    <tbody>
                        ${data.domains.map((d: any) => `
                            <tr><td>${d.domain}</td><td>${(d.organicTraffic || 0).toLocaleString()}</td><td>${d.organicKeywords || 0}</td></tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
  }

  html += '</div>';
  return html;
}

function renderHomePageHtml(data: any): string {
  let imagesHtml = '';

  // Render logos if available
  if (data.clientLogo || data.appLogo) {
    imagesHtml = `<div class="logo-row">
      ${data.clientLogo ? `<div class="logo-item"><img src="${data.clientLogo}" alt="Client Logo" class="report-logo" /><span>Client Logo</span></div>` : ''}
      ${data.appLogo ? `<div class="logo-item"><img src="${data.appLogo}" alt="App Logo" class="report-logo" /><span>App Logo</span></div>` : ''}
    </div>`;
  }

  return `
        <div class="home-page-info">
            ${imagesHtml}
            <p><strong>Client:</strong> ${data.clientName || 'N/A'}</p>
            <p><strong>App Name:</strong> ${data.appName || 'N/A'}</p>
            ${data.tagline ? `<p><strong>Tagline:</strong> ${data.tagline}</p>` : ''}
            ${data.punchline ? `<p><strong>Punchline:</strong> ${data.punchline}</p>` : ''}
        </div>
    `;
}

function renderTop20KeywordsHtml(data: any): string {
  if (!data.keywords || !Array.isArray(data.keywords)) {
    return '<p>No keywords data</p>';
  }

  return `
        <div class="summary-row">
            <span><strong>Total Keywords:</strong> ${data.summary?.totalIncludeBuyKeywords || data.summary?.totalIncludeLearnKeywords || 0}</span>
        </div>
        <table class="data-table">
            <thead>
                <tr><th>#</th><th>Keyword</th><th>Bucket</th><th>Total Volume</th><th>IN Vol</th><th>GL Vol</th><th>Pos IN</th><th>Pos GL</th></tr>
            </thead>
            <tbody>
                ${data.keywords.map((k: any) => `
                    <tr>
                        <td>${k.rank}</td>
                        <td>${k.keyword}</td>
                        <td>${k.bucket}</td>
                        <td>${(k.totalVolume || 0).toLocaleString()}</td>
                        <td>${(k.volumeIN || 0).toLocaleString()}</td>
                        <td>${(k.volumeGL || 0).toLocaleString()}</td>
                        <td>${k.selfPosIN || '-'}</td>
                        <td>${k.selfPosGL || '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderBrandPowerHtml(data: any): string {
  if (!data.domains || !Array.isArray(data.domains)) {
    return '<p>No brand power data</p>';
  }

  // Only show summary row and summary table - NO individual domain keyword tables
  let html = `
        <div class="summary-row">
            <span><strong>Total Domains:</strong> ${data.summary?.totalDomains || 0}</span>
            <span><strong>Brand Keywords:</strong> ${data.summary?.totalBrandKeywords || 0}</span>
            <span><strong>Brand Volume:</strong> ${(data.summary?.totalBrandVolume || 0).toLocaleString()}</span>
        </div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Domain</th>
                    <th>Brand Name</th>
                    <th>Type</th>
                    <th>Brand Keywords</th>
                    <th>Total Volume</th>
                </tr>
            </thead>
            <tbody>
                ${data.domains.map((d: any) => `
                    <tr>
                        <td>${d.domain}</td>
                        <td>${d.brandName}</td>
                        <td><span class="badge">${d.domainType}</span></td>
                        <td>${d.brandKeywordCount}</td>
                        <td>${(d.totalBrandVolume || 0).toLocaleString()}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

  return html;
}

function renderKeywordOpportunityHtml(data: any): string {
  if (!data.matrix) {
    return '<p>No opportunity matrix data</p>';
  }

  let html = `
        <div class="summary-row">
            <span><strong>Total Keywords:</strong> ${data.summary?.totalKeywords || 0}</span>
            <span><strong>Opportunity Score:</strong> ${data.summary?.opportunityScore || 0}%</span>
        </div>
        <table class="data-table">
            <thead><tr><th>Category</th><th>Count</th><th>Volume</th><th>Avg Position</th></tr></thead>
            <tbody>
    `;

  const categories = ['quickWins', 'highPotential', 'defensive', 'longTerm'];
  for (const cat of categories) {
    const catData = data.matrix[cat];
    if (catData) {
      html += `<tr><td>${cat}</td><td>${catData.count || 0}</td><td>${(catData.volume || 0).toLocaleString()}</td><td>${catData.avgPosition || '-'}</td></tr>`;
    }
  }

  html += '</tbody></table>';
  return html;
}

function renderCompetitorBalloonHtml(data: any): string {
  if (!data.balloons || !Array.isArray(data.balloons)) {
    return '<p>No competitor data</p>';
  }

  return `
        <div class="summary-row">
            <span><strong>Main Competitors:</strong> ${data.summary?.totalMainCompetitors || 0}</span>
            <span><strong>Your Traffic Share:</strong> ${(data.summary?.yourTrafficShare || 0).toFixed(1)}%</span>
        </div>
        <table class="data-table">
            <thead><tr><th>Domain</th><th>Brand</th><th>Traffic</th><th>ETV</th><th>Age (Yrs)</th><th>Type</th></tr></thead>
            <tbody>
                ${data.balloons.map((b: any) => `
                    <tr class="${b.isSelf ? 'highlight-row' : ''}">
                        <td>${b.domain}</td>
                        <td>${b.brandName}</td>
                        <td>${(b.traffic || 0).toLocaleString()}</td>
                        <td>${(b.etv || 0).toLocaleString()}</td>
                        <td>${b.age || '-'}</td>
                        <td>${b.isSelf ? 'Self' : 'Competitor'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderGenericDataHtml(data: any): string {
  if (typeof data === 'object') {
    // Try to render as table if it has array data
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key]) && data[key].length > 0 && typeof data[key][0] === 'object') {
        const items = data[key];
        const headers = Object.keys(items[0]);
        return `
                    <table class="data-table">
                        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                        <tbody>
                            ${items.slice(0, 20).map((item: any) => `
                                <tr>${headers.map(h => `<td>${formatValue(item[h])}</td>`).join('')}</tr>
                            `).join('')}
                        </tbody>
                    </table>
                    ${items.length > 20 ? `<p class="small-text">...and ${items.length - 20} more items</p>` : ''}
                `;
      }
    }

    // Render as key-value pairs
    return `
            <div class="key-value-list">
                ${Object.entries(data).map(([key, value]) => `
                    <p><strong>${key}:</strong> ${formatValue(value)}</p>
                `).join('')}
            </div>
        `;
  }

  return `<p>${String(data)}</p>`;
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') return value.toLocaleString();
  if (Array.isArray(value)) return value.length > 3 ? `[${value.length} items]` : value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value).substring(0, 100) + '...';
  return String(value);
}

// Generate HTML content for PDF - includes full card data
function generatePdfHtml(
  clientName: string,
  clientCode: string,
  results: Array<{
    result: DashboardQueryResult;
    description?: string;
    tooltip?: string;
    sourceInfo?: { tables: string[]; page?: string; pageUrl?: string };
  }>
): string {
  const now = new Date().toLocaleString();

  let querySections = '';

  for (const { result, description, tooltip, sourceInfo } of results) {
    const dataHtml = renderDataAsHtml(result.queryType, result.data);

    // Build metadata section
    let metadataHtml = '';

    if (description) {
      metadataHtml += `<div class="query-meta"><span class="meta-label">Query:</span> ${description}</div>`;
    }

    if (tooltip) {
      metadataHtml += `<div class="query-meta seo-text"><span class="meta-label">SEO:</span> ${tooltip}</div>`;
    }

    if (sourceInfo?.tables?.length) {
      metadataHtml += `<div class="query-meta tables-info">
        <span class="meta-label">📊 Tables:</span> ${sourceInfo.tables.join(', ')}
        ${sourceInfo.page ? `<span class="page-link">| 📄 Page: ${sourceInfo.page}</span>` : ''}
      </div>`;
    }

    querySections += `
      <div class="query-section">
        <div class="query-header">
          <h2>${result.queryId} - ${result.title}</h2>
          <span class="status-badge status-${result.status.toLowerCase()}">${result.status}</span>
        </div>
        ${metadataHtml ? `<div class="query-metadata">${metadataHtml}</div>` : ''}
        <div class="query-content">
          ${dataHtml}
        </div>
      </div>
    `;
  }


  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Dashboard Report - ${clientName}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 40px;
          color: #333;
          line-height: 1.6;
          background: #fff;
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 3px solid #4f46e5;
        }
        .header h1 { color: #4f46e5; font-size: 28px; margin-bottom: 8px; }
        .header .subtitle { color: #666; font-size: 14px; }
        .meta-info {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 30px;
          display: flex;
          justify-content: space-between;
        }
        .meta-info span { font-size: 13px; color: #555; }
        .query-section {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          margin-bottom: 20px;
          overflow: hidden;
          page-break-inside: avoid;
        }
        .query-header {
          background: #f8f9fa;
          padding: 15px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #e5e7eb;
        }
        .query-header h2 { font-size: 16px; color: #1f2937; }
        .status-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        .status-critical { background: #fee2e2; color: #dc2626; }
        .status-warning { background: #fef3c7; color: #d97706; }
        .status-info { background: #dbeafe; color: #2563eb; }
        .status-success { background: #dcfce7; color: #16a34a; }
        .query-metadata {
          padding: 12px 20px;
          background: #fefce8;
          border-bottom: 1px solid #e5e7eb;
          font-size: 12px;
        }
        .query-meta {
          margin-bottom: 6px;
          color: #555;
          line-height: 1.4;
        }
        .query-meta:last-child { margin-bottom: 0; }
        .meta-label {
          font-weight: 600;
          color: #374151;
          margin-right: 6px;
        }
        .seo-text { color: #059669; font-style: italic; }
        .tables-info { color: #6b7280; }
        .page-link { margin-left: 10px; color: #4f46e5; }
        .query-content { padding: 20px; }
        .no-data { color: #999; font-style: italic; }
        .summary-row {
          display: flex;
          gap: 20px;
          margin-bottom: 15px;
          padding: 10px;
          background: #f8f9fa;
          border-radius: 6px;
        }
        .summary-row span { font-size: 13px; }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          margin-top: 10px;
        }
        .data-table th, .data-table td {
          padding: 8px 10px;
          text-align: left;
          border-bottom: 1px solid #e5e7eb;
        }
        .data-table th {
          background: #f8f9fa;
          font-weight: 600;
          color: #374151;
        }
        .data-table tr:hover { background: #f9fafb; }
        .data-table.small { font-size: 11px; }
        .highlight-row { background: #eff6ff !important; }
        .categories-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
        }
        .category-card {
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 12px;
          background: #fafafa;
        }
        .category-card h4 {
          font-size: 13px;
          margin-bottom: 10px;
          color: #4f46e5;
          display: flex;
          justify-content: space-between;
        }
        .points-badge {
          background: #dbeafe;
          color: #2563eb;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 11px;
        }
        .importance-critical { color: #dc2626; font-weight: 600; }
        .importance-high { color: #d97706; }
        .importance-medium { color: #2563eb; }
        .importance-low { color: #6b7280; }
        .badge {
          background: #e5e7eb;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          margin-left: 8px;
        }
        .logo-row {
          display: flex;
          gap: 30px;
          margin-bottom: 20px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
        }
        .logo-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .logo-item span {
          font-size: 11px;
          color: #6b7280;
        }
        .report-logo {
          max-width: 120px;
          max-height: 80px;
          object-fit: contain;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 8px;
          background: #fff;
        }
        .info-section {
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid #e5e7eb;
        }
        .info-section h4 {
          color: #4f46e5;
          margin-bottom: 10px;
          font-size: 14px;
        }
        .info-section p { margin-bottom: 5px; font-size: 13px; }
        .domain-section {
          margin-bottom: 20px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 6px;
        }
        .domain-section h4 {
          margin-bottom: 8px;
          font-size: 14px;
        }
        .small-text { font-size: 11px; color: #666; }
        .key-value-list p { margin-bottom: 8px; font-size: 13px; }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #9ca3af;
          font-size: 12px;
        }
        @media print {
          body { padding: 20px; }
          .query-section { page-break-inside: avoid; }
          .categories-grid { grid-template-columns: repeat(2, 1fr); }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Dashboard Report</h1>
        <p class="subtitle">SEO Intelligence Platform</p>
      </div>
      
      <div class="meta-info">
        <span><strong>Client:</strong> ${clientName} (${clientCode})</span>
        <span><strong>Generated:</strong> ${now}</span>
      </div>
      
      ${querySections}
      
      <div class="footer">
        <p>Generated by SEO Intelligence Platform</p>
      </div>
    </body>
    </html>
  `;
}

// POST /api/reports/dashboard/export-pdf - Export dashboard as HTML (for PDF generation)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientCode, queryIds } = body;

    if (!clientCode) {
      return NextResponse.json(
        { success: false, error: 'clientCode is required' },
        { status: 400 }
      );
    }

    // Get client info
    const clients = await readClients();
    const client = clients.find(c => c.code === clientCode);
    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404 }
      );
    }

    // Get queries to export
    let queriesToExport;
    if (queryIds && queryIds.length > 0) {
      const promises = queryIds.map((id: string) => getQueryById(id));
      const queryResults = await Promise.all(promises);
      queriesToExport = queryResults.filter(q => q !== null);
    } else {
      queriesToExport = await getActiveQueries();
    }

    // Type for results with metadata
    type ResultWithMeta = {
      result: DashboardQueryResult;
      description?: string;
      tooltip?: string;
      sourceInfo?: { tables: string[]; page?: string; pageUrl?: string };
    };

    // Execute each query using the main execute API logic
    const results: ResultWithMeta[] = [];

    for (const query of queriesToExport) {
      if (!query) continue;

      try {
        // Create mock Request to call executeQuery directly (avoids HTTP fetch issues in server context)
        const mockRequest = new Request('http://localhost/api/reports/dashboard/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientCode, queryId: query.id }),
        });

        const executeRes = await executeQuery(mockRequest);
        const executeData = await executeRes.json();

        if (executeData.success && executeData.result) {
          results.push({
            result: executeData.result,
            description: query.description,
            tooltip: query.tooltip,
            sourceInfo: query.sourceInfo,
          });
          continue;
        }
      } catch (err) {
        console.warn(`Failed to execute query ${query.id}:`, err);
      }

      // Fallback: add query with no data
      results.push({
        result: {
          queryId: query.id,
          clientCode,
          title: query.title,
          status: query.status,
          queryType: query.queryType,
          data: { message: 'Data loading failed' },
          executedAt: new Date().toISOString(),
        },
        description: query.description,
        tooltip: query.tooltip,
        sourceInfo: query.sourceInfo,
      });
    }

    // Generate HTML
    const html = generatePdfHtml(client.name, client.code, results);

    // Return HTML for client-side PDF generation
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="${clientCode}_dashboard_report.html"`,
      },
    });
  } catch (error) {
    console.error('Failed to export PDF:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export PDF'
      },
      { status: 500 }
    );
  }
}
