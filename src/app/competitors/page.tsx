'use client';

import React, { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import ExportButton, { ExportColumn } from '@/components/ExportButton';
import { Client, Competitor, CompetitorSource, ClientAIProfile } from '@/types';

// Default competition types - user can add more
const DEFAULT_COMPETITION_TYPES = ['Main Competitor', 'Partial Competitor', 'Not a Competitor'];

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

function getCompetitionTypeColor(type: string): string {
  switch (type) {
    case 'Main Competitor': return 'bg-red-100 text-red-700';
    case 'Partial Competitor': return 'bg-amber-100 text-amber-700';
    case 'Not a Competitor': return 'bg-gray-100 text-gray-600';
    default: return 'bg-blue-100 text-blue-700';
  }
}

const competitorsPageHelp = {
  title: 'Competitors & Classification',
  description: 'A master list of potential competitors, partners, and customers identified from SERPs or manual entry.',
  whyWeAddedThis: 'Not every domain ranking for your keywords is a direct competitor. Some are marketplaces, directories, or even potential customers. This module classifies them so you can focus on the right targets.',
  examples: ['"meeraind.com" (Self)', '"indiamart.com" (Marketplace)', '"competitor-x.com" (Direct Competitor)'],
  nuances: 'The "Business Relevance" field is the most important. It tells you RELATIONSHIP to the client. This is often AI-determined based on product match and domain intent.',
  useCases: [
    'Filter out irrelevant domains from keyword research',
    'Identify new direct competitors',
    'Find potential customer leads (B2B)'
  ]
};

// Multi-select dropdown component
function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder = 'Select...',
}: {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggle = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter(s => s !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-2 py-1 text-xs border rounded flex items-center justify-between gap-1 bg-white hover:bg-gray-50 min-h-[28px]"
      >
        <span className="truncate text-left flex-1">
          {selected.length === 0 ? placeholder : selected.length === 1 ? selected[0] : `${selected.length} selected`}
        </span>
        <span className="text-[9px]">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-48 bg-white border rounded-lg shadow-xl max-h-48 overflow-auto">
          <div className="p-1">
            {options.map(opt => (
              <label key={opt} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  className="w-3 h-3 rounded"
                />
                <span className="text-xs text-gray-700">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Editable tag selector
function TagSelector({
  value,
  options,
  onChange,
  onAddNew,
  colorFn,
  placeholder = 'Select...',
}: {
  value: string | undefined;
  options: string[];
  onChange: (val: string) => void;
  onAddNew: (val: string) => void;
  colorFn: (val: string) => string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [newValue, setNewValue] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddNew = () => {
    if (newValue.trim() && !options.includes(newValue.trim())) {
      onAddNew(newValue.trim());
      onChange(newValue.trim());
      setNewValue('');
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`px-2 py-0.5 text-[10px] rounded cursor-pointer hover:opacity-80 ${value ? colorFn(value) : 'bg-gray-50 text-gray-400 border border-dashed border-gray-300'}`}
      >
        {value || placeholder}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-44 bg-white border rounded-lg shadow-xl">
          <div className="p-1 max-h-40 overflow-auto">
            {options.map(opt => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-100 ${value === opt ? 'bg-gray-100 font-medium' : ''}`}
              >
                <span className={`inline-block px-1.5 py-0.5 rounded ${colorFn(opt)}`}>{opt}</span>
              </button>
            ))}
          </div>
          <div className="border-t p-2">
            <div className="flex gap-1">
              <input
                type="text"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                placeholder="Add new..."
                className="flex-1 px-2 py-1 text-xs border rounded"
                onKeyDown={e => e.key === 'Enter' && handleAddNew()}
              />
              <button onClick={handleAddNew} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">+</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CompetitorsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [aiProfiles, setAiProfiles] = useState<Record<string, ClientAIProfile>>({});
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [recentlyAddedDomains, setRecentlyAddedDomains] = useState<Set<string>>(new Set());

  // Custom competition types (user can add)
  const [competitionTypes, setCompetitionTypes] = useState<string[]>(DEFAULT_COMPETITION_TYPES);

  // Filters
  const initialClientFilter = searchParams.get('client') || '';
  const [clientFilter, setClientFilter] = useState<string>(initialClientFilter);
  const [domainFilter, setDomainFilter] = useState('');
  const [competitionTypeFilter, setCompetitionTypeFilter] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('all'); // 'all', 'active', 'archived'

  const [explanationModal, setExplanationModal] = useState<Competitor | null>(null);

  // Sorting
  const [sortCol, setSortCol] = useState<string>('domain');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [formData, setFormData] = useState({
    clientCode: initialClientFilter,
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
    competitionType: '',
    competitorForProducts: [] as string[],
  });

  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkClientCode, setBulkClientCode] = useState(initialClientFilter);
  const [bulkDomains, setBulkDomains] = useState('');

  // Update URL when filter changes
  const handleFilterChange = (newClientCode: string) => {
    setClientFilter(newClientCode);
    setFormData(prev => ({ ...prev, clientCode: newClientCode }));
    setBulkClientCode(newClientCode);

    const params = new URLSearchParams(searchParams);
    if (newClientCode) {
      params.set('client', newClientCode);
    } else {
      params.delete('client');
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

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
    try {
      const [competitorsRes, clientsRes] = await Promise.all([
        fetch('/api/competitors'),
        fetch('/api/clients'),
      ]);
      const competitorsData = await competitorsRes.json();
      const clientsData = await clientsRes.json();

      setCompetitors(competitorsData);
      setClients(clientsData.filter((c: Client) => c.isActive));

      // Try to fetch AI profiles, but don't fail if endpoint doesn't exist
      try {
        const profilesRes = await fetch('/api/client-ai-profile');
        if (profilesRes.ok) {
          const profilesData = await profilesRes.json();
          const profileMap: Record<string, ClientAIProfile> = {};
          (profilesData || []).forEach((p: ClientAIProfile) => {
            profileMap[p.clientCode] = p;
          });
          setAiProfiles(profileMap);
        }
      } catch {
        // AI profiles endpoint not available, continue without it
        console.log('AI profiles endpoint not available');
      }

      // Extract custom competition types from existing data
      const existingTypes = new Set(DEFAULT_COMPETITION_TYPES);
      competitorsData.forEach((c: Competitor) => {
        if (c.competitionType) existingTypes.add(c.competitionType);
      });
      setCompetitionTypes(Array.from(existingTypes));

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  }

  function getClientName(clientCode: string) {
    const client = clients.find(c => c.code === clientCode);
    return client ? `${client.code} - ${client.name}` : clientCode;
  }

  // Get product lines for current client filter
  const productLines = useMemo(() => {
    if (!clientFilter || !aiProfiles[clientFilter]) return [];
    const profile = aiProfiles[clientFilter];
    const lines = new Set<string>();
    if (profile.productLines) profile.productLines.forEach(p => lines.add(p));
    if (profile.coreIdentity?.productLines) profile.coreIdentity.productLines.forEach(p => lines.add(p));
    return Array.from(lines);
  }, [clientFilter, aiProfiles]);

  // Apply all filters and sorting
  const filteredCompetitors = useMemo(() => {
    let result = [...competitors];

    // Client filter
    if (clientFilter) result = result.filter(c => c.clientCode === clientFilter);

    // Domain search
    if (domainFilter) result = result.filter(c =>
      c.domain.toLowerCase().includes(domainFilter.toLowerCase()) ||
      c.name.toLowerCase().includes(domainFilter.toLowerCase())
    );

    // Competition type filter
    if (competitionTypeFilter.length > 0) {
      result = result.filter(c => c.competitionType && competitionTypeFilter.includes(c.competitionType));
    }

    // Source filter
    if (sourceFilter.length > 0) {
      result = result.filter(c => sourceFilter.includes(c.source || 'Manual Entry'));
    }

    // Active filter
    if (activeFilter === 'active') result = result.filter(c => c.isActive);
    if (activeFilter === 'archived') result = result.filter(c => !c.isActive);

    // Sorting
    result.sort((a, b) => {
      let aVal: string | number | boolean | undefined;
      let bVal: string | number | boolean | undefined;

      switch (sortCol) {
        case 'clientCode': aVal = a.clientCode; bVal = b.clientCode; break;
        case 'name': aVal = a.name; bVal = b.name; break;
        case 'domain': aVal = a.domain; bVal = b.domain; break;
        case 'competitionType': aVal = a.competitionType || ''; bVal = b.competitionType || ''; break;
        case 'importanceScore': aVal = a.importanceScore ?? -1; bVal = b.importanceScore ?? -1; break;
        case 'domainType': aVal = a.domainType || ''; bVal = b.domainType || ''; break;
        case 'pageIntent': aVal = a.pageIntent || ''; bVal = b.pageIntent || ''; break;
        case 'productMatch': aVal = a.productMatchScoreValue ?? -1; bVal = b.productMatchScoreValue ?? -1; break;
        case 'relevance': aVal = a.businessRelevanceCategory || ''; bVal = b.businessRelevanceCategory || ''; break;
        case 'source': aVal = a.source || ''; bVal = b.source || ''; break;
        case 'isActive': aVal = a.isActive ? 1 : 0; bVal = b.isActive ? 1 : 0; break;
        default: aVal = a.domain; bVal = b.domain;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });

    return result;
  }, [competitors, clientFilter, domainFilter, competitionTypeFilter, sourceFilter, activeFilter, sortCol, sortDir]);

  // Toggle sort
  const toggleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  // Sort indicator
  const SortIcon = ({ col }: { col: string }) => (
    <span className="ml-0.5 text-[8px]">
      {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : '○'}
    </span>
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    setFormData({ clientCode: clientFilter, name: '', domain: '', notes: '' });
    fetchData();
  }

  async function handleBulkImport(e: React.FormEvent) {
    e.preventDefault();
    const lines = bulkDomains.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length === 0) return;

    const newCompetitors = lines.map(domain => {
      let cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '');
      cleanDomain = cleanDomain.split('/')[0];
      const name = cleanDomain.split('.')[0];
      return {
        clientCode: bulkClientCode,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        domain: cleanDomain,
        notes: '',
      };
    });

    await fetch('/api/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bulk: true, competitors: newCompetitors }),
    });

    setBulkClientCode('');
    setBulkDomains('');
    setShowBulkImport(false);
    fetchData();
  }

  async function handleUpdate(id: string) {
    await fetch('/api/competitors', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...editFormData }),
    });
    setEditingId(null);
    fetchData();
  }

  async function updateCompetitorField(id: string, field: string, value: unknown) {
    await fetch('/api/competitors', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, [field]: value }),
    });
    fetchData();
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
    if (!confirm('Are you sure you want to permanently delete this competitor?')) return;
    await fetch(`/api/competitors?id=${id}`, { method: 'DELETE' });
    fetchData();
  }

  async function handleEnrich(competitor: Competitor) {
    setEnrichingId(competitor.id);
    try {
      const res = await fetch('/api/competitors/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: competitor.domain }),
      });

      if (res.ok) {
        const data = await res.json();

        // Update local state immediately for better UX
        const updates: any = {};
        if (data.logos && data.logos.length > 0) {
          // STRICT OVERWRITE: We want exactly what the API returns (2 logos: Favicon + Best Scraped)
          // Do not merge with old junk.
          updates.logos = data.logos;
        }

        if (data.officialBrandName && (!competitor.officialBrandName || !competitor.brandNames || competitor.brandNames.length === 0)) {
          updates.officialBrandName = data.officialBrandName;
          // Also populate the 'brandNames' array if empty
          if (!competitor.brandNames || competitor.brandNames.length === 0) {
            updates.brandNames = [data.officialBrandName];
          }
        }

        if (data.metaTitle) updates.metaTitle = data.metaTitle;
        if (data.metaDescription) updates.metaDescription = data.metaDescription;

        if (Object.keys(updates).length > 0) {
          await updateCompetitor(competitor.id, updates);
          setNotification({ type: 'success', message: `Enriched ${competitor.domain}` });
        } else {
          setNotification({ type: 'info', message: `No new info found for ${competitor.domain}` });
        }
      } else {
        setNotification({ type: 'error', message: 'Enrichment failed' });
      }
    } catch (error) {
      console.error('Enrichment error', error);
      setNotification({ type: 'error', message: 'Enrichment failed' });
    } finally {
      setEnrichingId(null);
    }
  }

  async function handleBulkEnrich() {
    if (!confirm(`This will attempt to enrich ${filteredCompetitors.length} competitors. Continue?`)) return;

    let processed = 0;
    for (const competitor of filteredCompetitors) {
      // Skip if already has logo (optional, but good for saving API calls)
      // if (competitor.logos && competitor.logos.length > 0) continue; 

      await handleEnrich(competitor);
      processed++;
      // Small delay to be nice to APIs
      await new Promise(r => setTimeout(r, 500));
    }
    setNotification({ type: 'success', message: `Bulk enrichment completed. Processed ${processed} domains.` });
  }

  async function handleAutoLabelNames() {
    if (!filteredCompetitors || filteredCompetitors.length === 0) {
      setNotification({ type: 'error', message: "No competitors listed to label." });
      return;
    }

    if (!confirm(`Auto-Label ${filteredCompetitors.length} competitors using AI? This will update their Official Brand Names.`)) return;

    setLoading(true);
    try {
      const domains = filteredCompetitors.map(c => c.domain);
      const res = await fetch('/api/competitors/bulk-brand-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains })
      });

      if (res.ok) {
        const data = await res.json();
        setNotification({ type: 'success', message: `Successfully updated ${data.updatedCount} brand names!` });
        fetchData();
      } else {
        const errData = await res.json().catch(() => ({}));
        setNotification({ type: 'error', message: `Failed: ${errData.details || errData.error || 'Unknown error'}` });
      }
    } catch (e) {
      console.error(e);
      setNotification({ type: 'error', message: "Error connecting to AI service." });
    } finally {
      setLoading(false);
    }
  }

  async function updateCompetitor(id: string, updates: Partial<Competitor>) {
    await fetch('/api/competitors', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
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
      competitionType: competitor.competitionType || '',
      competitorForProducts: competitor.competitorForProducts || [],
    });
  }

  function toggleExpandResult(id: string) {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedRows(newSet);
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div>
      <PageHeader
        title="Competitor Master"
        description="Track and classify competitors for each client"
        helpInfo={competitorsPageHelp}
      />

      {notification && (
        <div className={`mb-4 p-3 rounded-lg text-sm flex items-center justify-between ${notification.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
          notification.type === 'info' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
            'bg-red-50 text-red-800 border border-red-200'
          }`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="text-gray-500 hover:text-gray-700 ml-2">&#10005;</button>
        </div>
      )}

      {/* Stats and Filters Bar */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Stats */}
          <div className="flex items-center gap-4 pr-4 border-r">
            <div className="text-center">
              <div className="text-xl font-bold text-indigo-600">{filteredCompetitors.length}</div>
              <div className="text-[10px] text-gray-500">Showing</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-green-600">{filteredCompetitors.filter(c => c.isActive).length}</div>
              <div className="text-[10px] text-gray-500">Active</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-gray-400">{filteredCompetitors.filter(c => !c.isActive).length}</div>
              <div className="text-[10px] text-gray-500">Archived</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Client</label>
              <select
                value={clientFilter}
                onChange={e => handleFilterChange(e.target.value)}
                className="px-2 py-1.5 border rounded text-sm w-40"
              >
                <option value="">All Clients</option>
                {clients.map(c => <option key={c.id} value={c.code}>{c.code} - {c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Search</label>
              <input
                type="text"
                placeholder="Domain or name..."
                value={domainFilter}
                onChange={e => setDomainFilter(e.target.value)}
                className="px-2 py-1.5 border rounded text-sm w-36"
              />
            </div>

            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Competition</label>
              <select
                value={competitionTypeFilter[0] || ''}
                onChange={e => setCompetitionTypeFilter(e.target.value ? [e.target.value] : [])}
                className="px-2 py-1.5 border rounded text-sm w-36"
              >
                <option value="">All Types</option>
                {competitionTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Source</label>
              <select
                value={sourceFilter[0] || ''}
                onChange={e => setSourceFilter(e.target.value ? [e.target.value] : [])}
                className="px-2 py-1.5 border rounded text-sm w-32"
              >
                <option value="">All Sources</option>
                <option value="Manual Entry">Manual Entry</option>
                <option value="Via SERP Search">Via SERP</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Status</label>
              <select
                value={activeFilter}
                onChange={e => setActiveFilter(e.target.value)}
                className="px-2 py-1.5 border rounded text-sm w-28"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="ml-auto flex gap-2">
              <button
                onClick={() => { setDomainFilter(''); setCompetitionTypeFilter([]); setSourceFilter([]); setActiveFilter('all'); }}
                className="px-3 py-1.5 text-xs text-gray-600 border rounded hover:bg-gray-50"
              >
                Clear Filters
              </button>
              <ExportButton
                data={filteredCompetitors}
                columns={[
                  { key: 'clientCode', header: 'Client Code' },
                  { key: 'logos', header: 'Logo' },
                  { key: 'name', header: 'Name' },
                  { key: 'domain', header: 'Domain' },
                  { key: 'brandNames', header: 'Brand Names' },
                  { key: 'competitionType', header: 'Competition Type' },
                  { key: 'competitorForProducts', header: 'Competitor For Products' },
                  { key: 'importanceScore', header: 'Importance Score' },
                  { key: 'domainType', header: 'Domain Type' },
                  { key: 'pageIntent', header: 'Page Intent' },
                  { key: 'productMatchScore', header: 'Product Match Score' },
                  { key: 'businessRelevanceCategory', header: 'Business Relevance' },
                  { key: 'source', header: 'Source' },
                  { key: 'isActive', header: 'Active' },

                  { key: 'notes', header: 'Notes' },
                ] as ExportColumn<Competitor>[]}
                filename={`competitors-${clientFilter || 'all'}-${new Date().toISOString().split('T')[0]}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Add Competitor Form */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Add New Competitor</h2>
          <button
            onClick={() => handleAutoLabelNames()}
            className="mr-2 text-indigo-600 hover:text-indigo-800 text-xs font-medium border border-indigo-200 px-2 py-1 rounded bg-indigo-50"
            title="Use AI to instantly guess brand names for all domains"
          >
            ✨ Auto-Label Names
          </button>
          <button
            onClick={() => handleBulkEnrich()}
            className="mr-2 text-purple-600 hover:text-purple-800 text-xs font-medium"
            title="Fetch logos for all filtered competitors"
          >
            ✨ Enrich All
          </button>
          <button
            onClick={() => setShowBulkImport(!showBulkImport)}
            className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
          >
            {showBulkImport ? 'Single Add' : 'Bulk Import'}
          </button>
        </div>

        {!showBulkImport ? (
          <form onSubmit={handleSubmit} className="flex gap-3 flex-wrap">
            <select
              value={formData.clientCode}
              onChange={e => setFormData({ ...formData, clientCode: e.target.value })}
              required
              className="px-3 py-2 border rounded text-sm"
            >
              <option value="">Select Client</option>
              {clients.map(c => <option key={c.id} value={c.code}>{c.code} - {c.name}</option>)}
            </select>
            <input
              type="text"
              placeholder="Name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
              className="px-3 py-2 border rounded text-sm w-32"
            />
            <input
              type="text"
              placeholder="Domain"
              value={formData.domain}
              onChange={e => setFormData({ ...formData, domain: e.target.value })}
              required
              className="px-3 py-2 border rounded text-sm w-40"
            />
            <input
              type="text"
              placeholder="Notes (optional)"
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="px-3 py-2 border rounded text-sm flex-1"
            />
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700">
              Add
            </button>
          </form>
        ) : (
          <form onSubmit={handleBulkImport} className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <select
                value={bulkClientCode}
                onChange={e => setBulkClientCode(e.target.value)}
                required
                className="px-3 py-2 border rounded text-sm"
              >
                <option value="">Select Client</option>
                {clients.map(c => <option key={c.id} value={c.code}>{c.code} - {c.name}</option>)}
              </select>
              <textarea
                value={bulkDomains}
                onChange={e => setBulkDomains(e.target.value)}
                placeholder="example.com&#10;competitor.com&#10;another.com"
                required
                rows={4}
                className="px-3 py-2 border rounded text-sm font-mono"
              />
            </div>
            <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded text-sm hover:bg-indigo-700">
              Import All
            </button>
          </form>
        )}
      </div>

      {/* Table with Sticky Header */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-400px)]">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-1 py-2 text-left text-[9px] font-semibold text-gray-600 uppercase w-8">#</th>
                <th className="px-1 py-2 text-left text-[9px] font-semibold text-gray-600 uppercase w-12">Logo</th>
                <th onClick={() => toggleSort('clientCode')} className="px-1 py-2 text-left text-[9px] font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 w-16">Client<SortIcon col="clientCode" /></th>
                <th onClick={() => toggleSort('name')} className="px-1 py-2 text-left text-[9px] font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 w-20">Name<SortIcon col="name" /></th>
                <th onClick={() => toggleSort('domain')} className="px-1 py-2 text-left text-[9px] font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 w-28">Domain<SortIcon col="domain" /></th>
                <th className="px-1 py-2 text-left text-[9px] font-semibold text-gray-600 uppercase w-36" title="This col will be used to tag branded keyword traffic from domain keywords">Brand Names</th>
                <th onClick={() => toggleSort('competitionType')} className="px-1 py-2 text-left text-[9px] font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 w-20">Comp.<SortIcon col="competitionType" /></th>
                <th className="px-1 py-2 text-left text-[9px] font-semibold text-gray-600 uppercase w-24">Products</th>
                <th onClick={() => toggleSort('importanceScore')} className="px-1 py-2 text-left text-[9px] font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 w-10">Scr<SortIcon col="importanceScore" /></th>
                <th onClick={() => toggleSort('domainType')} className="px-1 py-2 text-left text-[9px] font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 w-20">Type<SortIcon col="domainType" /></th>
                <th onClick={() => toggleSort('pageIntent')} className="px-1 py-2 text-left text-[9px] font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 w-16">Intent<SortIcon col="pageIntent" /></th>
                <th onClick={() => toggleSort('productMatch')} className="px-1 py-2 text-left text-[9px] font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 w-10">Mtch<SortIcon col="productMatch" /></th>
                <th onClick={() => toggleSort('relevance')} className="px-1 py-2 text-left text-[9px] font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 w-24">Relevance<SortIcon col="relevance" /></th>
                <th onClick={() => toggleSort('source')} className="px-1 py-2 text-left text-[9px] font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 w-14">Src<SortIcon col="source" /></th>
                <th onClick={() => toggleSort('isActive')} className="px-1 py-2 text-left text-[9px] font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 w-10">Act<SortIcon col="isActive" /></th>

                <th className="px-1 py-2 text-left text-[9px] font-semibold text-gray-600 uppercase w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredCompetitors.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-6 py-8 text-center text-gray-500">
                    {clientFilter ? 'No competitors found for this client.' : 'No competitors yet.'}
                  </td>
                </tr>
              ) : (
                filteredCompetitors.map((c, i) => {
                  const isRecent = recentlyAddedDomains.has(c.domain.toLowerCase().trim());
                  const domainUrl = c.domain.startsWith('http') ? c.domain : `https://${c.domain}`;

                  // Get product lines for this competitor's client
                  const clientProductLines = aiProfiles[c.clientCode]?.coreIdentity?.productLines ||
                    aiProfiles[c.clientCode]?.productLines || [];

                  if (editingId === c.id) {
                    return (
                      <tr key={c.id} className="bg-yellow-50">
                        <td className="px-2 py-2 text-xs text-gray-400">{i + 1}</td>
                        <td className="px-2 py-2"></td>
                        <td className="px-2 py-2">
                          <select
                            value={editFormData.clientCode}
                            onChange={e => setEditFormData({ ...editFormData, clientCode: e.target.value })}
                            className="w-full px-1 py-0.5 border rounded text-xs"
                          >
                            {clients.map(cl => <option key={cl.id} value={cl.code}>{cl.code}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            value={editFormData.name}
                            onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                            className="w-full px-1 py-0.5 border rounded text-xs"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            value={editFormData.domain}
                            onChange={e => setEditFormData({ ...editFormData, domain: e.target.value })}
                            className="w-full px-1 py-0.5 border rounded text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-400">-</td>
                        <td className="px-2 py-2">
                          <select
                            value={editFormData.competitionType}
                            onChange={e => setEditFormData({ ...editFormData, competitionType: e.target.value })}
                            className="w-full px-1 py-0.5 border rounded text-xs"
                          >
                            <option value="">Select...</option>
                            {competitionTypes.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <MultiSelectDropdown
                            options={clientProductLines}
                            selected={editFormData.competitorForProducts}
                            onChange={val => setEditFormData({ ...editFormData, competitorForProducts: val })}
                            placeholder="Products..."
                          />
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-400">-</td>
                        <td className="px-2 py-2 text-xs text-gray-400">-</td>
                        <td className="px-2 py-2 text-xs text-gray-400">-</td>
                        <td className="px-2 py-2 text-xs text-gray-400">-</td>
                        <td className="px-2 py-2 text-xs text-gray-400">-</td>
                        <td className="px-2 py-2">
                          <select
                            value={editFormData.source}
                            onChange={e => setEditFormData({ ...editFormData, source: e.target.value as CompetitorSource })}
                            className="w-full px-1 py-0.5 border rounded text-xs"
                          >
                            <option value="Manual Entry">Manual</option>
                            <option value="Via SERP Search">SERP</option>
                          </select>
                        </td>
                        <td className="px-2 py-2"></td>

                        <td className="px-2 py-2 space-x-1">
                          <button onClick={() => handleUpdate(c.id)} className="text-green-600 hover:underline text-xs">Save</button>
                          <button onClick={() => setEditingId(null)} className="text-gray-500 hover:underline text-xs">Cancel</button>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <React.Fragment key={c.id}>
                      <tr className={`${!c.isActive ? 'bg-gray-50 opacity-60' : ''} ${isRecent ? 'bg-green-50 ring-1 ring-green-200 ring-inset' : ''} hover:bg-gray-50`}>
                        <td className="px-2 py-2 text-xs text-gray-400">
                          <button onClick={() => toggleExpandResult(c.id)} className="hover:bg-gray-200 rounded p-0.5">
                            {expandedRows.has(c.id) ? '▼' : '▶'}
                          </button>
                        </td>
                        <td className="px-2 py-2">
                          <div className="relative group">
                            {c.logos && c.logos.length > 0 ? (
                              <div className="flex items-center">
                                <img src={c.logos[0]} alt={c.name} className="w-6 h-6 object-contain rounded-sm bg-white border" />
                                {c.logos.length > 1 && (
                                  <span className="ml-1 text-[9px] text-gray-500 bg-gray-100 px-0.5 rounded">+{c.logos.length - 1}</span>
                                )}
                              </div>
                            ) : (
                              <div className="w-6 h-6 bg-gray-100 rounded-sm border flex items-center justify-center text-[8px] text-gray-400">?</div>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-700 truncate max-w-24" title={getClientName(c.clientCode)}>{c.clientCode}</td>
                        <td className="px-2 py-2 text-xs font-medium text-gray-900 truncate max-w-28" title={c.name}>{c.name}</td>
                        <td className="px-2 py-2 text-xs">
                          <a href={domainUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate block max-w-36" title={c.domain}>
                            {c.domain}
                          </a>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            defaultValue={(c.brandNames || []).join(', ')}
                            placeholder="e.g., Meera, MI"
                            onBlur={(e) => {
                              const brands = e.target.value.split(',').map(b => b.trim()).filter(b => b.length > 0);
                              if (JSON.stringify(brands) !== JSON.stringify(c.brandNames || [])) {
                                updateCompetitorField(c.id, 'brandNames', brands);
                              }
                            }}
                            className="w-full min-w-24 px-1.5 py-0.5 border rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                            title="Comma-separated brand names for tagging branded keyword traffic"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <TagSelector
                            value={c.competitionType}
                            options={competitionTypes}
                            onChange={val => updateCompetitorField(c.id, 'competitionType', val)}
                            onAddNew={val => setCompetitionTypes([...competitionTypes, val])}
                            colorFn={getCompetitionTypeColor}
                            placeholder="Set..."
                          />
                        </td>
                        <td className="px-2 py-2">
                          {c.competitorForProducts && c.competitorForProducts.length > 0 ? (
                            <div className="flex flex-wrap gap-0.5">
                              {c.competitorForProducts.slice(0, 2).map(p => (
                                <span key={p} className="px-1 py-0.5 bg-purple-100 text-purple-700 text-[9px] rounded">{p}</span>
                              ))}
                              {c.competitorForProducts.length > 2 && (
                                <span className="text-[9px] text-gray-400">+{c.competitorForProducts.length - 2}</span>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => startEdit(c)}
                              className="text-[9px] text-gray-400 hover:text-gray-600"
                            >
                              + Add
                            </button>
                          )}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-600">
                          {typeof c.importanceScore === 'number' ? c.importanceScore.toFixed(1) : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-2 py-2 text-[10px] text-gray-600 truncate max-w-28" title={c.domainType}>
                          {c.domainType || <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-2 py-2 text-[10px] text-gray-600">
                          {c.pageIntent || <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-2 py-2 text-[10px]">
                          {c.productMatchScoreValue !== undefined ? (
                            <span className={getMatchBucketColor(c.productMatchScoreBucket || 'None')}>
                              {Math.round(c.productMatchScoreValue * 100)}%
                            </span>
                          ) : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-2 py-2">
                          {c.businessRelevanceCategory ? (
                            <button
                              onClick={() => setExplanationModal(c)}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-medium cursor-pointer hover:opacity-80 ${getRelevanceBadgeColor(c.businessRelevanceCategory)}`}
                            >
                              {c.businessRelevanceCategory}
                            </button>
                          ) : <span className="text-gray-300 text-[10px]">-</span>}
                        </td>
                        <td className="px-2 py-2">
                          <span className={`px-1.5 py-0.5 text-[9px] rounded ${c.source === 'Via SERP Search' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                            {c.source === 'Via SERP Search' ? 'SERP' : 'Manual'}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <span className={`px-1.5 py-0.5 text-[9px] rounded ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {c.isActive ? 'Yes' : 'No'}
                          </span>
                        </td>

                        <td className="px-2 py-2 text-xs space-x-1 whitespace-nowrap">
                          <button onClick={() => startEdit(c)} className="text-indigo-600 hover:underline">Edit</button>
                          <button onClick={() => toggleActive(c)} className={c.isActive ? 'text-orange-600 hover:underline' : 'text-green-600 hover:underline'}>
                            {c.isActive ? 'Arch' : 'Un'}
                          </button>
                          <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:underline">Del</button>
                          <button
                            onClick={() => handleEnrich(c)}
                            disabled={enrichingId === c.id}
                            className={`text-purple-600 hover:underline text-[10px] ${enrichingId === c.id ? 'opacity-50 cursor-wait' : ''}`}
                            title="Fetch Logo & Brand Name"
                          >
                            {enrichingId === c.id ? '...' : 'Enrich'}
                          </button>
                        </td>
                      </tr>
                      {expandedRows.has(c.id) && (
                        <tr className="bg-gray-50 text-xs">
                          <td colSpan={2}></td>
                          <td colSpan={14} className="p-3 border-b border-gray-100 shadow-inner">
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-[10px] uppercase text-gray-500 font-semibold mb-1">Official Brand Name</label>
                                  <div className="flex gap-2">
                                    <input
                                      className="border rounded px-2 py-1 flex-1 text-sm text-gray-800"
                                      defaultValue={c.officialBrandName}
                                      onBlur={(e) => {
                                        if (e.target.value !== c.officialBrandName) {
                                          updateCompetitorField(c.id, 'officialBrandName', e.target.value);
                                        }
                                      }}
                                      placeholder="Not set"
                                    />
                                    <div>
                                      <label className="block text-[10px] uppercase text-gray-500 font-semibold mb-1">Logos Found</label>
                                      <div className="flex gap-4 overflow-x-auto pb-2">
                                        {c.logos && c.logos.map((logo, idx) => {
                                          let source = 'Scraped';
                                          if (logo.includes('google.com')) source = 'Favicon';

                                          return (
                                            <div key={idx} className="flex flex-col items-center gap-1 min-w-[70px]">
                                              <a href={logo} target="_blank" rel="noopener noreferrer" className="h-16 w-16 bg-white border rounded flex items-center justify-center p-1 hover:border-indigo-400 shadow-sm relative group">
                                                <img
                                                  src={logo}
                                                  className="max-h-full max-w-full object-contain"
                                                  onError={(e) => {
                                                    const img = e.currentTarget;
                                                    const container = img.closest('.flex-col');
                                                    if (container) (container as HTMLElement).style.display = 'none';
                                                  }}
                                                  onLoad={(e) => {
                                                    const img = e.currentTarget;
                                                    const sizeSpan = img.parentElement?.nextElementSibling?.nextElementSibling;
                                                    if (sizeSpan) sizeSpan.textContent = `${img.naturalWidth}x${img.naturalHeight}`;
                                                  }}
                                                />
                                              </a>
                                              <span className="text-[9px] text-gray-500 font-medium">{source}</span>
                                              <span className="text-[8px] text-gray-400 font-mono">...</span>
                                            </div>
                                          );
                                        })}
                                        {(!c.logos || c.logos.length === 0) && <span className="text-gray-400 italic">None</span>}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="space-y-3">
                                  <div>
                                    <label className="block text-[10px] uppercase text-gray-500 font-semibold mb-1">Page Title</label>
                                    <p className="text-gray-800 bg-white border px-2 py-1.5 rounded text-xs">{c.metaTitle || <span className="text-gray-400 italic">Not fetched</span>}</p>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] uppercase text-gray-500 font-semibold mb-1">Meta Description</label>
                                    <p className="text-gray-600 bg-white border px-2 py-1.5 rounded text-xs">{c.metaDescription || <span className="text-gray-400 italic">Not fetched</span>}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                      }
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Explanation Modal */}
      {
        explanationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full overflow-hidden">
              <div className="px-4 py-3 border-b flex justify-between items-center bg-purple-50">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Classification Details</h3>
                  <p className="text-xs text-gray-600 mt-0.5">{explanationModal.domain}</p>
                </div>
                <button onClick={() => setExplanationModal(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
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
                    ) : <span className="text-gray-400">-</span>}
                  </div>
                </div>
                {explanationModal.explanationSummary && (
                  <div className="border-t pt-4">
                    <p className="text-[10px] text-gray-500 uppercase mb-2">Why This Classification?</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{explanationModal.explanationSummary}</p>
                  </div>
                )}
              </div>
              <div className="px-4 py-3 border-t bg-gray-50 flex justify-end">
                <button onClick={() => setExplanationModal(null)} className="px-4 py-1.5 text-xs font-medium text-gray-700 bg-white border rounded hover:bg-gray-50">
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}

export default function CompetitorsPage() {
  return (
    <Suspense fallback={<div className="text-center py-8">Loading...</div>}>
      <CompetitorsContent />
    </Suspense>
  );
}
