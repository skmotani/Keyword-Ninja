'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';
import {
    QueryGroup,
    DashboardQueryDefinition,
    DashboardQueryResult,
    KeywordBalloonData,
    DomainInfo,
    QueryStatus,
    DataSourceLink,
    ClientRankingsData,
    KeywordsAbsenceData,
    CompetitorGlobalData,
    MarketSizeData,
    ETVComparisonData,
    KeywordOpportunityMatrixData,
    BrandPowerData,
    Top20IncludeBuyData
} from '@/types/dashboardTypes';
import Link from 'next/link';
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    PointerSensor,
    useSensor,
    useSensors,
    closestCenter,
} from '@dnd-kit/core';
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Client {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
    domains?: string[];
    brandPhotos?: string[];
}

const pageHelp = {
    title: 'Dashboard Report',
    description: 'Consolidated view of analytical queries for your clients with visualizations and PDF export.',
    whyWeAddedThis: 'Provides a single dashboard to view all key metrics and insights for a client.',
    examples: [
        'View digital footprint analysis for a client',
        'See top keywords with volume in balloon format',
        'Export complete dashboard as PDF report',
    ],
    useCases: [
        'Client presentation and reporting',
        'Quick overview of client SEO status',
        'Identifying high-volume keyword opportunities',
    ],
};

const pageDescription = `
  This dashboard consolidates key analytical queries for your selected client.
  
  **Features:**
  - Select a client to view their analytics
  - Queries are organized by groups
  - Expand/collapse query results
  - Balloon visualization for keyword volume
  - Export all visible queries to PDF
  
  **Query IDs:** Each query has a unique ID (e.g., Q001) for tracking and reference.
`;

// Status color mapping
const statusColors: Record<QueryStatus, { bg: string; text: string; border: string }> = {
    Critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    Warning: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
    Info: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    Success: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
};

// Info Modal Component for query details popup
function InfoModal({
    isOpen,
    onClose,
    queryId,
    title,
    description
}: {
    isOpen: boolean;
    onClose: () => void;
    queryId: string;
    title: string;
    description: string;
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/50"></div>
            <div
                className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <div className="flex items-center gap-3 mb-4">
                    <span className="bg-indigo-100 text-indigo-700 text-xs font-mono px-2 py-1 rounded">{queryId}</span>
                    <span className="text-indigo-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{title}</h3>
                <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg p-4">
                    {description}
                </div>
                <button
                    onClick={onClose}
                    className="mt-4 w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                    Got it
                </button>
            </div>
        </div>
    );
}

