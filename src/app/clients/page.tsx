'use client';

import React, { useState, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';
import { Client, DomainProfile } from '@/types';

const MAX_DOMAINS = 5;

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [domainProfiles, setDomainProfiles] = useState<Record<string, DomainProfile[]>>({});
  const [fetchingDomain, setFetchingDomain] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    domains: [''],
    notes: '',
  });

  const [editFormData, setEditFormData] = useState({
    code: '',
    name: '',
    domains: [''],
    notes: '',
  });

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    const res = await fetch('/api/clients');
    const data = await res.json();
    const normalizedClients = data.map((c: Client) => ({
      ...c,
      domains: c.domains || (c.mainDomain ? [c.mainDomain] : []),
    }));
    setClients(normalizedClients);
    setLoading(false);
  }

  async function fetchDomainProfilesForClient(clientCode: string) {
    try {
      const res = await fetch(`/api/domain-profiles?clientCode=${clientCode}`);
      const profiles = await res.json();
      setDomainProfiles(prev => ({
        ...prev,
        [clientCode]: profiles,
      }));
    } catch (error) {
      console.error('Failed to fetch domain profiles:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        domains: formData.domains.filter(d => d.trim()),
      }),
    });
    
    setFormData({ code: '', name: '', domains: [''], notes: '' });
    fetchClients();
    showNotification('success', 'Client added successfully');
  }

  async function handleUpdate(id: string) {
    await fetch('/api/clients', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        id, 
        ...editFormData,
        domains: editFormData.domains.filter(d => d.trim()),
      }),
    });
    
    setEditingId(null);
    fetchClients();
    showNotification('success', 'Client updated successfully');
  }

  async function toggleActive(client: Client) {
    await fetch('/api/clients', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: client.id, isActive: !client.isActive }),
    });
    
    fetchClients();
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to permanently delete this client? This action cannot be undone.')) {
      return;
    }
    
    await fetch(`/api/clients?id=${id}`, {
      method: 'DELETE',
    });
    
    fetchClients();
    showNotification('success', 'Client deleted');
  }

  async function handleFetchDomainOverview(clientCode: string, domain: string) {
    setFetchingDomain(`${clientCode}_${domain}`);
    setNotification(null);
    
    try {
      const res = await fetch('/api/domain-profiles/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientCode, domain, locationCode: 'IN' }),
      });
      
      const result = await res.json();
      
      if (res.ok) {
        showNotification('success', `Domain overview fetched for ${domain}`);
        await fetchDomainProfilesForClient(clientCode);
      } else {
        showNotification('error', result.error || 'Failed to fetch domain overview');
      }
    } catch (error) {
      showNotification('error', 'Failed to fetch domain overview');
    } finally {
      setFetchingDomain(null);
    }
  }

  function showNotification(type: 'success' | 'error', message: string) {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  }

  function startEdit(client: Client) {
    setEditingId(client.id);
    setEditFormData({
      code: client.code,
      name: client.name,
      domains: client.domains?.length > 0 ? [...client.domains] : [client.mainDomain || ''],
      notes: client.notes || '',
    });
  }

  function toggleExpanded(client: Client) {
    if (expandedClientId === client.id) {
      setExpandedClientId(null);
    } else {
      setExpandedClientId(client.id);
      if (!domainProfiles[client.code]) {
        fetchDomainProfilesForClient(client.code);
      }
    }
  }

  function addDomainField(isEdit: boolean) {
    if (isEdit) {
      if (editFormData.domains.length < MAX_DOMAINS) {
        setEditFormData(prev => ({ ...prev, domains: [...prev.domains, ''] }));
      }
    } else {
      if (formData.domains.length < MAX_DOMAINS) {
        setFormData(prev => ({ ...prev, domains: [...prev.domains, ''] }));
      }
    }
  }

  function removeDomainField(index: number, isEdit: boolean) {
    if (isEdit) {
      if (editFormData.domains.length > 1) {
        setEditFormData(prev => ({
          ...prev,
          domains: prev.domains.filter((_, i) => i !== index),
        }));
      }
    } else {
      if (formData.domains.length > 1) {
        setFormData(prev => ({
          ...prev,
          domains: prev.domains.filter((_, i) => i !== index),
        }));
      }
    }
  }

  function updateDomain(index: number, value: string, isEdit: boolean) {
    if (isEdit) {
      const newDomains = [...editFormData.domains];
      newDomains[index] = value;
      setEditFormData(prev => ({ ...prev, domains: newDomains }));
    } else {
      const newDomains = [...formData.domains];
      newDomains[index] = value;
      setFormData(prev => ({ ...prev, domains: newDomains }));
    }
  }

  function getProfileForDomain(clientCode: string, domain: string): DomainProfile | undefined {
    const profiles = domainProfiles[clientCode] || [];
    const normalizedInput = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
    return profiles.find(p => {
      const normalizedProfile = p.domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
      return normalizedProfile === normalizedInput;
    });
  }

  function formatNumber(num: number | null): string {
    if (num === null || num === undefined) return '-';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div>
      <PageHeader 
        title="Client Master" 
        description="Manage your client database with domain profiling"
      />

      {notification && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          notification.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {notification.message}
        </div>
      )}

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600">{clients.length}</div>
            <div className="text-xs text-gray-600">Total Clients</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{clients.filter(c => c.isActive).length}</div>
            <div className="text-xs text-gray-600">Active</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-500">{clients.filter(c => !c.isActive).length}</div>
            <div className="text-xs text-gray-600">Archived</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Add New Client</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Code (e.g. 01)"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              required
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              placeholder="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
              Add Client
            </button>
          </div>
          
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Domains (up to 5)</label>
              {formData.domains.length < MAX_DOMAINS && (
                <button
                  type="button"
                  onClick={() => addDomainField(false)}
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  + Add Domain
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              {formData.domains.map((domain, index) => (
                <div key={index} className="flex gap-1">
                  <input
                    type="text"
                    placeholder={`Domain ${index + 1}`}
                    value={domain}
                    onChange={(e) => updateDomain(index, e.target.value, false)}
                    className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                  {formData.domains.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDomainField(index, false)}
                      className="px-2 text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10"></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">S.No</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domains</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active?</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {clients.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  No clients yet. Add your first client above.
                </td>
              </tr>
            ) : (
              clients.map((client, index) => (
                <React.Fragment key={client.id}>
                  <tr className={!client.isActive ? 'bg-gray-50 opacity-60' : ''}>
                    {editingId === client.id ? (
                      <>
                        <td className="px-4 py-4"></td>
                        <td className="px-4 py-4 text-sm text-gray-500">{index + 1}</td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editFormData.code}
                            onChange={(e) => setEditFormData({ ...editFormData, code: e.target.value })}
                            className="w-full px-2 py-1 border rounded"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editFormData.name}
                            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                            className="w-full px-2 py-1 border rounded"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            {editFormData.domains.map((domain, i) => (
                              <div key={i} className="flex gap-1">
                                <input
                                  type="text"
                                  value={domain}
                                  onChange={(e) => updateDomain(i, e.target.value, true)}
                                  className="flex-1 px-2 py-1 border rounded text-sm"
                                  placeholder={`Domain ${i + 1}`}
                                />
                                {editFormData.domains.length > 1 && (
                                  <button
                                    onClick={() => removeDomainField(i, true)}
                                    className="text-red-500 hover:text-red-700 px-1"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                            {editFormData.domains.length < MAX_DOMAINS && (
                              <button
                                onClick={() => addDomainField(true)}
                                className="text-xs text-indigo-600 hover:text-indigo-800"
                              >
                                + Add
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs rounded-full ${client.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {client.isActive ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-6 py-4 space-x-2">
                          <button
                            onClick={() => handleUpdate(client.id)}
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
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-4">
                          <button
                            onClick={() => toggleExpanded(client)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {expandedClientId === client.id ? '▼' : '▶'}
                          </button>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{client.code}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{client.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <div className="flex flex-wrap gap-1">
                            {(client.domains || [client.mainDomain]).filter(Boolean).map((d, i) => (
                              <span key={i} className="inline-block bg-gray-100 px-2 py-0.5 rounded text-xs">
                                {d}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${client.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {client.isActive ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                          <button
                            onClick={() => startEdit(client)}
                            className="text-indigo-600 hover:text-indigo-800"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleActive(client)}
                            className={client.isActive ? 'text-orange-600 hover:text-orange-800' : 'text-green-600 hover:text-green-800'}
                          >
                            {client.isActive ? 'Archive' : 'Unarchive'}
                          </button>
                          <button
                            onClick={() => handleDelete(client.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                  {expandedClientId === client.id && editingId !== client.id && (
                    <tr key={`${client.id}-expanded`} className="bg-gray-50">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="bg-white rounded-lg border p-4">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">Domain Profiles</h4>
                          <div className="space-y-4">
                            {(client.domains || [client.mainDomain]).filter(Boolean).map((domain, domainIndex) => {
                              const profile = getProfileForDomain(client.code, domain);
                              const isFetching = fetchingDomain === `${client.code}_${domain}`;
                              
                              return (
                                <div key={domainIndex} className="border rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-gray-800">{domain}</span>
                                      {profile && (
                                        <span className={`text-xs px-2 py-0.5 rounded ${
                                          profile.fetchStatus === 'success' 
                                            ? 'bg-green-100 text-green-700'
                                            : profile.fetchStatus === 'error'
                                            ? 'bg-red-100 text-red-700'
                                            : profile.fetchStatus === 'fetching'
                                            ? 'bg-yellow-100 text-yellow-700'
                                            : 'bg-gray-100 text-gray-600'
                                        }`}>
                                          {profile.fetchStatus}
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => handleFetchDomainOverview(client.code, domain)}
                                      disabled={isFetching}
                                      className={`px-3 py-1 text-xs rounded ${
                                        isFetching
                                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                      }`}
                                    >
                                      {isFetching ? 'Fetching...' : profile ? 'Refresh Overview' : 'Fetch Domain Overview'}
                                    </button>
                                  </div>
                                  
                                  {profile && profile.fetchStatus === 'success' && (
                                    <div className="mt-3 space-y-4">
                                      {/* Title and Meta Description */}
                                      <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                                        <div>
                                          <div className="text-xs font-medium text-gray-500 mb-1">Title</div>
                                          <div className="text-sm text-gray-800">{profile.title || <span className="text-gray-400 italic">Not available</span>}</div>
                                        </div>
                                        <div>
                                          <div className="text-xs font-medium text-gray-500 mb-1">Meta Description</div>
                                          <div className="text-sm text-gray-700">{profile.metaDescription || <span className="text-gray-400 italic">Not available</span>}</div>
                                        </div>
                                        {profile.inferredCategory && (
                                          <div>
                                            <div className="text-xs font-medium text-gray-500 mb-1">Inferred Category</div>
                                            <span className="inline-block text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">{profile.inferredCategory}</span>
                                          </div>
                                        )}
                                      </div>

                                      {/* Metrics Grid */}
                                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                                        <div className="bg-blue-50 rounded p-2">
                                          <div className="text-gray-500">Organic Traffic</div>
                                          <div className="font-semibold text-blue-700">{formatNumber(profile.organicTraffic)}</div>
                                        </div>
                                        <div className="bg-green-50 rounded p-2">
                                          <div className="text-gray-500">Organic Keywords</div>
                                          <div className="font-semibold text-green-700">{formatNumber(profile.organicKeywordsCount)}</div>
                                        </div>
                                        <div className="bg-purple-50 rounded p-2">
                                          <div className="text-gray-500">Backlinks</div>
                                          <div className="font-semibold text-purple-700">{formatNumber(profile.backlinksCount)}</div>
                                        </div>
                                        <div className="bg-orange-50 rounded p-2">
                                          <div className="text-gray-500">Referring Domains</div>
                                          <div className="font-semibold text-orange-700">{formatNumber(profile.referringDomainsCount)}</div>
                                        </div>
                                        <div className="bg-indigo-50 rounded p-2">
                                          <div className="text-gray-500">Domain Rank</div>
                                          <div className="font-semibold text-indigo-700">{profile.domainRank || '-'}</div>
                                        </div>
                                      </div>
                                      
                                      {/* Top Keywords Table */}
                                      {profile.topKeywords && profile.topKeywords.length > 0 && (
                                        <div>
                                          <div className="text-xs font-medium text-gray-600 mb-2">Top {profile.topKeywords.length} Keywords</div>
                                          <div className="border rounded-lg overflow-hidden">
                                            <table className="min-w-full divide-y divide-gray-200 text-xs">
                                              <thead className="bg-gray-50">
                                                <tr>
                                                  <th className="px-3 py-2 text-left font-medium text-gray-500">Keyword</th>
                                                  <th className="px-3 py-2 text-right font-medium text-gray-500">Position</th>
                                                  <th className="px-3 py-2 text-right font-medium text-gray-500">Search Vol</th>
                                                  <th className="px-3 py-2 text-right font-medium text-gray-500">CPC</th>
                                                  <th className="px-3 py-2 text-left font-medium text-gray-500">URL</th>
                                                </tr>
                                              </thead>
                                              <tbody className="bg-white divide-y divide-gray-100">
                                                {profile.topKeywords.map((kw, i) => (
                                                  <tr key={i} className="hover:bg-gray-50">
                                                    <td className="px-3 py-1.5 text-gray-800 font-medium">{kw.keyword}</td>
                                                    <td className="px-3 py-1.5 text-right">
                                                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs ${
                                                        kw.position <= 3 ? 'bg-green-100 text-green-700' :
                                                        kw.position <= 10 ? 'bg-blue-100 text-blue-700' :
                                                        kw.position <= 20 ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-gray-100 text-gray-600'
                                                      }`}>
                                                        {kw.position}
                                                      </span>
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right text-gray-600">{formatNumber(kw.searchVolume)}</td>
                                                    <td className="px-3 py-1.5 text-right text-gray-600">{kw.cpc != null ? `$${kw.cpc.toFixed(2)}` : '-'}</td>
                                                    <td className="px-3 py-1.5 text-gray-500 max-w-xs truncate">
                                                      {kw.url ? (
                                                        <a href={kw.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                                                          {kw.url.replace(/^https?:\/\/(www\.)?/, '').substring(0, 40)}...
                                                        </a>
                                                      ) : '-'}
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {profile.lastFetchedAt && (
                                        <div className="text-xs text-gray-400">
                                          Last fetched: {new Date(profile.lastFetchedAt).toLocaleString()}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {profile && profile.fetchStatus === 'error' && (
                                    <div className="mt-2 text-xs text-red-600">
                                      Error: {profile.errorMessage || 'Failed to fetch'}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
