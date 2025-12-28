'use client';

import { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import { Client, Competitor } from '@/types';
import { useApiDebugPipeline, ApiRequestDetails } from '@/hooks/useApiDebugPipeline';
import ApiDebugPanel from '@/components/ApiDebugPanel';

// Duplicate interface for frontend
interface DomainCredibilityRecordDisplay {
    clientCode: string;
    domain: string;
    name?: string;
    type: 'client' | 'competitor' | 'other';
    domainAgeYears?: number;
    createdDate?: string;
    referringDomains?: number;
    totalBacklinks?: number;
    dofollowBacklinks?: number;
    paidKeywords?: number;
    lastPulledAt: string;
}

export default function DomainCredibilityPage() {
    // Debug Pipeline
    const pipeline = useApiDebugPipeline();

    useEffect(() => {
        pipeline.setInitialSteps([
            { id: 'validate_inputs', label: '1. Validate Inputs' },
            { id: 'build_request', label: '2. Build Request' },
            { id: 'send_request', label: '3. Send API Request' },
            { id: 'validate_response', label: '4. Validate Response' },
            { id: 'update_ui', label: '5. Update UI' }
        ]);
    }, []);

    // Data State
    const [clients, setClients] = useState<Client[]>([]);
    const [competitors, setCompetitors] = useState<Competitor[]>([]);

    // UI Selection State
    const [selectedClientCode, setSelectedClientCode] = useState<string>('');
    const [selectedDomainIds, setSelectedDomainIds] = useState<Set<string>>(new Set());

    // Feature State
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [results, setResults] = useState<DomainCredibilityRecordDisplay[]>([]);

    // Filter & Sort State
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [filterText, setFilterText] = useState('');

    // Fetch Clients on Mount
    useEffect(() => {
        const fetchClients = async () => {
            const res = await fetch('/api/clients');
            const data = await res.json();
            setClients(data.filter((c: Client) => c.isActive));
        };
        fetchClients();
    }, []);

    // On Client Select
    useEffect(() => {
        if (!selectedClientCode) {
            setCompetitors([]);
            setResults([]);
            return;
        }

        const loadData = async () => {
            setLoading(true);
            try {
                // 1. Fetch Competitors
                const compRes = await fetch('/api/competitors');
                const compData = await compRes.json();
                const filteredComps = compData.filter((c: Competitor) => c.clientCode === selectedClientCode && c.isActive);
                setCompetitors(filteredComps);

                // 2. Pre-select Client + Top 3 Competitors
                const client = clients.find(c => c.code === selectedClientCode);
                const initialSelection = new Set<string>();
                if (client) initialSelection.add('CLIENT');
                filteredComps.slice(0, 3).forEach((c: Competitor) => initialSelection.add(c.id));
                setSelectedDomainIds(initialSelection);

            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [selectedClientCode, clients]);

    // Derived List of All Available Domains
    const availableDomains = useMemo(() => {
        const list = [];
        const client = clients.find(c => c.code === selectedClientCode);
        if (client) {
            list.push({
                id: 'CLIENT',
                domain: client.mainDomain,
                name: client.name,
                type: 'client' as const
            });
        }
        competitors.forEach(c => {
            list.push({
                id: c.id,
                domain: c.domain,
                name: c.name,
                type: 'competitor' as const
            });
        });
        return list;
    }, [selectedClientCode, clients, competitors]);

    // Handler: Fetch Data
    const handleFetch = async (force: boolean = false) => {
        pipeline.resetPipeline();

        // 1. Validate
        pipeline.startStep('validate_inputs');
        if (!selectedClientCode) {
            pipeline.finishStepError('validate_inputs', 'No Client Selected');
            return;
        }

        if (selectedDomainIds.size === 0) {
            const err = "Please select at least one domain from the list to fetch data.";
            alert(err);
            pipeline.finishStepError('validate_inputs', 'No Domains Selected');
            return;
        }

        const selectedItems = availableDomains.filter(d => selectedDomainIds.has(d.id));
        if (selectedItems.length === 0) {
            pipeline.finishStepError('validate_inputs', 'Selected items not found in available list', { selectedDomainIds: Array.from(selectedDomainIds) });
            return;
        }
        pipeline.finishStepSuccess('validate_inputs', 'Inputs Valid', { domainCount: selectedItems.length, domains: selectedItems.map(d => d.domain) });

        setFetching(true);
        try {
            // 2. Build Request
            pipeline.startStep('build_request');
            const payload = {
                clientCode: selectedClientCode,
                domains: selectedItems.map(d => ({
                    domain: d.domain,
                    name: d.name,
                    type: d.type
                })),
                forceRefresh: force
            };
            pipeline.finishStepSuccess('build_request', 'Payload Ready', payload);

            // 3. Send Request
            pipeline.startStep('send_request');
            const url = '/api/master/domain-credibility/fetch';
            const method = 'POST';
            const reqBody = JSON.stringify(payload);

            const stepDetails: ApiRequestDetails = {
                url,
                method,
                requestHeadersPreview: { 'Content-Type': 'application/json' },
                requestBodyPreview: reqBody.length > 500 ? reqBody.slice(0, 500) + '...' : reqBody
            };

            let res;
            try {
                res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: reqBody
                });
            } catch (netErr: any) {
                pipeline.finishStepError('send_request', 'Network Error', {
                    ...stepDetails,
                    errorCategory: 'NETWORK_ERROR',
                    statusText: netErr.message
                });
                throw netErr;
            }

            stepDetails.httpStatus = res.status;
            stepDetails.statusText = res.statusText;

            const bodyText = await res.text();
            try {
                const j = JSON.parse(bodyText);
                const pretty = JSON.stringify(j, null, 2);
                stepDetails.responseBodyPreview = pretty.length > 500 ? pretty.slice(0, 500) + '...' : pretty;
            } catch {
                stepDetails.responseBodyPreview = bodyText.length > 500 ? bodyText.slice(0, 500) + '...' : bodyText;
            }

            if (!res.ok) {
                let cat: ApiRequestDetails['errorCategory'] = 'UNKNOWN';
                if (res.status === 404) cat = 'ROUTE_NOT_FOUND';
                else if (res.status === 401 || res.status === 403) cat = 'UNAUTHORIZED';
                else if (res.status >= 500) cat = 'SERVER_ERROR';

                stepDetails.errorCategory = cat;
                pipeline.finishStepError('send_request', `HTTP ${res.status}`, stepDetails);
                throw new Error(`API Error ${res.status}: ${bodyText}`);
            }
            pipeline.finishStepSuccess('send_request', `HTTP ${res.status}`, stepDetails);

            // 4. Validate Response
            pipeline.startStep('validate_response');
            let data;
            try {
                data = JSON.parse(bodyText);
            } catch (e) {
                pipeline.finishStepError('validate_response', 'JSON Parse Error', { bodySnippet: bodyText.slice(0, 200) });
                throw new Error('Invalid JSON response');
            }
            console.log("DEBUG: API Data received", data);

            if (data.results) {
                pipeline.finishStepSuccess('validate_response', 'Results Received', { matches: data.results.length });

                // 5. Update UI
                pipeline.startStep('update_ui');
                // Merge results (replace existing for same domain, but preserve name/type)
                setResults(prev => {
                    const newMap = new Map(prev.map(r => [r.domain, r]));
                    data.results.forEach((r: any) => {
                        // The API result 'r' lacks 'type' and 'name'. We must preserve them.
                        const meta = selectedItems.find(i => i.domain === r.domain);
                        const existing = newMap.get(r.domain);

                        const merged = {
                            ...existing,
                            ...r,
                            // Ensure name/type are not lost
                            type: meta?.type || existing?.type || 'other',
                            name: meta?.name || existing?.name || r.domain
                        };
                        newMap.set(r.domain, merged);
                    });
                    return Array.from(newMap.values());
                });
                pipeline.finishStepSuccess('update_ui', 'State Updated');
            } else {
                pipeline.finishStepError('validate_response', 'Missing "results" array', data);
            }
        } catch (e: any) {
            console.error("Fetch failed", e);
            if (pipeline.steps.find(s => s.id === 'send_request' && s.status === 'running')) {
                pipeline.finishStepError('send_request', 'Network Error', { message: e.message });
            } else if (pipeline.steps.find(s => s.id === 'validate_response' && s.status === 'running')) {
                pipeline.finishStepError('validate_response', 'Processing Error', { message: e.message });
            }
            alert(`Error fetching data: ${e.message || "Unknown error"}`);
        } finally {
            setFetching(false);
        }
    };

    // Auto-load cache when domains change
    useEffect(() => {
        if (selectedDomainIds.size > 0 && !fetching && results.length === 0) {
            // First time load cache for this client selection
            handleFetch(false);
        }
    }, [availableDomains]);

    // Table Data Preparation (Rows = Domains)
    const tableData = useMemo(() => {
        // 1. Filter by Selection
        let domains = availableDomains.filter(d => selectedDomainIds.has(d.id));

        // 2. Filter by Search Text
        if (filterText) {
            const lower = filterText.toLowerCase();
            domains = domains.filter(d =>
                d.name?.toLowerCase().includes(lower) ||
                d.domain.toLowerCase().includes(lower)
            );
        }

        // 3. Map to Rows with Data
        let rows = domains.map(d => {
            const record = results.find(r => r.domain === d.domain);
            return {
                id: d.id,
                domainObj: d,
                ...record // Merge in the fetched data (domainAgeYears, etc.)
            };
        });

        // 4. Sort
        if (sortConfig) {
            rows.sort((a, b) => {
                const valA = (a as any)[sortConfig.key];
                const valB = (b as any)[sortConfig.key];

                if (valA === undefined && valB === undefined) return 0;
                if (valA === undefined) return 1; // Nulls last
                if (valB === undefined) return -1;

                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return rows;
    }, [availableDomains, selectedDomainIds, results, sortConfig, filterText]);


    // Helper: Sort
    const handleSort = (key: string) => {
        setSortConfig(current => {
            if (current?.key === key) {
                return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'desc' }; // Default to desc for numbers usually
        });
    };

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig?.key !== columnKey) return <span className="text-gray-300 ml-1">⇅</span>;
        return <span className="text-indigo-600 ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };


    // Columns Definition
    const COLUMNS = [
        { key: 'details', label: 'Domain', sortable: true }, // Special render
        { key: 'domainAgeYears', label: 'Age (Yrs)', sortable: true },
        { key: 'createdDate', label: 'Created', sortable: true },
        { key: 'referringDomains', label: 'Ref. Domains', sortable: true },
        { key: 'totalBacklinks', label: 'Backlinks', sortable: true },
        { key: 'dofollowBacklinks', label: 'Dofollow', sortable: true },
        { key: 'paidKeywords', label: 'Paid KWs', sortable: true },
    ];


    // Client Generator
    const clientInterpretation = useMemo(() => {
        const clientRes = results.find(r => r.type === 'client');
        if (!clientRes) return "Select client domain and fetch data to see interpretation.";

        const lines = [];
        if (clientRes.domainAgeYears && clientRes.domainAgeYears > 5) {
            lines.push(`• Domain is mature (${clientRes.domainAgeYears} years), suggesting stability.`);
        } else if (clientRes.domainAgeYears) {
            lines.push(`• Domain is relatively new (${clientRes.domainAgeYears} years).`);
        }

        if (clientRes.referringDomains && clientRes.referringDomains > 100) {
            lines.push(`• Strong referring domain profile (${clientRes.referringDomains}).`);
        } else {
            lines.push(`• Low referring domains count indicates need for PR/Link building.`);
        }

        if (clientRes.paidKeywords && clientRes.paidKeywords > 0) {
            lines.push(`• Active in Paid Search (${clientRes.paidKeywords} keywords detected).`);
        }

        return lines.join('\n');
    }, [results]);


    return (
        <div>
            <PageHeader
                title="Domain Credibility, Age & Authority Signals"
                description="Compare trust signals between client and competitors."
            />

            {/* Client Selector */}
            <div className="bg-white p-4 rounded-lg shadow-sm border mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <label className="font-medium text-gray-700">Select Client:</label>
                    <select
                        className="border border-gray-300 rounded-md px-3 py-2 min-w-[200px]"
                        value={selectedClientCode}
                        onChange={(e) => {
                            setSelectedClientCode(e.target.value);
                            setResults([]); // Clear previous results
                        }}
                    >
                        <option value="">-- Select --</option>
                        {clients.map(c => (
                            <option key={c.code} value={c.code}>{c.name}</option>
                        ))}
                    </select>
                </div>
                {selectedClientCode && (
                    <div className="flex gap-2 text-sm">
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded">
                            {clients.find(c => c.code === selectedClientCode)?.mainDomain}
                        </span>
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            {competitors.length} Competitors
                        </span>
                    </div>
                )}
            </div>

            {selectedClientCode && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Sidebar / Domain Selection */}
                    <div className="lg:col-span-1 bg-white p-4 rounded-lg shadow-sm border h-fit">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-gray-800">Domains</h3>
                            <div className="space-x-2 text-xs">
                                <button
                                    onClick={() => setSelectedDomainIds(new Set(availableDomains.map(d => d.id)))}
                                    className="text-indigo-600 hover:underline"
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => setSelectedDomainIds(new Set())}
                                    className="text-gray-500 hover:underline"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {availableDomains.map(item => (
                                <label key={item.id} className="flex items-center gap-2 text-sm p-2 hover:bg-gray-50 rounded cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedDomainIds.has(item.id)}
                                        onChange={(e) => {
                                            const next = new Set(selectedDomainIds);
                                            if (e.target.checked) next.add(item.id);
                                            else next.delete(item.id);
                                            setSelectedDomainIds(next);
                                        }}
                                        className="rounded border-gray-300"
                                    />
                                    <div className="flex-1 overflow-hidden">
                                        <div className="font-medium truncate">{item.name}</div>
                                        <div className="text-xs text-gray-500 truncate">{item.domain}</div>
                                    </div>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${item.type === 'client' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100'}`}>
                                        {item.type === 'client' ? 'YOU' : 'COMP'}
                                    </span>
                                </label>
                            ))}
                        </div>

                        <div className="mt-4 pt-4 border-t relative z-10">
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (fetching) return;
                                    handleFetch(false);
                                }}
                                className={`w-full py-2 rounded-md flex items-center justify-center gap-2 text-white shadow-sm transition-colors ${fetching ? 'bg-emerald-400 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                                    }`}
                            >
                                {fetching ? 'Fetching...' : 'Fetch Data Now'}
                            </button>
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (fetching) return;
                                    handleFetch(true);
                                }}
                                className={`w-full mt-2 text-xs hover:underline ${fetching ? 'text-gray-300' : 'text-gray-500 hover:text-emerald-600 cursor-pointer'}`}
                            >
                                Force Refresh
                            </button>
                        </div>
                    </div>

                    {/* Main Content / Table */}
                    <div className="lg:col-span-3 space-y-6">

                        {/* Table Controls */}
                        <div className="flex justify-between items-center bg-white p-3 rounded-t-lg border-b border-gray-200">
                            <div className="relative w-64">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">🔍</span>
                                <input
                                    type="text"
                                    placeholder="Filter table..."
                                    className="pl-9 pr-4 py-1.5 border rounded-md text-sm w-full focus:ring-indigo-500 focus:border-indigo-500"
                                    value={filterText}
                                    onChange={e => setFilterText(e.target.value)}
                                />
                            </div>
                            <div className="text-xs text-gray-500">
                                Showing {tableData.length} domains
                            </div>
                        </div>

                        {/* Comparison Table (Transposed) */}
                        <div className="bg-white rounded-b-lg shadow-sm border overflow-x-auto min-h-[300px]">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {COLUMNS.map(col => (
                                            <th
                                                key={col.key}
                                                className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.sortable ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                                                onClick={() => col.sortable && handleSort(col.key)}
                                            >
                                                <div className="flex items-center">
                                                    {col.label}
                                                    {col.sortable && <SortIcon columnKey={col.key} />}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {tableData.map((row, idx) => (
                                        <tr key={row.id} className={row.domainObj.type === 'client' ? 'bg-indigo-50' : (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50')}>
                                            {/* Domain Column */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-gray-900 text-sm">{row.domainObj.name}</span>
                                                        {row.domainObj.type === 'client' && (
                                                            <span className="bg-indigo-100 text-indigo-800 text-[10px] px-1.5 py-0.5 rounded font-bold">YOU</span>
                                                        )}
                                                    </div>
                                                    <a href={`https://${row.domainObj.domain}`} target="_blank" rel="noopener" className="text-xs text-indigo-500 hover:underline">
                                                        {row.domainObj.domain}
                                                    </a>
                                                </div>
                                            </td>

                                            {/* Metrics */}
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                                {row.domainAgeYears !== undefined ? `${row.domainAgeYears} yrs` : <span className="text-gray-300">-</span>}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                                {row.createdDate ? new Date(row.createdDate).toLocaleDateString() : <span className="text-gray-300">-</span>}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                                {row.referringDomains?.toLocaleString() ?? <span className="text-gray-300">-</span>}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                                {row.totalBacklinks?.toLocaleString() ?? <span className="text-gray-300">-</span>}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                                {row.dofollowBacklinks?.toLocaleString() ?? <span className="text-gray-300">-</span>}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                                {row.paidKeywords?.toLocaleString() ?? <span className="text-gray-300">-</span>}
                                            </td>
                                        </tr>
                                    ))}
                                    {tableData.length === 0 && (
                                        <tr>
                                            <td colSpan={COLUMNS.length} className="px-6 py-10 text-center text-gray-500">
                                                No domains match your filter or selection.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Interpretation */}
                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-indigo-900 mb-2">Automated Interpretation</h4>
                            <textarea
                                readOnly
                                value={clientInterpretation}
                                className="w-full bg-white border border-indigo-200 rounded p-3 text-sm text-gray-700 h-32 focus:outline-none resize-none"
                            />
                        </div>
                    </div>
                </div>
            )}

            {!selectedClientCode && (
                <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-dashed">
                    Please select a client to begin.
                </div>
            )}

            <ApiDebugPanel pipeline={pipeline} />
        </div>
    );
}
