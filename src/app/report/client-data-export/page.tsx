'use client';

import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';

interface Client {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
}

interface ExportPage {
    id: string;
    pageKey: string;
    pageName: string;
    route: string;
    module: string;
    clientFilterField: string;
    dataSourceType: string;
    dataSourceRef: string;
    description: string;
    rowDescription: string;
    status: string;
    lastDiscoveredAt: string;
}

interface ExportColumn {
    id: string;
    pageKey: string;
    columnName: string;
    displayName: string;
    dataType: string;
}

const pageHelp = {
    title: 'Page Client Data Export',
    description: 'Export all client-filtered data across multiple pages into a single Excel file with one worksheet per page.',
    whyWeAddedThis: 'Consolidate all client data into a single comprehensive export instead of downloading from each page individually.',
    examples: [
        'Export all Domain Keywords, Competitors, and SERP data for a client in one file',
        'Create a complete client report with metadata and metric definitions',
    ],
    useCases: [
        'Client reporting and data handoff',
        'Backup client data across all pages',
        'Comprehensive data analysis in Excel',
    ],
};

const pageDescription = `
  This page allows you to export data from **all client-filtered pages** into a single Excel workbook.
  
  **Features:**
  - One worksheet per selected page
  - Client Master sheet always included
  - Metadata rows with export timestamp
  - Footnotes with DataForSEO metric definitions
  
  **Instructions:**
  1. Select a client
  2. Click "Refresh" to discover available pages
  3. Select the pages you want to export
  4. Click "Export" to download the Excel file
`;

