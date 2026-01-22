'use client';

import React, { useState, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';
import ExportButton, { ExportColumn } from '@/components/ExportButton';
import HelpInfoIcon from '@/components/HelpInfoIcon';
import CanonicalEntitySection from '@/components/CanonicalEntitySection';

import { Client, DomainProfile, ClientAIProfile } from '@/types';

const MAX_DOMAINS = 5;

const refreshOverviewHelp = {
  title: 'Domain Overview Refresh',
  description: 'Fetches fresh real-time SEO metrics for this domain from DataForSEO, including Organic Traffic, Total Keywords, Backlinks count, and checks if the website is live (Title/Meta).',
  whyWeAddedThis: 'SEO data changes frequently. Competitors gain traffic, change their titles, or go offline. This button ensures you aren\'t looking at stale data from last month.',
  examples: [],
  nuances: 'This action consumes API credits. It fetches a "Live" overview, so it may take a few seconds. Use it when you suspect the data is outdated or when you first add a domain.',
  useCases: [
    'Get the latest traffic numbers for a client report',
    'Verify if a domain is still active/resolvable',
    'Update keyword counts after a major SEO update'
  ]
};

const clientsPageHelp = {
  title: 'Client Master Data',
  description: 'This is the primary registry for all your clients. It links business entities (Clients) to their digital properties (Domains) and AI Profiles.',
  whyWeAddedThis: 'Centralizing client management ensures that all downstream tools (Keyword Research, Competitor Analysis, Rank Tracking) calculate data for the correct entity.',
  examples: ['Client: "Meera Industries", Domain: "meeraind.com"'],
  nuances: 'A client can have multiple domains (e.g., localized versions like .in, .de). The "Active" status controls whether background jobs run for this client.',
  useCases: [
    'Add new clients to the system',
    'Update domain lists for existing clients',
    'Generate and manage AI Business Profiles',
    'Monitor high-level domain health metrics'
  ]
};

const clientsPageDescription = `
  This page serves as the control center for your agency's client portfolio. 
  Here you can register new clients, map their website domains, and generate comprehensive AI Business Profiles 
  that power the rest of the application's intelligence. 
  
  You can also perform quick health checks on client domains to verify uptime and SEO basics 
  (Title, Meta, Traffic estimates) via the DataForSEO integration. 
  
  **Data Flow:** 
  User Input (Client Details) → Local Database → DataForSEO API (Domain Metrics) & OpenAI/Gemini (Profile Generation).
`;

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [domainProfiles, setDomainProfiles] = useState<Record<string, DomainProfile[]>>({});
  const [fetchingDomain, setFetchingDomain] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [aiProfiles, setAiProfiles] = useState<Record<string, ClientAIProfile>>({});
  const [generatingAiProfile, setGeneratingAiProfile] = useState<string | null>(null);
  const [showDomainsVerification, setShowDomainsVerification] = useState<string | null>(null);
  const [recentlyRefreshedClientCode, setRecentlyRefreshedClientCode] = useState<string | null>(null);
  const [businessMetricsEditing, setBusinessMetricsEditing] = useState<Record<string, Client['businessMetrics']>>({});
  const [savingBusinessMetrics, setSavingBusinessMetrics] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState<string | null>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

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
      // Ensure profiles is an array before setting state
      if (Array.isArray(profiles)) {
        setDomainProfiles(prev => ({
          ...prev,
          [clientCode]: profiles,
        }));
      } else {
        console.error('Domain profiles response is not an array:', profiles);
        setDomainProfiles(prev => ({
          ...prev,
          [clientCode]: [],
        }));
      }
    } catch (error) {
      console.error('Failed to fetch domain profiles:', error);
      setDomainProfiles(prev => ({
        ...prev,
        [clientCode]: [],
      }));
    }
  }

  async function fetchAiProfileForClient(clientCode: string) {
    try {
      const res = await fetch(`/api/client-ai-profile?clientCode=${clientCode}`);
      if (!res.ok) {
        console.error('Failed to fetch AI profile: HTTP', res.status);
        return;
      }
      const profile = await res.json();
      if (profile && profile.clientCode) {
        setAiProfiles(prev => ({
          ...prev,
          [clientCode]: profile,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch AI profile:', error);
    }
  }

  async function handleGenerateAiProfile(client: Client) {
    setGeneratingAiProfile(client.code);
    setNotification(null);

    try {
      const profiles = domainProfiles[client.code] || [];
      const domains = (client.domains || [client.mainDomain]).filter(Boolean);

      const res = await fetch('/api/client-ai-profile/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientCode: client.code,
          clientName: client.name,
          notes: client.notes,
          domains,
          domainProfiles: profiles,
        }),
      });

      const result = await res.json();

      if (res.ok && result.profile) {
        setAiProfiles(prev => ({
          ...prev,
          [client.code]: result.profile,
        }));
        setExpandedClientId(client.id);
        setRecentlyRefreshedClientCode(client.code);
        setTimeout(() => setRecentlyRefreshedClientCode(null), 2500);
        showNotification('success', `AI Profile generated using ${result.domainsUsed?.length || 0} domain(s)`);
      } else {
        showNotification('error', result.error || 'Failed to generate AI profile');
      }
    } catch (error) {
      showNotification('error', 'Failed to generate AI profile');
    } finally {
      setGeneratingAiProfile(null);
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
      headers: { 'Content-Type': 'application/json' },
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
      if (!aiProfiles[client.code]) {
        fetchAiProfileForClient(client.code);
      }
      // Initialize business metrics editing state
      if (!businessMetricsEditing[client.code]) {
        setBusinessMetricsEditing(prev => ({
          ...prev,
          [client.code]: client.businessMetrics || {}
        }));
      }
    }
  }

  async function handleSaveBusinessMetrics(clientId: string, clientCode: string) {
    setSavingBusinessMetrics(clientCode);
    try {
      const metrics = businessMetricsEditing[clientCode] || {};
      await fetch('/api/clients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: clientId,
          businessMetrics: metrics,
        }),
      });
      showNotification('success', 'Business metrics saved');
      fetchClients();
    } catch (error) {
      showNotification('error', 'Failed to save business metrics');
    } finally {
      setSavingBusinessMetrics(null);
    }
  }

  function updateBusinessMetric(clientCode: string, field: keyof NonNullable<Client['businessMetrics']>, value: string) {
    setBusinessMetricsEditing(prev => ({
      ...prev,
      [clientCode]: {
        ...prev[clientCode],
        [field]: value
      }
    }));
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
        helpInfo={clientsPageHelp}
        extendedDescription={clientsPageDescription}
      />

      {notification && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${notification.type === 'success'
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
        <ExportButton
          data={clients}
          columns={[
            { key: 'code', header: 'Code' },
            { key: 'name', header: 'Name' },
            { key: 'domains', header: 'Domains', getValue: (c) => (c.domains || []).join(', ') },
            { key: 'isActive', header: 'Active' },
            { key: 'notes', header: 'Notes' },
          ] as ExportColumn<Client>[]}
          filename={`clients-${new Date().toISOString().split('T')[0]}`}
        />
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
                                        <span className={`text-xs px-2 py-0.5 rounded ${profile.fetchStatus === 'success'
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
                                      className={`px-3 py-1 text-xs rounded ${isFetching
                                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                        }`}
                                    >
                                      {isFetching ? 'Fetching...' : profile ? 'Refresh Overview' : 'Fetch Domain Overview'}
                                    </button>
                                    <HelpInfoIcon helpInfo={refreshOverviewHelp} />
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
                                        {!profile.title && !profile.metaDescription && (
                                          <div className="text-xs text-gray-500 italic flex items-center gap-1">
                                            <span>ⓘ</span>
                                            <span>Website may be down or inaccessible. Title and description could not be fetched.</span>
                                          </div>
                                        )}
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
                                        <div className="bg-purple-50 rounded p-2 group relative">
                                          <div className="text-gray-500 flex items-center gap-1">
                                            Backlinks
                                            {profile.backlinksCount === null && (
                                              <span className="text-gray-400 cursor-help" title="Backlinks API subscription required">ⓘ</span>
                                            )}
                                          </div>
                                          <div className="font-semibold text-purple-700">{formatNumber(profile.backlinksCount)}</div>
                                          {profile.backlinksCount === null && (
                                            <div className="hidden group-hover:block absolute bottom-full left-0 mb-1 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10 w-48">
                                              Backlinks data requires a separate API subscription
                                            </div>
                                          )}
                                        </div>
                                        <div className="bg-orange-50 rounded p-2 group relative">
                                          <div className="text-gray-500 flex items-center gap-1">
                                            Referring Domains
                                            {profile.referringDomainsCount === null && (
                                              <span className="text-gray-400 cursor-help" title="Backlinks API subscription required">ⓘ</span>
                                            )}
                                          </div>
                                          <div className="font-semibold text-orange-700">{formatNumber(profile.referringDomainsCount)}</div>
                                          {profile.referringDomainsCount === null && (
                                            <div className="hidden group-hover:block absolute bottom-full left-0 mb-1 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10 w-48">
                                              Requires Backlinks API subscription
                                            </div>
                                          )}
                                        </div>
                                        <div className="bg-indigo-50 rounded p-2 group relative">
                                          <div className="text-gray-500 flex items-center gap-1">
                                            Domain Rank
                                            {profile.domainRank === null && (
                                              <span className="text-gray-400 cursor-help" title="Backlinks API subscription required">ⓘ</span>
                                            )}
                                          </div>
                                          <div className="font-semibold text-indigo-700">{profile.domainRank || '-'}</div>
                                          {profile.domainRank === null && (
                                            <div className="hidden group-hover:block absolute bottom-full left-0 mb-1 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10 w-48">
                                              Requires Backlinks API subscription
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Info banner if backlinks data is unavailable */}
                                      {profile.backlinksCount === null && profile.referringDomainsCount === null && profile.domainRank === null && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800 flex items-center gap-2">
                                          <span>⚠️</span>
                                          <span>Backlinks, Referring Domains, and Domain Rank require a Backlinks API subscription in your DataForSEO account.</span>
                                        </div>
                                      )}

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
                                                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs ${kw.position <= 3 ? 'bg-green-100 text-green-700' :
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

                        {/* AI Client Profile Section */}
                        <div className="bg-white rounded-lg border p-4 mt-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-gray-700">AI Client Profile</h4>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleGenerateAiProfile(client)}
                                disabled={generatingAiProfile === client.code}
                                className={`px-3 py-1.5 text-xs rounded flex items-center gap-2 ${generatingAiProfile === client.code
                                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                  : 'bg-purple-600 text-white hover:bg-purple-700'
                                  }`}
                              >
                                {generatingAiProfile === client.code ? (
                                  <>
                                    <span className="animate-spin">⟳</span>
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <span>✨</span>
                                    {aiProfiles[client.code] ? 'Regenerate AI Profile' : 'Generate AI Profile'}
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {aiProfiles[client.code] && (
                            <div className="space-y-4">
                              {/* Domains Verification Link */}
                              <div className="flex items-center gap-2 text-xs">
                                <button
                                  onClick={() => setShowDomainsVerification(
                                    showDomainsVerification === client.code ? null : client.code
                                  )}
                                  className="text-indigo-600 hover:text-indigo-800 underline"
                                >
                                  {showDomainsVerification === client.code ? 'Hide' : 'View'} domains used ({aiProfiles[client.code].domainsUsedForGeneration?.length || 0})
                                </button>
                                <span className="text-gray-400">|</span>
                                <span className="text-gray-500">
                                  Generated: {new Date(aiProfiles[client.code].generatedAt).toLocaleString()}
                                </span>
                                {recentlyRefreshedClientCode === client.code && (
                                  <span className="ml-2 text-xs text-green-600 font-medium">• Profile refreshed</span>
                                )}
                              </div>

                              {showDomainsVerification === client.code && (
                                <div className="bg-gray-50 rounded-lg p-3 text-xs">
                                  <div className="font-medium text-gray-700 mb-2">Domains used for profile generation:</div>
                                  <div className="flex flex-wrap gap-2">
                                    {aiProfiles[client.code].domainsUsedForGeneration?.map((domain, i) => (
                                      <span key={i} className="bg-white border px-2 py-1 rounded">
                                        {domain}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Business Overview */}
                              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4">
                                <h5 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                  <span>🏢</span> Business Overview
                                </h5>
                                <div className="space-y-3">
                                  <div className="flex items-start gap-3">
                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-medium whitespace-nowrap">
                                      {aiProfiles[client.code].industryType}
                                    </span>
                                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
                                      {aiProfiles[client.code].businessModel}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-700">{aiProfiles[client.code].shortSummary}</p>
                                </div>
                              </div>

                              {/* Product & Market */}
                              <div className="bg-blue-50 rounded-lg p-4">
                                <h5 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                  <span>📦</span> Product & Market
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div>
                                    <div className="text-xs font-medium text-gray-600 mb-2">Product Lines</div>
                                    <div className="flex flex-wrap gap-1">
                                      {aiProfiles[client.code].productLines?.map((item, i) => (
                                        <span key={i} className="text-xs bg-white border border-blue-200 text-blue-700 px-2 py-0.5 rounded">
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium text-gray-600 mb-2">Target Customers</div>
                                    <div className="flex flex-wrap gap-1">
                                      {aiProfiles[client.code].targetCustomerSegments?.map((item, i) => (
                                        <span key={i} className="text-xs bg-white border border-blue-200 text-blue-700 px-2 py-0.5 rounded">
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium text-gray-600 mb-2">Target Geographies</div>
                                    <div className="flex flex-wrap gap-1">
                                      {aiProfiles[client.code].targetGeographies?.map((item, i) => (
                                        <span key={i} className="text-xs bg-white border border-green-200 text-green-700 px-2 py-0.5 rounded">
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Topic Clusters */}
                              <div className="bg-green-50 rounded-lg p-4">
                                <h5 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                  <span>🏷️</span> Topic Clusters
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div>
                                    <div className="text-xs font-medium text-gray-600 mb-2">Core Topics</div>
                                    <div className="flex flex-wrap gap-1">
                                      {aiProfiles[client.code].coreTopics?.map((item, i) => (
                                        <span key={i} className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium text-gray-600 mb-2">Adjacent Topics</div>
                                    <div className="flex flex-wrap gap-1">
                                      {aiProfiles[client.code].adjacentTopics?.map((item, i) => (
                                        <span key={i} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium text-gray-600 mb-2">Negative Topics</div>
                                    <div className="flex flex-wrap gap-1">
                                      {aiProfiles[client.code].negativeTopics?.map((item, i) => (
                                        <span key={i} className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Domain Type Patterns */}
                              <div className="bg-orange-50 rounded-lg p-4">
                                <h5 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                  <span>🔍</span> Domain Type Patterns
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                                  <div className="bg-white rounded p-2 border border-orange-200">
                                    <div className="font-medium text-gray-700 mb-1">OEM/Manufacturer Indicators</div>
                                    <div className="flex flex-wrap gap-1">
                                      {aiProfiles[client.code].domainTypePatterns?.oemManufacturerIndicators?.map((item, i) => (
                                        <span key={i} className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-xs">
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="bg-white rounded p-2 border border-orange-200">
                                    <div className="font-medium text-gray-700 mb-1">Service Provider Indicators</div>
                                    <div className="flex flex-wrap gap-1">
                                      {aiProfiles[client.code].domainTypePatterns?.serviceProviderIndicators?.map((item, i) => (
                                        <span key={i} className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-xs">
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="bg-white rounded p-2 border border-orange-200">
                                    <div className="font-medium text-gray-700 mb-1">Marketplace Indicators</div>
                                    <div className="flex flex-wrap gap-1">
                                      {aiProfiles[client.code].domainTypePatterns?.marketplaceIndicators?.map((item, i) => (
                                        <span key={i} className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-xs">
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="bg-white rounded p-2 border border-orange-200">
                                    <div className="font-medium text-gray-700 mb-1">End Customer Indicators</div>
                                    <div className="flex flex-wrap gap-1">
                                      {aiProfiles[client.code].domainTypePatterns?.endCustomerIndicators?.map((item, i) => (
                                        <span key={i} className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-xs">
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="bg-white rounded p-2 border border-orange-200">
                                    <div className="font-medium text-gray-700 mb-1">Educational/Media Indicators</div>
                                    <div className="flex flex-wrap gap-1">
                                      {aiProfiles[client.code].domainTypePatterns?.educationalMediaIndicators?.map((item, i) => (
                                        <span key={i} className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-xs">
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Classification Intent Hints */}
                              <div className="bg-teal-50 rounded-lg p-4">
                                <h5 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                  <span>🎯</span> Classification Intent Hints
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div>
                                    <div className="text-xs font-medium text-gray-600 mb-2">Transactional Keywords</div>
                                    <div className="flex flex-wrap gap-1">
                                      {aiProfiles[client.code].classificationIntentHints?.transactionalKeywords?.map((item, i) => (
                                        <span key={i} className="text-xs bg-teal-100 text-teal-800 px-2 py-0.5 rounded">
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium text-gray-600 mb-2">Informational Keywords</div>
                                    <div className="flex flex-wrap gap-1">
                                      {aiProfiles[client.code].classificationIntentHints?.informationalKeywords?.map((item, i) => (
                                        <span key={i} className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium text-gray-600 mb-2">Directory Keywords</div>
                                    <div className="flex flex-wrap gap-1">
                                      {aiProfiles[client.code].classificationIntentHints?.directoryKeywords?.map((item, i) => (
                                        <span key={i} className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Matching Dictionary Editor (Interactive) */}
                              {/* Matching Dictionary Editor (Interactive) REMOVED */}
                              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-sm text-gray-500">
                                <em>Manual Dictionary Editing is disabled. Use Tag All (Rules) instead.</em>
                              </div>

                              {/* Business Relevance Logic Notes */}
                              <div className="bg-slate-50 rounded-lg p-4">
                                <h5 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                  <span>📝</span> Business Relevance Logic
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                  <div className="bg-white rounded p-3 border">
                                    <div className="font-medium text-green-700 mb-1">Direct Competitor Definition</div>
                                    <p className="text-gray-600">{aiProfiles[client.code].businessRelevanceLogicNotes?.directCompetitorDefinition}</p>
                                  </div>
                                  <div className="bg-white rounded p-3 border">
                                    <div className="font-medium text-blue-700 mb-1">Potential Customer Definition</div>
                                    <p className="text-gray-600">{aiProfiles[client.code].businessRelevanceLogicNotes?.potentialCustomerDefinition}</p>
                                  </div>
                                  <div className="bg-white rounded p-3 border">
                                    <div className="font-medium text-orange-700 mb-1">Marketplace/Channel Definition</div>
                                    <p className="text-gray-600">{aiProfiles[client.code].businessRelevanceLogicNotes?.marketplaceChannelDefinition}</p>
                                  </div>
                                  <div className="bg-white rounded p-3 border">
                                    <div className="font-medium text-gray-700 mb-1">Irrelevant Definition</div>
                                    <p className="text-gray-600">{aiProfiles[client.code].businessRelevanceLogicNotes?.irrelevantDefinition}</p>
                                  </div>
                                </div>
                              </div>

                              {/* Advanced: Raw Profile JSON */}
                              <details className="group border rounded-lg bg-gray-50 p-2 mt-4">
                                <summary className="cursor-pointer text-xs font-medium text-gray-600 flex items-center gap-2 select-none">
                                  <span>⚙️</span> Advanced: Raw Profile JSON
                                </summary>
                                <div className="mt-3 relative">
                                  <pre className="text-xs bg-gray-900 text-green-400 p-4 rounded overflow-auto max-h-96">
                                    {JSON.stringify(aiProfiles[client.code], null, 2)}
                                  </pre>
                                  <button
                                    onClick={() => navigator.clipboard.writeText(JSON.stringify(aiProfiles[client.code], null, 2))}
                                    className="absolute top-4 right-4 text-xs bg-white text-gray-700 px-2 py-1 rounded hover:bg-gray-100 border shadow-sm"
                                  >
                                    Copy JSON
                                  </button>
                                </div>
                              </details>
                            </div>
                          )}

                          {!aiProfiles[client.code] && !generatingAiProfile && (
                            <div className="text-center py-8 text-gray-500">
                              <p className="text-sm mb-2">No AI profile generated yet</p>
                              <p className="text-xs text-gray-400">Click "Generate AI Profile" to create an intelligent profile using all domain data</p>
                            </div>
                          )}
                        </div>

                        {/* Canonical Entity ID Section */}
                        <CanonicalEntitySection
                          client={client}
                          onUpdate={fetchClients}
                          showNotification={showNotification}
                        />

                        {/* Business Metrics Section */}
                        <div className="bg-white rounded-lg border p-4 mt-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                              <span>📊</span> Business Metrics
                            </h4>
                            <button
                              onClick={() => handleSaveBusinessMetrics(client.id, client.code)}
                              disabled={savingBusinessMetrics === client.code}
                              className={`px-3 py-1 text-sm rounded ${savingBusinessMetrics === client.code
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                }`}
                            >
                              {savingBusinessMetrics === client.code ? 'Saving...' : 'Save Metrics'}
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mb-4">
                            Conversion funnel metrics used for ROI calculations. Values are saved per client.
                          </p>
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 border">Variable</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 border w-32">Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="px-3 py-2 border text-gray-700">
                                  <span className="font-medium">CTR (Top 1-5)</span>
                                  <div className="text-xs text-gray-500">Higher CTR for top positions</div>
                                </td>
                                <td className="px-3 py-2 border">
                                  <input
                                    type="text"
                                    value={businessMetricsEditing[client.code]?.ctrTop5 || ''}
                                    onChange={(e) => updateBusinessMetric(client.code, 'ctrTop5', e.target.value)}
                                    placeholder="e.g., 25%"
                                    className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                  />
                                </td>
                              </tr>
                              <tr>
                                <td className="px-3 py-2 border text-gray-700">
                                  <span className="font-medium">CTR (Top 1-10)</span>
                                  <div className="text-xs text-gray-500">% of searches Meera captures if ranking Top 10</div>
                                </td>
                                <td className="px-3 py-2 border">
                                  <input
                                    type="text"
                                    value={businessMetricsEditing[client.code]?.ctrTop10 || ''}
                                    onChange={(e) => updateBusinessMetric(client.code, 'ctrTop10', e.target.value)}
                                    placeholder="e.g., 15%"
                                    className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                  />
                                </td>
                              </tr>
                              <tr>
                                <td className="px-3 py-2 border text-gray-700">
                                  <span className="font-medium">Visit → RFQ</span>
                                  <div className="text-xs text-gray-500">% visitors submitting RFQ</div>
                                </td>
                                <td className="px-3 py-2 border">
                                  <input
                                    type="text"
                                    value={businessMetricsEditing[client.code]?.visitToRfq || ''}
                                    onChange={(e) => updateBusinessMetric(client.code, 'visitToRfq', e.target.value)}
                                    placeholder="e.g., 2%"
                                    className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                  />
                                </td>
                              </tr>
                              <tr>
                                <td className="px-3 py-2 border text-gray-700">
                                  <span className="font-medium">RFQ → Order Win</span>
                                  <div className="text-xs text-gray-500">% RFQs converting to orders</div>
                                </td>
                                <td className="px-3 py-2 border">
                                  <input
                                    type="text"
                                    value={businessMetricsEditing[client.code]?.rfqToOrder || ''}
                                    onChange={(e) => updateBusinessMetric(client.code, 'rfqToOrder', e.target.value)}
                                    placeholder="e.g., 2%"
                                    className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                  />
                                </td>
                              </tr>
                              <tr>
                                <td className="px-3 py-2 border text-gray-700">
                                  <span className="font-medium">Average Machinery Ticket Size</span>
                                  <div className="text-xs text-gray-500">Average order value per order</div>
                                </td>
                                <td className="px-3 py-2 border">
                                  <input
                                    type="text"
                                    value={businessMetricsEditing[client.code]?.avgTicketSize || ''}
                                    onChange={(e) => updateBusinessMetric(client.code, 'avgTicketSize', e.target.value)}
                                    placeholder="e.g., ₹25,00,000"
                                    className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                  />
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Brand Photos Section */}
                        <div className="bg-white rounded-lg border p-4 mt-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                              <span>🖼️</span> Brand Photos
                              <span className="text-xs text-gray-400 font-normal">({(client.brandPhotos || []).length}/5)</span>
                            </h4>
                            {(client.brandPhotos || []).length < 5 && (
                              <label className="px-3 py-1 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer flex items-center gap-1">
                                {uploadingPhoto === client.id ? (
                                  <><span className="animate-spin">⏳</span> Uploading...</>
                                ) : (
                                  <>+ Upload Photo</>
                                )}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  disabled={uploadingPhoto === client.id}
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;

                                    setUploadingPhoto(client.id);
                                    try {
                                      const formData = new FormData();
                                      formData.append('photo', file);

                                      const res = await fetch(`/api/clients/${client.id}/photos`, {
                                        method: 'POST',
                                        body: formData,
                                      });

                                      const result = await res.json();
                                      if (result.success) {
                                        showNotification('success', 'Photo uploaded successfully');
                                        fetchClients();
                                      } else {
                                        showNotification('error', result.error || 'Failed to upload photo');
                                      }
                                    } catch {
                                      showNotification('error', 'Failed to upload photo');
                                    } finally {
                                      setUploadingPhoto(null);
                                      e.target.value = '';
                                    }
                                  }}
                                />
                              </label>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mb-4">
                            Upload brand logos, product images, or company photos (max 5 images).
                          </p>
                          <div className="flex flex-wrap gap-3">
                            {(client.brandPhotos || []).map((photo, photoIndex) => (
                              <div key={photoIndex} className="relative group">
                                <img
                                  src={photo}
                                  alt={`Brand photo ${photoIndex + 1}`}
                                  className="w-24 h-24 object-contain rounded-lg border shadow-sm bg-white p-1"
                                />
                                <button
                                  onClick={async () => {
                                    if (!confirm('Delete this photo?')) return;
                                    setDeletingPhoto(photo);
                                    try {
                                      const res = await fetch(
                                        `/api/clients/${client.id}/photos?photo=${encodeURIComponent(photo)}`,
                                        { method: 'DELETE' }
                                      );
                                      const result = await res.json();
                                      if (result.success) {
                                        showNotification('success', 'Photo deleted');
                                        fetchClients();
                                      } else {
                                        showNotification('error', result.error || 'Failed to delete photo');
                                      }
                                    } catch {
                                      showNotification('error', 'Failed to delete photo');
                                    } finally {
                                      setDeletingPhoto(null);
                                    }
                                  }}
                                  disabled={deletingPhoto === photo}
                                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow"
                                  title="Delete photo"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            {(client.brandPhotos || []).length === 0 && (
                              <div className="text-xs text-gray-400 italic py-4">
                                No brand photos uploaded yet. Click "Upload Photo" to add images.
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Keyword Dictionary Section */}
                        {aiProfiles[client.code]?.ai_kw_builder_term_dictionary && (
                          <div className="bg-white rounded-lg border p-4 mt-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                <span>📚</span> Keyword Dictionary
                              </h4>
                              <span className="text-xs text-gray-400">
                                Last updated: {aiProfiles[client.code]?.ai_kw_builder_term_dictionary?.updatedAt
                                  ? new Date(aiProfiles[client.code].ai_kw_builder_term_dictionary!.updatedAt).toLocaleString()
                                  : 'N/A'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mb-4">
                              Include/Exclude terms saved via "Save Dictionary" button from Product Relevance Filter.
                            </p>

                            {/* Include Terms */}
                            <div className="mb-4">
                              <div className="text-xs font-medium text-green-700 mb-2 flex items-center gap-2">
                                <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded">Include</span>
                                <span className="text-gray-400">
                                  ({(aiProfiles[client.code]?.ai_kw_builder_term_dictionary?.terms || []).filter(t => t.bucket === 'include').length} terms)
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto bg-green-50/50 p-2 rounded border border-green-100">
                                {(aiProfiles[client.code]?.ai_kw_builder_term_dictionary?.terms || [])
                                  .filter(t => t.bucket === 'include')
                                  .map((t, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-green-100 text-green-800 text-[10px] rounded">
                                      {t.term}
                                    </span>
                                  ))}
                                {(aiProfiles[client.code]?.ai_kw_builder_term_dictionary?.terms || []).filter(t => t.bucket === 'include').length === 0 && (
                                  <span className="text-xs text-gray-400 italic">No include terms saved</span>
                                )}
                              </div>
                            </div>

                            {/* Exclude Terms */}
                            <div>
                              <div className="text-xs font-medium text-red-700 mb-2 flex items-center gap-2">
                                <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded">Exclude</span>
                                <span className="text-gray-400">
                                  ({(aiProfiles[client.code]?.ai_kw_builder_term_dictionary?.terms || []).filter(t => t.bucket === 'exclude').length} terms)
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto bg-red-50/50 p-2 rounded border border-red-100">
                                {(aiProfiles[client.code]?.ai_kw_builder_term_dictionary?.terms || [])
                                  .filter(t => t.bucket === 'exclude')
                                  .map((t, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-red-100 text-red-800 text-[10px] rounded">
                                      {t.term}
                                    </span>
                                  ))}
                                {(aiProfiles[client.code]?.ai_kw_builder_term_dictionary?.terms || []).filter(t => t.bucket === 'exclude').length === 0 && (
                                  <span className="text-xs text-gray-400 italic">No exclude terms saved</span>
                                )}
                              </div>
                            </div>

                            {/* Brand Terms */}
                            <div className="mt-4">
                              <div className="text-xs font-medium text-purple-700 mb-2 flex items-center gap-2">
                                <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded">Brand</span>
                                <span className="text-gray-400">
                                  ({(aiProfiles[client.code]?.ai_kw_builder_term_dictionary?.terms || []).filter(t => t.bucket === 'brand').length} terms)
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto bg-purple-50/50 p-2 rounded border border-purple-100">
                                {(aiProfiles[client.code]?.ai_kw_builder_term_dictionary?.terms || [])
                                  .filter(t => t.bucket === 'brand')
                                  .map((t, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] rounded">
                                      {t.term}
                                    </span>
                                  ))}
                                {(aiProfiles[client.code]?.ai_kw_builder_term_dictionary?.terms || []).filter(t => t.bucket === 'brand').length === 0 && (
                                  <span className="text-xs text-gray-400 italic">No brand terms saved</span>
                                )}
                              </div>
                            </div>

                            {/* Review Terms */}
                            <div className="mt-4">
                              <div className="text-xs font-medium text-amber-700 mb-2 flex items-center gap-2">
                                <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Review</span>
                                <span className="text-gray-400">
                                  ({(aiProfiles[client.code]?.ai_kw_builder_term_dictionary?.terms || []).filter(t => t.bucket === 'review').length} terms)
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto bg-amber-50/50 p-2 rounded border border-amber-100">
                                {(aiProfiles[client.code]?.ai_kw_builder_term_dictionary?.terms || [])
                                  .filter(t => t.bucket === 'review')
                                  .map((t, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] rounded">
                                      {t.term}
                                    </span>
                                  ))}
                                {(aiProfiles[client.code]?.ai_kw_builder_term_dictionary?.terms || []).filter(t => t.bucket === 'review').length === 0 && (
                                  <span className="text-xs text-gray-400 italic">No review terms saved</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
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
