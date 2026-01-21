'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Client {
    id: string;
    name: string;
    code: string;
    mainDomain: string;
}

interface SurfacePlanItem {
    surfaceKey: string;
    label: string;
    category: string;
    importanceTier: string;
    planStatus: 'AUTO_READY' | 'NEEDS_ENTITY_INPUT' | 'MANUAL_REQUIRED' | 'REQUIRES_PROVIDER' | 'DISABLED';
    missingEntityFields: string[];
    recommendedNextAction: string;
    ruleMetadata: {
        crawlOnlyFeasible: string | null;
        evidenceProvider: string | null;
        dataforseoRecommended: boolean;
        checkMode: string | null;
        canonicalInputNeeded: string | null;
    };
    playbookPreview?: {
        title: string;
        shortInstructions: string;
    } | null;
}

interface CategoryGroup {
    category: string;
    surfaces: SurfacePlanItem[];
    counts: {
        AUTO_READY: number;
        NEEDS_ENTITY_INPUT: number;
        MANUAL_REQUIRED: number;
        REQUIRES_PROVIDER: number;
        DISABLED: number;
        total: number;
    };
}

interface ExecutionPlan {
    clientId: string;
    clientName: string;
    hasCanonicalEntity: boolean;
    categories: CategoryGroup[];
    totals: {
        AUTO_READY: number;
        NEEDS_ENTITY_INPUT: number;
        MANUAL_REQUIRED: number;
        REQUIRES_PROVIDER: number;
        DISABLED: number;
        total: number;
    };
    entityCompleteness: {
        totalFields: number;
        filledFields: number;
        percentage: number;
    };
}

// Scan History Item
interface ScanHistoryItem {
    id: string;
    clientId: string;
    clientName: string;
    mode: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    summary: {
        total: number;
        counts: Record<string, number>;
        presentCount: number;
        absentCount: number;
        score: number;
    } | null;
}

// Status badge colors and labels
const STATUS_CONFIG = {
    AUTO_READY: { bg: 'bg-green-100', text: 'text-green-800', label: 'Auto Ready' },
    NEEDS_ENTITY_INPUT: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Needs Input' },
    MANUAL_REQUIRED: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Manual' },
    REQUIRES_PROVIDER: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Provider Needed' },
    DISABLED: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Disabled' },
};

