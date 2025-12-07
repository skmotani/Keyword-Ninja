'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import PageHeader from '@/components/PageHeader';
import { computeDomainImportanceScores, formatImportanceScore } from '@/lib/domainImportance';

interface Client {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface SerpResult {
  id: string;
  clientCode: string;
  domain: string;
  keyword: string;
  rank: number;
  rankAbsolute: number;
  locationCode: number;
}

interface KeywordApiData {
  id: string;
  clientCode: string;
  keywordText: string;
  normalizedKeyword: string;
  searchVolume: number | null;
  locationCode: number;
}

interface CompetitorEntry {
  domain: string;
  label: string;
  importanceScore: number;
  appearanceCount: number;
  uniqueKeywords: number;
}

interface RowBreakdown {
  keyword: string;
  location: string;
  locationCode: number;
  rank: number;
  searchVolume: number;
  rankWeight: number;
  contribution: number;
}

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

function extractDomainRoot(domain: string): string {
  let cleaned = domain.toLowerCase().trim();
  cleaned = cleaned.replace(/^www\./, '');
  const tlds = [
    '.co.in', '.com.au', '.co.uk', '.org.in', '.net.in', '.gov.in',
    '.com', '.org', '.net', '.in', '.io', '.co', '.info', '.biz', '.edu', '.gov'
  ];
  for (const tld of tlds) {
    if (cleaned.endsWith(tld)) {
      cleaned = cleaned.slice(0, -tld.length);
      break;
    }
  }
  return cleaned;
}

function normalizeDomainForComparison(root: string): string {
  return root.replace(/[^a-z0-9]/g, '');
}

function findLongestCommonSubstring(str1: string, str2: string, minLength: number = 4): string | null {
  if (str1.length === 0 || str2.length === 0) return null;
  
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  let maxLen = 0;
  let endIdx = 0;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        if (dp[i][j] > maxLen) {
          maxLen = dp[i][j];
          endIdx = i;
        }
      }
    }
  }
  
  if (maxLen >= minLength) {
    return str1.substring(endIdx - maxLen, endIdx);
  }
  return null;
}

function generateLabelsWithScores(
  domains: string[],
  importanceScores: Record<string, number>,
  appearanceCounts: Record<string, number>,
  uniqueKeywordCounts: Record<string, number>
): CompetitorEntry[] {
  const domainData = domains.map(d => {
    const root = extractDomainRoot(d);
    return {
      domain: d,
      root: root,
      normalized: normalizeDomainForComparison(root)
    };
  });

  const domainToLabel: Map<string, string> = new Map();
  const labelGroups: Map<string, string[]> = new Map();

  for (let i = 0; i < domainData.length; i++) {
    const current = domainData[i];
    if (domainToLabel.has(current.domain)) continue;

    let groupLabel = current.normalized;
    const groupMembers = [current.domain];

    for (let j = i + 1; j < domainData.length; j++) {
      const other = domainData[j];
      if (domainToLabel.has(other.domain)) continue;

      const common = findLongestCommonSubstring(current.normalized, other.normalized, 4);
      if (common && common.length >= 4) {
        groupMembers.push(other.domain);
        if (common.length < groupLabel.length || groupLabel === current.normalized) {
          groupLabel = common;
        }
      }
    }

    for (const member of groupMembers) {
      domainToLabel.set(member, groupLabel);
    }

    if (!labelGroups.has(groupLabel)) {
      labelGroups.set(groupLabel, []);
    }
    labelGroups.get(groupLabel)!.push(...groupMembers);
  }

  const finalLabels: Map<string, string> = new Map();
  Array.from(labelGroups.entries()).forEach(([label, members]) => {
    members.forEach(member => {
      finalLabels.set(member, label);
    });
  });

  return domains.map(domain => {
    const domainLower = domain.toLowerCase().trim();
    return {
      domain,
      label: finalLabels.get(domain) || normalizeDomainForComparison(extractDomainRoot(domain)),
      importanceScore: importanceScores[domainLower] || 0,
      appearanceCount: appearanceCounts[domainLower] || 0,
      uniqueKeywords: uniqueKeywordCounts[domainLower] || 0
    };
  });
}

function getLocationLabel(code: number): string {
  if (code === 2356) return 'IN';
  if (code === 2840) return 'GL';
  return String(code);
}

type SortField = 'importanceScore' | 'appearanceCount' | 'uniqueKeywords' | null;
type SortDirection = 'asc' | 'desc';

