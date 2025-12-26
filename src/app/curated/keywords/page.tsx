'use client';

import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import ExportButton, { ExportColumn } from '@/components/ExportButton';
import { Client, CuratedKeyword } from '@/types';
import PageComments from '@/components/PageComments';

// Simplified CSV Parser since no library allowed in "dependencies" but I can use simple split
const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

    // Simple parser handling quotes roughly if needed, or simple split for MVP
    // Assuming simple CSV: client_code,keyword,source,notes

    return lines.slice(1).map(line => {
        const values = line.split(',');
        const row: any = {};
        headers.forEach((h, i) => {
            row[h] = values[i]?.trim();
        });
        return row;
    });
};

export default function CuratedKeywordsPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [records, setRecords] = useState<CuratedKeyword[]>([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [selectedClientCode, setSelectedClientCode] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [sourceFilter, setSourceFilter] = useState('');

    // Modals
    const [showImportModal, setShowImportModal] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);

    // Import State
    const [importData, setImportData] = useState<any[]>([]);
    const [importPreview, setImportPreview] = useState<any[]>([]);
    const [importFile, setImportFile] = useState<File | null>(null);

    // New Item State
    const [newItem, setNewItem] = useState({ keyword: '', source: 'Manual', notes: '' });

    useEffect(() => {
        fetchClients();
    }, []);

    useEffect(() => {
        if (selectedClientCode) {
            fetchRecords();
        } else {
            setRecords([]);
        }
    }, [selectedClientCode]);

    async function fetchClients() {
        try {
            const res = await fetch('/api/clients');
            const data = await res.json();
            setClients(data);
            // Optional: Auto-select first active client?
            const active = data.find((c: Client) => c.isActive);
            if (active) setSelectedClientCode(active.code);
        } catch (e) {
            console.error('Failed to fetch clients', e);
        }
    }

    async function fetchRecords() {
        setLoading(true);
        try {
            const res = await fetch(`/api/curated/keywords?clientCode=${selectedClientCode}`);
            const json = await res.json();
            if (json.success) {
                setRecords(json.data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    // handlers
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            const matchesSearch = r.keyword.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesSource = sourceFilter ? r.source === sourceFilter : true;
            return matchesSearch && matchesSource;
        });
    }, [records, searchTerm, sourceFilter]);

    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportFile(file);

        const text = await file.text();
        const raw = parseCSV(text);

        // Validation Preview
        const processed = raw.map(r => ({
            ...r,
            isValid: r.client_code && r.keyword, // Check basic required fields (using snake_case or camel? Prompt says bulk import cols: client_code, keyword...)
            // Parser headers need to handle snake_case mapping to camelCase if needed.
            // Let's assume user provides CSV headers "client_code, keyword, source, notes"
        }));
        setImportPreview(processed);
    };

    const confirmImport = async () => {
        // Map to API payload
        const payload = importPreview
            .filter(r => r.isValid || (r.keyword && (r.client_code || selectedClientCode))) // If client_code missing in row, maybe use selected? Rule says "client_code must exist".
            // Let's stick to strict CSV columns as per prompt "Required: client_code"
            .map(r => ({
                clientCode: r.client_code || r.clientCode,
                keyword: r.keyword,
                source: r.source,
                notes: r.notes
            }));

        const res = await fetch('/api/curated/keywords/import', {
            method: 'POST',
            body: JSON.stringify({ records: payload })
        });
        const json = await res.json();
        if (json.success) {
            alert(`Imported ${json.imported} records. Failed: ${json.failed}`);
            setShowImportModal(false);
            fetchRecords();
            setImportFile(null);
            setImportPreview([]);
        } else {
            alert('Import failed: ' + json.error);
        }
    };

    const saveNewItem = async () => {
        if (!newItem.keyword || !selectedClientCode) return;
        const res = await fetch('/api/curated/keywords/import', { // Reusing bulk import for single add is easier if consistent
            method: 'POST',
            body: JSON.stringify({
                records: [{
                    clientCode: selectedClientCode,
                    keyword: newItem.keyword,
                    source: newItem.source,
                    notes: newItem.notes
                }]
            })
        });
        if (res.ok) {
            setShowAddModal(false);
            setNewItem({ keyword: '', source: 'Manual', notes: '' });
            fetchRecords();
        }
    };

    // Derived Summary
    const uniqueSources = Array.from(new Set(records.map(r => r.source)));

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <PageHeader
                title="Curated Keywords"
                description="Manually curated, high-priority keywords aligned to a client."
            />

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-lg shadow-sm border mb-6 flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Client (Required)</label>
                    <select
                        value={selectedClientCode}
                        onChange={e => setSelectedClientCode(e.target.value)}
                        className="border rounded px-3 py-2 text-sm w-64"
                    >
                        <option value="">Select Client...</option>
                        {clients.map(c => (
                            <option key={c.id} value={c.code}>{c.name} ({c.code})</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Source</label>
                    <select
                        value={sourceFilter}
                        onChange={e => setSourceFilter(e.target.value)}
                        className="border rounded px-3 py-2 text-sm w-48"
                    >
                        <option value="">All Sources</option>
                        {uniqueSources.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Search</label>
                    <input
                        type="text"
                        placeholder="Search keywords..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="border rounded px-3 py-2 text-sm w-full"
                    />
                </div>
            </div>

            {/* Summary & Actions */}
            <div className="flex justify-between items-center mb-4">
                <div className="text-sm text-gray-600">
                    Showing <strong>{filteredRecords.length}</strong> records
                    {selectedClientCode && <span> for Client <strong>{selectedClientCode}</strong></span>}
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="px-4 py-2 bg-white border rounded text-sm hover:bg-gray-50"
                    >
                        Import CSV
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
                    >
                        + Add New
                    </button>
                    <ExportButton
                        data={filteredRecords}
                        columns={[
                            { key: 'clientCode', header: 'Client' },
                            { key: 'keyword', header: 'Keyword' },
                            { key: 'source', header: 'Source' },
                            { key: 'notes', header: 'Notes' }
                        ]}
                        filename="curated_keywords"
                    />
                </div>
            </div>

            {/* Grid */}
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden min-h-[400px]">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium border-b">
                        <tr>
                            <th className="px-4 py-3 w-16">#</th>
                            <th className="px-4 py-3">Keyword</th>
                            <th className="px-4 py-3">Source</th>
                            <th className="px-4 py-3">Notes</th>
                            <th className="px-4 py-3 w-32">Updated</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
                        ) : filteredRecords.length === 0 ? (
                            <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No records found. Select a client or add data.</td></tr>
                        ) : (
                            filteredRecords.map((r, i) => (
                                <tr key={r.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                                    <td className="px-4 py-2 font-medium text-gray-900">{r.keyword}</td>
                                    <td className="px-4 py-2 text-gray-600">
                                        <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">{r.source}</span>
                                    </td>
                                    <td className="px-4 py-2 text-gray-500">{r.notes || '-'}</td>
                                    <td className="px-4 py-2 text-gray-400 text-xs">{new Date(r.updatedAt).toLocaleDateString()}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Shared Page Comments */}
            <div className="mt-8">
                <PageComments pagePath="/curated/keywords" />
            </div>

            {/* Info Section */}
            <div className="mt-8 bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
                <h3 className="font-semibold mb-2">About Curated Keywords</h3>
                <p>This module allows manual tracking of high-priority keywords that may not be automatically discovered. Use the Import CSV feature to bulk upload valid records (Headers: <code>client_code, keyword, source, notes</code>)</p>
            </div>

            {/* Modals */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg w-[600px] max-h-[80vh] overflow-y-auto">
                        <h3 className="text-lg font-bold mb-4">Bulk Import</h3>
                        <p className="mb-4 text-sm text-gray-600">Upload a CSV with columns: <code>client_code, keyword, source, notes</code></p>

                        <input type="file" accept=".csv" onChange={handleImportFile} className="mb-4 block w-full text-sm text-slate-500
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-full file:border-0
                            file:text-sm file:font-semibold
                            file:bg-indigo-50 file:text-indigo-700
                            hover:file:bg-indigo-100
                        "/>

                        {importPreview.length > 0 && (
                            <div className="mb-4 text-sm">
                                <p>Previewing {importPreview.length} rows:</p>
                                <div className="max-h-48 overflow-y-auto border mt-2">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-gray-100 text-left">
                                                <th className="p-1">Code</th>
                                                <th className="p-1">Keyword</th>
                                                <th className="p-1">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {importPreview.slice(0, 50).map((r, i) => (
                                                <tr key={i} className={r.isValid ? '' : 'bg-red-50'}>
                                                    <td className="p-1">{r.client_code || r.clientCode}</td>
                                                    <td className="p-1">{r.keyword}</td>
                                                    <td className="p-1">{r.isValid ? 'Valid' : 'Invalid'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowImportModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                            <button
                                onClick={confirmImport}
                                disabled={!importFile || importPreview.length === 0}
                                className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
                            >
                                Confirm Import
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg w-[400px]">
                        <h3 className="text-lg font-bold mb-4">Add New Keyword</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold mb-1">Client</label>
                                <input type="text" value={selectedClientCode} disabled className="w-full border px-3 py-2 bg-gray-100 rounded" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1">Keyword *</label>
                                <input
                                    type="text"
                                    value={newItem.keyword}
                                    onChange={e => setNewItem({ ...newItem, keyword: e.target.value })}
                                    className="w-full border px-3 py-2 rounded focus:ring-2 ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1">Source</label>
                                <input
                                    type="text"
                                    value={newItem.source}
                                    onChange={e => setNewItem({ ...newItem, source: e.target.value })}
                                    className="w-full border px-3 py-2 rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1">Notes</label>
                                <textarea
                                    value={newItem.notes}
                                    onChange={e => setNewItem({ ...newItem, notes: e.target.value })}
                                    className="w-full border px-3 py-2 rounded"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                            <button onClick={saveNewItem} className="px-4 py-2 bg-indigo-600 text-white rounded">Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
