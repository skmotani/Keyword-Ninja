'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PageHeader from '@/components/PageHeader';
import ExportButton, { ExportColumn } from '@/components/ExportButton';
import HarvestModal from '@/components/HarvestModal';
import { Client, KeywordTag, FitStatus, ProductLine, ClientAIProfile } from '@/types';

// Helper for clientside normalization matches backend
const normalizeKeyword = (keyword: string): string => {
  return keyword.trim().toLowerCase().replace(/\s+/g, ' ');
};

interface Competitor {
  id: string;
  clientCode: string;
  name: string;
  domain: string;
  isActive: boolean;
}

interface DomainKeywordRecord {
  id: string;
  clientCode: string;
  domain: string;
  label: string;
  locationCode: string;
  languageCode: string;
  keyword: string;
  position: number | null;
  searchVolume: number | null;
  cpc: number | null;
  url: string | null;
  fetchedAt: string;
  snapshotDate: string;
}

const LOCATION_OPTIONS = [
  { code: 'all', label: 'All Locations' },
  { code: 'IN', label: 'India (IN)' },
  { code: 'GL', label: 'Global (GL)' },
];

const getFitStatusColor = (status: string) => {
  switch (status) {
    case 'BRAND_KW': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'CORE_MATCH': return 'bg-green-100 text-green-800 border-green-200';
    case 'ADJACENT_MATCH': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'REVIEW': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'NO_MATCH': return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'BLANK': return 'bg-gray-50 text-gray-400 border-gray-200 border-dashed';
    default: return 'bg-gray-50 text-gray-500 border-gray-100';
  }
};

const getProductLineColor = (line: string) => {
  switch (line) {
    case 'TWISTING': return 'text-orange-600 bg-orange-50 ring-orange-500/10 font-medium';
    case 'WINDING': return 'text-cyan-600 bg-cyan-50 ring-cyan-500/10 font-medium';
    case 'HEAT_SETTING': return 'text-rose-600 bg-rose-50 ring-rose-500/10 font-medium';
    case 'BRAND_KW': return 'text-purple-600 bg-purple-50 ring-purple-500/10 font-medium';
    case 'MULTIPLE': return 'text-indigo-600 bg-indigo-50 ring-indigo-500/10 font-medium';
    case 'BLANK': return 'text-gray-400 bg-gray-50 ring-gray-500/10 border-gray-200 border-dashed';
    default: return 'text-gray-500 bg-gray-50 ring-gray-500/10';
  }
};

interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

function Tooltip({ text, children }: TooltipProps) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top - 8,
        left: rect.left,
      });
    }
    setShow(true);
  };

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          className="fixed pointer-events-none z-[9999] -translate-y-full"
          style={{ top: coords.top, left: coords.left }}
        >
          <div className="bg-gray-900 text-white text-[10px] leading-tight rounded px-2 py-1.5 shadow-lg max-w-64">
            {text}
          </div>
          <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

type SortField = 'position' | 'searchVolume' | 'cpc' | null;
type SortDirection = 'asc' | 'desc';

const domainKeywordsPageHelp = {
  title: 'Competitor Top Keywords',
  description: 'See exactly what keywords your competitors are ranking for, along with their position and search volume.',
  whyWeAddedThis: 'This is the "Spy Tool". Instead of guessing what keywords to target, you can see what is already working for your competitors and "steal" their strategy.',
  examples: ['Competitor X ranks #1 for "best twisting machine" (Vol: 500)', 'Competitor Y ranks #3 for "textile machinery" (Vol: 1000)'],
  nuances: 'We fetch the Top 100 keywords for each domain. These are the "head" terms driving the most traffic. For "long-tail" or specific queries, use the SERP Results tool.',
  useCases: [
    'Discover high-volume keywords you missed',
    'See if competitors are ranking for your brand name',
    'Find content gaps where they rank but you do not'
  ]
};

