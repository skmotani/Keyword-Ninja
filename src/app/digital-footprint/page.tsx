'use client';

import { useState, useEffect } from 'react';

interface SurfaceResult {
    index: number;
    key: string;
    label: string;
    category: string;
    status: 'present' | 'partial' | 'absent' | 'unknown';
    relevance: string;
    pointsAwarded: number;
    pointsMax: number;
    confidence: number;
    source: string;
    method: string;
    tooltips: {
        why?: string;
        how?: string;
        action?: string;
    };
    evidence?: Array<{ title: string; url: string; snippet?: string; isOfficial: boolean }>;
}

interface DomainResult {
    id: string;
    domain: string;
    profile: {
        brandName: string;
        businessType: string;
        industry: string;
        geoScope: string;
    };
    score: {
        total: number;
        max: number;
        percentage: number;
    };
    surfaces: SurfaceResult[];
}

interface ScanResult {
    id: string;
    status: string;
    createdAt: string;
    domains: DomainResult[];
}

interface HistoryItem {
    id: string;
    createdAt: string;
    status: string;
    totalDomains: number;
    finishedDomains: number;
    domains: Array<{
        domain: string;
        brandName: string;
        score: number;
    }>;
}

type FilterType = 'all' | 'gaps' | 'critical' | 'unknown';
type TabType = 'scan' | 'history';

// Client master data interface
interface ClientMaster {
    id: string;
    code: string;
    name: string;
    mainDomain: string;
    domains: string[];
    aiProfile?: {
        shortSummary?: string;
        productLines?: string[];
        targetCustomerSegments?: string[];
        businessModel?: string;
        industryType?: string;
        targetGeographies?: string[];
        coreTopics?: string[];
        adjacentTopics?: string[];
        oemManufacturerIndicators?: string[];
    };
}