// Balloon Chart Component for keyword volume visualization
function BalloonChart({ data }: { data: KeywordBalloonData[] }) {
    if (!data || data.length === 0) {
        return <div className="text-gray-500 text-sm italic">No keyword data available</div>;
    }

    // Calculate max volume for scaling
    const maxVolume = Math.max(...data.map(d => d.volume));
    const minSize = 40;
    const maxSize = 120;

    // Scale function for bubble size
    const getSize = (volume: number) => {
        if (maxVolume === 0) return minSize;
        const ratio = volume / maxVolume;
        return minSize + (maxSize - minSize) * Math.sqrt(ratio);
    };

    return (
        <div className="space-y-4">
            {/* Balloon visualization */}
            <div className="flex flex-wrap gap-3 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl">
                {data.map((item, index) => {
                    const size = getSize(item.volume);
                    return (
                        <div
                            key={index}
                            className="group relative flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer"
                            style={{
                                width: `${size}px`,
                                height: `${size}px`,
                                minWidth: `${size}px`,
                            }}
                            title={`${item.keyword}: ${item.volume.toLocaleString()} searches`}
                        >
                            <span
                                className="text-center font-medium leading-tight p-1 overflow-hidden"
                                style={{ fontSize: `${Math.max(9, size / 8)}px` }}
                            >
                                {item.keyword.length > 15 ? item.keyword.substring(0, 12) + '...' : item.keyword}
                            </span>
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                <div className="font-semibold">{item.keyword}</div>
                                <div>Volume: {item.volume.toLocaleString()}</div>
                                <div className="flex items-center gap-1">
                                    {item.location === 'india' ? '🇮🇳' : '🌐'} {item.location === 'india' ? 'India' : 'Global'}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Data table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                        <tr>
                            <th className="px-4 py-2 text-left font-medium">#</th>
                            <th className="px-4 py-2 text-left font-medium">Keyword</th>
                            <th className="px-4 py-2 text-right font-medium">Volume</th>
                            <th className="px-4 py-2 text-center font-medium">Location</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {data.map((item, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-gray-500">{index + 1}</td>
                                <td className="px-4 py-2 font-medium text-gray-900">{item.keyword}</td>
                                <td className="px-4 py-2 text-right text-indigo-600 font-semibold">
                                    {item.volume.toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-center">
                                    {item.location === 'india' ? '🇮🇳 India' : '🌐 Global'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// Source Footer Component - displays source link for verification
function SourceFooter({ sourceLink }: { sourceLink?: DataSourceLink }) {
    if (!sourceLink) return null;
    return (
        <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span>Source:</span>
            <Link href={sourceLink.href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1">
                {sourceLink.label}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
            </Link>
        </div>
    );
}

// Domain Info Component - includes Business Overview and Products/Market from AI Profile
function DomainInfoCard({ data }: { data: DomainInfo }) {
    return (
        <div className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-xs text-gray-500 mb-1">Client Name</div>
                    <div className="font-semibold text-gray-900">{data.clientName}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-xs text-gray-500 mb-1">Client Code</div>
                    <div className="font-semibold text-gray-900">{data.clientCode}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-xs text-gray-500 mb-1">Main Domain</div>
                    <div className="font-semibold text-indigo-600">{data.mainDomain}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-xs text-gray-500 mb-1">Status</div>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColors[data.status].bg} ${statusColors[data.status].text}`}>
                        {data.status}
                    </span>
                </div>
            </div>

            {data.allDomains.length > 1 && (
                <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-xs text-gray-500 mb-2">All Domains</div>
                    <div className="flex flex-wrap gap-2">
                        {data.allDomains.map((domain, i) => (
                            <span key={i} className="px-2 py-1 bg-white border rounded text-sm text-gray-700">
                                {domain}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Business Overview Section */}
            {(data.businessModel || data.shortSummary || data.industryType) && (
                <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
                    <h4 className="text-sm font-semibold text-indigo-900 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        Business Overview
                    </h4>
                    <div className="space-y-2 text-sm">
                        {data.industryType && (
                            <div><span className="text-gray-600">Industry:</span> <span className="font-medium text-gray-900">{data.industryType}</span></div>
                        )}
                        {data.businessModel && (
                            <div><span className="text-gray-600">Business Model:</span> <span className="font-medium text-gray-900">{data.businessModel}</span></div>
                        )}
                        {data.shortSummary && (
                            <div className="text-gray-700 mt-2 pt-2 border-t border-indigo-100">{data.shortSummary}</div>
                        )}
                    </div>
                </div>
            )}

            {/* Products & Market Section */}
            {(data.productLines?.length || data.targetCustomerSegments?.length || data.targetGeographies?.length) && (
                <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                    <h4 className="text-sm font-semibold text-green-900 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        Products & Market
                    </h4>
                    <div className="space-y-3">
                        {data.productLines && data.productLines.length > 0 && (
                            <div>
                                <div className="text-xs text-gray-600 mb-1">Product Lines</div>
                                <div className="flex flex-wrap gap-1">
                                    {data.productLines.map((p, i) => (
                                        <span key={i} className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium">
                                            {p}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {data.targetCustomerSegments && data.targetCustomerSegments.length > 0 && (
                            <div>
                                <div className="text-xs text-gray-600 mb-1">Target Customer Segments</div>
                                <div className="flex flex-wrap gap-1">
                                    {data.targetCustomerSegments.map((s, i) => (
                                        <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                                            {s}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {data.targetGeographies && data.targetGeographies.length > 0 && (
                            <div>
                                <div className="text-xs text-gray-600 mb-1">Target Geographies</div>
                                <div className="flex flex-wrap gap-1">
                                    {data.targetGeographies.map((g, i) => (
                                        <span key={i} className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs">
                                            {g}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Core Topics */}
            {data.coreTopics && data.coreTopics.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-xs text-gray-500 mb-2">Core Topics</div>
                    <div className="flex flex-wrap gap-1">
                        {data.coreTopics.map((topic, i) => (
                            <span key={i} className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs">
                                {topic}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// Q005: Client Rankings Card
function ClientRankingsCard({ data }: { data: ClientRankingsData }) {
    return (
        <div className="space-y-4">
            {/* Summary Table */}
            <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
                <h4 className="text-sm font-semibold text-indigo-900 mb-3">Rankings Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="bg-white rounded-lg p-3">
                        <div className="text-2xl font-bold text-indigo-600">{data.summary.uniqueTop3India}</div>
                        <div className="text-xs text-gray-500">Top 3 🇮🇳 India</div>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                        <div className="text-2xl font-bold text-purple-600">{data.summary.uniqueTop3Global}</div>
                        <div className="text-xs text-gray-500">Top 3 🌐 Global</div>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                        <div className="text-2xl font-bold text-blue-600">{data.summary.uniqueTop10India}</div>
                        <div className="text-xs text-gray-500">Top 10 🇮🇳 India</div>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                        <div className="text-2xl font-bold text-teal-600">{data.summary.uniqueTop10Global}</div>
                        <div className="text-xs text-gray-500">Top 10 🌐 Global</div>
                    </div>
                </div>
            </div>
            {/* Sample Keywords Table */}
            {data.sampleKeywords.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600">
                            <tr>
                                <th className="px-3 py-2 text-center font-medium">Sr No</th>
                                <th className="px-3 py-2 text-left font-medium">Domain</th>
                                <th className="px-3 py-2 text-center font-medium">Location</th>
                                <th className="px-3 py-2 text-left font-medium">Keyword</th>
                                <th className="px-3 py-2 text-center font-medium">Pos</th>
                                <th className="px-3 py-2 text-right font-medium">Volume</th>
                                <th className="px-3 py-2 text-center font-medium">Bucket</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {data.sampleKeywords.map((kw, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 text-center text-gray-500">{i + 1}</td>
                                    <td className="px-3 py-2 text-gray-600 text-xs">{kw.domain}</td>
                                    <td className="px-3 py-2 text-center">{kw.location === 'India' ? '🇮🇳 India' : kw.location === 'Global' ? '🌐 Global' : kw.location}</td>
                                    <td className="px-3 py-2 font-medium text-gray-900">{kw.keyword}</td>
                                    <td className="px-3 py-2 text-center"><span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-semibold">{kw.position}</span></td>
                                    <td className="px-3 py-2 text-right text-indigo-600 font-semibold">{kw.volume.toLocaleString()}</td>
                                    <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded text-xs ${kw.rankingBucket === 'Top 3' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>{kw.rankingBucket}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// Q006: Keywords Absence Card - shows keywords where rank > 10 or absent
function KeywordsAbsenceCard({ data }: { data: KeywordsAbsenceData }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="bg-yellow-50 text-yellow-800">
                    <tr>
                        <th className="px-3 py-2 text-center font-medium">Sr No</th>
                        <th className="px-3 py-2 text-left font-medium">Keyword</th>
                        <th className="px-3 py-2 text-right font-medium">Volume</th>
                        <th className="px-3 py-2 text-center font-medium">Location</th>
                        <th className="px-3 py-2 text-center font-medium">Client Rank</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {data.keywords.map((kw, i) => (
                        <tr key={i} className="hover:bg-yellow-50/50">
                            <td className="px-3 py-2 text-center text-gray-500">{i + 1}</td>
                            <td className="px-3 py-2 font-medium text-gray-900">{kw.keyword}</td>
                            <td className="px-3 py-2 text-right text-indigo-600 font-semibold">{kw.volume.toLocaleString()}</td>
                            <td className="px-3 py-2 text-center">{kw.location === 'IN' ? '🇮🇳 India' : '🌐 Global'}</td>
                            <td className="px-3 py-2 text-center">
                                {kw.clientRank === '>100' ? (
                                    <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded text-xs">&gt;100</span>
                                ) : (
                                    <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-semibold">#{kw.clientRank}</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {data.keywords.length === 0 && (
                <div className="text-center py-4 text-gray-500">No keyword gaps found - great coverage!</div>
            )}
        </div>
    );
}

// Q007: Client Vs Competitor Strength Card
function CompetitorGlobalCard({ data }: { data: CompetitorGlobalData }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="bg-indigo-50 text-indigo-800">
                    <tr>
                        <th className="px-3 py-2 text-center font-medium">Sr No</th>
                        <th className="px-3 py-2 text-center font-medium">Type</th>
                        <th className="px-3 py-2 text-left font-medium">Name</th>
                        <th className="px-3 py-2 text-left font-medium">Domain</th>
                        <th className="px-3 py-2 text-center font-medium">Score</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {data.competitors.map((c, i) => (
                        <tr key={i} className={c.isClient ? 'bg-green-50/50 hover:bg-green-100/50' : 'hover:bg-orange-50/50'}>
                            <td className="px-3 py-2 text-center text-gray-500">{i + 1}</td>
                            <td className="px-3 py-2 text-center">
                                {c.isClient ? (
                                    <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-semibold">Client</span>
                                ) : (
                                    <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-xs font-semibold">Competitor</span>
                                )}
                            </td>
                            <td className="px-3 py-2 font-medium text-gray-900">{c.name}</td>
                            <td className="px-3 py-2 text-gray-600 text-xs">{c.domain}</td>
                            <td className="px-3 py-2 text-center">
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${c.isClient ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                                    {c.score}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {data.competitors.length === 0 && (
                <div className="text-center py-4 text-gray-500">No data found</div>
            )}
        </div>
    );
}

// Q008: Market Size Card - shows CTR-based traffic calculation
function MarketSizeCard({ data }: { data: MarketSizeData }) {
    const [showCtrModel, setShowCtrModel] = React.useState(false);

    return (
        <div className="space-y-4">
            {/* Summary - A, B, C, D */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-gray-900">{data.totalMarketVolume.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">A) Total Market Volume</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-blue-600">{data.clientVolume.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">B) Client Potential Volume</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-green-600">{data.clientTraffic.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">
                        C) Client Traffic
                        <button
                            onClick={() => setShowCtrModel(!showCtrModel)}
                            className="ml-1 text-indigo-600 hover:text-indigo-800 underline"
                            title="Click to see CTR model"
                        >
                            (CTR?)
                        </button>
                    </div>
                </div>
                <div className="bg-indigo-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-indigo-600">{data.clientTrafficPercent}%</div>
                    <div className="text-xs text-gray-500">D) Traffic % (C/A×100)</div>
                </div>
            </div>

            {/* CTR Model Explanation (collapsible) */}
            {showCtrModel && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-xs">
                    <h5 className="font-semibold text-indigo-800 mb-2">📊 CTR Model: How Traffic is Calculated</h5>
                    <p className="text-gray-700 mb-2">Traffic = Volume × CTR(Position). CTR values by ranking position:</p>
                    <div className="grid grid-cols-5 gap-1 text-center">
                        <div className="bg-white rounded p-1"><span className="font-semibold">#1</span> 30%</div>
                        <div className="bg-white rounded p-1"><span className="font-semibold">#2</span> 17.5%</div>
                        <div className="bg-white rounded p-1"><span className="font-semibold">#3</span> 12%</div>
                        <div className="bg-white rounded p-1"><span className="font-semibold">#4</span> 8%</div>
                        <div className="bg-white rounded p-1"><span className="font-semibold">#5</span> 6%</div>
                        <div className="bg-white rounded p-1"><span className="font-semibold">#6</span> 4%</div>
                        <div className="bg-white rounded p-1"><span className="font-semibold">#7</span> 3%</div>
                        <div className="bg-white rounded p-1"><span className="font-semibold">#8</span> 2%</div>
                        <div className="bg-white rounded p-1"><span className="font-semibold">#9</span> 1.5%</div>
                        <div className="bg-white rounded p-1"><span className="font-semibold">#10</span> 1%</div>
                        <div className="bg-white rounded p-1 col-span-2"><span className="font-semibold">#11-15</span> 0.5%</div>
                        <div className="bg-white rounded p-1 col-span-2"><span className="font-semibold">#16-20</span> 0.3%</div>
                        <div className="bg-white rounded p-1"><span className="font-semibold">#21+</span> ~0%</div>
                    </div>
                </div>
            )}

            {/* Simple Pie Chart (CSS) */}
            <div className="flex items-center justify-center gap-8">
                <div
                    className="relative w-32 h-32 rounded-full"
                    style={{
                        background: `conic-gradient(#10b981 0% ${data.clientTrafficPercent}%, #e5e7eb ${data.clientTrafficPercent}% 100%)`
                    }}
                >
                    <div className="absolute inset-3 bg-white rounded-full flex items-center justify-center">
                        <span className="text-lg font-bold text-green-600">{data.clientTrafficPercent}%</span>
                    </div>
                </div>
                <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2"><span className="w-3 h-3 bg-green-500 rounded"></span> Client Traffic: {data.clientTrafficPercent}%</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 bg-gray-300 rounded"></span> Others: {Math.max(0, 100 - data.clientTrafficPercent).toFixed(1)}%</div>
                </div>
            </div>

            {/* E) Competitors Table */}
            {data.competitors.length > 0 && (
                <div className="overflow-x-auto">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">E) Competitor Traffic Share</h4>
                    <table className="w-full text-sm">
                        <thead className="bg-orange-50 text-orange-800">
                            <tr>
                                <th className="px-3 py-2 text-center font-medium">Sr No</th>
                                <th className="px-3 py-2 text-left font-medium">Domain</th>
                                <th className="px-3 py-2 text-right font-medium">Volume</th>
                                <th className="px-3 py-2 text-right font-medium">Traffic (CTR)</th>
                                <th className="px-3 py-2 text-center font-medium">Traffic %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {data.competitors.map((c, i) => (
                                <tr key={i} className="hover:bg-orange-50/50">
                                    <td className="px-3 py-2 text-center text-gray-500">{i + 1}</td>
                                    <td className="px-3 py-2 font-medium text-gray-900">{c.domain}</td>
                                    <td className="px-3 py-2 text-right text-gray-500">{c.volume.toLocaleString()}</td>
                                    <td className="px-3 py-2 text-right text-orange-700 font-semibold">{c.traffic.toLocaleString()}</td>
                                    <td className="px-3 py-2 text-center">
                                        <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-xs font-semibold">{c.trafficPercent}%</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// Q009: ETV Comparison Card - Domain-wise Organic Traffic comparison
function ETVComparisonCard({ data }: { data: ETVComparisonData }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="bg-indigo-50 text-indigo-800">
                    <tr>
                        <th className="px-3 py-2 text-center font-medium">Sr No</th>
                        <th className="px-3 py-2 text-center font-medium">Type</th>
                        <th className="px-3 py-2 text-left font-medium">Name</th>
                        <th className="px-3 py-2 text-left font-medium">Domain</th>
                        <th className="px-3 py-2 text-right font-medium">ETV (India)</th>
                        <th className="px-3 py-2 text-right font-medium">ETV (Global)</th>
                        <th className="px-3 py-2 text-right font-medium">ETV (Total)</th>
                        <th className="px-3 py-2 text-right font-medium">KW (India)</th>
                        <th className="px-3 py-2 text-right font-medium">KW (Global)</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {data.entries.map((entry, i) => (
                        <tr key={i} className={entry.type === 'Self' ? 'bg-blue-50/50 hover:bg-blue-100/50' : 'hover:bg-gray-50'}>
                            <td className="px-3 py-2 text-center text-gray-500">{i + 1}</td>
                            <td className="px-3 py-2 text-center">
                                {entry.type === 'Self' ? (
                                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-semibold">Self</span>
                                ) : (
                                    <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-xs font-semibold">Competitor</span>
                                )}
                            </td>
                            <td className="px-3 py-2 font-medium text-gray-900">{entry.name}</td>
                            <td className="px-3 py-2 text-gray-600 text-xs">{entry.domain}</td>
                            <td className="px-3 py-2 text-right text-gray-600">${entry.etvIndia.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-gray-600">${entry.etvGlobal.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right font-semibold">
                                <span className={entry.type === 'Self' ? 'text-blue-700' : 'text-orange-700'}>
                                    ${entry.etvTotal.toLocaleString()}
                                </span>
                            </td>
                            <td className="px-3 py-2 text-right text-gray-500">{entry.keywordsIndia.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{entry.keywordsGlobal.toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {data.entries.length === 0 && (
                <div className="text-center py-4 text-gray-500">No data found</div>
            )}
        </div>
    );
}

// Q010: Keyword Opportunity Matrix Card - Redesigned with 6 Separate Sections
function KeywordOpportunityMatrixCard({ data }: { data: KeywordOpportunityMatrixData }) {
    const [expandedSections, setExpandedSections] = React.useState<Set<string>>(new Set(['Core Assets', 'Low-Hanging Fruit']));

    const toggleSection = (section: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(section)) {
                next.delete(section);
            } else {
                next.add(section);
            }
            return next;
        });
    };

    // Section configurations with colors and descriptions
    const sections: {
        key: string;
        label: string;
        description: string;
        count: number;
        bgColor: string;
        textColor: string;
        borderColor: string;
        headerBg: string;
    }[] = [
            {
                key: 'Core Assets',
                label: '1️⃣ Core Assets (Top Rank + High Volume)',
                description: 'Maintain, watchful - don\'t lose position',
                count: data.summary.coreAssets,
                bgColor: 'bg-purple-50',
                textColor: 'text-purple-800',
                borderColor: 'border-purple-200',
                headerBg: 'bg-purple-100'
            },
            {
                key: 'Doing Nothing',
                label: '2️⃣ Doing Nothing (Top Rank + Low Volume)',
                description: 'Stable, no action needed',
                count: data.summary.doingNothing,
                bgColor: 'bg-gray-50',
                textColor: 'text-gray-700',
                borderColor: 'border-gray-200',
                headerBg: 'bg-gray-100'
            },
            {
                key: 'Low-Hanging Fruit',
                label: '3️⃣ Low-Hanging Fruit (Medium Rank + High Volume)',
                description: 'Priority opportunity!',
                count: data.summary.lowHangingFruit,
                bgColor: 'bg-green-50',
                textColor: 'text-green-800',
                borderColor: 'border-green-200',
                headerBg: 'bg-green-100'
            },
            {
                key: 'Second Priority',
                label: '4️⃣ Second Priority (Medium Rank + Low Volume)',
                description: 'Opportunity of 2nd priority',
                count: data.summary.secondPriority,
                bgColor: 'bg-blue-50',
                textColor: 'text-blue-700',
                borderColor: 'border-blue-200',
                headerBg: 'bg-blue-100'
            },
            {
                key: 'Long-Term Opportunity',
                label: '5️⃣ Long-Term Opportunity (Low Rank + High Volume)',
                description: 'Tough but worth pursuing',
                count: data.summary.longTermOpportunity,
                bgColor: 'bg-amber-50',
                textColor: 'text-amber-800',
                borderColor: 'border-amber-200',
                headerBg: 'bg-amber-100'
            },
            {
                key: 'Can Ignore',
                label: '6️⃣ Can Ignore (Low Rank + Low Volume)',
                description: 'Deprioritize',
                count: data.summary.canIgnore,
                bgColor: 'bg-gray-50',
                textColor: 'text-gray-400',
                borderColor: 'border-gray-200',
                headerBg: 'bg-gray-100'
            }
        ];

    // Group keywords by opportunity type
    const keywordsByType: Record<string, typeof data.keywords> = {};
    for (const kw of data.keywords) {
        if (!keywordsByType[kw.opportunityType]) {
            keywordsByType[kw.opportunityType] = [];
        }
        keywordsByType[kw.opportunityType].push(kw);
    }

    return (
        <div className="space-y-4">
            {/* Summary Stats */}
            <div className="flex flex-wrap gap-2 justify-center bg-gray-50 p-2 rounded-lg">
                <div className="text-xs text-gray-600">
                    <span className="font-semibold">Total:</span> {data.summary.total} keywords
                </div>
                <div className="text-xs text-gray-400">|</div>
                <div className="text-xs text-gray-600">
                    <span className="font-semibold">Volume Range:</span> {data.volumeRange?.min?.toLocaleString() || 0} - {data.volumeRange?.max?.toLocaleString() || 0}
                </div>
                <div className="text-xs text-gray-400">|</div>
                <div className="text-xs text-gray-600">
                    <span className="font-semibold">High Vol Threshold (P30):</span> ≥{data.p30Threshold?.toLocaleString() || 0}
                </div>
                <div className="text-xs text-gray-400">|</div>
                <div className="text-xs text-gray-600">
                    <span className="font-semibold">Rank:</span> Top=1-10, Medium=11-30, Low=&gt;30
                </div>
            </div>

            {/* 6 Collapsible Sections */}
            <div className="space-y-3">
                {sections.map(section => {
                    const sectionKeywords = keywordsByType[section.key] || [];
                    const isExpanded = expandedSections.has(section.key);

                    return (
                        <div
                            key={section.key}
                            className={`rounded-lg border ${section.borderColor} overflow-hidden`}
                        >
                            {/* Section Header */}
                            <div
                                className={`${section.headerBg} px-4 py-2 cursor-pointer flex items-center justify-between hover:opacity-90 transition-opacity`}
                                onClick={() => toggleSection(section.key)}
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`font-semibold text-sm ${section.textColor}`}>
                                        {section.label}
                                    </span>
                                    <span className={`${section.bgColor} ${section.textColor} px-2 py-0.5 rounded-full text-xs font-bold`}>
                                        {section.count}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 italic">{section.description}</span>
                                    <svg
                                        className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>

                            {/* Section Content */}
                            {isExpanded && (
                                <div className={`${section.bgColor} p-2`}>
                                    {sectionKeywords.length === 0 ? (
                                        <div className="text-center text-gray-400 py-4 text-sm">
                                            No keywords in this bucket
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-white/50">
                                                    <tr>
                                                        <th className="px-2 py-1.5 text-left font-medium text-xs text-gray-600">Domain</th>
                                                        <th className="px-2 py-1.5 text-center font-medium text-xs text-gray-600">Type</th>
                                                        <th className="px-2 py-1.5 text-center font-medium text-xs text-gray-600">Loc</th>
                                                        <th className="px-2 py-1.5 text-left font-medium text-xs text-gray-600">Keyword</th>
                                                        <th className="px-2 py-1.5 text-center font-medium text-xs text-gray-600">Bucket</th>
                                                        <th className="px-2 py-1.5 text-center font-medium text-xs text-gray-600">Pos</th>
                                                        <th className="px-2 py-1.5 text-right font-medium text-xs text-gray-600">Vol</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {sectionKeywords.slice(0, 30).map((kw, i) => (
                                                        <tr key={i} className="bg-white/30 hover:bg-white/60">
                                                            <td className="px-2 py-1.5 text-xs text-gray-600 max-w-[120px] truncate" title={kw.domain}>
                                                                {kw.domain}
                                                            </td>
                                                            <td className="px-2 py-1.5 text-center">
                                                                <span className={`px-1.5 py-0.5 rounded text-xs ${kw.domainType === 'Self' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                                                    }`}>
                                                                    {kw.domainType === 'Self' ? 'Self' : 'Comp'}
                                                                </span>
                                                            </td>
                                                            <td className="px-2 py-1.5 text-center">
                                                                <span className={`px-1.5 py-0.5 rounded text-xs ${kw.location === 'India' ? 'bg-yellow-100 text-yellow-700' : 'bg-teal-100 text-teal-700'
                                                                    }`}>
                                                                    {kw.location === 'India' ? 'IN' : 'GL'}
                                                                </span>
                                                            </td>
                                                            <td className="px-2 py-1.5 font-medium text-gray-900 max-w-[200px] truncate" title={kw.keyword}>
                                                                {kw.keyword}
                                                            </td>
                                                            <td className="px-2 py-1.5 text-center">
                                                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${kw.rankBucket === 'Top' ? 'bg-blue-100 text-blue-700' :
                                                                    kw.rankBucket === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                                                        'bg-gray-100 text-gray-600'
                                                                    }`}>
                                                                    {kw.rankBucket}/{kw.volumeBucket}
                                                                </span>
                                                            </td>
                                                            <td className="px-2 py-1.5 text-center">
                                                                <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-xs">
                                                                    #{kw.position}
                                                                </span>
                                                            </td>
                                                            <td className="px-2 py-1.5 text-right text-indigo-600 font-semibold text-xs">
                                                                {kw.volume.toLocaleString()}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {sectionKeywords.length > 30 && (
                                                <div className="text-center text-xs text-gray-500 py-2">
                                                    Showing 30 of {sectionKeywords.length} keywords
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// Q011: Brand Power Card - Compare brand strength across domains
function BrandPowerCard({ data }: { data: BrandPowerData }) {
    const [expandedDomains, setExpandedDomains] = React.useState<Set<string>>(new Set());

    const toggleDomain = (domain: string) => {
        setExpandedDomains(prev => {
            const next = new Set(prev);
            if (next.has(domain)) {
                next.delete(domain);
            } else {
                next.add(domain);
            }
            return next;
        });
    };

    return (
        <div className="space-y-4">
            {/* Summary Stats */}
            <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                <span className="font-semibold">Total: {data.summary.totalDomains} domains</span>
                <span className="mx-2">|</span>
                <span>{data.summary.totalBrandKeywords.toLocaleString()} brand keywords</span>
                <span className="mx-2">|</span>
                <span className="text-indigo-600 font-semibold">
                    Total Brand Volume: {data.summary.totalBrandVolume.toLocaleString()}
                </span>
            </div>

            {/* Domain List */}
            <div className="space-y-2">
                {data.domains.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        No brand keywords found. Make sure brand terms are defined in AI Keyword Builder.
                    </div>
                ) : (
                    data.domains.map((domainData, idx) => {
                        const isExpanded = expandedDomains.has(domainData.domain);
                        const isSelf = domainData.domainType === 'Self';

                        return (
                            <div
                                key={domainData.domain}
                                className={`border rounded-lg overflow-hidden ${isSelf ? 'border-blue-200 bg-blue-50/30' : 'border-orange-200 bg-orange-50/30'
                                    }`}
                            >
                                {/* Domain Header - Clickable */}
                                <div
                                    className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/50 transition-colors ${isSelf ? 'bg-blue-100/50' : 'bg-orange-100/50'
                                        }`}
                                    onClick={() => toggleDomain(domainData.domain)}
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Rank */}
                                        <span className="text-lg font-bold text-gray-400 w-6">
                                            {idx + 1}
                                        </span>

                                        {/* Domain Type Badge */}
                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${isSelf
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-orange-100 text-orange-700'
                                            }`}>
                                            {isSelf ? 'Self' : 'Comp'}
                                        </span>

                                        {/* Domain */}
                                        <span className="font-medium text-gray-900">
                                            {domainData.domain}
                                        </span>

                                        {/* Brand Name */}
                                        <span className="text-indigo-600 font-semibold">
                                            {domainData.brandName}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {/* Keyword Count */}
                                        <span className="text-sm text-gray-600">
                                            {domainData.brandKeywordCount} keywords
                                        </span>

                                        {/* Total Volume */}
                                        <span className="text-lg font-bold text-indigo-600">
                                            {domainData.totalBrandVolume.toLocaleString()}
                                        </span>

                                        {/* Expand/Collapse Icon */}
                                        <svg
                                            className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>

                                {/* Expanded Keywords Table */}
                                {isExpanded && (
                                    <div className="border-t border-gray-200 bg-white">
                                        <table className="min-w-full text-xs">
                                            <thead>
                                                <tr className="bg-gray-50">
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Keyword</th>
                                                    <th className="px-3 py-2 text-center font-semibold text-gray-600 w-16">Loc</th>
                                                    <th className="px-3 py-2 text-center font-semibold text-gray-600 w-16">Pos</th>
                                                    <th className="px-3 py-2 text-right font-semibold text-gray-600 w-20">Vol</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {domainData.keywords.map((kw, kwIdx) => (
                                                    <tr key={`${kw.keyword}-${kwIdx}`} className="hover:bg-gray-50">
                                                        <td className="px-3 py-1.5 font-medium text-gray-900">
                                                            {kw.keyword}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-center">
                                                            <span className={`px-1.5 py-0.5 rounded text-xs ${kw.location === 'India' || kw.location === 'IN'
                                                                ? 'bg-orange-100 text-orange-700'
                                                                : 'bg-blue-100 text-blue-700'
                                                                }`}>
                                                                {kw.location === 'India' ? 'IN' : kw.location === 'United States' ? 'US' : kw.location}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-1.5 text-center">
                                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${kw.position <= 3
                                                                ? 'bg-green-100 text-green-700'
                                                                : kw.position <= 10
                                                                    ? 'bg-blue-100 text-blue-700'
                                                                    : kw.position <= 30
                                                                        ? 'bg-yellow-100 text-yellow-700'
                                                                        : 'bg-gray-100 text-gray-600'
                                                                }`}>
                                                                #{kw.position}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-1.5 text-right text-indigo-600 font-semibold">
                                                            {kw.volume.toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {domainData.keywords.length === 0 && (
                                            <div className="text-center py-4 text-gray-500 text-sm">
                                                No keywords found for this domain
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

// MANUAL_001: Top 20 Include|Buy Keywords Card
function Top20IncludeBuyCard({ data }: { data: Top20IncludeBuyData }) {
    return (
        <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>
                    Total Include|Buy Keywords: <strong className="text-gray-900">{data.summary.totalIncludeBuyKeywords}</strong>
                </span>
                <span>|</span>
                <span>
                    Self Domains: <strong className="text-gray-900">{data.summary.selfDomainsCount}</strong>
                </span>
            </div>

            {/* Keywords Table */}
            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Keyword</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">In+Gl Vol</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Vol IN</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Vol GL</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Self Pos IN</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Self Pos GL</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {data.keywords.map((kw) => (
                            <tr key={kw.rank} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-sm text-gray-500">{kw.rank}</td>
                                <td className="px-3 py-2 text-sm font-medium text-gray-900">{kw.keyword}</td>
                                <td className="px-3 py-2 text-sm text-right text-gray-900 font-semibold">
                                    {kw.totalVolume.toLocaleString()}
                                </td>
                                <td className="px-3 py-2 text-sm text-right text-gray-600">
                                    {kw.volumeIN > 0 ? kw.volumeIN.toLocaleString() : '-'}
                                </td>
                                <td className="px-3 py-2 text-sm text-right text-gray-600">
                                    {kw.volumeGL > 0 ? kw.volumeGL.toLocaleString() : '-'}
                                </td>
                                <td className="px-3 py-2 text-sm text-right">
                                    {kw.selfPosIN !== null ? (
                                        <span className={kw.selfPosIN <= 10 ? 'text-green-600 font-medium' : 'text-gray-600'}>
                                            {kw.selfPosIN}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400">-</span>
                                    )}
                                </td>
                                <td className="px-3 py-2 text-sm text-right">
                                    {kw.selfPosGL !== null ? (
                                        <span className={kw.selfPosGL <= 10 ? 'text-green-600 font-medium' : 'text-gray-600'}>
                                            {kw.selfPosGL}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400">-</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// Sortable Query Card Wrapper for drag-and-drop
function SortableQueryCard({
    id,
    children,
}: {
    id: string;
    children: React.ReactNode;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="relative group/drag">
            <div
                {...attributes}
                {...listeners}
                className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover/drag:opacity-100 transition-opacity z-10 hover:bg-gray-100 rounded-l-lg"
                title="Drag to reorder"
            >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
            </div>
            <div className="pl-2">
                {children}
            </div>
        </div>
    );
}

// Query Card Component with Editable Title and Description
function QueryCard({
    query,
    result,
    isExpanded,
    isLoading,
    onToggle,
    customTitle,
    onTitleChange,
    pageTitle,
    pageContent,
    onPageTitleChange,
    onPageContentChange,
    cardNumber,
    onDelete,
}: {
    query: DashboardQueryDefinition;
    result: DashboardQueryResult | null;
    isExpanded: boolean;
    isLoading: boolean;
    onToggle: () => void;
    customTitle?: string;
    onTitleChange?: (queryId: string, title: string) => void;
    pageTitle?: string;
    pageContent?: string;
    onPageTitleChange?: (queryId: string, pageTitle: string) => void;
    onPageContentChange?: (queryId: string, pageContent: string) => void;
    cardNumber?: number;
    onDelete?: (queryId: string) => void;
}) {
    const statusStyle = statusColors[query.status];
    const [showInfoModal, setShowInfoModal] = React.useState(false);
    const [isEditingTitle, setIsEditingTitle] = React.useState(false);
    const [isEditingPageTitle, setIsEditingPageTitle] = React.useState(false);
    const [isEditingPageContent, setIsEditingPageContent] = React.useState(false);
    const [editTitle, setEditTitle] = React.useState(customTitle || query.title);
    const [editPageTitle, setEditPageTitle] = React.useState(pageTitle || '');
    const [editPageContent, setEditPageContent] = React.useState(pageContent || '');

    // Update local state when props change
    React.useEffect(() => {
        setEditTitle(customTitle || query.title);
    }, [customTitle, query.title]);

    React.useEffect(() => {
        setEditPageTitle(pageTitle || '');
    }, [pageTitle]);

    React.useEffect(() => {
        setEditPageContent(pageContent || '');
    }, [pageContent]);

    const displayTitle = customTitle || query.title;

    const handleTitleSave = () => {
        const trimmedTitle = editTitle.trim();
        if (onTitleChange && trimmedTitle) {
            onTitleChange(query.id, trimmedTitle);
        }
        setIsEditingTitle(false);
    };

    const handlePageTitleSave = () => {
        if (onPageTitleChange) {
            onPageTitleChange(query.id, editPageTitle.trim());
        }
        setIsEditingPageTitle(false);
    };

    const handlePageContentSave = () => {
        if (onPageContentChange) {
            onPageContentChange(query.id, editPageContent.trim());
        }
        setIsEditingPageContent(false);
    };

    return (
        <>
            <InfoModal
                isOpen={showInfoModal}
                onClose={() => setShowInfoModal(false)}
                queryId={query.id}
                title={displayTitle}
                description={query.tooltip || query.description}
            />
            <div className={`bg-white rounded-lg border shadow-sm transition-all ${isExpanded ? 'ring-2 ring-indigo-200' : ''} relative`}>
                {/* Serial Number Badge on Right Side */}
                {cardNumber !== undefined && (
                    <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-indigo-100 to-transparent flex items-center justify-center z-10 pointer-events-none">
                        <span className="text-2xl font-bold text-indigo-400">{cardNumber}</span>
                    </div>
                )}
                {/* Header */}
                <div
                    className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors pr-14"
                    onClick={(e) => {
                        // Don't toggle when clicking on editable fields
                        if ((e.target as HTMLElement).closest('.editable-field')) return;
                        if ((e.target as HTMLElement).closest('.delete-btn')) return;
                        onToggle();
                    }}
                >
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <span className="text-xs font-mono bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                                {query.id}
                            </span>
                            {/* Editable Title */}
                            {isEditingTitle ? (
                                <textarea
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    onBlur={handleTitleSave}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleTitleSave();
                                        }
                                        if (e.key === 'Escape') {
                                            setEditTitle(customTitle || query.title);
                                            setIsEditingTitle(false);
                                        }
                                    }}
                                    className="editable-field font-semibold text-gray-900 border border-indigo-300 rounded px-2 py-0.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-y"
                                    rows={1}
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <h3
                                    className="editable-field font-semibold text-gray-900 cursor-text hover:bg-indigo-50 px-2 py-0.5 rounded transition-colors group flex items-center gap-1 relative"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsEditingTitle(true);
                                    }}
                                    title="Click to edit title"
                                >
                                    <div className="relative group/titleheader flex-1 min-w-0">
                                        {/* Collapsed view */}
                                        <div className="truncate max-w-full">
                                            {displayTitle}
                                        </div>

                                        {/* Hover Popup (Full Content) */}
                                        <div className="absolute top-full left-0 z-50 hidden group-hover/titleheader:block bg-white border border-gray-200 shadow-xl rounded p-3 min-w-[300px] whitespace-pre-wrap text-gray-700 font-normal">
                                            {displayTitle}
                                        </div>
                                    </div>

                                    <span title="Saved to Railway Volume (Not Git Pushed)" className="cursor-help text-sm flex-shrink-0">☁️</span>
                                    <svg className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                </h3>
                            )}
                            {query.tooltip && (
                                <button
                                    type="button"
                                    className="p-1 rounded-full hover:bg-indigo-100 transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowInfoModal(true);
                                    }}
                                    title="Click for details"
                                >
                                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </button>
                            )}
                            {/* Delete Button */}
                            {onDelete && (
                                <button
                                    type="button"
                                    className="delete-btn p-1 rounded-full hover:bg-red-100 transition-colors ml-2"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm('Delete this card?')) {
                                            onDelete(query.id);
                                        }
                                    }}
                                    title="Delete card"
                                >
                                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            )}
                        </div>
                        {/* Editable Page Title & Content */}
                        <div className="ml-14 mt-2 space-y-2">
                            {/* Page Title Field */}
                            <div>
                                {isEditingPageTitle ? (
                                    <textarea
                                        value={editPageTitle}
                                        onChange={(e) => setEditPageTitle(e.target.value)}
                                        onBlur={handlePageTitleSave}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handlePageTitleSave();
                                            }
                                            if (e.key === 'Escape') {
                                                setEditPageTitle(pageTitle || '');
                                                setIsEditingPageTitle(false);
                                            }
                                        }}
                                        className="editable-field w-full text-xs border border-indigo-300 rounded px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-y"
                                        rows={1}
                                        placeholder="Page title for reports..."
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <div
                                        className="editable-field text-xs cursor-text hover:bg-indigo-50 px-2 py-1 rounded transition-colors group flex items-start gap-2 relative"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsEditingPageTitle(true);
                                        }}
                                        title="Click to edit page title"
                                    >
                                        <span className="text-gray-400 font-medium flex-shrink-0">Query:</span>
                                        <div className="flex-1 relative group/title min-w-0">
                                            {/* Collapsed view (Wrapped but limited height by default, expands on hover) */}
                                            <div className={`text-gray-700 transition-all duration-200 ease-in-out overflow-hidden ${pageTitle ? 'whitespace-pre-wrap break-words max-h-[1.5em] group-hover/title:max-h-[500px]' : 'italic text-gray-300'}`}>
                                                {pageTitle || 'Click to add page title...'}
                                            </div>
                                        </div>

                                        <span title="Saved to Railway Volume (Not Git Pushed)" className="cursor-help text-[10px] flex-shrink-0">☁️</span>
                                        <svg className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                            {/* Page Content Field */}
                            <div>
                                {isEditingPageContent ? (
                                    <textarea
                                        value={editPageContent}
                                        onChange={(e) => setEditPageContent(e.target.value)}
                                        onBlur={handlePageContentSave}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handlePageContentSave();
                                            }
                                            if (e.key === 'Escape') {
                                                setEditPageContent(pageContent || '');
                                                setIsEditingPageContent(false);
                                            }
                                        }}
                                        className="editable-field w-full text-xs border border-indigo-300 rounded px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-y"
                                        placeholder="Content description for this section..."
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <div
                                        className="editable-field text-xs cursor-text hover:bg-indigo-50 px-2 py-1 rounded transition-colors group flex items-start gap-2 relative"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsEditingPageContent(true);
                                        }}
                                        title="Click to edit content description"
                                    >
                                        <span className="text-gray-400 font-medium flex-shrink-0">SEO Advantage:</span>
                                        <div className="flex-1 relative group/content min-w-0">
                                            {/* Collapsed view (Multi-line wrap) */}
                                            <div className={`text-gray-600 ${pageContent ? 'whitespace-pre-wrap break-words' : 'italic text-gray-300'}`}>
                                                {pageContent || 'Click to add content description...'}
                                            </div>
                                        </div>

                                        <span title="Saved to Railway Volume (Not Git Pushed)" className="cursor-help text-[10px] flex-shrink-0">☁️</span>
                                        <svg className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Data Source Info - always visible from query definition */}
                        {query.sourceInfo && (
                            <div className="ml-14 mt-1">
                                <span className="text-[10px] text-gray-400 flex items-center gap-1 flex-wrap">
                                    <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                                    </svg>
                                    <span className="font-medium">Tables:</span>
                                    <span className="text-gray-500">{query.sourceInfo.tables.join(', ')}</span>
                                    {query.sourceInfo.page && (
                                        <>
                                            <span className="text-gray-300 mx-1">|</span>
                                            <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <span className="font-medium">Page:</span>
                                            {query.sourceInfo.pageUrl ? (
                                                <Link
                                                    href={query.sourceInfo.pageUrl}
                                                    className="text-indigo-500 hover:underline"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {query.sourceInfo.page} ↗
                                                </Link>
                                            ) : (
                                                <span className="text-gray-500">{query.sourceInfo.page}</span>
                                            )}
                                        </>
                                    )}
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
                            {query.status}
                        </span>
                        <svg
                            className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>

                {/* Content */}
                {isExpanded && (
                    <div className="p-4 border-t">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <svg className="animate-spin h-8 w-8 text-indigo-600" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                            </div>
                        ) : result ? (
                            <>
                                {result.error ? (
                                    <div className="text-red-600 bg-red-50 p-3 rounded">{result.error}</div>
                                ) : result.queryType === 'keyword-volume' ? (
                                    <BalloonChart data={result.data as KeywordBalloonData[]} />
                                ) : result.queryType === 'domain-info' ? (
                                    <DomainInfoCard data={result.data as DomainInfo} />
                                ) : result.queryType === 'client-rankings' ? (
                                    <ClientRankingsCard data={result.data as ClientRankingsData} />
                                ) : result.queryType === 'keywords-absence' ? (
                                    <KeywordsAbsenceCard data={result.data as KeywordsAbsenceData} />
                                ) : result.queryType === 'competitor-global' ? (
                                    <CompetitorGlobalCard data={result.data as CompetitorGlobalData} />
                                ) : result.queryType === 'market-size' ? (
                                    <MarketSizeCard data={result.data as MarketSizeData} />
                                ) : result.queryType === 'etv-comparison' ? (
                                    <ETVComparisonCard data={result.data as ETVComparisonData} />
                                ) : result.queryType === 'keyword-opportunity-matrix' ? (
                                    <KeywordOpportunityMatrixCard data={result.data as KeywordOpportunityMatrixData} />
                                ) : result.queryType === 'brand-keywords-matrix' ? (
                                    <BrandPowerCard data={result.data as BrandPowerData} />
                                ) : result.queryType === 'top20-include-buy' ? (
                                    <Top20IncludeBuyCard data={result.data as Top20IncludeBuyData} />
                                ) : (
                                    <pre className="text-sm bg-gray-50 p-3 rounded overflow-auto">
                                        {JSON.stringify(result.data, null, 2)}
                                    </pre>
                                )}
                                {/* Source Footer for verification */}
                                <SourceFooter sourceLink={result.sourceLink} />
                            </>
                        ) : (
                            <div className="text-gray-500 text-sm italic">Click to load data</div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

export default function DashboardPage() {
    // State
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientCode, setSelectedClientCode] = useState<string>('');
    const [queryGroups, setQueryGroups] = useState<QueryGroup[]>([]);
    const [queries, setQueries] = useState<DashboardQueryDefinition[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    const [expandedQueries, setExpandedQueries] = useState<Set<string>>(new Set());
    const [queryResults, setQueryResults] = useState<Record<string, DashboardQueryResult>>({});
    const [loadingQueries, setLoadingQueries] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Custom editable titles, pageTitles, pageContents (GLOBAL - same for all clients)
    const [customTitles, setCustomTitles] = useState<Record<string, string>>({});
    const [pageTitles, setPageTitles] = useState<Record<string, string>>({});
    const [pageContents, setPageContents] = useState<Record<string, string>>({});
    const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
    const [editingCategory, setEditingCategory] = useState<string | null>(null);
    const [editCategoryValue, setEditCategoryValue] = useState<string>('');
    const [activeId, setActiveId] = useState<string | null>(null);

    // Drag-and-drop sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    // Load global customizations from API (once on mount)
    const loadCustomizations = useCallback(async () => {
        try {
            const res = await fetch('/api/reports/dashboard/customizations');
            const data = await res.json();
            if (data.success) {
                setCustomTitles(data.titles || {});
                setPageTitles(data.pageTitles || {});
                setPageContents(data.pageContents || {});
                setCategoryNames(data.categoryNames || {});
            }
        } catch (error) {
            console.error('Failed to load customizations:', error);
        }
    }, []);

    // Save customization to API (global)
    const saveQueryCustomization = useCallback(async (queryId: string, customTitle?: string, pageTitle?: string, pageContent?: string) => {
        try {
            await fetch('/api/reports/dashboard/customizations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'query',
                    queryId,
                    customTitle,
                    pageTitle,
                    pageContent,
                }),
            });
        } catch (error) {
            console.error('Failed to save customization:', error);
        }
    }, []);

    // Handlers for editing
    const handleTitleChange = useCallback((queryId: string, title: string) => {
        setCustomTitles(prev => ({ ...prev, [queryId]: title }));
        saveQueryCustomization(queryId, title, pageTitles[queryId], pageContents[queryId]);
    }, [saveQueryCustomization, pageTitles, pageContents]);

    const handlePageTitleChange = useCallback((queryId: string, pageTitle: string) => {
        setPageTitles(prev => ({ ...prev, [queryId]: pageTitle }));
        saveQueryCustomization(queryId, customTitles[queryId], pageTitle, pageContents[queryId]);
    }, [saveQueryCustomization, customTitles, pageContents]);

    const handlePageContentChange = useCallback((queryId: string, pageContent: string) => {
        setPageContents(prev => ({ ...prev, [queryId]: pageContent }));
        saveQueryCustomization(queryId, customTitles[queryId], pageTitles[queryId], pageContent);
    }, [saveQueryCustomization, customTitles, pageTitles]);

    // Handler for editing category names
    const handleCategoryNameSave = useCallback(async (groupId: string, newName: string) => {
        if (!newName.trim()) return;
        setCategoryNames(prev => ({ ...prev, [groupId]: newName.trim() }));
        setEditingCategory(null);
        try {
            await fetch('/api/reports/dashboard/customizations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'category',
                    groupId,
                    customName: newName.trim(),
                }),
            });
        } catch (error) {
            console.error('Failed to save category name:', error);
        }
    }, []);

    // Drag and drop handlers
    const handleDragStart = useCallback((event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    }, []);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over || active.id === over.id) return;

        // Find the query being dragged and the target position
        const activeQuery = queries.find(q => q.id === active.id);
        const overQuery = queries.find(q => q.id === over.id);

        if (!activeQuery || !overQuery) return;

        // Reorder queries
        const oldIndex = queries.findIndex(q => q.id === active.id);
        const newIndex = queries.findIndex(q => q.id === over.id);

        const newQueries = [...queries];
        newQueries.splice(oldIndex, 1);
        newQueries.splice(newIndex, 0, activeQuery);
        setQueries(newQueries);

        // If moving to a different group, update the query's groupId
        if (activeQuery.groupId !== overQuery.groupId) {
            const updatedQuery = { ...activeQuery, groupId: overQuery.groupId };
            const updatedQueries = newQueries.map(q =>
                q.id === activeQuery.id ? updatedQuery : q
            );
            setQueries(updatedQueries);
        }

        // Save the new order to API
        const queryOrder: Record<string, string[]> = {};
        queryGroups.forEach(group => {
            queryOrder[group.id] = newQueries
                .filter(q => q.groupId === group.id)
                .map(q => q.id);
        });

        fetch('/api/reports/dashboard/customizations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'order', queryOrder }),
        }).catch(err => console.error('Failed to save query order:', err));
    }, [queries, queryGroups]);

    // Fetch clients and global customizations on mount
    useEffect(() => {
        fetchClients();
        fetchQueryGroups();
        loadCustomizations();
    }, [loadCustomizations]);

    // Fetch queries when client changes
    useEffect(() => {
        if (selectedClientCode) {
            fetchQueries();
            setQueryResults({});
            setExpandedQueries(new Set());
        }
    }, [selectedClientCode, selectedGroupId]);

    async function fetchClients() {
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
            showNotification('error', 'Failed to load clients');
        }
    }

    async function fetchQueryGroups() {
        try {
            const res = await fetch('/api/reports/dashboard/query-groups');
            const data = await res.json();
            if (data.success) {
                setQueryGroups(data.groups);
            }
        } catch (error) {
            console.error('Failed to fetch query groups:', error);
        }
    }

    async function fetchQueries() {
        setLoading(true);
        try {
            let url = '/api/reports/dashboard/queries';
            if (selectedGroupId) {
                url += `?groupId=${selectedGroupId}`;
            }
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                setQueries(data.queries);
            }
        } catch (error) {
            console.error('Failed to fetch queries:', error);
            showNotification('error', 'Failed to load queries');
        } finally {
            setLoading(false);
        }
    }

    const executeQuery = useCallback(async (queryId: string) => {
        if (!selectedClientCode) return;

        setLoadingQueries(prev => new Set(prev).add(queryId));
        try {
            const res = await fetch('/api/reports/dashboard/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientCode: selectedClientCode, queryId }),
            });
            const data = await res.json();
            if (data.success) {
                setQueryResults(prev => ({ ...prev, [queryId]: data.result }));
            } else {
                setQueryResults(prev => ({
                    ...prev,
                    [queryId]: {
                        queryId,
                        clientCode: selectedClientCode,
                        title: '',
                        status: 'Info' as QueryStatus,
                        queryType: '',
                        data: null,
                        executedAt: new Date().toISOString(),
                        error: data.error,
                    },
                }));
            }
        } catch (error) {
            console.error('Failed to execute query:', error);
        } finally {
            setLoadingQueries(prev => {
                const next = new Set(prev);
                next.delete(queryId);
                return next;
            });
        }
    }, [selectedClientCode]);

    function toggleQuery(queryId: string) {
        setExpandedQueries(prev => {
            const next = new Set(prev);
            if (next.has(queryId)) {
                next.delete(queryId);
            } else {
                next.add(queryId);
                // Execute query if not already loaded
                if (!queryResults[queryId]) {
                    executeQuery(queryId);
                }
            }
            return next;
        });
    }

    function expandAll() {
        const allIds = new Set(queries.map(q => q.id));
        setExpandedQueries(allIds);
        // Execute all queries that haven't been loaded
        queries.forEach(q => {
            if (!queryResults[q.id]) {
                executeQuery(q.id);
            }
        });
    }

    function collapseAll() {
        setExpandedQueries(new Set());
    }

    // Create a new empty card
    async function createCard() {
        const defaultGroup = queryGroups[0];
        if (!defaultGroup) {
            showNotification('error', 'No query groups available');
            return;
        }

        // Generate a unique ID for the new card
        const existingIds = queries.map(q => {
            const match = q.id.match(/^MANUAL_(\d+)$/);
            return match ? parseInt(match[1]) : 0;
        });
        const nextNum = Math.max(0, ...existingIds) + 1;
        const newId = `MANUAL_${String(nextNum).padStart(3, '0')}`;

        const now = new Date().toISOString();
        const newQuery: DashboardQueryDefinition = {
            id: newId,
            queryNumber: String(nextNum),
            title: 'New Card (click to edit)',
            description: 'Click to add content',
            status: 'Info' as QueryStatus,
            queryType: 'manual',
            groupId: defaultGroup.id,
            tooltip: 'This is a manually created card. You can edit the title and add queries later.',
            config: {},
            isActive: true,
            createdAt: now,
            updatedAt: now,
        };

        setQueries(prev => [...prev, newQuery]);
        showNotification('success', `Created card ${newId}`);

        // Save to API
        try {
            await fetch('/api/reports/dashboard/customizations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'createCard',
                    card: newQuery,
                }),
            });
        } catch (error) {
            console.error('Failed to save new card:', error);
        }
    }

    // Delete a card
    async function deleteCard(queryId: string) {
        setQueries(prev => prev.filter(q => q.id !== queryId));
        setQueryResults(prev => {
            const next = { ...prev };
            delete next[queryId];
            return next;
        });
        setExpandedQueries(prev => {
            const next = new Set(prev);
            next.delete(queryId);
            return next;
        });
        showNotification('success', `Deleted card ${queryId}`);

        // Save to API
        try {
            await fetch('/api/reports/dashboard/customizations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'deleteCard',
                    queryId,
                }),
            });
        } catch (error) {
            console.error('Failed to delete card:', error);
        }
    }

    async function handleExportPdf() {
        if (!selectedClientCode) {
            showNotification('error', 'Please select a client');
            return;
        }

        setExporting(true);
        try {
            const res = await fetch('/api/reports/dashboard/export-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientCode: selectedClientCode,
                    queryIds: queries.map(q => q.id),
                }),
            });

            if (!res.ok) {
                throw new Error('Export failed');
            }

            const html = await res.text();

            // Create a new window with the HTML content for printing
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(html);
                printWindow.document.close();
                // Auto-trigger print dialog
                printWindow.onload = () => {
                    printWindow.print();
                };
            }

            showNotification('success', 'Report opened for printing. Use Ctrl+P to save as PDF.');
        } catch (error) {
            console.error('Export failed:', error);
            showNotification('error', 'Failed to export PDF');
        } finally {
            setExporting(false);
        }
    }

    function showNotification(type: 'success' | 'error', message: string) {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 5000);
    }

    const selectedClient = clients.find(c => c.code === selectedClientCode);

    // Group queries by their group
    const queriesByGroup = queries.reduce((acc, q) => {
        const group = queryGroups.find(g => g.id === q.groupId);
        const groupName = group?.name || 'Ungrouped';
        if (!acc[groupName]) {
            acc[groupName] = [];
        }
        acc[groupName].push(q);
        return acc;
    }, {} as Record<string, DashboardQueryDefinition[]>);

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <PageHeader
                title="Dashboard Report"
                description="Consolidated analytics dashboard for client insights and reporting."
                helpInfo={pageHelp}
                extendedDescription={pageDescription}
            />

            {/* Notification */}
            {notification && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${notification.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                    {notification.message}
                </div>
            )}

            {/* Controls */}
            <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
                <div className="flex flex-wrap items-end gap-4">
                    {/* Client Selector */}
                    <div className="w-64">
                        <label className="block text-xs font-bold text-gray-500 mb-1">
                            Client <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={selectedClientCode}
                            onChange={e => setSelectedClientCode(e.target.value)}
                            className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="">Select Client...</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.code}>{c.name} ({c.code})</option>
                            ))}
                        </select>
                    </div>

                    {/* Query Group Filter */}
                    <div className="w-64">
                        <label className="block text-xs font-bold text-gray-500 mb-1">
                            Query Group
                        </label>
                        <select
                            value={selectedGroupId}
                            onChange={e => setSelectedGroupId(e.target.value)}
                            className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="">All Groups</option>
                            {queryGroups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 ml-auto">
                        <button
                            onClick={createCard}
                            className="px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors font-medium flex items-center gap-1"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Card
                        </button>
                        <button
                            onClick={expandAll}
                            className="px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                            Expand All
                        </button>
                        <button
                            onClick={collapseAll}
                            className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                            Collapse All
                        </button>
                        <button
                            onClick={handleExportPdf}
                            disabled={exporting || !selectedClientCode}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                        >
                            {exporting ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Exporting...
                                </>
                            ) : (
                                <>
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Export PDF
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Summary */}
                {selectedClient && (
                    <div className="mt-4 pt-4 border-t text-sm text-gray-600">
                        <span className="font-medium">Selected Client:</span> {selectedClient.name}
                        <span className="mx-2">|</span>
                        <span className="font-medium">Queries:</span> {queries.length}
                        <span className="mx-2">|</span>
                        <span className="font-medium">Expanded:</span> {expandedQueries.size}
                    </div>
                )}
            </div>

            {/* Client Logo/Brand Header */}
            {selectedClient && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 p-6 mb-6 flex items-center gap-6">
                    {/* Client Logo */}
                    {selectedClient.brandPhotos && selectedClient.brandPhotos.length > 0 ? (
                        <div className="flex-shrink-0">
                            <img
                                src={selectedClient.brandPhotos[0]}
                                alt={`${selectedClient.name} logo`}
                                className="w-20 h-20 object-contain rounded-lg border border-indigo-200 bg-white p-2 shadow-sm"
                            />
                        </div>
                    ) : (
                        <div className="flex-shrink-0 w-20 h-20 bg-indigo-100 rounded-lg border border-indigo-200 flex items-center justify-center">
                            <span className="text-3xl font-bold text-indigo-400">
                                {selectedClient.name.charAt(0).toUpperCase()}
                            </span>
                        </div>
                    )}
                    {/* Client Info */}
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900">{selectedClient.name}</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Client Code: <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-indigo-600">{selectedClient.code}</span>
                        </p>
                        {selectedClient.domains && selectedClient.domains.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {selectedClient.domains.slice(0, 3).map((domain: string, i: number) => (
                                    <span key={i} className="text-xs bg-white border border-gray-200 px-2 py-1 rounded text-gray-600">
                                        🌐 {domain}
                                    </span>
                                ))}
                                {selectedClient.domains.length > 3 && (
                                    <span className="text-xs text-gray-400">+{selectedClient.domains.length - 3} more</span>
                                )}
                            </div>
                        )}
                    </div>
                    {/* Quick Stats */}
                    <div className="flex gap-4 text-center">
                        <div className="bg-white rounded-lg px-4 py-2 border shadow-sm">
                            <div className="text-2xl font-bold text-indigo-600">{queries.length}</div>
                            <div className="text-xs text-gray-500">Queries</div>
                        </div>
                        <div className="bg-white rounded-lg px-4 py-2 border shadow-sm">
                            <div className="text-2xl font-bold text-green-600">{expandedQueries.size}</div>
                            <div className="text-xs text-gray-500">Expanded</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Query Cards */}
            {loading ? (
                <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
                    <svg className="animate-spin h-8 w-8 mx-auto mb-2 text-indigo-600" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-gray-500">Loading queries...</p>
                </div>
            ) : queries.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
                    <p className="text-gray-500">No queries available</p>
                    <p className="text-sm text-gray-400 mt-2">Select a client to view their dashboard</p>
                </div>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div className="space-y-6">
                        {Object.entries(queriesByGroup).map(([groupName, groupQueries]) => (
                            <div key={groupName}>
                                <h2
                                    className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2 group cursor-pointer"
                                    onClick={() => {
                                        const group = queryGroups.find(g => g.name === groupName);
                                        if (group) {
                                            setEditingCategory(group.id);
                                            setEditCategoryValue(categoryNames[group.id] || groupName);
                                        }
                                    }}
                                >
                                    <span className="w-1 h-5 bg-indigo-500 rounded-full"></span>
                                    {editingCategory === queryGroups.find(g => g.name === groupName)?.id ? (
                                        <input
                                            type="text"
                                            value={editCategoryValue}
                                            onChange={(e) => setEditCategoryValue(e.target.value)}
                                            onBlur={() => {
                                                const group = queryGroups.find(g => g.name === groupName);
                                                if (group) handleCategoryNameSave(group.id, editCategoryValue);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const group = queryGroups.find(g => g.name === groupName);
                                                    if (group) handleCategoryNameSave(group.id, editCategoryValue);
                                                }
                                                if (e.key === 'Escape') {
                                                    setEditingCategory(null);
                                                }
                                            }}
                                            className="border border-indigo-300 rounded px-2 py-0.5 text-lg font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <>
                                            {categoryNames[queryGroups.find(g => g.name === groupName)?.id || ''] || groupName}
                                            <svg className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                        </>
                                    )}
                                </h2>
                                <SortableContext
                                    items={groupQueries.map(q => q.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="space-y-3">
                                        {groupQueries.map((query, queryIndex) => {
                                            // Calculate global card number (1, 2, 3, ...)
                                            // Find the position across all groups
                                            let globalIndex = 0;
                                            for (const [gn, gq] of Object.entries(queriesByGroup)) {
                                                if (gn === groupName) {
                                                    globalIndex += queryIndex + 1;
                                                    break;
                                                }
                                                globalIndex += gq.length;
                                            }

                                            return (
                                                <SortableQueryCard key={query.id} id={query.id}>
                                                    <QueryCard
                                                        query={query}
                                                        result={queryResults[query.id] || null}
                                                        isExpanded={expandedQueries.has(query.id)}
                                                        isLoading={loadingQueries.has(query.id)}
                                                        onToggle={() => toggleQuery(query.id)}
                                                        customTitle={customTitles[query.id]}
                                                        onTitleChange={handleTitleChange}
                                                        pageTitle={pageTitles[query.id]}
                                                        pageContent={pageContents[query.id]}
                                                        onPageTitleChange={handlePageTitleChange}
                                                        onPageContentChange={handlePageContentChange}
                                                        cardNumber={globalIndex}
                                                        onDelete={deleteCard}
                                                    />
                                                </SortableQueryCard>
                                            );
                                        })}
                                    </div>
                                </SortableContext>
                            </div>
                        ))}
                    </div>
                    <DragOverlay>
                        {activeId ? (
                            <div className="bg-white rounded-lg border-2 border-indigo-400 shadow-lg p-4 opacity-90">
                                <span className="font-mono text-indigo-600">{activeId}</span>
                                <span className="ml-2 text-gray-600">Dragging...</span>
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            )}

            {/* Info Footer */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">About the Dashboard</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Each query has a unique ID (e.g., Q001) for tracking and reference</li>
                    <li>• Click on a query to expand and view results</li>
                    <li>• Balloon sizes represent search volume - larger = higher volume</li>
                    <li>• Status badges indicate query importance: Critical, Warning, Info, Success</li>
                    <li>• Export PDF opens a print dialog - use "Save as PDF" option</li>
                </ul>
            </div>
        </div>
    );
}
