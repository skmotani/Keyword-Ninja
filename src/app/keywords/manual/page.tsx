'use client';

import { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import ExportButton, { ExportColumn } from '@/components/ExportButton';
import { Client, ManualKeyword } from '@/types';

const manualKeywordsPageHelp = {
  title: 'Manual Keyword Entry',
  description: 'This interface allows you to manually input, track, and manage specific keywords for each client.',
  whyWeAddedThis: 'While AI and automated tools generate many keywords, human insight is often critical. This tool ensures you can track high-value, specific terms that automated tools might miss.',
  examples: ['"yarn twisting machine price"', '"textile machinery manufacturers in india"'],
  nuances: 'Keywords entered here are "Manual Entry" source by default but can be tagged differently. They are prioritized in some tracking workflows.',
  useCases: [
    'Add specific keywords requested by the client',
    'Track competitor brand names manually',
    'Input keywords found during manual SERP research'
  ]
};

const manualKeywordsPageDescription = `
  This page is your workbench for manual keyword management. It allows you to build a curated list of keywords 
  that are important for your client's SEO strategy but might not have been discovered by automated scans.

  You can add keywords one by one or bulk import them from a list. You can also tag them with a specific "Source" 
  to track where they came from (e.g., "Client Request", "Competitor Website").

  **Data Flow:** 
  User Input → Local Database (Manual Keywords Table). 
  
  These keywords serve as the input for:
  *   Search Volume fetching in [Keyword API Data](/keywords/api-data)
  *   Rank tracking in [SERP Results](/keywords/serp-results)
`;

export default function ManualKeywordsPage() {
  const [keywords, setKeywords] = useState<ManualKeyword[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Filter State
  const [filterClientCode, setFilterClientCode] = useState('');

  const [formData, setFormData] = useState({
    clientCode: '',
    keywordText: '',
    notes: '',
    source: 'Manual Entry',
    isNewSource: false,
    newSourceText: ''
  });

  const [editFormData, setEditFormData] = useState({
    clientCode: '',
    keywordText: '',
    notes: '',
    source: ''
  });

  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkClientCode, setBulkClientCode] = useState('');
  const [bulkKeywords, setBulkKeywords] = useState('');
  const [bulkSource, setBulkSource] = useState('Manual Entry');
  const [isNewBulkSource, setIsNewBulkSource] = useState(false);
  const [newBulkSourceText, setNewBulkSourceText] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [keywordsRes, clientsRes] = await Promise.all([
      fetch('/api/keywords'),
      fetch('/api/clients'),
    ]);
    const keywordsData = await keywordsRes.json();
    const clientsData = await clientsRes.json();
    setKeywords(keywordsData);
    setClients(clientsData.filter((c: Client) => c.isActive));
    setLoading(false);
  }

  // Derived unique sources
  const uniqueSources = useMemo(() => {
    const sources = new Set<string>();
    sources.add('Manual Entry');
    sources.add('SERP Related');
    sources.add('Competitor Analysis');
    sources.add('AI Research');

    keywords.forEach(k => {
      if (k.source) sources.add(k.source);
    });

    return Array.from(sources).sort();
  }, [keywords]);

  const filteredKeywords = useMemo(() => {
    if (!filterClientCode) return keywords;
    return keywords.filter(k => k.clientCode === filterClientCode);
  }, [keywords, filterClientCode]);

  function getClientName(clientCode: string) {
    const client = clients.find(c => c.code === clientCode);
    return client ? `${client.code} - ${client.name}` : clientCode;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const finalSource = formData.isNewSource ? formData.newSourceText : formData.source;

    await fetch('/api/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        source: finalSource
      }),
    });

    setFormData({
      clientCode: '',
      keywordText: '',
      notes: '',
      source: 'Manual Entry',
      isNewSource: false,
      newSourceText: ''
    });
    fetchData();
  }

  async function handleBulkImport(e: React.FormEvent) {
    e.preventDefault();

    const lines = bulkKeywords
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) return;

    const finalSource = isNewBulkSource ? newBulkSourceText : bulkSource;

    const keywords = lines.map(keywordText => ({
      clientCode: bulkClientCode,
      keywordText: keywordText,
      notes: '',
      source: finalSource
    }));

    await fetch('/api/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bulk: true, keywords }),
    });

    setBulkClientCode('');
    setBulkKeywords('');
    setBulkSource('Manual Entry');
    setIsNewBulkSource(false);
    setNewBulkSourceText('');
    setShowBulkImport(false);
    fetchData();
  }

  async function handleUpdate(id: string) {
    await fetch('/api/keywords', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...editFormData }),
    });

    setEditingId(null);
    fetchData();
  }

  async function toggleActive(keyword: ManualKeyword) {
    await fetch('/api/keywords', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: keyword.id, isActive: !keyword.isActive }),
    });

    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to permanently delete this keyword? This action cannot be undone.')) {
      return;
    }

    await fetch(`/api/keywords?id=${id}`, {
      method: 'DELETE',
    });

    fetchData();
  }

  function startEdit(keyword: ManualKeyword) {
    setEditingId(keyword.id);
    setEditFormData({
      clientCode: keyword.clientCode,
      keywordText: keyword.keywordText,
      notes: keyword.notes || '',
      source: keyword.source || 'Manual Entry'
    });
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div>
      <PageHeader
        title="Keyword Manual Master"
        description="Manage manually collected keywords from client interviews"
        helpInfo={manualKeywordsPageHelp}
        extendedDescription={manualKeywordsPageDescription}
      />

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600">{filteredKeywords.length}</div>
            <div className="text-xs text-gray-600">Total Keywords</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{filteredKeywords.filter(k => k.isActive).length}</div>
            <div className="text-xs text-gray-600">Active</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-500">{filteredKeywords.filter(k => !k.isActive).length}</div>
            <div className="text-xs text-gray-600">Archived</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Filter Client:</label>
            <select
              value={filterClientCode}
              onChange={(e) => setFilterClientCode(e.target.value)}
              className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]"
            >
              <option value="">All Clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.code}>
                  {client.code} - {client.name}
                </option>
              ))}
            </select>
          </div>

          <ExportButton
            data={filteredKeywords}
            columns={[
              { key: 'clientCode', header: 'Client Code' },
              { key: 'keywordText', header: 'Keyword' },
              { key: 'source', header: 'Source' },
              { key: 'isActive', header: 'Active' },
              { key: 'notes', header: 'Notes' },
            ] as ExportColumn<ManualKeyword>[]}
            filename={`manual-keywords-${new Date().toISOString().split('T')[0]}`}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Add New Keyword</h2>
          <button
            onClick={() => setShowBulkImport(!showBulkImport)}
            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
          >
            {showBulkImport ? 'Switch to Single Add' : 'Bulk Import Multiple'}
          </button>
        </div>

        {!showBulkImport ? (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
            <select
              value={formData.clientCode}
              onChange={(e) => setFormData({ ...formData, clientCode: e.target.value })}
              required
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select Client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.code}>
                  {client.code} - {client.name}
                </option>
              ))}
            </select>

            <div className="flex flex-col gap-1">
              {!formData.isNewSource ? (
                <select
                  value={formData.source}
                  onChange={(e) => {
                    if (e.target.value === 'NEW_SOURCE') {
                      setFormData(prev => ({ ...prev, isNewSource: true, source: '' }));
                    } else {
                      setFormData(prev => ({ ...prev, source: e.target.value }));
                    }
                  }}
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {uniqueSources.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  <option value="NEW_SOURCE">+ Add New Source</option>
                </select>
              ) : (
                <div className="flex gap-1">
                  <input
                    type="text"
                    required
                    placeholder="Enter new source..."
                    value={formData.newSourceText}
                    onChange={(e) => setFormData(prev => ({ ...prev, newSourceText: e.target.value }))}
                    className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, isNewSource: false, newSourceText: '', source: 'Manual Entry' }))}
                    className="px-2 text-gray-500 hover:text-gray-700 font-bold"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            <input
              type="text"
              placeholder="Keyword"
              value={formData.keywordText}
              onChange={(e) => setFormData({ ...formData, keywordText: e.target.value })}
              required
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              placeholder="Notes (optional)"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
            >
              Add Keyword
            </button>
          </form>
        ) : (
          <form onSubmit={handleBulkImport} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Client
                </label>
                <select
                  value={bulkClientCode}
                  onChange={(e) => setBulkClientCode(e.target.value)}
                  required
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.code}>
                      {client.code} - {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source
                </label>
                {!isNewBulkSource ? (
                  <select
                    value={bulkSource}
                    onChange={(e) => {
                      if (e.target.value === 'NEW_SOURCE') {
                        setIsNewBulkSource(true);
                      } else {
                        setBulkSource(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {uniqueSources.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                    <option value="NEW_SOURCE">+ Add New Source</option>
                  </select>
                ) : (
                  <div className="flex gap-1">
                    <input
                      type="text"
                      required
                      placeholder="Enter new source..."
                      value={newBulkSourceText}
                      onChange={(e) => setNewBulkSourceText(e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => { setIsNewBulkSource(false); setNewBulkSourceText(''); setBulkSource('Manual Entry'); }}
                      className="px-2 text-gray-500 hover:text-gray-700 font-bold"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Keywords (one per line)
                </label>
                <textarea
                  value={bulkKeywords}
                  onChange={(e) => setBulkKeywords(e.target.value)}
                  placeholder="keyword one&#10;keyword two&#10;keyword three"
                  required
                  rows={5}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition-colors"
            >
              Import All Keywords
            </button>
          </form>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="text-xl font-semibold text-gray-900">Keyword Manual Master</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">S.No</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider max-w-[180px]">Keyword</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active?</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredKeywords.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  {filterClientCode ? 'No keywords found for this client.' : 'No keywords yet. Add your first keyword above.'}
                </td>
              </tr>
            ) : (
              filteredKeywords.map((keyword, index) => (
                <tr key={keyword.id} className={!keyword.isActive ? 'bg-gray-50 opacity-60' : ''}>
                  {editingId === keyword.id ? (
                    <>
                      <td className="px-4 py-4 text-sm text-gray-500">{index + 1}</td>
                      <td className="px-6 py-4">
                        <select
                          value={editFormData.clientCode}
                          onChange={(e) => setEditFormData({ ...editFormData, clientCode: e.target.value })}
                          className="w-full px-2 py-1 border rounded"
                        >
                          {clients.map((client) => (
                            <option key={client.id} value={client.code}>
                              {client.code} - {client.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={editFormData.keywordText}
                          onChange={(e) => setEditFormData({ ...editFormData, keywordText: e.target.value })}
                          className="w-full px-2 py-1 border rounded"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={editFormData.source}
                          onChange={(e) => setEditFormData({ ...editFormData, source: e.target.value })}
                          className="w-full px-2 py-1 border rounded"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${keyword.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {keyword.isActive ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-4 space-x-2">
                        <button
                          onClick={() => handleUpdate(keyword.id)}
                          className="text-green-600 hover:text-green-800"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-gray-600 hover:text-gray-800"
                        >
                          Cancel
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={editFormData.notes}
                          onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                          className="w-full px-2 py-1 border rounded"
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{getClientName(keyword.clientCode)}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 max-w-[180px] truncate whitespace-nowrap overflow-hidden text-ellipsis" title={keyword.keywordText}>{keyword.keywordText}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{keyword.source}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${keyword.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {keyword.isActive ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        <button
                          onClick={() => startEdit(keyword)}
                          className="text-indigo-600 hover:text-indigo-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleActive(keyword)}
                          className={keyword.isActive ? 'text-orange-600 hover:text-orange-800' : 'text-green-600 hover:text-green-800'}
                        >
                          {keyword.isActive ? 'Archive' : 'Unarchive'}
                        </button>
                        <button
                          onClick={() => handleDelete(keyword.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{keyword.notes || '-'}</td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
