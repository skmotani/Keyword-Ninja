'use client';

import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import { Client } from '@/types';
import { KeywordSerpEntry } from '@/lib/clientSerpStore';
import { SerpResultItem } from '@/lib/serpResultsDatabase';

export default function ClientSerpPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [clientCode, setClientCode] = useState<string>('');
    const [selectedDomain, setSelectedDomain] = useState<string>('');
    const [availableDomains, setAvailableDomains] = useState<string[]>([]);
    
    // Import state
    const [importText, setImportText] = useState('');
    const [importSource, setImportSource] = useState('Manual');
    const [showImportModal, setShowImportModal] = useState(false);
    
    // Fetch state
    const [fetching, setFetching] = useState(false);
    const [fetchProgress, setFetchProgress] = useState<string>('');
    const [currentJob, setCurrentJob] = useState<any>(null);
    const [polling, setPolling] = useState(false);
    
    // Data state
    const [serpData, setSerpData] = useState<KeywordSerpEntry[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Filter state
    const [locationFilter, setLocationFilter] = useState<'IN' | 'GL' | 'BOTH'>('BOTH');
    const [expandedKeywords, setExpandedKeywords] = useState<Set<string>>(new Set());
    const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchClients();
    }, []);

    useEffect(() => {
        if (clientCode) {
            const client = clients.find(c => c.code === clientCode);
            if (client) {
                const domains = client.domains || (client.mainDomain ? [client.mainDomain] : []);
                setAvailableDomains(domains);
                if (domains.length > 0 && !selectedDomain) {
                    setSelectedDomain(domains[0]);
                }
            }
        }
    }, [clientCode, clients]);

    useEffect(() => {
        if (clientCode) {
            fetchSerpData();
        } else {
            setSerpData([]);
        }
    }, [clientCode]);

    // Polling effect for job status
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (polling && currentJob?.jobId) {
            interval = setInterval(async () => {
                try {
                    const res = await fetch(`/api/curated/client-serp/status?jobId=${currentJob.jobId}`);
                    if (res.status === 404) {
                        setPolling(false);
                        setCurrentJob(null);
                        setFetching(false);
                        return;
                    }
                    const job = await res.json();
                    if (job.success) {
                        setCurrentJob(job);
                        
                        // Update progress message
                        const stage = job.stage || 'PREPARE';
                        const progress = job.progress || { IN: {}, GL: {} };
                        const currentLoc = stage.includes('IN') ? 'IN' : stage.includes('GL') ? 'GL' : null;
                        
                        if (currentLoc && progress[currentLoc]) {
                            const p = progress[currentLoc];
                            setFetchProgress(
                                `${stage}: ${p.done}/${p.total} keywords - ${p.current || 'Processing...'}`
                            );
                        } else {
                            setFetchProgress(`${stage}: Processing...`);
                        }
                        
                        if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') {
                            setPolling(false);
                            setFetching(false);
                            fetchSerpData();
                            if (job.status === 'COMPLETED') {
                                const totalDone = (progress.IN?.done || 0) + (progress.GL?.done || 0);
                                setFetchProgress(`Completed! Fetched ${totalDone} keyword results`);
                            } else {
                                const errorList = job.errors && job.errors.length > 0 
                                    ? job.errors.slice(0, 3).join('; ') + (job.errors.length > 3 ? ` (+${job.errors.length - 3} more)` : '')
                                    : 'Unknown error';
                                setFetchProgress(`Failed: ${errorList}`);
                            }
                        } else if (job.errors && job.errors.length > 0) {
                            // Show errors immediately even if job is still running
                            const errorList = job.errors.slice(-3).join('; ');
                            setFetchProgress(`Errors: ${errorList}`);
                        }
                    }
                } catch (e) {
                    console.error('Poll error', e);
                }
            }, 2000); // Poll every 2 seconds
        }
        return () => clearInterval(interval);
    }, [polling, currentJob?.jobId, clientCode]);

    async function fetchClients() {
        try {
            const res = await fetch('/api/clients');
            const data = await res.json();
            setClients(data);
            const active = data.find((c: Client) => c.isActive);
            if (active) setClientCode(active.code);
        } catch (e) {
            console.error('Failed to fetch clients', e);
        }
    }

    async function fetchSerpData() {
        if (!clientCode) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/curated/client-serp?clientCode=${clientCode}`);
            const json = await res.json();
            if (json.success) {
                setSerpData(json.data.keywords || []);
            }
        } catch (e) {
            console.error('Failed to fetch SERP data', e);
        } finally {
            setLoading(false);
        }
    }

    async function handleImport() {
        if (!clientCode) {
            alert('Please select a client');
            return;
        }

        const keywords = importText.split('\n').map(k => k.trim()).filter(k => k);
        if (keywords.length === 0) {
            alert('No keywords found');
            return;
        }

        if (!importSource.trim()) {
            alert('Please enter a source');
            return;
        }

        try {
            const res = await fetch('/api/curated/client-serp/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientCode,
                    keywords,
                    source: importSource
                })
            });

            const json = await res.json();
            if (json.success) {
                alert(`Imported ${json.imported} keywords`);
                setImportText('');
                setImportSource('Manual');
                setShowImportModal(false);
                fetchSerpData();
            } else {
                alert('Import failed: ' + json.error);
            }
        } catch (e: any) {
            alert('Import error: ' + e.message);
        }
    }

    async function handleFetchSerp() {
        console.log('[Client SERP] Fetch button clicked');
        
        if (!clientCode || !selectedDomain) {
            alert('Please select client and domain');
            return;
        }

        const keywords = serpData.map(k => k.keyword);
        console.log('[Client SERP] Keywords to fetch:', keywords.length);
        
        if (keywords.length === 0) {
            alert('No keywords to fetch. Please import keywords first.');
            return;
        }

        setFetching(true);
        setFetchProgress('Starting SERP fetch...');
        setPolling(false);
        setCurrentJob(null);

        try {
            console.log('[Client SERP] Calling fetch API...');
            const res = await fetch('/api/curated/client-serp/fetch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientCode,
                    keywords,
                    selectedDomain
                })
            });

            console.log('[Client SERP] Response status:', res.status);
            const json = await res.json();
            console.log('[Client SERP] Response:', json);
            
            if (json.success && json.jobId) {
                setCurrentJob({ jobId: json.jobId, status: json.status });
                setPolling(true);
                setFetchProgress('Job created, starting...');
            } else {
                alert('Fetch failed: ' + (json.error || 'Unknown error'));
                setFetching(false);
                setFetchProgress('');
            }
        } catch (e: any) {
            console.error('[Client SERP] Fetch error:', e);
            alert('Fetch error: ' + e.message);
            setFetching(false);
            setFetchProgress('');
        }
    }

    const filteredKeywords = useMemo(() => {
        let filtered = [...serpData];

        if (locationFilter !== 'BOTH') {
            filtered = filtered.filter(k => {
                if (locationFilter === 'IN') return k.serp.IN && k.serp.IN.results.length > 0;
                if (locationFilter === 'GL') return k.serp.GL && k.serp.GL.results.length > 0;
                return true;
            });
        }

        return filtered;
    }, [serpData, locationFilter]);

    const toggleKeyword = (keyword: string) => {
        const newSet = new Set(expandedKeywords);
        if (newSet.has(keyword)) {
            newSet.delete(keyword);
        } else {
            newSet.add(keyword);
        }
        setExpandedKeywords(newSet);
    };

    const toggleResults = (key: string) => {
        const newSet = new Set(expandedResults);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
        }
        setExpandedResults(newSet);
    };

    const renderSerpResults = (results: SerpResultItem[], location: 'IN' | 'GL', keyword: string) => {
        if (!results || results.length === 0) {
            return <div className="text-gray-400 text-sm">No results available</div>;
        }

        const displayResults = expandedResults.has(`${keyword}-${location}`) ? results : results.slice(0, 10);
        const hasMore = results.length > 10;

        return (
            <div className="space-y-2">
                <div className="space-y-1">
                    {displayResults.map((item, idx) => (
                        <div key={idx} className="border-l-2 border-gray-200 pl-3 py-2 hover:bg-gray-50">
                            <div className="flex items-start gap-2">
                                <span className="text-xs font-bold text-gray-500 w-8 flex-shrink-0">
                                    #{item.rank_group}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm text-blue-600 truncate">
                                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                            {item.title || item.url}
                                        </a>
                                    </div>
                                    <div className="text-xs text-gray-500 truncate mt-0.5">
                                        {item.domain}
                                    </div>
                                    {item.description && (
                                        <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                                            {item.description}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                {hasMore && (
                    <button
                        onClick={() => toggleResults(`${keyword}-${location}`)}
                        className="text-xs text-indigo-600 hover:underline"
                    >
                        {expandedResults.has(`${keyword}-${location}`) 
                            ? `Show less (showing ${results.length} of ${results.length})`
                            : `Show all ${results.length} results (showing 10)`
                        }
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="p-6 max-w-full mx-auto">
            <PageHeader
                title="Client SERP Analysis"
                description="Bulk import keywords, fetch SERP results from DataForSEO, and analyze rankings for India and Global locations."
            />

            {/* Top Bar */}
            <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
                <div className="flex flex-wrap items-center gap-4 justify-between mb-4">
                    <div className="flex gap-4 items-end">
                        <div className="w-48">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Client</label>
                            <select
                                value={clientCode}
                                onChange={e => { setClientCode(e.target.value); setSelectedDomain(''); }}
                                className="w-full border rounded px-2 py-1.5 text-sm"
                            >
                                <option value="">Select...</option>
                                {clients.map(c => <option key={c.id} value={c.code}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="w-64">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Domain</label>
                            <select
                                value={selectedDomain}
                                onChange={e => setSelectedDomain(e.target.value)}
                                className="w-full border rounded px-2 py-1.5 text-sm"
                                disabled={!availableDomains.length}
                            >
                                {availableDomains.length === 0 && <option>No domains found</option>}
                                {availableDomains.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-2 items-center">
                        <button
                            onClick={() => setShowImportModal(true)}
                            className="px-3 py-1.5 bg-gray-100 border rounded text-xs hover:bg-gray-200"
                        >
                            + Import Keywords
                        </button>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                console.log('[Client SERP] Button clicked');
                                console.log('[Client SERP] State check:', {
                                    fetching,
                                    clientCode,
                                    selectedDomain,
                                    keywordsCount: serpData.length
                                });
                                if (!fetching && clientCode && selectedDomain && serpData.length > 0) {
                                    handleFetchSerp();
                                } else {
                                    console.warn('[Client SERP] Button disabled or conditions not met');
                                }
                            }}
                            disabled={fetching || !clientCode || !selectedDomain || serpData.length === 0}
                            className={`px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow transition-colors`}
                            title={
                                serpData.length === 0 
                                    ? 'Import keywords first' 
                                    : !clientCode 
                                        ? 'Select a client' 
                                        : !selectedDomain 
                                            ? 'Select a domain' 
                                            : fetching
                                                ? 'Fetching in progress...'
                                                : 'Fetch SERP results for all keywords'
                            }
                        >
                            {fetching ? 'Fetching...' : 'Fetch SERP Results'}
                        </button>
                    </div>
                </div>

                {/* Location Filter */}
                <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-gray-500">Filter:</span>
                    <div className="flex bg-gray-100 p-1 rounded-md">
                        <button
                            onClick={() => setLocationFilter('BOTH')}
                            className={`px-4 py-1.5 text-xs font-medium rounded ${locationFilter === 'BOTH' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Both
                        </button>
                        <button
                            onClick={() => setLocationFilter('IN')}
                            className={`px-4 py-1.5 text-xs font-medium rounded ${locationFilter === 'IN' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            India 🇮🇳
                        </button>
                        <button
                            onClick={() => setLocationFilter('GL')}
                            className={`px-4 py-1.5 text-xs font-medium rounded ${locationFilter === 'GL' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Global 🌎
                        </button>
                    </div>
                    {fetchProgress && (
                        <span className="text-xs text-blue-600 ml-4">{fetchProgress}</span>
                    )}
                </div>
            </div>

            {/* Progress Display */}
            {currentJob && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-semibold text-blue-800">
                            {currentJob.status === 'RUNNING' ? '🔄 Fetching SERP Results...' : `Job ${currentJob.status}`}
                        </div>
                        {currentJob.stage && (
                            <div className="text-xs text-blue-600">
                                Stage: {currentJob.stage}
                            </div>
                        )}
                    </div>
                    {currentJob.progress && (
                        <div className="space-y-2 text-xs">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-700 w-16">India 🇮🇳:</span>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                                            <div 
                                                className="bg-green-500 h-2 rounded-full transition-all"
                                                style={{ width: `${Math.min(100, (currentJob.progress.IN.done / currentJob.progress.IN.total) * 100)}%` }}
                                            />
                                        </div>
                                        <span className="text-gray-700 w-20 text-right">
                                            {currentJob.progress.IN.done}/{currentJob.progress.IN.total}
                                        </span>
                                    </div>
                                    {currentJob.progress.IN.current && (
                                        <div className="text-gray-600 mt-1 text-xs">
                                            {currentJob.progress.IN.current}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-700 w-16">Global 🌎:</span>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                                            <div 
                                                className="bg-blue-500 h-2 rounded-full transition-all"
                                                style={{ width: `${Math.min(100, (currentJob.progress.GL.done / currentJob.progress.GL.total) * 100)}%` }}
                                            />
                                        </div>
                                        <span className="text-gray-700 w-20 text-right">
                                            {currentJob.progress.GL.done}/{currentJob.progress.GL.total}
                                        </span>
                                    </div>
                                    {currentJob.progress.GL.current && (
                                        <div className="text-gray-600 mt-1 text-xs">
                                            {currentJob.progress.GL.current}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    {currentJob.errors && currentJob.errors.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-blue-200">
                            <div className="text-xs font-semibold text-red-700 mb-1">Errors:</div>
                            <div className="text-xs text-red-600 max-h-20 overflow-y-auto">
                                {currentJob.errors.slice(-5).map((err: string, idx: number) => (
                                    <div key={idx}>• {err}</div>
                                ))}
                                {currentJob.errors.length > 5 && (
                                    <div className="text-gray-500">... and {currentJob.errors.length - 5} more</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Keywords List */}
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Loading...</div>
                ) : filteredKeywords.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        {serpData.length === 0 
                            ? 'No keywords imported. Click "Import Keywords" to get started.'
                            : 'No keywords match the current filter.'
                        }
                    </div>
                ) : (
                    <div className="divide-y">
                        {filteredKeywords.map((entry, idx) => {
                            const hasIN = entry.serp.IN && entry.serp.IN.results.length > 0;
                            const hasGL = entry.serp.GL && entry.serp.GL.results.length > 0;
                            const isExpanded = expandedKeywords.has(entry.keyword);

                            return (
                                <div key={idx} className="p-4 hover:bg-gray-50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => toggleKeyword(entry.keyword)}
                                                    className="text-sm font-medium text-gray-900 hover:text-indigo-600"
                                                >
                                                    {isExpanded ? '▼' : '▶'} {entry.keyword}
                                                </button>
                                                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                                                    {entry.source}
                                                </span>
                                                {hasIN && (
                                                    <span className="text-xs bg-green-100 px-2 py-0.5 rounded text-green-700">
                                                        IN: {entry.serp.IN!.results.length} results
                                                    </span>
                                                )}
                                                {hasGL && (
                                                    <span className="text-xs bg-blue-100 px-2 py-0.5 rounded text-blue-700">
                                                        GL: {entry.serp.GL!.results.length} results
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1">
                                                Imported: {new Date(entry.importedAt).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="mt-4 space-y-4 pl-4 border-l-2 border-indigo-200">
                                            {(locationFilter === 'BOTH' || locationFilter === 'IN') && (
                                                <div>
                                                    <h4 className="text-sm font-semibold text-gray-700 mb-2">
                                                        India 🇮🇳 Results
                                                        {hasIN && entry.serp.IN && (
                                                            <span className="text-xs text-gray-500 ml-2">
                                                                (Last fetched: {new Date(entry.serp.IN.lastFetched).toLocaleString()})
                                                            </span>
                                                        )}
                                                    </h4>
                                                    {hasIN ? (
                                                        renderSerpResults(entry.serp.IN!.results, 'IN', entry.keyword)
                                                    ) : (
                                                        <div className="text-gray-400 text-sm">No results available</div>
                                                    )}
                                                </div>
                                            )}

                                            {(locationFilter === 'BOTH' || locationFilter === 'GL') && (
                                                <div>
                                                    <h4 className="text-sm font-semibold text-gray-700 mb-2">
                                                        Global 🌎 Results
                                                        {hasGL && entry.serp.GL && (
                                                            <span className="text-xs text-gray-500 ml-2">
                                                                (Last fetched: {new Date(entry.serp.GL.lastFetched).toLocaleString()})
                                                            </span>
                                                        )}
                                                    </h4>
                                                    {hasGL ? (
                                                        renderSerpResults(entry.serp.GL!.results, 'GL', entry.keyword)
                                                    ) : (
                                                        <div className="text-gray-400 text-sm">No results available</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg w-[600px] max-h-[80vh] overflow-y-auto">
                        <h3 className="text-lg font-bold mb-4">Bulk Import Keywords</h3>
                        <p className="mb-4 text-sm text-gray-600">
                            Enter keywords (one per line) and a source label for this import batch.
                        </p>

                        <div className="mb-4">
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Source</label>
                            <input
                                type="text"
                                value={importSource}
                                onChange={e => setImportSource(e.target.value)}
                                placeholder="e.g., Competitor Research, Content Ideas"
                                className="w-full border rounded px-3 py-2 text-sm"
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Keywords (one per line)</label>
                            <textarea
                                value={importText}
                                onChange={e => setImportText(e.target.value)}
                                placeholder="keyword 1&#10;keyword 2&#10;keyword 3"
                                rows={10}
                                className="w-full border rounded px-3 py-2 text-sm font-mono"
                            />
                        </div>

                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => {
                                    setShowImportModal(false);
                                    setImportText('');
                                    setImportSource('Manual');
                                }}
                                className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleImport}
                                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                            >
                                Import
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

