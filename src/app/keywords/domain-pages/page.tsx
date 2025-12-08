'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PageHeader from '@/components/PageHeader';
import ExportButton, { ExportColumn } from '@/components/ExportButton';
import {
  PageTypeValue,
  PageClassificationIntent,
  ClassificationMethodValue,
  ClassificationConfidenceValue,
  SeoActionValue,
  ClassificationExplanation,
} from '@/types';

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

interface DomainPageRecord {
  id: string;
  clientCode: string;
  domain: string;
  label: string;
  locationCode: string;
  languageCode: string;
  pageURL: string;
  estTrafficETV: number | null;
  keywordsCount: number | null;
  fetchedAt: string;
  snapshotDate: string;
  pageType?: PageTypeValue | null;
  pageIntent?: PageClassificationIntent | null;
  isSeoRelevant?: boolean | null;
  classificationMethod?: ClassificationMethodValue | null;
  classificationConfidence?: ClassificationConfidenceValue | null;
  needsAiReview?: boolean | null;
  seoAction?: SeoActionValue | null;
  classificationExplanation?: ClassificationExplanation | null;
}

const LOCATION_OPTIONS = [
  { code: 'all', label: 'All Locations' },
  { code: 'IN', label: 'India (IN)' },
  { code: 'GL', label: 'Global (GL)' },
];

const PAGE_TYPE_OPTIONS: PageTypeValue[] = [
  'PRODUCT_SERVICE',
  'CATEGORY_COLLECTION',
  'BLOG_ARTICLE_NEWS',
  'RESOURCE_GUIDE_DOC',
  'PRICING_PLANS',
  'LANDING_CAMPAIGN',
  'COMPANY_ABOUT',
  'SUPPORT_CONTACT',
  'CAREERS_HR',
  'LEGAL_POLICY',
  'ACCOUNT_AUTH',
  'OTHER_MISC',
];

const PAGE_INTENT_OPTIONS: PageClassificationIntent[] = [
  'INFORMATIONAL',
  'COMMERCIAL_RESEARCH',
  'TRANSACTIONAL',
  'NAVIGATIONAL',
  'SUPPORT',
  'IRRELEVANT_SEO',
];

const SEO_ACTION_OPTIONS: SeoActionValue[] = [
  'HIGH_PRIORITY_TARGET',
  'CREATE_EQUIVALENT_PAGE',
  'OPTIMIZE_EXISTING_PAGE',
  'ADD_TO_CONTENT_CLUSTER',
  'BACKLINK_PROSPECT',
  'MONITOR_ONLY',
  'IGNORE_IRRELEVANT',
];

