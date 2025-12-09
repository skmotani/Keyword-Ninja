'use client';

import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import ExportButton, { ExportColumn } from '@/components/ExportButton';
import { DomainPageRecord, ClusterSourceType, ClientAIProfile } from '@/types';
import {
  ClusterSummaryNew,
  aggregateClusterStatsNew,
  matchClusterToProducts,
} from '@/lib/clusterTagging';

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

function calculateClusterPriority(summary: ClusterSummaryNew): string {
  if (summary.clusterEtv >= 10000 && summary.clusterPageCount >= 5) return 'IMMEDIATE';
  if (summary.clusterEtv >= 5000 && summary.clusterPageCount >= 3) return 'HIGH';
  if (summary.clusterEtv >= 1000 || summary.clusterPageCount >= 5) return 'MEDIUM';
  if (summary.clusterEtv >= 100) return 'MONITOR';
  return 'IGNORE';
}

function getPriorityBadgeColor(priority: string): string {
  switch (priority) {
    case 'IMMEDIATE': return 'bg-red-100 text-red-800';
    case 'HIGH': return 'bg-orange-100 text-orange-800';
    case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
    case 'MONITOR': return 'bg-blue-100 text-blue-800';
    case 'IGNORE': return 'bg-gray-100 text-gray-600';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function getClusterBadgeColor(clusterName: string): string {
  if (clusterName.startsWith('__')) {
    return 'bg-gray-100 text-gray-600';
  }
  const hash = clusterName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const colors = [
    'bg-blue-100 text-blue-800',
    'bg-green-100 text-green-800',
    'bg-purple-100 text-purple-800',
    'bg-pink-100 text-pink-800',
    'bg-indigo-100 text-indigo-800',
    'bg-teal-100 text-teal-800',
    'bg-cyan-100 text-cyan-800',
    'bg-rose-100 text-rose-800',
  ];
  return colors[hash % colors.length];
}

interface ClusterRowData extends ClusterSummaryNew {
  priority: string;
  matchedProduct: string | null;
  intentMix: { transactional: number; commercial: number; informational: number; other: number };
  priorityTiers: { tier1: number; tier2: number; tier3: number; other: number };
}

export default function ClusterIntelligence1Page() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientCode, setSelectedClientCode] = useState<string>('');
  const [records, setRecords] = useState<DomainPageRecord[]>([]);
  const [clientProfile, setClientProfile] = useState<ClientAIProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildProgress, setRebuildProgress] = useState<{ done: number; total: number } | null>(null);
  const [locationFilter, setLocationFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [clusterFilter, setClusterFilter] = useState('');
  const [sortField, setSortField] = useState<'clusterEtv' | 'clusterPageCount' | 'avgEtv' | null>('clusterEtv');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedClientCode) {
      fetchRecords();
      fetchClientProfile();
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

  const fetchClientProfile = async () => {
    if (!selectedClientCode) return;
    try {
      const res = await fetch(`/api/client-ai-profile?clientCode=${selectedClientCode}`);
      const data = await res.json();
      if (data && data.coreIdentity) {
        setClientProfile(data);
      } else {
        setClientProfile(null);
      }
    } catch (error) {
      console.error('Failed to fetch client profile:', error);
      setClientProfile(null);
    }
  };

  const handleRebuildClusters = async () => {
    if (!selectedClientCode || rebuilding) return;
    setRebuilding(true);
    setRebuildProgress({ done: 0, total: 0 });
    
    try {
      const res = await fetch('/api/rebuild-clusters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientCode: selectedClientCode,
          locationCode: locationFilter !== 'all' ? locationFilter : undefined,
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        setRebuildProgress({ done: data.processed, total: data.total });
        await fetchRecords();
      } else {
        console.error('Rebuild failed:', data.error);
      }
    } catch (error) {
      console.error('Failed to rebuild clusters:', error);
    } finally {
      setRebuilding(false);
      setTimeout(() => setRebuildProgress(null), 3000);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (locationFilter !== 'all' && r.locationCode !== locationFilter) return false;
      return true;
    });
  }, [records, locationFilter]);

  const taggedRecords = useMemo(() => {
    return filteredRecords.filter(r => r.cluster || r.clusterName);
  }, [filteredRecords]);

  const productLines = useMemo(() => {
    if (!clientProfile?.coreIdentity?.productLines) return [];
    return clientProfile.coreIdentity.productLines;
  }, [clientProfile]);

  const clusterData = useMemo((): ClusterRowData[] => {
    const pagesForAggregation = taggedRecords.map(r => ({
      cluster: r.cluster || r.clusterName || null,
      clusterSource: r.clusterSource || null,
      estTrafficETV: r.estTrafficETV,
      domain: r.domain,
      pageURL: r.pageURL,
      pageType: r.pageType,
      pageIntent: r.pageIntent,
      priorityTier: r.priorityTier,
    }));
    
    const summaries = aggregateClusterStatsNew(pagesForAggregation);
    
    return summaries.map(summary => {
      const clusterRecords = taggedRecords.filter(r => (r.cluster || r.clusterName) === summary.clusterName);
      
      const intentMix = { transactional: 0, commercial: 0, informational: 0, other: 0 };
      const priorityTiers = { tier1: 0, tier2: 0, tier3: 0, other: 0 };
      
      for (const rec of clusterRecords) {
        const intent = rec.pageIntent?.toUpperCase() || '';
        if (intent === 'TRANSACTIONAL') intentMix.transactional++;
        else if (intent === 'COMMERCIAL_RESEARCH') intentMix.commercial++;
        else if (intent === 'INFORMATIONAL') intentMix.informational++;
        else intentMix.other++;
        
        const tier = rec.priorityTier || '';
        if (tier === 'TIER_1_IMMEDIATE') priorityTiers.tier1++;
        else if (tier === 'TIER_2_HIGH') priorityTiers.tier2++;
        else if (tier === 'TIER_3_MEDIUM') priorityTiers.tier3++;
        else priorityTiers.other++;
      }
      
      const priority = calculateClusterPriority(summary);
      const productMatch = matchClusterToProducts(summary.clusterName, productLines);
      
      return {
        ...summary,
        priority,
        matchedProduct: productMatch.matchedProduct,
        intentMix,
        priorityTiers,
      };
    });
  }, [taggedRecords, productLines]);

  const filteredClusterData = useMemo(() => {
    return clusterData.filter(c => {
      if (priorityFilter !== 'all' && c.priority !== priorityFilter) return false;
      if (clusterFilter && !c.clusterName.toLowerCase().includes(clusterFilter.toLowerCase())) return false;
      return true;
    });
  }, [clusterData, priorityFilter, clusterFilter]);

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
    const totalPages = taggedRecords.length;
    const totalETV = taggedRecords.reduce((sum, r) => sum + (r.estTrafficETV || 0), 0);
    const uniqueClusters = clusterData.length;
    const untaggedCount = filteredRecords.filter(r => !r.cluster).length;
    const aiTaggedCount = taggedRecords.filter(r => r.clusterSource === 'AI').length;
    const ruleTaggedCount = taggedRecords.filter(r => r.clusterSource === 'RULE').length;
    const matchedClusterCount = clusterData.filter(c => c.matchedProduct).length;
    const unmatchedClusterCount = clusterData.filter(c => !c.matchedProduct).length;
    
    return {
      totalPages,
      totalETV,
      uniqueClusters,
      untaggedCount,
      aiTaggedCount,
      ruleTaggedCount,
      matchedClusterCount,
      unmatchedClusterCount,
    };
  }, [taggedRecords, clusterData, filteredRecords]);

  const handleSort = (field: 'clusterEtv' | 'clusterPageCount' | 'avgEtv') => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: 'clusterEtv' | 'clusterPageCount' | 'avgEtv' }) => {
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

  const getClusterPages = (clusterName: string): DomainPageRecord[] => {
    return taggedRecords
      .filter(r => (r.cluster || r.clusterName) === clusterName)
      .sort((a, b) => (b.estTrafficETV || 0) - (a.estTrafficETV || 0));
  };

  return (
    <div>
      <PageHeader
        title="Cluster Intelligence (URL-Based)"
        description="Analyze URL-derived topic clusters across competitor pages with product matching"
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

          <div>
            <label className="block text-xs text-gray-500 mb-1">Search Cluster</label>
            <input
              type="text"
              value={clusterFilter}
              onChange={(e) => setClusterFilter(e.target.value)}
              placeholder="Filter by cluster name..."
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 w-[180px]"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={handleRebuildClusters}
              disabled={rebuilding || !selectedClientCode}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                rebuilding
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              {rebuilding ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Rebuilding...
                </span>
              ) : (
                'Rebuild Clusters'
              )}
            </button>
            
            <ExportButton
              data={sortedClusterData.map(c => ({
                clusterName: c.clusterName,
                pages: c.clusterPageCount,
                totalETV: c.clusterEtv,
                avgETV: c.avgEtv,
                products: c.matchedProduct || 'Not Matched',
                priority: c.priority,
                ruleTagged: c.clusterRuleTaggedCount,
                aiTagged: c.clusterAiTaggedCount,
                transactional: c.intentMix.transactional,
                commercial: c.intentMix.commercial,
                informational: c.intentMix.informational,
                tier1: c.priorityTiers.tier1,
                tier2: c.priorityTiers.tier2,
                tier3: c.priorityTiers.tier3,
                topDomains: c.domains.slice(0, 5).join(', '),
              }))}
              columns={[
                { key: 'clusterName', header: 'Cluster' },
                { key: 'pages', header: 'Pages' },
                { key: 'totalETV', header: 'Total ETV' },
                { key: 'avgETV', header: 'Avg ETV' },
                { key: 'products', header: 'Products' },
                { key: 'priority', header: 'Priority' },
                { key: 'ruleTagged', header: 'Rule Tagged' },
                { key: 'aiTagged', header: 'AI Tagged' },
                { key: 'transactional', header: 'Transactional' },
                { key: 'commercial', header: 'Commercial' },
                { key: 'informational', header: 'Informational' },
                { key: 'tier1', header: 'Tier 1' },
                { key: 'tier2', header: 'Tier 2' },
                { key: 'tier3', header: 'Tier 3' },
                { key: 'topDomains', header: 'Top Domains' },
              ] as ExportColumn<Record<string, unknown>>[]}
              filename={`cluster-intelligence-1-${selectedClientCode}-${new Date().toISOString().split('T')[0]}`}
            />
          </div>
        </div>
        
        {rebuildProgress && (
          <div className="mt-3 p-2 bg-green-50 rounded-md text-sm text-green-700">
            Rebuild complete: {rebuildProgress.done} of {rebuildProgress.total} pages processed
          </div>
        )}
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
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg shadow p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Cluster Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-xs text-gray-500">Unique Clusters</div>
                <div className="text-lg font-bold text-purple-600">{summaryStats.uniqueClusters}</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-xs text-gray-500">Tagged Pages</div>
                <div className="text-lg font-bold text-green-600">{formatNumber(summaryStats.totalPages)}</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-xs text-gray-500">Total ETV</div>
                <div className="text-lg font-bold text-blue-600">{formatNumber(summaryStats.totalETV)}</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-xs text-gray-500">Untagged</div>
                <div className="text-lg font-bold text-gray-500">{formatNumber(summaryStats.untaggedCount)}</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-xs text-gray-500">Rule Tagged</div>
                <div className="text-lg font-bold text-teal-600">{formatNumber(summaryStats.ruleTaggedCount)}</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-xs text-gray-500">AI Tagged</div>
                <div className="text-lg font-bold text-violet-600">{formatNumber(summaryStats.aiTaggedCount)}</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-xs text-gray-500">Matched</div>
                <div className="text-lg font-bold text-green-600">{summaryStats.matchedClusterCount}</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-xs text-gray-500">Not Matched</div>
                <div className="text-lg font-bold text-amber-600">{summaryStats.unmatchedClusterCount}</div>
              </div>
            </div>
          </div>

          {sortedClusterData.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Cluster Data Found</h3>
              <p className="text-gray-500 text-sm mb-4">
                Click &quot;Rebuild Clusters&quot; to tag all pages with URL-based clusters.
              </p>
            </div>
          ) : (
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
                        onClick={() => handleSort('clusterPageCount')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Pages
                          <SortIcon field="clusterPageCount" />
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('clusterEtv')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Total ETV
                          <SortIcon field="clusterEtv" />
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('avgEtv')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Avg ETV
                          <SortIcon field="avgEtv" />
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
                    {sortedClusterData.map((cluster) => (
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
                              {cluster.clusterAiTaggedCount > 0 && (
                                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium">
                                  {cluster.clusterAiTaggedCount} AI
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-900">
                            {formatNumber(cluster.clusterPageCount)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                            {formatNumber(cluster.clusterEtv)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-600">
                            {cluster.avgEtv.toFixed(1)}
                          </td>
                          <td className="px-4 py-3">
                            {cluster.matchedProduct ? (
                              <span className="inline-flex px-2 py-0.5 rounded text-xs bg-green-50 text-green-700 truncate max-w-[120px]" title={cluster.matchedProduct}>
                                {cluster.matchedProduct}
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-700">
                                Not Matched
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getPriorityBadgeColor(cluster.priority)}`}>
                              {cluster.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1 text-[10px]">
                              {cluster.intentMix.transactional > 0 && (
                                <span className="px-1 py-0.5 bg-green-100 text-green-700 rounded" title="Transactional">
                                  T:{cluster.intentMix.transactional}
                                </span>
                              )}
                              {cluster.intentMix.commercial > 0 && (
                                <span className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded" title="Commercial Research">
                                  C:{cluster.intentMix.commercial}
                                </span>
                              )}
                              {cluster.intentMix.informational > 0 && (
                                <span className="px-1 py-0.5 bg-purple-100 text-purple-700 rounded" title="Informational">
                                  I:{cluster.intentMix.informational}
                                </span>
                              )}
                              {cluster.intentMix.other > 0 && (
                                <span className="px-1 py-0.5 bg-gray-100 text-gray-600 rounded" title="Other">
                                  O:{cluster.intentMix.other}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1 text-[10px]">
                              {cluster.priorityTiers.tier1 > 0 && (
                                <span className="px-1 py-0.5 bg-red-100 text-red-700 rounded" title="Tier 1 Immediate">
                                  T1:{cluster.priorityTiers.tier1}
                                </span>
                              )}
                              {cluster.priorityTiers.tier2 > 0 && (
                                <span className="px-1 py-0.5 bg-orange-100 text-orange-700 rounded" title="Tier 2 High">
                                  T2:{cluster.priorityTiers.tier2}
                                </span>
                              )}
                              {cluster.priorityTiers.tier3 > 0 && (
                                <span className="px-1 py-0.5 bg-yellow-100 text-yellow-700 rounded" title="Tier 3 Medium">
                                  T3:{cluster.priorityTiers.tier3}
                                </span>
                              )}
                              {cluster.priorityTiers.other > 0 && (
                                <span className="px-1 py-0.5 bg-gray-100 text-gray-600 rounded" title="Other Tiers">
                                  O:{cluster.priorityTiers.other}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {cluster.domains.slice(0, 3).map((domain, dIdx) => (
                                <span
                                  key={dIdx}
                                  className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-700 truncate max-w-[80px]"
                                  title={domain}
                                >
                                  {domain}
                                </span>
                              ))}
                              {cluster.domains.length > 3 && (
                                <span className="text-[10px] text-gray-500">+{cluster.domains.length - 3}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expandedCluster === cluster.clusterName && (
                          <tr>
                            <td colSpan={9} className="px-4 py-4 bg-gray-50">
                              <div className="pl-6">
                                <h4 className="text-sm font-medium text-gray-700 mb-3">
                                  Pages in cluster &quot;{cluster.clusterName}&quot; ({cluster.clusterPageCount} pages)
                                </h4>
                                <div className="max-h-[300px] overflow-y-auto">
                                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-medium text-gray-500">Domain</th>
                                        <th className="px-3 py-2 text-left font-medium text-gray-500">Page URL</th>
                                        <th className="px-3 py-2 text-right font-medium text-gray-500">ETV</th>
                                        <th className="px-3 py-2 text-center font-medium text-gray-500">Page Type</th>
                                        <th className="px-3 py-2 text-center font-medium text-gray-500">Intent</th>
                                        <th className="px-3 py-2 text-center font-medium text-gray-500">Source</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {getClusterPages(cluster.clusterName).slice(0, 20).map((page, idx) => (
                                        <tr key={idx} className="hover:bg-white">
                                          <td className="px-3 py-2 text-gray-700 truncate max-w-[100px]" title={page.domain}>
                                            {page.domain}
                                          </td>
                                          <td className="px-3 py-2">
                                            <a
                                              href={page.pageURL}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-indigo-600 hover:underline truncate block max-w-[300px]"
                                              title={page.pageURL}
                                            >
                                              {page.pageURL}
                                            </a>
                                          </td>
                                          <td className="px-3 py-2 text-right text-gray-700">
                                            {formatNumber(page.estTrafficETV || 0)}
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">
                                              {page.pageType || '-'}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px]">
                                              {page.pageIntent || '-'}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                              page.clusterSource === 'AI' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'
                                            }`}>
                                              {page.clusterSource || 'RULE'}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                      {getClusterPages(cluster.clusterName).length > 20 && (
                                        <tr>
                                          <td colSpan={6} className="px-3 py-2 text-center text-gray-500 italic">
                                            ... and {getClusterPages(cluster.clusterName).length - 20} more pages
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
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
          )}
        </>
      )}
    </div>
  );
}
