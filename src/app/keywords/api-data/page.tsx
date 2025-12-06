'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PageHeader from '@/components/PageHeader';

interface Client {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
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

interface LocationStats {
  originalKeywords: number;
  skippedKeywords: number;
  sanitizedKeywordsSent: number;
  recordsCreated: number;
  duplicatesRemoved: number;
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

type SortField = 'searchVolume' | 'cpc' | 'lowTopOfPageBid' | 'highTopOfPageBid' | null;
type SortDirection = 'asc' | 'desc';

export default function KeywordApiDataPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientCode, setSelectedClientCode] = useState<string>('');
  const [selectedLocationCodes, setSelectedLocationCodes] = useState<string[]>(['IN', 'GL']);
  const [records, setRecords] = useState<KeywordApiDataRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [apiLogs, setApiLogs] = useState<string[]>([]);
  const [selectedLogContent, setSelectedLogContent] = useState<string | null>(null);
  const [loadingLog, setLoadingLog] = useState(false);
  const [refreshStats, setRefreshStats] = useState<RefreshStats | null>(null);

  const [keywordFilter, setKeywordFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [compLevelFilter, setCompLevelFilter] = useState<string>('all');
  const [minSearchVolume, setMinSearchVolume] = useState<string>('');
  const [maxSearchVolume, setMaxSearchVolume] = useState<string>('');

  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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
        `/api/seo/keywords?clientCode=${selectedClientCode}&locationCodes=${selectedLocationCodes.join(',')}`
      );
      const data = await res.json();
      setRecords(data);
    } catch (error) {
      console.error('Failed to fetch keyword API data:', error);
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
    
    try {
      const res = await fetch('/api/seo/keywords/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientCode: selectedClientCode,
          locationCodes: selectedLocationCodes,
        }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        setNotification({ type: 'error', message: data.error || 'Failed to fetch keyword data' });
      } else {
        const timestamp = new Date().toLocaleString();
        setNotification({ 
          type: 'success', 
          message: `Keyword data refreshed successfully at ${timestamp}. Total ${data.count} records created.`
        });
        if (data.stats) {
          setRefreshStats(data.stats);
        }
      }
    } catch (error) {
      setNotification({ type: 'error', message: 'Network error while fetching keyword data' });
    }
    
    await fetchRecords();
    setRefreshing(false);
  };

  const getLastRefreshed = () => {
    if (records.length === 0) return 'Never';
    const sorted = [...records].sort(
      (a, b) => new Date(b.lastPulledAt).getTime() - new Date(a.lastPulledAt).getTime()
    );
    return new Date(sorted[0].lastPulledAt).toLocaleString();
  };

  const selectedClientName = clients.find(c => c.code === selectedClientCode)?.name || '';

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const filteredRecords = useMemo(() => {
    let result = records.filter(record => {
      if (keywordFilter && !record.keywordText.toLowerCase().includes(keywordFilter.toLowerCase())) {
        return false;
      }
      if (locationFilter !== 'all') {
        const numericLoc = LOCATION_OPTIONS.find(l => l.code === locationFilter)?.numericCode;
        if (numericLoc && record.locationCode !== numericLoc) {
          return false;
        }
      }
      if (compLevelFilter !== 'all') {
        if (compLevelFilter === 'none' && record.competition !== null) {
          return false;
        } else if (compLevelFilter !== 'none' && record.competition !== compLevelFilter) {
          return false;
        }
      }
      const minVol = minSearchVolume ? parseInt(minSearchVolume, 10) : null;
      const maxVol = maxSearchVolume ? parseInt(maxSearchVolume, 10) : null;
      if (minVol !== null && (record.searchVolume === null || record.searchVolume < minVol)) {
        return false;
      }
      if (maxVol !== null && (record.searchVolume === null || record.searchVolume > maxVol)) {
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
        const comparison = aVal - bVal;
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [records, keywordFilter, locationFilter, compLevelFilter, minSearchVolume, maxSearchVolume, sortField, sortDirection]);

  const getLocationStats = (numericCode: number) => {
    const locRecords = records.filter(r => r.locationCode === numericCode);
    return {
      total: locRecords.length,
    };
  };

  const fetchApiLogs = async () => {
    try {
      const res = await fetch('/api/seo/logs');
      const data = await res.json();
      setApiLogs(data.logs || []);
    } catch (error) {
      console.error('Failed to fetch API logs:', error);
    }
  };

  const viewLogContent = async (filename: string) => {
    setLoadingLog(true);
    try {
      const res = await fetch(`/api/seo/logs?filename=${encodeURIComponent(filename)}`);
      const data = await res.json();
      setSelectedLogContent(JSON.stringify(data.content, null, 2));
    } catch (error) {
      console.error('Failed to fetch log content:', error);
    } finally {
      setLoadingLog(false);
    }
  };

  const toggleLogs = () => {
    if (!showLogs) {
      fetchApiLogs();
    }
    setShowLogs(!showLogs);
    setSelectedLogContent(null);
  };

  const getLocationLabel = (numericCode: number): string => {
    return LOCATION_CODE_MAP[numericCode] || String(numericCode);
  };

  return (
    <div className="max-w-7xl mx-auto p-4">
      <PageHeader
        title="Keyword API Data"
        description="View keyword metrics fetched from SEO data providers"
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
                'Refresh keyword data from API (overwrite old)'
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
                  <span>Original keywords:</span>
                  <span className="font-medium text-gray-800">{stats.originalKeywords}</span>
                  <span>Skipped (invalid):</span>
                  <span className="font-medium text-orange-600">{stats.skippedKeywords}</span>
                  <span>Sent to API:</span>
                  <span className="font-medium text-gray-800">{stats.sanitizedKeywordsSent}</span>
                  <span>Records created:</span>
                  <span className="font-medium text-green-600">{stats.recordsCreated}</span>
                  <span>Duplicates removed:</span>
                  <span className="font-medium text-orange-600">{stats.duplicatesRemoved}</span>
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
                  <span>Total Records: <span className="font-medium text-gray-800">{stats.total}</span></span>
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
            <span className="text-gray-500">Total Records:</span>
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
            <label className="block text-[10px] text-gray-500 mb-1">Competition</label>
            <select
              value={compLevelFilter}
              onChange={(e) => setCompLevelFilter(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Levels</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
              <option value="none">No Data</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Min Search Volume</label>
            <input
              type="number"
              value={minSearchVolume}
              onChange={(e) => setMinSearchVolume(e.target.value)}
              placeholder="Min"
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Max Search Volume</label>
            <input
              type="number"
              value={maxSearchVolume}
              onChange={(e) => setMaxSearchVolume(e.target.value)}
              placeholder="Max"
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
        {(keywordFilter || locationFilter !== 'all' || compLevelFilter !== 'all' || minSearchVolume || maxSearchVolume) && (
          <button
            onClick={() => {
              setKeywordFilter('');
              setLocationFilter('all');
              setCompLevelFilter('all');
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
        <div className="overflow-x-auto overflow-y-visible">
          <table className="min-w-full">
            <thead className="bg-gray-50 sticky top-0 z-10 overflow-visible">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2">S.No</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2">Keyword</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip text="Monthly average search volume rate; represents the approximate number of searches for the given keyword on google.com or google.com and partners.">
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
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip text="Cost per click indicates the amount paid for each click on the ad displayed for a given keyword.">
                      <span className="cursor-help border-b border-dashed border-gray-400">CPC</span>
                    </Tooltip>
                    <button
                      onClick={() => handleSort('cpc')}
                      className="ml-1 text-gray-400 hover:text-indigo-600 focus:outline-none"
                      title="Sort by CPC"
                    >
                      {getSortIcon('cpc') || '⇅'}
                    </button>
                  </div>
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2">
                  <Tooltip text="Competition represents the relative amount of competition associated with the given keyword in paid SERP only; based on Google Ads data - HIGH, MEDIUM, or LOW.">
                    <span className="cursor-help border-b border-dashed border-gray-400">Competition</span>
                  </Tooltip>
                </th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip text="Minimum bid for the ad to be displayed at the top of the first page; indicates the value greater than about 20% of the lowest bids for which ads were displayed.">
                      <span className="cursor-help border-b border-dashed border-gray-400">Low Bid</span>
                    </Tooltip>
                    <button
                      onClick={() => handleSort('lowTopOfPageBid')}
                      className="ml-1 text-gray-400 hover:text-indigo-600 focus:outline-none"
                      title="Sort by Low Bid"
                    >
                      {getSortIcon('lowTopOfPageBid') || '⇅'}
                    </button>
                  </div>
                </th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip text="Maximum bid for the ad to be displayed at the top of the first page; indicates the value greater than about 80% of the lowest bids for which ads were displayed.">
                      <span className="cursor-help border-b border-dashed border-gray-400">High Bid</span>
                    </Tooltip>
                    <button
                      onClick={() => handleSort('highTopOfPageBid')}
                      className="ml-1 text-gray-400 hover:text-indigo-600 focus:outline-none"
                      title="Sort by High Bid"
                    >
                      {getSortIcon('highTopOfPageBid') || '⇅'}
                    </button>
                  </div>
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2">
                  <Tooltip text="Location code used in the API request (e.g., 2356 for India, 2840 for Global/US).">
                    <span className="cursor-help border-b border-dashed border-gray-400">Location</span>
                  </Tooltip>
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2">
                  <Tooltip text="Language code used in the API request (e.g., 'en' for English).">
                    <span className="cursor-help border-b border-dashed border-gray-400">Lang</span>
                  </Tooltip>
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2">Last Pulled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-gray-500 text-sm">
                    Loading...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-gray-500 text-sm">
                    {records.length === 0 
                      ? 'No keyword data available. Click "Refresh Data" to fetch keyword metrics.'
                      : 'No records match your filters. Try adjusting the filter criteria.'}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record, index) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="text-xs text-gray-600 py-1 px-2 leading-tight">{index + 1}</td>
                    <td className="text-xs text-gray-900 py-1 px-2 leading-tight font-medium">{record.keywordText}</td>
                    <td className="text-xs text-gray-600 py-1 px-2 leading-tight text-right">
                      {record.searchVolume?.toLocaleString() ?? '-'}
                    </td>
                    <td className="text-xs text-gray-600 py-1 px-2 leading-tight text-right">
                      {record.cpc !== null ? `$${record.cpc.toFixed(2)}` : '-'}
                    </td>
                    <td className="text-xs text-gray-600 py-1 px-2 leading-tight">
                      {record.competition ? (
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          record.competition === 'HIGH' ? 'bg-red-100 text-red-800' :
                          record.competition === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                          record.competition === 'LOW' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {record.competition}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="text-xs text-gray-600 py-1 px-2 leading-tight text-right">
                      {record.lowTopOfPageBid !== null ? `$${record.lowTopOfPageBid.toFixed(2)}` : '-'}
                    </td>
                    <td className="text-xs text-gray-600 py-1 px-2 leading-tight text-right">
                      {record.highTopOfPageBid !== null ? `$${record.highTopOfPageBid.toFixed(2)}` : '-'}
                    </td>
                    <td className="text-xs text-gray-600 py-1 px-2 leading-tight">
                      <span title={`Code: ${record.locationCode}`}>
                        {getLocationLabel(record.locationCode)}
                      </span>
                    </td>
                    <td className="text-xs text-gray-600 py-1 px-2 leading-tight">{record.languageCode}</td>
                    <td className="text-xs text-gray-600 py-1 px-2 leading-tight">
                      {(() => {
                        const d = new Date(record.lastPulledAt);
                        return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
                      })()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6">
        <button
          onClick={toggleLogs}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <svg
            className={`w-4 h-4 transition-transform ${showLogs ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          View Raw API Logs (Debug)
        </button>

        {showLogs && (
          <div className="mt-4 bg-gray-900 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-200 mb-3">Recent API Responses</h3>
            
            {apiLogs.length === 0 ? (
              <p className="text-gray-400 text-sm">No API logs available. Refresh keyword data to generate logs.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2 mb-4">
                  {apiLogs.slice(0, 10).map((log) => (
                    <button
                      key={log}
                      onClick={() => viewLogContent(log)}
                      className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded hover:bg-gray-700"
                    >
                      {log.replace('dataforseo_', '').replace('.json', '')}
                    </button>
                  ))}
                </div>

                {loadingLog && (
                  <p className="text-gray-400 text-sm">Loading log content...</p>
                )}

                {selectedLogContent && (
                  <div className="bg-gray-800 rounded p-3 max-h-96 overflow-auto">
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">
                      {selectedLogContent}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
