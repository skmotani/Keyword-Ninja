'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface ScanResult {
    id: string;
    surfaceKey: string;
    surfaceLabel: string | null;
    category: string | null;
    importanceTier: string | null;
    status: string;
    confidence: number;
    evidence: Record<string, unknown> | null;
    metrics: Record<string, unknown> | null;
    checkedAt: string;
    errorMessage: string | null;
    submittedBy: string | null;
    submittedAt: string | null;
}

interface CategoryGroup {
    category: string;
    results: ScanResult[];
    counts: {
        PRESENT_CONFIRMED: number;
        PRESENT_PARTIAL: number;
        ABSENT: number;
        NEEDS_ENTITY_INPUT: number;
        MANUAL_REQUIRED: number;
        REQUIRES_PROVIDER: number;
        ERROR: number;
        total: number;
    };
}

interface ActionItem {
    surfaceKey: string;
    label: string;
    category: string;
    tier: string;
    status: string;
    whyItMatters: string;
    remediationSteps: string[];
    fixLinkType: 'ENTITY_ID' | 'WEBSITE_PATH' | 'DNS' | 'MANUAL';
    fixLinkTarget: string | null;
    impact: number;
    effort: number;
    priorityScore: number;
}

interface ScanData {
    scan: {
        id: string;
        clientId: string;
        clientName: string;
        mode: string;
        status: string;
        startedAt: string;
        completedAt: string | null;
        summary: {
            counts: Record<string, number>;
            presentCount: number;
            absentCount: number;
            score: number;
        };
    };
    categories: CategoryGroup[];
    actionPlan: {
        criticalFixes: ActionItem[];
        quickWins: ActionItem[];
        entityFixes: ActionItem[];
        securityFixes: ActionItem[];
        allSorted: ActionItem[];
    };
    totals: {
        total: number;
        presentCount: number;
        absentCount: number;
        needsInputCount: number;
        manualRequired: number;
        errorCount: number;
    };
}

// Status badge config
const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
    PRESENT_CONFIRMED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Present' },
    PRESENT_PARTIAL: { bg: 'bg-lime-100', text: 'text-lime-800', label: 'Partial' },
    ABSENT: { bg: 'bg-red-100', text: 'text-red-800', label: 'Absent' },
    NEEDS_ENTITY_INPUT: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Needs Input' },
    MANUAL_REQUIRED: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Manual' },
    REQUIRES_PROVIDER: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Provider' },
    ERROR: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Error' },
    PENDING: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Pending' },
};

// Category labels
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

