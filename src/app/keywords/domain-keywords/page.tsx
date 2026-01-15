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
  brandNames?: string[]; // Brand names for tagging branded keyword traffic
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

// Helper: Normalize domain for matching (removes www., https://, http://)
const normalizeDomain = (domain: string): string => {
  return domain
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
};

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

type SortField = 'domain' | 'locationCode' | 'keyword' | 'bucket' | 'fitStatus' | 'position' | 'searchVolume' | 'cpc' | null;
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
          Keyword Classification Dictionary
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
              {/* Include | Buy Bucket */}
              <div>
                <div className="font-semibold text-green-700 mb-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  Include | Buy ({includeTerms.length})
                </div>
                <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto">
                  {includeTerms.map((t: any) => (
                    <span key={t.term} className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded border border-green-100">{t.term}</span>
                  ))}
                </div>
              </div>

              {/* Include | Learn Bucket */}
              <div>
                <div className="font-semibold text-blue-700 mb-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  Include | Learn ({reviewTerms.length})
                </div>
                <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto">
                  {reviewTerms.map((t: any) => (
                    <span key={t.term} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">{t.term}</span>
                  ))}
                </div>
              </div>

              {/* Brand | Nav Bucket */}
              <div>
                <div className="font-semibold text-purple-700 mb-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                  Brand | Nav ({brandTerms.length})
                </div>
                <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto">
                  {brandTerms.map((t: any) => (
                    <span key={t.term} className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-100">{t.term}</span>
                  ))}
                </div>
              </div>

              {/* Exclude | Noise Bucket */}
              <div>
                <div className="font-semibold text-red-700 mb-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  Exclude | Noise ({excludeTerms.length})
                </div>
                <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto">
                  {excludeTerms.map((t: any) => (
                    <span key={t.term} className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded border border-red-100">{t.term}</span>
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

  // Delete domain keywords state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
  const [bucketFilter, setBucketFilter] = useState<string[]>([]); // Multi-select bucket filter

  // Create domain to competition type mapping for filtering
  // Uses normalized domains for consistent matching
  const domainToCompetitionType = useMemo(() => {
    const map: Record<string, string> = {};
    competitors.forEach(c => {
      const normalizedKey = normalizeDomain(c.domain);
      map[normalizedKey] = c.competitionType || 'Not Assigned';
    });
    // DEBUG: Log all domains in the mapping
    console.log('[DomainKeywords] Competitor domains in mapping:', Object.keys(map));
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

    // Bucket Filter (Multi-select) - using EXACT match since dictionary only contains full keywords
    if (bucketFilter.length > 0) {
      res = res.filter(r => {
        const aiTerms = profile ? (profile as any).ai_kw_builder_term_dictionary?.terms || [] : [];
        const normalizedKw = normalizeKeyword(r.keyword);
        let bucket: string | null = null;

        // Simple EXACT match
        for (const term of aiTerms) {
          if (normalizedKw === normalizeKeyword(term.term)) {
            bucket = term.bucket;
            break;
          }
        }

        const bucketValue = bucket || 'unassigned';
        return bucketFilter.includes(bucketValue);
      });
    }

    return res;
  }, [records, domainFilter, locationFilter, keywordFilter, positionMaxFilter, volumeMinFilter, fitFilter, productFilter, tags, tableCompetitionFilter, domainToCompetitionType, bucketFilter, profile]);

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

  // Bucket counts for filter display - helper to get bucket for a keyword
  // Using EXACT match since dictionary only contains full keywords
  const getBucketForKeywordMemo = useCallback((keyword: string): string | null => {
    if (!profile) return null;
    const aiTerms = (profile as any).ai_kw_builder_term_dictionary?.terms || [];
    const normalizedKw = normalizeKeyword(keyword);

    // Simple EXACT match
    for (const term of aiTerms) {
      const normalizedTerm = normalizeKeyword(term.term);
      if (normalizedKw === normalizedTerm) {
        return term.bucket;
      }
    }

    return null;
  }, [profile]);

  // Bucket counts for filter display
  const bucketCounts = useMemo(() => {
    const counts: Record<string, number> = {
      'include': 0,
      'exclude': 0,
      'brand': 0,
      'review': 0,
      'unassigned': 0
    };
    // Use records filtered by all filters EXCEPT bucketFilter
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
    if (fitFilter !== 'all') {
      baseRecords = baseRecords.filter(r => {
        const tag = tags[normalizeKeyword(r.keyword)];
        const status = tag?.fitStatus || 'BLANK';
        return status === fitFilter;
      });
    }
    if (tableCompetitionFilter.length > 0) {
      baseRecords = baseRecords.filter(r => {
        const compType = domainToCompetitionType[r.domain.toLowerCase()] || 'Not Assigned';
        return tableCompetitionFilter.includes(compType);
      });
    }

    // Count UNIQUE KEYWORDS per bucket (not rows - same keyword can appear for multiple domains)
    // This ensures bucket counts match the dictionary sidebar which also counts unique keywords
    const seenKeywords = new Set<string>();
    baseRecords.forEach(r => {
      const normalizedKw = normalizeKeyword(r.keyword);
      if (seenKeywords.has(normalizedKw)) return; // Skip duplicate keywords
      seenKeywords.add(normalizedKw);

      const bucket = getBucketForKeywordMemo(r.keyword);
      if (bucket) {
        counts[bucket] = (counts[bucket] || 0) + 1;
      } else {
        counts['unassigned'] = (counts['unassigned'] || 0) + 1;
      }
    });
    return counts;
  }, [records, domainFilter, locationFilter, keywordFilter, positionMaxFilter, volumeMinFilter, fitFilter, tableCompetitionFilter, domainToCompetitionType, tags, getBucketForKeywordMemo, profile]);

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

  // Delete selected filtered domains
  const handleDeleteDomainKeywords = async () => {
    if (!selectedClientCode || domainFilter.length === 0) return;

    setDeleting(true);
    try {
      const res = await fetch('/api/domain-keywords/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientCode: selectedClientCode,
          locationCode: locationFilter !== 'all' ? locationFilter : null,
          domains: domainFilter
        })
      });

      const data = await res.json();

      if (data.success) {
        setNotification({ type: 'success', message: `Deleted ${data.deletedCount} keyword records for ${domainFilter.length} domain(s)` });
        setDomainFilter([]);
        setShowDeleteConfirm(false);
        await fetchRecords(); // Refresh the data
      } else {
        throw new Error(data.error || 'Failed to delete');
      }
    } catch (err) {
      console.error('Delete failed:', err);
      setNotification({ type: 'error', message: 'Failed to delete domain keywords' });
    } finally {
      setDeleting(false);
    }
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
  }, [domainFilter, locationFilter, keywordFilter, positionMaxFilter, volumeMinFilter, fitFilter, productFilter, tableCompetitionFilter, bucketFilter]);

  const sortedRecords = useMemo(() => {
    if (!sortField) return filteredRecords;

    return [...filteredRecords].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (sortField === 'bucket') {
        // Sort by bucket name
        aVal = getBucketForKeywordMemo(a.keyword) || 'zzz'; // unassigned goes last
        bVal = getBucketForKeywordMemo(b.keyword) || 'zzz';
      } else if (sortField === 'fitStatus') {
        const tagA = tags[normalizeKeyword(a.keyword)];
        const tagB = tags[normalizeKeyword(b.keyword)];
        aVal = tagA?.fitStatus || 'BLANK';
        bVal = tagB?.fitStatus || 'BLANK';
      } else if (sortField === 'domain' || sortField === 'locationCode' || sortField === 'keyword') {
        aVal = a[sortField]?.toLowerCase() || '';
        bVal = b[sortField]?.toLowerCase() || '';
      } else {
        // Numeric fields
        aVal = a[sortField] ?? (sortField === 'position' ? 999 : 0);
        bVal = b[sortField] ?? (sortField === 'position' ? 999 : 0);
      }

      // String comparison
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        if (sortDirection === 'asc') {
          return aVal.localeCompare(bVal);
        }
        return bVal.localeCompare(aVal);
      }

      // Numeric comparison
      if (sortDirection === 'asc') {
        return aVal - bVal;
      }
      return bVal - aVal;
    });
  }, [filteredRecords, sortField, sortDirection, tags, getBucketForKeywordMemo]);

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

  // Helper to get bucket name for a keyword from the dictionary ONLY
  // Now using EXACT match since dictionary only contains full keywords
  const getBucketForKeyword = (keyword: string): string | null => {
    if (!profile) return null;
    const aiTerms = (profile as any).ai_kw_builder_term_dictionary?.terms || [];
    const normalizedKw = normalizeKeyword(keyword);

    // Simple EXACT match - dictionary only contains full keywords
    for (const term of aiTerms) {
      const normalizedTerm = normalizeKeyword(term.term);
      if (normalizedKw === normalizedTerm) {
        return term.bucket;
      }
    }

    return null;
  };

  // Get bucket color styling
  const getBucketColor = (bucket: string | null) => {
    switch (bucket) {
      case 'include': return 'bg-green-100 text-green-700';
      case 'exclude': return 'bg-red-100 text-red-700';
      case 'brand': return 'bg-purple-100 text-purple-700';
      case 'review': return 'bg-blue-100 text-blue-700';
      default: return 'text-gray-400';
    }
  };

  // Get bucket display name (matching Product Relevance Filter naming)
  const getBucketDisplayName = (bucket: string | null): string => {
    switch (bucket) {
      case 'include': return 'Include | Buy';
      case 'exclude': return 'Exclude | Noise';
      case 'brand': return 'Brand | Nav';
      case 'review': return 'Include | Learn';
      default: return '-';
    }
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

          {/* Delete Domain Keywords Button */}
          {domainFilter.length > 0 && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3 py-1.5 bg-red-50 text-red-600 text-sm font-medium rounded-md border border-red-200 hover:bg-red-100 hover:border-red-300 flex items-center gap-1.5 transition-colors"
              title={`Delete all keywords for ${domainFilter.length} selected domain(s)`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              🗑️ Delete ({domainFilter.length})
            </button>
          )}

          {/* Fit Status filter REMOVED - Bucket filter is preferred */}

          {/* Bucket Filter - Multi-select Pill Buttons with Counts and Tooltips */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Bucket</label>
            <div className="flex flex-wrap gap-1">
              {[
                { value: 'include', label: 'Include | Buy', color: 'border-green-400 bg-green-50 text-green-700', tooltip: 'Keywords with direct commercial intent related to the client\'s products, machines, services, or solutions. These keywords indicate users who are actively evaluating, comparing, or intending to buy.' },
                { value: 'review', label: 'Include | Learn', color: 'border-blue-400 bg-blue-50 text-blue-700', tooltip: 'Keywords with informational or educational intent that support awareness, research, and early-stage decision-making. This bucket also includes high-traffic industry pages and concept-driven searches.' },
                { value: 'brand', label: 'Brand | Nav', color: 'border-purple-400 bg-purple-50 text-purple-700', tooltip: 'Keywords related to brand names, including the client\'s brand and competitor brands. Primarily navigational in nature, used for brand protection and competitive positioning analysis.' },
                { value: 'exclude', label: 'Exclude | Noise', color: 'border-red-400 bg-red-50 text-red-700', tooltip: 'Keywords that are irrelevant, ambiguous, or out of scope for the client\'s business. These keywords do not justify content creation and are intentionally excluded.' },
                { value: 'unassigned', label: 'Unassigned', color: 'border-gray-300 bg-gray-100 text-gray-500', tooltip: 'Keywords not yet classified. Review and assign to appropriate buckets.' }
              ].map(f => {
                const count = bucketCounts[f.value] || 0;
                const isSelected = bucketFilter.includes(f.value);
                return (
                  <Tooltip key={f.value} text={f.tooltip}>
                    <button
                      onClick={() => {
                        if (isSelected) {
                          setBucketFilter(bucketFilter.filter(b => b !== f.value));
                        } else {
                          setBucketFilter([...bucketFilter, f.value]);
                        }
                      }}
                      className={`text-[10px] px-2 py-1 rounded border transition-all ${isSelected
                        ? `${f.color} ring-1 ring-offset-1 ring-indigo-400 font-bold`
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-400'
                        }`}
                    >
                      {f.label} ({count})
                    </button>
                  </Tooltip>
                );
              })}
              {bucketFilter.length > 0 && (
                <button
                  onClick={() => setBucketFilter([])}
                  className="text-[10px] px-1 text-gray-400 hover:text-red-500"
                  title="Clear bucket filter"
                >
                  ✕
                </button>
              )}
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
            Showing {filteredRecords.length} rows ({new Set(filteredRecords.map(r => r.domain)).size} domains) of {records.length}
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
        <ExportButton
          data={filteredRecords.map(record => {
            const tag = tags[normalizeKeyword(record.keyword)];
            const compType = domainToCompetitionType[record.domain.toLowerCase()] || 'Not Assigned';
            const bucket = getBucketForKeyword(record.keyword);
            const bucketDisplay = bucket ? getBucketDisplayName(bucket) : '';
            return {
              domain: record.domain,
              competitionType: compType,
              label: record.label || '',
              location: record.locationCode,
              language: record.languageCode,
              keyword: record.keyword,
              bucket: bucketDisplay,
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
            { key: 'bucket', header: 'BUCKET' },
            { key: 'fit', header: 'FIT' },
            { key: 'product', header: 'PRODUCT' },
            { key: 'tag2', header: 'TAG2' },
            { key: 'tag2Rationale', header: 'TAG2_RATIONALE' },
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
                      <SortableHeader field="domain" label="Domain" tooltip="Domain Name" />
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Comp</th>
                      <SortableHeader field="locationCode" label="Loc" tooltip="Location Code" />
                      <SortableHeader field="keyword" label="Keyword" tooltip="Keyword" />
                      <SortableHeader field="bucket" label="Bucket" tooltip="Dictionary Bucket" />
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
                        <td className="px-2 py-1.5 text-[10px]">
                          {(() => {
                            const compType = domainToCompetitionType[normalizeDomain(record.domain)] || 'Not Assigned';
                            const colors: Record<string, string> = {
                              'Main': 'bg-red-100 text-red-700',
                              'Not a': 'bg-gray-100 text-gray-500',
                              'Partial': 'bg-yellow-100 text-yellow-700',
                              'Self': 'bg-blue-100 text-blue-700',
                              'Small': 'bg-orange-100 text-orange-700',
                              'Not Assigned': 'bg-gray-50 text-gray-400'
                            };
                            return (
                              <span className={`px-1 py-0.5 rounded text-[8px] font-medium ${colors[compType] || 'bg-gray-100 text-gray-500'}`}>
                                {compType}
                              </span>
                            );
                          })()}
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
                          {(() => {
                            const bucket = getBucketForKeyword(record.keyword);
                            return bucket ? (
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${getBucketColor(bucket)}`}>
                                {getBucketDisplayName(bucket)}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            );
                          })()}
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
        rawKeywordData={records.map(r => ({ keyword: r.keyword, volume: r.searchVolume || 0, domain: r.domain, position: r.position ?? undefined }))}
        onDictionaryChange={fetchProfile}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Domain Keywords</h3>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to permanently delete all keywords for the following domain(s)?
            </p>

            <div className="bg-gray-50 rounded-md p-3 mb-4 max-h-40 overflow-y-auto">
              <ul className="text-sm text-gray-700 space-y-1">
                {domainFilter.map(domain => (
                  <li key={domain} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                    <span className="font-medium">{domain}</span>
                    <span className="text-gray-400 text-xs">({domainCounts[domain] || 0} keywords)</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-red-600 mb-4">
              ⚠️ This action cannot be undone. All keyword data for these domains will be permanently removed.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteDomainKeywords}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Deleting...
                  </>
                ) : (
                  <>Delete {domainFilter.length} Domain(s)</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div >
  );
}
