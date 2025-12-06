'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PageHeader from '@/components/PageHeader';

interface Client {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface SerpResult {
  id: string;
  clientCode: string;
  keyword: string;
  locationCode: number;
  languageCode: string;
  rank: number;
  rankAbsolute: number;
  url: string;
  title: string;
  description: string;
  domain: string;
  breadcrumb: string | null;
  isFeaturedSnippet: boolean;
  isImage: boolean;
  isVideo: boolean;
  highlighted: string[];
  etv: number | null;
  estimatedPaidTrafficCost: number | null;
  fetchedAt: string;
}

interface LocationStats {
  keywordsProcessed: number;
  resultsCreated: number;
}

interface RefreshStats {
  [locationCode: string]: LocationStats;
}

const LOCATION_OPTIONS = [
  { code: 'IN', numericCode: 2356, label: 'India (IN)' },
  { code: 'GL', numericCode: 2840, label: 'Global (GL)' },
];

const LOCATION_CODE_MAP: Record<number, string> = {
  2356: 'IN',
  2840: 'GL',
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

type SortField = 'rank' | 'rankAbsolute' | 'etv' | 'estimatedPaidTrafficCost' | null;
type SortDirection = 'asc' | 'desc';

interface ProgressState {
  isActive: boolean;
  percent: number;
  completedTasks: number;
  totalTasks: number;
  currentLocation: string;
  currentKeyword: string;
  keywordIndex: number;
  totalKeywords: number;
  resultsCollected: number;
}

export default function SerpResultsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientCode, setSelectedClientCode] = useState<string>('');
  const [selectedLocationCodes, setSelectedLocationCodes] = useState<string[]>(['IN', 'GL']);
  const [records, setRecords] = useState<SerpResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [refreshStats, setRefreshStats] = useState<RefreshStats | null>(null);
  const [progress, setProgress] = useState<ProgressState>({
    isActive: false,
    percent: 0,
    completedTasks: 0,
    totalTasks: 0,
    currentLocation: '',
    currentKeyword: '',
    keywordIndex: 0,
    totalKeywords: 0,
    resultsCollected: 0,
  });