export default function ScanResultsPage() {
    const params = useParams();
    const scanId = params.scanId as string;
    const [data, setData] = useState<ScanData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [selectedResult, setSelectedResult] = useState<ScanResult | null>(null);
    const [activeTab, setActiveTab] = useState<'results' | 'actions'>('results');

    // Manual submit form state
    const [selectedManual, setSelectedManual] = useState<ScanResult | null>(null);
    const [manualForm, setManualForm] = useState({ url: '', notes: '', status: 'PRESENT_CONFIRMED' });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchResults();
    }, [scanId]);

    const fetchResults = async () => {
        try {
            const res = await fetch(`/api/digital-footprint/scan/${scanId}`);
            if (!res.ok) throw new Error('Failed to load scan results');
            const data = await res.json();
            setData(data);
            setExpandedCategories(new Set(data.categories.map((c: CategoryGroup) => c.category)));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load');
        } finally {
            setLoading(false);
        }
    };

    const toggleCategory = (category: string) => {
        const next = new Set(expandedCategories);
        if (next.has(category)) next.delete(category);
        else next.add(category);
        setExpandedCategories(next);
    };

    const submitManualEvidence = async () => {
        if (!selectedManual || !data) return;
        setSubmitting(true);

        try {
            const res = await fetch('/api/digital-footprint/scan/manual/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scanId: data.scan.id,
                    surfaceKey: selectedManual.surfaceKey,
                    status: manualForm.status,
                    evidence: {
                        url: manualForm.url,
                        notes: manualForm.notes,
                    },
                }),
            });

            if (!res.ok) throw new Error('Failed to submit');

            // Refresh results
            await fetchResults();
            setSelectedManual(null);
            setManualForm({ url: '', notes: '', status: 'PRESENT_CONFIRMED' });
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Submit failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin text-4xl mb-4">⟳</div>
                    <p className="text-slate-600">Loading scan results...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 flex items-center justify-center">
                <div className="bg-red-50 p-6 rounded-xl border border-red-200 text-red-700">
                    {error || 'Failed to load scan results'}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                        <a href="/digital-footprint/scan-plan" className="hover:text-blue-600">← Back to Scan Plan</a>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800">Scan Results</h1>
                    <p className="text-slate-600 mt-1">
                        {data.scan.clientName} • {data.scan.mode} • {new Date(data.scan.startedAt).toLocaleString()}
                    </p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="bg-emerald-500 text-white rounded-xl p-4 text-center shadow-lg">
                        <div className="text-4xl font-bold">{data.scan.summary?.score || 0}%</div>
                        <div className="text-sm opacity-90">Footprint Score</div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-green-700">{data.totals.presentCount}</div>
                        <div className="text-sm text-green-600">Present</div>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-red-700">{data.totals.absentCount}</div>
                        <div className="text-sm text-red-600">Absent</div>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-orange-700">{data.totals.manualRequired}</div>
                        <div className="text-sm text-orange-600">Manual</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-slate-700">{data.totals.total}</div>
                        <div className="text-sm text-slate-600">Total</div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab('results')}
                        className={`px-6 py-2 rounded-lg font-medium transition-colors ${activeTab === 'results'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                            }`}
                    >
                        📊 Results by Category
                    </button>
                    <button
                        onClick={() => setActiveTab('actions')}
                        className={`px-6 py-2 rounded-lg font-medium transition-colors ${activeTab === 'actions'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                            }`}
                    >
                        🎯 What to Do Next ({
                            (data.actionPlan.criticalFixes.length || 0) +
                            (data.actionPlan.quickWins.length || 0) +
                            (data.actionPlan.securityFixes.length || 0)
                        })
                    </button>
                </div>

                {/* Results Tab */}
                {activeTab === 'results' && (
                    <div className="space-y-4">
                        {data.categories.map(category => (
                            <div key={category.category} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <button
                                    onClick={() => toggleCategory(category.category)}
                                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50"
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
                                        {category.counts.PRESENT_CONFIRMED + category.counts.PRESENT_PARTIAL > 0 && (
                                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                                ✓ {category.counts.PRESENT_CONFIRMED + category.counts.PRESENT_PARTIAL}
                                            </span>
                                        )}
                                        {category.counts.ABSENT > 0 && (
                                            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                                                ✗ {category.counts.ABSENT}
                                            </span>
                                        )}
                                    </div>
                                </button>

                                {expandedCategories.has(category.category) && (
                                    <div className="border-t border-slate-200">
                                        <table className="w-full">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Surface</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Status</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Confidence</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {category.results.map(result => {
                                                    const statusCfg = STATUS_CONFIG[result.status] || STATUS_CONFIG.PENDING;
                                                    return (
                                                        <tr key={result.id} className="hover:bg-slate-50">
                                                            <td className="px-4 py-3">
                                                                <div className="font-medium text-slate-800">{result.surfaceLabel}</div>
                                                                <div className="text-xs text-slate-400 font-mono">{result.surfaceKey}</div>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className={`px-2 py-1 text-xs rounded-full ${statusCfg.bg} ${statusCfg.text}`}>
                                                                    {statusCfg.label}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                                                                        <div
                                                                            className={`h-full rounded-full ${result.confidence >= 70 ? 'bg-green-500' :
                                                                                result.confidence >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                                                                }`}
                                                                            style={{ width: `${result.confidence}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className="text-xs text-slate-500">{result.confidence}%</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex gap-2">
                                                                    {result.evidence && (
                                                                        <button
                                                                            onClick={() => setSelectedResult(result)}
                                                                            className="text-xs text-blue-600 hover:underline"
                                                                        >
                                                                            View Evidence
                                                                        </button>
                                                                    )}
                                                                    {(result.status === 'MANUAL_REQUIRED' || result.status === 'REQUIRES_PROVIDER') && (
                                                                        <button
                                                                            onClick={() => setSelectedManual(result)}
                                                                            className="text-xs text-orange-600 hover:underline"
                                                                        >
                                                                            Submit Manual
                                                                        </button>
                                                                    )}
                                                                </div>
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
                )}

                {/* Actions Tab - What to Do Next */}
                {activeTab === 'actions' && (
                    <div className="space-y-6">
                        {/* Critical Fixes */}
                        {data.actionPlan.criticalFixes.length > 0 && (
                            <div className="bg-red-50 rounded-xl border border-red-200 p-6">
                                <h3 className="text-lg font-bold text-red-800 mb-4">🚨 Critical Fixes</h3>
                                <div className="space-y-4">
                                    {data.actionPlan.criticalFixes.map(item => (
                                        <div key={item.surfaceKey} className="bg-white rounded-lg p-4 border border-red-100">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h4 className="font-semibold text-slate-800">{item.label}</h4>
                                                    <p className="text-sm text-slate-600 mt-1">{item.whyItMatters}</p>
                                                    <ul className="mt-2 text-sm text-slate-700">
                                                        {item.remediationSteps.map((step, i) => (
                                                            <li key={i} className="flex items-start gap-2">
                                                                <span className="text-red-500">•</span>
                                                                {step}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                                                    Critical
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Security Fixes */}
                        {data.actionPlan.securityFixes.length > 0 && (
                            <div className="bg-amber-50 rounded-xl border border-amber-200 p-6">
                                <h3 className="text-lg font-bold text-amber-800 mb-4">🔒 Security Fixes</h3>
                                <div className="space-y-4">
                                    {data.actionPlan.securityFixes.map(item => (
                                        <div key={item.surfaceKey} className="bg-white rounded-lg p-4 border border-amber-100">
                                            <h4 className="font-semibold text-slate-800">{item.label}</h4>
                                            <p className="text-sm text-slate-600 mt-1">{item.whyItMatters}</p>
                                            <ul className="mt-2 text-sm text-slate-700">
                                                {item.remediationSteps.map((step, i) => (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <span className="text-amber-500">→</span>
                                                        {step}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Quick Wins */}
                        {data.actionPlan.quickWins.length > 0 && (
                            <div className="bg-green-50 rounded-xl border border-green-200 p-6">
                                <h3 className="text-lg font-bold text-green-800 mb-4">⚡ Quick Wins</h3>
                                <div className="space-y-4">
                                    {data.actionPlan.quickWins.map(item => (
                                        <div key={item.surfaceKey} className="bg-white rounded-lg p-4 border border-green-100">
                                            <h4 className="font-semibold text-slate-800">{item.label}</h4>
                                            <p className="text-sm text-slate-600 mt-1">{item.whyItMatters}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Entity Fixes */}
                        {data.actionPlan.entityFixes.length > 0 && (
                            <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
                                <h3 className="text-lg font-bold text-blue-800 mb-4">📋 Entity Profile Updates Needed</h3>
                                <p className="text-sm text-blue-700 mb-4">
                                    These surfaces need entity profile data to be verified.
                                    <a href="/clients" className="underline ml-1">Update Entity ID →</a>
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {data.actionPlan.entityFixes.map(item => (
                                        <span key={item.surfaceKey} className="px-3 py-1 bg-white border border-blue-200 rounded-full text-sm text-blue-800">
                                            {item.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Evidence Drawer (HARDENED) */}
                {selectedResult && (
                    <div className="fixed inset-0 bg-black/50 flex justify-end z-50">
                        <div className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-xl">
                            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-slate-800">Evidence Details</h3>
                                <button onClick={() => setSelectedResult(null)} className="p-2 hover:bg-slate-100 rounded-lg">✕</button>
                            </div>
                            <div className="p-6 space-y-6">
                                <div>
                                    <h4 className="font-medium text-slate-800 text-lg">{selectedResult.surfaceLabel}</h4>
                                    <p className="text-sm text-slate-500 font-mono">{selectedResult.surfaceKey}</p>
                                </div>

                                {/* Status & Confidence */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50 p-3 rounded-lg">
                                        <p className="text-xs text-slate-500 mb-1">Status</p>
                                        <p className="font-medium">{selectedResult.status}</p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-lg">
                                        <p className="text-xs text-slate-500 mb-1">Confidence</p>
                                        <p className="font-medium">{selectedResult.confidence}%</p>
                                    </div>
                                </div>

                                {(() => {
                                    const ev = selectedResult.evidence as {
                                        target?: { attemptedUrl?: string; method?: string; provider?: string };
                                        fetch?: { httpStatus?: number; finalUrl?: string; redirectChain?: string[] };
                                        match?: { matchSignals?: string[]; mismatchSignals?: string[] };
                                        integrity?: { contentHash?: string };
                                        errors?: { code?: string; message?: string; blockReason?: string };
                                        dns?: { recordType?: string; host?: string; values?: string[]; parsedFlags?: Record<string, unknown> };
                                        missingFields?: string[];
                                    } | null;

                                    if (!ev) return null;

                                    return (
                                        <>
                                            {/* Target Info */}
                                            {ev.target && (
                                                <div className="border border-slate-200 rounded-lg p-4">
                                                    <h5 className="font-medium text-slate-700 mb-2">Target</h5>
                                                    {ev.target.attemptedUrl && (
                                                        <p className="text-sm break-all">
                                                            <span className="text-slate-500">URL:</span> {ev.target.attemptedUrl}
                                                        </p>
                                                    )}
                                                    <p className="text-sm">
                                                        <span className="text-slate-500">Method:</span> {ev.target.method || 'N/A'}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Fetch Info */}
                                            {ev.fetch && (
                                                <div className="border border-slate-200 rounded-lg p-4">
                                                    <h5 className="font-medium text-slate-700 mb-2">Fetch Result</h5>
                                                    <div className="space-y-1 text-sm">
                                                        <p>
                                                            <span className="text-slate-500">HTTP Status:</span>{' '}
                                                            <span className={ev.fetch.httpStatus && ev.fetch.httpStatus >= 200 && ev.fetch.httpStatus < 300 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                                                {ev.fetch.httpStatus || 'N/A'}
                                                            </span>
                                                        </p>
                                                        {ev.fetch.finalUrl && (
                                                            <p className="break-all">
                                                                <span className="text-slate-500">Final URL:</span> {ev.fetch.finalUrl}
                                                            </p>
                                                        )}
                                                        {ev.fetch.redirectChain && ev.fetch.redirectChain.length > 0 && (
                                                            <p>
                                                                <span className="text-slate-500">Redirects:</span> {ev.fetch.redirectChain.length}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Match Signals */}
                                            {ev.match && (ev.match.matchSignals?.length || ev.match.mismatchSignals?.length) && (
                                                <div className="border border-slate-200 rounded-lg p-4">
                                                    <h5 className="font-medium text-slate-700 mb-2">Match Signals</h5>
                                                    {ev.match.matchSignals && ev.match.matchSignals.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mb-2">
                                                            {ev.match.matchSignals.map((s, i) => (
                                                                <span key={i} className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                                                                    ✓ {s}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {ev.match.mismatchSignals && ev.match.mismatchSignals.length > 0 && (
                                                        <div className="flex flex-wrap gap-1">
                                                            {ev.match.mismatchSignals.map((s, i) => (
                                                                <span key={i} className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                                                                    ✗ {s}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* DNS Info */}
                                            {ev.dns && (
                                                <div className="border border-slate-200 rounded-lg p-4">
                                                    <h5 className="font-medium text-slate-700 mb-2">DNS Record</h5>
                                                    <div className="space-y-1 text-sm">
                                                        <p><span className="text-slate-500">Type:</span> {ev.dns.recordType}</p>
                                                        <p><span className="text-slate-500">Host:</span> {ev.dns.host}</p>
                                                        {ev.dns.values && ev.dns.values.length > 0 && (
                                                            <div>
                                                                <span className="text-slate-500">Values:</span>
                                                                <ul className="mt-1 text-xs bg-slate-50 p-2 rounded font-mono">
                                                                    {ev.dns.values.map((v, i) => <li key={i}>{v}</li>)}
                                                                </ul>
                                                            </div>
                                                        )}
                                                        {ev.dns.parsedFlags && (
                                                            <div>
                                                                <span className="text-slate-500">Parsed:</span>
                                                                <pre className="mt-1 text-xs bg-slate-50 p-2 rounded overflow-auto">
                                                                    {JSON.stringify(ev.dns.parsedFlags, null, 2)}
                                                                </pre>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Integrity */}
                                            {ev.integrity?.contentHash && (
                                                <div className="border border-slate-200 rounded-lg p-4">
                                                    <h5 className="font-medium text-slate-700 mb-2">Integrity</h5>
                                                    <p className="text-sm">
                                                        <span className="text-slate-500">Content Hash:</span>{' '}
                                                        <code className="text-xs bg-slate-100 px-1 rounded">{ev.integrity.contentHash}</code>
                                                    </p>
                                                </div>
                                            )}

                                            {/* Errors */}
                                            {(ev.errors?.code || ev.errors?.blockReason) && (
                                                <div className="border border-red-200 bg-red-50 rounded-lg p-4">
                                                    <h5 className="font-medium text-red-700 mb-2">Errors</h5>
                                                    {ev.errors.code && <p className="text-sm"><span className="text-red-500">Code:</span> {ev.errors.code}</p>}
                                                    {ev.errors.message && <p className="text-sm"><span className="text-red-500">Message:</span> {ev.errors.message}</p>}
                                                    {ev.errors.blockReason && (
                                                        <p className="text-sm"><span className="text-red-500">Block Reason:</span> {ev.errors.blockReason}</p>
                                                    )}
                                                </div>
                                            )}

                                            {/* Missing Fields */}
                                            {ev.missingFields && ev.missingFields.length > 0 && (
                                                <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
                                                    <h5 className="font-medium text-yellow-700 mb-2">Missing Entity Fields</h5>
                                                    <div className="flex flex-wrap gap-1">
                                                        {ev.missingFields.map((f, i) => (
                                                            <span key={i} className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">
                                                                {f}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}

                                {/* Raw JSON (collapsed) */}
                                <details className="border border-slate-200 rounded-lg">
                                    <summary className="px-4 py-2 cursor-pointer text-sm text-slate-600 hover:bg-slate-50">
                                        View Raw JSON
                                    </summary>
                                    <pre className="p-4 text-xs overflow-auto max-h-64 bg-slate-50">
                                        {JSON.stringify(selectedResult.evidence, null, 2)}
                                    </pre>
                                </details>
                            </div>
                        </div>
                    </div>
                )}

                {/* Manual Submit Drawer */}
                {selectedManual && (
                    <div className="fixed inset-0 bg-black/50 flex justify-end z-50">
                        <div className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-xl">
                            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-slate-800">Submit Manual Evidence</h3>
                                <button onClick={() => setSelectedManual(null)} className="p-2 hover:bg-slate-100 rounded-lg">✕</button>
                            </div>
                            <div className="p-6">
                                <p className="text-slate-600 mb-4">
                                    Verify <strong>{selectedManual.surfaceLabel}</strong> manually and submit your findings.
                                </p>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                        <select
                                            value={manualForm.status}
                                            onChange={(e) => setManualForm({ ...manualForm, status: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                                        >
                                            <option value="PRESENT_CONFIRMED">Present (Confirmed)</option>
                                            <option value="PRESENT_PARTIAL">Present (Partial)</option>
                                            <option value="ABSENT">Absent</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Profile URL</label>
                                        <input
                                            type="url"
                                            value={manualForm.url}
                                            onChange={(e) => setManualForm({ ...manualForm, url: e.target.value })}
                                            placeholder="https://..."
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                                        <textarea
                                            value={manualForm.notes}
                                            onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                                            rows={4}
                                            placeholder="How did you verify this?"
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                                        />
                                    </div>

                                    <button
                                        onClick={submitManualEvidence}
                                        disabled={submitting}
                                        className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:bg-slate-300"
                                    >
                                        {submitting ? 'Submitting...' : 'Submit Evidence'}
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
