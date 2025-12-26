'use client';

import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import { Client } from '@/types';

interface CompetitorInfo {
    domain: string;
    url: string;
    isSelf: boolean;
}

interface RankRow {
    id: string;
    keyword: string;
    location: 'IN' | 'GL';

    // New Metrics
    searchVolume: number | null;
    cpc: number | null;
    competition: string | number | null;

    rank: number | null;
    rankUrl: string | null;
    googleUrl: string;
    competitors: CompetitorInfo[]; // Top 10
}

type SortKey = 'keyword' | 'location' | 'searchVolume' | 'cpc' | 'competition' | 'rank';

export default function ClientRankPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [clientCode, setClientCode] = useState<string>('');
    const [records, setRecords] = useState<RankRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'ALL' | 'IN' | 'GL'>('ALL');

    // Sorting
    const [sortKey, setSortKey] = useState<SortKey>('rank');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    // Filtering
    const [domainFilter, setDomainFilter] = useState('');

    // Pagination
    const [pageSize, setPageSize] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        fetchClients();
    }, []);

    useEffect(() => {
        if (clientCode) {
            fetchData();
        } else {
            setRecords([]);
        }
    }, [clientCode]);

    async function fetchClients() {
        try {
            const res = await fetch('/api/clients');
            const data = await res.json();
            setClients(data);
            const active = data.find((c: Client) => c.isActive);
            if (active) setClientCode(active.code);
        } catch (e) {
            console.error(e);
        }
    }

    async function fetchData() {
        setLoading(true);
        try {
            const res = await fetch(`/api/curated/client-rank?clientCode=${clientCode}`);
            const json = await res.json();
            if (json.success) {
                setRecords(json.data);
                setCurrentPage(1); // Reset to page 1 on new data
                setDomainFilter(''); // Reset filter
            } else {
                setRecords([]);
            }
        } catch (e) {
            console.error(e);
            setRecords([]);
        } finally {
            setLoading(false);
        }
    }

    // Extract Unique Domains
    const uniqueDomains = useMemo(() => {
        const domains = new Set<string>();
        records.forEach(r => {
            // Check rank URL
            if (r.rankUrl) {
                try {
                    const d = new URL(r.rankUrl).hostname.replace(/^www\./, '');
                    domains.add(d);
                } catch { }
            }
            // Check competitors
            r.competitors.forEach(c => {
                if (c.domain) domains.add(c.domain);
            });
        });
        return Array.from(domains).sort();
    }, [records]);

    const filteredRecords = useMemo(() => {
        let sorted = [...records];

        if (activeTab !== 'ALL') {
            sorted = sorted.filter(r => r.location === activeTab);
        }

        if (searchTerm) {
            sorted = sorted.filter(r => r.keyword.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        if (domainFilter) {
            sorted = sorted.filter(r => {
                // Check if rank matches
                let rankMatch = false;
                if (r.rankUrl) {
                    try {
                        const d = new URL(r.rankUrl).hostname.replace(/^www\./, '');
                        if (d === domainFilter) rankMatch = true;
                    } catch { }
                }
                if (rankMatch) return true;

                // Check competitors
                return r.competitors.some(c => c.domain === domainFilter);
            });
        }

        // Apply Sorting
        sorted.sort((a, b) => {
            let valA: any = a[sortKey];
            let valB: any = b[sortKey];

            // Special handling for Rank to treat >50 (null) as 999
            if (sortKey === 'rank') {
                const rA = typeof valA === 'number' ? valA : 999;
                const rB = typeof valB === 'number' ? valB : 999;
                return sortDirection === 'asc' ? rA - rB : rB - rA;
            }

            // Handle Nulls (Always put at bottom)
            if (valA === null && valB === null) return 0;
            if (valA === null) return 1;
            if (valB === null) return -1;

            // Numeric Sort
            if (typeof valA === 'number' && typeof valB === 'number') {
                return sortDirection === 'asc' ? valA - valB : valB - valA;
            }

            // String Sort
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return sorted;
    }, [records, searchTerm, activeTab, sortKey, sortDirection, domainFilter]);

    // Apply Pagination
    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredRecords.slice(start, start + pageSize);
    }, [filteredRecords, currentPage, pageSize]);

    const totalPages = Math.ceil(filteredRecords.length / pageSize);

    // Helpers
    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc'); // Default to asc for new column
        }
    };

    const renderSortIndicator = (key: SortKey) => {
        if (sortKey !== key) return null;
        return <span className="ml-1 text-[10px]">{sortDirection === 'asc' ? '▲' : '▼'}</span>;
    };

    const renderCompetition = (val: string | number | null) => {
        if (val === null) return '-';
        if (typeof val === 'number') return val.toFixed(2);
        return val;
    };

    return (
        <div className="p-6 max-w-full mx-auto h-screen flex flex-col">
            <PageHeader
                title="Client Rank"
                description="Keyword Rankings & Competitors (Top 10)"
            />

            <div className="bg-white p-4 rounded-lg shadow-sm border mb-4 flex flex-wrap gap-4 items-end flex-shrink-0">
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Client</label>
                    <select
                        className="border rounded px-3 py-1.5 text-sm w-48"
                        value={clientCode}
                        onChange={e => setClientCode(e.target.value)}
                    >
                        <option value="">Select...</option>
                        {clients.map(c => <option key={c.id} value={c.code}>{c.name}</option>)}
                    </select>
                </div>

                {/* Tabs */}
                <div className="flex bg-gray-100 p-1 rounded-md">
                    {(['ALL', 'IN', 'GL'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-1.5 text-xs font-medium rounded ${activeTab === tab ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {tab === 'IN' ? 'India 🇮🇳' : tab === 'GL' ? 'Global 🌎' : 'ALL'}
                        </button>
                    ))}
                </div>

                {/* Domain Filter */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Filter Domain</label>
                    <select
                        className="border rounded px-3 py-1.5 text-sm w-48"
                        value={domainFilter}
                        onChange={e => { setDomainFilter(e.target.value); setCurrentPage(1); }}
                        disabled={uniqueDomains.length === 0}
                    >
                        <option value="">All Domains</option>
                        {uniqueDomains.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>

                <div className="flex-1 text-right self-center text-xs text-gray-500">
                    {loading ? 'Loading...' : `Showing ${filteredRecords.length} of ${records.length} records`}
                </div>

                <div className="w-48">
                    <input
                        type="text"
                        placeholder="Search keywords..."
                        value={searchTerm}
                        onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="w-full border rounded px-3 py-1.5 text-sm"
                    />
                </div>
            </div>

            {/* Table Container with Scroll */}
            <div className="bg-white border rounded-lg shadow-sm flex-1 overflow-hidden flex flex-col min-h-0">
                <div className="overflow-auto flex-1">
                    <table className="w-full text-xs text-left whitespace-nowrap relative">
                        <thead className="bg-gray-50 text-gray-700 font-medium border-b sticky top-0 z-30">
                            <tr>
                                <th
                                    className="px-3 py-3 w-48 sticky left-0 bg-gray-50 z-40 shadow-[1px_0_0_0_rgba(0,0,0,0.1)] cursor-pointer hover:bg-gray-100 select-none"
                                    onClick={() => handleSort('keyword')}
                                >
                                    Keyword {renderSortIndicator('keyword')}
                                </th>
                                <th
                                    className="px-3 py-3 w-16 text-center cursor-pointer hover:bg-gray-100 select-none"
                                    onClick={() => handleSort('location')}
                                >
                                    Loc {renderSortIndicator('location')}
                                </th>
                                <th
                                    className="px-3 py-3 w-16 text-right cursor-pointer hover:bg-gray-100 select-none"
                                    onClick={() => handleSort('searchVolume')}
                                >
                                    Vol {renderSortIndicator('searchVolume')}
                                </th>
                                <th
                                    className="px-3 py-3 w-16 text-right cursor-pointer hover:bg-gray-100 select-none"
                                    onClick={() => handleSort('cpc')}
                                >
                                    CPC {renderSortIndicator('cpc')}
                                </th>
                                <th
                                    className="px-3 py-3 w-16 text-center cursor-pointer hover:bg-gray-100 select-none"
                                    onClick={() => handleSort('competition')}
                                >
                                    Comp {renderSortIndicator('competition')}
                                </th>
                                <th
                                    className="px-3 py-3 w-16 text-center cursor-pointer hover:bg-gray-100 select-none"
                                    onClick={() => handleSort('rank')}
                                >
                                    Rank {renderSortIndicator('rank')}
                                </th>
                                {Array.from({ length: 10 }).map((_, i) => (
                                    <th key={i} className="px-1 py-3 text-center w-20 border-l border-gray-100 text-[10px]" title={`Position ${i + 1}`}>
                                        C{i + 1}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y text-[11px]">
                            {loading && <tr><td colSpan={16} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>}
                            {!loading && filteredRecords.length === 0 && (
                                <tr><td colSpan={16} className="px-4 py-8 text-center text-gray-400">No data found. Select a client to load.</td></tr>
                            )}
                            {paginatedRecords.map((r, i) => {
                                const rankLabel = r.rank ? String(r.rank) : '>50';
                                let rankClass = 'bg-gray-100 text-gray-400';
                                if (r.rank) {
                                    if (r.rank <= 3) rankClass = 'bg-green-100 text-green-700 font-bold';
                                    else if (r.rank <= 10) rankClass = 'bg-green-50 text-green-600 font-semibold';
                                    else if (r.rank <= 20) rankClass = 'bg-yellow-50 text-yellow-700';
                                    else rankClass = 'bg-white border text-gray-700';
                                }

                                return (
                                    <tr key={r.id} className="hover:bg-gray-50 group">
                                        <td className="px-3 py-1.5 font-medium text-gray-900 border-r sticky left-0 bg-white group-hover:bg-gray-50 z-20 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                                            <div className="flex items-center gap-2">
                                                <a
                                                    href={r.googleUrl}
                                                    target="_blank"
                                                    className="hover:underline hover:text-indigo-600 truncate max-w-[180px]"
                                                    title="View in Google"
                                                >
                                                    {r.keyword}
                                                </a>
                                            </div>
                                        </td>

                                        <td className="px-3 py-1.5 text-center">
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${r.location === 'IN' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {r.location}
                                            </span>
                                        </td>

                                        {/* New Metrics */}
                                        <td className="px-3 py-1.5 text-right font-mono text-gray-600">
                                            {r.searchVolume?.toLocaleString() || '-'}
                                        </td>
                                        <td className="px-3 py-1.5 text-right font-mono text-gray-600">
                                            {r.cpc != null ? '$' + r.cpc.toFixed(2) : '-'}
                                        </td>
                                        <td className="px-3 py-1.5 text-center text-gray-600">
                                            {renderCompetition(r.competition)}
                                        </td>

                                        <td className="px-3 py-1.5 text-center">
                                            <div className={`px-2 py-0.5 rounded text-center inline-block min-w-[30px] ${rankClass}`}>
                                                {rankLabel}
                                            </div>
                                        </td>

                                        {/* Competitors C1-C10 */}
                                        {r.competitors.map((comp, idx) => {
                                            const brand = comp.domain ? comp.domain.split('.')[0] : '-';
                                            // Highlight if matches domain filter
                                            const isFilterMatch = domainFilter && comp.domain === domainFilter;
                                            const cellClass = isFilterMatch ? 'bg-yellow-100 font-bold border-yellow-300' : (comp.isSelf ? 'bg-indigo-50' : '');
                                            const linkClass = isFilterMatch ? 'text-yellow-800' : (comp.isSelf ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-gray-500 hover:text-gray-900');

                                            return (
                                                <td key={idx} className={`px-1 py-1 text-center border-l border-gray-50 text-[10px] ${cellClass}`}>
                                                    {comp.domain ? (
                                                        <a
                                                            href={comp.url}
                                                            target="_blank"
                                                            className={`block truncate max-w-[80px] px-1 py-0.5 rounded ${linkClass}`}
                                                            title={comp.domain}
                                                        >
                                                            {brand}
                                                        </a>
                                                    ) : (
                                                        <span className="text-gray-100">-</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="p-2 border-t bg-gray-50 flex justify-between items-center text-xs flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500">Rows per page:</span>
                        <select
                            value={pageSize}
                            onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                            className="border rounded px-2 py-1"
                        >
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={500}>500</option>
                        </select>
                        <span className="text-gray-500 ml-2">
                            Showing {filteredRecords.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredRecords.length)} of {filteredRecords.length}
                        </span>
                    </div>

                    <div className="flex gap-1">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            className="px-3 py-1 border rounded bg-white hover:bg-gray-100 disabled:opacity-50"
                        >
                            Prev
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let p = i + 1;
                            if (totalPages > 5 && currentPage > 3) {
                                p = currentPage - 2 + i;
                            }
                            if (p > totalPages) return null;
                            if (p < 1) return null;

                            return (
                                <button
                                    key={p}
                                    onClick={() => setCurrentPage(p)}
                                    className={`px-3 py-1 border rounded ${currentPage === p ? 'bg-indigo-600 text-white' : 'bg-white hover:bg-gray-100'}`}
                                >
                                    {p}
                                </button>
                            );
                        })}
                        <button
                            disabled={currentPage === totalPages || totalPages === 0}
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            className="px-3 py-1 border rounded bg-white hover:bg-gray-100 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
