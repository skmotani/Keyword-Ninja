'use client';

import { useState, useEffect, useCallback } from 'react';

// Types
interface Surface {
    id: string;
    surfaceKey: string;
    label: string;
    category: string;
    importanceTier: string;
    basePoints: number;
    defaultRelevanceWeight: number;
    sourceType: string;
    searchEngine: string | null;
    queryTemplates: string[];
    maxQueries: number;
    confirmationArtifact: string;
    presenceRules: Record<string, unknown> | null;
    officialnessRules: Record<string, unknown> | null;
    officialnessRequired: boolean;
    evidenceFields: string[] | null;
    tooltipTemplates: Record<string, unknown> | null;
    enabled: boolean;
    notes: string | null;
    industryOverrides: Record<string, number> | null;
    geoOverrides: Record<string, number> | null;
    createdAt: string;
    updatedAt: string;
}

interface Meta {
    total: number;
    enabled: number;
    disabled: number;
    categoryCounts: Record<string, number>;
    tierCounts: Record<string, number>;
    sourceTypeCounts: Record<string, number>;
}

interface TestResult {
    queries: string[];
    results: Array<{ url: string; title: string; snippet?: string; position?: number }>;
    evaluation: { status: string; officialness: boolean; confidence: number };
    scorePreview: { basePoints: number; weight: number; statusFactor: number; finalScore: number };
    error?: string;
}

// Constants
const CATEGORIES = ['owned', 'search', 'social', 'video', 'community', 'trust', 'authority', 'marketplace', 'technical', 'ai'];
const IMPORTANCE_TIERS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const SOURCE_TYPES = ['WEBSITE_CRAWL', 'DATAFORSEO_SERP', 'DATAFORSEO_AUTOCOMPLETE', 'PLATFORM_API', 'DNS_LOOKUP', 'THIRD_PARTY'];
const SEARCH_ENGINES = ['google', 'bing', 'youtube', 'yahoo', 'baidu', 'naver'];