export default function CompetitorReportPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientCode, setSelectedClientCode] = useState<string>('');
  const [serpResults, setSerpResults] = useState<SerpResult[]>([]);
  const [keywordApiData, setKeywordApiData] = useState<KeywordApiData[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [domainFilter, setDomainFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState('');
  
  const [sortField, setSortField] = useState<SortField>('importanceScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [modalDomain, setModalDomain] = useState<string | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients');
      const data = await res.json();
      const activeClients = data.filter((c: Client) => c.isActive);
      setClients(activeClients);
      if (activeClients.length > 0) {
        setSelectedClientCode(activeClients[0].code);
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  };

  useEffect(() => {
    if (selectedClientCode) {
      fetchData();
    }
  }, [selectedClientCode]);

  const fetchData = async () => {
    if (!selectedClientCode) return;
    setLoading(true);
    try {
      const [serpRes, keywordRes] = await Promise.all([
        fetch(`/api/seo/serp?clientCode=${selectedClientCode}&locationCodes=IN,GL`),
        fetch(`/api/seo/keywords?clientCode=${selectedClientCode}&locationCodes=IN,GL`)
      ]);
      const serpData = await serpRes.json();
      const keywordData = await keywordRes.json();
      setSerpResults(serpData);
      setKeywordApiData(keywordData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const keywordVolumeMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const kw of keywordApiData) {
      const key = `${kw.keywordText.toLowerCase().trim()}_${kw.locationCode}`;
      if (kw.searchVolume !== null && kw.searchVolume > 0) {
        if (!map[key] || kw.searchVolume > map[key]) {
          map[key] = kw.searchVolume;
        }
      }
    }
    return map;
  }, [keywordApiData]);

  const { importanceScores, appearanceCounts, uniqueKeywordCounts, domainBreakdowns } = useMemo(() => {
    const breakdowns: Record<string, RowBreakdown[]> = {};
    const counts: Record<string, number> = {};
    const uniqueKwSets: Record<string, Set<string>> = {};

    for (const r of serpResults) {
      const d = r.domain.toLowerCase().trim();
      const volKey = `${r.keyword.toLowerCase().trim()}_${r.locationCode}`;
      const searchVolume = keywordVolumeMap[volKey] || 0;
      
      let rankWeight = 0;
      if (typeof r.rank === 'number' && !isNaN(r.rank) && r.rank > 0) {
        rankWeight = 1 / (r.rank + 1);
      }
      const contribution = searchVolume * rankWeight;

      if (!breakdowns[d]) {
        breakdowns[d] = [];
      }
      breakdowns[d].push({
        keyword: r.keyword,
        location: getLocationLabel(r.locationCode),
        locationCode: r.locationCode,
        rank: r.rank,
        searchVolume,
        rankWeight,
        contribution
      });

      counts[d] = (counts[d] || 0) + 1;

      if (!uniqueKwSets[d]) {
        uniqueKwSets[d] = new Set();
      }
      uniqueKwSets[d].add(r.keyword.toLowerCase().trim());
    }

    const rowsForScoring = serpResults.map(r => {
      const volKey = `${r.keyword.toLowerCase().trim()}_${r.locationCode}`;
      return {
        domain: r.domain,
        keyword: r.keyword,
        rank: r.rank,
        searchVolume: keywordVolumeMap[volKey] || 0
      };
    });

    const scores = computeDomainImportanceScores(rowsForScoring);

    const uniqueCounts: Record<string, number> = {};
    for (const [d, kwSet] of Object.entries(uniqueKwSets)) {
      uniqueCounts[d] = kwSet.size;
    }

    return { 
      importanceScores: scores, 
      appearanceCounts: counts, 
      uniqueKeywordCounts: uniqueCounts,
      domainBreakdowns: breakdowns 
    };
  }, [serpResults, keywordVolumeMap]);

  const competitorList = useMemo(() => {
    const uniqueDomains = Array.from(new Set(serpResults.map(r => r.domain))).sort();
    return generateLabelsWithScores(uniqueDomains, importanceScores, appearanceCounts, uniqueKeywordCounts);
  }, [serpResults, importanceScores, appearanceCounts, uniqueKeywordCounts]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const filteredAndSortedList = useMemo(() => {
    let result = [...competitorList];
    
    if (domainFilter) {
      const lower = domainFilter.toLowerCase();
      result = result.filter(c => c.domain.toLowerCase().includes(lower));
    }
    
    if (labelFilter) {
      const lower = labelFilter.toLowerCase();
      result = result.filter(c => c.label.toLowerCase().includes(lower));
    }

    if (sortField) {
      result.sort((a, b) => {
        const aVal = a[sortField] ?? 0;
        const bVal = b[sortField] ?? 0;
        if (sortDirection === 'asc') {
          return aVal - bVal;
        }
        return bVal - aVal;
      });
    }
    
    return result;
  }, [competitorList, domainFilter, labelFilter, sortField, sortDirection]);

  const labelStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of competitorList) {
      counts[c.label] = (counts[c.label] || 0) + 1;
    }
    return counts;
  }, [competitorList]);

  const selectedClientName = clients.find(c => c.code === selectedClientCode)?.name || '';

  const hasFilters = domainFilter || labelFilter;

  const clearFilters = () => {
    setDomainFilter('');
    setLabelFilter('');
  };

  const modalData = useMemo(() => {
    if (!modalDomain) return null;
    const domainLower = modalDomain.toLowerCase().trim();
    const breakdown = domainBreakdowns[domainLower] || [];
    const entry = competitorList.find(c => c.domain.toLowerCase().trim() === domainLower);
    
    const sorted = [...breakdown].sort((a, b) => b.contribution - a.contribution);
    const baseScore = sorted.reduce((sum, row) => sum + row.contribution, 0);
    const appearanceWeight = 1 + (breakdown.length / 10);
    const finalScore = baseScore * appearanceWeight;

    return {
      domain: modalDomain,
      rows: sorted,
      baseScore,
      appearanceCount: breakdown.length,
      uniqueKeywords: entry?.uniqueKeywords || 0,
      appearanceWeight,
      finalScore
    };
  }, [modalDomain, domainBreakdowns, competitorList]);

  return (
    <div className="max-w-7xl mx-auto p-4">
      <PageHeader
        title="Unique Domains"
        description="Unique domains from SERP Results with importance scores and auto-generated labels"
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
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg border p-3 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-gray-500">Client:</span>
            <p className="font-medium text-gray-800">{selectedClientName || '-'}</p>
          </div>
          <div>
            <span className="text-gray-500">Total Unique Domains:</span>
            <p className="font-medium text-gray-800">{competitorList.length}</p>
          </div>
          <div>
            <span className="text-gray-500">Unique Labels:</span>
            <p className="font-medium text-gray-800">{Object.keys(labelStats).length}</p>
          </div>
          <div>
            <span className="text-gray-500">Showing:</span>
            <p className="font-medium text-gray-800">{filteredAndSortedList.length} of {competitorList.length}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-3 mb-4">
        <p className="text-xs font-medium text-gray-700 mb-2">Filters</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
            <label className="block text-[10px] text-gray-500 mb-1">Label Search</label>
            <input
              type="text"
              value={labelFilter}
              onChange={(e) => setLabelFilter(e.target.value)}
              placeholder="Filter by label..."
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
        {hasFilters && (
          <button
            onClick={clearFilters}
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
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2 w-[5%]">S.No</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2 w-[30%]">
                  <Tooltip text="Competitor domain extracted from SERP results. Click to visit the website.">
                    <span className="cursor-help border-b border-dashed border-gray-400">Domain</span>
                  </Tooltip>
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2 w-[15%]">
                  <Tooltip text="Auto-generated label based on domain name patterns. Domains with similar names are grouped under the same label.">
                    <span className="cursor-help border-b border-dashed border-gray-400">Label</span>
                  </Tooltip>
                </th>
                <th 
                  className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2 w-[15%] cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('importanceScore')}
                >
                  <Tooltip text="Domain Importance Score = (sum of searchVolume x rankWeight) x appearanceWeight. Click the score to see detailed calculation.">
                    <span className="cursor-help border-b border-dashed border-gray-400 flex items-center justify-end gap-1">
                      Importance {getSortIcon('importanceScore')}
                    </span>
                  </Tooltip>
                </th>
                <th 
                  className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2 w-[12%] cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('uniqueKeywords')}
                >
                  <Tooltip text="Number of unique keywords where this domain ranks in top 10 SERP results.">
                    <span className="cursor-help border-b border-dashed border-gray-400 flex items-center justify-end gap-1">
                      Keywords {getSortIcon('uniqueKeywords')}
                    </span>
                  </Tooltip>
                </th>
                <th 
                  className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2 w-[13%] cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('appearanceCount')}
                >
                  <Tooltip text="Total SERP row appearances (keyword x location combinations). A domain ranking for same keyword in IN and GL counts as 2 appearances.">
                    <span className="cursor-help border-b border-dashed border-gray-400 flex items-center justify-end gap-1">
                      Appearances {getSortIcon('appearanceCount')}
                    </span>
                  </Tooltip>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500 text-sm">
                    Loading...
                  </td>
                </tr>
              ) : filteredAndSortedList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500 text-sm">
                    {competitorList.length === 0 
                      ? 'No domains found. Fetch SERP data first from the SERP Results page.'
                      : 'No records match your filters. Try adjusting the filter criteria.'}
                  </td>
                </tr>
              ) : (
                filteredAndSortedList.map((entry, index) => (
                  <tr key={entry.domain} className="hover:bg-gray-50">
                    <td className="text-xs text-gray-600 py-1 px-2 leading-tight">{index + 1}</td>
                    <td className="text-xs py-1 px-2 leading-tight">
                      <a
                        href={`https://${entry.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
                        title={`Visit ${entry.domain}`}
                      >
                        {entry.domain}
                      </a>
                    </td>
                    <td className="text-xs text-gray-600 py-1 px-2 leading-tight font-medium">
                      {entry.label}
                    </td>
                    <td className="text-xs text-gray-800 py-1 px-2 leading-tight text-right font-semibold">
                      <button
                        onClick={() => setModalDomain(entry.domain)}
                        className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                        title="Click to see calculation details"
                      >
                        {formatImportanceScore(entry.importanceScore)}
                      </button>
                    </td>
                    <td className="text-xs text-gray-600 py-1 px-2 leading-tight text-right">
                      {entry.uniqueKeywords}
                    </td>
                    <td className="text-xs text-gray-600 py-1 px-2 leading-tight text-right">
                      {entry.appearanceCount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalDomain && modalData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Importance Score Calculation</h3>
                <p className="text-xs text-gray-600 mt-0.5">{modalData.domain}</p>
              </div>
              <button
                onClick={() => setModalDomain(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none px-2"
              >
                x
              </button>
            </div>

            <div className="px-4 py-3 bg-indigo-50 border-b">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
                <div>
                  <span className="text-gray-500">Unique Keywords:</span>
                  <p className="font-semibold text-gray-900">{modalData.uniqueKeywords}</p>
                </div>
                <div>
                  <span className="text-gray-500">Total Appearances:</span>
                  <p className="font-semibold text-gray-900">{modalData.appearanceCount}</p>
                </div>
                <div>
                  <span className="text-gray-500">Base Score:</span>
                  <p className="font-semibold text-gray-900">{modalData.baseScore.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Appearance Weight:</span>
                  <p className="font-semibold text-gray-900">{modalData.appearanceWeight.toFixed(2)}x</p>
                </div>
                <div>
                  <span className="text-gray-500">Final Score:</span>
                  <p className="font-bold text-indigo-700">{formatImportanceScore(modalData.finalScore)}</p>
                </div>
              </div>
              <div className="mt-2 text-[10px] text-gray-600 bg-white rounded px-2 py-1 border">
                <strong>Formula:</strong> Final Score = Base Score x Appearance Weight
                <br />
                <strong>Base Score</strong> = Sum of (Search Volume x Rank Weight) for each SERP row
                <br />
                <strong>Rank Weight</strong> = 1 / (rank + 1) - Position 1 gets 0.5, Position 10 gets 0.09
                <br />
                <strong>Appearance Weight</strong> = 1 + (appearances / 10) - Rewards broad keyword coverage
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="min-w-full">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="text-left text-[10px] font-medium text-gray-500 uppercase py-2 px-2 w-[5%]">#</th>
                    <th className="text-left text-[10px] font-medium text-gray-500 uppercase py-2 px-2 w-[35%]">Keyword</th>
                    <th className="text-center text-[10px] font-medium text-gray-500 uppercase py-2 px-2 w-[8%]">Location</th>
                    <th className="text-right text-[10px] font-medium text-gray-500 uppercase py-2 px-2 w-[8%]">Rank</th>
                    <th className="text-right text-[10px] font-medium text-gray-500 uppercase py-2 px-2 w-[12%]">Search Vol</th>
                    <th className="text-right text-[10px] font-medium text-gray-500 uppercase py-2 px-2 w-[12%]">Rank Weight</th>
                    <th className="text-right text-[10px] font-medium text-gray-500 uppercase py-2 px-2 w-[15%]">Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {modalData.rows.map((row, idx) => (
                    <tr key={`${row.keyword}-${row.locationCode}-${row.rank}`} className="hover:bg-gray-50">
                      <td className="text-[10px] text-gray-500 py-1 px-2">{idx + 1}</td>
                      <td className="text-[10px] text-gray-800 py-1 px-2 font-medium">{row.keyword}</td>
                      <td className="text-[10px] text-gray-600 py-1 px-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${row.location === 'IN' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                          {row.location}
                        </span>
                      </td>
                      <td className="text-[10px] text-gray-600 py-1 px-2 text-right">{row.rank}</td>
                      <td className="text-[10px] text-gray-600 py-1 px-2 text-right">{row.searchVolume.toLocaleString()}</td>
                      <td className="text-[10px] text-gray-600 py-1 px-2 text-right">{row.rankWeight.toFixed(4)}</td>
                      <td className="text-[10px] text-gray-800 py-1 px-2 text-right font-semibold">{row.contribution.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100">
                  <tr>
                    <td colSpan={6} className="text-[10px] font-semibold text-gray-700 py-2 px-2 text-right">Base Score Total:</td>
                    <td className="text-[10px] font-bold text-gray-900 py-2 px-2 text-right">{modalData.baseScore.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="px-4 py-3 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => setModalDomain(null)}
                className="px-4 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