export default function DigitalFootprintPage() {
    const [activeTab, setActiveTab] = useState<TabType>('scan');
    const [domains, setDomains] = useState('');
    const [hints, setHints] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ScanResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<FilterType>('all');
    const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

    // Client selection state
    const [clients, setClients] = useState<ClientMaster[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [clientsLoading, setClientsLoading] = useState(false);

    // History state
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

    // Load clients on mount
    useEffect(() => {
        loadClients();
    }, []);

    // Load history when tab changes
    useEffect(() => {
        if (activeTab === 'history') {
            loadHistory();
        }
    }, [activeTab]);

    // Auto-populate when client is selected
    useEffect(() => {
        if (selectedClientId) {
            const client = clients.find(c => c.id === selectedClientId);
            if (client) {
                // Populate domains from client master
                const domainList = client.domains.length > 0
                    ? client.domains.join('\n')
                    : client.mainDomain;
                setDomains(domainList);

                // Build comprehensive hints from AI profile for better entity matching
                const hintParts: string[] = [];

                // Brand identity
                hintParts.push(`Brand Name: ${client.name}`);

                // Business model & industry (critical for entity classification)
                if (client.aiProfile?.businessModel) {
                    hintParts.push(`Business Model: ${client.aiProfile.businessModel}`);
                }
                if (client.aiProfile?.industryType) {
                    hintParts.push(`Industry: ${client.aiProfile.industryType.replace(/_/g, ' ')}`);
                }

                // Products/services (helps match product pages, directories)
                if (client.aiProfile?.productLines?.length) {
                    hintParts.push(`Products/Services: ${client.aiProfile.productLines.join(', ')}`);
                }

                // Target customers (helps identify marketplace presence)
                if (client.aiProfile?.targetCustomerSegments?.length) {
                    hintParts.push(`Target Customers: ${client.aiProfile.targetCustomerSegments.join(', ')}`);
                }

                // Core topics (critical SEO keywords)
                if (client.aiProfile?.coreTopics?.length) {
                    hintParts.push(`Core Topics: ${client.aiProfile.coreTopics.join(', ')}`);
                }

                // Adjacent topics (related areas to check)
                if (client.aiProfile?.adjacentTopics?.length) {
                    hintParts.push(`Related Topics: ${client.aiProfile.adjacentTopics.join(', ')}`);
                }

                // Geographic focus (for local presence checks)
                if (client.aiProfile?.targetGeographies?.length) {
                    hintParts.push(`Geographies: ${client.aiProfile.targetGeographies.join(', ')}`);
                }

                // OEM indicators if available
                if (client.aiProfile?.oemManufacturerIndicators?.length) {
                    hintParts.push(`Business Keywords: ${client.aiProfile.oemManufacturerIndicators.join(', ')}`);
                }

                setHints(hintParts.join('\n'));
            }
        }
    }, [selectedClientId, clients]);

    const loadClients = async () => {
        setClientsLoading(true);
        try {
            const res = await fetch('/api/clients');
            if (res.ok) {
                const clientsData = await res.json();

                // Also fetch AI profiles to merge data
                const aiRes = await fetch('/api/client-ai-profile');
                let aiProfiles: Record<string, ClientMaster['aiProfile']> = {};
                if (aiRes.ok) {
                    const aiData = await aiRes.json();
                    aiProfiles = aiData.reduce((acc: Record<string, ClientMaster['aiProfile']>, p: {
                        clientCode: string;
                        shortSummary?: string;
                        productLines?: string[];
                        targetCustomerSegments?: string[];
                        businessModel?: string;
                        industryType?: string;
                        targetGeographies?: string[];
                        coreTopics?: string[];
                        adjacentTopics?: string[];
                        domainTypePatterns?: { oemManufacturerIndicators?: string[] };
                    }) => {
                        acc[p.clientCode] = {
                            shortSummary: p.shortSummary,
                            productLines: p.productLines,
                            targetCustomerSegments: p.targetCustomerSegments,
                            businessModel: p.businessModel,
                            industryType: p.industryType,
                            targetGeographies: p.targetGeographies,
                            coreTopics: p.coreTopics,
                            adjacentTopics: p.adjacentTopics,
                            oemManufacturerIndicators: p.domainTypePatterns?.oemManufacturerIndicators,
                        };
                        return acc;
                    }, {});
                }

                // Merge AI profiles into clients
                const enrichedClients = clientsData.map((c: ClientMaster) => ({
                    ...c,
                    aiProfile: aiProfiles[c.code] || undefined,
                }));

                setClients(enrichedClients);
            }
        } catch (err) {
            console.error('Failed to load clients:', err);
        } finally {
            setClientsLoading(false);
        }
    };

    const loadHistory = async () => {
        setHistoryLoading(true);
        try {
            const res = await fetch('/api/digital-footprint/history');
            if (res.ok) {
                const data = await res.json();
                setHistory(data);
            }
        } catch (err) {
            console.error('Failed to load history:', err);
        } finally {
            setHistoryLoading(false);
        }
    };

    const loadHistoryScan = async (scanId: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/digital-footprint/${scanId}`);
            if (res.ok) {
                const data = await res.json();
                setResult(data);
                setSelectedHistoryId(scanId);
                if (data.domains?.length > 0) {
                    setExpandedDomain(data.domains[0].id);
                }
            }
        } catch (err) {
            console.error('Failed to load scan:', err);
        } finally {
            setLoading(false);
        }
    };

    const runScan = async () => {
        if (!domains.trim()) return;

        setLoading(true);
        setError(null);
        setResult(null);
        setSelectedHistoryId(null);

        try {
            const res = await fetch('/api/digital-footprint/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domains, hints }),
            });

            if (!res.ok) throw new Error('Scan failed');

            const data = await res.json();

            // Fetch full results
            const detailRes = await fetch(`/api/digital-footprint/${data.scanId}`);
            const detailData = await detailRes.json();

            setResult(detailData);
            if (detailData.domains?.length > 0) {
                setExpandedDomain(detailData.domains[0].id);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Scan failed');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'present':
                return <span className="px-2 py-1 bg-green-100 text-green-800 border border-green-300 rounded text-xs font-bold">✓ PASS</span>;
            case 'partial':
                return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded text-xs font-bold">⚠ PARTIAL</span>;
            case 'absent':
                return <span className="px-2 py-1 bg-red-100 text-red-800 border border-red-300 rounded text-xs font-bold">✗ FAIL</span>;
            default:
                return <span className="px-2 py-1 bg-gray-100 text-gray-600 border border-gray-300 rounded text-xs font-bold">? UNKNOWN</span>;
        }
    };

    const getSourceBadge = (source: string) => {
        const colors: Record<string, string> = {
            direct: 'bg-blue-50 text-blue-700 border-blue-200',
            dataforseo: 'bg-purple-50 text-purple-700 border-purple-200',
            crawl: 'bg-green-50 text-green-700 border-green-200',
            openai: 'bg-amber-50 text-amber-700 border-amber-200',
        };
        return (
            <span className={`px-2 py-0.5 text-xs border rounded font-medium ${colors[source] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                {source.toUpperCase()}
            </span>
        );
    };

    const getCategoryLabel = (category: string) => {
        const labels: Record<string, { icon: string; name: string }> = {
            owned: { icon: '🏠', name: 'Owned Assets' },
            search: { icon: '🔍', name: 'Search Presence' },
            social: { icon: '📱', name: 'Social Media' },
            trust: { icon: '⭐', name: 'Trust & Reviews' },
            authority: { icon: '🏆', name: 'Authority' },
        };
        return labels[category] || { icon: '📊', name: category };
    };

    const filterSurfaces = (surfaces: SurfaceResult[]) => {
        switch (filter) {
            case 'gaps':
                return surfaces.filter(s => s.status === 'absent' || s.status === 'partial');
            case 'critical':
                return surfaces.filter(s =>
                    (s.status === 'absent' || s.status === 'partial') && s.relevance === 'high'
                );
            case 'unknown':
                return surfaces.filter(s => s.status === 'unknown');
            default:
                return surfaces;
        }
    };

    const groupByCategory = (surfaces: SurfaceResult[]) => {
        const groups: Record<string, SurfaceResult[]> = {};
        for (const surface of surfaces) {
            if (!groups[surface.category]) {
                groups[surface.category] = [];
            }
            groups[surface.category].push(surface);
        }
        return groups;
    };

    const getGrade = (percentage: number) => {
        if (percentage >= 90) return { grade: 'A', color: 'text-green-600', bg: 'bg-green-100' };
        if (percentage >= 75) return { grade: 'B', color: 'text-blue-600', bg: 'bg-blue-100' };
        if (percentage >= 60) return { grade: 'C', color: 'text-yellow-600', bg: 'bg-yellow-100' };
        if (percentage >= 40) return { grade: 'D', color: 'text-orange-600', bg: 'bg-orange-100' };
        return { grade: 'F', color: 'text-red-600', bg: 'bg-red-100' };
    };

    const extractDomain = (url: string) => {
        try {
            const u = new URL(url);
            return u.hostname.replace('www.', '');
        } catch {
            return url.slice(0, 30);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">🌐 Know Your Digital Footprint</h1>
                <p className="text-gray-600 mt-1">Presence audit across the internet — not rankings, just existence verification</p>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
                <button
                    onClick={() => setActiveTab('scan')}
                    className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'scan'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    🔍 New Scan
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'history'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    📜 History
                </button>
            </div>

            {/* SCAN TAB */}
            {activeTab === 'scan' && (
                <>
                    {/* Input Section */}
                    <div className="bg-white rounded-xl shadow-sm border p-6">
                        {/* Client Selection */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                📋 Select Client (Quick Fill)
                            </label>
                            <div className="flex gap-3">
                                <select
                                    value={selectedClientId}
                                    onChange={(e) => setSelectedClientId(e.target.value)}
                                    className="flex-1 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    disabled={clientsLoading}
                                >
                                    <option value="">— Select a client or enter manually —</option>
                                    {clients.map(client => (
                                        <option key={client.id} value={client.id}>
                                            {client.name} ({client.mainDomain})
                                            {client.aiProfile ? ' ✓ AI Profile' : ''}
                                        </option>
                                    ))}
                                </select>
                                {selectedClientId && (
                                    <button
                                        onClick={() => {
                                            setSelectedClientId('');
                                            setDomains('');
                                            setHints('');
                                        }}
                                        className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                                        title="Clear selection"
                                    >
                                        ✕ Clear
                                    </button>
                                )}
                            </div>
                            {selectedClientId && clients.find(c => c.id === selectedClientId)?.aiProfile?.shortSummary && (
                                <p className="mt-2 text-sm text-gray-500 italic">
                                    💡 {clients.find(c => c.id === selectedClientId)?.aiProfile?.shortSummary}
                                </p>
                            )}
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Domains to Scan <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={domains}
                                    onChange={(e) => setDomains(e.target.value)}
                                    placeholder="motani.com&#10;competitor1.com&#10;competitor2.com"
                                    className="w-full h-32 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">One domain per line. Max 5 domains.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Hints (Optional)
                                </label>
                                <textarea
                                    value={hints}
                                    onChange={(e) => setHints(e.target.value)}
                                    placeholder="Brand name, city, industry keywords..."
                                    className="w-full h-32 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">Helps improve entity matching.</p>
                            </div>
                        </div>

                        <div className="mt-6 flex gap-4">
                            <button
                                onClick={runScan}
                                disabled={loading || !domains.trim()}
                                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Scanning...
                                    </>
                                ) : (
                                    '🔍 Run Scan'
                                )}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* HISTORY TAB */}
            {activeTab === 'history' && (
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="px-6 py-4 border-b bg-gray-50">
                        <h2 className="font-semibold text-gray-800">📜 Scan History</h2>
                        <p className="text-sm text-gray-500">All your previous scans are saved. Click to view details.</p>
                    </div>

                    {historyLoading ? (
                        <div className="p-8 text-center text-gray-500">
                            <svg className="animate-spin h-8 w-8 mx-auto mb-2" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Loading history...
                        </div>
                    ) : history.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <p className="text-lg">No scans yet</p>
                            <p className="text-sm mt-1">Run your first scan to see it here.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-100 text-slate-700">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold">#</th>
                                        <th className="px-4 py-3 text-left font-semibold">Timestamp</th>
                                        <th className="px-4 py-3 text-left font-semibold">Domains</th>
                                        <th className="px-4 py-3 text-left font-semibold">Scores</th>
                                        <th className="px-4 py-3 text-center font-semibold">Status</th>
                                        <th className="px-4 py-3 text-center font-semibold">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {history.map((item, idx) => (
                                        <tr
                                            key={item.id}
                                            className={`hover:bg-gray-50 ${selectedHistoryId === item.id ? 'bg-blue-50' : ''}`}
                                        >
                                            <td className="px-4 py-3 text-gray-500 font-mono">{idx + 1}</td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-900">{formatDate(item.createdAt)}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="space-y-1">
                                                    {item.domains.map((d, i) => (
                                                        <div key={i} className="flex items-center gap-2">
                                                            <span className="text-gray-700">{d.domain}</span>
                                                            {d.brandName && (
                                                                <span className="text-xs text-gray-400">({d.brandName})</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="space-y-1">
                                                    {item.domains.map((d, i) => {
                                                        const grade = getGrade(d.score);
                                                        return (
                                                            <div key={i} className="flex items-center gap-2">
                                                                <span className={`font-bold ${grade.color}`}>{d.score}%</span>
                                                                <span className={`text-xs px-1.5 py-0.5 rounded ${grade.bg} ${grade.color}`}>
                                                                    {grade.grade}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${item.status === 'completed'
                                                    ? 'bg-green-100 text-green-700'
                                                    : item.status === 'running'
                                                        ? 'bg-yellow-100 text-yellow-700'
                                                        : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {item.status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => loadHistoryScan(item.id)}
                                                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                                >
                                                    View Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    {error}
                </div>
            )}

            {/* Results (shown for both new scan and history detail) */}
            {result && result.domains && (
                <div className="space-y-6">
                    {/* Scan Info Header */}
                    {result.createdAt && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
                            <div>
                                <span className="text-blue-800 font-medium">📅 Scan from: </span>
                                <span className="text-blue-700">{formatDate(result.createdAt)}</span>
                            </div>
                            {selectedHistoryId && (
                                <button
                                    onClick={() => { setResult(null); setSelectedHistoryId(null); }}
                                    className="text-sm text-blue-600 hover:underline"
                                >
                                    ← Back to History
                                </button>
                            )}
                        </div>
                    )}

                    {/* Filter Tabs */}
                    <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit">
                        {(['all', 'gaps', 'critical', 'unknown'] as FilterType[]).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${filter === f
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                {f === 'all' && 'All'}
                                {f === 'gaps' && '🔴 Gaps'}
                                {f === 'critical' && '⚠️ Critical'}
                                {f === 'unknown' && '❓ Unknown'}
                            </button>
                        ))}
                    </div>

                    {/* Domain Results */}
                    {result.domains.map((domain) => {
                        const grade = getGrade(domain.score.percentage);
                        return (
                            <div key={domain.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                                {/* Domain Header */}
                                <div
                                    className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                                    onClick={() => setExpandedDomain(expandedDomain === domain.id ? null : domain.id)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h2 className="text-xl font-bold text-gray-900">{domain.domain}</h2>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-sm font-medium">
                                                    {domain.profile.brandName}
                                                </span>
                                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-sm">
                                                    {domain.profile.businessType}
                                                </span>
                                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-sm">
                                                    {domain.profile.industry}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Score */}
                                        <div className="text-center">
                                            <div className={`w-20 h-20 rounded-full ${grade.bg} flex flex-col items-center justify-center`}>
                                                <div className={`text-2xl font-bold ${grade.color}`}>
                                                    {domain.score.percentage}%
                                                </div>
                                                <div className={`text-lg font-bold ${grade.color}`}>
                                                    {grade.grade}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Content - Professional Table */}
                                {expandedDomain === domain.id && (
                                    <div className="border-t">
                                        {Object.entries(groupByCategory(filterSurfaces(domain.surfaces))).map(([category, surfaces]) => {
                                            const catInfo = getCategoryLabel(category);
                                            return (
                                                <div key={category} className="border-b last:border-b-0">
                                                    {/* Category Header */}
                                                    <div className="px-4 py-3 bg-gray-50 flex items-center gap-2 border-b">
                                                        <span className="text-xl">{catInfo.icon}</span>
                                                        <span className="font-semibold text-gray-700">{catInfo.name}</span>
                                                        <span className="text-sm text-gray-500">({surfaces.length} checks)</span>
                                                    </div>

                                                    {/* Professional Table */}
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-sm">
                                                            <thead className="bg-slate-100 text-slate-700">
                                                                <tr>
                                                                    <th className="px-3 py-2 text-left font-semibold w-10">#</th>
                                                                    <th className="px-3 py-2 text-left font-semibold">Surface</th>
                                                                    <th className="px-3 py-2 text-left font-semibold">Source</th>
                                                                    <th className="px-3 py-2 text-left font-semibold">Method</th>
                                                                    <th className="px-3 py-2 text-left font-semibold">Evidence Link</th>
                                                                    <th className="px-3 py-2 text-center font-semibold w-24">Result</th>
                                                                    <th className="px-3 py-2 text-right font-semibold w-20">Points</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100">
                                                                {surfaces.map((surface) => (
                                                                    <tr key={surface.key} className="hover:bg-gray-50">
                                                                        <td className="px-3 py-3 text-gray-500 font-mono text-xs">
                                                                            {surface.index}
                                                                        </td>
                                                                        <td className="px-3 py-3">
                                                                            <div className="font-medium text-gray-900">{surface.label}</div>
                                                                            {surface.relevance === 'high' && (
                                                                                <span className="text-xs text-red-500 font-medium">⚡ HIGH PRIORITY</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-3 py-3">
                                                                            {getSourceBadge(surface.source)}
                                                                        </td>
                                                                        <td className="px-3 py-3 text-gray-600 text-xs max-w-[180px]">
                                                                            <span title={surface.method} className="block truncate">
                                                                                {surface.method}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-3 py-3 max-w-[300px]">
                                                                            {surface.evidence && surface.evidence.length > 0 ? (
                                                                                <div className="space-y-1">
                                                                                    {surface.evidence.map((ev, i) => (
                                                                                        <a
                                                                                            key={i}
                                                                                            href={ev.url}
                                                                                            target="_blank"
                                                                                            rel="noopener noreferrer"
                                                                                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                                                                            title={ev.url}
                                                                                        >
                                                                                            {ev.isOfficial && <span className="text-green-600">✓</span>}
                                                                                            <span className="truncate max-w-[200px]">{ev.url || ev.title}</span>
                                                                                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                                                            </svg>
                                                                                        </a>
                                                                                    ))}
                                                                                </div>
                                                                            ) : (
                                                                                <span className="text-xs text-gray-400 italic">No evidence found</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-3 py-3 text-center">
                                                                            {getStatusBadge(surface.status)}
                                                                        </td>
                                                                        <td className="px-3 py-3 text-right font-mono">
                                                                            <span className={`font-bold ${surface.status === 'present' ? 'text-green-600' : surface.status === 'partial' ? 'text-yellow-600' : 'text-gray-400'}`}>
                                                                                {surface.pointsAwarded.toFixed(1)}
                                                                            </span>
                                                                            <span className="text-gray-400">/{surface.pointsMax.toFixed(1)}</span>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Summary Row */}
                                        <div className="px-4 py-4 bg-slate-50 border-t">
                                            <div className="flex justify-between items-center">
                                                <div className="text-sm text-gray-600">
                                                    <span className="font-medium">{domain.surfaces.filter(s => s.status === 'present').length}</span> passed,{' '}
                                                    <span className="font-medium text-yellow-600">{domain.surfaces.filter(s => s.status === 'partial').length}</span> partial,{' '}
                                                    <span className="font-medium text-red-600">{domain.surfaces.filter(s => s.status === 'absent').length}</span> failed,{' '}
                                                    <span className="font-medium text-gray-500">{domain.surfaces.filter(s => s.status === 'unknown').length}</span> unknown
                                                </div>
                                                <div className="text-lg font-bold">
                                                    Total: <span className={grade.color}>{domain.score.percentage}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Founder Note */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-6 text-white">
                <div className="flex items-start gap-4">
                    <div className="text-3xl">💡</div>
                    <div>
                        <p className="text-white/90 leading-relaxed">
                            If a customer asks <span className="text-blue-400">ChatGPT</span>, <span className="text-blue-400">Google</span>, or <span className="text-blue-400">YouTube</span> for
                            a product you sell, and they don&apos;t see your name—<span className="text-red-400 font-semibold">you are losing money</span>.
                        </p>
                        <p className="text-white/70 text-sm mt-2">— Motani, on why digital presence matters</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