export default function ClientDataExportPage() {
    // State
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientCode, setSelectedClientCode] = useState<string>('');
    const [pages, setPages] = useState<ExportPage[]>([]);
    const [columns, setColumns] = useState<Record<string, ExportColumn[]>>({});
    const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Fetch clients on mount
    useEffect(() => {
        fetchClients();
    }, []);

    // Fetch pages when client changes
    useEffect(() => {
        if (selectedClientCode) {
            fetchPages();
        }
    }, [selectedClientCode]);

    async function fetchClients() {
        try {
            const res = await fetch('/api/clients');
            const data = await res.json();
            const activeClients = data.filter((c: Client) => c.isActive);
            setClients(activeClients);
            if (activeClients.length > 0 && !selectedClientCode) {
                setSelectedClientCode(activeClients[0].code);
            }
        } catch (error) {
            console.error('Failed to fetch clients:', error);
            showNotification('error', 'Failed to load clients');
        }
    }

    async function fetchPages() {
        setLoading(true);
        try {
            const res = await fetch('/api/reports/client-data-export');
            const data = await res.json();
            if (data.success) {
                setPages(data.pages);
                setColumns(data.columns);
                // Pre-select all pages
                setSelectedPages(new Set(data.pages.map((p: ExportPage) => p.pageKey)));
            } else {
                showNotification('error', 'Failed to load export pages');
            }
        } catch (error) {
            console.error('Failed to fetch pages:', error);
            showNotification('error', 'Failed to load export pages');
        } finally {
            setLoading(false);
        }
    }

    async function handleRefresh() {
        setRefreshing(true);
        setNotification(null);
        try {
            const res = await fetch('/api/reports/client-data-export/refresh', {
                method: 'POST',
            });
            const data = await res.json();
            if (data.success) {
                showNotification('success', data.message);
                await fetchPages();
            } else {
                showNotification('error', data.error || 'Refresh failed');
            }
        } catch (error) {
            console.error('Failed to refresh:', error);
            showNotification('error', 'Failed to refresh registry');
        } finally {
            setRefreshing(false);
        }
    }

    async function handleExport() {
        if (!selectedClientCode || selectedPages.size === 0) {
            showNotification('error', 'Please select a client and at least one page');
            return;
        }

        setExporting(true);
        setNotification(null);
        try {
            const res = await fetch('/api/reports/client-data-export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientCode: selectedClientCode,
                    selectedPageKeys: Array.from(selectedPages),
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Export failed');
            }

            // Download the file
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            // Extract filename from Content-Disposition header if available
            const disposition = res.headers.get('Content-Disposition');
            let filename = `${selectedClientCode}_export.xlsx`;
            if (disposition) {
                const match = disposition.match(/filename="?([^"]+)"?/);
                if (match) filename = match[1];
            }

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            showNotification('success', 'Export downloaded successfully!');
        } catch (error) {
            console.error('Export failed:', error);
            showNotification('error', error instanceof Error ? error.message : 'Export failed');
        } finally {
            setExporting(false);
        }
    }

    function showNotification(type: 'success' | 'error', message: string) {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 5000);
    }

    function togglePage(pageKey: string) {
        setSelectedPages(prev => {
            const next = new Set(prev);
            if (next.has(pageKey)) {
                next.delete(pageKey);
            } else {
                next.add(pageKey);
            }
            return next;
        });
    }

    function selectAllPages() {
        setSelectedPages(new Set(pages.map(p => p.pageKey)));
    }

    function deselectAllPages() {
        setSelectedPages(new Set());
    }

    // Group pages by module
    const pagesByModule = useMemo(() => {
        const groups: Record<string, ExportPage[]> = {};
        for (const page of pages) {
            if (!groups[page.module]) {
                groups[page.module] = [];
            }
            groups[page.module].push(page);
        }
        return groups;
    }, [pages]);

    const selectedClient = clients.find(c => c.code === selectedClientCode);

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <PageHeader
                title="Page Client Data Export"
                description="Export client data from multiple pages into a single Excel file."
                helpInfo={pageHelp}
                extendedDescription={pageDescription}
            />

            {/* Notification */}
            {notification && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${notification.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                    {notification.message}
                </div>
            )}

            {/* Controls */}
            <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
                <div className="flex flex-wrap items-end gap-4">
                    {/* Client Selector */}
                    <div className="w-64">
                        <label className="block text-xs font-bold text-gray-500 mb-1">
                            Client <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={selectedClientCode}
                            onChange={e => setSelectedClientCode(e.target.value)}
                            className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="">Select Client...</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.code}>{c.name} ({c.code})</option>
                            ))}
                        </select>
                    </div>

                    {/* Refresh Button */}
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="px-4 py-2 bg-gray-100 text-gray-700 border rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {refreshing ? (
                            <>
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Refreshing...
                            </>
                        ) : (
                            <>
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Refresh Registry
                            </>
                        )}
                    </button>

                    {/* Export Button */}
                    <button
                        onClick={handleExport}
                        disabled={exporting || !selectedClientCode || selectedPages.size === 0}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                    >
                        {exporting ? (
                            <>
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Generating...
                            </>
                        ) : (
                            <>
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Export Selected ({selectedPages.size})
                            </>
                        )}
                    </button>

                    {/* Selection Controls */}
                    <div className="flex gap-2 ml-auto">
                        <button
                            onClick={selectAllPages}
                            className="px-3 py-1.5 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded"
                        >
                            Select All
                        </button>
                        <button
                            onClick={deselectAllPages}
                            className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded"
                        >
                            Deselect All
                        </button>
                    </div>
                </div>

                {/* Summary */}
                {selectedClient && (
                    <div className="mt-4 pt-4 border-t text-sm text-gray-600">
                        <span className="font-medium">Selected Client:</span> {selectedClient.name}
                        <span className="mx-2">|</span>
                        <span className="font-medium">Pages to Export:</span> {selectedPages.size} of {pages.length}
                    </div>
                )}
            </div>

            {/* Pages Table */}
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <div className="px-4 py-3 border-b bg-gray-50">
                    <h3 className="font-semibold text-gray-800">Exportable Pages</h3>
                    <p className="text-xs text-gray-500 mt-1">
                        Select pages to include in your export. Client Master is always included.
                    </p>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-gray-500">
                        <svg className="animate-spin h-8 w-8 mx-auto mb-2" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Loading pages...
                    </div>
                ) : pages.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <p>No exportable pages found.</p>
                        <p className="text-sm mt-2">Click "Refresh Registry" to discover available pages.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600 border-b">
                                <tr>
                                    <th className="w-12 px-4 py-3 text-left">
                                        <input
                                            type="checkbox"
                                            checked={selectedPages.size === pages.length}
                                            onChange={e => e.target.checked ? selectAllPages() : deselectAllPages()}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">Page Name</th>
                                    <th className="px-4 py-3 text-left font-medium">Route</th>
                                    <th className="px-4 py-3 text-left font-medium">Module</th>
                                    <th className="px-4 py-3 text-left font-medium">Columns</th>
                                    <th className="px-4 py-3 text-left font-medium">Data Source</th>
                                    <th className="px-4 py-3 text-left font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {pages.map(page => {
                                    const pageCols = columns[page.pageKey] || [];
                                    const colNames = pageCols.map(c => c.displayName);
                                    const displayCols = colNames.slice(0, 3).join(', ');
                                    const extraCount = colNames.length - 3;

                                    return (
                                        <tr
                                            key={page.id}
                                            className={`hover:bg-gray-50 cursor-pointer ${selectedPages.has(page.pageKey) ? 'bg-indigo-50' : ''}`}
                                            onClick={() => togglePage(page.pageKey)}
                                        >
                                            <td className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPages.has(page.pageKey)}
                                                    onChange={() => togglePage(page.pageKey)}
                                                    onClick={e => e.stopPropagation()}
                                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-900">{page.pageName}</div>
                                                <div className="text-xs text-gray-500 mt-0.5">{page.description.substring(0, 60)}...</div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 font-mono text-xs">{page.route}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${page.module === 'Master' ? 'bg-purple-100 text-purple-700' :
                                                    page.module === 'Keywords' ? 'bg-blue-100 text-blue-700' :
                                                        page.module === 'Curated' ? 'bg-green-100 text-green-700' :
                                                            'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {page.module}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                <div className="group relative">
                                                    <span
                                                        className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded cursor-help font-medium"
                                                        title={colNames.join('\n')}
                                                    >
                                                        {colNames.length} columns
                                                    </span>
                                                    {/* Tooltip with full column list */}
                                                    <div className="absolute z-50 left-0 top-full mt-1 hidden group-hover:block bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-64 max-w-96 max-h-64 overflow-y-auto">
                                                        <div className="text-xs font-semibold text-gray-700 mb-2 border-b pb-1">
                                                            Columns to Export ({colNames.length}):
                                                        </div>
                                                        <div className="text-xs text-gray-600 space-y-0.5">
                                                            {colNames.map((name, idx) => (
                                                                <div key={idx} className="py-0.5 border-b border-gray-50 last:border-0">
                                                                    {idx + 1}. {name}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 text-xs font-mono">{page.dataSourceRef}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${page.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                    {page.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Info Footer */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">About the Export</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                    <li>• <strong>Client Master</strong> sheet is always included as the first worksheet</li>
                    <li>• Each selected page becomes a separate worksheet</li>
                    <li>• Rows 1-3 contain metadata (Client Code, Export Date, Source Page)</li>
                    <li>• Footnotes at the bottom include DataForSEO metric definitions</li>
                    <li>• Large datasets are automatically split into multiple sheets</li>
                </ul>
            </div>
        </div>
    );
}