const TOOLTIPS = {
  pageType: `Page Type: Identifies the structural type of the page based on URL patterns and Client Master configuration.

Classification priority order:
1. ACCOUNT_AUTH - Login, signup, dashboard, profile pages (not SEO relevant)
2. LEGAL_POLICY - Privacy, terms, cookies, GDPR pages (not SEO relevant)
3. CAREERS_HR - Job listings, career pages (not SEO relevant)
4. SUPPORT_CONTACT - Help, FAQ, contact, dealer locator pages
5. COMPANY_ABOUT - Homepage (root URL) and about/company/team pages
6. PRODUCT_SERVICE - Product, service, machine, equipment pages
7. CATEGORY_COLLECTION - Industry, application, solution hub pages
8. BLOG_ARTICLE_NEWS - Blog posts, news, articles, insights
9. RESOURCE_GUIDE_DOC - Guides, whitepapers, PDFs, documentation
10. PRICING_PLANS - Pricing, plans, subscription pages
11. LANDING_CAMPAIGN - Campaign, promo, demo, webinar pages
12. OTHER_MISC - Fallback when no patterns match (review candidates)

URL patterns from Client Master's urlClassificationSupport are used to improve accuracy.`,
  pageIntent: `Page Intent: Indicates the user's purpose when visiting or searching for this page.

- NAVIGATIONAL: Homepage or brand-specific searches (user knows where they want to go)
- TRANSACTIONAL: Buy, order, pricing signals - ready to convert
- COMMERCIAL_RESEARCH: Compare, review, best - evaluating options
- INFORMATIONAL: Educational content, how-to, guides - learning phase
- SUPPORT: Help, FAQ, contact - existing customer needs
- IRRELEVANT_SEO: Login, legal pages - no SEO value

Intent is derived from keyword signals, page type, and the Client Master brand configuration.`,
  isSeoRelevant: `SEO Relevant?: Indicates whether this page matters for SEO and content strategy.

Marked as NOT relevant (false):
- Legal/Policy pages (privacy, terms, cookies)
- Account/Auth pages (login, signup, dashboard)
- Careers/HR pages (jobs, hiring)
- Pages with IRRELEVANT_SEO intent

Marked as relevant (true):
- Homepage and company pages (monitoring)
- Product/Service pages (key targets)
- Category/Collection pages (topic hubs)
- Blog/Resource pages (content clusters)
- Commercial landing pages

This helps you focus on pages that impact organic visibility.`,
  classificationMethod: `Classification Method: Shows how the classification was determined.

RULE: Classified using URL pattern matching and keyword analysis. Rules use:
- URL path segments matched against Client Master patterns
- Content analysis using product/service/blog keywords
- Homepage detection for root URLs
- No API cost incurred

AI: Rule-based logic was uncertain (LOW confidence or OTHER_MISC), so OpenAI was used to improve accuracy. This incurs API cost but provides better results for ambiguous pages.`,
  classificationConfidence: `Classification Confidence: Indicates reliability of the classification.

HIGH: Strong URL pattern match (e.g., /products/, /blog/, /contact/)
- Matched against Client Master's urlClassificationSupport patterns
- Clear structural indicators in URL segments

MEDIUM: Content-based match using keywords/titles
- No strong URL pattern, but product/service/blog keywords found
- May benefit from AI review for confirmation

LOW: Fallback classification (OTHER_MISC)
- No patterns matched - candidate for AI classification
- Manual review recommended`,
  needsAiReview: `Needs AI Review?: Flags pages for AI-assisted classification.

TRUE when:
- Page Type is OTHER_MISC (no patterns matched)
- Classification Confidence is LOW

These pages are sent to OpenAI when you click "Run AI for Uncertain" to get more accurate classifications based on full context analysis.

FALSE when:
- Strong URL pattern match found
- Confidence is HIGH or MEDIUM`,
  seoAction: `SEO Action: Recommended next step based on page type, intent, and traffic.

- HIGH_PRIORITY_TARGET: Commercial page with high traffic (1000+) and transactional intent. Priority competitor page to outrank.
- ADD_TO_CONTENT_CLUSTER: Blog, resource, or category pages useful for topic cluster strategy.
- MONITOR_ONLY: Track but not priority - includes homepage, low-traffic commercial pages.
- IGNORE_IRRELEVANT: Utility pages (legal, login, careers) with no SEO impact.

Traffic thresholds and page type combinations determine the action automatically.`,
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
          <div className="bg-gray-900 text-white text-[10px] leading-tight rounded px-2 py-1.5 shadow-lg max-w-80">
            {text}
          </div>
          <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

interface ExplanationModalProps {
  explanation: ClassificationExplanation | null;
  onClose: () => void;
}

function ExplanationModal({ explanation, onClose }: ExplanationModalProps) {
  if (!explanation) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-gray-900">How this classification was calculated</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500">Source:</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                explanation.source === 'AI' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {explanation.source}
              </span>
              {explanation.model && (
                <span className="text-xs text-gray-400">({explanation.model})</span>
              )}
            </div>

            {explanation.firedRules && explanation.firedRules.length > 0 && (
              <div>
                <span className="text-sm font-medium text-gray-500">Rules fired:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {explanation.firedRules.map((rule, idx) => (
                    <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-700 font-mono">
                      {rule}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <span className="text-sm font-medium text-gray-500">Reasoning:</span>
              <p className="mt-1 text-sm text-gray-700 bg-gray-50 p-3 rounded">{explanation.reasoning}</p>
            </div>

            <div>
              <span className="text-sm font-medium text-gray-500">Inputs used:</span>
              <div className="mt-1 bg-gray-50 p-3 rounded text-xs space-y-1">
                <div><span className="font-medium">URL:</span> <span className="text-gray-600 break-all">{explanation.inputs.pageUrl}</span></div>
                {explanation.inputs.keyword && <div><span className="font-medium">Keyword:</span> <span className="text-gray-600">{explanation.inputs.keyword}</span></div>}
                {explanation.inputs.pageTitle && <div><span className="font-medium">Title:</span> <span className="text-gray-600">{explanation.inputs.pageTitle}</span></div>}
                {explanation.inputs.pageSnippet && <div><span className="font-medium">Snippet:</span> <span className="text-gray-600">{explanation.inputs.pageSnippet}</span></div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type SortField = 'estTrafficETV' | 'keywordsCount' | null;
type SortDirection = 'asc' | 'desc';

function formatPageType(type: PageTypeValue | null | undefined): string {
  if (!type) return '-';
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatPageIntent(intent: PageClassificationIntent | null | undefined): string {
  if (!intent) return '-';
  return intent.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatSeoAction(action: SeoActionValue | null | undefined): string {
  if (!action) return '-';
  return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getPageTypeBadgeColor(type: PageTypeValue | null | undefined): string {
  if (!type) return 'bg-gray-100 text-gray-600';
  const colors: Record<PageTypeValue, string> = {
    PRODUCT_SERVICE: 'bg-green-100 text-green-800',
    CATEGORY_COLLECTION: 'bg-blue-100 text-blue-800',
    BLOG_ARTICLE_NEWS: 'bg-purple-100 text-purple-800',
    RESOURCE_GUIDE_DOC: 'bg-indigo-100 text-indigo-800',
    PRICING_PLANS: 'bg-orange-100 text-orange-800',
    LANDING_CAMPAIGN: 'bg-pink-100 text-pink-800',
    COMPANY_ABOUT: 'bg-cyan-100 text-cyan-800',
    SUPPORT_CONTACT: 'bg-yellow-100 text-yellow-800',
    CAREERS_HR: 'bg-amber-100 text-amber-800',
    LEGAL_POLICY: 'bg-gray-100 text-gray-600',
    ACCOUNT_AUTH: 'bg-gray-100 text-gray-600',
    OTHER_MISC: 'bg-slate-100 text-slate-600',
  };
  return colors[type] || 'bg-gray-100 text-gray-600';
}

function getIntentBadgeColor(intent: PageClassificationIntent | null | undefined): string {
  if (!intent) return 'bg-gray-100 text-gray-600';
  const colors: Record<PageClassificationIntent, string> = {
    INFORMATIONAL: 'bg-blue-100 text-blue-800',
    COMMERCIAL_RESEARCH: 'bg-purple-100 text-purple-800',
    TRANSACTIONAL: 'bg-green-100 text-green-800',
    NAVIGATIONAL: 'bg-cyan-100 text-cyan-800',
    SUPPORT: 'bg-yellow-100 text-yellow-800',
    IRRELEVANT_SEO: 'bg-gray-100 text-gray-500',
  };
  return colors[intent] || 'bg-gray-100 text-gray-600';
}

function getSeoActionBadgeColor(action: SeoActionValue | null | undefined): string {
  if (!action) return 'bg-gray-100 text-gray-600';
  const colors: Record<SeoActionValue, string> = {
    HIGH_PRIORITY_TARGET: 'bg-red-100 text-red-800',
    CREATE_EQUIVALENT_PAGE: 'bg-green-100 text-green-800',
    OPTIMIZE_EXISTING_PAGE: 'bg-blue-100 text-blue-800',
    ADD_TO_CONTENT_CLUSTER: 'bg-purple-100 text-purple-800',
    BACKLINK_PROSPECT: 'bg-orange-100 text-orange-800',
    MONITOR_ONLY: 'bg-yellow-100 text-yellow-800',
    IGNORE_IRRELEVANT: 'bg-gray-100 text-gray-500',
  };
  return colors[action] || 'bg-gray-100 text-gray-600';
}

export default function DomainPagesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedClientCode, setSelectedClientCode] = useState<string>('');
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [records, setRecords] = useState<DomainPageRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [aiClassifying, setAiClassifying] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [urlFilter, setUrlFilter] = useState('');
  const [trafficMinFilter, setTrafficMinFilter] = useState('');
  const [keywordsMinFilter, setKeywordsMinFilter] = useState('');
  const [pageTypeFilter, setPageTypeFilter] = useState<string>('all');
  const [pageIntentFilter, setPageIntentFilter] = useState<string>('all');
  const [seoRelevantFilter, setSeoRelevantFilter] = useState<string>('all');
  const [seoActionFilter, setSeoActionFilter] = useState<string>('all');
  const [classificationMethodFilter, setClassificationMethodFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [selectedExplanation, setSelectedExplanation] = useState<ClassificationExplanation | null>(null);

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
      const res = await fetch('/api/domain-pages/fetch', {
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
          message: `Successfully fetched ${data.totalPages} pages across ${data.locations?.length || 2} locations.`,
        });
        await fetchRecords();
      } else {
        setNotification({
          type: 'error',
          message: data.error || 'Failed to refresh domain pages data.',
        });
      }
    } catch (error) {
      console.error('Error refreshing domain pages:', error);
      setNotification({
        type: 'error',
        message: 'An error occurred while refreshing domain pages data.',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleClassifyPages = async (useAi: boolean = false) => {
    if (!selectedClientCode) return;
    
    if (useAi) {
      setAiClassifying(true);
    } else {
      setClassifying(true);
    }
    setNotification(null);

    try {
      const res = await fetch('/api/page-classification/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientCode: selectedClientCode,
          useAi,
          forceReclassify: !useAi,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setNotification({
          type: 'success',
          message: `Classification complete: ${data.stats.ruleClassified} rule-based, ${data.stats.aiClassified} AI-classified. ${data.stats.needsAiReview} still need AI review.`,
        });
        await fetchRecords();
      } else {
        setNotification({
          type: 'error',
          message: data.error || 'Failed to classify pages.',
        });
      }
    } catch (error) {
      console.error('Error classifying pages:', error);
      setNotification({
        type: 'error',
        message: 'An error occurred while classifying pages.',
      });
    } finally {
      setClassifying(false);
      setAiClassifying(false);
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

    if (urlFilter) {
      const lower = urlFilter.toLowerCase();
      filtered = filtered.filter(r => r.pageURL.toLowerCase().includes(lower));
    }

    if (trafficMinFilter) {
      const min = parseInt(trafficMinFilter);
      if (!isNaN(min)) {
        filtered = filtered.filter(r => (r.estTrafficETV ?? 0) >= min);
      }
    }

    if (keywordsMinFilter) {
      const min = parseInt(keywordsMinFilter);
      if (!isNaN(min)) {
        filtered = filtered.filter(r => (r.keywordsCount ?? 0) >= min);
      }
    }

    if (pageTypeFilter !== 'all') {
      filtered = filtered.filter(r => r.pageType === pageTypeFilter);
    }

    if (pageIntentFilter !== 'all') {
      filtered = filtered.filter(r => r.pageIntent === pageIntentFilter);
    }

    if (seoRelevantFilter !== 'all') {
      const isRelevant = seoRelevantFilter === 'true';
      filtered = filtered.filter(r => r.isSeoRelevant === isRelevant);
    }

    if (seoActionFilter !== 'all') {
      filtered = filtered.filter(r => r.seoAction === seoActionFilter);
    }

    if (classificationMethodFilter !== 'all') {
      filtered = filtered.filter(r => r.classificationMethod === classificationMethodFilter);
    }

    return filtered;
  }, [records, domainFilter, locationFilter, urlFilter, trafficMinFilter, keywordsMinFilter, pageTypeFilter, pageIntentFilter, seoRelevantFilter, seoActionFilter, classificationMethodFilter]);

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
    const uniquePages = new Set(filteredRecords.map(r => r.pageURL)).size;
    const totalRecords = filteredRecords.length;
    const totalTraffic = filteredRecords.reduce((sum, r) => sum + (r.estTrafficETV ?? 0), 0);
    const totalKeywords = filteredRecords.reduce((sum, r) => sum + (r.keywordsCount ?? 0), 0);
    const avgTraffic = totalRecords > 0 ? totalTraffic / totalRecords : 0;
    const inCount = filteredRecords.filter(r => r.locationCode === 'IN').length;
    const glCount = filteredRecords.filter(r => r.locationCode === 'GL').length;
    const classifiedCount = filteredRecords.filter(r => r.pageType).length;
    const needsAiReviewCount = filteredRecords.filter(r => r.needsAiReview).length;

    return { uniqueDomains, uniquePages, totalRecords, totalTraffic, totalKeywords, avgTraffic, inCount, glCount, classifiedCount, needsAiReviewCount };
  }, [filteredRecords]);

  const SortableHeader = ({ field, label, tooltip }: { field: SortField; label: string; tooltip: string }) => (
    <th
      className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
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

  const truncateUrl = (url: string, maxLen: number = 40) => {
    if (url.length <= maxLen) return url;
    return url.substring(0, maxLen) + '...';
  };

  const lastFetchedAt = records.length > 0 ? records[0].fetchedAt : null;

  return (
    <div className="max-w-full mx-auto px-4 py-8">
      <PageHeader 
        title="Domain Top Pages" 
        description="View top organic pages per domain with traffic, keyword counts, and page classification for SEO strategy"
      />

      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">Extraction Limit:</span> 30 pages per domain per location
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

          <div className="flex gap-2 flex-wrap">
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
                  Fetching...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Fetch Data
                </>
              )}
            </button>

            <button
              onClick={() => handleClassifyPages(false)}
              disabled={classifying || records.length === 0}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {classifying ? (
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Classify (Rules)
                </>
              )}
            </button>

            <button
              onClick={() => handleClassifyPages(true)}
              disabled={aiClassifying || summaryStats.needsAiReviewCount === 0}
              className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {aiClassifying ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  AI Classifying...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Run AI for Uncertain ({summaryStats.needsAiReviewCount})
                </>
              )}
            </button>

            <ExportButton
              data={sortedRecords}
              columns={[
                { key: 'domain', header: 'Domain' },
                { key: 'locationCode', header: 'Location' },
                { key: 'pageURL', header: 'Page URL' },
                { key: 'estTrafficETV', header: 'Est. Traffic (ETV)' },
                { key: 'keywordsCount', header: 'Keywords Count' },
                { key: 'pageType', header: 'Page Type' },
                { key: 'pageIntent', header: 'Page Intent' },
                { key: 'isSeoRelevant', header: 'SEO Relevant' },
                { key: 'seoAction', header: 'SEO Action' },
                { key: 'classificationConfidence', header: 'Confidence' },
                { key: 'classificationMethod', header: 'Method' },
              ] as ExportColumn<DomainPageRecord>[]}
              filename={`domain-pages-${selectedClientCode}-${new Date().toISOString().split('T')[0]}`}
            />
          </div>
        </div>

        {lastFetchedAt && (
          <span className="text-xs text-gray-500 mt-2 block">
            Last fetched: {new Date(lastFetchedAt).toLocaleString()}
          </span>
        )}

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

      <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-lg shadow p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Summary Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3">
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500">Domains</div>
            <div className="text-lg font-bold text-indigo-600">{summaryStats.uniqueDomains}</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500">Unique Pages</div>
            <div className="text-lg font-bold text-green-600">{formatNumber(summaryStats.uniquePages)}</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500">Total Records</div>
            <div className="text-lg font-bold text-gray-600">{formatNumber(summaryStats.totalRecords)}</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500">Total Traffic</div>
            <div className="text-lg font-bold text-blue-600">{formatNumber(summaryStats.totalTraffic)}</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500">Total Keywords</div>
            <div className="text-lg font-bold text-purple-600">{formatNumber(summaryStats.totalKeywords)}</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500">Avg Traffic</div>
            <div className="text-lg font-bold text-orange-600">{formatNumber(Math.round(summaryStats.avgTraffic))}</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500">IN Records</div>
            <div className="text-lg font-bold text-yellow-600">{summaryStats.inCount}</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500">GL Records</div>
            <div className="text-lg font-bold text-teal-600">{summaryStats.glCount}</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500">Classified</div>
            <div className="text-lg font-bold text-green-600">{summaryStats.classifiedCount}</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500">Needs AI</div>
            <div className="text-lg font-bold text-purple-600">{summaryStats.needsAiReviewCount}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Domain</label>
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
          <div>
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
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Page Type</label>
            <select
              value={pageTypeFilter}
              onChange={e => setPageTypeFilter(e.target.value)}
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Types</option>
              {PAGE_TYPE_OPTIONS.map(type => (
                <option key={type} value={type}>{formatPageType(type)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Page Intent</label>
            <select
              value={pageIntentFilter}
              onChange={e => setPageIntentFilter(e.target.value)}
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Intents</option>
              {PAGE_INTENT_OPTIONS.map(intent => (
                <option key={intent} value={intent}>{formatPageIntent(intent)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">SEO Action</label>
            <select
              value={seoActionFilter}
              onChange={e => setSeoActionFilter(e.target.value)}
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Actions</option>
              {SEO_ACTION_OPTIONS.map(action => (
                <option key={action} value={action}>{formatSeoAction(action)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">SEO Relevant</label>
            <select
              value={seoRelevantFilter}
              onChange={e => setSeoRelevantFilter(e.target.value)}
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Method</label>
            <select
              value={classificationMethodFilter}
              onChange={e => setClassificationMethodFilter(e.target.value)}
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All</option>
              <option value="RULE">Rule</option>
              <option value="AI">AI</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">URL Filter</label>
            <input
              type="text"
              value={urlFilter}
              onChange={e => setUrlFilter(e.target.value)}
              placeholder="Type to filter..."
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Min Traffic</label>
            <input
              type="number"
              value={trafficMinFilter}
              onChange={e => setTrafficMinFilter(e.target.value)}
              placeholder="0"
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Min Keywords</label>
            <input
              type="number"
              value={keywordsMinFilter}
              onChange={e => setKeywordsMinFilter(e.target.value)}
              placeholder="0"
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div className="text-sm text-gray-500 mt-3">
          Showing {sortedRecords.length} of {records.length} pages
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center">
            <svg className="animate-spin h-8 w-8 mx-auto text-indigo-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="mt-2 text-gray-500">Loading domain pages data...</p>
          </div>
        ) : sortedRecords.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No domain pages data found.</p>
            <p className="text-sm mt-1">Select domains and click "Fetch Data" to get data.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Domain
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Loc
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Page URL
                </th>
                <SortableHeader
                  field="estTrafficETV"
                  label="Traffic"
                  tooltip="Estimated Traffic Value for this page"
                />
                <SortableHeader
                  field="keywordsCount"
                  label="KWs"
                  tooltip="Number of keywords this page ranks for"
                />
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Tooltip text={TOOLTIPS.pageType}>
                    <span className="flex items-center gap-1">Page Type <span className="text-gray-400">ⓘ</span></span>
                  </Tooltip>
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Tooltip text={TOOLTIPS.pageIntent}>
                    <span className="flex items-center gap-1">Intent <span className="text-gray-400">ⓘ</span></span>
                  </Tooltip>
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Tooltip text={TOOLTIPS.isSeoRelevant}>
                    <span className="flex items-center gap-1">SEO? <span className="text-gray-400">ⓘ</span></span>
                  </Tooltip>
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Tooltip text={TOOLTIPS.seoAction}>
                    <span className="flex items-center gap-1">Action <span className="text-gray-400">ⓘ</span></span>
                  </Tooltip>
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Tooltip text={TOOLTIPS.classificationConfidence}>
                    <span className="flex items-center gap-1">Conf <span className="text-gray-400">ⓘ</span></span>
                  </Tooltip>
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Tooltip text={TOOLTIPS.classificationMethod}>
                    <span className="flex items-center gap-1">Method <span className="text-gray-400">ⓘ</span></span>
                  </Tooltip>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedRecords.map(record => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm text-gray-500 whitespace-nowrap">
                    {record.domain.length > 20 ? record.domain.substring(0, 20) + '...' : record.domain}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                      record.locationCode === 'IN' 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-teal-100 text-teal-800'
                    }`}>
                      {record.locationCode}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm max-w-[200px]">
                    <Tooltip text={record.pageURL}>
                      <a
                        href={record.pageURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 hover:underline truncate block"
                      >
                        {truncateUrl(record.pageURL)}
                      </a>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2 text-sm font-medium text-right">
                    {formatNumber(record.estTrafficETV)}
                  </td>
                  <td className="px-3 py-2 text-sm font-medium text-right">
                    {formatNumber(record.keywordsCount)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {record.pageType ? (
                      <div className="flex items-center gap-1">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getPageTypeBadgeColor(record.pageType)}`}>
                          {formatPageType(record.pageType)}
                        </span>
                        {record.classificationExplanation && (
                          <button
                            onClick={() => setSelectedExplanation(record.classificationExplanation!)}
                            className="text-gray-400 hover:text-indigo-600 text-xs"
                            title="View explanation"
                          >
                            ?
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {record.pageIntent ? (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getIntentBadgeColor(record.pageIntent)}`}>
                        {formatPageIntent(record.pageIntent)}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {record.isSeoRelevant !== null && record.isSeoRelevant !== undefined ? (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                        record.isSeoRelevant ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {record.isSeoRelevant ? 'Yes' : 'No'}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {record.seoAction ? (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getSeoActionBadgeColor(record.seoAction)}`}>
                        {formatSeoAction(record.seoAction)}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {record.classificationConfidence ? (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                        record.classificationConfidence === 'HIGH' ? 'bg-green-100 text-green-800' :
                        record.classificationConfidence === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {record.classificationConfidence}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {record.classificationMethod ? (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                        record.classificationMethod === 'AI' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {record.classificationMethod}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedExplanation && (
        <ExplanationModal
          explanation={selectedExplanation}
          onClose={() => setSelectedExplanation(null)}
        />
      )}
    </div>
  );
}