export default function FootprintRegistryPage() {
    // State
    const [surfaces, setSurfaces] = useState<Surface[]>([]);
    const [meta, setMeta] = useState<Meta | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [filterCategory, setFilterCategory] = useState<string[]>([]);
    const [filterSourceType, setFilterSourceType] = useState<string[]>([]);
    const [filterTier, setFilterTier] = useState<string[]>([]);
    const [filterEnabled, setFilterEnabled] = useState<string>('all');
    const [searchText, setSearchText] = useState('');
    const [sortBy, setSortBy] = useState('importanceTier');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [showFilters, setShowFilters] = useState(false);

    // Modals
    const [showDetail, setShowDetail] = useState<Surface | null>(null);
    const [showEdit, setShowEdit] = useState<Surface | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    // Test Query
    const [testDomain, setTestDomain] = useState('');
    const [testBrand, setTestBrand] = useState('');
    const [testResult, setTestResult] = useState<TestResult | null>(null);
    const [testing, setTesting] = useState(false);

    // Fetch surfaces
    const fetchSurfaces = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterCategory.length) params.set('category', filterCategory.join(','));
            if (filterSourceType.length) params.set('sourceType', filterSourceType.join(','));
            if (filterTier.length) params.set('importanceTier', filterTier.join(','));
            if (filterEnabled !== 'all') params.set('enabled', filterEnabled);
            if (searchText) params.set('search', searchText);
            params.set('sortBy', sortBy);
            params.set('sortOrder', sortOrder);

            const res = await fetch(`/api/admin/footprint-registry?${params}`);
            const data = await res.json();
            setSurfaces(data.surfaces || []);
            setMeta(data.meta || null);
        } catch (err) {
            setError('Failed to load registry');
        } finally {
            setLoading(false);
        }
    }, [filterCategory, filterSourceType, filterTier, filterEnabled, searchText, sortBy, sortOrder]);

    useEffect(() => {
        fetchSurfaces();
    }, [fetchSurfaces]);

    // Toggle enabled
    const toggleEnabled = async (surface: Surface) => {
        try {
            await fetch(`/api/admin/footprint-registry/${surface.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !surface.enabled }),
            });
            fetchSurfaces();
        } catch {
            setError('Failed to update');
        }
    };

    // Reset to defaults
    const resetToDefaults = async () => {
        try {
            await fetch('/api/admin/footprint-registry/seed', { method: 'POST' });
            setShowResetConfirm(false);
            fetchSurfaces();
        } catch {
            setError('Failed to reset');
        }
    };

    // Run test query
    const runTest = async () => {
        if (!showDetail || !testDomain || !testBrand) return;
        setTesting(true);
        setTestResult(null);
        try {
            const res = await fetch('/api/admin/footprint-registry/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    surfaceId: showDetail.id,
                    domain: testDomain,
                    brand: testBrand,
                }),
            });
            const data = await res.json();
            setTestResult(data);
        } catch {
            setError('Test failed');
        } finally {
            setTesting(false);
        }
    };

    // Delete surface
    const deleteSurface = async (id: string) => {
        if (!confirm('Delete this surface?')) return;
        try {
            await fetch(`/api/admin/footprint-registry/${id}`, { method: 'DELETE' });
            setShowDetail(null);
            fetchSurfaces();
        } catch {
            setError('Failed to delete');
        }
    };

    // Badge colors
    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-300';
            case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-300';
            case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            default: return 'bg-gray-100 text-gray-600 border-gray-300';
        }
    };

    const getCategoryColor = (cat: string) => {
        const colors: Record<string, string> = {
            owned: 'bg-green-100 text-green-700',
            search: 'bg-blue-100 text-blue-700',
            social: 'bg-purple-100 text-purple-700',
            video: 'bg-pink-100 text-pink-700',
            community: 'bg-indigo-100 text-indigo-700',
            trust: 'bg-amber-100 text-amber-700',
            authority: 'bg-teal-100 text-teal-700',
            marketplace: 'bg-cyan-100 text-cyan-700',
            technical: 'bg-slate-100 text-slate-700',
        };
        return colors[cat] || 'bg-gray-100 text-gray-700';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">📋 Footprint Registry</h1>
                    <p className="text-gray-600 mt-1">Master list of surfaces used for digital footprint scans.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowCreate(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                        + Add Surface
                    </button>
                    <a
                        href="/api/admin/footprint-registry/export?format=json"
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                    >
                        📥 Export
                    </a>
                    <button
                        onClick={() => setShowResetConfirm(true)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                    >
                        🔄 Reset
                    </button>
                </div>
            </div>

            {/* KPI Strip */}
            {meta && (
                <div className="bg-white rounded-xl shadow-sm border p-4">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="px-4 py-2 bg-slate-100 rounded-lg">
                            <div className="text-2xl font-bold text-slate-800">{meta.total}</div>
                            <div className="text-xs text-slate-500">Total</div>
                        </div>
                        <div className="px-4 py-2 bg-green-50 rounded-lg">
                            <div className="text-2xl font-bold text-green-700">{meta.enabled}</div>
                            <div className="text-xs text-green-600">Enabled</div>
                        </div>
                        <div className="px-4 py-2 bg-gray-50 rounded-lg">
                            <div className="text-2xl font-bold text-gray-500">{meta.disabled}</div>
                            <div className="text-xs text-gray-400">Disabled</div>
                        </div>
                        <div className="border-l pl-4 flex flex-wrap gap-2">
                            {Object.entries(meta.tierCounts).map(([tier, count]) => (
                                <span key={tier} className={`px-2 py-1 rounded text-xs font-medium border ${getTierColor(tier)}`}>
                                    {tier}: {count}
                                </span>
                            ))}
                        </div>
                        <div className="border-l pl-4 flex flex-wrap gap-1">
                            {Object.entries(meta.categoryCounts).map(([cat, count]) => (
                                <span key={cat} className={`px-2 py-0.5 rounded text-xs ${getCategoryColor(cat)}`}>
                                    {cat}: {count}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Filter Toggle */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium"
                >
                    {showFilters ? '▼ Hide Filters' : '▶ Show Filters'}
                </button>
                <input
                    type="text"
                    placeholder="Search key or label..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="px-4 py-2 border rounded-lg w-64"
                />
                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 border rounded-lg"
                >
                    <option value="importanceTier">Sort: Importance</option>
                    <option value="basePoints">Sort: Points</option>
                    <option value="category">Sort: Category</option>
                    <option value="label">Sort: Label</option>
                    <option value="updatedAt">Sort: Updated</option>
                </select>
                <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-3 py-2 border rounded-lg hover:bg-gray-50"
                >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
            </div>

            {/* Filters Panel */}
            {showFilters && (
                <div className="bg-white rounded-xl shadow-sm border p-4 grid grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                        <div className="flex flex-wrap gap-1">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setFilterCategory(prev =>
                                        prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                                    )}
                                    className={`px-2 py-0.5 rounded text-xs ${filterCategory.includes(cat) ? 'bg-blue-600 text-white' : 'bg-gray-100'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Source Type</label>
                        <div className="flex flex-wrap gap-1">
                            {SOURCE_TYPES.map(st => (
                                <button
                                    key={st}
                                    onClick={() => setFilterSourceType(prev =>
                                        prev.includes(st) ? prev.filter(s => s !== st) : [...prev, st]
                                    )}
                                    className={`px-2 py-0.5 rounded text-xs ${filterSourceType.includes(st) ? 'bg-blue-600 text-white' : 'bg-gray-100'
                                        }`}
                                >
                                    {st.replace('DATAFORSEO_', 'DFS_')}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Importance</label>
                        <div className="flex flex-wrap gap-1">
                            {IMPORTANCE_TIERS.map(tier => (
                                <button
                                    key={tier}
                                    onClick={() => setFilterTier(prev =>
                                        prev.includes(tier) ? prev.filter(t => t !== tier) : [...prev, tier]
                                    )}
                                    className={`px-2 py-0.5 rounded text-xs border ${filterTier.includes(tier) ? 'bg-blue-600 text-white border-blue-600' : getTierColor(tier)
                                        }`}
                                >
                                    {tier}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                        <select
                            value={filterEnabled}
                            onChange={(e) => setFilterEnabled(e.target.value)}
                            className="w-full px-3 py-1 border rounded"
                        >
                            <option value="all">All</option>
                            <option value="true">Enabled Only</option>
                            <option value="false">Disabled Only</option>
                        </select>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    {error}
                    <button onClick={() => setError(null)} className="ml-4 underline">Dismiss</button>
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-100 text-slate-700">
                            <tr>
                                <th className="px-3 py-3 text-left w-12">On</th>
                                <th className="px-3 py-3 text-left">Key</th>
                                <th className="px-3 py-3 text-left">Label</th>
                                <th className="px-3 py-3 text-left">Category</th>
                                <th className="px-3 py-3 text-center">Tier</th>
                                <th className="px-3 py-3 text-center">Pts</th>
                                <th className="px-3 py-3 text-left">Source</th>
                                <th className="px-3 py-3 text-center">Engine</th>
                                <th className="px-3 py-3 text-center">Queries</th>
                                <th className="px-3 py-3 text-center">Templates</th>
                                <th className="px-3 py-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={11} className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
                            ) : surfaces.length === 0 ? (
                                <tr><td colSpan={11} className="px-6 py-8 text-center text-gray-500">
                                    No surfaces found. <button onClick={resetToDefaults} className="text-blue-600 underline">Seed defaults</button>
                                </td></tr>
                            ) : surfaces.map(surface => (
                                <tr key={surface.id} className="hover:bg-gray-50">
                                    <td className="px-3 py-2">
                                        <button
                                            onClick={() => toggleEnabled(surface)}
                                            className={`w-10 h-5 rounded-full transition-colors ${surface.enabled ? 'bg-green-500' : 'bg-gray-300'
                                                }`}
                                        >
                                            <span className={`block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${surface.enabled ? 'translate-x-5' : 'translate-x-0.5'
                                                }`} />
                                        </button>
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs">{surface.surfaceKey}</td>
                                    <td className="px-3 py-2 font-medium">{surface.label}</td>
                                    <td className="px-3 py-2">
                                        <span className={`px-2 py-0.5 rounded text-xs ${getCategoryColor(surface.category)}`}>
                                            {surface.category}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <span className={`px-2 py-0.5 rounded text-xs border ${getTierColor(surface.importanceTier)}`}>
                                            {surface.importanceTier}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-center font-bold">{surface.basePoints}</td>
                                    <td className="px-3 py-2 text-xs">{surface.sourceType.replace('DATAFORSEO_', 'DFS_')}</td>
                                    <td className="px-3 py-2 text-center text-xs">{surface.searchEngine || '-'}</td>
                                    <td className="px-3 py-2 text-center">{surface.maxQueries}</td>
                                    <td className="px-3 py-2 text-center">{surface.queryTemplates?.length || 0}</td>
                                    <td className="px-3 py-2 text-center">
                                        <button
                                            onClick={() => setShowDetail(surface)}
                                            className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 mr-1"
                                        >
                                            View
                                        </button>
                                        <button
                                            onClick={() => deleteSurface(surface.id)}
                                            className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                                        >
                                            ×
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail Drawer */}
            {showDetail && (
                <div className="fixed inset-0 bg-black/30 flex justify-end z-50">
                    <div className="w-[600px] bg-white h-full overflow-y-auto shadow-xl">
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                            <div>
                                <h2 className="text-xl font-bold">{showDetail.label}</h2>
                                <p className="text-sm text-gray-500 font-mono">{showDetail.surfaceKey}</p>
                            </div>
                            <button onClick={() => { setShowDetail(null); setTestResult(null); }} className="text-2xl">×</button>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* Info Grid */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div><span className="text-gray-500">Category:</span> <span className={`px-2 py-0.5 rounded ${getCategoryColor(showDetail.category)}`}>{showDetail.category}</span></div>
                                <div><span className="text-gray-500">Tier:</span> <span className={`px-2 py-0.5 rounded border ${getTierColor(showDetail.importanceTier)}`}>{showDetail.importanceTier}</span></div>
                                <div><span className="text-gray-500">Base Points:</span> <strong>{showDetail.basePoints}</strong></div>
                                <div><span className="text-gray-500">Weight:</span> {showDetail.defaultRelevanceWeight}</div>
                                <div><span className="text-gray-500">Source:</span> {showDetail.sourceType}</div>
                                <div><span className="text-gray-500">Engine:</span> {showDetail.searchEngine || 'N/A'}</div>
                                <div><span className="text-gray-500">Max Queries:</span> {showDetail.maxQueries}</div>
                                <div><span className="text-gray-500">Officialness Required:</span> {showDetail.officialnessRequired ? 'Yes' : 'No'}</div>
                            </div>

                            {/* Query Templates */}
                            <div>
                                <h3 className="font-semibold mb-2">Query Templates</h3>
                                <div className="bg-gray-50 p-3 rounded text-sm font-mono space-y-1">
                                    {showDetail.queryTemplates?.length > 0 ? showDetail.queryTemplates.map((t, i) => (
                                        <div key={i}>{t}</div>
                                    )) : <div className="text-gray-400">None</div>}
                                </div>
                            </div>

                            {/* Confirmation Artifact */}
                            <div>
                                <h3 className="font-semibold mb-2">Confirmation Artifact</h3>
                                <div className="bg-gray-50 p-3 rounded text-sm">{showDetail.confirmationArtifact}</div>
                            </div>

                            {/* Test Query Panel */}
                            <div className="border-t pt-4">
                                <h3 className="font-semibold mb-3">🧪 Test Query</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        type="text"
                                        placeholder="Domain (e.g., motani.com)"
                                        value={testDomain}
                                        onChange={(e) => setTestDomain(e.target.value)}
                                        className="px-3 py-2 border rounded"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Brand name"
                                        value={testBrand}
                                        onChange={(e) => setTestBrand(e.target.value)}
                                        className="px-3 py-2 border rounded"
                                    />
                                </div>
                                <button
                                    onClick={runTest}
                                    disabled={testing || !testDomain || !testBrand}
                                    className="mt-3 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                                >
                                    {testing ? 'Testing...' : 'Run Test'}
                                </button>

                                {/* Test Results */}
                                {testResult && (
                                    <div className="mt-4 bg-gray-50 rounded p-4 space-y-3">
                                        <div>
                                            <strong>Queries Used:</strong>
                                            <div className="font-mono text-xs mt-1">{testResult.queries?.join(' | ') || 'None'}</div>
                                        </div>
                                        <div>
                                            <strong>Status:</strong>{' '}
                                            <span className={`px-2 py-0.5 rounded text-xs ${testResult.evaluation.status === 'present' ? 'bg-green-100 text-green-700' :
                                                    testResult.evaluation.status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                                                        testResult.evaluation.status === 'absent' ? 'bg-red-100 text-red-700' :
                                                            'bg-gray-100 text-gray-600'
                                                }`}>
                                                {testResult.evaluation.status.toUpperCase()}
                                            </span>
                                            {testResult.evaluation.officialness && <span className="ml-2 text-green-600">✓ Official</span>}
                                        </div>
                                        <div>
                                            <strong>Score Preview:</strong>{' '}
                                            <span className="font-bold">{testResult.scorePreview.finalScore}</span>
                                            <span className="text-gray-500 text-xs ml-2">
                                                ({testResult.scorePreview.basePoints} × {testResult.scorePreview.weight} × {testResult.scorePreview.statusFactor})
                                            </span>
                                        </div>
                                        {testResult.results?.length > 0 && (
                                            <div>
                                                <strong>Evidence ({testResult.results.length}):</strong>
                                                <div className="mt-1 space-y-1 max-h-40 overflow-y-auto">
                                                    {testResult.results.map((r, i) => (
                                                        <a key={i} href={r.url} target="_blank" rel="noopener" className="block text-xs text-blue-600 hover:underline truncate">
                                                            {r.title || r.url}
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {testResult.error && (
                                            <div className="text-red-600 text-sm">Error: {testResult.error}</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Confirm Modal */}
            {showResetConfirm && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
                        <h2 className="text-xl font-bold mb-4">⚠️ Reset to Defaults?</h2>
                        <p className="text-gray-600 mb-6">This will delete all current surfaces and restore the default set. This cannot be undone.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowResetConfirm(false)} className="flex-1 px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">Cancel</button>
                            <button onClick={resetToDefaults} className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Reset</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
