'use client';

import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import ExportButton, { ExportColumn } from '@/components/ExportButton';
import {
  ClusterSummary,
  aggregateClusterStats,
  calculateClusterPriorityTier,
  getClusterBadgeColor,
  getClusterPriorityBadgeColor,
} from '@/lib/productClustering';
import { DomainPageRecord, PriorityTier } from '@/types';

interface Client {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

const LOCATION_OPTIONS = [
  { code: 'all', label: 'All Locations' },
  { code: 'IN', label: 'India (IN)' },
  { code: 'GL', label: 'Global (GL)' },
];

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toLocaleString();
}

function formatPriorityTier(tier: string): string {
  const labels: Record<string, string> = {
    'IMMEDIATE': 'Immediate',
    'HIGH': 'High',
    'MEDIUM': 'Medium',
    'MONITOR': 'Monitor',
    'IGNORE': 'Ignore',
  };
  return labels[tier] || tier;
}

interface ClusterRowData extends ClusterSummary {
  clusterPriority: string;
  topDomains: string[];
}

export default function ClusterIntelligencePage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientCode, setSelectedClientCode] = useState<string>('');
  const [records, setRecords] = useState<DomainPageRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [locationFilter, setLocationFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortField, setSortField] = useState<'totalETV' | 'totalPages' | 'avgETV' | null>('totalETV');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedClientCode) {
      fetchRecords();
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

  const fetchRecords = async () => {
    if (!selectedClientCode) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/domain-pages?clientCode=${selectedClientCode}`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.records);
      }
    } catch (error) {
      console.error('Failed to fetch domain pages data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (locationFilter !== 'all' && r.locationCode !== locationFilter) return false;
      return true;
    });
  }, [records, locationFilter]);

  const classifiedRecords = useMemo(() => {
    return filteredRecords.filter(r => r.clusterName);
  }, [filteredRecords]);

  const clusterData = useMemo((): ClusterRowData[] => {
    const summaries = aggregateClusterStats(classifiedRecords);
    
    const domainsByCluster = new Map<string, Map<string, number>>();
    for (const record of classifiedRecords) {
      if (!record.clusterName) continue;
      if (!domainsByCluster.has(record.clusterName)) {
        domainsByCluster.set(record.clusterName, new Map());
      }
      const domainMap = domainsByCluster.get(record.clusterName)!;
      const currentEtv = domainMap.get(record.domain) || 0;
      domainMap.set(record.domain, currentEtv + (record.estTrafficETV || 0));
    }
    
    return summaries.map(summary => {
      const clusterPriority = calculateClusterPriorityTier(summary);
      const domainMap = domainsByCluster.get(summary.clusterName) || new Map();
      const sortedDomains = Array.from(domainMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([domain]) => domain);
      
      return {
        ...summary,
        clusterPriority,
        topDomains: sortedDomains,
      };
    });
  }, [classifiedRecords]);

  const filteredClusterData = useMemo(() => {
    return clusterData.filter(c => {
      if (priorityFilter !== 'all' && c.clusterPriority !== priorityFilter) return false;
      return true;
    });
  }, [clusterData, priorityFilter]);

  const { matchedClusters, unmatchedClusters } = useMemo(() => {
    const matched = filteredClusterData.filter(c => c.products.length > 0);
    const unmatched = filteredClusterData.filter(c => c.products.length === 0);
    return { matchedClusters: matched, unmatchedClusters: unmatched };
  }, [filteredClusterData]);

  const sortedMatchedClusters = useMemo(() => {
    if (!sortField) return matchedClusters;
    return [...matchedClusters].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (sortDirection === 'asc') return aVal - bVal;
      return bVal - aVal;
    });
  }, [matchedClusters, sortField, sortDirection]);

  const sortedUnmatchedClusters = useMemo(() => {
    if (!sortField) return unmatchedClusters;
    return [...unmatchedClusters].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (sortDirection === 'asc') return aVal - bVal;
      return bVal - aVal;
    });
  }, [unmatchedClusters, sortField, sortDirection]);

  const sortedClusterData = useMemo(() => {
    if (!sortField) return filteredClusterData;
    return [...filteredClusterData].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (sortDirection === 'asc') return aVal - bVal;
      return bVal - aVal;
    });
  }, [filteredClusterData, sortField, sortDirection]);

  const summaryStats = useMemo(() => {
    const totalPages = classifiedRecords.length;
    const totalETV = classifiedRecords.reduce((sum, r) => sum + (r.estTrafficETV || 0), 0);
    const uniqueClusters = clusterData.length;
    const uniqueProducts = new Set(classifiedRecords.map(r => r.matchedProduct).filter(Boolean)).size;
    const unclassifiedCount = filteredRecords.filter(r => !r.clusterName).length;
    const immediateCount = clusterData.filter(c => c.clusterPriority === 'IMMEDIATE').length;
    const highCount = clusterData.filter(c => c.clusterPriority === 'HIGH').length;
    const matchedClusterCount = matchedClusters.length;
    const unmatchedClusterCount = unmatchedClusters.length;
    
    return {
      totalPages,
      totalETV,
      uniqueClusters,
      uniqueProducts,
      unclassifiedCount,
      immediateCount,
      highCount,
      matchedClusterCount,
      unmatchedClusterCount,
    };
  }, [classifiedRecords, clusterData, filteredRecords, matchedClusters, unmatchedClusters]);

  const handleSort = (field: 'totalETV' | 'totalPages' | 'avgETV') => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: 'totalETV' | 'totalPages' | 'avgETV' }) => {
    if (sortField !== field) {
      return (
        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'desc' ? (
      <svg className="w-3 h-3 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    ) : (
      <svg className="w-3 h-3 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    );
  };

  const getClusterPagesForDomain = (clusterName: string, domain: string): DomainPageRecord[] => {
    return classifiedRecords.filter(r => r.clusterName === clusterName && r.domain === domain);
  };

  return (
    <div>
      <PageHeader
        title="Cluster Intelligence"
        description="Analyze product/topic clusters across competitor pages to identify strategic opportunities"
      />

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-500 mb-1">Client</label>
            <select
              value={selectedClientCode}
              onChange={(e) => setSelectedClientCode(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Select a client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.code}>
                  {client.name} ({client.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Location</label>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              {LOCATION_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Cluster Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Priorities</option>
              <option value="IMMEDIATE">Immediate</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="MONITOR">Monitor</option>
              <option value="IGNORE">Ignore</option>
            </select>
          </div>

          <div className="flex items-end">
            <ExportButton
              data={sortedClusterData.map(c => ({
                clusterName: c.clusterName,
                totalPages: c.totalPages,
                totalETV: c.totalETV,
                avgETV: c.avgETV,
                products: c.products.join(', '),
                clusterPriority: c.clusterPriority,
                transactionalPages: c.intentBreakdown.transactional,
                commercialPages: c.intentBreakdown.commercialResearch,
                informationalPages: c.intentBreakdown.informational,
                tier1Pages: c.priorityTierBreakdown.tier1,
                tier2Pages: c.priorityTierBreakdown.tier2,
                topDomains: c.topDomains.join(', '),
              }))}
              columns={[
                { key: 'clusterName', header: 'Cluster' },
                { key: 'totalPages', header: 'Total Pages' },
                { key: 'totalETV', header: 'Total ETV' },
                { key: 'avgETV', header: 'Avg ETV' },
                { key: 'products', header: 'Products' },
                { key: 'clusterPriority', header: 'Priority' },
                { key: 'transactionalPages', header: 'Transactional' },
                { key: 'commercialPages', header: 'Commercial' },
                { key: 'informationalPages', header: 'Informational' },
                { key: 'tier1Pages', header: 'Tier 1 Pages' },
                { key: 'tier2Pages', header: 'Tier 2 Pages' },
                { key: 'topDomains', header: 'Top Domains' },
              ] as ExportColumn<Record<string, unknown>>[]}
              filename={`cluster-intelligence-${selectedClientCode}-${new Date().toISOString().split('T')[0]}`}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <svg className="animate-spin h-8 w-8 mx-auto text-indigo-600 mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-500">Loading cluster data...</p>
        </div>
      ) : (
        <>
          <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg shadow p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Cluster Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3">
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-xs text-gray-500">Unique Clusters</div>
                <div className="text-lg font-bold text-cyan-600">{summaryStats.uniqueClusters}</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-xs text-gray-500">Matched Clusters</div>
                <div className="text-lg font-bold text-green-600">{summaryStats.matchedClusterCount}</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-xs text-gray-500">Unmatched Clusters</div>
                <div className="text-lg font-bold text-amber-600">{summaryStats.unmatchedClusterCount}</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-xs text-gray-500">Unique Products</div>
                <div className="text-lg font-bold text-blue-600">{summaryStats.uniqueProducts}</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-xs text-gray-500">Classified Pages</div>
                <div className="text-lg font-bold text-green-600">{formatNumber(summaryStats.totalPages)}</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-xs text-gray-500">Total ETV</div>
                <div className="text-lg font-bold text-purple-600">{formatNumber(summaryStats.totalETV)}</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-xs text-gray-500">Unclassified</div>
                <div className="text-lg font-bold text-gray-600">{formatNumber(summaryStats.unclassifiedCount)}</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-xs text-gray-500">Immediate Priority</div>
                <div className="text-lg font-bold text-red-600">{summaryStats.immediateCount}</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-xs text-gray-500">High Priority</div>
                <div className="text-lg font-bold text-orange-600">{summaryStats.highCount}</div>
              </div>
            </div>
          </div>

          {sortedClusterData.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Cluster Data Found</h3>
              <p className="text-gray-500 text-sm">
                Run &quot;Classify Products&quot; on the Domain Top Pages to generate cluster data.
              </p>
            </div>
          ) : (
            <>
              {sortedMatchedClusters.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Clusters Matched with Client Products
                      <span className="ml-2 text-sm font-normal text-gray-500">({sortedMatchedClusters.length} clusters)</span>
                    </h3>
                  </div>
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Cluster
                            </th>
                            <th
                              className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                              onClick={() => handleSort('totalPages')}
                            >
                              <div className="flex items-center justify-end gap-1">
                                Pages
                                <SortIcon field="totalPages" />
                              </div>
                            </th>
                            <th
                              className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                              onClick={() => handleSort('totalETV')}
                            >
                              <div className="flex items-center justify-end gap-1">
                                Total ETV
                                <SortIcon field="totalETV" />
                              </div>
                            </th>
                            <th
                              className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                              onClick={() => handleSort('avgETV')}
                            >
                              <div className="flex items-center justify-end gap-1">
                                Avg ETV
                                <SortIcon field="avgETV" />
                              </div>
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Products
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Priority
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Intent Mix
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Priority Tiers
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Top Domains
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {sortedMatchedClusters.map((cluster, idx) => (
                            <React.Fragment key={cluster.clusterName}>
                              <tr
                                className={`hover:bg-gray-50 cursor-pointer ${expandedCluster === cluster.clusterName ? 'bg-indigo-50' : ''}`}
                                onClick={() => setExpandedCluster(expandedCluster === cluster.clusterName ? null : cluster.clusterName)}
                              >
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <svg
                                      className={`w-4 h-4 text-gray-400 transition-transform ${expandedCluster === cluster.clusterName ? 'rotate-90' : ''}`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getClusterBadgeColor(cluster.clusterName)}`}>
                                      {cluster.clusterName}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right text-sm text-gray-900">
                                  {formatNumber(cluster.totalPages)}
                                </td>
                                <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                                  {formatNumber(cluster.totalETV)}
                                </td>
                                <td className="px-4 py-3 text-right text-sm text-gray-600">
                                  {cluster.avgETV.toFixed(1)}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                                    {cluster.products.slice(0, 3).map((product, pIdx) => (
                                      <span
                                        key={pIdx}
                                        className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 truncate max-w-[80px]"
                                        title={product}
                                      >
                                        {product}
                                      </span>
                                    ))}
                                    {cluster.products.length > 3 && (
                                      <span className="text-[10px] text-gray-500">+{cluster.products.length - 3}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${getClusterPriorityBadgeColor(cluster.clusterPriority)}`}>
                                    {formatPriorityTier(cluster.clusterPriority)}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-center gap-1">
                                    {cluster.intentBreakdown.transactional > 0 && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700" title="Transactional">
                                        T: {cluster.intentBreakdown.transactional}
                                      </span>
                                    )}
                                    {cluster.intentBreakdown.commercialResearch > 0 && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-700" title="Commercial Research">
                                        C: {cluster.intentBreakdown.commercialResearch}
                                      </span>
                                    )}
                                    {cluster.intentBreakdown.informational > 0 && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700" title="Informational">
                                        I: {cluster.intentBreakdown.informational}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-center gap-1">
                                    {cluster.priorityTierBreakdown.tier1 > 0 && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700" title="Tier 1 - Immediate">
                                        T1: {cluster.priorityTierBreakdown.tier1}
                                      </span>
                                    )}
                                    {cluster.priorityTierBreakdown.tier2 > 0 && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-orange-100 text-orange-700" title="Tier 2 - High">
                                        T2: {cluster.priorityTierBreakdown.tier2}
                                      </span>
                                    )}
                                    {cluster.priorityTierBreakdown.tier3 > 0 && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-yellow-100 text-yellow-700" title="Tier 3 - Medium">
                                        T3: {cluster.priorityTierBreakdown.tier3}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                                    {cluster.topDomains.slice(0, 2).map((domain, dIdx) => (
                                      <span
                                        key={dIdx}
                                        className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-700 truncate max-w-[90px]"
                                        title={domain}
                                      >
                                        {domain}
                                      </span>
                                    ))}
                                    {cluster.topDomains.length > 2 && (
                                      <span className="text-[10px] text-gray-500">+{cluster.topDomains.length - 2}</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                              {expandedCluster === cluster.clusterName && (
                                <tr>
                                  <td colSpan={9} className="px-4 py-4 bg-gray-50">
                                    <div className="space-y-4">
                                      <div>
                                        <h4 className="text-sm font-medium text-gray-700 mb-2">All Products in Cluster</h4>
                                        <div className="flex flex-wrap gap-2">
                                          {cluster.products.map((product, pIdx) => (
                                            <span
                                              key={pIdx}
                                              className="inline-flex px-2 py-1 rounded text-xs bg-blue-100 text-blue-800"
                                            >
                                              {product}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                      <div>
                                        <h4 className="text-sm font-medium text-gray-700 mb-2">Top Domains by ETV</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                          {cluster.topDomains.map((domain, dIdx) => {
                                            const domainPages = getClusterPagesForDomain(cluster.clusterName, domain);
                                            const domainETV = domainPages.reduce((sum, p) => sum + (p.estTrafficETV || 0), 0);
                                            return (
                                              <div key={dIdx} className="bg-white rounded-lg p-3 shadow-sm">
                                                <div className="font-medium text-sm text-gray-900 truncate" title={domain}>
                                                  {domain}
                                                </div>
                                                <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                                                  <span>Pages: {domainPages.length}</span>
                                                  <span>ETV: {formatNumber(Math.round(domainETV))}</span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                      <div>
                                        <h4 className="text-sm font-medium text-gray-700 mb-2">Full Statistics</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                          <div className="bg-white rounded-lg p-2 shadow-sm text-center">
                                            <div className="text-xs text-gray-500">Transactional</div>
                                            <div className="text-lg font-bold text-green-600">{cluster.intentBreakdown.transactional}</div>
                                          </div>
                                          <div className="bg-white rounded-lg p-2 shadow-sm text-center">
                                            <div className="text-xs text-gray-500">Commercial</div>
                                            <div className="text-lg font-bold text-purple-600">{cluster.intentBreakdown.commercialResearch}</div>
                                          </div>
                                          <div className="bg-white rounded-lg p-2 shadow-sm text-center">
                                            <div className="text-xs text-gray-500">Informational</div>
                                            <div className="text-lg font-bold text-blue-600">{cluster.intentBreakdown.informational}</div>
                                          </div>
                                          <div className="bg-white rounded-lg p-2 shadow-sm text-center">
                                            <div className="text-xs text-gray-500">Other</div>
                                            <div className="text-lg font-bold text-gray-600">{cluster.intentBreakdown.other}</div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {sortedUnmatchedClusters.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Clusters Not Matched with Client Products
                      <span className="ml-2 text-sm font-normal text-gray-500">({sortedUnmatchedClusters.length} clusters)</span>
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    These clusters contain competitor pages but no products from your client&apos;s product list were matched. Consider adding these as potential product opportunities.
                  </p>
                  <div className="bg-white rounded-lg shadow overflow-hidden border-l-4 border-amber-400">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-amber-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Cluster
                            </th>
                            <th
                              className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-amber-100"
                              onClick={() => handleSort('totalPages')}
                            >
                              <div className="flex items-center justify-end gap-1">
                                Pages
                                <SortIcon field="totalPages" />
                              </div>
                            </th>
                            <th
                              className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-amber-100"
                              onClick={() => handleSort('totalETV')}
                            >
                              <div className="flex items-center justify-end gap-1">
                                Total ETV
                                <SortIcon field="totalETV" />
                              </div>
                            </th>
                            <th
                              className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-amber-100"
                              onClick={() => handleSort('avgETV')}
                            >
                              <div className="flex items-center justify-end gap-1">
                                Avg ETV
                                <SortIcon field="avgETV" />
                              </div>
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Priority
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Intent Mix
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Priority Tiers
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Top Domains
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {sortedUnmatchedClusters.map((cluster, idx) => (
                            <React.Fragment key={cluster.clusterName}>
                              <tr
                                className={`hover:bg-amber-50 cursor-pointer ${expandedCluster === cluster.clusterName ? 'bg-amber-100' : ''}`}
                                onClick={() => setExpandedCluster(expandedCluster === cluster.clusterName ? null : cluster.clusterName)}
                              >
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <svg
                                      className={`w-4 h-4 text-gray-400 transition-transform ${expandedCluster === cluster.clusterName ? 'rotate-90' : ''}`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getClusterBadgeColor(cluster.clusterName)}`}>
                                      {cluster.clusterName}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right text-sm text-gray-900">
                                  {formatNumber(cluster.totalPages)}
                                </td>
                                <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                                  {formatNumber(cluster.totalETV)}
                                </td>
                                <td className="px-4 py-3 text-right text-sm text-gray-600">
                                  {cluster.avgETV.toFixed(1)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${getClusterPriorityBadgeColor(cluster.clusterPriority)}`}>
                                    {formatPriorityTier(cluster.clusterPriority)}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-center gap-1">
                                    {cluster.intentBreakdown.transactional > 0 && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700" title="Transactional">
                                        T: {cluster.intentBreakdown.transactional}
                                      </span>
                                    )}
                                    {cluster.intentBreakdown.commercialResearch > 0 && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-700" title="Commercial Research">
                                        C: {cluster.intentBreakdown.commercialResearch}
                                      </span>
                                    )}
                                    {cluster.intentBreakdown.informational > 0 && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700" title="Informational">
                                        I: {cluster.intentBreakdown.informational}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-center gap-1">
                                    {cluster.priorityTierBreakdown.tier1 > 0 && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700" title="Tier 1 - Immediate">
                                        T1: {cluster.priorityTierBreakdown.tier1}
                                      </span>
                                    )}
                                    {cluster.priorityTierBreakdown.tier2 > 0 && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-orange-100 text-orange-700" title="Tier 2 - High">
                                        T2: {cluster.priorityTierBreakdown.tier2}
                                      </span>
                                    )}
                                    {cluster.priorityTierBreakdown.tier3 > 0 && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-yellow-100 text-yellow-700" title="Tier 3 - Medium">
                                        T3: {cluster.priorityTierBreakdown.tier3}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                                    {cluster.topDomains.slice(0, 2).map((domain, dIdx) => (
                                      <span
                                        key={dIdx}
                                        className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-700 truncate max-w-[90px]"
                                        title={domain}
                                      >
                                        {domain}
                                      </span>
                                    ))}
                                    {cluster.topDomains.length > 2 && (
                                      <span className="text-[10px] text-gray-500">+{cluster.topDomains.length - 2}</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                              {expandedCluster === cluster.clusterName && (
                                <tr>
                                  <td colSpan={8} className="px-4 py-4 bg-amber-50">
                                    <div className="space-y-4">
                                      <div className="bg-amber-100 border border-amber-300 rounded-lg p-3">
                                        <div className="flex items-center gap-2 text-amber-800">
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                          <span className="text-sm font-medium">No matching products found for this cluster</span>
                                        </div>
                                        <p className="text-xs text-amber-700 mt-1">
                                          This cluster represents content from competitors that doesn&apos;t match any of your client&apos;s defined products or services.
                                        </p>
                                      </div>
                                      <div>
                                        <h4 className="text-sm font-medium text-gray-700 mb-2">Top Domains by ETV</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                          {cluster.topDomains.map((domain, dIdx) => {
                                            const domainPages = getClusterPagesForDomain(cluster.clusterName, domain);
                                            const domainETV = domainPages.reduce((sum, p) => sum + (p.estTrafficETV || 0), 0);
                                            return (
                                              <div key={dIdx} className="bg-white rounded-lg p-3 shadow-sm">
                                                <div className="font-medium text-sm text-gray-900 truncate" title={domain}>
                                                  {domain}
                                                </div>
                                                <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                                                  <span>Pages: {domainPages.length}</span>
                                                  <span>ETV: {formatNumber(Math.round(domainETV))}</span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                      <div>
                                        <h4 className="text-sm font-medium text-gray-700 mb-2">Full Statistics</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                          <div className="bg-white rounded-lg p-2 shadow-sm text-center">
                                            <div className="text-xs text-gray-500">Transactional</div>
                                            <div className="text-lg font-bold text-green-600">{cluster.intentBreakdown.transactional}</div>
                                          </div>
                                          <div className="bg-white rounded-lg p-2 shadow-sm text-center">
                                            <div className="text-xs text-gray-500">Commercial</div>
                                            <div className="text-lg font-bold text-purple-600">{cluster.intentBreakdown.commercialResearch}</div>
                                          </div>
                                          <div className="bg-white rounded-lg p-2 shadow-sm text-center">
                                            <div className="text-xs text-gray-500">Informational</div>
                                            <div className="text-lg font-bold text-blue-600">{cluster.intentBreakdown.informational}</div>
                                          </div>
                                          <div className="bg-white rounded-lg p-2 shadow-sm text-center">
                                            <div className="text-xs text-gray-500">Other</div>
                                            <div className="text-lg font-bold text-gray-600">{cluster.intentBreakdown.other}</div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