  const [keywordFilter, setKeywordFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [minRank, setMinRank] = useState<string>('');
  const [maxRank, setMaxRank] = useState<string>('');
  const [featuredSnippetFilter, setFeaturedSnippetFilter] = useState<string>('all');

  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    fetchClients();
  }, []);

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

  const fetchRecords = useCallback(async () => {
    if (!selectedClientCode || selectedLocationCodes.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/seo/serp?clientCode=${selectedClientCode}&locationCodes=${selectedLocationCodes.join(',')}`
      );
      const data = await res.json();
      setRecords(data);
    } catch (error) {
      console.error('Failed to fetch SERP data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedClientCode, selectedLocationCodes]);

  useEffect(() => {
    if (selectedClientCode && selectedLocationCodes.length > 0) {
      fetchRecords();
    }
  }, [selectedClientCode, selectedLocationCodes, fetchRecords]);

  const toggleLocation = (code: string) => {
    setSelectedLocationCodes(prev => {
      if (prev.includes(code)) {
        if (prev.length === 1) return prev;
        return prev.filter(c => c !== code);
      }
      return [...prev, code];
    });
  };

  const handleRefresh = async () => {
    if (!selectedClientCode || selectedLocationCodes.length === 0) return;
    setRefreshing(true);
    setNotification(null);
    setRefreshStats(null);
    setProgress({
      isActive: true,
      percent: 0,
      completedTasks: 0,
      totalTasks: 0,
      currentLocation: '',
      currentKeyword: '',
      keywordIndex: 0,
      totalKeywords: 0,
      resultsCollected: 0,
    });
    
    try {
      const res = await fetch('/api/seo/serp/fetch-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientCode: selectedClientCode,
          locationCodes: selectedLocationCodes,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setNotification({ type: 'error', message: errorData.error || 'Failed to fetch SERP data' });
        setProgress(prev => ({ ...prev, isActive: false }));
        setRefreshing(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        setNotification({ type: 'error', message: 'Streaming not supported' });
        setProgress(prev => ({ ...prev, isActive: false }));
        setRefreshing(false);
        return;
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'start') {
                setProgress(prev => ({
                  ...prev,
                  totalTasks: data.totalTasks,
                  totalKeywords: data.totalKeywords,
                }));
              } else if (data.type === 'progress') {
                setProgress(prev => ({
                  ...prev,
                  percent: data.percent,
                  completedTasks: data.completedTasks,
                  totalTasks: data.totalTasks,
                  currentLocation: data.currentLocation,
                  currentKeyword: data.currentKeyword,
                  keywordIndex: data.keywordIndex,
                  totalKeywords: data.totalKeywords,
                  resultsCollected: data.resultsCollected,
                }));
              } else if (data.type === 'complete') {
                const timestamp = new Date().toLocaleString();
                setNotification({ 
                  type: 'success', 
                  message: `SERP data refreshed successfully at ${timestamp}. Total ${data.totalResults} results fetched.`
                });
                if (data.stats) {
                  setRefreshStats(data.stats);
                }
                setProgress(prev => ({ ...prev, isActive: false, percent: 100 }));
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      setNotification({ type: 'error', message: 'Network error while fetching SERP data' });
      setProgress(prev => ({ ...prev, isActive: false }));
    }
    
    await fetchRecords();
    setRefreshing(false);
  };

  const getLastRefreshed = () => {
    if (records.length === 0) return 'Never';
    const sorted = [...records].sort(
      (a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime()
    );
    const date = new Date(sorted[0].fetchedAt);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const selectedClientName = clients.find(c => c.code === selectedClientCode)?.name || '';

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const filteredRecords = useMemo(() => {
    let result = records.filter(record => {
      if (keywordFilter && !record.keyword.toLowerCase().includes(keywordFilter.toLowerCase())) {
        return false;
      }
      if (domainFilter && !record.domain.toLowerCase().includes(domainFilter.toLowerCase())) {
        return false;
      }
      if (locationFilter !== 'all') {
        const numericLoc = LOCATION_OPTIONS.find(l => l.code === locationFilter)?.numericCode;
        if (numericLoc && record.locationCode !== numericLoc) {
          return false;
        }
      }
      const minR = minRank ? parseInt(minRank, 10) : null;
      const maxR = maxRank ? parseInt(maxRank, 10) : null;
      if (minR !== null && record.rank < minR) {
        return false;
      }
      if (maxR !== null && record.rank > maxR) {
        return false;
      }
      if (featuredSnippetFilter === 'yes' && !record.isFeaturedSnippet) {
        return false;
      }
      if (featuredSnippetFilter === 'no' && record.isFeaturedSnippet) {
        return false;
      }
      return true;
    });

    if (sortField) {
      result.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1;
        if (bVal === null) return -1;
        const comparison = (aVal as number) - (bVal as number);
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [records, keywordFilter, domainFilter, locationFilter, minRank, maxRank, featuredSnippetFilter, sortField, sortDirection]);

  const getLocationStats = (numericCode: number) => {
    const locRecords = records.filter(r => r.locationCode === numericCode);
    const uniqueKeywords = new Set(locRecords.map(r => r.keyword));
    return {
      total: locRecords.length,
      keywords: uniqueKeywords.size,
    };
  };

  const getLocationLabel = (numericCode: number): string => {
    return LOCATION_CODE_MAP[numericCode] || String(numericCode);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const truncateText = (text: string, maxLen: number) => {
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen) + '...';
  };

  return (
    <div className="max-w-[1600px] mx-auto p-4">
      <PageHeader
        title="SERP Results"
        description="Google organic search results for your keywords (top 10 per keyword)"
      />

      <div className="bg-white rounded-lg shadow-sm border p-4 mb-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <select
              value={selectedClientCode}
              onChange={(e) => setSelectedClientCode(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {clients.map((client) => (
                <option key={client.id} value={client.code}>
                  {client.code} - {client.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <div className="flex gap-4 py-2">
              {LOCATION_OPTIONS.map((loc) => (
                <label key={loc.code} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedLocationCodes.includes(loc.code)}
                    onChange={() => toggleLocation(loc.code)}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">{loc.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <button
              onClick={handleRefresh}
              disabled={refreshing || !selectedClientCode}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
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
                'Refresh SERP data from API (overwrite old)'
              )}
            </button>
          </div>
        </div>
      </div>

      {notification && (
        <div
          className={`mb-4 p-3 rounded-md text-sm ${
            notification.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {notification.message}
        </div>
      )}

      {progress.isActive && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-indigo-800">
              Fetching SERP Data...
            </p>
            <span className="text-sm font-bold text-indigo-600">{progress.percent}%</span>
          </div>
          
          <div className="w-full bg-indigo-100 rounded-full h-3 mb-3 overflow-hidden">
            <div 
              className="bg-indigo-600 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-white rounded p-2 border border-indigo-100">
              <p className="text-gray-500">Progress</p>
              <p className="font-semibold text-gray-800">
                {progress.completedTasks} / {progress.totalTasks} tasks
              </p>
            </div>
            <div className="bg-white rounded p-2 border border-indigo-100">
              <p className="text-gray-500">Location</p>
              <p className="font-semibold text-gray-800">
                {progress.currentLocation === 'IN' ? 'India (IN)' : progress.currentLocation === 'GL' ? 'Global (GL)' : progress.currentLocation || '-'}
              </p>
            </div>
            <div className="bg-white rounded p-2 border border-indigo-100">
              <p className="text-gray-500">Keyword</p>
              <p className="font-semibold text-gray-800">
                {progress.keywordIndex} / {progress.totalKeywords}
              </p>
            </div>
            <div className="bg-white rounded p-2 border border-indigo-100">
              <p className="text-gray-500">Results Collected</p>
              <p className="font-semibold text-green-600">
                {progress.resultsCollected}
              </p>
            </div>
          </div>
          
          {progress.currentKeyword && (
            <div className="mt-3 text-xs text-indigo-700">
              <span className="font-medium">Current keyword:</span>{' '}
              <span className="italic">{progress.currentKeyword.length > 50 ? progress.currentKeyword.substring(0, 50) + '...' : progress.currentKeyword}</span>
            </div>
          )}
        </div>
      )}

      {refreshStats && Object.keys(refreshStats).length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-xs font-medium text-blue-800 mb-2">Last Refresh Summary</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(refreshStats).map(([loc, stats]) => (
              <div key={loc} className="bg-white rounded p-2 border border-blue-100">
                <p className="text-xs font-semibold text-gray-700 mb-1">
                  {loc === 'IN' ? 'India (IN)' : loc === 'GL' ? 'Global (GL)' : loc}
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-gray-600">
                  <span>Keywords processed:</span>
                  <span className="font-medium text-gray-800">{stats.keywordsProcessed}</span>
                  <span>Results created:</span>
                  <span className="font-medium text-green-600">{stats.resultsCreated}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg border p-3 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {LOCATION_OPTIONS.map(loc => {
            const stats = getLocationStats(loc.numericCode);
            return (
              <div key={loc.code} className="flex items-center gap-4 text-xs">
                <span className="font-semibold text-gray-700 w-20">{loc.label}</span>
                <div className="flex gap-4 text-gray-600">
                  <span>Results: <span className="font-medium text-gray-800">{stats.total}</span></span>
                  <span>Keywords: <span className="font-medium text-gray-800">{stats.keywords}</span></span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t border-gray-200 mt-3 pt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-gray-500">Client:</span>
            <p className="font-medium text-gray-800">{selectedClientName || '-'}</p>
          </div>
          <div>
            <span className="text-gray-500">Last Refreshed:</span>
            <p className="font-medium text-gray-800">{getLastRefreshed()}</p>
          </div>
          <div>
            <span className="text-gray-500">Total Results:</span>
            <p className="font-medium text-gray-800">{records.length}</p>
          </div>
          <div>
            <span className="text-gray-500">Showing:</span>
            <p className="font-medium text-gray-800">{filteredRecords.length} of {records.length}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-3 mb-4">
        <p className="text-xs font-medium text-gray-700 mb-2">Filters</p>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Keyword Search</label>
            <input
              type="text"
              value={keywordFilter}
              onChange={(e) => setKeywordFilter(e.target.value)}
              placeholder="Filter by keyword..."
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Domain Search</label>
            <input
              type="text"
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              placeholder="Filter by domain..."
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Location</label>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Locations</option>
              <option value="IN">India (IN)</option>
              <option value="GL">Global (GL)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Min Rank</label>
            <input
              type="number"
              value={minRank}
              onChange={(e) => setMinRank(e.target.value)}
              placeholder="Min"
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Max Rank</label>
            <input
              type="number"
              value={maxRank}
              onChange={(e) => setMaxRank(e.target.value)}
              placeholder="Max"
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Featured Snippet</label>
            <select
              value={featuredSnippetFilter}
              onChange={(e) => setFeaturedSnippetFilter(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>
        {(keywordFilter || domainFilter || locationFilter !== 'all' || minRank || maxRank || featuredSnippetFilter !== 'all') && (
          <button
            onClick={() => {
              setKeywordFilter('');
              setDomainFilter('');
              setLocationFilter('all');
              setMinRank('');
              setMaxRank('');
              setFeaturedSnippetFilter('all');
            }}
            className="mt-2 text-xs text-indigo-600 hover:text-indigo-800"
          >
            Clear all filters
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="min-w-full">
            <thead className="bg-gray-50 sticky top-0 z-10 overflow-visible">
              <tr>
                <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2">
                  <Tooltip text="Date and time when the SERP data was fetched">
                    <span className="cursor-help border-b border-dashed border-gray-400">Date</span>
                  </Tooltip>
                </th>
                <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2">Keyword</th>
                <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2">
                  <Tooltip text="Location/region for the search (IN = India, GL = Global/US)">
                    <span className="cursor-help border-b border-dashed border-gray-400">Scope</span>
                  </Tooltip>
                </th>
                <th className="text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip text="Position within organic results (1-10)">
                      <span className="cursor-help border-b border-dashed border-gray-400">Rank</span>
                    </Tooltip>
                    <button
                      onClick={() => handleSort('rank')}
                      className="ml-1 text-gray-400 hover:text-indigo-600 focus:outline-none"
                      title="Sort by Rank"
                    >
                      {getSortIcon('rank') || '⇅'}
                    </button>
                  </div>
                </th>
                <th className="text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip text="Absolute position including all SERP elements (ads, featured snippets, etc.)">
                      <span className="cursor-help border-b border-dashed border-gray-400">Abs Rank</span>
                    </Tooltip>
                    <button
                      onClick={() => handleSort('rankAbsolute')}
                      className="ml-1 text-gray-400 hover:text-indigo-600 focus:outline-none"
                      title="Sort by Absolute Rank"
                    >
                      {getSortIcon('rankAbsolute') || '⇅'}
                    </button>
                  </div>
                </th>
                <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2">Domain</th>
                <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2 max-w-[200px]">URL</th>
                <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2 max-w-[200px]">Title</th>
                <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2 max-w-[250px]">
                  <Tooltip text="Meta description / snippet shown in search results">
                    <span className="cursor-help border-b border-dashed border-gray-400">Snippet</span>
                  </Tooltip>
                </th>
                <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2">
                  <Tooltip text="Breadcrumb URL path shown in SERP">
                    <span className="cursor-help border-b border-dashed border-gray-400">Breadcrumb</span>
                  </Tooltip>
                </th>
                <th className="text-center text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2">
                  <Tooltip text="Whether this result is a featured snippet">
                    <span className="cursor-help border-b border-dashed border-gray-400">FS</span>
                  </Tooltip>
                </th>
                <th className="text-center text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2">
                  <Tooltip text="Whether result includes an image">
                    <span className="cursor-help border-b border-dashed border-gray-400">Img</span>
                  </Tooltip>
                </th>
                <th className="text-center text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2">
                  <Tooltip text="Whether result includes video">
                    <span className="cursor-help border-b border-dashed border-gray-400">Vid</span>
                  </Tooltip>
                </th>
                <th className="text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip text="Estimated Traffic Value - estimated value of organic traffic">
                      <span className="cursor-help border-b border-dashed border-gray-400">ETV</span>
                    </Tooltip>
                    <button
                      onClick={() => handleSort('etv')}
                      className="ml-1 text-gray-400 hover:text-indigo-600 focus:outline-none"
                      title="Sort by ETV"
                    >
                      {getSortIcon('etv') || '⇅'}
                    </button>
                  </div>
                </th>
                <th className="text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip text="Estimated cost if this organic traffic was paid for via ads">
                      <span className="cursor-help border-b border-dashed border-gray-400">Est. Cost</span>
                    </Tooltip>
                    <button
                      onClick={() => handleSort('estimatedPaidTrafficCost')}
                      className="ml-1 text-gray-400 hover:text-indigo-600 focus:outline-none"
                      title="Sort by Estimated Paid Traffic Cost"
                    >
                      {getSortIcon('estimatedPaidTrafficCost') || '⇅'}
                    </button>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={15} className="text-center py-8 text-gray-500 text-sm">
                    Loading...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={15} className="text-center py-8 text-gray-500 text-sm">
                    No SERP results found. Click "Refresh SERP data from API" to fetch data.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="py-2 px-2 text-xs text-gray-600 whitespace-nowrap">
                      {formatDate(record.fetchedAt)}
                    </td>
                    <td className="py-2 px-2 text-xs text-gray-900 font-medium">
                      {record.keyword}
                    </td>
                    <td className="py-2 px-2 text-xs text-gray-600">
                      {getLocationLabel(record.locationCode)}
                    </td>
                    <td className="py-2 px-2 text-xs text-gray-900 text-right font-medium">
                      {record.rank}
                    </td>
                    <td className="py-2 px-2 text-xs text-gray-600 text-right">
                      {record.rankAbsolute}
                    </td>
                    <td className="py-2 px-2 text-xs text-gray-900">
                      {record.domain}
                    </td>
                    <td className="py-2 px-2 text-xs text-blue-600 max-w-[200px]">
                      <a 
                        href={record.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:underline block truncate"
                        title={record.url}
                      >
                        {truncateText(record.url, 40)}
                      </a>
                    </td>
                    <td className="py-2 px-2 text-xs text-gray-900 max-w-[200px]">
                      <span className="block truncate" title={record.title}>
                        {truncateText(record.title, 50)}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-xs text-gray-600 max-w-[250px]">
                      <span className="block truncate" title={record.description}>
                        {truncateText(record.description, 60)}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-xs text-gray-500 max-w-[150px]">
                      <span className="block truncate" title={record.breadcrumb || ''}>
                        {record.breadcrumb ? truncateText(record.breadcrumb, 30) : '-'}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-xs text-center">
                      {record.isFeaturedSnippet ? (
                        <span className="text-green-600 font-medium">Yes</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-xs text-center">
                      {record.isImage ? (
                        <span className="text-blue-600">Yes</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-xs text-center">
                      {record.isVideo ? (
                        <span className="text-purple-600">Yes</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-xs text-gray-900 text-right">
                      {record.etv !== null ? record.etv.toFixed(2) : '-'}
                    </td>
                    <td className="py-2 px-2 text-xs text-gray-900 text-right">
                      {record.estimatedPaidTrafficCost !== null 
                        ? `$${record.estimatedPaidTrafficCost.toFixed(2)}` 
                        : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
