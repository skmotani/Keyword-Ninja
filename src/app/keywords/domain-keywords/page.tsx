'use client';

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import PageHeader from '@/components/PageHeader';
import ExportButton, { ExportColumn } from '@/components/ExportButton';
import AiKwBuilderPanel from './_components/AiKwBuilderPanel';
import { Client, KeywordTag, FitStatus, ProductLine, ClientAIProfile, Tag2Status } from '@/types';

// Helper for clientside normalization matches backend
const normalizeKeyword = (keyword: string): string => {
  return keyword.trim().toLowerCase().replace(/\s+/g, ' ');
};



interface Competitor {
  id: string;
  clientCode: string;
  name: string;
  domain: string;
  isActive: boolean;
  competitionType?: string; // Main Competitor, Partial Competitor, Not a Competitor, etc.
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

const getFitStatusColor = (status: string) => {
  switch (status) {
    case 'BRAND_KW': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'CORE_MATCH': return 'bg-green-100 text-green-800 border-green-200';
    case 'ADJACENT_MATCH': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'REVIEW': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'NO_MATCH': return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'BLANK': return 'bg-gray-50 text-gray-400 border-gray-200 border-dashed';
    default: return 'bg-gray-50 text-gray-500 border-gray-100';
  }
};

const getProductLineColor = (line: string) => {
  switch (line) {
    case 'TWISTING': return 'text-orange-600 bg-orange-50 ring-orange-500/10 font-medium';
    case 'WINDING': return 'text-cyan-600 bg-cyan-50 ring-cyan-500/10 font-medium';
    case 'HEAT_SETTING': return 'text-rose-600 bg-rose-50 ring-rose-500/10 font-medium';
    case 'BRAND_KW': return 'text-purple-600 bg-purple-50 ring-purple-500/10 font-medium';
    case 'MULTIPLE': return 'text-indigo-600 bg-indigo-50 ring-indigo-500/10 font-medium';
    case 'BLANK': return 'text-gray-400 bg-gray-50 ring-gray-500/10 border-gray-200 border-dashed';
    default: return 'text-gray-500 bg-gray-50 ring-gray-500/10';
  }
};

// Product Relevance Filter 2 - TAG2 column colors
const getTag2StatusColor = (status: string) => {
  switch (status) {
    case 'RELEVANT': return 'bg-green-100 text-green-800 border-green-300';
    case 'IRRELEVANT': return 'bg-red-100 text-red-800 border-red-300';
    case 'BRAND': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'REVIEW': return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'BLANK': return 'bg-gray-50 text-gray-400 border-gray-200 border-dashed';
    default: return 'bg-gray-50 text-gray-400 border-gray-200';
  }
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

type SortField = 'position' | 'searchVolume' | 'cpc' | null;
type SortDirection = 'asc' | 'desc';

const domainKeywordsPageHelp = {
  title: 'Competitor Top Keywords',
  description: 'See exactly what keywords your competitors are ranking for, along with their position and search volume.',
  whyWeAddedThis: 'This is the "Spy Tool". Instead of guessing what keywords to target, you can see what is already working for your competitors and "steal" their strategy.',
  examples: ['Competitor X ranks #1 for "best twisting machine" (Vol: 500)', 'Competitor Y ranks #3 for "textile machinery" (Vol: 1000)'],
  nuances: 'We fetch the Top 100 keywords for each domain. These are the "head" terms driving the most traffic. For "long-tail" or specific queries, use the SERP Results tool.',
  useCases: [
    'Discover high-volume keywords you missed',
    'See if competitors are ranking for your brand name',
    'Find content gaps where they rank but you do not'
  ]
};

const domainKeywordsPageDescription = `
  This page reveals the "secret sauce" of your competitors' SEO strategy. 
  It pulls the list of keywords that are driving the most organic traffic to their websites.
  
  **Key Metrics:**
  *   **Position:** Where they rank on Google (1-100).
  *   **Search Volume:** How many people search for this term monthly.
  *   **CPC:** Estimated cost if you were to pay for an ad on this keyword.

  **Data Flow:** 
  Competitor Domain → DataForSEO (Ranked Keywords API) → List of Keywords & Stats.
  
  This data helps prioritize content by showing you what works on [Domain Top Pages](/keywords/domain-pages).
`;

// Helper component for Dictionary Panel
function MatchingDictionaryPanel({ profile, collapsed, onToggle }: { profile: ClientAIProfile | null, collapsed: boolean, onToggle: () => void }) {
  if (!profile) return null;

  // Product Relevance Filter Dictionary (primary)
  const aiTerms = (profile as any).ai_kw_builder_term_dictionary?.terms || [];
  const includeTerms = aiTerms.filter((t: any) => t.bucket === 'include');
  const excludeTerms = aiTerms.filter((t: any) => t.bucket === 'exclude');
  const brandTerms = aiTerms.filter((t: any) => t.bucket === 'brand');
  const reviewTerms = aiTerms.filter((t: any) => t.bucket === 'review');

  const hasProductRelevanceData = aiTerms.length > 0;

  return (
    <div className="bg-white rounded-lg shadow mb-4 border border-gray-100">
      <div
        className="px-4 py-3 border-b flex items-center justify-between cursor-pointer hover:bg-gray-50"
        onClick={onToggle}
      >
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-500"></span>
          Product Relevance Filter Dictionary
          {hasProductRelevanceData && <span className="text-xs text-green-600 font-normal ml-2">✓ Active</span>}
        </h3>
        <button className="text-gray-400 hover:text-gray-600">
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>

      {!collapsed && (
        <div className="p-4">
          {hasProductRelevanceData ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              {/* Include Bucket */}
              <div>
                <div className="font-semibold text-green-700 mb-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  Include → CORE_MATCH ({includeTerms.length})
                </div>
                <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto">
                  {includeTerms.map((t: any) => (
                    <span key={t.term} className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded border border-green-100">{t.term}</span>
                  ))}
                </div>
              </div>

              {/* Exclude Bucket */}
              <div>
                <div className="font-semibold text-red-700 mb-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  Exclude → NO_MATCH ({excludeTerms.length})
                </div>
                <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto">
                  {excludeTerms.map((t: any) => (
                    <span key={t.term} className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded border border-red-100">{t.term}</span>
                  ))}
                </div>
              </div>

              {/* Brand Bucket */}
              <div>
                <div className="font-semibold text-purple-700 mb-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                  Brand → BRAND_KW ({brandTerms.length})
                </div>
                <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto">
                  {brandTerms.map((t: any) => (
                    <span key={t.term} className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-100">{t.term}</span>
                  ))}
                </div>
              </div>

              {/* Review Bucket */}
              <div>
                <div className="font-semibold text-yellow-700 mb-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                  Review → REVIEW ({reviewTerms.length})
                </div>
                <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto">
                  {reviewTerms.map((t: any) => (
                    <span key={t.term} className="px-1.5 py-0.5 bg-yellow-50 text-yellow-700 rounded border border-yellow-100">{t.term}</span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500 text-sm mb-2">No Product Relevance Filter dictionary saved yet.</p>
              <p className="text-gray-400 text-xs">Click "Product Relevance Filter" button above to classify keywords into buckets.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


export default function DomainKeywordsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedClientCode, setSelectedClientCode] = useState<string>('');
  const [profile, setProfile] = useState<ClientAIProfile | null>(null);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [records, setRecords] = useState<DomainKeywordRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [domainFilter, setDomainFilter] = useState<string[]>([]);
  const [isDomainFilterOpen, setIsDomainFilterOpen] = useState(false);
  const [domainFilterSearch, setDomainFilterSearch] = useState('');
  const domainFilterRef = useRef<HTMLDivElement>(null);
  const [includeSelf, setIncludeSelf] = useState(false); // Toggle to include client domain
  const [competitionTypeFilter, setCompetitionTypeFilter] = useState<string[]>([]); // Multi-select competition type filter

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (domainFilterRef.current && !domainFilterRef.current.contains(event.target as Node)) {
        setIsDomainFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute available domains for selection (Competitors + optional Self)
  const domainList = useMemo(() => {
    let list = [...competitors];

    // Filter by competition types if any selected
    if (competitionTypeFilter.length > 0) {
      list = list.filter(c => {
        // Handle "Not Assigned" special case
        if (competitionTypeFilter.includes('Not Assigned')) {
          if (!c.competitionType) return true;
        }
        // Check if competitor's type is in selected filters
        return c.competitionType && competitionTypeFilter.includes(c.competitionType);
      });
    }

    if (includeSelf && selectedClientCode) {
      const client = clients.find(c => c.code === selectedClientCode);
      // Ensure we don't duplicate if client domain is already in competitors
      if (client && client.mainDomain && !list.some(c => c.domain.toLowerCase() === client.mainDomain.toLowerCase())) {
        list.unshift({
          id: 'CLIENT_SELF',
          clientCode: selectedClientCode,
          name: `${client.name} (Self)`,
          domain: client.mainDomain,
          isActive: true,
          competitionType: 'Client'
        });
      }
    }
    return list;
  }, [competitors, includeSelf, clients, selectedClientCode, competitionTypeFilter]);

  // Get unique competition types for filter dropdown (including Not Assigned)
  const uniqueCompetitionTypes = useMemo(() => {
    const types = new Set<string>();
    let hasUnassigned = false;
    competitors.forEach(c => {
      if (c.competitionType) {
        types.add(c.competitionType);
      } else {
        hasUnassigned = true;
      }
    });
    const sortedTypes = Array.from(types).sort();
    if (hasUnassigned) sortedTypes.push('Not Assigned');
    return sortedTypes;
  }, [competitors]);

  // Count for each competition type
  const competitionTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    competitors.forEach(c => {
      const type = c.competitionType || 'Not Assigned';
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }, [competitors]);
  const [locationFilter, setLocationFilter] = useState('all');
  const [keywordFilter, setKeywordFilter] = useState('');
  const [positionMaxFilter, setPositionMaxFilter] = useState('');
  const [volumeMinFilter, setVolumeMinFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [showAiBuilder, setShowAiBuilder] = useState(false);

  // Tagging State (Rule Based)
  const [tags, setTags] = useState<Record<string, KeywordTag>>({});
  const tagsRef = useRef<Record<string, KeywordTag>>({});
  const [isProcessingRules, setIsProcessingRules] = useState(false);

  const [fitFilter, setFitFilter] = useState<string>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [tableCompetitionFilter, setTableCompetitionFilter] = useState<string[]>([]); // Multi-select competition filter for table

  // Create domain to competition type mapping for filtering
  const domainToCompetitionType = useMemo(() => {
    const map: Record<string, string> = {};
    competitors.forEach(c => {
      map[c.domain.toLowerCase()] = c.competitionType || 'Not Assigned';
    });
    return map;
  }, [competitors]);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(100);

  // UI State
  const [dictPanelCollapsed, setDictPanelCollapsed] = useState(false);

  const client = useMemo(() => clients.find(c => c.code === selectedClientCode), [clients, selectedClientCode]);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedClientCode) {
      fetchCompetitors();
      fetchTags();
      fetchProfile();
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

  const fetchProfile = async () => {
    if (!selectedClientCode) return;
    try {
      const res = await fetch(`/api/client-ai-profile?clientCode=${selectedClientCode}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      } else {
        setProfile(null);
      }
    } catch (e) {
      console.error("Failed to fetch profile", e);
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

  const fetchTags = async () => {
    if (!selectedClientCode) return;
    try {
      const res = await fetch(`/api/keywords/tags?clientCode=${selectedClientCode}`);
      const data = await res.json();
      if (data.success) {
        setTags(data.tags);
        tagsRef.current = data.tags;
      }
    } catch (error) {
      console.error("Failed to fetch tags", error);
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

  // Calculate domain counts
  const domainCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    records.forEach(r => {
      counts[r.domain] = (counts[r.domain] || 0) + 1;
    });
    return counts;
  }, [records]);

  // Derived Filtered Records
  const filteredRecords = useMemo(() => {
    let res = records;

    // Domain Filter (Multi-select)
    if (domainFilter.length > 0) {
      res = res.filter(r => domainFilter.includes(r.domain));
    }

    if (locationFilter !== 'all') {
      res = res.filter(r => r.locationCode === locationFilter);
    }

    if (keywordFilter.trim()) {
      const term = keywordFilter.toLowerCase();
      res = res.filter(r => r.keyword.toLowerCase().includes(term));
    }

    if (positionMaxFilter) {
      const max = parseInt(positionMaxFilter);
      if (!isNaN(max)) {
        res = res.filter(r => (r.position ?? 999) <= max);
      }
    }

    if (volumeMinFilter) {
      const min = parseInt(volumeMinFilter);
      if (!isNaN(min)) {
        res = res.filter(r => (r.searchVolume ?? 0) >= min);
      }
    }

    if (fitFilter !== 'all') {
      res = res.filter(r => {
        const tag = tags[normalizeKeyword(r.keyword)];
        const status = tag?.fitStatus || 'BLANK';
        return status === fitFilter;
      });
    }

    if (productFilter !== 'all') {
      res = res.filter(r => {
        const tag = tags[normalizeKeyword(r.keyword)];
        if (productFilter === 'BLANK') return !tag;
        return tag && tag.productLine === productFilter;
      });
    }

    // Competition Type Filter (Multi-select based on domain's competition type)
    if (tableCompetitionFilter.length > 0) {
      res = res.filter(r => {
        const compType = domainToCompetitionType[r.domain.toLowerCase()] || 'Not Assigned';
        return tableCompetitionFilter.includes(compType);
      });
    }

    return res;
  }, [records, domainFilter, locationFilter, keywordFilter, positionMaxFilter, volumeMinFilter, fitFilter, productFilter, tags, tableCompetitionFilter, domainToCompetitionType]);

  const uniqueDomainsInRecords = useMemo(() => {
    const domains = new Set(records.map(r => r.domain));
    return Array.from(domains).sort();
  }, [records]);

  // FIT Status counts for filter display (based on records before fitFilter is applied)
  const fitStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      'ALL': 0,
      'BRAND_KW': 0,
      'CORE_MATCH': 0,
      'NO_MATCH': 0,
      'BLANK': 0
    };
    // Use records filtered by all filters EXCEPT fitFilter
    let baseRecords = records;
    if (domainFilter.length > 0) baseRecords = baseRecords.filter(r => domainFilter.includes(r.domain));
    if (locationFilter !== 'all') baseRecords = baseRecords.filter(r => r.locationCode === locationFilter);
    if (keywordFilter) baseRecords = baseRecords.filter(r => r.keyword.toLowerCase().includes(keywordFilter.toLowerCase()));
    if (positionMaxFilter) {
      const max = parseInt(positionMaxFilter);
      if (!isNaN(max)) baseRecords = baseRecords.filter(r => (r.position ?? 999) <= max);
    }
    if (volumeMinFilter) {
      const min = parseInt(volumeMinFilter);
      if (!isNaN(min)) baseRecords = baseRecords.filter(r => (r.searchVolume ?? 0) >= min);
    }
    if (tableCompetitionFilter.length > 0) {
      baseRecords = baseRecords.filter(r => {
        const compType = domainToCompetitionType[r.domain.toLowerCase()] || 'Not Assigned';
        return tableCompetitionFilter.includes(compType);
      });
    }

    counts['ALL'] = baseRecords.length;
    baseRecords.forEach(r => {
      const tag = tags[normalizeKeyword(r.keyword)];
      const status = tag?.fitStatus || 'BLANK';
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [records, domainFilter, locationFilter, keywordFilter, positionMaxFilter, volumeMinFilter, tableCompetitionFilter, domainToCompetitionType, tags]);

  const handleTagAllKeywords = async () => {
    if (!selectedClientCode) return;
    try {
      setLoading(true);
      const output = await fetch('/api/domain-keywords/tag-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clientCode: selectedClientCode })
      });

      if (!output.ok) throw new Error('Failed to run tag-all');

      const res = await output.json();
      setNotification({ type: 'success', message: `Tagged ${res.taggedCount} keywords. Impact: ${res.impactSummary?.length || 0} updates.` });

      // Refresh data - MUST include fetchTags to update FIT column
      await Promise.all([
        fetchRecords(),
        fetchProfile(),
        fetchTags() // Refresh tags to show updated FIT statuses
      ]);
    } catch (err) {
      console.error(err);
      setNotification({ type: 'error', message: 'Failed to tag all keywords' });
    } finally {
      setLoading(false);
    }
  };

  // Product Relevance Filter 2 - Dynamic Classification
  const [isRunningV2, setIsRunningV2] = useState(false);

  const handleTagAllV2 = async () => {
    if (!selectedClientCode) return;
    try {
      setIsRunningV2(true);
      const output = await fetch('/api/domain-keywords/tag-all-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clientCode: selectedClientCode })
      });

      if (!output.ok) throw new Error('Failed to run tag-all-v2');

      const res = await output.json();
      if (res.success) {
        setNotification({
          type: 'success',
          message: `PRF2 Complete! Relevant: ${res.stats.relevant}, Irrelevant: ${res.stats.irrelevant}, Brand: ${res.stats.brand}, Review: ${res.stats.review}`
        });
      } else {
        throw new Error(res.error || 'Unknown error');
      }

      // Refresh tags to get TAG2 values
      await fetchTags();
    } catch (err) {
      console.error(err);
      setNotification({ type: 'error', message: 'Failed to run Product Relevance Filter 2' });
    } finally {
      setIsRunningV2(false);
    }
  };






  const handleUpdateTag = async (keyword: string, field: 'fitStatus' | 'productLine', value: string) => {
    const normKw = normalizeKeyword(keyword);
    const existing = tags[normKw];

    const updatedTag: KeywordTag = {
      ...existing,
      id: existing?.id || `${selectedClientCode}_${normKw}`,
      clientCode: selectedClientCode,
      keyword: normKw,
      fitStatus: (field === 'fitStatus' ? value : existing?.fitStatus || 'REVIEW') as FitStatus,
      productLine: (field === 'productLine' ? value : existing?.productLine || 'NONE') as ProductLine,
      rationale: 'Manual Override',
      updatedAt: new Date().toISOString()
    } as KeywordTag;

    setTags(prev => ({ ...prev, [normKw]: updatedTag }));

    try {
      const res = await fetch('/api/domain-keywords/tag-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientCode: selectedClientCode,
          keyword: normKw,
          fitStatus: updatedTag.fitStatus,
          productLine: updatedTag.productLine
        })
      });
      if (!res.ok) throw new Error('Failed to save override');
    } catch (e) {
      console.error("Override failed", e);
      setNotification({ type: 'error', message: 'Failed to save tag update.' });
      fetchTags();
    }
  };


  const toggleDomain = (domain: string) => {
    setSelectedDomains(prev => {
      if (prev.includes(domain)) {
        return prev.filter(d => d !== domain);
      }
      return [...prev, domain];
    });
  };

  const selectAllDomains = () => {
    setSelectedDomains(domainList.map(c => c.domain));
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

  useEffect(() => {
    setCurrentPage(1);
  }, [domainFilter, locationFilter, keywordFilter, positionMaxFilter, volumeMinFilter, fitFilter, productFilter, tableCompetitionFilter]);

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

  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedRecords, currentPage, itemsPerPage]);

  // Grouping State
  const [groupByKeyword, setGroupByKeyword] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (groupKey: string) => {
    const newSet = new Set(expandedGroups);
    if (newSet.has(groupKey)) newSet.delete(groupKey);
    else newSet.add(groupKey);
    setExpandedGroups(newSet);
  };

  const groupedData = useMemo(() => {
    if (!groupByKeyword) return [];

    const groups: Record<string, DomainKeywordRecord[]> = {};
    sortedRecords.forEach(r => {
      // Group by Keyword + Location
      const key = `${normalizeKeyword(r.keyword)}|${r.locationCode}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });

    // Convert to array and preserve sort order (roughly)
    // We rely on sortedRecords order. We pick unique keys in order of appearance.
    const uniqueKeys = new Set<string>();
    const groupList: { key: string, items: DomainKeywordRecord[], bestPos: number, volume: number }[] = [];

    sortedRecords.forEach(r => {
      const key = `${normalizeKeyword(r.keyword)}|${r.locationCode}`;
      if (!uniqueKeys.has(key)) {
        uniqueKeys.add(key);
        const items = groups[key];
        const bestPos = Math.min(...items.map(i => i.position ?? 999));
        const volume = items[0].searchVolume ?? 0;
        groupList.push({ key, items, bestPos, volume });
      }
    });

    return groupList;
  }, [sortedRecords, groupByKeyword]);

  const paginatedGroups = useMemo(() => {
    if (!groupByKeyword) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    return groupedData.slice(startIndex, startIndex + itemsPerPage);
  }, [groupedData, currentPage, itemsPerPage, groupByKeyword]);

  const totalPages = Math.ceil((groupByKeyword ? groupedData.length : sortedRecords.length) / itemsPerPage);


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

  const getGoogleSearchUrl = (keyword: string) => {
    return `https://www.google.com/search?q=${encodeURIComponent(keyword)}`;
  };

  const lastFetchedAt = records.length > 0 ? records[0].fetchedAt : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <PageHeader
        title="Domain Top Keywords"
        description="View top ranked keywords per domain with search volume, positions, and Google search links for both IN and GL locations"
        helpInfo={domainKeywordsPageHelp}
        extendedDescription={domainKeywordsPageDescription}
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

          <div className="flex items-center gap-2 pl-4 border-l border-gray-300 ml-2">
            <button
              onClick={handleTagAllKeywords}
              disabled={isProcessingRules || records.length === 0}
              className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${isProcessingRules
                ? 'bg-purple-100 text-purple-700 cursor-wait'
                : 'bg-white text-purple-600 border border-purple-200 hover:bg-purple-50'
                }`}
            >
              {isProcessingRules ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Classifying...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  Tag All Keywords (Rules)
                </>
              )}
            </button>

            {/* Product Relevance Filter 2 Button */}
            <button
              onClick={handleTagAllV2}
              disabled={isRunningV2 || records.length === 0}
              className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${isRunningV2
                ? 'bg-emerald-100 text-emerald-700 cursor-wait'
                : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
                }`}
              title="Dynamic classification using AI Profile patterns → TAG2 column"
            >
              {isRunningV2 ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Running PRF2...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  PRF2 (AI Profile)
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t">
          {/* Domain Selection Header & Toggle */}
          <div className="flex flex-wrap items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <label className="block text-sm font-medium text-gray-700">
                Select Domains ({selectedDomains.length}/{domainList.length})
              </label>

              {/* Add Self Toggle */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 font-medium">Add Self?</label>
                <button
                  onClick={() => setIncludeSelf(!includeSelf)}
                  className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none ${includeSelf ? 'bg-indigo-600' : 'bg-gray-200'}`}
                  title="Include Client Domain in selection list"
                >
                  <span
                    className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${includeSelf ? 'translate-x-[18px]' : 'translate-x-[2px]'}`}
                  />
                </button>
              </div>

              {/* Competition Type Filter - Multi-select */}
              <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-300 relative">
                <label className="text-xs text-gray-600 font-medium">Competition:</label>
                <div className="flex flex-wrap gap-1">
                  {uniqueCompetitionTypes.map(type => {
                    const isSelected = competitionTypeFilter.includes(type);
                    const count = competitionTypeCounts[type] || 0;
                    const colorClass = type === 'Main Competitor' ? 'border-red-400 bg-red-50 text-red-700' :
                      type === 'Partial Competitor' ? 'border-yellow-400 bg-yellow-50 text-yellow-700' :
                        type === 'Indirect Competitor' ? 'border-orange-400 bg-orange-50 text-orange-700' :
                          type === 'Not a Competitor' ? 'border-gray-300 bg-gray-50 text-gray-600' :
                            type === 'Not Assigned' ? 'border-purple-400 bg-purple-50 text-purple-700' :
                              'border-gray-300 bg-gray-50 text-gray-600';
                    return (
                      <button
                        key={type}
                        onClick={() => {
                          if (isSelected) {
                            setCompetitionTypeFilter(prev => prev.filter(t => t !== type));
                          } else {
                            setCompetitionTypeFilter(prev => [...prev, type]);
                          }
                        }}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition-all ${isSelected
                          ? `${colorClass} ring-1 ring-offset-1 ring-indigo-400 font-bold`
                          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-400'
                          }`}
                      >
                        {type} ({count})
                      </button>
                    );
                  })}
                  {competitionTypeFilter.length > 0 && (
                    <button
                      onClick={() => setCompetitionTypeFilter([])}
                      className="text-[10px] px-1.5 py-0.5 text-gray-500 hover:text-red-600"
                      title="Clear all filters"
                    >
                      ✕ Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={selectAllDomains} className="text-xs text-indigo-600 hover:text-indigo-800">Select All</button>
              <button onClick={deselectAllDomains} className="text-xs text-gray-600 hover:text-gray-800">Deselect All</button>
            </div>
          </div>

          {/* Checkbox List */}
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-gray-50 rounded-md">
            {domainList.map(comp => {
              // Color based on competition type
              const getCompetitionColor = () => {
                if (comp.id === 'CLIENT_SELF') return 'border-l-2 border-l-blue-500';
                switch (comp.competitionType) {
                  case 'Main Competitor': return 'border-l-2 border-l-red-500';
                  case 'Partial Competitor': return 'border-l-2 border-l-yellow-500';
                  case 'Indirect Competitor': return 'border-l-2 border-l-orange-400';
                  case 'Not a Competitor': return 'border-l-2 border-l-gray-300';
                  default: return '';
                }
              };

              return (
                <label
                  key={comp.id}
                  title={comp.competitionType || 'Client'}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${getCompetitionColor()} ${selectedDomains.includes(comp.domain)
                    ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedDomains.includes(comp.domain)}
                    onChange={() => toggleDomain(comp.domain)}
                    className="sr-only"
                  />
                  <span className={comp.id === 'CLIENT_SELF' ? 'font-bold underline decoration-dotted' : ''}>
                    {comp.domain}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

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



      {
        notification && (
          <div
            className={`mb-4 p-4 rounded-md ${notification.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
              }`}
          >
            {notification.message}
          </div>
        )
      }

      {
        lastFetchedAt && (
          <div className="mb-4 text-sm text-gray-500">
            Last fetched: {new Date(lastFetchedAt).toLocaleString()}
          </div>
        )
      }

      {/* Summary Stats */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg shadow p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Summary Statistics</h3>

          {/* Grouping Toggle */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-purple-100">
            <span className="text-xs font-medium text-gray-600">Keyword Grouping:</span>
            <button
              onClick={() => { setGroupByKeyword(!groupByKeyword); setCurrentPage(1); }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${groupByKeyword ? 'bg-indigo-600' : 'bg-gray-200'}`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${groupByKeyword ? 'translate-x-4.5' : 'translate-x-1'}`}
                style={{ transform: groupByKeyword ? 'translateX(18px)' : 'translateX(2px)' }}
              />
            </button>
            <span className="text-xs font-bold text-indigo-700">
              {groupByKeyword ? `Yes (${formatNumber(groupedData.length)})` : 'No'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-9 gap-4">
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

      {/* Matching Dictionary Panel */}
      <MatchingDictionaryPanel
        profile={profile}
        collapsed={dictPanelCollapsed}
        onToggle={() => setDictPanelCollapsed(!dictPanelCollapsed)}
      />

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Multi-Select Domain Filter */}
          <div className="min-w-[200px] relative" ref={domainFilterRef}>
            <label className="block text-xs font-medium text-gray-500 mb-1">Filter by Domain</label>
            <button
              onClick={() => setIsDomainFilterOpen(!isDomainFilterOpen)}
              className="w-full text-left border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white flex items-center justify-between"
            >
              <span className="truncate">
                {domainFilter.length === 0
                  ? 'All Domains'
                  : `${domainFilter.length} Selected`
                }
              </span>
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isDomainFilterOpen && (
              <div className="absolute z-10 w-[280px] mt-1 bg-white rounded-md shadow-lg border border-gray-200 p-2">
                <input
                  type="text"
                  placeholder="Search domains..."
                  value={domainFilterSearch}
                  onChange={(e) => setDomainFilterSearch(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="max-h-[200px] overflow-y-auto space-y-1">
                  <div
                    className={`flex items-center px-2 py-1.5 rounded cursor-pointer hover:bg-gray-100 ${domainFilter.length === 0 ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'}`}
                    onClick={() => { setDomainFilter([]); setIsDomainFilterOpen(false); }}
                  >
                    <span className="text-sm font-medium">All Domains</span>
                  </div>
                  {uniqueDomainsInRecords
                    .filter(d => d.toLowerCase().includes(domainFilterSearch.toLowerCase()))
                    .map(domain => {
                      const count = domainCounts[domain] || 0;
                      const isSelected = domainFilter.includes(domain);
                      return (
                        <div
                          key={domain}
                          className={`flex items-center px-2 py-1.5 rounded cursor-pointer hover:bg-gray-100 ${isSelected ? 'bg-indigo-50' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isSelected) {
                              setDomainFilter(domainFilter.filter(d => d !== domain));
                            } else {
                              setDomainFilter([...domainFilter, domain]);
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="h-3 w-3 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 pointer-events-none"
                          />
                          <span className="ml-2 text-sm text-gray-700 flex-1 truncate">{domain}</span>
                          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{count}</span>
                        </div>
                      );
                    })}
                  {uniqueDomainsInRecords.filter(d => d.toLowerCase().includes(domainFilterSearch.toLowerCase())).length === 0 && (
                    <div className="px-2 py-2 text-sm text-gray-500 text-center">No matches</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Fit Status - Pill Buttons with Counts */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Fit Status</label>
            <div className="flex flex-wrap gap-1">
              {[
                { value: 'all', label: 'All', color: 'border-gray-300 bg-gray-50 text-gray-600' },
                { value: 'BRAND_KW', label: 'Brand', color: 'border-purple-400 bg-purple-50 text-purple-700' },
                { value: 'CORE_MATCH', label: 'Core', color: 'border-green-400 bg-green-50 text-green-700' },
                { value: 'NO_MATCH', label: 'No Match', color: 'border-red-400 bg-red-50 text-red-700' },
                { value: 'BLANK', label: 'Blank', color: 'border-gray-300 bg-gray-100 text-gray-500' }
              ].map(f => {
                const count = f.value === 'all' ? fitStatusCounts['ALL'] : fitStatusCounts[f.value] || 0;
                const isSelected = fitFilter === f.value;
                return (
                  <button
                    key={f.value}
                    onClick={() => setFitFilter(f.value)}
                    className={`text-[10px] px-2 py-1 rounded border transition-all ${isSelected
                      ? `${f.color} ring-1 ring-offset-1 ring-indigo-400 font-bold`
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-400'
                      }`}
                  >
                    {f.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Line filter removed */}

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

          {/* Competition Type Filter - Multi-select */}
          <div className="min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Competition Type</label>
            <div className="flex flex-wrap gap-1 border rounded-md px-2 py-1 bg-white min-h-[32px] items-center">
              {uniqueCompetitionTypes.map(type => {
                const isSelected = tableCompetitionFilter.includes(type);
                const count = competitionTypeCounts[type] || 0;
                const colorClass = type === 'Main Competitor' ? 'bg-red-100 text-red-700 border-red-300' :
                  type === 'Partial Competitor' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                    type === 'Indirect Competitor' ? 'bg-orange-100 text-orange-700 border-orange-300' :
                      type === 'Not a Competitor' ? 'bg-gray-100 text-gray-600 border-gray-300' :
                        type === 'Not Assigned' ? 'bg-purple-100 text-purple-700 border-purple-300' :
                          'bg-gray-100 text-gray-600 border-gray-300';
                return (
                  <button
                    key={type}
                    onClick={() => {
                      if (isSelected) {
                        setTableCompetitionFilter(prev => prev.filter(t => t !== type));
                      } else {
                        setTableCompetitionFilter(prev => [...prev, type]);
                      }
                    }}
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-all ${isSelected
                      ? `${colorClass} font-bold ring-1 ring-indigo-400`
                      : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                      }`}
                    title={`${type} (${count} domains)`}
                  >
                    {type.replace(' Competitor', '')} ({count})
                  </button>
                );
              })}
              {tableCompetitionFilter.length > 0 && (
                <button
                  onClick={() => setTableCompetitionFilter([])}
                  className="text-[10px] px-1 text-gray-400 hover:text-red-500"
                  title="Clear filter"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Filter by Keyword</label>
            <input
              type="text"
              value={keywordFilter}
              onChange={e => setKeywordFilter(e.target.value)}
              placeholder="Search keywords..."
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="min-w-[100px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Max Pos</label>
            <input
              type="number"
              value={positionMaxFilter}
              onChange={e => setPositionMaxFilter(e.target.value)}
              placeholder="e.g. 10"
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
            Showing {filteredRecords.length} of {records.length}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 mb-4">
        {/* Harvest Terms button removed */}
        <button
          onClick={() => setShowAiBuilder(true)}
          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded border border-purple-600 text-xs font-bold shadow-sm flex items-center gap-1 animate-pulse"
          title="Open Product Relevance Filter to classify keywords into Include, Exclude, Brand, and Review buckets. Saved dictionary powers the Tag All (Rules) feature."
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          Product Relevance Filter
        </button>
        <button
          onClick={async () => {
            if (!confirm('Reset all FIT statuses to BLANK? This cannot be undone.')) return;
            try {
              setLoading(true);
              const res = await fetch('/api/domain-keywords/reset-tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientCode: selectedClientCode })
              });
              if (res.ok) {
                setNotification({ type: 'success', message: 'All tags reset to BLANK' });
                await fetchTags();
              } else {
                throw new Error('Failed to reset');
              }
            } catch (e) {
              setNotification({ type: 'error', message: 'Failed to reset tags' });
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading || !selectedClientCode}
          className="px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white rounded text-xs font-bold shadow-sm disabled:opacity-50 flex items-center gap-1"
          title="Reset all FIT statuses to BLANK"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reset Tags
        </button>
        <button
          onClick={handleTagAllKeywords}
          disabled={loading || !selectedClientCode}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold shadow-sm disabled:opacity-50 flex items-center gap-1"
          title="🏷️ Tagging Rules (Priority Order):\n1. Exclude bucket → NO_MATCH\n2. Brand bucket → BRAND_KW\n3. Include bucket → CORE_MATCH\n4. No match → BLANK"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          Tag All (Rules)
        </button>
        <ExportButton
          data={filteredRecords.map(record => {
            const tag = tags[normalizeKeyword(record.keyword)];
            const compType = domainToCompetitionType[record.domain.toLowerCase()] || 'Not Assigned';
            return {
              domain: record.domain,
              competitionType: compType,
              label: record.label || '',
              location: record.locationCode,
              language: record.languageCode,
              keyword: record.keyword,
              fit: tag?.fitStatus || 'BLANK',
              product: tag?.productLine || 'NONE',
              tag2: tag?.tag2Status || '',
              tag2Rationale: tag?.tag2Rationale || '',
              rationale: tag?.rationale || '',
              position: record.position ?? '',
              volume: record.searchVolume ?? '',
              cpc: record.cpc ?? '',
              url: record.url || '',
              fetchedAt: record.fetchedAt || '',
              snapshotDate: record.snapshotDate || ''
            };
          })}
          columns={[
            { key: 'domain', header: 'DOMAIN' },
            { key: 'competitionType', header: 'COMP_TYPE' },
            { key: 'label', header: 'LABEL' },
            { key: 'location', header: 'LOC' },
            { key: 'language', header: 'LANG' },
            { key: 'keyword', header: 'KEYWORD' },
            { key: 'fit', header: 'FIT' },

            { key: 'rationale', header: 'RATIONALE' },
            { key: 'position', header: 'POS' },
            { key: 'volume', header: 'VOL' },
            { key: 'cpc', header: 'CPC' },
            { key: 'url', header: 'URL' },
            { key: 'fetchedAt', header: 'FETCHED_AT' },
            { key: 'snapshotDate', header: 'SNAPSHOT_DATE' }
          ]}
          filename={`domain-keywords-${selectedClientCode}-${new Date().toISOString().split('T')[0]}`}
        />
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
        ) : (groupByKeyword ? groupedData : sortedRecords).length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No domain keywords data found or all filtered out.</p>
            <p className="text-sm mt-1">Adjust filters or select domains and click "Fetch".</p>
          </div>
        ) : (
          <div className="overflow-x-auto min-h-[500px]">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider w-[24px]"></th>
                  {groupByKeyword ? (
                    <>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        Keyword Group
                      </th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider w-[35px]">
                        Loc
                      </th>
                      <SortableHeader field="position" label="Best Pos" tooltip="Best Position across domains" />
                      <SortableHeader field="searchVolume" label="Vol" tooltip="Search Volume" />
                      <SortableHeader field="cpc" label="CPC" tooltip="Cost Per Click" />
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        Domains
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Domain</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider w-[35px]">Loc</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider max-w-[150px]">Keyword</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider w-[120px]">Fit</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider max-w-[150px]">Rationale</th>
                      <SortableHeader field="position" label="Pos" tooltip="Position" />
                      <SortableHeader field="searchVolume" label="Vol" tooltip="Search Volume" />
                      <SortableHeader field="cpc" label="CPC" tooltip="Cost Per Click" />
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider w-[50px]">URL</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {groupByKeyword ? (
                  paginatedGroups.map(group => {
                    const isExpanded = expandedGroups.has(group.key);
                    const first = group.items[0];
                    const domains = group.items.map(i => i.domain).join(', ');

                    return (
                      <Fragment key={group.key}>
                        <tr className="hover:bg-gray-50 cursor-pointer bg-gray-50/50" onClick={() => toggleGroup(group.key)}>
                          <td className="px-2 py-2 text-[10px] text-center">
                            <span className="text-gray-400 font-bold">{isExpanded ? '▼' : '▶'}</span>
                          </td>
                          <td className="px-2 py-2 text-[11px] font-semibold text-gray-900">
                            {first.keyword} <span className="text-gray-400 font-normal ml-1">({group.items.length})</span>
                          </td>
                          <td className="px-2 py-2 text-[10px] text-gray-500">{first.locationCode}</td>
                          <td className="px-2 py-2 text-[10px] font-bold text-green-700">{group.bestPos}</td>
                          <td className="px-2 py-2 text-[10px]">{formatNumber(first.searchVolume)}</td>
                          <td className="px-2 py-2 text-[10px]">{formatCurrency(first.cpc)}</td>
                          <td className="px-2 py-2 text-[10px] text-gray-400 truncate max-w-[200px]" title={domains}>
                            {domains}
                          </td>
                        </tr>
                        {isExpanded && group.items.map(record => {
                          const tag = tags[normalizeKeyword(record.keyword)];
                          const fit = tag?.fitStatus || 'BLANK';
                          const prod = tag?.productLine || 'BLANK';

                          return (
                            <tr key={record.id} className="bg-white hover:bg-gray-50 border-l-4 border-l-indigo-500">
                              <td className="px-2 py-1.5 text-[10px]"></td>
                              <td colSpan={2} className="px-2 py-1.5 text-[10px] pl-6 text-gray-700 font-medium">
                                {record.domain}
                              </td>
                              <td className="px-2 py-1.5 text-[10px] text-gray-600">{record.position}</td>
                              <td className="px-2 py-1.5 text-[10px] font-mono text-gray-400">{formatNumber(record.searchVolume)}</td>
                              <td className="px-2 py-1.5 text-[10px] font-mono text-gray-400">{formatCurrency(record.cpc)}</td>
                              <td className="px-2 py-1.5 text-[10px]">
                                <div className="flex gap-2">
                                  <a href={record.url || '#'} target="_blank" className="text-indigo-600 hover:text-indigo-800 underline text-[10px]">View Page</a>
                                  <select
                                    value={fit}
                                    onChange={(e) => handleUpdateTag(record.keyword, 'fitStatus', e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                    className={`text-[9px] py-0 px-1 rounded border-0 focus:ring-0 ${getFitStatusColor(fit)}`}
                                  >
                                    {['BRAND_KW', 'CORE_MATCH', 'ADJACENT_MATCH', 'REVIEW', 'NO_MATCH', 'BLANK'].map(opt => (
                                      <option key={opt} value={opt}>{opt.replace('_', ' ')}</option>
                                    ))}
                                  </select>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })
                ) : (
                  paginatedRecords.map(record => {
                    const tag = tags[normalizeKeyword(record.keyword)];
                    const fit = tag?.fitStatus || 'BLANK';
                    const prod = tag?.productLine || 'BLANK';

                    return (
                      <tr key={record.id} className="hover:bg-gray-50 group">
                        <td className="px-2 py-1.5 text-[10px] w-[24px]">
                          {/* Add Token Button Removed */}
                        </td>
                        <td className="px-2 py-1.5 text-[10px] text-gray-500 whitespace-nowrap">
                          {record.domain}
                        </td>
                        <td className="px-2 py-1.5 text-[10px] text-gray-500">
                          {record.locationCode}
                        </td>
                        <td className="px-2 py-1.5 text-[10px]">
                          <a
                            href={getGoogleSearchUrl(record.keyword)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1 truncate max-w-[200px]"
                            title={record.keyword}
                          >
                            {record.keyword}
                          </a>
                        </td>
                        <td className="px-2 py-1.5 text-[10px]">
                          <select
                            value={fit}
                            onChange={(e) => handleUpdateTag(record.keyword, 'fitStatus', e.target.value)}
                            className={`block w-full text-[10px] py-0.5 px-1 rounded border-0 focus:ring-1 focus:ring-indigo-500 ${getFitStatusColor(fit)}`}
                          >
                            {['BRAND_KW', 'CORE_MATCH', 'ADJACENT_MATCH', 'REVIEW', 'NO_MATCH', 'BLANK'].map(opt => (
                              <option key={opt} value={opt}>{opt.replace('_', ' ')}</option>
                            ))}
                          </select>
                        </td>

                        <td className="px-2 py-1.5 text-[9px] text-gray-500 max-w-[150px] truncate" title={tag?.rationale}>
                          {tag?.rationale || '-'}
                        </td>
                        <td className="px-2 py-1.5 text-[10px]">{record.position ?? '-'}</td>
                        <td className="px-2 py-1.5 text-[10px]">{formatNumber(record.searchVolume)}</td>
                        <td className="px-2 py-1.5 text-[10px]">{formatCurrency(record.cpc)}</td>
                        <td className="px-2 py-1.5 text-[10px]">
                          {record.url ? (
                            <Tooltip text={record.url}>
                              <a href={record.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 hover:underline">Link</a>
                            </Tooltip>
                          ) : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {(groupByKeyword ? groupedData : sortedRecords).length > 0 && (
          <div className="bg-white px-4 py-3 border-t border-gray-200 flex items-center justify-between sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, (groupByKeyword ? groupedData : sortedRecords).length)}</span> of <span className="font-medium">{(groupByKeyword ? groupedData : sortedRecords).length}</span> {groupByKeyword ? 'groups' : 'results'}
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Previous</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Next</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      <AiKwBuilderPanel
        isOpen={showAiBuilder}
        onClose={() => setShowAiBuilder(false)}
        clientCode={selectedClientCode}
        domain={client?.mainDomain || ''}
        industryKey="general"
        rawKeywords={records.map(r => r.keyword)}
        onDictionaryChange={fetchProfile}
      />

    </div >
  );
}
