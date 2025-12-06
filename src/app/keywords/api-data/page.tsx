'use client';

import { useState, useEffect, useCallback } from 'react';
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
  competitionIndex: number | null;
  locationCode: string;
  sourceApi: string;
  snapshotDate: string;
  lastPulledAt: string;
}

const LOCATION_OPTIONS = [
  { code: 'IN', label: 'India (IN)' },
  { code: 'GL', label: 'Global (GL)' },
];

export default function KeywordApiDataPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientCode, setSelectedClientCode] = useState<string>('');
  const [selectedLocationCode, setSelectedLocationCode] = useState<string>('IN');
  const [records, setRecords] = useState<KeywordApiDataRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
    if (!selectedClientCode || !selectedLocationCode) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/seo/keywords?clientCode=${selectedClientCode}&locationCode=${selectedLocationCode}`
      );
      const data = await res.json();
      setRecords(data);
    } catch (error) {
      console.error('Failed to fetch keyword API data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedClientCode, selectedLocationCode]);

  useEffect(() => {
    if (selectedClientCode && selectedLocationCode) {
      fetchRecords();
    }
  }, [selectedClientCode, selectedLocationCode, fetchRecords]);

  const handleRefresh = async () => {
    if (!selectedClientCode || !selectedLocationCode) return;
    setRefreshing(true);
    setNotification(null);
    try {
      const res = await fetch('/api/seo/keywords/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientCode: selectedClientCode,
          locationCode: selectedLocationCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotification({ type: 'error', message: data.error || 'Failed to refresh data' });
      } else {
        const clientName = clients.find(c => c.code === selectedClientCode)?.name || selectedClientCode;
        const locationLabel = LOCATION_OPTIONS.find(l => l.code === selectedLocationCode)?.label || selectedLocationCode;
        const timestamp = new Date().toLocaleString();
        setNotification({ 
          type: 'success', 
          message: `Keyword data for ${clientName} (${locationLabel}) refreshed successfully at ${timestamp}. ${data.count} keywords fetched.`
        });
        await fetchRecords();
      }
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to refresh data' });
    } finally {
      setRefreshing(false);
    }
  };

  const getLastRefreshed = () => {
    if (records.length === 0) return 'Never';
    const sorted = [...records].sort(
      (a, b) => new Date(b.lastPulledAt).getTime() - new Date(a.lastPulledAt).getTime()
    );
    return new Date(sorted[0].lastPulledAt).toLocaleString();
  };

  const getSearchVolumeCount = () => {
    return records.filter(r => r.searchVolume !== null && r.searchVolume > 0).length;
  };

  const getAvgCompetitionIndex = () => {
    const withCompetition = records.filter(r => r.competitionIndex !== null);
    if (withCompetition.length === 0) return 'N/A';
    const sum = withCompetition.reduce((acc, r) => acc + (r.competitionIndex || 0), 0);
    return (sum / withCompetition.length).toFixed(1);
  };

  const selectedClientName = clients.find(c => c.code === selectedClientCode)?.name || '';

  return (
    <div className="max-w-6xl mx-auto p-4">
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
            <select
              value={selectedLocationCode}
              onChange={(e) => setSelectedLocationCode(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {LOCATION_OPTIONS.map((loc) => (
                <option key={loc.code} value={loc.code}>
                  {loc.label}
                </option>
              ))}
            </select>
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

      <div className="bg-gray-50 rounded-lg border p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Client:</span>
            <p className="font-medium">{selectedClientName || '-'}</p>
          </div>
          <div>
            <span className="text-gray-500">Location:</span>
            <p className="font-medium">{selectedLocationCode}</p>
          </div>
          <div>
            <span className="text-gray-500">Last Refreshed:</span>
            <p className="font-medium">{getLastRefreshed()}</p>
          </div>
          <div>
            <span className="text-gray-500">Total Keywords:</span>
            <p className="font-medium">{records.length}</p>
          </div>
          <div>
            <span className="text-gray-500">With Search Volume:</span>
            <p className="font-medium">{getSearchVolumeCount()}</p>
          </div>
          <div>
            <span className="text-gray-500">Avg Competition:</span>
            <p className="font-medium">{getAvgCompetitionIndex()}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2">S.No</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2">Keyword</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2">Search Vol</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2">CPC</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2">Competition</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2">Location</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2">Source</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2">Last Pulled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500 text-sm">
                    Loading...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500 text-sm">
                    No keyword data available. Click "Refresh Data" to fetch keyword metrics.
                  </td>
                </tr>
              ) : (
                records.map((record, index) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="text-xs text-gray-600 py-1 px-2 leading-tight">{index + 1}</td>
                    <td className="text-xs text-gray-900 py-1 px-2 leading-tight font-medium">{record.keywordText}</td>
                    <td className="text-xs text-gray-600 py-1 px-2 leading-tight text-right">
                      {record.searchVolume?.toLocaleString() ?? '-'}
                    </td>
                    <td className="text-xs text-gray-600 py-1 px-2 leading-tight text-right">
                      {record.cpc !== null ? `$${record.cpc.toFixed(2)}` : '-'}
                    </td>
                    <td className="text-xs text-gray-600 py-1 px-2 leading-tight text-right">
                      {record.competitionIndex?.toFixed(1) ?? '-'}
                    </td>
                    <td className="text-xs text-gray-600 py-1 px-2 leading-tight">{record.locationCode}</td>
                    <td className="text-xs text-gray-600 py-1 px-2 leading-tight">{record.sourceApi}</td>
                    <td className="text-xs text-gray-600 py-1 px-2 leading-tight">
                      {new Date(record.lastPulledAt).toLocaleDateString()}
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