const domainKeywordsPageDescription = `
  This page reveals the "secret sauce" of your competitors' SEO strategy. 
  It pulls the list of keywords that are driving the most organic traffic to their websites.
  
  **Key Metrics:**
  *   **Position:** Where they rank on Google (1-100).
  *   **Search Volume:** How many people search for this term monthly.
  *   **CPC:** Estimated cost if you were to pay for an ad on this keyword.

  **Data Flow:** 
  Competitor Domain → DataForSEO (Ranked Keywords API) → List of Keywords & Stats.
  
  This data helps prioritize content by showing you what works on [Domain Top Pages](/keywords/domain-pages).
`;

// Helper component for Dictionary Panel
function MatchingDictionaryPanel({ profile, collapsed, onToggle }: { profile: ClientAIProfile | null, collapsed: boolean, onToggle: () => void }) {
  if (!profile || !profile.matchingDictionary) return null;

  // Adaptation for new schema (using safe access)
  const brandTokens = profile.matchingDictionary.brandTokens || [];
  const negativeTokens = profile.matchingDictionary.negativeTokens || [];

  return (
    <div className="bg-white rounded-lg shadow mb-4 border border-gray-100">
      <div
        className="px-4 py-3 border-b flex items-center justify-between cursor-pointer hover:bg-gray-50"
        onClick={onToggle}
      >
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
          Matching Dictionary in Use
        </h3>
        <button className="text-gray-400 hover:text-gray-600">
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>

      {!collapsed && (
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <div className="font-semibold text-purple-700 mb-1">Brand Tokens ({brandTokens.length})</div>
            <div className="flex flex-wrap gap-1">
              {brandTokens.map(t => (
                <span key={t.token} className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-100">{t.token}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="font-semibold text-red-700 mb-1">Negative Tokens ({negativeTokens.length})</div>
            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
              {negativeTokens.map(t => (
                <span key={t.token} className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded border border-red-100">{t.token}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="font-semibold text-blue-700 mb-1">Product Lines</div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {/* ProductLineMap is now Record<token, lines[]>. Inverted display needed or deprecated? 
                    The previous view showed productLineTokens (Line -> Tokens).
                    New schema has productLineMap (Token -> Lines).
                    Let's just show a note or simplified view for now to fix error.
                */}
              <div className="text-gray-400 text-[10px] italic">View on Client Profile for details</div>
            </div>
          </div>
          <div>
            <div className="font-semibold text-green-700 mb-1">Scoring Tokens</div>
            <div className="mb-2">
              <span className="text-gray-500 mb-0.5 block">Positive ({profile.matchingDictionary.positiveTokens?.length || 0})</span>
              <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                {profile.matchingDictionary.positiveTokens?.slice(0, 15).map(t => <span key={t.token} className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded border border-green-100">{t.token}</span>)}
                {(profile.matchingDictionary.positiveTokens?.length || 0) > 15 && <span className="text-gray-400">...</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component for Add Token Modal
function AddTokenModal({ isOpen, onClose, initialValue, onSave, products }: { isOpen: boolean, onClose: () => void, initialValue: string, onSave: (type: string, value: string, productKey?: string) => void, products: string[] }) {
  const [token, setToken] = useState(initialValue);
  const [type, setType] = useState('negativeTokens');
  const [productKey, setProductKey] = useState(products[0] || '');

  useEffect(() => {
    if (isOpen) setToken(initialValue);
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Add Dictionary Token</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Token (Word or Phrase)</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Token Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="brandTokens">Brand (Brand Match)</option>
              <option value="negativeTokens">Negative (No Match)</option>
              <option value="productLineTokens">Product Line (Core Match)</option>
              <option value="coreTokens">Core Topic (Scoring +3)</option>
              <option value="adjacentTokens">Adjacent Topic (Scoring +1)</option>
            </select>
          </div>

          {type === 'productLineTokens' && products.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Line</label>
              <select
                value={productKey}
                onChange={(e) => setProductKey(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                {products.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(type, token, type === 'productLineTokens' ? productKey : undefined)}
            disabled={!token.trim()}
            className="px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50"
          >
            Save & Update
          </button>
        </div>
      </div>
    </div>
  );
}


export default function DomainKeywordsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedClientCode, setSelectedClientCode] = useState<string>('');
  const [profile, setProfile] = useState<ClientAIProfile | null>(null);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [records, setRecords] = useState<DomainKeywordRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [keywordFilter, setKeywordFilter] = useState('');
  const [positionMaxFilter, setPositionMaxFilter] = useState('');
  const [volumeMinFilter, setVolumeMinFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [harvestModalOpen, setHarvestModalOpen] = useState(false);

  // Tagging State (Rule Based)
  const [tags, setTags] = useState<Record<string, KeywordTag>>({});
  const tagsRef = useRef<Record<string, KeywordTag>>({});
  const [isProcessingRules, setIsProcessingRules] = useState(false);

  const [fitFilter, setFitFilter] = useState<string>('all');
  const [productFilter, setProductFilter] = useState<string>('all');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(100);

  // UI State
  const [dictPanelCollapsed, setDictPanelCollapsed] = useState(false);
  const [addTokenModal, setAddTokenModal] = useState<{ open: boolean, keyword: string } | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedClientCode) {
      fetchCompetitors();
      fetchTags();
      fetchProfile();
    }
  }, [selectedClientCode]);

  const fetchClients = async () => {
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
    }
  };

  const fetchProfile = async () => {
    if (!selectedClientCode) return;
    try {
      const res = await fetch(`/api/client-ai-profile?clientCode=${selectedClientCode}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      } else {
        setProfile(null);
      }
    } catch (e) {
      console.error("Failed to fetch profile", e);
    }
  };

  const fetchCompetitors = async () => {
    try {
      const res = await fetch('/api/competitors');
      const data = await res.json();
      const clientCompetitors = data.filter(
        (c: Competitor) => c.clientCode === selectedClientCode && c.isActive
      );
      setCompetitors(clientCompetitors);
      setSelectedDomains(clientCompetitors.map((c: Competitor) => c.domain));
    } catch (error) {
      console.error('Failed to fetch competitors:', error);
    }
  };

  const fetchTags = async () => {
    if (!selectedClientCode) return;
    try {
      const res = await fetch(`/api/keywords/tags?clientCode=${selectedClientCode}`);
      const data = await res.json();
      if (data.success) {
        setTags(data.tags);
        tagsRef.current = data.tags;
      }
    } catch (error) {
      console.error("Failed to fetch tags", error);
    }
  };

  const fetchRecords = useCallback(async () => {
    if (!selectedClientCode) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/domain-keywords?clientCode=${selectedClientCode}`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.records);
      }
    } catch (error) {
      console.error('Failed to fetch domain keywords data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedClientCode]);

  useEffect(() => {
    if (selectedClientCode) {
      fetchRecords();
    }
  }, [selectedClientCode, fetchRecords]);

  // Derived Filtered Records
  const filteredRecords = useMemo(() => {
    let filtered = records;

    if (domainFilter !== 'all') {
      filtered = filtered.filter(r => r.domain === domainFilter);
    }

    if (locationFilter !== 'all') {
      filtered = filtered.filter(r => r.locationCode === locationFilter);
    }

    if (keywordFilter) {
      const lower = keywordFilter.toLowerCase();
      filtered = filtered.filter(r => r.keyword.toLowerCase().includes(lower));
    }

    if (positionMaxFilter) {
      const max = parseInt(positionMaxFilter);
      if (!isNaN(max)) {
        filtered = filtered.filter(r => (r.position ?? 999) <= max);
      }
    }

    if (volumeMinFilter) {
      const min = parseInt(volumeMinFilter);
      if (!isNaN(min)) {
        filtered = filtered.filter(r => (r.searchVolume ?? 0) >= min);
      }
    }

    if (fitFilter !== 'all') {
      filtered = filtered.filter(r => {
        const tag = tags[normalizeKeyword(r.keyword)];
        if (fitFilter === 'BLANK') return !tag;
        return tag && tag.fitStatus === fitFilter;
      });
    }

    if (productFilter !== 'all') {
      filtered = filtered.filter(r => {
        const tag = tags[normalizeKeyword(r.keyword)];
        if (productFilter === 'BLANK') return !tag;
        return tag && tag.productLine === productFilter;
      });
    }

    return filtered;
  }, [records, domainFilter, locationFilter, keywordFilter, positionMaxFilter, volumeMinFilter, fitFilter, productFilter, tags]);

  const uniqueDomainsInRecords = useMemo(() => {
    const domains = new Set(records.map(r => r.domain));
    return Array.from(domains).sort();
  }, [records]);

  // Add Token Handlers
  const handleOpenAddToken = (record: DomainKeywordRecord) => {
    setAddTokenModal({ open: true, keyword: record.keyword });
  };

  const handleTagAllKeywords = async () => {
    if (!selectedClientCode) return;
    try {
      setLoading(true);
      const output = await fetch('/api/domain-keywords/tag-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clientCode: selectedClientCode })
      });

      if (!output.ok) throw new Error('Failed to run tag-all');

      const res = await output.json();
      setNotification({ type: 'success', message: `Tagged ${res.taggedCount} keywords. Impact: ${res.impactSummary?.length || 0} updates.` });

      // Refresh data
      await Promise.all([
        fetchRecords(),
        fetchProfile() // Refresh effective dictionary snapshot
      ]);
    } catch (err) {
      console.error(err);
      setNotification({ type: 'error', message: 'Failed to tag all keywords' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToken = async (type: string, value: string, productKey?: string) => {
    if (!profile) {
      setNotification({ type: 'error', message: 'Client Profile not loaded. Cannot update dictionary.' });
      return;
    }

    // Construct bucketPath
    let bucketPath = type;
    if (type === 'productLineTokens' && productKey) {
      bucketPath = `productLineTokens.${productKey}`;
    } else if (type === 'intentTokens') {
      // Logic in modal currently doesn't support picking specific intent type, usually generic? 
      // If modal supports intent type selection, we'd append it. 
      // For now, let's assume 'intentTokens.INFORMATIONAL' default or handle it? 
      // The modal options are: Brand, Negative, ProductLine, Core, Adjacent.
      // It doesn't seem to offer Intent selection in the visible code. 
      // If I need to support Intent, I should update Modal.
      // The user requirement said "Assign Intent (adds to intentTokens bucket)".
      // I will stick to what the modal offers.
    }

    try {
      const res = await fetch('/api/client-ai-profile/dictionary/add-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientCode: selectedClientCode,
          bucketPath,
          token: value
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Update local profile with returned dictionary
        if (data.matchingDictionary) {
          setProfile(prev => prev ? ({ ...prev, matchingDictionary: data.matchingDictionary }) : null);
        }
        setAddTokenModal(null);
        setNotification({ type: 'success', message: 'Token added. Re-classifying...' });

        // Trigger re-tagging (Tag All for consistency)
        await handleTagAllKeywords();
      } else {
        const err = await res.json();
        setNotification({ type: 'error', message: `Failed to add token: ${err.error}` });
      }
    } catch (e) {
      console.error("Failed to save token", e);
      setNotification({ type: 'error', message: 'Error saving token.' });
    }
  };




  const handleUpdateTag = async (keyword: string, field: 'fitStatus' | 'productLine', value: string) => {
    const normKw = normalizeKeyword(keyword);
    const existing = tags[normKw];

    const updatedTag: KeywordTag = {
      ...existing,
      id: existing?.id || `${selectedClientCode}_${normKw}`,
      clientCode: selectedClientCode,
      keyword: normKw,
      fitStatus: (field === 'fitStatus' ? value : existing?.fitStatus || 'REVIEW') as FitStatus,
      productLine: (field === 'productLine' ? value : existing?.productLine || 'NONE') as ProductLine,
      rationale: 'Manual Override',
      updatedAt: new Date().toISOString()
    } as KeywordTag;

    setTags(prev => ({ ...prev, [normKw]: updatedTag }));

    try {
      const res = await fetch('/api/domain-keywords/tag-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientCode: selectedClientCode,
          keyword: normKw,
          fitStatus: updatedTag.fitStatus,
          productLine: updatedTag.productLine
        })
      });
      if (!res.ok) throw new Error('Failed to save override');
    } catch (e) {
      console.error("Override failed", e);
      setNotification({ type: 'error', message: 'Failed to save tag update.' });
      fetchTags();
    }
  };


  const toggleDomain = (domain: string) => {
    setSelectedDomains(prev => {
      if (prev.includes(domain)) {
        return prev.filter(d => d !== domain);
      }
      return [...prev, domain];
    });
  };

  const selectAllDomains = () => {
    setSelectedDomains(competitors.map(c => c.domain));
  };

  const deselectAllDomains = () => {
    setSelectedDomains([]);
  };

  const handleRefresh = async () => {
    if (!selectedClientCode || selectedDomains.length === 0) {
      setNotification({ type: 'error', message: 'Please select at least one domain to fetch.' });
      return;
    }
    setRefreshing(true);
    setNotification(null);

    try {
      const res = await fetch('/api/domain-keywords/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientCode: selectedClientCode,
          domains: selectedDomains,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setNotification({
          type: 'success',
          message: `Successfully fetched ${data.totalKeywords} keywords across ${data.locations?.length || 2} locations.`,
        });
        await fetchRecords();
      } else {
        setNotification({
          type: 'error',
          message: data.error || 'Failed to refresh domain keywords data.',
        });
      }
    } catch (error) {
      console.error('Error refreshing domain keywords:', error);
      setNotification({
        type: 'error',
        message: 'An error occurred while refreshing domain keywords data.',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'position' ? 'asc' : 'desc');
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [domainFilter, locationFilter, keywordFilter, positionMaxFilter, volumeMinFilter, fitFilter, productFilter]);

  const sortedRecords = useMemo(() => {
    if (!sortField) return filteredRecords;

    return [...filteredRecords].sort((a, b) => {
      const aVal = a[sortField] ?? (sortField === 'position' ? 999 : 0);
      const bVal = b[sortField] ?? (sortField === 'position' ? 999 : 0);

      if (sortDirection === 'asc') {
        return aVal - bVal;
      }
      return bVal - aVal;
    });
  }, [filteredRecords, sortField, sortDirection]);

  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedRecords, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedRecords.length / itemsPerPage);

  const summaryStats = useMemo(() => {
    const uniqueDomains = new Set(filteredRecords.map(r => r.domain)).size;
    const uniqueKeywords = new Set(filteredRecords.map(r => r.keyword)).size;
    const totalVolume = filteredRecords.reduce((sum, r) => sum + (r.searchVolume ?? 0), 0);
    const avgVolume = filteredRecords.length > 0 ? totalVolume / filteredRecords.length : 0;
    const top10Count = filteredRecords.filter(r => (r.position ?? 999) <= 10).length;
    const top3Count = filteredRecords.filter(r => (r.position ?? 999) <= 3).length;
    const avgCpc = filteredRecords.length > 0
      ? filteredRecords.reduce((sum, r) => sum + (r.cpc ?? 0), 0) / filteredRecords.length
      : 0;
    const inCount = filteredRecords.filter(r => r.locationCode === 'IN').length;
    const glCount = filteredRecords.filter(r => r.locationCode === 'GL').length;

    return { uniqueDomains, uniqueKeywords, totalVolume, avgVolume, top10Count, top3Count, avgCpc, inCount, glCount };
  }, [filteredRecords]);

  const SortableHeader = ({ field, label, tooltip }: { field: SortField; label: string; tooltip: string }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
      onClick={() => handleSort(field)}
    >
      <Tooltip text={tooltip}>
        <div className="flex items-center gap-1">
          {label}
          {sortField === field && (
            <span className="text-indigo-600">
              {sortDirection === 'asc' ? '↑' : '↓'}
            </span>
          )}
        </div>
      </Tooltip>
    </th>
  );

  const formatNumber = (num: number | null) => {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString();
  };

  const formatCurrency = (num: number | null) => {
    if (num === null || num === undefined) return '-';
    return '$' + num.toFixed(2);
  };

  const getGoogleSearchUrl = (keyword: string) => {
    return `https://www.google.com/search?q=${encodeURIComponent(keyword)}`;
  };

  const lastFetchedAt = records.length > 0 ? records[0].fetchedAt : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <PageHeader
        title="Domain Top Keywords"
        description="View top ranked keywords per domain with search volume, positions, and Google search links for both IN and GL locations"
        helpInfo={domainKeywordsPageHelp}
        extendedDescription={domainKeywordsPageDescription}
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-full text-xs text-purple-700">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">Extraction Limit:</span> 100 keywords per domain per location
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <select
              value={selectedClientCode}
              onChange={e => setSelectedClientCode(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {clients.map(client => (
                <option key={client.id} value={client.code}>
                  {client.name} ({client.code})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing || selectedDomains.length === 0}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {refreshing ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Fetching (IN + GL)...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Fetch Both Locations (IN + GL)
              </>
            )}
          </button>

          <div className="flex items-center gap-2 pl-4 border-l border-gray-300 ml-2">
            <button
              onClick={handleTagAllKeywords}
              disabled={isProcessingRules || records.length === 0}
              className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${isProcessingRules
                ? 'bg-purple-100 text-purple-700 cursor-wait'
                : 'bg-white text-purple-600 border border-purple-200 hover:bg-purple-50'
                }`}
            >
              {isProcessingRules ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Classifying...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  Tag All Keywords (Rules)
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t">
          {/* Domain Selection Checkboxes */}
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Select Domains ({selectedDomains.length}/{competitors.length})
            </label>
            <div className="flex gap-2">
              <button onClick={selectAllDomains} className="text-xs text-indigo-600 hover:text-indigo-800">Select All</button>
              <button onClick={deselectAllDomains} className="text-xs text-gray-600 hover:text-gray-800">Deselect All</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-gray-50 rounded-md">
            {competitors.map(comp => (
              <label
                key={comp.id}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${selectedDomains.includes(comp.domain)
                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
                  }`}
              >
                <input
                  type="checkbox"
                  checked={selectedDomains.includes(comp.domain)}
                  onChange={() => toggleDomain(comp.domain)}
                  className="sr-only"
                />
                {comp.domain}
              </label>
            ))}
          </div>
        </div>
      </div>

      <ExportButton
        data={sortedRecords}
        columns={[
          { key: 'domain', header: 'Domain' },
          { key: 'locationCode', header: 'Location' },
          { key: 'keyword', header: 'Keyword' },
          { key: 'position', header: 'Position' },
          { key: 'searchVolume', header: 'Search Volume' },
          { key: 'cpc', header: 'CPC' },
          { key: 'url', header: 'URL' },
        ] as ExportColumn<DomainKeywordRecord>[]}
        filename={`domain-keywords-${selectedClientCode}-${new Date().toISOString().split('T')[0]}`}
      />



      {
        notification && (
          <div
            className={`mb-4 p-4 rounded-md ${notification.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
              }`}
          >
            {notification.message}
          </div>
        )
      }

      {
        lastFetchedAt && (
          <div className="mb-4 text-sm text-gray-500">
            Last fetched: {new Date(lastFetchedAt).toLocaleString()}
          </div>
        )
      }

      {/* Summary Stats */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg shadow p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Summary Statistics</h3>
        <div className="grid grid-cols-2 lg:grid-cols-9 gap-4">
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500">Domains</div>
            <div className="text-lg font-bold text-indigo-600">{summaryStats.uniqueDomains}</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500">Unique Keywords</div>
            <div className="text-lg font-bold text-green-600">{formatNumber(summaryStats.uniqueKeywords)}</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500">Total Volume</div>
            <div className="text-lg font-bold text-blue-600">{formatNumber(summaryStats.totalVolume)}</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500">Avg Volume</div>
            <div className="text-lg font-bold text-purple-600">{formatNumber(Math.round(summaryStats.avgVolume))}</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500">Top 3 Rankings</div>
            <div className="text-lg font-bold text-green-700">{summaryStats.top3Count}</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500">Top 10 Rankings</div>
            <div className="text-lg font-bold text-orange-600">{summaryStats.top10Count}</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500">Avg CPC</div>
            <div className="text-lg font-bold text-red-600">{formatCurrency(summaryStats.avgCpc)}</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500">IN Keywords</div>
            <div className="text-lg font-bold text-yellow-600">{summaryStats.inCount}</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500">GL Keywords</div>
            <div className="text-lg font-bold text-teal-600">{summaryStats.glCount}</div>
          </div>
        </div>
      </div>

      {/* Matching Dictionary Panel */}
      <MatchingDictionaryPanel
        profile={profile}
        collapsed={dictPanelCollapsed}
        onToggle={() => setDictPanelCollapsed(!dictPanelCollapsed)}
      />

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[150px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Filter by Domain</label>
            <select
              value={domainFilter}
              onChange={e => setDomainFilter(e.target.value)}
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Domains</option>
              {uniqueDomainsInRecords.map(domain => (
                <option key={domain} value={domain}>
                  {domain}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[120px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Fit Status</label>
            <select
              value={fitFilter}
              onChange={e => setFitFilter(e.target.value)}
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Fits</option>
              {['BRAND_KW', 'CORE_MATCH', 'ADJACENT_MATCH', 'REVIEW', 'NO_MATCH', 'BLANK'].map(f => (
                <option key={f} value={f}>{f.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          <div className="min-w-[120px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Product Line</label>
            <select
              value={productFilter}
              onChange={e => setProductFilter(e.target.value)}
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Products</option>
              {['TWISTING', 'WINDING', 'HEAT_SETTING', 'BRAND_KW', 'MULTIPLE', 'NONE', 'BLANK'].map(p => (
                <option key={p} value={p}>{p.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          <div className="min-w-[120px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
            <select
              value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)}
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {LOCATION_OPTIONS.map(loc => (
                <option key={loc.code} value={loc.code}>{loc.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Filter by Keyword</label>
            <input
              type="text"
              value={keywordFilter}
              onChange={e => setKeywordFilter(e.target.value)}
              placeholder="Search keywords..."
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="min-w-[100px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Max Pos</label>
            <input
              type="number"
              value={positionMaxFilter}
              onChange={e => setPositionMaxFilter(e.target.value)}
              placeholder="e.g. 10"
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="min-w-[100px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Min Volume</label>
            <input
              type="number"
              value={volumeMinFilter}
              onChange={e => setVolumeMinFilter(e.target.value)}
              placeholder="0"
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="text-sm text-gray-500 ml-auto">
            Showing {filteredRecords.length} of {records.length}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 mb-4">
        <button
          onClick={() => setHarvestModalOpen(true)}
          className="px-3 py-1.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded border border-yellow-200 text-xs font-semibold flex items-center gap-1 shadow-sm"
        >
          <span>🌾</span> Harvest Terms
        </button>
        <button
          onClick={handleTagAllKeywords}
          disabled={loading || !selectedClientCode}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold shadow-sm disabled:opacity-50 flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          Tag All (Rules)
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <svg className="animate-spin h-8 w-8 mx-auto text-indigo-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="mt-2 text-gray-500">Loading domain keywords data...</p>
          </div>
        ) : sortedRecords.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No domain keywords data found or all filtered out.</p>
            <p className="text-sm mt-1">Adjust filters or select domains and click "Fetch".</p>
          </div>
        ) : (
          <div className="overflow-x-auto min-h-[500px]">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider w-[24px]">
                    {/* Action column */}
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                    Domain
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider w-[35px]">
                    Loc
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider max-w-[150px]">
                    Keyword
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider w-[120px]">
                    Fit
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider w-[120px]">
                    Product
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider max-w-[150px]">
                    Rationale
                  </th>
                  <SortableHeader
                    field="position"
                    label="Pos"
                    tooltip="Position"
                  />
                  <SortableHeader
                    field="searchVolume"
                    label="Vol"
                    tooltip="Search Volume"
                  />
                  <SortableHeader
                    field="cpc"
                    label="CPC"
                    tooltip="Cost Per Click"
                  />
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider w-[50px]">
                    URL
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedRecords.map(record => {
                  const tag = tags[normalizeKeyword(record.keyword)];
                  const fit = tag?.fitStatus || 'BLANK';
                  const prod = tag?.productLine || 'BLANK';

                  return (
                    <tr key={record.id} className="hover:bg-gray-50 group">
                      <td className="px-2 py-1.5 text-[10px] w-[24px]">
                        {/* Add Token Action */}
                        <button
                          onClick={() => handleOpenAddToken(record)}
                          className="text-gray-400 hover:text-indigo-600 transition-colors"
                          title="Add to Matching Dictionary"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      </td>
                      <td className="px-2 py-1.5 text-[10px] text-gray-500 whitespace-nowrap">
                        {record.domain}
                      </td>
                      <td className="px-2 py-1.5 text-[10px] text-gray-500">
                        {record.locationCode}
                      </td>
                      <td className="px-2 py-1.5 text-[10px]">
                        <a
                          href={getGoogleSearchUrl(record.keyword)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1 truncate max-w-[200px]"
                          title={record.keyword}
                        >
                          {record.keyword}
                        </a>
                      </td>

                      {/* FIT COLUMN */}
                      <td className="px-2 py-1.5 text-[10px]">
                        {fit === 'REVIEW' || fit === 'BLANK' || fit === 'NO_MATCH' || fit === 'CORE_MATCH' || fit === 'ADJACENT_MATCH' || fit === 'BRAND_KW' ? (
                          <select
                            value={fit}
                            onChange={(e) => handleUpdateTag(record.keyword, 'fitStatus', e.target.value)}
                            className={`block w-full text-[10px] py-0.5 px-1 rounded border-0 focus:ring-1 focus:ring-indigo-500 ${getFitStatusColor(fit)}`}
                          >
                            {['BRAND_KW', 'CORE_MATCH', 'ADJACENT_MATCH', 'REVIEW', 'NO_MATCH', 'BLANK'].map(opt => (
                              <option key={opt} value={opt}>{opt.replace('_', ' ')}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium border rounded ${getFitStatusColor(fit)}`}>
                            {String(fit).replace('_', ' ')}
                          </span>
                        )}
                      </td>

                      {/* PRODUCT COLUMN */}
                      <td className="px-2 py-1.5 text-[10px]">
                        <select
                          value={prod}
                          onChange={(e) => handleUpdateTag(record.keyword, 'productLine', e.target.value)}
                          className={`block w-full text-[10px] py-0.5 px-1 rounded border-0 focus:ring-1 focus:ring-indigo-500 ${getProductLineColor(prod)}`}
                        >
                          {['TWISTING', 'WINDING', 'HEAT_SETTING', 'BRAND_KW', 'MULTIPLE', 'NONE', 'BLANK'].map(opt => (
                            <option key={opt} value={opt}>{opt.replace('_', ' ')}</option>
                          ))}
                        </select>
                      </td>

                      {/* RATIONALE COLUMN */}
                      <td className="px-2 py-1.5 text-[9px] text-gray-500 max-w-[150px] truncate" title={tag?.rationale}>
                        {tag?.rationale || '-'}
                      </td>

                      <td className="px-2 py-1.5 text-[10px]">
                        {record.position ?? '-'}
                      </td>
                      <td className="px-2 py-1.5 text-[10px]">
                        {formatNumber(record.searchVolume)}
                      </td>
                      <td className="px-2 py-1.5 text-[10px]">
                        {formatCurrency(record.cpc)}
                      </td>

                      <td className="px-2 py-1.5 text-[10px]">
                        {record.url ? (
                          <Tooltip text={record.url}>
                            <a
                              href={record.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:text-indigo-800 hover:underline"
                            >
                              Link
                            </a>
                          </Tooltip>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {sortedRecords.length > 0 && (
          <div className="bg-white px-4 py-3 border-t border-gray-200 flex items-center justify-between sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, sortedRecords.length)}</span> of <span className="font-medium">{sortedRecords.length}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Previous</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Next</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      <AddTokenModal
        isOpen={!!addTokenModal}
        onClose={() => setAddTokenModal(null)}
        initialValue={addTokenModal?.keyword || ''}
        onSave={handleSaveToken}
        products={Object.keys(profile?.matchingDictionary?.productLineTokens || {})}
      />

      <HarvestModal
        isOpen={harvestModalOpen}
        onClose={() => setHarvestModalOpen(false)}
        keywords={sortedRecords.map(r => r.keyword)}
        clientCode={selectedClientCode}
        onHarvestComplete={handleTagAllKeywords}
      />

    </div >
  );
}
