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

interface KeywordApiDataRecord {
  id: string;
  clientCode: string;
  keywordText: string;
  normalizedKeyword: string;
  searchVolume: number | null;
  cpc: number | null;
  competition: string | null;
  lowTopOfPageBid: number | null;
  highTopOfPageBid: number | null;
  locationCode: number;
  languageCode: string;
  sourceApi: string;
  snapshotDate: string;
  lastPulledAt: string;
}

interface SerpResultWithVolume extends SerpResult {
  searchVolume: number | null;
}

interface GroupedKeywordResult {
  keyword: string;
  locationCode: number;
  searchVolume: number | null;
  resultCount: number;
  avgRank: number;
  topDomain: string;
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

type SortField = 'rank' | 'rankAbsolute' | 'searchVolume' | null;
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
  const [keywordApiData, setKeywordApiData] = useState<KeywordApiDataRecord[]>([]);
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
  const [minSearchVolume, setMinSearchVolume] = useState<string>('');
  const [maxSearchVolume, setMaxSearchVolume] = useState<string>('');

  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [groupByKeyword, setGroupByKeyword] = useState(false);

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
      const [serpRes, keywordRes] = await Promise.all([
        fetch(`/api/seo/serp?clientCode=${selectedClientCode}&locationCodes=${selectedLocationCodes.join(',')}`),
        fetch(`/api/seo/keywords?clientCode=${selectedClientCode}&locationCodes=${selectedLocationCodes.join(',')}`)
      ]);
      
      if (!serpRes.ok) {
        console.error('Failed to fetch SERP data:', serpRes.status);
        setRecords([]);
        setKeywordApiData([]);
        return;
      }
      
      const serpData = await serpRes.json();
      setRecords(serpData);
      
