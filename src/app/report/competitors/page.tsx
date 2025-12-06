'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  domain: string;
}

interface CompetitorEntry {
  domain: string;
  label: string;
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

function generateLabels(domains: string[]): CompetitorEntry[] {
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

  return domains.map(domain => ({
    domain,
    label: finalLabels.get(domain) || normalizeDomainForComparison(extractDomainRoot(domain))
  }));
}

export default function CompetitorReportPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientCode, setSelectedClientCode] = useState<string>('');
  const [serpResults, setSerpResults] = useState<SerpResult[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [domainFilter, setDomainFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState('');

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
      fetchSerpResults();
    }
  }, [selectedClientCode]);

  const fetchSerpResults = async () => {
    if (!selectedClientCode) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/seo/serp?clientCode=${selectedClientCode}&locationCodes=IN,GL`);
      const data = await res.json();
      setSerpResults(data);
    } catch (error) {
      console.error('Failed to fetch SERP results:', error);
    } finally {
      setLoading(false);
    }
  };

  const competitorList = useMemo(() => {
    const uniqueDomains = Array.from(new Set(serpResults.map(r => r.domain))).sort();
    return generateLabels(uniqueDomains);
  }, [serpResults]);

  const filteredList = useMemo(() => {
    let result = competitorList;
    
    if (domainFilter) {
      const lower = domainFilter.toLowerCase();
      result = result.filter(c => c.domain.toLowerCase().includes(lower));
    }
    
    if (labelFilter) {
      const lower = labelFilter.toLowerCase();
      result = result.filter(c => c.label.toLowerCase().includes(lower));
    }
    
    return result;
  }, [competitorList, domainFilter, labelFilter]);

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

  return (
    <div className="max-w-7xl mx-auto p-4">
      <PageHeader
        title="Competitor List"
        description="Unique domains from SERP Results with auto-generated labels"
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
            <p className="font-medium text-gray-800">{filteredList.length} of {competitorList.length}</p>
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
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2">S.No</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2">
                  <Tooltip text="Competitor domain extracted from SERP results. Click to visit the website.">
                    <span className="cursor-help border-b border-dashed border-gray-400">Domain</span>
                  </Tooltip>
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2">
                  <Tooltip text="Auto-generated label based on domain name patterns. Domains with similar names are grouped under the same label.">
                    <span className="cursor-help border-b border-dashed border-gray-400">Label</span>
                  </Tooltip>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-gray-500 text-sm">
                    Loading...
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-gray-500 text-sm">
                    {competitorList.length === 0 
                      ? 'No domains found. Fetch SERP data first from the SERP Results page.'
                      : 'No records match your filters. Try adjusting the filter criteria.'}
                  </td>
                </tr>
              ) : (
                filteredList.map((entry, index) => (
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
