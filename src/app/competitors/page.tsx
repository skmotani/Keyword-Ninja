'use client';

import { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import ExportButton, { ExportColumn } from '@/components/ExportButton';
import { Client, Competitor, CompetitorSource } from '@/types';

function getRelevanceBadgeColor(category: string): string {
  switch (category) {
    case 'Self': return 'bg-indigo-100 text-indigo-800 ring-2 ring-indigo-300';
    case 'Direct Competitor': return 'bg-red-100 text-red-800';
    case 'Adjacent / Weak Competitor': return 'bg-orange-100 text-orange-800';
    case 'Potential Customer / Lead': return 'bg-green-100 text-green-800';
    case 'Marketplace / Channel': return 'bg-blue-100 text-blue-800';
    case 'Service Provider / Partner': return 'bg-purple-100 text-purple-800';
    case 'Educational / Content Only': return 'bg-cyan-100 text-cyan-800';
    case 'Brand / Navigational Only': return 'bg-gray-100 text-gray-800';
    case 'Irrelevant': return 'bg-gray-200 text-gray-500';
    case 'Needs Manual Review': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function getMatchBucketColor(bucket: string): string {
  switch (bucket) {
    case 'High': return 'text-green-700 font-semibold';
    case 'Medium': return 'text-yellow-700';
    case 'Low': return 'text-orange-600';
    case 'None': return 'text-gray-400';
    default: return 'text-gray-500';
  }
}

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [recentlyAddedDomains, setRecentlyAddedDomains] = useState<Set<string>>(new Set());
  const [clientFilter, setClientFilter] = useState<string>('');
  const [explanationModal, setExplanationModal] = useState<Competitor | null>(null);
  
  const [formData, setFormData] = useState({
    clientCode: '',
    name: '',
    domain: '',
    notes: '',
  });

  const [editFormData, setEditFormData] = useState({
    clientCode: '',
    name: '',
    domain: '',
    notes: '',
    source: 'Manual Entry' as CompetitorSource,
  });

  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkClientCode, setBulkClientCode] = useState('');
  const [bulkDomains, setBulkDomains] = useState('');

  useEffect(() => {
    fetchData();
    
    const storedNotification = localStorage.getItem('competitorMasterNotification');
    if (storedNotification) {
      try {
        const data = JSON.parse(storedNotification);
        setNotification({ type: 'success', message: data.message });
        if (data.domains && Array.isArray(data.domains)) {
          setRecentlyAddedDomains(new Set(data.domains.map((d: string) => d.toLowerCase().trim())));
          setTimeout(() => setRecentlyAddedDomains(new Set()), 10000);
        }
        localStorage.removeItem('competitorMasterNotification');
        setTimeout(() => setNotification(null), 6000);
      } catch (e) {
        localStorage.removeItem('competitorMasterNotification');
      }
    }
  }, []);

  async function fetchData() {
    const [competitorsRes, clientsRes] = await Promise.all([
      fetch('/api/competitors'),
      fetch('/api/clients'),
    ]);
    const competitorsData = await competitorsRes.json();
    const clientsData = await clientsRes.json();
    setCompetitors(competitorsData);
    setClients(clientsData.filter((c: Client) => c.isActive));
    setLoading(false);
  }

  function getClientName(clientCode: string) {
    const client = clients.find(c => c.code === clientCode);
    return client ? `${client.code} - ${client.name}` : clientCode;
  }

  const filteredCompetitors = useMemo(() => {
    if (!clientFilter) return competitors;
    return competitors.filter(c => c.clientCode === clientFilter);
  }, [competitors, clientFilter]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    await fetch('/api/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    
    setFormData({ clientCode: '', name: '', domain: '', notes: '' });
    fetchData();
  }

  async function handleBulkImport(e: React.FormEvent) {
    e.preventDefault();
    
    const lines = bulkDomains
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    if (lines.length === 0) return;
    
    const competitors = lines.map(domain => {
      let cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '');
      cleanDomain = cleanDomain.split('/')[0];
      const name = cleanDomain.split('.')[0];
      const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
      
      return {
        clientCode: bulkClientCode,
        name: capitalizedName,
        domain: cleanDomain,
        notes: '',
      };
    });
    
    await fetch('/api/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bulk: true, competitors }),
    });
    
    setBulkClientCode('');
    setBulkDomains('');
    setShowBulkImport(false);
    fetchData();
  }

  async function handleUpdate(id: string) {
    const wasSourceChanged = competitors.find(c => c.id === id)?.source !== editFormData.source;
    
    await fetch('/api/competitors', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...editFormData }),
    });
    
    setEditingId(null);
    fetchData();
    
    if (wasSourceChanged) {
      setNotification({ type: 'info', message: `Source updated to "${editFormData.source}"` });
      setTimeout(() => setNotification(null), 3000);
    }
  }

  async function toggleActive(competitor: Competitor) {
    await fetch('/api/competitors', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: competitor.id, isActive: !competitor.isActive }),
    });
    
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to permanently delete this competitor? This action cannot be undone.')) {
      return;
    }
    
    await fetch(`/api/competitors?id=${id}`, {
      method: 'DELETE',
    });
    
    fetchData();
  }

  function startEdit(competitor: Competitor) {
    setEditingId(competitor.id);
    setEditFormData({
      clientCode: competitor.clientCode,
      name: competitor.name,
      domain: competitor.domain,
      notes: competitor.notes || '',
      source: competitor.source || 'Manual Entry',
    });
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div>
      <PageHeader 
        title="Competitor Master" 
        description="Track competitors for each client"
      />

      {notification && (
        <div className={`mb-4 p-3 rounded-lg text-sm flex items-center justify-between ${
          notification.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : notification.type === 'info'
            ? 'bg-blue-50 text-blue-800 border border-blue-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <span>{notification.message}</span>
          <button 
            onClick={() => setNotification(null)}
            className="text-gray-500 hover:text-gray-700 ml-2"
          >
            &#10005;
          </button>
        </div>
      )}

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600">{filteredCompetitors.length}</div>
            <div className="text-xs text-gray-600">Total Competitors</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{filteredCompetitors.filter(c => c.isActive).length}</div>
            <div className="text-xs text-gray-600">Active</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-500">{filteredCompetitors.filter(c => !c.isActive).length}</div>
            <div className="text-xs text-gray-600">Archived</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Filter by Client:</label>
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.code}>
                {client.code} - {client.name}
              </option>
            ))}
          </select>
          {clientFilter && (
            <button
              onClick={() => setClientFilter('')}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              Clear
            </button>
          )}
          <ExportButton
            data={filteredCompetitors}
            columns={[
              { key: 'clientCode', header: 'Client Code' },
              { key: 'name', header: 'Name' },
              { key: 'domain', header: 'Domain' },
              { key: 'importanceScore', header: 'Importance Score' },
              { key: 'domainType', header: 'Domain Type' },
              { key: 'pageIntent', header: 'Page Intent' },
              { key: 'productMatchScore', header: 'Product Match Score' },
              { key: 'businessRelevanceCategory', header: 'Business Relevance' },
              { key: 'source', header: 'Source' },
              { key: 'isActive', header: 'Active' },
            ] as ExportColumn<Competitor>[]}
            filename={`competitors-${clientFilter || 'all'}-${new Date().toISOString().split('T')[0]}`}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Add New Competitor</h2>
          <button
            onClick={() => setShowBulkImport(!showBulkImport)}
            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
          >
            {showBulkImport ? 'Switch to Single Add' : 'Bulk Import Multiple'}
          </button>
        </div>

        {!showBulkImport ? (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
            <input
              type="text"
              placeholder="Competitor Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              placeholder="Domain"
              value={formData.domain}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
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
              Add Competitor
            </button>
          </form>
        ) : (
          <form onSubmit={handleBulkImport} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  Domain Names (one per line)
                </label>
                <textarea
                  value={bulkDomains}
                  onChange={(e) => setBulkDomains(e.target.value)}
                  placeholder="example.com&#10;competitor.com&#10;another-site.com"
                  required
                  rows={5}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Paste domains with or without http(s)://. Names will be auto-generated from domains.
                </p>
              </div>
            </div>
            <button
              type="submit"
              className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition-colors"
            >
              Import All Competitors
            </button>
          </form>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">S.No</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain</th>
              <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
              <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain Type</th>
              <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Page Intent</th>
              <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Match</th>
              <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business Relevance</th>
              <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
              <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active?</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredCompetitors.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-6 py-4 text-center text-gray-500">
                  {clientFilter ? 'No competitors found for this client.' : 'No competitors yet. Add your first competitor above.'}
                </td>
              </tr>
            ) : (
              filteredCompetitors.map((competitor, index) => {
                const isRecentlyAdded = recentlyAddedDomains.has(competitor.domain.toLowerCase().trim());
                const domainUrl = competitor.domain.startsWith('http') ? competitor.domain : `https://${competitor.domain}`;
                return (
                <tr key={competitor.id} className={`${!competitor.isActive ? 'bg-gray-50 opacity-60' : ''} ${isRecentlyAdded ? 'bg-green-50 ring-2 ring-green-200 ring-inset' : ''}`}>
                  {editingId === competitor.id ? (
                    <>
                      <td className="px-3 py-3 text-sm text-gray-500">{index + 1}</td>
                      <td className="px-3 py-3">
                        <select
                          value={editFormData.clientCode}
                          onChange={(e) => setEditFormData({ ...editFormData, clientCode: e.target.value })}
                          className="w-full px-2 py-1 border rounded text-sm"
                        >
                          {clients.map((client) => (
                            <option key={client.id} value={client.code}>
                              {client.code} - {client.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          value={editFormData.name}
                          onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          value={editFormData.domain}
                          onChange={(e) => setEditFormData({ ...editFormData, domain: e.target.value })}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </td>
                      <td className="px-2 py-3 text-xs text-gray-400">-</td>
                      <td className="px-2 py-3 text-xs text-gray-400">-</td>
                      <td className="px-2 py-3 text-xs text-gray-400">-</td>
                      <td className="px-2 py-3 text-xs text-gray-400">-</td>
                      <td className="px-2 py-3 text-xs text-gray-400">-</td>
                      <td className="px-2 py-3">
                        <select
                          value={editFormData.source}
                          onChange={(e) => setEditFormData({ ...editFormData, source: e.target.value as CompetitorSource })}
                          className="px-2 py-1 border rounded text-xs"
                        >
                          <option value="Manual Entry">Manual Entry</option>
                          <option value="Via SERP Search">Via SERP Search</option>
                        </select>
                      </td>
                      <td className="px-2 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${competitor.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {competitor.isActive ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-3 py-3 space-x-2">
                        <button
                          onClick={() => handleUpdate(competitor.id)}
                          className="text-green-600 hover:text-green-800 text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-gray-600 hover:text-gray-800 text-sm"
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">{getClientName(competitor.clientCode)}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{competitor.name}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm">
                        <a 
                          href={domainUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          {competitor.domain}
                        </a>
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-600">
                        {typeof competitor.importanceScore === 'number' ? competitor.importanceScore.toFixed(1) : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-600 max-w-32 truncate" title={competitor.domainType}>
                        {competitor.domainType || <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-600">
                        {competitor.pageIntent || <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-xs">
                        {competitor.productMatchScoreValue !== undefined ? (
                          <span className={getMatchBucketColor(competitor.productMatchScoreBucket || 'None')}>
                            {Math.round(competitor.productMatchScoreValue * 100)}%
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap">
                        {competitor.businessRelevanceCategory ? (
                          <button
                            onClick={() => setExplanationModal(competitor)}
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer hover:opacity-80 ${getRelevanceBadgeColor(competitor.businessRelevanceCategory)}`}
                          >
                            {competitor.businessRelevanceCategory}
                          </button>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${competitor.source === 'Via SERP Search' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-700'}`}>
                          {competitor.source || 'Manual Entry'}
                        </span>
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${competitor.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {competitor.isActive ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm space-x-2">
                        <button
                          onClick={() => startEdit(competitor)}
                          className="text-indigo-600 hover:text-indigo-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleActive(competitor)}
                          className={competitor.isActive ? 'text-orange-600 hover:text-orange-800' : 'text-green-600 hover:text-green-800'}
                        >
                          {competitor.isActive ? 'Archive' : 'Unarchive'}
                        </button>
                        <button
                          onClick={() => handleDelete(competitor.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );})
            )}
          </tbody>
        </table>
      </div>

      {explanationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full overflow-hidden">
            <div className="px-4 py-3 border-b flex justify-between items-center bg-purple-50">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Classification Details</h3>
                <p className="text-xs text-gray-600 mt-0.5">{explanationModal.domain}</p>
              </div>
              <button
                onClick={() => setExplanationModal(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none px-2"
              >
                &times;
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Domain Type</p>
                  <p className="text-sm font-medium text-gray-800">{explanationModal.domainType || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Page Intent</p>
                  <p className="text-sm font-medium text-gray-800">{explanationModal.pageIntent || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Product Match</p>
                  <p className={`text-sm font-medium ${getMatchBucketColor(explanationModal.productMatchScoreBucket || 'None')}`}>
                    {explanationModal.productMatchScoreValue !== undefined 
                      ? `${Math.round(explanationModal.productMatchScoreValue * 100)}% (${explanationModal.productMatchScoreBucket})` 
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Business Relevance</p>
                  {explanationModal.businessRelevanceCategory ? (
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getRelevanceBadgeColor(explanationModal.businessRelevanceCategory)}`}>
                      {explanationModal.businessRelevanceCategory}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </div>
              </div>

              {explanationModal.explanationSummary && (
                <div className="border-t pt-4">
                  <p className="text-[10px] text-gray-500 uppercase mb-2">Why This Classification?</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{explanationModal.explanationSummary}</p>
                </div>
              )}

              {explanationModal.addedAt && (
                <div className="text-[10px] text-gray-400">
                  Added at: {new Date(explanationModal.addedAt).toLocaleString()}
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => setExplanationModal(null)}
                className="px-4 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