// Tier badge colors
const TIER_CONFIG: Record<string, { bg: string; text: string }> = {
    CRITICAL: { bg: 'bg-red-100', text: 'text-red-800' },
    HIGH: { bg: 'bg-orange-100', text: 'text-orange-800' },
    MEDIUM: { bg: 'bg-blue-100', text: 'text-blue-800' },
    LOW: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

// Category display names
const CATEGORY_LABELS: Record<string, string> = {
    owned: 'Owned Properties',
    search: 'Search Presence',
    social: 'Social Media',
    video: 'Video Platforms',
    trust: 'Trust & Reviews',
    authority: 'Authority Signals',
    marketplace: 'Marketplaces',
    community: 'Community & Forums',
    technical: 'Technical SEO',
    aeo: 'AI & Answer Engines',
    eeat_entity: 'E-E-A-T & Entity',
    performance_security: 'Performance & Security',
};

export default function ScanPlanPage() {
    const router = useRouter();
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [plan, setPlan] = useState<ExecutionPlan | null>(null);
    const [loading, setLoading] = useState(false);
    const [runningScan, setRunningScan] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [selectedPlaybook, setSelectedPlaybook] = useState<SurfacePlanItem | null>(null);
    const [activeTab, setActiveTab] = useState<'plan' | 'history' | 'rules'>('plan');
    const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Fetch scan history for selected client
    const fetchHistory = async (clientId: string) => {
        if (!clientId) return;
        setLoadingHistory(true);
        try {
            const res = await fetch(`/api/digital-footprint/scan/history?clientId=${clientId}`);
            if (res.ok) {
                const data = await res.json();
                setScanHistory(data.scans || []);
            }
        } catch (e) {
            console.error('Failed to load scan history', e);
        } finally {
            setLoadingHistory(false);
        }
    };

    // Fetch history when tab changes to history
    useEffect(() => {
        if (activeTab === 'history' && selectedClientId) {
            fetchHistory(selectedClientId);
        }
    }, [activeTab, selectedClientId]);

    // Load clients on mount
    useEffect(() => {
        fetch('/api/clients')
            .then(res => res.json())
            .then(data => setClients(data))
            .catch(() => setError('Failed to load clients'));
    }, []);

    // Generate plan
    const generatePlan = async () => {
        if (!selectedClientId) return;

        setLoading(true);
        setError(null);
        setPlan(null);

        try {
            const res = await fetch('/api/digital-footprint/scan/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: selectedClientId }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to generate plan');
            }

            const data = await res.json();
            setPlan(data);
            // Expand all categories by default
            setExpandedCategories(new Set(data.categories.map((c: CategoryGroup) => c.category)));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to generate plan');
        } finally {
            setLoading(false);
        }
    };

    const toggleCategory = (category: string) => {
        const next = new Set(expandedCategories);
        if (next.has(category)) {
            next.delete(category);
        } else {
            next.add(category);
        }
        setExpandedCategories(next);
    };

    // Run scan (execute AUTO_READY surfaces)
    const runScan = async () => {
        if (!selectedClientId || !plan) return;

        setRunningScan(true);
        setError(null);

        try {
            const res = await fetch('/api/digital-footprint/scan/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: selectedClientId,
                    mode: 'CRAWL_ONLY',
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to run scan');
            }

            const data = await res.json();
            // Redirect to results page
            router.push(`/digital-footprint/scan-results/${data.scanId}`);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to run scan');
            setRunningScan(false);
        }
    };


    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-800">Scan Execution Plan</h1>
                    <p className="text-slate-600 mt-1">
                        Review which surfaces can be scanned automatically vs require manual input
                    </p>
                </div>

                {/* Client Selection */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <div className="flex items-end gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Select Client
                            </label>
                            <select
                                value={selectedClientId}
                                onChange={(e) => setSelectedClientId(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">-- Select a client --</option>
                                {clients.map(client => (
                                    <option key={client.id} value={client.id}>
                                        {client.name} ({client.mainDomain})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={generatePlan}
                            disabled={!selectedClientId || loading}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? 'Generating...' : 'Generate Plan'}
                        </button>
                    </div>

                    {error && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {error}
                        </div>
                    )}
                </div>

                {/* Tab Switcher */}
                {selectedClientId && (
                    <div className="flex gap-2 mb-6">
                        <button
                            onClick={() => setActiveTab('plan')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'plan'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                                }`}
                        >
                            📋 Execution Plan
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'history'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                                }`}
                        >
                            📜 Scan History
                        </button>
                        <button
                            onClick={() => setActiveTab('rules')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'rules'
                                ? 'bg-purple-600 text-white'
                                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                                }`}
                        >
                            🔧 Debug Rules
                        </button>
                    </div>
                )}

                {/* History Tab */}
                {activeTab === 'history' && selectedClientId && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Recent Scans</h3>

                        {loadingHistory ? (
                            <div className="text-center py-8 text-slate-500">Loading history...</div>
                        ) : scanHistory.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                No scan history for this client
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-slate-50">
                                            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Started</th>
                                            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Status</th>
                                            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Mode</th>
                                            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Score</th>
                                            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Present</th>
                                            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Absent</th>
                                            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {scanHistory.map(scan => (
                                            <tr
                                                key={scan.id}
                                                onClick={() => router.push(`/digital-footprint/scan-results/${scan.id}`)}
                                                className="border-t border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors"
                                            >
                                                <td className="px-4 py-3 text-sm text-slate-700">
                                                    {new Date(scan.startedAt).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${scan.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                                        scan.status === 'RUNNING' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-slate-100 text-slate-600'
                                                        }`}>
                                                        {scan.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-600">{scan.mode}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`font-medium ${(scan.summary?.score ?? 0) >= 70 ? 'text-green-600' :
                                                        (scan.summary?.score ?? 0) >= 40 ? 'text-yellow-600' :
                                                            'text-red-600'
                                                        }`}>
                                                        {scan.summary?.score ?? 0}%
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-green-600 font-medium">
                                                    {scan.summary?.presentCount ?? 0}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-red-600 font-medium">
                                                    {scan.summary?.absentCount ?? 0}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-600">
                                                    {scan.summary?.total ?? 0}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Rules Debug Tab */}
                {activeTab === 'rules' && plan && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">🔧 Rule Classification Debug</h3>
                        <p className="text-sm text-slate-500 mb-4">
                            Shows all surfaces with their rule parameters. Surfaces are marked MANUAL if:
                            sourceType = MANUAL_REVIEW OR evidenceProvider = MANUAL OR hasPlaybook = true
                        </p>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Surface Key</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">evidenceProvider</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">sourceType</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">hasPlaybook</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">canonicalInputNeeded</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {plan.categories.flatMap(cat => cat.surfaces).map(surface => {
                                        const config = STATUS_CONFIG[surface.planStatus as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.DISABLED;
                                        return (
                                            <tr key={surface.surfaceKey} className="hover:bg-slate-50">
                                                <td className="px-3 py-2 text-sm font-mono text-slate-700">{surface.surfaceKey}</td>
                                                <td className="px-3 py-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
                                                        {surface.planStatus}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-sm text-slate-600">
                                                    {surface.ruleMetadata?.evidenceProvider || <span className="text-slate-400">-</span>}
                                                </td>
                                                <td className="px-3 py-2 text-sm text-slate-600">
                                                    {surface.ruleMetadata?.checkMode || <span className="text-slate-400">-</span>}
                                                </td>
                                                <td className="px-3 py-2 text-sm">
                                                    {surface.playbookPreview ? (
                                                        <span className="text-orange-600 font-medium">✓ Yes</span>
                                                    ) : (
                                                        <span className="text-slate-400">No</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-sm text-slate-600">
                                                    {surface.ruleMetadata?.canonicalInputNeeded || <span className="text-slate-400">-</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Summary counts */}
                        <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                            <h4 className="font-medium text-slate-700 mb-2">Classification Breakdown</h4>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                                <div>AUTO_READY: <span className="font-bold text-green-700">{plan.totals.AUTO_READY}</span></div>
                                <div>NEEDS_INPUT: <span className="font-bold text-yellow-700">{plan.totals.NEEDS_ENTITY_INPUT}</span></div>
                                <div>MANUAL: <span className="font-bold text-orange-700">{plan.totals.MANUAL_REQUIRED}</span></div>
                                <div>PROVIDER: <span className="font-bold text-purple-700">{plan.totals.REQUIRES_PROVIDER}</span></div>
                                <div>DISABLED: <span className="font-bold text-slate-500">{plan.totals.DISABLED}</span></div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Plan Results */}
                {activeTab === 'plan' && plan && (
                    <>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                                <div className="text-3xl font-bold text-green-700">{plan.totals.AUTO_READY}</div>
                                <div className="text-sm text-green-600">Auto Ready</div>
                            </div>
                            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                                <div className="text-3xl font-bold text-yellow-700">{plan.totals.NEEDS_ENTITY_INPUT}</div>
                                <div className="text-sm text-yellow-600">Needs Input</div>
                            </div>
                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                                <div className="text-3xl font-bold text-orange-700">{plan.totals.MANUAL_REQUIRED}</div>
                                <div className="text-sm text-orange-600">Manual</div>
                            </div>
                            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                                <div className="text-3xl font-bold text-purple-700">{plan.totals.REQUIRES_PROVIDER}</div>
                                <div className="text-sm text-purple-600">Provider</div>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                                <div className="text-3xl font-bold text-slate-700">{plan.totals.total}</div>
                                <div className="text-sm text-slate-600">Total</div>
                            </div>
                        </div>

                        {/* Entity Completeness */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-slate-800">Entity Profile Completeness</h3>
                                    <p className="text-sm text-slate-500">
                                        {plan.hasCanonicalEntity
                                            ? `${plan.entityCompleteness.filledFields}/${plan.entityCompleteness.totalFields} fields filled`
                                            : 'No Canonical Entity configured'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-48 h-3 bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 rounded-full transition-all"
                                            style={{ width: `${plan.entityCompleteness.percentage}%` }}
                                        />
                                    </div>
                                    <span className="text-lg font-bold text-blue-600">
                                        {plan.entityCompleteness.percentage}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Run Scan Button */}
                        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl shadow-sm border border-emerald-200 p-6 mb-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-emerald-800 text-lg">Ready to Scan</h3>
                                    <p className="text-sm text-emerald-600">
                                        {plan.totals.AUTO_READY} surfaces will be scanned automatically.
                                        {plan.totals.MANUAL_REQUIRED + plan.totals.REQUIRES_PROVIDER > 0 &&
                                            ` ${plan.totals.MANUAL_REQUIRED + plan.totals.REQUIRES_PROVIDER} require manual verification.`}
                                    </p>
                                </div>
                                <button
                                    onClick={runScan}
                                    disabled={runningScan || plan.totals.AUTO_READY === 0}
                                    className="px-8 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
                                >
                                    {runningScan ? (
                                        <span className="flex items-center gap-2">
                                            <span className="animate-spin">⟳</span>
                                            Running Scan...
                                        </span>
                                    ) : (
                                        '🚀 Run Scan (Crawl Only)'
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {plan.categories.map(category => (
                                <div key={category.category} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    {/* Category Header */}
                                    <button
                                        onClick={() => toggleCategory(category.category)}
                                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <span className="text-xl">
                                                {expandedCategories.has(category.category) ? '▼' : '▶'}
                                            </span>
                                            <h3 className="text-lg font-semibold text-slate-800">
                                                {CATEGORY_LABELS[category.category] || category.category}
                                            </h3>
                                            <span className="text-sm text-slate-500">
                                                ({category.counts.total} surfaces)
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {category.counts.AUTO_READY > 0 && (
                                                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                                    {category.counts.AUTO_READY} auto
                                                </span>
                                            )}
                                            {category.counts.NEEDS_ENTITY_INPUT > 0 && (
                                                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                                                    {category.counts.NEEDS_ENTITY_INPUT} needs input
                                                </span>
                                            )}
                                            {category.counts.MANUAL_REQUIRED > 0 && (
                                                <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">
                                                    {category.counts.MANUAL_REQUIRED} manual
                                                </span>
                                            )}
                                        </div>
                                    </button>

                                    {/* Category Surfaces */}
                                    {expandedCategories.has(category.category) && (
                                        <div className="border-t border-slate-200">
                                            <table className="w-full">
                                                <thead className="bg-slate-50">
                                                    <tr>
                                                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Surface</th>
                                                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Tier</th>
                                                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Status</th>
                                                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Missing Fields</th>
                                                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {category.surfaces.map(surface => {
                                                        const statusCfg = STATUS_CONFIG[surface.planStatus];
                                                        const tierCfg = TIER_CONFIG[surface.importanceTier] || TIER_CONFIG.LOW;

                                                        return (
                                                            <tr key={surface.surfaceKey} className="hover:bg-slate-50">
                                                                <td className="px-4 py-3">
                                                                    <div className="font-medium text-slate-800">{surface.label}</div>
                                                                    <div className="text-xs text-slate-400 font-mono">{surface.surfaceKey}</div>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <span className={`px-2 py-0.5 text-xs rounded ${tierCfg.bg} ${tierCfg.text}`}>
                                                                        {surface.importanceTier}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <span className={`px-2 py-1 text-xs rounded-full ${statusCfg.bg} ${statusCfg.text}`}>
                                                                        {statusCfg.label}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    {surface.missingEntityFields.length > 0 ? (
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {surface.missingEntityFields.map(field => (
                                                                                <span key={field} className="px-2 py-0.5 bg-yellow-50 text-yellow-700 text-xs rounded">
                                                                                    {field}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-slate-400 text-xs">—</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    {surface.planStatus === 'NEEDS_ENTITY_INPUT' && (
                                                                        <a
                                                                            href={`/clients/${plan.clientId}/entity`}
                                                                            className="text-xs text-blue-600 hover:underline"
                                                                        >
                                                                            Add to Entity ID →
                                                                        </a>
                                                                    )}
                                                                    {surface.planStatus === 'MANUAL_REQUIRED' && surface.playbookPreview && (
                                                                        <button
                                                                            onClick={() => setSelectedPlaybook(surface)}
                                                                            className="text-xs text-orange-600 hover:underline"
                                                                        >
                                                                            Open Manual Steps →
                                                                        </button>
                                                                    )}
                                                                    {surface.planStatus === 'AUTO_READY' && (
                                                                        <span className="text-xs text-green-600">✓ Ready to run</span>
                                                                    )}
                                                                    {surface.planStatus === 'REQUIRES_PROVIDER' && (
                                                                        <span className="text-xs text-purple-600">
                                                                            {surface.ruleMetadata.dataforseoRecommended
                                                                                ? 'DataForSEO recommended'
                                                                                : 'Configure provider'}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Playbook Drawer */}
                {selectedPlaybook && (
                    <div className="fixed inset-0 bg-black/50 flex justify-end z-50">
                        <div className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-xl">
                            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-slate-800">
                                    {selectedPlaybook.playbookPreview?.title}
                                </h3>
                                <button
                                    onClick={() => setSelectedPlaybook(null)}
                                    className="p-2 hover:bg-slate-100 rounded-lg"
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="p-6">
                                <div className="prose prose-sm max-w-none">
                                    <p className="text-slate-600 whitespace-pre-wrap">
                                        {selectedPlaybook.playbookPreview?.shortInstructions}
                                    </p>
                                </div>

                                <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                                    <h4 className="font-medium text-slate-700 mb-2">Evidence Required</h4>
                                    <ul className="space-y-1 text-sm text-slate-600">
                                        <li>• URL or screenshot of presence</li>
                                        <li>• Notes confirming brand match</li>
                                    </ul>
                                </div>

                                <div className="mt-6">
                                    <button className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700">
                                        Start Manual Verification
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
