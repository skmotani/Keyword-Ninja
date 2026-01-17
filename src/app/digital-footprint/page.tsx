'use client';

import { useState } from 'react';

interface SurfaceResult {
    key: string;
    label: string;
    category: string;
    status: 'present' | 'partial' | 'absent' | 'unknown';
    relevance: string;
    pointsAwarded: number;
    pointsMax: number;
    confidence: number;
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
    domains: DomainResult[];
}

type FilterType = 'all' | 'gaps' | 'critical' | 'unknown';

export default function DigitalFootprintPage() {
    const [domains, setDomains] = useState('');
    const [hints, setHints] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ScanResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<FilterType>('all');
    const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

    const runScan = async () => {
        if (!domains.trim()) return;

        setLoading(true);
        setError(null);
        setResult(null);

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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'present': return 'bg-green-100 text-green-800 border-green-200';
            case 'partial': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'absent': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-600 border-gray-200';
        }
    };

    const getRelevanceColor = (relevance: string) => {
        switch (relevance) {
            case 'high': return 'text-red-600 font-semibold';
            case 'medium': return 'text-yellow-600';
            default: return 'text-gray-400';
        }
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'owned': return '🏠';
            case 'search': return '🔍';
            case 'social': return '📱';
            case 'trust': return '⭐';
            case 'authority': return '🏆';
            default: return '📊';
        }
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
        if (percentage >= 90) return { grade: 'A', color: 'text-green-600' };
        if (percentage >= 75) return { grade: 'B', color: 'text-blue-600' };
        if (percentage >= 60) return { grade: 'C', color: 'text-yellow-600' };
        if (percentage >= 40) return { grade: 'D', color: 'text-orange-600' };
        return { grade: 'F', color: 'text-red-600' };
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">🌐 Know Your Digital Footprint</h1>
                <p className="text-gray-600 mt-1">Presence audit across the internet (not rankings)</p>
            </div>

            {/* Input Section */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
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

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    {error}
                </div>
            )}

            {/* Results */}
            {result && result.domains && (
                <div className="space-y-6">
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
                    {result.domains.map((domain) => (
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
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-sm">
                                                {domain.profile.brandName}
                                            </span>
                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-sm">
                                                {domain.profile.businessType}
                                            </span>
                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-sm">
                                                {domain.profile.industry}
                                            </span>
                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-sm capitalize">
                                                {domain.profile.geoScope}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Score */}
                                    <div className="text-center">
                                        <div className={`text-4xl font-bold ${getGrade(domain.score.percentage).color}`}>
                                            {domain.score.percentage}
                                        </div>
                                        <div className="text-sm text-gray-500">/ 100</div>
                                        <div className={`text-2xl font-bold ${getGrade(domain.score.percentage).color}`}>
                                            {getGrade(domain.score.percentage).grade}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Content */}
                            {expandedDomain === domain.id && (
                                <div className="border-t">
                                    {Object.entries(groupByCategory(filterSurfaces(domain.surfaces))).map(([category, surfaces]) => (
                                        <div key={category} className="border-b last:border-b-0">
                                            {/* Category Header */}
                                            <div className="px-6 py-3 bg-gray-50 flex items-center gap-2">
                                                <span className="text-xl">{getCategoryIcon(category)}</span>
                                                <span className="font-semibold text-gray-700 capitalize">{category}</span>
                                                <span className="text-sm text-gray-500">({surfaces.length})</span>
                                            </div>

                                            {/* Surface Rows */}
                                            <div className="divide-y">
                                                {surfaces.map((surface) => (
                                                    <div key={surface.key} className="px-6 py-4 hover:bg-gray-50">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="font-medium text-gray-800">{surface.label}</span>
                                                                    <span className={`px-2 py-0.5 rounded text-xs border ${getStatusColor(surface.status)}`}>
                                                                        {surface.status.toUpperCase()}
                                                                    </span>
                                                                    <span className={`text-xs ${getRelevanceColor(surface.relevance)}`}>
                                                                        {surface.relevance} relevance
                                                                    </span>
                                                                </div>

                                                                {/* Tooltips */}
                                                                {surface.tooltips.action && (
                                                                    <p className="text-sm text-gray-500 mt-1">
                                                                        💡 {surface.tooltips.action}
                                                                    </p>
                                                                )}

                                                                {/* Evidence */}
                                                                {surface.evidence && surface.evidence.length > 0 && (
                                                                    <div className="mt-2 space-y-1">
                                                                        {surface.evidence.slice(0, 2).map((ev, i) => (
                                                                            <a
                                                                                key={i}
                                                                                href={ev.url}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="block text-xs text-blue-600 hover:underline truncate"
                                                                            >
                                                                                {ev.isOfficial ? '✓ ' : ''}{ev.title || ev.url}
                                                                            </a>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Points */}
                                                            <div className="text-right ml-4">
                                                                <div className="text-lg font-bold text-gray-800">
                                                                    {surface.pointsAwarded.toFixed(1)}
                                                                </div>
                                                                <div className="text-xs text-gray-400">
                                                                    / {surface.pointsMax.toFixed(1)} pts
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
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
