'use client';

import React, { useState, useEffect, useMemo } from 'react';

// Types
interface DomainKeyword {
    keyword: string;
    domain: string;
    clientCode: string;
    position: number;
    searchVolume: number;
    locationCode?: string;
}

interface Client {
    code: string;
    name: string;
    mainDomain: string;
    domains?: string[];
}

interface AIProfile {
    clientCode: string;
    ai_kw_builder_term_dictionary?: {
        terms?: Record<string, { name?: string; term?: string; bucket?: string }>;
    };
}

interface QuadrantKeyword {
    keyword: string;
    volume: number;
    rank: number;
    bucket: string;
    quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4';
}

// Quadrant colors
const QUADRANT_COLORS = {
    Q1: '#22c55e', // Green - High Vol + High Rank (best)
    Q2: '#f59e0b', // Orange - High Vol + Low Rank (opportunity)
    Q3: '#3b82f6', // Blue - Low Vol + High Rank (niche wins)
    Q4: '#ef4444', // Red - Low Vol + Low Rank (deprioritize)
};

// Quadrant action labels with emojis
const QUADRANT_ACTIONS = {
    Q1: { emoji: '🛡️', label: 'Defend & Scale', caption: 'Protect rankings, lift CTR, expand coverage.' },
    Q2: { emoji: '⚔️', label: 'Attack (Top Priority)', caption: 'Fix intent + strengthen page + links to break into Top 10.' },
    Q3: { emoji: '🌾', label: 'Harvest & Optimize', caption: 'Maintain with light effort, improve conversions, interlink to winners.' },
    Q4: { emoji: '🧊', label: 'Deprioritize / Reframe', caption: 'Ignore, merge, or retarget long-tail where you can win faster.' },
};

// Bucket colors for display (using normalized bucket names)
const BUCKET_COLORS: Record<string, string> = {
    'Include | Buy': '#22c55e',  // Green - transactional
    'Include | Learn': '#3b82f6', // Blue - informational
    'Brand | Nav': '#8b5cf6',    // Purple - brand
};

