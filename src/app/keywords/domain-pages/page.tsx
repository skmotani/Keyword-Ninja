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
  PriorityTier,
  PriorityScoreBreakdown,
} from '@/types';
import {
  formatPriorityTier,
  getPriorityTierBadgeColor,
} from '@/lib/priorityScoring';

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
  priorityScore?: number | null;
  priorityTier?: PriorityTier | null;
  priorityScoreBreakdown?: PriorityScoreBreakdown | null;
  priorityCalculatedAt?: string | null;
}

const LOCATION_OPTIONS = [
  { code: 'all', label: 'All Locations' },
  { code: 'IN', label: 'India (IN)' },
  { code: 'GL', label: 'Global (GL)' },
];

const PAGE_TYPE_OPTIONS: PageTypeValue[] = [
  'HOME_PAGE',
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

const PRIORITY_TIER_OPTIONS: PriorityTier[] = [
  'TIER_1_IMMEDIATE',
  'TIER_2_HIGH',
  'TIER_3_MEDIUM',
  'TIER_4_MONITOR',
  'TIER_5_IGNORE',
];

interface HelpContent {
  title: string;
  description: string;
  sections: {
    heading: string;
    items: { label: string; description: string }[];
  }[];
  source?: string;
  apiField?: string;
}

const HELP_CONTENT: Record<string, HelpContent> = {
  traffic: {
    title: 'Estimated Traffic Value (ETV)',
    description: 'The estimated monthly organic traffic this page receives based on its ranking positions and search volumes.',
    sections: [
      {
        heading: 'DataForSEO API Details',
        items: [
          { label: 'API Endpoint', description: 'DataForSEO Labs API - Domain Pages' },
          { label: 'Field Name', description: 'etv (Estimated Traffic Value)' },
          { label: 'Calculation Method', description: 'Sum of (Search Volume × CTR for Position) across all ranking keywords' },
          { label: 'Data Freshness', description: 'Updated monthly based on SERP data collection' },
        ],
      },
      {
        heading: 'How to Interpret',
        items: [
          { label: 'High Traffic (1000+)', description: 'Priority pages driving significant organic visibility. Target for competitive analysis.' },
          { label: 'Medium Traffic (100-999)', description: 'Pages with moderate visibility. Good candidates for optimization.' },
          { label: 'Low Traffic (<100)', description: 'Pages with limited organic reach. May need content improvement or link building.' },
        ],
      },
      {
        heading: 'CTR Model (Click-Through Rate)',
        items: [
          { label: 'Position 1', description: '~28-32% CTR' },
          { label: 'Position 2', description: '~15-17% CTR' },
          { label: 'Position 3', description: '~10-11% CTR' },
          { label: 'Positions 4-10', description: 'Declining CTR from ~8% to ~2%' },
        ],
      },
    ],
    source: 'DataForSEO Labs API',
    apiField: 'etv',
  },
  keywords: {
    title: 'Keywords Count',
    description: 'The total number of unique keywords for which this page ranks in organic search results.',
    sections: [
      {
        heading: 'DataForSEO API Details',
        items: [
          { label: 'API Endpoint', description: 'DataForSEO Labs API - Domain Pages' },
          { label: 'Field Name', description: 'count (Keywords Count)' },
          { label: 'Scope', description: 'All keywords where this URL appears in top 100 organic results' },
          { label: 'Data Freshness', description: 'Updated monthly based on SERP data collection' },
        ],
      },
      {
        heading: 'How to Interpret',
        items: [
          { label: 'High Count (50+)', description: 'Page has strong topical authority and ranks for many related terms.' },
          { label: 'Medium Count (10-49)', description: 'Page has moderate keyword coverage. Opportunity to expand content.' },
          { label: 'Low Count (<10)', description: 'Page targets a narrow topic or lacks comprehensive content.' },
        ],
      },
      {
        heading: 'SEO Insights',
        items: [
          { label: 'Keyword Cannibalization', description: 'Multiple pages ranking for same keywords may indicate content overlap.' },
          { label: 'Content Gaps', description: 'Low keyword count on important pages suggests content expansion opportunities.' },
          { label: 'Topic Clusters', description: 'Pages with high keyword counts often serve as pillar content in topic clusters.' },
        ],
      },
    ],
    source: 'DataForSEO Labs API',
    apiField: 'count',
  },
  pageType: {
    title: 'Page Type Classification',
    description: 'Identifies the structural type of the page based on URL patterns and Client Master configuration.',
    sections: [
      {
        heading: 'Classification Priority Order',
        items: [
          { label: '1. ACCOUNT_AUTH', description: 'Login, signup, dashboard, profile pages (not SEO relevant)' },
          { label: '2. LEGAL_POLICY', description: 'Privacy, terms, cookies, GDPR pages (not SEO relevant)' },
          { label: '3. CAREERS_HR', description: 'Job listings, career pages (not SEO relevant)' },
          { label: '4. SUPPORT_CONTACT', description: 'Help, FAQ, contact, dealer locator pages' },
          { label: '5. HOME_PAGE', description: 'Homepage (root URL) - navigational entry point' },
          { label: '6. COMPANY_ABOUT', description: 'About/company/team pages' },
          { label: '7. PRODUCT_SERVICE', description: 'Product, service, machine, equipment pages' },
          { label: '8. CATEGORY_COLLECTION', description: 'Industry, application, solution hub pages' },
          { label: '9. BLOG_ARTICLE_NEWS', description: 'Blog posts, news, articles, insights' },
          { label: '10. RESOURCE_GUIDE_DOC', description: 'Guides, whitepapers, PDFs, documentation' },
          { label: '11. PRICING_PLANS', description: 'Pricing, plans, subscription pages' },
          { label: '12. LANDING_CAMPAIGN', description: 'Campaign, promo, demo, webinar pages' },
          { label: '13. OTHER_MISC', description: 'Fallback when no patterns match (review candidates)' },
        ],
      },
      {
        heading: 'Pattern Matching',
        items: [
          { label: 'URL Patterns', description: 'Matched against Client Master urlClassificationSupport patterns' },
          { label: 'Slug Detection', description: 'Uses productSlugPatterns, categorySlugPatterns, blogSlugPatterns, etc.' },
          { label: 'Fallback Logic', description: 'Pages not matching any pattern are marked as OTHER_MISC for AI review' },
        ],
      },
    ],
  },
  pageIntent: {
    title: 'Page Intent Classification',
    description: 'Indicates the user\'s purpose when visiting or searching for this page.',
    sections: [
      {
        heading: 'Intent Categories',
        items: [
          { label: 'NAVIGATIONAL', description: 'Homepage or brand-specific searches. User knows where they want to go.' },
          { label: 'TRANSACTIONAL', description: 'Buy, order, pricing signals. User is ready to convert.' },
          { label: 'COMMERCIAL_RESEARCH', description: 'Compare, review, best. User is evaluating options before purchase.' },
          { label: 'INFORMATIONAL', description: 'Educational content, how-to, guides. User is in learning phase.' },
          { label: 'SUPPORT', description: 'Help, FAQ, contact. Existing customer needs assistance.' },
          { label: 'IRRELEVANT_SEO', description: 'Login, legal pages. No organic search value.' },
        ],
      },
      {
        heading: 'How Intent is Determined',
        items: [
          { label: 'Page Type Mapping', description: 'Each page type has a default intent based on typical user behavior' },
          { label: 'Keyword Signals', description: 'Transactional keywords (buy, price) suggest TRANSACTIONAL intent' },
          { label: 'Content Analysis', description: 'Educational content indicates INFORMATIONAL intent' },
        ],
      },
    ],
  },
  isSeoRelevant: {
    title: 'SEO Relevance',
    description: 'Indicates whether this page matters for SEO and content strategy.',
    sections: [
      {
        heading: 'Marked as NOT Relevant (No)',
        items: [
          { label: 'Legal/Policy Pages', description: 'Privacy, terms, cookies - necessary but not SEO targets' },
          { label: 'Account/Auth Pages', description: 'Login, signup, dashboard - utility pages' },
          { label: 'Careers/HR Pages', description: 'Jobs, hiring - typically separate from main SEO strategy' },
          { label: 'IRRELEVANT_SEO Intent', description: 'Any page flagged as having no SEO value' },
        ],
      },
      {
        heading: 'Marked as Relevant (Yes)',
        items: [
          { label: 'Homepage/Company', description: 'Brand presence and authority pages' },
          { label: 'Product/Service Pages', description: 'Key commercial targets for rankings' },
          { label: 'Category/Collection Pages', description: 'Topic hubs that attract organic traffic' },
          { label: 'Blog/Resource Pages', description: 'Content that builds topical authority' },
          { label: 'Landing Pages', description: 'Conversion-focused pages worth optimizing' },
        ],
      },
    ],
  },
  seoAction: {
    title: 'SEO Action Recommendations',
    description: 'Recommended next step based on page type, intent, and traffic metrics.',
    sections: [
      {
        heading: 'Action Categories',
        items: [
          { label: 'HIGH_PRIORITY_TARGET', description: 'Commercial page with high traffic (1000+) and transactional intent. Priority competitor page to outrank.' },
          { label: 'CREATE_EQUIVALENT_PAGE', description: 'Competitor has valuable content you lack. Create similar or better content.' },
          { label: 'OPTIMIZE_EXISTING_PAGE', description: 'You have similar content that could be improved to compete.' },
          { label: 'ADD_TO_CONTENT_CLUSTER', description: 'Blog, resource, or category pages useful for topic cluster strategy.' },
          { label: 'BACKLINK_PROSPECT', description: 'Resource page that could link to your content.' },
          { label: 'MONITOR_ONLY', description: 'Track but not priority - includes homepage, low-traffic commercial pages.' },
          { label: 'IGNORE_IRRELEVANT', description: 'Utility pages (legal, login, careers) with no SEO impact.' },
        ],
      },
      {
        heading: 'How Actions are Determined',
        items: [
          { label: 'Traffic Thresholds', description: 'High traffic pages get priority actions' },
          { label: 'Page Type Mapping', description: 'Commercial pages get different actions than utility pages' },
          { label: 'Intent Alignment', description: 'Transactional intent + high traffic = HIGH_PRIORITY_TARGET' },
        ],
      },
    ],
  },
  classificationConfidence: {
    title: 'Classification Confidence',
    description: 'Indicates the reliability of the page classification.',
    sections: [
      {
        heading: 'Confidence Levels',
        items: [
          { label: 'HIGH', description: 'Strong URL pattern match (e.g., /products/, /blog/, /contact/). Matched against Client Master patterns with clear structural indicators.' },
          { label: 'MEDIUM', description: 'Content-based match using keywords/titles. No strong URL pattern but product/service/blog keywords found. May benefit from AI review.' },
          { label: 'LOW', description: 'Fallback classification (OTHER_MISC). No patterns matched - candidate for AI classification. Manual review recommended.' },
        ],
      },
    ],
  },
  classificationMethod: {
    title: 'Classification Method',
    description: 'Shows how the classification was determined.',
    sections: [
      {
        heading: 'Methods',
        items: [
          { label: 'RULE', description: 'Classified using URL pattern matching and keyword analysis. Uses Client Master patterns, homepage detection, and content keywords. No API cost incurred.' },
          { label: 'AI', description: 'Rule-based logic was uncertain (LOW confidence or OTHER_MISC), so OpenAI was used. Incurs API cost but provides better results for ambiguous pages.' },
        ],
      },
    ],
  },
  priorityScore: {
    title: 'Priority Score',
    description: 'A weighted composite score (0-100) indicating how important this page is for SEO competitive analysis.',
    sections: [
      {
        heading: 'Score Components (Weighted)',
        items: [
          { label: 'ETV Score (40%)', description: 'Traffic normalized 0-100 relative to highest traffic page in dataset. Higher traffic = higher priority.' },
          { label: 'Intent Score (25%)', description: 'Based on page intent classification. TRANSACTIONAL=100, COMMERCIAL_RESEARCH=80, INFORMATIONAL=50, SUPPORT=20, NAVIGATIONAL=10, IRRELEVANT=0.' },
          { label: 'Page Type Score (20%)', description: 'Based on page type. PRODUCT/PRICING=100, LANDING=90, CATEGORY=70, BLOG=60, RESOURCE=50, HOME=40, SUPPORT=20, COMPANY=10, LEGAL/ACCOUNT/CAREERS=0.' },
          { label: 'Business Relevance (15%)', description: 'Inferred from page type and intent. DIRECT=100, HIGH=80, MEDIUM=60, LOW=30, NONE=0.' },
        ],
      },
      {
        heading: 'Calculation',
        items: [
          { label: 'Formula', description: 'Priority = (ETV × 0.40) + (Intent × 0.25) + (PageType × 0.20) + (Relevance × 0.15)' },
          { label: 'Range', description: '0-100 where 100 is highest priority' },
          { label: 'Click Score', description: 'Click any priority score to see the full breakdown' },
        ],
      },
    ],
  },
  priorityTier: {
    title: 'Priority Tier',
    description: 'Categorical grouping based on Priority Score for easier filtering and action planning.',
    sections: [
      {
        heading: 'Tier Definitions',
        items: [
          { label: 'Tier 1 - Immediate (80-100)', description: 'Top priority pages. High traffic commercial pages with transactional intent. Requires immediate competitive response.' },
          { label: 'Tier 2 - High (60-79)', description: 'High priority pages worth targeting. Good traffic and commercial value.' },
          { label: 'Tier 3 - Medium (40-59)', description: 'Moderate priority. Consider for content strategy and topic clusters.' },
          { label: 'Tier 4 - Monitor (20-39)', description: 'Low priority. Monitor for trends but not immediate action needed.' },
          { label: 'Tier 5 - Ignore (0-19)', description: 'Lowest priority. Utility pages, low traffic, or irrelevant content. Safe to ignore.' },
        ],
      },
      {
        heading: 'Usage Tips',
        items: [
          { label: 'Filter by Tier', description: 'Use the Priority Tier filter to focus on actionable pages' },
          { label: 'Export by Tier', description: 'Export Tier 1 & 2 pages for immediate competitive analysis' },
        ],
      },
    ],
  },
};

interface HelpModalProps {
  helpKey: string | null;
  onClose: () => void;
}

function HelpModal({ helpKey, onClose }: HelpModalProps) {
  if (!helpKey || !HELP_CONTENT[helpKey]) return null;

  const content = HELP_CONTENT[helpKey];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{content.title}</h3>
            <p className="text-sm text-gray-600 mt-1">{content.description}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {content.sections.map((section, idx) => (
            <div key={idx}>
              <h4 className="text-sm font-semibold text-indigo-700 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                {section.heading}
              </h4>
              <div className="space-y-2">
                {section.items.map((item, itemIdx) => (
                  <div key={itemIdx} className="flex gap-3 text-sm">
                    <span className="font-medium text-gray-700 min-w-[140px] shrink-0">{item.label}</span>
                    <span className="text-gray-600">{item.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {(content.source || content.apiField) && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-4 text-xs text-gray-500">
                {content.source && (
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span>Source: <strong>{content.source}</strong></span>
                  </div>
                )}
                {content.apiField && (
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    <span>API Field: <code className="bg-gray-100 px-1 rounded">{content.apiField}</code></span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HelpIcon({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-200 hover:bg-indigo-200 text-gray-500 hover:text-indigo-700 text-[8px] font-bold transition-colors"
      title="Click for details"
    >
      ?
    </button>
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

interface PriorityExplanationModalProps {
  breakdown: PriorityScoreBreakdown | null;
  score: number | null;
  tier: PriorityTier | null;
  onClose: () => void;
}

function PriorityExplanationModal({ breakdown, score, tier, onClose }: PriorityExplanationModalProps) {
  if (!breakdown) return null;

  const formatWeight = (weight: number) => `${(weight * 100).toFixed(0)}%`;
  const formatScore = (score: number) => score.toFixed(1);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Priority Score Breakdown</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold text-indigo-600">{score?.toFixed(1) ?? '-'}</span>
              {tier && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPriorityTierBadgeColor(tier)}`}>
                  {formatPriorityTier(tier)}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            Priority = (ETV × 40%) + (Intent × 25%) + (PageType × 20%) + (Relevance × 15%)
          </div>

          <div className="space-y-3">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-blue-800">ETV Score</span>
                <span className="text-sm text-blue-600">Weight: {formatWeight(breakdown.weights.etv)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-blue-600">Raw Score: {formatScore(breakdown.etvScore)}</span>
                <span className="text-lg font-bold text-blue-800">{formatScore(breakdown.etvScore * breakdown.weights.etv)}</span>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-green-800">Intent Score</span>
                <span className="text-sm text-green-600">Weight: {formatWeight(breakdown.weights.intent)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-green-600">Raw Score: {formatScore(breakdown.intentScore)}</span>
                <span className="text-lg font-bold text-green-800">{formatScore(breakdown.intentScore * breakdown.weights.intent)}</span>
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-purple-800">Page Type Score</span>
                <span className="text-sm text-purple-600">Weight: {formatWeight(breakdown.weights.pageType)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-purple-600">Raw Score: {formatScore(breakdown.pageTypeScore)}</span>
                <span className="text-lg font-bold text-purple-800">{formatScore(breakdown.pageTypeScore * breakdown.weights.pageType)}</span>
              </div>
            </div>

            <div className="bg-orange-50 rounded-lg p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-orange-800">Business Relevance Score</span>
                <span className="text-sm text-orange-600">Weight: {formatWeight(breakdown.weights.businessRelevance)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-orange-600">Raw Score: {formatScore(breakdown.businessRelevanceScore)}</span>
                <span className="text-lg font-bold text-orange-800">{formatScore(breakdown.businessRelevanceScore * breakdown.weights.businessRelevance)}</span>
              </div>
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Final Priority Score</span>
              <span className="text-2xl font-bold text-indigo-600">{formatScore(breakdown.finalScore)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type SortField = 'estTrafficETV' | 'keywordsCount' | 'priorityScore' | null;
type SortDirection = 'asc' | 'desc';

function formatPageType(type: PageTypeValue | null | undefined): string {
  if (!type) return '-';
  if (type === 'HOME_PAGE') return 'Home Page';
  if (type === 'PRODUCT_SERVICE') return 'Product/Service';
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
    HOME_PAGE: 'bg-teal-100 text-teal-800',
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
  const [activeHelpModal, setActiveHelpModal] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [calculatingPriority, setCalculatingPriority] = useState(false);
  const [priorityTierFilter, setPriorityTierFilter] = useState<string>('all');
  const [selectedPriorityBreakdown, setSelectedPriorityBreakdown] = useState<{ breakdown: PriorityScoreBreakdown; score: number; tier: PriorityTier } | null>(null);

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

  const handleCalculatePriority = async () => {
    if (!selectedClientCode) return;
    setCalculatingPriority(true);
    setNotification(null);
    try {
      const res = await fetch('/api/compute-priority', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientCode: selectedClientCode }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification({ type: 'success', message: data.message });
        await fetchRecords();
      } else {
        setNotification({ type: 'error', message: data.error || 'Failed to calculate priority' });
      }
    } catch (error) {
      console.error('Error calculating priority scores:', error);
      setNotification({ type: 'error', message: 'Error calculating priority scores' });
    } finally {
      setCalculatingPriority(false);
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

    if (priorityTierFilter !== 'all') {
      filtered = filtered.filter(r => r.priorityTier === priorityTierFilter);
    }

    return filtered;
  }, [records, domainFilter, locationFilter, urlFilter, trafficMinFilter, keywordsMinFilter, pageTypeFilter, pageIntentFilter, seoRelevantFilter, seoActionFilter, classificationMethodFilter, priorityTierFilter]);

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

  const classificationBreakdown = useMemo(() => {
    const typeBreakdown: Record<string, number> = {};
    const intentBreakdown: Record<string, number> = {};
    const actionBreakdown: Record<string, number> = {};
    const confidenceBreakdown: Record<string, number> = {};
    const methodBreakdown: Record<string, number> = {};
    const priorityTierBreakdown: Record<string, number> = {};
    let seoYes = 0, seoNo = 0;
    let priorityCalculatedCount = 0;

    filteredRecords.forEach(r => {
      if (r.pageType) {
        typeBreakdown[r.pageType] = (typeBreakdown[r.pageType] || 0) + 1;
      }
      if (r.pageIntent) {
        intentBreakdown[r.pageIntent] = (intentBreakdown[r.pageIntent] || 0) + 1;
      }
      if (r.seoAction) {
        actionBreakdown[r.seoAction] = (actionBreakdown[r.seoAction] || 0) + 1;
      }
      if (r.classificationConfidence) {
        confidenceBreakdown[r.classificationConfidence] = (confidenceBreakdown[r.classificationConfidence] || 0) + 1;
      }
      if (r.classificationMethod) {
        methodBreakdown[r.classificationMethod] = (methodBreakdown[r.classificationMethod] || 0) + 1;
      }
      if (r.priorityTier) {
        priorityTierBreakdown[r.priorityTier] = (priorityTierBreakdown[r.priorityTier] || 0) + 1;
        priorityCalculatedCount++;
      }
      if (r.isSeoRelevant === true) seoYes++;
      if (r.isSeoRelevant === false) seoNo++;
    });

    return { typeBreakdown, intentBreakdown, actionBreakdown, confidenceBreakdown, methodBreakdown, priorityTierBreakdown, priorityCalculatedCount, seoYes, seoNo };
  }, [filteredRecords]);

  const totalPages = Math.ceil(sortedRecords.length / itemsPerPage);
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedRecords.slice(start, start + itemsPerPage);
  }, [sortedRecords, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredRecords.length]);

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

            <button
              onClick={handleCalculatePriority}
              disabled={calculatingPriority || summaryStats.classifiedCount === 0}
              className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {calculatingPriority ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Calculating...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Calculate Priority
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
                { key: 'priorityScore', header: 'Priority Score' },
                { key: 'priorityTier', header: 'Priority Tier' },
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

      {/* Classification Breakdown Summary */}
      {summaryStats.classifiedCount > 0 && (
        <details className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg shadow p-4 mb-4">
          <summary className="text-sm font-semibold text-gray-700 cursor-pointer hover:text-indigo-600">
            Classification Breakdown ({summaryStats.classifiedCount} classified pages)
          </summary>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Page Type Breakdown */}
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="text-xs font-medium text-gray-600 mb-2">Page Types</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {Object.entries(classificationBreakdown.typeBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <div key={type} className="flex justify-between text-[10px]">
                      <span className={`px-1 rounded ${getPageTypeBadgeColor(type as PageTypeValue)}`}>
                        {formatPageType(type as PageTypeValue)}
                      </span>
                      <span className="font-medium text-gray-700">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
            
            {/* Intent Breakdown */}
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="text-xs font-medium text-gray-600 mb-2">Page Intent</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {Object.entries(classificationBreakdown.intentBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([intent, count]) => (
                    <div key={intent} className="flex justify-between text-[10px]">
                      <span className={`px-1 rounded ${getIntentBadgeColor(intent as PageClassificationIntent)}`}>
                        {formatPageIntent(intent as PageClassificationIntent)}
                      </span>
                      <span className="font-medium text-gray-700">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
            
            {/* SEO Action Breakdown */}
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="text-xs font-medium text-gray-600 mb-2">SEO Actions</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {Object.entries(classificationBreakdown.actionBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([action, count]) => (
                    <div key={action} className="flex justify-between text-[10px]">
                      <span className={`px-1 rounded ${getSeoActionBadgeColor(action as SeoActionValue)}`}>
                        {formatSeoAction(action as SeoActionValue)}
                      </span>
                      <span className="font-medium text-gray-700">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
            
            {/* SEO Relevant Breakdown */}
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="text-xs font-medium text-gray-600 mb-2">SEO Relevant</div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="px-1 rounded bg-green-100 text-green-800">Yes</span>
                  <span className="font-medium text-gray-700">{classificationBreakdown.seoYes}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="px-1 rounded bg-gray-100 text-gray-500">No</span>
                  <span className="font-medium text-gray-700">{classificationBreakdown.seoNo}</span>
                </div>
              </div>
            </div>
            
            {/* Confidence Breakdown */}
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="text-xs font-medium text-gray-600 mb-2">Confidence</div>
              <div className="space-y-1">
                {Object.entries(classificationBreakdown.confidenceBreakdown)
                  .sort((a, b) => {
                    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
                    return (order[a[0] as keyof typeof order] || 3) - (order[b[0] as keyof typeof order] || 3);
                  })
                  .map(([conf, count]) => (
                    <div key={conf} className="flex justify-between text-[10px]">
                      <span className={`px-1 rounded ${
                        conf === 'HIGH' ? 'bg-green-100 text-green-800' :
                        conf === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {conf}
                      </span>
                      <span className="font-medium text-gray-700">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
            
            {/* Method Breakdown */}
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="text-xs font-medium text-gray-600 mb-2">Method</div>
              <div className="space-y-1">
                {Object.entries(classificationBreakdown.methodBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([method, count]) => (
                    <div key={method} className="flex justify-between text-[10px]">
                      <span className={`px-1 rounded ${
                        method === 'AI' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {method}
                      </span>
                      <span className="font-medium text-gray-700">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
            
            {/* Priority Tier Breakdown */}
            {classificationBreakdown.priorityCalculatedCount > 0 && (
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-xs font-medium text-gray-600 mb-2">Priority Tier ({classificationBreakdown.priorityCalculatedCount})</div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {PRIORITY_TIER_OPTIONS.map(tier => {
                    const count = classificationBreakdown.priorityTierBreakdown[tier] || 0;
                    if (count === 0) return null;
                    return (
                      <div key={tier} className="flex justify-between text-[10px]">
                        <span className={`px-1 rounded ${getPriorityTierBadgeColor(tier)}`}>
                          {formatPriorityTier(tier)}
                        </span>
                        <span className="font-medium text-gray-700">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </details>
      )}

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
            <label className="block text-xs font-medium text-gray-500 mb-1">Priority Tier</label>
            <select
              value={priorityTierFilter}
              onChange={e => setPriorityTierFilter(e.target.value)}
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Tiers</option>
              {PRIORITY_TIER_OPTIONS.map(tier => (
                <option key={tier} value={tier}>{formatPriorityTier(tier)}</option>
              ))}
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
        <div className="flex items-center justify-between mt-3">
          <div className="text-sm text-gray-500">
            Showing {paginatedRecords.length} of {sortedRecords.length} filtered ({records.length} total)
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                First
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Last
              </button>
              <select
                value={currentPage}
                onChange={e => setCurrentPage(Number(e.target.value))}
                className="border rounded px-2 py-1 text-xs"
              >
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <option key={page} value={page}>Go to {page}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-auto max-h-[600px]">
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
          <table className="w-full divide-y divide-gray-200 text-[10px] table-fixed">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-1 py-1.5 text-left text-[9px] font-medium text-gray-500 uppercase w-[100px]">
                  Domain
                </th>
                <th className="px-1 py-1.5 text-left text-[9px] font-medium text-gray-500 uppercase w-[30px]">
                  Loc
                </th>
                <th className="px-1 py-1.5 text-left text-[9px] font-medium text-gray-500 uppercase w-[180px]">
                  Page URL
                </th>
                <th className="px-1 py-1.5 text-right text-[9px] font-medium text-gray-500 uppercase w-[60px]">
                  <span className="flex items-center justify-end gap-1">
                    <span className="cursor-pointer hover:text-gray-700" onClick={() => handleSort('estTrafficETV')}>
                      Traffic
                      {sortField === 'estTrafficETV' && <span className="text-indigo-600 ml-0.5">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                    </span>
                    <HelpIcon onClick={() => setActiveHelpModal('traffic')} />
                  </span>
                </th>
                <th className="px-1 py-1.5 text-right text-[9px] font-medium text-gray-500 uppercase w-[50px]">
                  <span className="flex items-center justify-end gap-1">
                    <span className="cursor-pointer hover:text-gray-700" onClick={() => handleSort('keywordsCount')}>
                      KWs
                      {sortField === 'keywordsCount' && <span className="text-indigo-600 ml-0.5">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                    </span>
                    <HelpIcon onClick={() => setActiveHelpModal('keywords')} />
                  </span>
                </th>
                <th className="px-1 py-1.5 text-left text-[9px] font-medium text-gray-500 uppercase w-[95px]">
                  <span className="flex items-center gap-0.5">Type <HelpIcon onClick={() => setActiveHelpModal('pageType')} /></span>
                </th>
                <th className="px-1 py-1.5 text-left text-[9px] font-medium text-gray-500 uppercase w-[80px]">
                  <span className="flex items-center gap-0.5">Intent <HelpIcon onClick={() => setActiveHelpModal('pageIntent')} /></span>
                </th>
                <th className="px-1 py-1.5 text-center text-[9px] font-medium text-gray-500 uppercase w-[35px]">
                  <span className="flex items-center gap-0.5">SEO <HelpIcon onClick={() => setActiveHelpModal('isSeoRelevant')} /></span>
                </th>
                <th className="px-1 py-1.5 text-left text-[9px] font-medium text-gray-500 uppercase w-[100px]">
                  <span className="flex items-center gap-0.5">Action <HelpIcon onClick={() => setActiveHelpModal('seoAction')} /></span>
                </th>
                <th className="px-1 py-1.5 text-center text-[9px] font-medium text-gray-500 uppercase w-[40px]">
                  <span className="flex items-center gap-0.5">Conf <HelpIcon onClick={() => setActiveHelpModal('classificationConfidence')} /></span>
                </th>
                <th className="px-1 py-1.5 text-center text-[9px] font-medium text-gray-500 uppercase w-[40px]">
                  <span className="flex items-center gap-0.5">Mthd <HelpIcon onClick={() => setActiveHelpModal('classificationMethod')} /></span>
                </th>
                <th className="px-1 py-1.5 text-right text-[9px] font-medium text-gray-500 uppercase w-[50px]">
                  <span className="flex items-center justify-end gap-1">
                    <span className="cursor-pointer hover:text-gray-700" onClick={() => handleSort('priorityScore')}>
                      Score
                      {sortField === 'priorityScore' && <span className="text-indigo-600 ml-0.5">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                    </span>
                    <HelpIcon onClick={() => setActiveHelpModal('priorityScore')} />
                  </span>
                </th>
                <th className="px-1 py-1.5 text-left text-[9px] font-medium text-gray-500 uppercase w-[70px]">
                  <span className="flex items-center gap-0.5">Tier <HelpIcon onClick={() => setActiveHelpModal('priorityTier')} /></span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedRecords.map(record => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-1 py-1 text-[9px] text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis w-[100px]">
                    {record.domain.length > 15 ? record.domain.substring(0, 15) + '...' : record.domain}
                  </td>
                  <td className="px-1 py-1 text-[9px] w-[30px]">
                    <span className={`inline-flex items-center px-0.5 py-0 rounded text-[8px] font-medium ${
                      record.locationCode === 'IN' 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-teal-100 text-teal-800'
                    }`}>
                      {record.locationCode}
                    </span>
                  </td>
                  <td className="px-1 py-1 text-[9px] w-[180px] overflow-hidden">
                    <a
                      href={record.pageURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 hover:underline truncate block max-w-[170px]"
                      title={record.pageURL}
                    >
                      {truncateUrl(record.pageURL)}
                    </a>
                  </td>
                  <td className="px-1 py-1 text-[9px] font-medium text-right w-[50px]">
                    {formatNumber(record.estTrafficETV)}
                  </td>
                  <td className="px-1 py-1 text-[9px] font-medium text-right w-[35px]">
                    {formatNumber(record.keywordsCount)}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap w-[95px]">
                    {record.pageType ? (
                      <div className="flex items-center gap-0.5">
                        <span className={`inline-flex items-center px-0.5 py-0 rounded text-[8px] font-medium ${getPageTypeBadgeColor(record.pageType)}`}>
                          {formatPageType(record.pageType)}
                        </span>
                        {record.classificationExplanation && (
                          <button
                            onClick={() => setSelectedExplanation(record.classificationExplanation!)}
                            className="text-gray-400 hover:text-indigo-600 text-[8px]"
                            title="View explanation"
                          >
                            ?
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-[9px]">-</span>
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap w-[80px]">
                    {record.pageIntent ? (
                      <span className={`inline-flex items-center px-0.5 py-0 rounded text-[8px] font-medium ${getIntentBadgeColor(record.pageIntent)}`}>
                        {formatPageIntent(record.pageIntent)}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-[9px]">-</span>
                    )}
                  </td>
                  <td className="px-1 py-1 text-center w-[35px]">
                    {record.isSeoRelevant !== null && record.isSeoRelevant !== undefined ? (
                      <span className={`inline-flex items-center px-0.5 py-0 rounded text-[8px] font-medium ${
                        record.isSeoRelevant ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {record.isSeoRelevant ? 'Y' : 'N'}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-[9px]">-</span>
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap w-[100px]">
                    {record.seoAction ? (
                      <span className={`inline-flex items-center px-0.5 py-0 rounded text-[8px] font-medium ${getSeoActionBadgeColor(record.seoAction)}`}>
                        {formatSeoAction(record.seoAction)}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-[9px]">-</span>
                    )}
                  </td>
                  <td className="px-1 py-1 text-center w-[40px]">
                    {record.classificationConfidence ? (
                      <span className={`inline-flex items-center px-0.5 py-0 rounded text-[8px] font-medium ${
                        record.classificationConfidence === 'HIGH' ? 'bg-green-100 text-green-800' :
                        record.classificationConfidence === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {record.classificationConfidence.substring(0, 3)}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-[9px]">-</span>
                    )}
                  </td>
                  <td className="px-1 py-1 text-center w-[40px]">
                    {record.classificationMethod ? (
                      <span className={`inline-flex items-center px-0.5 py-0 rounded text-[8px] font-medium ${
                        record.classificationMethod === 'AI' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {record.classificationMethod}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-[9px]">-</span>
                    )}
                  </td>
                  <td className="px-1 py-1 text-right w-[50px]">
                    {record.priorityScore !== null && record.priorityScore !== undefined ? (
                      <button
                        onClick={() => record.priorityScoreBreakdown && setSelectedPriorityBreakdown({
                          breakdown: record.priorityScoreBreakdown,
                          score: record.priorityScore!,
                          tier: record.priorityTier!
                        })}
                        className="text-[9px] font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer"
                        title="Click to view breakdown"
                      >
                        {record.priorityScore.toFixed(1)}
                      </button>
                    ) : (
                      <span className="text-gray-400 text-[9px]">-</span>
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap w-[70px]">
                    {record.priorityTier ? (
                      <span className={`inline-flex items-center px-0.5 py-0 rounded text-[8px] font-medium ${getPriorityTierBadgeColor(record.priorityTier)}`}>
                        {formatPriorityTier(record.priorityTier)}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-[9px]">-</span>
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

      <HelpModal
        helpKey={activeHelpModal}
        onClose={() => setActiveHelpModal(null)}
      />

      {selectedPriorityBreakdown && (
        <PriorityExplanationModal
          breakdown={selectedPriorityBreakdown.breakdown}
          score={selectedPriorityBreakdown.score}
          tier={selectedPriorityBreakdown.tier}
          onClose={() => setSelectedPriorityBreakdown(null)}
        />
      )}
    </div>
  );
}
