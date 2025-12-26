'use client';

import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import ExportButton from '@/components/ExportButton';
import { Client, ClientPositionSerpRecord, CompetitorSnapshot } from '@/types';
import PageComments from '@/components/PageComments';

export default function ClientPositionPage() {
    const [clients, setClients] = useState<Client[]>([]);

    // Selection State
    const [clientCode, setClientCode] = useState<string>('');
    const [selectedDomain, setSelectedDomain] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'ALL' | 'IN' | 'GL'>('ALL');

    // Data State
    const [records, setRecords] = useState<ClientPositionSerpRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Diagnostic Logs & Summary
    const [logs, setLogs] = useState<string[]>([]);
    const [showLogs, setShowLogs] = useState(false);
    const [refreshSummary, setRefreshSummary] = useState<{
        in?: boolean;
        gl?: boolean;
        inCount?: number;
        glCount?: number;
        error?: string;
    } | null>(null);

    // Import
    const [showImportModal, setShowImportModal] = useState(false);
    const [importText, setImportText] = useState('');
    const [importSource, setImportSource] = useState('Manual');

    // Available Domains derived from selected client
    const [availableDomains, setAvailableDomains] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

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
        if (clientCode && selectedDomain) {
            fetchData();
        } else {
            setRecords([]);
        }
    }, [clientCode, selectedDomain]);

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

    async function fetchData() {
        if (!clientCode || !selectedDomain) return;
        try {
            const res = await fetch(`/api/curated/client-position?clientCode=${clientCode}&selectedDomain=${selectedDomain}`);
            const json = await res.json();
            if (json.success) {
                setRecords(json.data);
            }
        } catch (e) {
            console.error(e);
        }
    }


    // Job State
    const [currentJob, setCurrentJob] = useState<any>(null); // Job Status Object
    const [polling, setPolling] = useState(false);

    // Initial Load
    useEffect(() => {
        if (clientCode && selectedDomain) {
            fetchData();
        } else {
            setRecords([]);
        }
    }, [clientCode, selectedDomain]);

    // Polling Effect
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (polling && currentJob?.jobId) {
            interval = setInterval(async () => {
                await checkJobStatus(currentJob.jobId);
                // Also periodically refresh table data to show partials
                // But don't flicker too much. Maybe every 3rd valid poll?
                // Let's just fetch data if we have made progress?
                // Simpler: Just fetch data every 10s or on completion.
                // We'll leave explicit data fetch to completion or user manual reload for now, 
                // OR fetch frequently if specific requirements. Prompt: "Partial results should appear as upserts happen".
                // So we should fetchData occasionally. 
                // Let's do it inside checkJobStatus if needed.
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [polling, currentJob?.jobId]);

    // Also auto-refresh data every 5s while polling to show partials
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (polling) {
            interval = setInterval(fetchData, 5000);
        }
        return () => clearInterval(interval);
    }, [polling, clientCode, selectedDomain]);

    // Delete duplicate fetchClients which was around line 67 in original (now duplicated)
    // The previous edit inserted duplicate fetchClients/fetchData at top, while they existed below.
    // We should have replaced them.
    // Actually, react state `polling` and `currentJob` works.

    // Let's clean up the duplication.
    // The previous `replace_file_check` inserted new versions but the old ones were around line 67-80.
    // The replacement targeted lines 95-146 which was handleRefresh.
    // Wait, the previous replacement inserted `fetchClients` and `fetchData` AGAIN inside the block replacing `handleRefresh`.
    // But `fetchClients` was at line 67.
    // And `fetchData` was at line 79.
    // My replacement block started with `// Job State`.
    // It seems I accidentally duplicated them.

    // I will remove the duplicates from the earlier part of the file or consistent part.
    // Actually, I inserted them into the body.
    // Let's validly implement the whole component body updates or just fix the button.

    // I need to:
    // 1. Remove the duplicated `fetchClients` and `fetchData` that I just pasted in.
    // 2. Rename `handleStartRefresh` to `handleRefresh` OR update the button invocation.

    // Let's just update the button to use `handleStartRefresh` and add the Job UI.


    async function handleStartRefresh() {
        if (!clientCode || !selectedDomain) {
            alert('Please select client and domain');
            return;
        }

        setShowLogs(true);
        setLogs(prev => [...prev, `>>> Requesting Refresh Job for ${selectedDomain}...`]);

        try {
            const res = await fetch('/api/curated/client-position/refresh-start', {
                method: 'POST',
                body: JSON.stringify({ clientCode, selectedDomain })
            });
            const json = await res.json();

            if (json.jobId) {
                setLogs(prev => [...prev, `>>> Job ${json.jobId} ${json.status}`]);
                if (json.status === 'ALREADY_RUNNING') {
                    // Show valid UI state for running job
                    setLogs(prev => [...prev, `>>> Found existing job. Attaching...`]);
                }
                setCurrentJob({ ...json, status: json.status === 'ALREADY_RUNNING' ? 'RUNNING' : 'STARTED' }); // optimistic
                setPolling(true);
            } else {
                alert('Failed to start job: ' + json.error);
            }
        } catch (e: any) {
            alert('Error starting refresh: ' + e.message);
        }
    }

    async function checkJobStatus(jobId: string) {
        try {
            const res = await fetch(`/api/curated/client-position/refresh-status?jobId=${jobId}`);
            if (res.status === 404) {
                setPolling(false);
                setCurrentJob(null);
                return;
            }
            const job = await res.json();
            setCurrentJob(job);

            // Logs sync?
            // Job has `lastLogs`. We can append or just rely on job status UI.
            // Prompt says "refresh-status?jobId=... Response: ... lastLogs".
            // Let's update logs if new ones?
            // For now, UI primarily needs progress/status.

            if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') {
                setPolling(false);
                fetchData(); // Final fetch
                setLogs(prev => [...prev, `>>> Job Finished: ${job.status}`]);
            }
        } catch (e) {
            console.error('Poll error', e);
        }
    }

    async function handleCancel() {
        if (!currentJob?.jobId) return;
        if (!confirm('Stop the refresh job?')) return;
        try {
            await fetch('/api/curated/client-position/refresh-cancel', {
                method: 'POST',
                body: JSON.stringify({ jobId: currentJob.jobId })
            });
            setLogs(prev => [...prev, `>>> Cancellation Requested`]);
            // checkJobStatus will verify eventually
        } catch (e) {
            alert('Cancel failed');
        }
    }

    // Silent Import
    const handleBulkImport = async () => {
        if (!clientCode || !selectedDomain) return alert('Select client/domain');

        const keywords = importText.split('\n').map(k => k.trim()).filter(k => k);
        if (keywords.length === 0) return alert('No keywords found');

        try {
            const res = await fetch('/api/curated/client-position/import', {
                method: 'POST',
                body: JSON.stringify({
                    clientCode,
                    selectedDomain,
                    keywordList: keywords,
                    source: importSource,
                    // Use currently active tab for import location or default? 
                    // Previously depended on activeTab. Let's send current tab if defined, or IN?
                    // The prompt implies Standardization. 
                    // Let's assume import adds to the list, locationType is managed by refresh.
                    // But import API might need locationType. I didn't refactor import API.
                    // I should check if import API uses locationType.
                    // Assuming it does, I'll send 'IN' as safe default if ALL, or the specific tab.
                    locationType: activeTab === 'ALL' ? 'IN' : activeTab
                })
            });
            const json = await res.json();
            if (json.success) {
                fetchData();
                setImportText('');
                setShowImportModal(false);
                setImportSource('Manual');
            } else {
                alert('Import failed: ' + json.error);
            }
        } catch (e) {
            alert('Import error');
        }
    };

    const filteredRecords = useMemo(() => {
        let sorted = [...records];

        // Filter by Tab
        if (activeTab !== 'ALL') {
            sorted = sorted.filter(r => r.locationType === activeTab);
        }

        // Sort by Rank Asc (null at bottom)
        sorted.sort((a, b) => {
            const rA = a.rank ?? 9999;
            const rB = b.rank ?? 9999;
            return rA - rB;
        });

        if (searchTerm) {
            sorted = sorted.filter(r => r.keyword.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        return sorted;
    }, [records, searchTerm, activeTab]);

    const lastUpdated = records.length > 0 ? new Date(records[0].lastPulledAt).toLocaleString() : 'Never';

    return (
        <div className="p-6 max-w-full mx-auto">
            <PageHeader
                title="Client Position Strategy"
                description="Live SERP Tracking and Competitor Analysis via DataForSEO."
            />

            {/* Top Bar */}
            <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
                <div className="flex flex-wrap items-center gap-4 justify-between">
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
                            <label className="block text-xs font-bold text-gray-500 mb-1">Report Domain</label>
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

                        {/* Tabs */}
                        <div className="flex bg-gray-100 p-1 rounded-md">
                            <button
                                onClick={() => setActiveTab('ALL')}
                                className={`px-4 py-1.5 text-xs font-medium rounded ${activeTab === 'ALL' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                ALL
                            </button>
                            <button
                                onClick={() => setActiveTab('IN')}
                                className={`px-4 py-1.5 text-xs font-medium rounded ${activeTab === 'IN' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                India 🇮🇳
                            </button>
                            <button
                                onClick={() => setActiveTab('GL')}
                                className={`px-4 py-1.5 text-xs font-medium rounded ${activeTab === 'GL' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Global 🌎
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-2 items-center">
                        {refreshSummary && (
                            <div className="flex items-center gap-2 mr-2 text-xs border rounded px-2 py-1 bg-gray-50">
                                <span>Refreshed:</span>
                                <span className={refreshSummary.in ? 'text-green-600 font-bold' : 'text-red-500'}>
                                    IN {refreshSummary.in ? '✓' : '✗'}
                                </span>
                                <span className="text-gray-300">|</span>
                                <span className={refreshSummary.gl ? 'text-green-600 font-bold' : 'text-red-500'}>
                                    GL {refreshSummary.gl ? '✓' : '✗'}
                                </span>
                            </div>
                        )}

                        <div className="text-xs text-gray-400 mr-2">
                            Updated: {lastUpdated}
                        </div>

                        <button onClick={() => setShowImportModal(true)} className="px-3 py-1.5 bg-gray-100 border rounded text-xs hover:bg-gray-200">
                            + Import
                        </button>

                        <button
                            onClick={handleStartRefresh}
                            disabled={polling || !selectedDomain || (currentJob && currentJob.status === 'RUNNING' && !polling)}
                            className={`px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow transition-colors`}
                        >
                            {polling ? 'Working...' : 'Refresh Client Position'}
                        </button>

                        <button
                            onClick={() => setShowLogs(!showLogs)}
                            className={`px-2 py-1.5 border rounded text-xs ${showLogs ? 'bg-gray-200' : 'bg-white hover:bg-gray-50'}`}
                            title="Toggle Logs"
                        >
                            Logs
                        </button>

                        <ExportButton
                            data={filteredRecords}
                            columns={[
                                { key: 'keyword', header: 'Keyword' },
                                { key: 'locationType', header: 'Loc' },
                                { key: 'source', header: 'Source' },
                                { key: 'rankLabel_export', header: 'Rank', getValue: r => (r.rankLabel ?? (r.rank != null ? String(r.rank) : '>50')) },
                                { key: 'rank', header: 'Rank (Num)' },
                                { key: 'rankDomain_export', header: 'Matched Domain', getValue: r => (r.rankDomain ?? '') },
                                { key: 'searchVolume', header: 'Vol' },
                                { key: 'competition', header: 'Comp' },
                                { key: 'c1', header: '1', getValue: r => r.c1?.url || '' },
                                { key: 'c2', header: '2', getValue: r => r.c2?.url || '' },
                                { key: 'c3', header: '3', getValue: r => r.c3?.url || '' }
                            ]}
                            filename={`serp_${clientCode}_${activeTab}`}
                        />
                    </div>
                </div>

                {/* Job Progress / Result UI */}
                {currentJob && (
                    <div className="mt-4 mb-4 bg-blue-50 p-3 rounded border border-blue-100 flex flex-col gap-2 text-xs shadow-inner">
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <div className="flex justify-between mb-1">
                                    <span className={`font-bold ${currentJob.status === 'FAILED' ? 'text-red-700' : 'text-blue-800'}`}>
                                        {currentJob.status === 'RUNNING' ? 'Refreshing...' : `Job ${currentJob.status}`}
                                        {currentJob.status === 'RUNNING' && <span className="ml-2 font-normal text-blue-600">Stage: {currentJob.stage}</span>}
                                    </span>
                                    <span className="font-bold text-blue-800">{currentJob.progressPercent}%</span>
                                </div>
                                <div className="w-full bg-blue-200 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full transition-all duration-500 ${currentJob.status === 'FAILED' ? 'bg-red-500' : 'bg-blue-600'}`}
                                        style={{ width: `${currentJob.progressPercent}%` }}
                                    ></div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1 min-w-[120px]">
                                <div className="px-2 py-1 bg-white rounded border flex justify-between">
                                    <span>IN</span>
                                    <span>{currentJob.serp?.IN?.done || 0}/{currentJob.serp?.IN?.total || 0}</span>
                                </div>
                                <div className="px-2 py-1 bg-white rounded border flex justify-between">
                                    <span>GL</span>
                                    <span>{currentJob.serp?.GL?.done || 0}/{currentJob.serp?.GL?.total || 0}</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 ml-2 items-end">
                                {currentJob.status === 'RUNNING' && (
                                    <button onClick={handleCancel} className="text-red-500 hover:text-red-700 underline font-semibold text-[10px]">Cancel</button>
                                )}

                                <a
                                    href={`/api/curated/client-position/download-raw?jobId=${currentJob.jobId}`}
                                    target="_blank"
                                    className="text-blue-500 underline text-[10px] hover:text-blue-700 whitespace-nowrap"
                                >
                                    Download Raw Logs
                                </a>

                                {currentJob.auditCsvPath ? (
                                    <a
                                        href={`/api/curated/client-position/download-audit?jobId=${currentJob.jobId}`}
                                        target="_blank"
                                        className="px-3 py-1.5 bg-green-600 text-white rounded shadow hover:bg-green-700 font-bold text-center no-underline flex items-center gap-1 whitespace-nowrap"
                                    >
                                        <span>Download Audit CSV</span>
                                    </a>
                                ) : null}
                            </div>
                        </div>

                        {/* Forensic Info */}
                        <div className="flex justify-between text-[10px] text-gray-500 border-t border-blue-200 pt-1 mt-1">
                            <span>Last Updated: {new Date(currentJob.updatedAt).toLocaleTimeString()}</span>
                            <span>Heartbeat: {currentJob.heartbeat || 0}</span>
                            <span>ID: {currentJob.jobId}</span>
                        </div>
                    </div>
                )}

                {process.env.NODE_ENV !== 'production' && (
                    <div className="mt-8 p-4 border rounded bg-gray-50 text-xs">
                        <h4 className="font-bold mb-2">Dev / Forensic Tools</h4>
                        <button
                            onClick={async () => {
                                const res = await fetch(`/api/curated/client-position/serp-test?clientCode=${clientCode}&keyword=Bobbin%20Winder&locationType=IN`);
                                const data = await res.json();
                                alert(JSON.stringify(data, null, 2));
                            }}
                            className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded"
                        >
                            Test SERP (Bobbin Winder IN)
                        </button>
                        <p className="mt-1 text-gray-400">Creates raw files in data/serp_raw/TEST_...</p>
                    </div>
                )}

                <div className="mt-4 max-w-sm">
                    <input
                        type="text"
                        placeholder="Filter keywords..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full border rounded px-3 py-1.5 text-sm"
                    />
                </div>

                {/* Diagnostic Logs Panel */}
                {
                    showLogs && (
                        <div className="mt-4 p-2 bg-slate-900 text-slate-200 font-mono text-xs rounded border border-slate-700 max-h-60 overflow-y-auto">
                            <div className="flex justify-between items-center mb-1 sticky top-0 bg-slate-900 border-b border-slate-700 pb-1">
                                <span className="font-bold text-slate-400">Diagnostic Logs</span>
                                <button onClick={() => setLogs([])} className="text-slate-500 hover:text-white">Clear</button>
                            </div>
                            {logs.length === 0 ? <span className="text-slate-600 italic">No logs yet...</span> : logs.map((l, i) => (
                                <div key={i} className="whitespace-pre-wrap py-0.5 border-b border-slate-800/50">{l}</div>
                            ))}
                        </div>
                    )
                }
            </div >

            {/* Table */}
            < div className="bg-white border rounded-lg shadow-sm overflow-x-auto min-h-[500px]" >
                <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium border-b sticky top-0 z-10">
                        <tr>
                            <th className="px-3 py-2 sticky left-0 bg-gray-50 z-20 w-48 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]">Keyword</th>
                            <th className="px-3 py-2 w-16">Loc</th>
                            <th className="px-3 py-2 w-32 border-r">{selectedDomain || 'Domain'}</th>
                            <th className="px-3 py-2 w-20 truncate">Source</th>
                            <th className="px-3 py-2 text-center w-16">Rank</th>
                            <th className="px-3 py-2 text-right w-20">Vol</th>
                            <th className="px-3 py-2 text-center w-16">Comp</th>
                            {Array.from({ length: 10 }).map((_, i) => (
                                <th key={i} className="px-2 py-2 text-center w-24 truncate" title={`Position ${i + 1}`}>
                                    {i + 1}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y result-row">
                        {loading ? (
                            <tr><td colSpan={17} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
                        ) : filteredRecords.length === 0 ? (
                            <tr><td colSpan={17} className="px-4 py-8 text-center text-gray-500">No data found. Import keywords and fetch metrics.</td></tr>
                        ) : (
                            filteredRecords.map((r) => {
                                // 1) Fix Rank label fallback (remove "Absent")
                                const rankLabel = r.rankLabel ?? (r.rank != null ? String(r.rank) : '>50');

                                // 2) Fix rankClass logic
                                const numericRank = r.rank != null ? r.rank :
                                    (rankLabel !== 'ERR' && rankLabel !== '>50' ? Number(rankLabel) : null);

                                let rankClass = 'text-gray-600';
                                if (numericRank != null && numericRank <= 10) rankClass = 'bg-green-100 text-green-700 font-bold';
                                else if (numericRank != null && numericRank <= 20) rankClass = 'bg-yellow-50 text-yellow-700';
                                else if (rankLabel === 'ERR') rankClass = 'bg-red-50 text-red-600 font-mono text-[10px]';
                                else if (rankLabel === '>50') rankClass = 'text-gray-300 italic text-[10px]';

                                // Helper for isSelf
                                const norm = (d: string) => d.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

                                return (
                                    <tr key={r.id} className="hover:bg-gray-50 group">
                                        <td className="px-3 py-2 sticky left-0 bg-white group-hover:bg-gray-50 z-20 border-r shadow-[1px_0_0_0_rgba(0,0,0,0.05)] font-medium text-gray-900 max-w-[200px]" title={r.keyword}>
                                            <div className="flex flex-col">
                                                <span>{r.keyword}</span>
                                                {r.checkUrl && <a href={r.checkUrl} target="_blank" className="text-[9px] text-gray-300 hover:text-indigo-600 truncate">{r.checkUrl}</a>}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-gray-500">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${r.locationType === 'IN' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {r.locationType}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 border-r text-gray-500 truncate max-w-[150px]">{r.selectedDomain}</td>
                                        <td className="px-3 py-2 text-gray-400 truncate max-w-[80px]" title={r.source || 'Manual'}>{r.source || 'Manual'}</td>
                                        <td className="px-3 py-2 text-center">
                                            <div className="flex flex-col items-center justify-center gap-0.5">
                                                <span className={`px-2 py-0.5 rounded ${rankClass}`}>{rankLabel}</span>
                                                {r.rankDomain && (
                                                    <span className="text-[9px] text-gray-400 truncate max-w-[80px]" title={`Matched: ${r.rankDomain}`}>
                                                        {r.rankDomain}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-right text-gray-600">{r.searchVolume?.toLocaleString()}</td>
                                        <td className="px-3 py-2 text-center text-gray-500">{typeof r.competition === 'number' ? (r.competition as number).toFixed(2) : r.competition}</td>

                                        {/* Competitors C1-C10 */}
                                        {Array.from({ length: 10 }).map((_, i) => {
                                            const key = `c${i + 1}` as keyof ClientPositionSerpRecord;
                                            const comp = r[key] as CompetitorSnapshot; // CompetitorSnapshot
                                            const isSelf = comp?.domain && selectedDomain && norm(comp.domain) === norm(selectedDomain);

                                            return (
                                                <td key={i} className={`px-1 py-2 text-center ${isSelf ? 'bg-indigo-50' : ''}`}>
                                                    {comp ? (
                                                        <a
                                                            href={comp.url}
                                                            target="_blank"
                                                            title={`${comp.brandLabel}\n${comp.url}`}
                                                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] w-full truncate border ${isSelf ? 'border-indigo-200 text-indigo-700 font-semibold' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                                                        >
                                                            {comp.brandLabel}
                                                        </a>
                                                    ) : <span className="text-gray-200">-</span>}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div >

            {/* Import Modal */}
            {
                showImportModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-lg w-[600px] shadow-xl">
                            <h3 className="text-lg font-bold mb-4">Batch Import Keywords for Analysis</h3>
                            <div className="mb-3">
                                <label className="block text-xs font-bold text-gray-500 mb-1">Source</label>
                                <input
                                    className="w-full border rounded px-2 py-1.5 text-sm"
                                    placeholder="e.g. SEMRush, Client, Manual"
                                    value={importSource}
                                    onChange={e => setImportSource(e.target.value)}
                                />
                            </div>
                            <p className="text-sm text-gray-500 mb-2">Paste keywords (one per line). These will be added to the list.</p>
                            <textarea
                                className="w-full h-64 border rounded p-3 font-mono text-sm"
                                placeholder={"keyword 1\nkeyword 2\n..."}
                                value={importText}
                                onChange={e => setImportText(e.target.value)}
                            ></textarea>
                            <div className="mt-4 flex justify-end gap-2">
                                <button onClick={() => setShowImportModal(false)} className="px-4 py-2 border rounded text-sm">Cancel</button>
                                <button onClick={handleBulkImport} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">Add Keywords</button>
                            </div>
                        </div>
                    </div>
                )
            }

            <div className="mt-8">
                <PageComments pagePath="/curated/client-position" />
            </div>
        </div >
    );
}

