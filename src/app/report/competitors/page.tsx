'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import PageHeader from '@/components/PageHeader';
import ExportButton, { ExportColumn } from '@/components/ExportButton';
import { computeDomainImportanceScores, formatImportanceScore } from '@/lib/domainImportance';
import { DomainClassification } from '@/types';

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
  url: string;
  title: string;
  description: string;
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
  classification?: DomainClassification;
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
  uniqueKeywordCounts: Record<string, number>,
  classifications: Record<string, DomainClassification>
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
      uniqueKeywords: uniqueKeywordCounts[domainLower] || 0,
      classification: classifications[domainLower]
    };
  });
}

function getLocationLabel(code: number): string {
  if (code === 2356) return 'IN';
  if (code === 2840) return 'GL';
  return String(code);
}

function getRelevanceBadgeColor(category: string): string {
  switch (category) {
    case 'Self': return 'bg-indigo-100 text-indigo-800 ring-2 ring-indigo-300';
    case 'Direct Competitor': return 'bg-red-100 text-red-800';
    case 'Adjacent / Weak Competitor': return 'bg-orange-100 text-orange-800';
    case 'Potential Customer / Lead': return 'bg-green-100 text-green-800';
    case 'Marketplace / Channel': return 'bg-blue-100 text-blue-800';
    case 'Service Provider / Partner': return 'bg-purple-100 text-purple-800';
    case 'Educational / Content Only': return 'bg-cyan-100 text-cyan-800';
    case 'Brand / Navigational Only': return 'bg-gray-100 text-gray-800';
    case 'Irrelevant': return 'bg-gray-200 text-gray-500';
    case 'Needs Manual Review': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function getMatchBucketColor(bucket: string): string {
  switch (bucket) {
    case 'High': return 'text-green-700 font-semibold';
    case 'Medium': return 'text-yellow-700';
    case 'Low': return 'text-orange-600';
    case 'None': return 'text-gray-400';
    default: return 'text-gray-500';
  }
}

type SortField = 'importanceScore' | 'appearanceCount' | 'uniqueKeywords' | 'productMatchScoreValue' | null;
type SortDirection = 'asc' | 'desc';

const competitorReportPageHelp = {
  title: 'Competitor Intelligence Report',
  description: 'A comprehensive analysis of competitors in your SERPs, including their traffic value, keyword strategies, and business relevance.',
  whyWeAddedThis: 'SERPs are noisy. This report cuts through the noise to tell you exactly who matters, why they rank, and whether they are a threat or an opportunity.',
  examples: ['Competitor X: High Relevance, 100 Common Keywords', 'Marketplace Y: Low Relevance, High Traffic'],
  nuances: 'This report combines data from SERP Results (Who is ranking?) with Domain Classification (What kind of site is it?) to give a holistic view.',
  useCases: [
    'Identify top 5 direct competitors to track closely',
    'Find "weak" competitors that you can easily outrank',
    'Discover potential partners or B2B leads from the SERPs'
  ]
};

const competitorReportPageDescription = `
  This page is the primary interface for **Competitive Intelligence**. It aggregates data from thousands of search results to build a profile for every domain that appears in your keyword landscape.

  **Key Features:**
  *   **Importance Score**: A proprietary metric that calculates how "visible" a domain is for your specific keyword set.
  *   **Classification Engine**: Tools to label domains as "Competitor", "Partner", "Marketplace", etc.
  *   **Gap Analysis**: See which keywords a competitor ranks for that you don't.

  **Workflow:**
  1.  Review the "Unclassified" domains.
  2.  Use the "Classify" tool to tag them (AI or Manual).
  3.  Add high-priority targets to your "Competitor Master" list.

  **Data Flow:**
  [SERP Results](/keywords/serp-results) → Domain Aggregation → AI Classification → [Competitor Master](/competitors).
`;

export default function CompetitorReportPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientCode, setSelectedClientCode] = useState<string>('');
  const [serpResults, setSerpResults] = useState<SerpResult[]>([]);
  const [keywordApiData, setKeywordApiData] = useState<KeywordApiData[]>([]);
  const [classifications, setClassifications] = useState<Record<string, DomainClassification>>({});
  const [loading, setLoading] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [classifyingDomain, setClassifyingDomain] = useState<string | null>(null);
  const [classifyProgress, setClassifyProgress] = useState({ current: 0, total: 0 });
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [domainFilter, setDomainFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState('');
  const [relevanceFilter, setRelevanceFilter] = useState('');
  const [domainTypeFilter, setDomainTypeFilter] = useState('');
  const [pageIntentFilter, setPageIntentFilter] = useState('');
  const [matchFilter, setMatchFilter] = useState('');
  const [classificationStatusFilter, setClassificationStatusFilter] = useState('');

  const [sortField, setSortField] = useState<SortField>('importanceScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [modalDomain, setModalDomain] = useState<string | null>(null);
  const [explanationModal, setExplanationModal] = useState<DomainClassification | null>(null);

  const [showClassifyModal, setShowClassifyModal] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());
  const [importanceThreshold, setImportanceThreshold] = useState<number>(0);
  const [maxRankFilter, setMaxRankFilter] = useState<number>(100);
  const [topNFilter, setTopNFilter] = useState<number>(0);
  const [onPageTopFilter, setOnPageTopFilter] = useState<number>(0);

  const [domainsToAddToMaster, setDomainsToAddToMaster] = useState<Set<string>>(new Set());
  const [addingToMaster, setAddingToMaster] = useState(false);

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
      const [serpRes, keywordRes, classRes] = await Promise.all([
        fetch(`/api/seo/serp?clientCode=${selectedClientCode}&locationCodes=IN,GL`),
        fetch(`/api/seo/keywords?clientCode=${selectedClientCode}&locationCodes=IN,GL`),
        fetch(`/api/domain-classification?clientCode=${selectedClientCode}`)
      ]);
      const serpData = await serpRes.json();
      const keywordData = await keywordRes.json();
      const classData = await classRes.json();

      setSerpResults(serpData);
      setKeywordApiData(keywordData);

      const classMap: Record<string, DomainClassification> = {};
      for (const c of classData) {
        classMap[c.domain.toLowerCase().trim()] = c;
      }
      setClassifications(classMap);
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

  const { importanceScores, appearanceCounts, uniqueKeywordCounts, domainBreakdowns, serpRowsByDomain } = useMemo(() => {
    const breakdowns: Record<string, RowBreakdown[]> = {};
    const counts: Record<string, number> = {};
    const uniqueKwSets: Record<string, Set<string>> = {};
    const serpByDomain: Record<string, any[]> = {};

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

      if (!serpByDomain[d]) {
        serpByDomain[d] = [];
      }
      serpByDomain[d].push({
        keyword: r.keyword,
        country: getLocationLabel(r.locationCode),
        searchVolume: searchVolume,
        position: r.rank,
        url: r.url,
        pageTitle: r.title,
        pageSnippet: r.description
      });
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
      domainBreakdowns: breakdowns,
      serpRowsByDomain: serpByDomain
    };
  }, [serpResults, keywordVolumeMap]);

  const competitorList = useMemo(() => {
    const uniqueDomains = Array.from(new Set(serpResults.map(r => r.domain))).sort();
    return generateLabelsWithScores(uniqueDomains, importanceScores, appearanceCounts, uniqueKeywordCounts, classifications);
  }, [serpResults, importanceScores, appearanceCounts, uniqueKeywordCounts, classifications]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '';
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
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

    if (relevanceFilter) {
      result = result.filter(c => c.classification?.businessRelevanceCategory === relevanceFilter);
    }

    if (domainTypeFilter) {
      result = result.filter(c => c.classification?.domainType === domainTypeFilter);
    }

    if (pageIntentFilter) {
      result = result.filter(c => c.classification?.pageIntent === pageIntentFilter);
    }

    if (matchFilter) {
      result = result.filter(c => c.classification?.productMatchScoreBucket === matchFilter);
    }

    if (classificationStatusFilter) {
      if (classificationStatusFilter === 'classified') {
        result = result.filter(c => c.classification);
      } else if (classificationStatusFilter === 'not_classified') {
        result = result.filter(c => !c.classification);
      }
    }

    if (sortField) {
      result.sort((a, b) => {
        let aVal: number, bVal: number;
        if (sortField === 'productMatchScoreValue') {
          aVal = a.classification?.productMatchScoreValue ?? -1;
          bVal = b.classification?.productMatchScoreValue ?? -1;
        } else {
          aVal = a[sortField] ?? 0;
          bVal = b[sortField] ?? 0;
        }
        if (sortDirection === 'asc') {
          return aVal - bVal;
        }
        return bVal - aVal;
      });
    }

    return result;
  }, [competitorList, domainFilter, labelFilter, relevanceFilter, domainTypeFilter, pageIntentFilter, matchFilter, classificationStatusFilter, sortField, sortDirection]);

  const labelStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of competitorList) {
      counts[c.label] = (counts[c.label] || 0) + 1;
    }
    return counts;
  }, [competitorList]);

  const classifiedCount = useMemo(() => {
    return competitorList.filter(c => c.classification).length;
  }, [competitorList]);

  const domainAvgRanks = useMemo(() => {
    const avgRanks: Record<string, number> = {};
    for (const [domain, breakdowns] of Object.entries(domainBreakdowns)) {
      if (breakdowns.length > 0) {
        const totalRank = breakdowns.reduce((sum, b) => sum + b.rank, 0);
        avgRanks[domain] = totalRank / breakdowns.length;
      }
    }
    return avgRanks;
  }, [domainBreakdowns]);

  const domainBestRanks = useMemo(() => {
    const bestRanks: Record<string, number> = {};
    for (const [domain, breakdowns] of Object.entries(domainBreakdowns)) {
      if (breakdowns.length > 0) {
        bestRanks[domain] = Math.min(...breakdowns.map(b => b.rank));
      }
    }
    return bestRanks;
  }, [domainBreakdowns]);

  const modalFilteredDomains = useMemo(() => {
    let candidates = competitorList.filter(c => !c.classification);

    if (importanceThreshold > 0) {
      candidates = candidates.filter(c => c.importanceScore >= importanceThreshold);
    }

    if (maxRankFilter < 100) {
      candidates = candidates.filter(c => {
        const avgRank = domainAvgRanks[c.domain.toLowerCase().trim()] || 999;
        return avgRank <= maxRankFilter;
      });
    }

    if (onPageTopFilter > 0) {
      candidates = candidates.filter(c => {
        const bestRank = domainBestRanks[c.domain.toLowerCase().trim()] || 999;
        return bestRank <= onPageTopFilter;
      });
    }

    candidates = candidates.sort((a, b) => b.importanceScore - a.importanceScore);

    if (topNFilter > 0) {
      candidates = candidates.slice(0, topNFilter);
    }

    return candidates;
  }, [competitorList, importanceThreshold, maxRankFilter, topNFilter, domainAvgRanks, onPageTopFilter, domainBestRanks]);

  const domainsToClassify = useMemo(() => {
    if (selectedDomains.size > 0) {
      return modalFilteredDomains.filter(c => selectedDomains.has(c.domain));
    }
    return modalFilteredDomains;
  }, [modalFilteredDomains, selectedDomains]);

  const unclassifiedDomains = useMemo(() => {
    return competitorList.filter(c => !c.classification);
  }, [competitorList]);

  const selectedClientName = clients.find(c => c.code === selectedClientCode)?.name || '';

  const hasFilters = domainFilter || labelFilter || relevanceFilter || domainTypeFilter || pageIntentFilter || matchFilter || classificationStatusFilter;

  const clearFilters = () => {
    setDomainFilter('');
    setLabelFilter('');
    setRelevanceFilter('');
    setDomainTypeFilter('');
    setPageIntentFilter('');
    setMatchFilter('');
    setClassificationStatusFilter('');
  };

  const domainTypes = [
    'OEM / Manufacturer / Product Provider',
    'Service Provider / Agency / Integrator',
    'Marketplace / Directory / Portal',
    'End Customer / Buyer Organization',
    'Educational / Media / Research',
    'Brand / Platform / Corporate Site',
    'Irrelevant Industry',
    'Unknown'
  ];

  const pageIntents = [
    'Transactional',
    'Commercial Investigation',
    'Informational',
    'Directory / Listing',
    'Navigational / Brand',
    'Irrelevant Intent',
    'Unknown'
  ];

  const matchBuckets = ['High', 'Medium', 'Low', 'None'];

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleClassifyDomain = async (entry: CompetitorEntry) => {
    setClassifyingDomain(entry.domain);

    try {
      const domainLower = entry.domain.toLowerCase().trim();
      const serpRows = serpRowsByDomain[domainLower] || [];

      const res = await fetch('/api/domain-classification/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientCode: selectedClientCode,
          domainRow: {
            domain: entry.domain,
            label: entry.label,
            importance: entry.importanceScore,
            keywords: entry.uniqueKeywords,
            appearances: entry.appearanceCount
          },
          serpRows
        })
      });

      const result = await res.json();

      if (res.ok && result.classification) {
        setClassifications(prev => ({
          ...prev,
          [domainLower]: result.classification
        }));
        showNotification('success', `Classified: ${entry.domain}`);
      } else {
        showNotification('error', result.error || 'Failed to classify domain');
      }
    } catch (error) {
      showNotification('error', 'Failed to classify domain');
    } finally {
      setClassifyingDomain(null);
    }
  };

  const openClassifyModal = () => {
    setSelectedDomains(new Set());
    setImportanceThreshold(0);
    setMaxRankFilter(100);
    setTopNFilter(0);
    setOnPageTopFilter(0);
    setShowClassifyModal(true);
  };

  const handleClassifySelected = async () => {
    if (domainsToClassify.length === 0) {
      showNotification('error', 'No domains selected for classification');
      return;
    }

    setShowClassifyModal(false);
    setClassifying(true);
    setClassifyProgress({ current: 0, total: domainsToClassify.length });

    const failedDomains: string[] = [];
    let successCount = 0;

    try {
      for (let i = 0; i < domainsToClassify.length; i++) {
        const entry = domainsToClassify[i];
        setClassifyingDomain(entry.domain);
        setClassifyProgress({ current: i + 1, total: domainsToClassify.length });

        const domainLower = entry.domain.toLowerCase().trim();
        const serpRows = serpRowsByDomain[domainLower] || [];

        try {
          const res = await fetch('/api/domain-classification/classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientCode: selectedClientCode,
              domainRow: {
                domain: entry.domain,
                label: entry.label,
                importance: entry.importanceScore,
                keywords: entry.uniqueKeywords,
                appearances: entry.appearanceCount
              },
              serpRows
            })
          });

          const result = await res.json();

          if (res.ok && result.classification) {
            setClassifications(prev => ({
              ...prev,
              [domainLower]: result.classification
            }));
            successCount++;
          } else {
            failedDomains.push(entry.domain);
            console.error(`Failed to classify ${entry.domain}:`, result.error);
          }
        } catch (fetchError) {
          failedDomains.push(entry.domain);
          console.error(`Error classifying ${entry.domain}:`, fetchError);
        }
      }

      if (failedDomains.length === 0) {
        showNotification('success', `Successfully classified ${successCount} domains`);
      } else if (successCount > 0) {
        showNotification('error', `Classified ${successCount} domains. Failed: ${failedDomains.length} (${failedDomains.slice(0, 3).join(', ')}${failedDomains.length > 3 ? '...' : ''}). Try classifying failed domains individually.`);
      } else {
        showNotification('error', `Classification failed for all ${failedDomains.length} domains. Please check your API key configuration.`);
      }
    } catch (error: any) {
      showNotification('error', error.message || 'Classification failed unexpectedly');
    } finally {
      setClassifying(false);
      setClassifyingDomain(null);
    }
  };

  const toggleDomainSelection = (domain: string) => {
    setSelectedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    let domainsToSelect = unclassifiedDomains
      .filter(c => importanceThreshold === 0 || c.importanceScore >= importanceThreshold)
      .filter(c => maxRankFilter === 100 || (domainAvgRanks[c.domain.toLowerCase().trim()] || 999) <= maxRankFilter)
      .filter(c => onPageTopFilter === 0 || (domainBestRanks[c.domain.toLowerCase().trim()] || 999) <= onPageTopFilter)
      .sort((a, b) => b.importanceScore - a.importanceScore);

    if (topNFilter > 0) {
      domainsToSelect = domainsToSelect.slice(0, topNFilter);
    }
    setSelectedDomains(new Set(domainsToSelect.map(c => c.domain)));
  };

  const clearSelection = () => {
    setSelectedDomains(new Set());
  };

  const toggleMasterSelection = (domain: string) => {
    setDomainsToAddToMaster(prev => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  };

  const toggleAllMasterSelection = () => {
    if (domainsToAddToMaster.size === filteredAndSortedList.length) {
      setDomainsToAddToMaster(new Set());
    } else {
      setDomainsToAddToMaster(new Set(filteredAndSortedList.map(e => e.domain)));
    }
  };

  const clearMasterSelection = () => {
    setDomainsToAddToMaster(new Set());
  };

  const handleAddToMaster = async () => {
    if (domainsToAddToMaster.size === 0) {
      showNotification('error', 'No domains selected');
      return;
    }

    setAddingToMaster(true);

    try {
      const existingRes = await fetch('/api/competitors');
      const existingCompetitors = await existingRes.json();
      const existingDomainSet = new Set(
        existingCompetitors
          .filter((c: any) => c.clientCode === selectedClientCode)
          .map((c: any) => c.domain.toLowerCase().trim())
      );

      const selectedEntries = filteredAndSortedList.filter(e => domainsToAddToMaster.has(e.domain));
      const newEntries = selectedEntries.filter(e => !existingDomainSet.has(e.domain.toLowerCase().trim()));
      const skippedCount = selectedEntries.length - newEntries.length;

      if (newEntries.length === 0) {
        showNotification('error', `All ${skippedCount} selected domain(s) already exist in Competition Master`);
        setDomainsToAddToMaster(new Set());
        setAddingToMaster(false);
        return;
      }

      const domainsToAdd = newEntries.map(entry => ({
        clientCode: selectedClientCode,
        name: entry.domain.split('.')[0].charAt(0).toUpperCase() + entry.domain.split('.')[0].slice(1),
        domain: entry.domain,
        notes: '',
        source: 'Via SERP Search' as const,
        importanceScore: entry.importanceScore,
        domainType: entry.classification?.domainType,
        pageIntent: entry.classification?.pageIntent,
        productMatchScoreValue: entry.classification?.productMatchScoreValue,
        productMatchScoreBucket: entry.classification?.productMatchScoreBucket,
        businessRelevanceCategory: entry.classification?.businessRelevanceCategory,
        explanationSummary: entry.classification?.explanationSummary,
      }));

      const res = await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulk: true, competitors: domainsToAdd }),
      });

      if (res.ok) {
        const result = await res.json();
        const addedCount = result.added || domainsToAdd.length;
        const addedDomains = domainsToAdd.map(c => c.domain);

        localStorage.setItem('competitorMasterNotification', JSON.stringify({
          message: `${addedCount} new competitor(s) added via SERP Search${skippedCount > 0 ? `. ${skippedCount} duplicate(s) skipped.` : ''}`,
          domains: addedDomains,
          timestamp: Date.now()
        }));

        if (skippedCount > 0) {
          showNotification('success', `Added ${addedCount} domain(s) to Competition Master. Skipped ${skippedCount} duplicate(s).`);
        } else {
          showNotification('success', `Added ${addedCount} domain(s) to Competition Master`);
        }
        setDomainsToAddToMaster(new Set());
      } else {
        const error = await res.json();
        showNotification('error', error.message || 'Failed to add domains');
      }
    } catch (error) {
      showNotification('error', 'Failed to add domains to Competition Master');
    } finally {
      setAddingToMaster(false);
    }
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

  const relevanceCategories = [
    'Self',
    'Direct Competitor',
    'Adjacent / Weak Competitor',
    'Potential Customer / Lead',
    'Marketplace / Channel',
    'Service Provider / Partner',
    'Educational / Content Only',
    'Brand / Navigational Only',
    'Irrelevant',
    'Needs Manual Review'
  ];

  return (
    <div className="max-w-7xl mx-auto p-4">
      <PageHeader
        title="Competitor Intelligence Report"
        description="Unique domains from SERP Results with AI-powered classification"
        helpInfo={competitorReportPageHelp}
        extendedDescription={competitorReportPageDescription}
      />

      {notification && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${notification.type === 'success'
          ? 'bg-green-50 text-green-800 border border-green-200'
          : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
          {notification.message}
        </div>
      )}

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
          <Tooltip text="Use AI to automatically classify domains based on their content and relevance to your client.">
            <button
              onClick={openClassifyModal}
              disabled={classifying || loading || competitorList.length === 0}
              className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {classifying ? (
                <>
                  <span className="animate-spin">&#9696;</span>
                  Classifying {classifyProgress.current}/{classifyProgress.total}...
                </>
              ) : (
                <>
                  <span>&#10024;</span>
                  Classify Domains
                </>
              )}
            </button>
          </Tooltip>
          {domainsToAddToMaster.size > 0 && (
            <button
              onClick={handleAddToMaster}
              disabled={addingToMaster}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {addingToMaster ? (
                <>
                  <span className="animate-spin">&#9696;</span>
                  Adding...
                </>
              ) : (
                <>
                  <span>&#10133;</span>
                  Add {domainsToAddToMaster.size} to Competition Master
                </>
              )}
            </button>
          )}
          {domainsToAddToMaster.size > 0 && (
            <button
              onClick={clearMasterSelection}
              className="px-3 py-2 text-gray-600 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50"
            >
              Clear Selection
            </button>
          )}
          <ExportButton
            data={filteredAndSortedList}
            columns={[
              { key: 'domain', header: 'Domain' },
              { key: 'label', header: 'Label' },
              { key: 'importanceScore', header: 'Importance Score', getValue: (row) => row.importanceScore.toFixed(2) },
              { key: 'appearanceCount', header: 'Appearances' },
              { key: 'uniqueKeywords', header: 'Unique Keywords' },
              { key: 'domainType', header: 'Domain Type', getValue: (row) => row.classification?.domainType || '' },
              { key: 'pageIntent', header: 'Page Intent', getValue: (row) => row.classification?.pageIntent || '' },
              { key: 'productMatchScore', header: 'Product Match', getValue: (row) => row.classification?.productMatchScoreBucket || '' },
              { key: 'businessRelevance', header: 'Business Relevance', getValue: (row) => row.classification?.businessRelevanceCategory || '' },
            ]}
            filename={`unique-domains-${selectedClientCode}-${new Date().toISOString().split('T')[0]}`}
            disabled={loading || classifying}
          />
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg border p-3 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
          <div>
            <span className="text-gray-500">Client:</span>
            <p className="font-medium text-gray-800">{selectedClientName || '-'}</p>
          </div>
          <div>
            <span className="text-gray-500">Total Domains:</span>
            <p className="font-medium text-gray-800">{competitorList.length}</p>
          </div>
          <div>
            <span className="text-gray-500">Classified:</span>
            <p className="font-medium text-green-700">{classifiedCount} / {competitorList.length}</p>
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
        <div className="flex justify-between items-center mb-2">
          <p className="text-xs font-medium text-gray-700">Filters</p>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-indigo-600 hover:text-indigo-800"
            >
              Clear all filters
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Domain Search</label>
            <input
              type="text"
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              placeholder="Filter..."
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Status</label>
            <select
              value={classificationStatusFilter}
              onChange={(e) => setClassificationStatusFilter(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All</option>
              <option value="classified">Classified</option>
              <option value="not_classified">Not Classified</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Domain Type</label>
            <select
              value={domainTypeFilter}
              onChange={(e) => setDomainTypeFilter(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All</option>
              {domainTypes.map(type => (
                <option key={type} value={type}>{type.length > 20 ? type.substring(0, 20) + '...' : type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Page Intent</label>
            <select
              value={pageIntentFilter}
              onChange={(e) => setPageIntentFilter(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All</option>
              {pageIntents.map(intent => (
                <option key={intent} value={intent}>{intent}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Match</label>
            <select
              value={matchFilter}
              onChange={(e) => setMatchFilter(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All</option>
              {matchBuckets.map(bucket => (
                <option key={bucket} value={bucket}>{bucket}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Business Relevance</label>
            <select
              value={relevanceFilter}
              onChange={(e) => setRelevanceFilter(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All</option>
              {relevanceCategories.map(cat => (
                <option key={cat} value={cat}>{cat.length > 18 ? cat.substring(0, 18) + '...' : cat}</option>
              ))}
            </select>
          </div>
        </div>
        {hasFilters && (
          <div className="mt-2 pt-2 border-t text-xs text-gray-600">
            <span className="font-medium text-purple-700">{filteredAndSortedList.length}</span> domains match current filters
            {classificationStatusFilter === 'not_classified' && (
              <span className="ml-2 text-orange-600">({filteredAndSortedList.length} pending classification)</span>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="min-w-full">
            <thead className="bg-gray-50 sticky top-0 z-10 overflow-visible">
              <tr>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2 w-[3%]">
                  <input
                    type="checkbox"
                    checked={domainsToAddToMaster.size > 0 && filteredAndSortedList.length > 0 && filteredAndSortedList.every(e => domainsToAddToMaster.has(e.domain))}
                    onChange={toggleAllMasterSelection}
                    className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                    title="Select all visible domains"
                  />
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2 w-[3%]">#</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2 w-[17%]">
                  <Tooltip text="Competitor domain from SERP results">
                    <span className="cursor-help border-b border-dashed border-gray-400">Domain</span>
                  </Tooltip>
                </th>
                <th
                  className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2 w-[8%] cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('importanceScore')}
                >
                  <Tooltip text="Domain Importance Score based on search volume and ranking position">
                    <span className="cursor-help border-b border-dashed border-gray-400">
                      Score{getSortIcon('importanceScore')}
                    </span>
                  </Tooltip>
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2 w-[14%]">
                  <Tooltip text="How this domain behaves in the ecosystem">
                    <span className="cursor-help border-b border-dashed border-gray-400">Domain Type</span>
                  </Tooltip>
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2 w-[12%]">
                  <Tooltip text="Typical intent of pages where this domain appears">
                    <span className="cursor-help border-b border-dashed border-gray-400">Page Intent</span>
                  </Tooltip>
                </th>
                <th
                  className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2 w-[8%] cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('productMatchScoreValue')}
                >
                  <Tooltip text="How well domain matches client's products/topics (0-100%)">
                    <span className="cursor-help border-b border-dashed border-gray-400">
                      Match{getSortIcon('productMatchScoreValue')}
                    </span>
                  </Tooltip>
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2 w-[16%]">
                  <Tooltip text="Final business relevance classification for this domain">
                    <span className="cursor-help border-b border-dashed border-gray-400">Business Relevance</span>
                  </Tooltip>
                </th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-2 w-[8%]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-gray-500 text-sm">
                    Loading...
                  </td>
                </tr>
              ) : filteredAndSortedList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-gray-500 text-sm">
                    {competitorList.length === 0
                      ? 'No domains found. Fetch SERP data first from the SERP Results page.'
                      : 'No records match your filters.'}
                  </td>
                </tr>
              ) : (
                filteredAndSortedList.map((entry, index) => (
                  <tr key={entry.domain} className={`hover:bg-gray-50 ${domainsToAddToMaster.has(entry.domain) ? 'bg-indigo-50' : ''}`}>
                    <td className="text-center py-1.5 px-2">
                      <input
                        type="checkbox"
                        checked={domainsToAddToMaster.has(entry.domain)}
                        onChange={() => toggleMasterSelection(entry.domain)}
                        className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                      />
                    </td>
                    <td className="text-xs text-gray-600 py-1.5 px-2">{index + 1}</td>
                    <td className="text-xs py-1.5 px-2">
                      <a
                        href={`https://${entry.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
                      >
                        {entry.domain}
                      </a>
                    </td>
                    <td className="text-xs text-gray-800 py-1.5 px-2 text-right">
                      <button
                        onClick={() => setModalDomain(entry.domain)}
                        className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer font-semibold"
                      >
                        {formatImportanceScore(entry.importanceScore)}
                      </button>
                    </td>
                    <td className="text-xs text-gray-600 py-1.5 px-2">
                      {entry.classification?.domainType || <span className="text-gray-300">-</span>}
                    </td>
                    <td className="text-xs text-gray-600 py-1.5 px-2">
                      {entry.classification?.pageIntent || <span className="text-gray-300">-</span>}
                    </td>
                    <td className="text-xs py-1.5 px-2 text-center">
                      {entry.classification ? (
                        <span className={getMatchBucketColor(entry.classification.productMatchScoreBucket)}>
                          {Math.round(entry.classification.productMatchScoreValue * 100)}%
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="text-xs py-1.5 px-2">
                      {entry.classification ? (
                        <button
                          onClick={() => setExplanationModal(entry.classification!)}
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer hover:opacity-80 ${getRelevanceBadgeColor(entry.classification.businessRelevanceCategory)}`}
                        >
                          {entry.classification.businessRelevanceCategory}
                        </button>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="text-xs py-1.5 px-2 text-center">
                      {entry.classification ? (
                        <button
                          onClick={() => handleClassifyDomain(entry)}
                          disabled={classifyingDomain === entry.domain}
                          className="text-gray-500 hover:text-purple-600 text-[10px] font-medium px-2 py-0.5 border border-gray-300 rounded hover:border-purple-400"
                          title="Re-classify this domain"
                        >
                          {classifyingDomain === entry.domain ? 'Classifying...' : 'Reclassify'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleClassifyDomain(entry)}
                          disabled={classifyingDomain === entry.domain}
                          className="text-white bg-purple-600 hover:bg-purple-700 text-[10px] font-medium px-2 py-0.5 rounded"
                        >
                          {classifyingDomain === entry.domain ? 'Classifying...' : 'Classify'}
                        </button>
                      )}
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

      {showClassifyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b flex justify-between items-center bg-purple-50">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Select Domains to Classify</h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  {unclassifiedDomains.length} unclassified domains available
                </p>
              </div>
              <button
                onClick={() => setShowClassifyModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none px-2"
              >
                x
              </button>
            </div>

            <div className="p-4 border-b bg-gray-50">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 uppercase mb-1">
                    On Page Top (Best Rank)
                  </label>
                  <select
                    value={onPageTopFilter}
                    onChange={(e) => setOnPageTopFilter(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value={0}>All positions</option>
                    <option value={3}>Top 3 positions</option>
                    <option value={5}>Top 5 positions</option>
                    <option value={10}>Top 10 positions</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-gray-600 uppercase mb-1">
                    Min Importance Score
                  </label>
                  <input
                    type="number"
                    value={importanceThreshold}
                    onChange={(e) => setImportanceThreshold(Number(e.target.value))}
                    min={0}
                    step={100}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-gray-600 uppercase mb-1">
                    Max Avg Rank
                  </label>
                  <input
                    type="number"
                    value={maxRankFilter}
                    onChange={(e) => setMaxRankFilter(Number(e.target.value))}
                    min={1}
                    max={100}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="100"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-gray-600 uppercase mb-1">
                    Limit Results
                  </label>
                  <select
                    value={topNFilter}
                    onChange={(e) => setTopNFilter(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value={0}>No limit</option>
                    <option value={5}>First 5</option>
                    <option value={10}>First 10</option>
                    <option value={20}>First 20</option>
                    <option value={50}>First 50</option>
                  </select>
                </div>

                <div className="flex items-end gap-2">
                  <button
                    onClick={selectAllVisible}
                    className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-100 rounded hover:bg-purple-200"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearSelection}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <div className="mb-2 text-xs text-gray-500">
                Showing {modalFilteredDomains.length} domains (sorted by importance)
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="w-10 px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selectedDomains.size > 0 && modalFilteredDomains.every(d => selectedDomains.has(d.domain))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDomains(new Set(modalFilteredDomains.map(d => d.domain)));
                            } else {
                              setSelectedDomains(new Set());
                            }
                          }}
                          className="w-4 h-4 text-purple-600 rounded"
                        />
                      </th>
                      <th className="text-left text-[10px] font-medium text-gray-500 uppercase px-2 py-2">Domain</th>
                      <th className="text-right text-[10px] font-medium text-gray-500 uppercase px-2 py-2">Score</th>
                      <th className="text-right text-[10px] font-medium text-gray-500 uppercase px-2 py-2">Best Rank</th>
                      <th className="text-right text-[10px] font-medium text-gray-500 uppercase px-2 py-2">Avg Rank</th>
                      <th className="text-right text-[10px] font-medium text-gray-500 uppercase px-2 py-2">Keywords</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {modalFilteredDomains.map((entry) => {
                      const avgRank = domainAvgRanks[entry.domain.toLowerCase().trim()] || 0;
                      const bestRank = domainBestRanks[entry.domain.toLowerCase().trim()] || 0;
                      return (
                        <tr
                          key={entry.domain}
                          className={`hover:bg-gray-50 cursor-pointer ${selectedDomains.has(entry.domain) ? 'bg-purple-50' : ''}`}
                          onClick={() => toggleDomainSelection(entry.domain)}
                        >
                          <td className="px-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={selectedDomains.has(entry.domain)}
                              onChange={() => toggleDomainSelection(entry.domain)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 text-purple-600 rounded"
                            />
                          </td>
                          <td className="text-xs text-gray-800 px-2 py-1.5 font-medium">{entry.domain}</td>
                          <td className="text-xs text-gray-600 px-2 py-1.5 text-right">{formatImportanceScore(entry.importanceScore)}</td>
                          <td className={`text-xs px-2 py-1.5 text-right font-medium ${bestRank <= 3 ? 'text-green-600' : bestRank <= 5 ? 'text-blue-600' : bestRank <= 10 ? 'text-yellow-600' : 'text-gray-600'}`}>
                            {bestRank}
                          </td>
                          <td className="text-xs text-gray-600 px-2 py-1.5 text-right">{avgRank.toFixed(1)}</td>
                          <td className="text-xs text-gray-600 px-2 py-1.5 text-right">{entry.uniqueKeywords}</td>
                        </tr>
                      );
                    })}
                    {modalFilteredDomains.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-sm text-gray-500 py-8">
                          No unclassified domains match the current filters
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-4 py-3 border-t bg-gray-50">
              <div className="flex justify-between items-start">
                <div className="text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-gray-600">Domains to classify:</span>
                    <span className="font-bold text-purple-700 text-lg">
                      {domainsToClassify.length}
                    </span>
                    {selectedDomains.size > 0 && (
                      <span className="text-xs text-gray-500">
                        ({selectedDomains.size} manually selected)
                      </span>
                    )}
                  </div>
                  <p className={`text-xs ${domainsToClassify.length > 20 ? 'text-orange-600' : 'text-gray-500'}`}>
                    {domainsToClassify.length > 20 ? (
                      <>More domains = higher cost and longer processing time. Consider using filters to reduce the selection.</>
                    ) : domainsToClassify.length > 10 ? (
                      <>Moderate selection. Each domain requires an AI call.</>
                    ) : (
                      <>Good selection size for efficient classification.</>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowClassifyModal(false)}
                    className="px-4 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClassifySelected}
                    disabled={domainsToClassify.length === 0}
                    className="px-4 py-1.5 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <span>&#10024;</span>
                    Classify {domainsToClassify.length} Domains
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {explanationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full overflow-hidden">
            <div className="px-4 py-3 border-b flex justify-between items-center bg-purple-50">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Classification Explanation</h3>
                <p className="text-xs text-gray-600 mt-0.5">{explanationModal.domain}</p>
              </div>
              <button
                onClick={() => setExplanationModal(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none px-2"
              >
                x
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Domain Type</p>
                  <p className="text-sm font-medium text-gray-800">{explanationModal.domainType}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Page Intent</p>
                  <p className="text-sm font-medium text-gray-800">{explanationModal.pageIntent}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Product Match</p>
                  <p className={`text-sm font-medium ${getMatchBucketColor(explanationModal.productMatchScoreBucket)}`}>
                    {Math.round(explanationModal.productMatchScoreValue * 100)}% ({explanationModal.productMatchScoreBucket})
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Business Relevance</p>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getRelevanceBadgeColor(explanationModal.businessRelevanceCategory)}`}>
                    {explanationModal.businessRelevanceCategory}
                  </span>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-[10px] text-gray-500 uppercase mb-2">Why This Classification?</p>
                <p className="text-sm text-gray-700 leading-relaxed">{explanationModal.explanationSummary}</p>
              </div>

              <div className="text-[10px] text-gray-400">
                Classified at: {new Date(explanationModal.classifiedAt).toLocaleString()}
              </div>
            </div>

            <div className="px-4 py-3 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => setExplanationModal(null)}
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