export default function Preview2x2Page() {
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientCode, setSelectedClientCode] = useState<string>('');
    const [domainKeywords, setDomainKeywords] = useState<DomainKeyword[]>([]);
    const [aiProfiles, setAiProfiles] = useState<AIProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetchTimestamp, setFetchTimestamp] = useState<string>('');
    const [expandedQuadrant, setExpandedQuadrant] = useState<string | null>(null);

    // Fetch clients on mount
    useEffect(() => {
        fetch('/api/clients')
            .then(res => res.json())
            .then(data => {
                setClients(data.clients || data || []);
            })
            .catch(console.error);
    }, []);

    // Fetch AI profiles on mount
    useEffect(() => {
        fetch('/api/client-ai-profiles')
            .then(res => res.json())
            .then(data => {
                setAiProfiles(data.profiles || data || []);
            })
            .catch(console.error);
    }, []);

    // Fetch domain keywords when client changes
    useEffect(() => {
        if (!selectedClientCode) return;

        setLoading(true);
        fetch(`/api/keywords/domain-keywords?clientCode=${selectedClientCode}`)
            .then(res => res.json())
            .then(data => {
                setDomainKeywords(data.keywords || data || []);
                setFetchTimestamp(new Date().toISOString());
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [selectedClientCode]);

    // Get selected client's self domains
    const selfDomains = useMemo(() => {
        const client = clients.find(c => c.code === selectedClientCode);
        if (!client) return new Set<string>();

        const domains = [client.mainDomain, ...(client.domains || [])];
        return new Set(domains.map(d =>
            d?.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase().replace(/\/$/, '')
        ).filter(Boolean));
    }, [clients, selectedClientCode]);

    // Get keyword bucket mapping from AI profile
    const keywordBuckets = useMemo(() => {
        const profile = aiProfiles.find(p => p.clientCode === selectedClientCode);
        const terms = profile?.ai_kw_builder_term_dictionary?.terms || {};

        const bucketMap = new Map<string, string>();
        for (const [, term] of Object.entries(terms)) {
            const termName = (term.name || term.term || '').toLowerCase();
            const bucket = term.bucket || 'unassigned';
            if (termName) {
                bucketMap.set(termName, bucket);
            }
        }
        return bucketMap;
    }, [aiProfiles, selectedClientCode]);

    // Normalize bucket names to the 4 valid buckets
    const normalizeBucket = (bucket: string): string => {
        const b = bucket.toLowerCase().trim();
        if (b === 'include' || b === 'include | buy' || b === 'include|buy') return 'Include | Buy';
        if (b === 'review' || b === 'include | learn' || b === 'include|learn') return 'Include | Learn';
        if (b === 'brand' || b === 'brand | nav' || b === 'brand|nav') return 'Brand | Nav';
        if (b === 'exclude' || b === 'exclude | noise' || b === 'exclude|noise' || b === 'noise') return 'Exclude | Noise';
        return 'Unassigned';
    };

    // Excluded buckets (using normalized names)
    const EXCLUDED_BUCKETS = ['Exclude | Noise', 'Unassigned'];

    // Get bucket for a keyword
    const getBucket = (keyword: string): string => {
        const kw = keyword.toLowerCase();
        // Check exact match first
        if (keywordBuckets.has(kw)) {
            return normalizeBucket(keywordBuckets.get(kw)!);
        }
        // Check if keyword contains any term
        for (const [term, bucket] of Array.from(keywordBuckets.entries())) {
            if (kw.includes(term)) {
                return normalizeBucket(bucket);
            }
        }
        return 'Unassigned';
    };

    // Filter and process data
    const { filteredData, p70, quadrants, totals, includedBuckets } = useMemo(() => {
        if (!domainKeywords.length || !selfDomains.size) {
            return { filteredData: [], p70: 0, quadrants: { q1: [], q2: [], q3: [], q4: [] }, totals: { q1: 0, q2: 0, q3: 0, q4: 0, total: 0 }, includedBuckets: new Set<string>() };
        }

        // Filter for SELF domain with valid ranks and non-excluded buckets
        const filtered: { keyword: string; volume: number; rank: number; bucket: string }[] = [];
        const bucketsFound = new Set<string>();

        for (const dk of domainKeywords) {
            const normalizedDomain = dk.domain?.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase().replace(/\/$/, '');
            const isSelf = selfDomains.has(normalizedDomain);
            const hasValidRank = dk.position && Number.isInteger(dk.position) && dk.position > 0;

            if (!isSelf || !hasValidRank) continue;

            const bucket = getBucket(dk.keyword);

            // Exclude noise and unassigned buckets
            if (EXCLUDED_BUCKETS.includes(bucket)) continue;

            bucketsFound.add(bucket);
            filtered.push({
                keyword: dk.keyword,
                volume: dk.searchVolume || 0,
                rank: dk.position,
                bucket: bucket,
            });
        }

        if (filtered.length === 0) {
            return { filteredData: [], p70: 0, quadrants: { q1: [], q2: [], q3: [], q4: [] }, totals: { q1: 0, q2: 0, q3: 0, q4: 0, total: 0 }, includedBuckets: bucketsFound };
        }

        // Calculate P70 (top 30% threshold)
        const volumes = filtered.map(f => f.volume).sort((a, b) => a - b);
        const n = volumes.length;
        const index = Math.max(0, Math.min(n - 1, Math.ceil(0.70 * n) - 1));
        const p70Value = volumes[index];

        // Assign quadrants
        const q1: QuadrantKeyword[] = [];
        const q2: QuadrantKeyword[] = [];
        const q3: QuadrantKeyword[] = [];
        const q4: QuadrantKeyword[] = [];

        for (const kw of filtered) {
            const isHighVolume = kw.volume >= p70Value;
            const isHighRank = kw.rank >= 1 && kw.rank <= 10;

            let quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4';
            if (isHighVolume && isHighRank) {
                quadrant = 'Q1';
                q1.push({ ...kw, quadrant });
            } else if (isHighVolume && !isHighRank) {
                quadrant = 'Q2';
                q2.push({ ...kw, quadrant });
            } else if (!isHighVolume && isHighRank) {
                quadrant = 'Q3';
                q3.push({ ...kw, quadrant });
            } else {
                quadrant = 'Q4';
                q4.push({ ...kw, quadrant });
            }
        }

        // Sort each quadrant by volume DESC, rank ASC
        const sortFn = (a: QuadrantKeyword, b: QuadrantKeyword) => {
            if (b.volume !== a.volume) return b.volume - a.volume;
            return a.rank - b.rank;
        };
        q1.sort(sortFn);
        q2.sort(sortFn);
        q3.sort(sortFn);
        q4.sort(sortFn);

        return {
            filteredData: filtered,
            p70: p70Value,
            quadrants: { q1, q2, q3, q4 },
            totals: { q1: q1.length, q2: q2.length, q3: q3.length, q4: q4.length, total: filtered.length },
            includedBuckets: bucketsFound
        };
    }, [domainKeywords, selfDomains, keywordBuckets]);

    // JSON output for validation
    const jsonOutput = useMemo(() => ({
        title: "2x2 KW / Volume Analysis for Self",
        p70,
        includedBuckets: Array.from(includedBuckets),
        totals,
        quadrants: {
            q1: quadrants.q1.slice(0, 50),
            q2: quadrants.q2.slice(0, 50),
            q3: quadrants.q3.slice(0, 50),
            q4: quadrants.q4.slice(0, 50),
        }
    }), [p70, totals, quadrants, includedBuckets]);

    // Bucket badge component
    const BucketBadge = ({ bucket }: { bucket: string }) => {
        const color = BUCKET_COLORS[bucket.toLowerCase()] || '#6b7280';
        return (
            <span
                className="px-1.5 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: `${color}20`, color }}
            >
                {bucket}
            </span>
        );
    };

    // Quadrant Card Component
    const QuadrantCard = ({
        title,
        quadrantKey,
        data,
        color
    }: {
        title: string;
        quadrantKey: string;
        data: QuadrantKeyword[];
        color: string;
    }) => {
        const isExpanded = expandedQuadrant === quadrantKey;
        const displayData = isExpanded ? data : data.slice(0, 15);
        const action = QUADRANT_ACTIONS[quadrantKey.toUpperCase() as keyof typeof QUADRANT_ACTIONS];

        return (
            <div className="bg-white rounded-xl border-2 shadow-sm overflow-hidden" style={{ borderColor: color }}>
                <div className="p-4" style={{ backgroundColor: `${color}15` }}>
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-lg flex items-center gap-2" style={{ color }}>
                                <span className="text-xl">{action?.emoji}</span>
                                {title}
                            </h3>
                            {action && (
                                <p className="text-xs text-gray-600 mt-1" title={action.caption}>
                                    <span className="font-medium" style={{ color }}>{action.label}</span>
                                    <span className="mx-1">—</span>
                                    <span className="text-gray-500">{action.caption}</span>
                                </p>
                            )}
                        </div>
                        <span className="text-2xl font-bold" style={{ color }}>{data.length}</span>
                    </div>
                </div>
                <div className="p-4">
                    {data.length === 0 ? (
                        <p className="text-gray-400 italic text-sm">No keywords</p>
                    ) : (
                        <>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-2 font-medium text-gray-600">Keyword</th>
                                        <th className="text-left py-2 font-medium text-gray-600">Bucket</th>
                                        <th className="text-right py-2 font-medium text-gray-600">Vol</th>
                                        <th className="text-right py-2 font-medium text-gray-600">Rank</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayData.map((kw, i) => (
                                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="py-1.5 text-gray-800 truncate max-w-[150px]" title={kw.keyword}>{kw.keyword}</td>
                                            <td className="py-1.5"><BucketBadge bucket={kw.bucket} /></td>
                                            <td className="py-1.5 text-right text-gray-600">{kw.volume.toLocaleString()}</td>
                                            <td className="py-1.5 text-right font-mono text-gray-600">{kw.rank}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {data.length > 15 && (
                                <button
                                    onClick={() => setExpandedQuadrant(isExpanded ? null : quadrantKey)}
                                    className="mt-3 text-sm font-medium hover:underline"
                                    style={{ color }}
                                >
                                    {isExpanded ? 'Show less' : `View all ${data.length}`}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <h1 className="text-2xl font-bold text-indigo-600 mb-2">2x2 KW / Volume Analysis for Self</h1>
                    <p className="text-gray-500 text-sm mb-4">PREVIEW ONLY - Quadrant analysis of keywords where your domain is ranking (excluding Noise & Unassigned)</p>

                    {/* Client Selector */}
                    <div className="flex items-center gap-4 mb-4">
                        <label className="font-medium text-gray-700">Select Client:</label>
                        <select
                            value={selectedClientCode}
                            onChange={(e) => setSelectedClientCode(e.target.value)}
                            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">-- Select --</option>
                            {clients.map(c => (
                                <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                            ))}
                        </select>
                        {loading && <span className="text-indigo-600">Loading...</span>}
                    </div>

                    {/* Summary Strip */}
                    {selectedClientCode && !loading && (
                        <div className="flex flex-wrap gap-4 text-sm">
                            <span className="bg-gray-100 px-3 py-1 rounded-full">
                                <strong>Total Keywords:</strong> {totals.total}
                            </span>
                            <span className="bg-gray-100 px-3 py-1 rounded-full">
                                <strong>P70 Threshold:</strong> {p70.toLocaleString()}
                            </span>
                            <span className="bg-gray-100 px-3 py-1 rounded-full">
                                <strong>High Rank:</strong> 1-10
                            </span>
                            <span className="bg-gray-100 px-3 py-1 rounded-full">
                                <strong>Low Rank:</strong> &gt;10
                            </span>
                            <span className="bg-gray-100 px-3 py-1 rounded-full">
                                <strong>Fetched:</strong> {fetchTimestamp ? new Date(fetchTimestamp).toLocaleTimeString() : '-'}
                            </span>
                        </div>
                    )}

                    {/* Included Buckets */}
                    {selectedClientCode && !loading && includedBuckets.size > 0 && (
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">Included Buckets:</span>
                            {Array.from(includedBuckets).map(bucket => (
                                <BucketBadge key={bucket} bucket={bucket} />
                            ))}
                        </div>
                    )}
                </div>

                {/* 2x2 Matrix Grid */}
                {selectedClientCode && totals.total > 0 && (
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">2x2 Quadrant Matrix</h2>
                        <div className="grid grid-cols-2 gap-4">
                            {/* Row 1: High Volume */}
                            <QuadrantCard
                                title="Q2: High Vol + Low Rank"
                                quadrantKey="q2"
                                data={quadrants.q2}
                                color={QUADRANT_COLORS.Q2}
                            />
                            <QuadrantCard
                                title="Q1: High Vol + High Rank"
                                quadrantKey="q1"
                                data={quadrants.q1}
                                color={QUADRANT_COLORS.Q1}
                            />
                            {/* Row 2: Low Volume */}
                            <QuadrantCard
                                title="Q4: Low Vol + Low Rank"
                                quadrantKey="q4"
                                data={quadrants.q4}
                                color={QUADRANT_COLORS.Q4}
                            />
                            <QuadrantCard
                                title="Q3: Low Vol + High Rank"
                                quadrantKey="q3"
                                data={quadrants.q3}
                                color={QUADRANT_COLORS.Q3}
                            />
                        </div>
                        <div className="mt-4 text-xs text-gray-500 text-center">
                            Y-axis: High Volume (top) / Low Volume (bottom) | X-axis: Low Rank (left) / High Rank (right)
                        </div>
                    </div>
                )}

                {/* Raw JSON Output */}
                {selectedClientCode && totals.total > 0 && (
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">Raw JSON Output (Validation)</h2>
                        <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96 text-xs">
                            {JSON.stringify(jsonOutput, null, 2)}
                        </pre>
                    </div>
                )}

                {/* No Data State */}
                {selectedClientCode && !loading && totals.total === 0 && (
                    <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                        <p className="text-gray-500">No keywords found where your domain is ranking (after excluding Noise & Unassigned).</p>
                        <p className="text-sm text-gray-400 mt-2">Self domains: {Array.from(selfDomains).join(', ') || 'None'}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
