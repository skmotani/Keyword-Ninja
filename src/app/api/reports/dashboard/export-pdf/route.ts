import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getQueryById, getActiveQueries } from '@/lib/storage/dashboardQueryStore';
import {
    DashboardQueryResult,
    KeywordBalloonData,
    DomainInfo
} from '@/types/dashboardTypes';
import { Client, KeywordApiDataRecord } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');

// Location code mappings
const LOCATION_CODES = {
    india: 2356,
    global: 2840,
};

// Helper functions (duplicated from execute/route.ts for isolation)
async function readClients(): Promise<Client[]> {
    try {
        const filePath = path.join(DATA_DIR, 'clients.json');
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as Client[];
    } catch {
        return [];
    }
}

async function readKeywordApiData(): Promise<KeywordApiDataRecord[]> {
    try {
        const filePath = path.join(DATA_DIR, 'keyword_api_data.json');
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as KeywordApiDataRecord[];
    } catch {
        return [];
    }
}

async function executeDomainInfoQuery(clientCode: string): Promise<DomainInfo> {
    const clients = await readClients();
    const client = clients.find(c => c.code === clientCode);

    if (!client) {
        throw new Error(`Client not found: ${clientCode}`);
    }

    return {
        clientName: client.name,
        clientCode: client.code,
        mainDomain: client.mainDomain,
        allDomains: client.domains || [client.mainDomain],
        status: 'Critical',
    };
}

async function executeKeywordVolumeQuery(
    clientCode: string,
    config: { location?: string; limit?: number }
): Promise<KeywordBalloonData[]> {
    const allKeywords = await readKeywordApiData();
    const limit = config.limit || 10;

    let clientKeywords = allKeywords.filter(k => k.clientCode === clientCode);

    if (config.location === 'india') {
        clientKeywords = clientKeywords.filter(k => k.locationCode === LOCATION_CODES.india);
    } else if (config.location === 'global') {
        clientKeywords = clientKeywords.filter(k => k.locationCode === LOCATION_CODES.global);
    }

    clientKeywords.sort((a, b) => (b.searchVolume || 0) - (a.searchVolume || 0));
    const topKeywords = clientKeywords.slice(0, limit);

    return topKeywords.map(k => ({
        keyword: k.keywordText,
        volume: k.searchVolume || 0,
        position: null,
        location: k.locationCode === LOCATION_CODES.india ? 'india' : 'global',
    }));
}

// Generate HTML content for PDF
function generatePdfHtml(
    clientName: string,
    clientCode: string,
    results: DashboardQueryResult[]
): string {
    const now = new Date().toLocaleString();

    let querySections = '';

    for (const result of results) {
        let dataHtml = '';

        if (result.queryType === 'domain-info') {
            const domainInfo = result.data as DomainInfo;
            dataHtml = `
        <div class="domain-info">
          <p><strong>Client Name:</strong> ${domainInfo.clientName}</p>
          <p><strong>Client Code:</strong> ${domainInfo.clientCode}</p>
          <p><strong>Main Domain:</strong> ${domainInfo.mainDomain}</p>
          <p><strong>All Domains:</strong> ${domainInfo.allDomains.join(', ')}</p>
          <p><strong>Status:</strong> <span class="status-${domainInfo.status.toLowerCase()}">${domainInfo.status}</span></p>
        </div>
      `;
        } else if (result.queryType === 'keyword-volume') {
            const keywords = result.data as KeywordBalloonData[];
            dataHtml = `
        <table class="keyword-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Keyword</th>
              <th>Volume</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            ${keywords.map((k, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${k.keyword}</td>
                <td>${k.volume.toLocaleString()}</td>
                <td>${k.location === 'india' ? '🇮🇳 India' : '🌐 Global'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
        }

        querySections += `
      <div class="query-section">
        <div class="query-header">
          <h2>${result.queryId} - ${result.title}</h2>
          <span class="status-badge status-${result.status.toLowerCase()}">${result.status}</span>
        </div>
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
        .query-content { padding: 20px; }
        .domain-info p { margin-bottom: 8px; }
        .keyword-table {
          width: 100%;
          border-collapse: collapse;
        }
        .keyword-table th, .keyword-table td {
          padding: 10px 12px;
          text-align: left;
          border-bottom: 1px solid #e5e7eb;
        }
        .keyword-table th {
          background: #f8f9fa;
          font-weight: 600;
          color: #374151;
        }
        .keyword-table tr:hover { background: #f9fafb; }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #9ca3af;
          font-size: 12px;
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

        // Get queries to execute
        let queriesToExecute;
        if (queryIds && queryIds.length > 0) {
            const promises = queryIds.map((id: string) => getQueryById(id));
            const results = await Promise.all(promises);
            queriesToExecute = results.filter(q => q !== null);
        } else {
            queriesToExecute = await getActiveQueries();
        }

        // Execute each query
        const results: DashboardQueryResult[] = [];
        for (const query of queriesToExecute) {
            if (!query) continue;

            let data;
            switch (query.queryType) {
                case 'domain-info':
                    data = await executeDomainInfoQuery(clientCode);
                    break;
                case 'keyword-volume':
                    data = await executeKeywordVolumeQuery(clientCode, query.config);
                    break;
                default:
                    data = { message: 'Custom query' };
            }

            results.push({
                queryId: query.id,
                clientCode,
                title: query.title,
                status: query.status,
                queryType: query.queryType,
                data,
                executedAt: new Date().toISOString(),
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
