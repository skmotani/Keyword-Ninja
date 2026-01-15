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

interface DomainOverviewRecord {
  id: string;
  clientCode: string;
  domain: string;
  label: string;
  locationCode: string;
  languageCode: string;
  organicTrafficETV: number | null;
  organicKeywordsCount: number | null;
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

type SortField = 'organicTrafficETV' | 'organicKeywordsCount' | null;
type SortDirection = 'asc' | 'desc';

const domainOverviewPageHelp = {
  title: 'Organic Traffic Overview',
  description: 'Track how visible a domain is in search engines based on estimated traffic and keyword counts.',
  whyWeAddedThis: 'To know "who is winning" in SEO, we need high-level metrics. Traffic ETV (Estimated Traffic Value) is a better metric than just traffic because it accounts for the value of the keywords.',
  examples: ['Competitor X has 10k traffic but $50k ETV (High Value)', 'Competitor Y has 50k traffic but $500 ETV (Low Value)'],
  nuances: 'We fetch data for BOTH India (IN) and Global (GL) locations every time to see if a competitor is focused locally or globally.',
  useCases: [
    'Benchmarking client performance vs competitors',
    'Identifying if a competitor is growing or shrinking',
    'Spotting high-value competitors to analyze deeply'
  ]
};

const domainOverviewPageDescription = `
  This page provides high-level "health metrics" for domains. It shows how much organic traffic they get and how many keywords they rank for.
  It is excellent for competitive benchmarking.

  **Metrics Explained:**
  *   **Organic Traffic ETV:** A score representing the *value* of the organic traffic. If they rank for expensive keywords, this is high.
  *   **Organic Keywords:** The total number of keywords the domain ranks for in the top 100 results.

  **Data Flow:** 
  DataForSEO (Domain Overview API) → App Database → This View.
  
  From here, you can dive deeper into:
  *   [Domain Organic Keywords](/keywords/domain-keywords) (Specific keywords they rank for)
  *   [Domain Top Pages](/keywords/domain-pages) (Their best content)
`;

export default function DomainOverviewPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedClientCode, setSelectedClientCode] = useState<string>('');
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [records, setRecords] = useState<DomainOverviewRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [domainFilter, setDomainFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [trafficMinFilter, setTrafficMinFilter] = useState('');
  const [trafficMaxFilter, setTrafficMaxFilter] = useState('');
  const [keywordsMinFilter, setKeywordsMinFilter] = useState('');
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
      const res = await fetch(`/api/domain-overview?clientCode=${selectedClientCode}`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.records);
      }
    } catch (error) {
      console.error('Failed to fetch domain overview data:', error);
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
      const res = await fetch('/api/domain-overview/fetch', {
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
          message: `Successfully fetched data for ${data.domainsProcessed} domains across ${data.locations?.length || 2} locations.`,
        });
        await fetchRecords();
      } else {
        setNotification({
          type: 'error',
          message: data.error || 'Failed to refresh domain overview data.',
        });
      }
    } catch (error) {
      console.error('Error refreshing domain overview:', error);
      setNotification({
        type: 'error',
        message: 'An error occurred while refreshing domain overview data.',
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
      setSortDirection('desc');
    }
  };

  const filteredRecords = useMemo(() => {
    let filtered = records;

    if (domainFilter) {
      const lower = domainFilter.toLowerCase();
      filtered = filtered.filter(r => r.domain.toLowerCase().includes(lower));
    }

    if (locationFilter !== 'all') {
      filtered = filtered.filter(r => r.locationCode === locationFilter);
    }

    if (trafficMinFilter) {
      const min = parseInt(trafficMinFilter);
      if (!isNaN(min)) {
        filtered = filtered.filter(r => (r.organicTrafficETV ?? 0) >= min);
      }
    }

    if (trafficMaxFilter) {
      const max = parseInt(trafficMaxFilter);
      if (!isNaN(max)) {
        filtered = filtered.filter(r => (r.organicTrafficETV ?? 0) <= max);
      }
    }

    if (keywordsMinFilter) {
      const min = parseInt(keywordsMinFilter);
      if (!isNaN(min)) {
        filtered = filtered.filter(r => (r.organicKeywordsCount ?? 0) >= min);
      }
    }

    return filtered;
  }, [records, domainFilter, locationFilter, trafficMinFilter, trafficMaxFilter, keywordsMinFilter]);

  const sortedRecords = useMemo(() => {
    if (!sortField) return filteredRecords;

    return [...filteredRecords].sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;

      if (sortDirection === 'asc') {
        return aVal - bVal;
      }
      return bVal - aVal;
    });
  }, [filteredRecords, sortField, sortDirection]);

  const summaryStats = useMemo(() => {
    const uniqueDomains = new Set(filteredRecords.map(r => r.domain)).size;
    const totalTraffic = filteredRecords.reduce((sum, r) => sum + (r.organicTrafficETV ?? 0), 0);
    const totalKeywords = filteredRecords.reduce((sum, r) => sum + (r.organicKeywordsCount ?? 0), 0);
    const avgTraffic = filteredRecords.length > 0 ? totalTraffic / filteredRecords.length : 0;
    const avgKeywords = filteredRecords.length > 0 ? totalKeywords / filteredRecords.length : 0;
    const inCount = filteredRecords.filter(r => r.locationCode === 'IN').length;
    const glCount = filteredRecords.filter(r => r.locationCode === 'GL').length;

    return { uniqueDomains, totalTraffic, totalKeywords, avgTraffic, avgKeywords, inCount, glCount };
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

  const lastFetchedAt = records.length > 0 ? records[0].fetchedAt : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <PageHeader
        title="Domain Overview"
        description="View domain-level organic visibility metrics (Traffic ETV & Keyword Counts) for both IN and GL locations"
        helpInfo={domainOverviewPageHelp}
        extendedDescription={domainOverviewPageDescription}
      />

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
              { key: 'organicTrafficETV', header: 'Organic Traffic (ETV)' },
              { key: 'organicKeywordsCount', header: 'Organic Keywords' },
              { key: 'fetchedAt', header: 'Fetched At' },
            ] as ExportColumn<DomainOverviewRecord>[]}
            filename={`domain-overview-${selectedClientCode}-${new Date().toISOString().split('T')[0]}`}
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
        )}
      </div>

      {notification && (
        <div
          className={`mb-4 p-4 rounded-md ${notification.type === 'success'
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

      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg shadow p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Summary Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500">Domains</div>
            <div className="text-lg font-bold text-indigo-600">{summaryStats.uniqueDomains}</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500">Total Traffic ETV</div>
            <div className="text-lg font-bold text-green-600">{formatNumber(summaryStats.totalTraffic)}</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500">Total Keywords</div>
            <div className="text-lg font-bold text-blue-600">{formatNumber(summaryStats.totalKeywords)}</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500">Avg Traffic</div>
            <div className="text-lg font-bold text-orange-600">{formatNumber(Math.round(summaryStats.avgTraffic))}</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500">Avg Keywords</div>
            <div className="text-lg font-bold text-purple-600">{formatNumber(Math.round(summaryStats.avgKeywords))}</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500">IN Records</div>
            <div className="text-lg font-bold text-yellow-600">{summaryStats.inCount}</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500">GL Records</div>
            <div className="text-lg font-bold text-teal-600">{summaryStats.glCount}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[150px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Filter by Domain</label>
            <input
              type="text"
              value={domainFilter}
              onChange={e => setDomainFilter(e.target.value)}
              placeholder="Type to filter..."
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
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
          <div className="min-w-[100px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Min Traffic</label>
            <input
              type="number"
              value={trafficMinFilter}
              onChange={e => setTrafficMinFilter(e.target.value)}
              placeholder="0"
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="min-w-[100px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Max Traffic</label>
            <input
              type="number"
              value={trafficMaxFilter}
              onChange={e => setTrafficMaxFilter(e.target.value)}
              placeholder="Any"
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="min-w-[100px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Min Keywords</label>
            <input
              type="number"
              value={keywordsMinFilter}
              onChange={e => setKeywordsMinFilter(e.target.value)}
              placeholder="0"
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="text-sm text-gray-500 ml-auto">
            Showing {sortedRecords.length} of {records.length} records
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
            <p className="mt-2 text-gray-500">Loading domain overview data...</p>
          </div>
        ) : sortedRecords.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No domain overview data found.</p>
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
                <SortableHeader
                  field="organicTrafficETV"
                  label="Organic Traffic ETV"
                  tooltip="Estimated Traffic Value - monthly organic traffic in monetary value"
                />
                <SortableHeader
                  field="organicKeywordsCount"
                  label="Keyword Count"
                  tooltip="Number of keywords the domain ranks for in organic search"
                />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Snapshot Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedRecords.map(record => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <a
                      href={`https://${record.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      {record.domain}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${record.locationCode === 'IN'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-teal-100 text-teal-800'
                      }`}>
                      {record.locationCode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {formatNumber(record.organicTrafficETV)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {formatNumber(record.organicKeywordsCount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {record.snapshotDate}
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
