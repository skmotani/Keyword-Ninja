'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PageHeader from '@/components/PageHeader';
import ExportButton, { ExportColumn } from '@/components/ExportButton';

interface Client {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

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

export default function DomainKeywordsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedClientCode, setSelectedClientCode] = useState<string>('');
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

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedClientCode) {
      fetchCompetitors();
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

  const uniqueDomainsInRecords = useMemo(() => {
    const domains = new Set(records.map(r => r.domain));
    return Array.from(domains).sort();
  }, [records]);

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

    return filtered;
  }, [records, domainFilter, locationFilter, keywordFilter, positionMaxFilter, volumeMinFilter]);

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

  const truncateUrl = (url: string | null, maxLen: number = 50) => {
    if (!url) return '-';
    if (url.length <= maxLen) return url;
    return url.substring(0, maxLen) + '...';
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
        </div>

        {competitors.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Select Domains ({selectedDomains.length}/{competitors.length})
              </label>
              <div className="flex gap-2">
                <button
                  onClick={selectAllDomains}
                  className="text-xs text-indigo-600 hover:text-indigo-800"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAllDomains}
                  className="text-xs text-gray-600 hover:text-gray-800"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-gray-50 rounded-md">
              {competitors.map(comp => (
                <label
                  key={comp.id}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                    selectedDomains.includes(comp.domain)
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
        )}
      </div>

      {notification && (
        <div
          className={`mb-4 p-4 rounded-md ${
            notification.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {notification.message}
        </div>
      )}

      {lastFetchedAt && (
        <div className="mb-4 text-sm text-gray-500">
          Last fetched: {new Date(lastFetchedAt).toLocaleString()}
        </div>
      )}

      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg shadow p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Summary Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-4">
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
              placeholder="Type to filter by keyword..."
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="min-w-[100px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Max Position</label>
            <input
              type="number"
              value={positionMaxFilter}
              onChange={e => setPositionMaxFilter(e.target.value)}
              placeholder="Any"
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
            Showing {sortedRecords.length} of {records.length} keywords
          </div>
        </div>
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
            <p>No domain keywords data found.</p>
            <p className="text-sm mt-1">Select domains and click "Fetch Both Locations" to get data.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Domain
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Keyword
                </th>
                <SortableHeader
                  field="position"
                  label="Position"
                  tooltip="Current organic position for this keyword"
                />
                <SortableHeader
                  field="searchVolume"
                  label="Search Volume"
                  tooltip="Monthly search volume for this keyword"
                />
                <SortableHeader
                  field="cpc"
                  label="CPC"
                  tooltip="Cost per click for this keyword"
                />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ranking URL
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedRecords.map(record => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {record.domain}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      record.locationCode === 'IN' 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-teal-100 text-teal-800'
                    }`}>
                      {record.locationCode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <a
                      href={getGoogleSearchUrl(record.keyword)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1"
                    >
                      {record.keyword}
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      record.position && record.position <= 3
                        ? 'bg-green-100 text-green-800'
                        : record.position && record.position <= 10
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {record.position ?? '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {formatNumber(record.searchVolume)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {formatCurrency(record.cpc)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {record.url ? (
                      <Tooltip text={record.url}>
                        <a
                          href={record.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          {truncateUrl(record.url)}
                        </a>
                      </Tooltip>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