      if (keywordRes.ok) {
        const keywordData = await keywordRes.json();
        if (Array.isArray(keywordData)) {
          setKeywordApiData(keywordData);
        } else {
          setKeywordApiData([]);
        }
      } else {
        setKeywordApiData([]);
      }
    } catch (error) {
      console.error('Failed to fetch SERP data:', error);
      setRecords([]);
      setKeywordApiData([]);
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

  const normalizeKeyword = (keyword: string): string => {
    return keyword.trim().replace(/\s+/g, ' ').toLowerCase();
  };

  const searchVolumeMap = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const kw of keywordApiData) {
      const normalizedKey = kw.normalizedKeyword || normalizeKeyword(kw.keywordText);
      const key = `${normalizedKey}|${kw.locationCode}`;
      map.set(key, kw.searchVolume);
    }
    return map;
  }, [keywordApiData]);

  const recordsWithVolume: SerpResultWithVolume[] = useMemo(() => {
    return records.map(r => {
      const normalizedKw = normalizeKeyword(r.keyword);
      const key = `${normalizedKw}|${r.locationCode}`;
      return {
        ...r,
        searchVolume: searchVolumeMap.get(key) ?? null
      };
    });
  }, [records, searchVolumeMap]);

  const filteredRecordsBase = useMemo(() => {
    return recordsWithVolume.filter(record => {
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
      const minSV = minSearchVolume ? parseInt(minSearchVolume, 10) : null;
      const maxSV = maxSearchVolume ? parseInt(maxSearchVolume, 10) : null;
      if (minSV !== null && (record.searchVolume === null || record.searchVolume < minSV)) {
        return false;
      }
      if (maxSV !== null && (record.searchVolume === null || record.searchVolume > maxSV)) {
        return false;
      }
      return true;
    });
  }, [recordsWithVolume, keywordFilter, domainFilter, locationFilter, minRank, maxRank, minSearchVolume, maxSearchVolume]);

  const filteredRecords = useMemo(() => {
    const result = [...filteredRecordsBase];
    
    if (sortField && !groupByKeyword) {
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
  }, [filteredRecordsBase, sortField, sortDirection, groupByKeyword]);

  const groupedResults: GroupedKeywordResult[] = useMemo(() => {
    if (!groupByKeyword) return [];

    const groups = new Map<string, SerpResultWithVolume[]>();
    for (const r of filteredRecordsBase) {
      const key = `${r.keyword}|${r.locationCode}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(r);
    }

    const result: GroupedKeywordResult[] = [];
    groups.forEach((items, key) => {
      const [keyword] = key.split('|');
      const locationCode = items[0].locationCode;
      const searchVolume = items[0].searchVolume;
      const avgRank = items.reduce((sum, i) => sum + i.rank, 0) / items.length;
      const topResult = items.reduce((top, i) => i.rank < top.rank ? i : top, items[0]);
      result.push({
        keyword,
        locationCode,
        searchVolume,
        resultCount: items.length,
        avgRank: Math.round(avgRank * 10) / 10,
        topDomain: topResult.domain,
        fetchedAt: topResult.fetchedAt,
      });
    });

    if (sortField === 'searchVolume') {
      result.sort((a, b) => {
        if (a.searchVolume === null && b.searchVolume === null) return 0;
        if (a.searchVolume === null) return 1;
        if (b.searchVolume === null) return -1;
        const comparison = a.searchVolume - b.searchVolume;
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    } else {
      result.sort((a, b) => a.keyword.localeCompare(b.keyword) || a.locationCode - b.locationCode);
    }

    return result;
  }, [filteredRecordsBase, groupByKeyword, sortField, sortDirection]);

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

  const hasFilters = keywordFilter || domainFilter || locationFilter !== 'all' || minRank || maxRank || minSearchVolume || maxSearchVolume;

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
            <p className="font-medium text-gray-800">{groupByKeyword ? groupedResults.length : filteredRecords.length} of {records.length}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-700">Filters</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-gray-600">Group by Keyword + Location</span>
            <button
              onClick={() => setGroupByKeyword(!groupByKeyword)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                groupByKeyword ? 'bg-indigo-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  groupByKeyword ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </label>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
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
            <label className="block text-[10px] text-gray-500 mb-1">Min Search Vol</label>
            <input
              type="number"
              value={minSearchVolume}
              onChange={(e) => setMinSearchVolume(e.target.value)}
              placeholder="Min"
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Max Search Vol</label>
            <input
              type="number"
              value={maxSearchVolume}
              onChange={(e) => setMaxSearchVolume(e.target.value)}
              placeholder="Max"
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
        {hasFilters && (
          <button
            onClick={() => {
              setKeywordFilter('');
              setDomainFilter('');
              setLocationFilter('all');
              setMinRank('');
              setMaxRank('');
              setMinSearchVolume('');
              setMaxSearchVolume('');
            }}
            className="mt-2 text-xs text-indigo-600 hover:text-indigo-800"
          >
            Clear all filters
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="overflow-auto max-h-[600px]">
          {groupByKeyword ? (
            <table className="w-full table-fixed">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="w-[5%] text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2 bg-gray-50">S.No</th>
                  <th className="w-[30%] text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2 bg-gray-50">Keyword</th>
                  <th className="w-[10%] text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2 bg-gray-50">
                    <Tooltip text="Location/region for the search (IN = India, GL = Global/US)">
                      <span className="cursor-help border-b border-dashed border-gray-400">Scope</span>
                    </Tooltip>
                  </th>
                  <th className="w-[12%] text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2 bg-gray-50">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip text="Monthly search volume from Keyword API Data">
                        <span className="cursor-help border-b border-dashed border-gray-400">Search Vol</span>
                      </Tooltip>
                      <button
                        onClick={() => handleSort('searchVolume')}
                        className="ml-1 text-gray-400 hover:text-indigo-600 focus:outline-none"
                        title="Sort by Search Volume"
                      >
                        {getSortIcon('searchVolume') || '⇅'}
                      </button>
                    </div>
                  </th>
                  <th className="w-[10%] text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2 bg-gray-50">
                    <Tooltip text="Number of SERP results found for this keyword">
                      <span className="cursor-help border-b border-dashed border-gray-400">Results</span>
                    </Tooltip>
                  </th>
                  <th className="w-[10%] text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2 bg-gray-50">
                    <Tooltip text="Average rank position across all results">
                      <span className="cursor-help border-b border-dashed border-gray-400">Avg Rank</span>
                    </Tooltip>
                  </th>
                  <th className="w-[15%] text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2 bg-gray-50">
                    <Tooltip text="Domain with the highest rank (position 1)">
                      <span className="cursor-help border-b border-dashed border-gray-400">Top Domain</span>
                    </Tooltip>
                  </th>
                  <th className="w-[8%] text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2 bg-gray-50">
                    <Tooltip text="Date and time when the SERP data was fetched">
                      <span className="cursor-help border-b border-dashed border-gray-400">Date</span>
                    </Tooltip>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-500 text-sm">
                      Loading...
                    </td>
                  </tr>
                ) : groupedResults.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-500 text-sm">
                      No SERP results found. Click "Refresh SERP data from API" to fetch data.
                    </td>
                  </tr>
                ) : (
                  groupedResults.map((group, index) => (
                    <tr key={`${group.keyword}|${group.locationCode}`} className="hover:bg-gray-50">
                      <td className="py-2 px-2 text-xs text-gray-500">{index + 1}</td>
                      <td className="py-2 px-2 text-xs text-gray-900 font-medium truncate" title={group.keyword}>
                        {group.keyword}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-600">
                        {getLocationLabel(group.locationCode)}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-600 text-right">
                        {group.searchVolume?.toLocaleString() ?? '-'}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-600 text-right">
                        {group.resultCount}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-600 text-right">
                        {group.avgRank}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-900 truncate" title={group.topDomain}>
                        {group.topDomain}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-600 truncate">
                        {formatDate(group.fetchedAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full table-fixed">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="w-[4%] text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2 bg-gray-50">S.No</th>
                  <th className="w-[12%] text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2 bg-gray-50">Keyword</th>
                  <th className="w-[5%] text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2 bg-gray-50">
                    <Tooltip text="Location/region for the search (IN = India, GL = Global/US)">
                      <span className="cursor-help border-b border-dashed border-gray-400">Scope</span>
                    </Tooltip>
                  </th>
                  <th className="w-[8%] text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2 bg-gray-50">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip text="Monthly search volume from Keyword API Data">
                        <span className="cursor-help border-b border-dashed border-gray-400">Search Vol</span>
                      </Tooltip>
                      <button
                        onClick={() => handleSort('searchVolume')}
                        className="ml-1 text-gray-400 hover:text-indigo-600 focus:outline-none"
                        title="Sort by Search Volume"
                      >
                        {getSortIcon('searchVolume') || '⇅'}
                      </button>
                    </div>
                  </th>
                  <th className="w-[5%] text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2 bg-gray-50">
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
                  <th className="w-[6%] text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2 bg-gray-50">
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
                  <th className="w-[10%] text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2 bg-gray-50">Domain</th>
                  <th className="w-[14%] text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2 bg-gray-50">URL</th>
                  <th className="w-[12%] text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2 bg-gray-50">Title</th>
                  <th className="w-[14%] text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2 bg-gray-50">
                    <Tooltip text="Meta description / snippet shown in search results">
                      <span className="cursor-help border-b border-dashed border-gray-400">Snippet</span>
                    </Tooltip>
                  </th>
                  <th className="w-[6%] text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider py-2 px-2 bg-gray-50">
                    <Tooltip text="Date and time when the SERP data was fetched">
                      <span className="cursor-help border-b border-dashed border-gray-400">Date</span>
                    </Tooltip>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="text-center py-8 text-gray-500 text-sm">
                      Loading...
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-8 text-gray-500 text-sm">
                      No SERP results found. Click "Refresh SERP data from API" to fetch data.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record, index) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="py-2 px-2 text-xs text-gray-500">{index + 1}</td>
                      <td className="py-2 px-2 text-xs text-gray-900 font-medium truncate" title={record.keyword}>
                        {record.keyword}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-600 truncate">
                        {getLocationLabel(record.locationCode)}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-600 text-right">
                        {record.searchVolume?.toLocaleString() ?? '-'}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-900 text-right font-medium truncate">
                        {record.rank}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-600 text-right truncate">
                        {record.rankAbsolute}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-900 truncate" title={record.domain}>
                        {record.domain}
                      </td>
                      <td className="py-2 px-2 text-xs text-blue-600 truncate">
                        <a 
                          href={record.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:underline truncate block"
                          title={record.url}
                        >
                          {record.url}
                        </a>
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-900 truncate" title={record.title}>
                        {record.title}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-600 truncate" title={record.description}>
                        {record.description}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-600 truncate">
                        {formatDate(record.fetchedAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
