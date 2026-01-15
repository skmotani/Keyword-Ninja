'use client';

import { useState, useEffect, useMemo } from 'react';

interface DomainKeywordRecord {
    id: string;
    clientCode: string;
    domain: string;
    locationCode: string;
    keyword: string;
    position: number | null;
    searchVolume: number | null;
    cpc: number | null;
    url: string | null;
}

interface Client {
    code: string;
    name: string;
}

// Classification types
type RankBucket = 'Top' | 'Medium' | 'Low';
type VolumeBucket = 'High' | 'Low';
type OpportunityType =
    | 'Defensive / Core Asset'
    | 'Stable / Low Risk'
    | 'Low-Hanging Fruit'
    | 'Secondary Opportunity'
    | 'Strategic / Long-Term'
    | 'Ignore / Deprioritize';
type PriorityLevel = 'Critical' | 'Very High' | 'Medium-High' | 'Medium' | 'Low' | 'None';

interface ClassifiedKeyword extends DomainKeywordRecord {
    rankBucket: RankBucket;
    volumeBucket: VolumeBucket;
    opportunityType: OpportunityType;
    seoAction: string;
    priorityLevel: PriorityLevel;
}

// Classification logic
const getRankBucket = (position: number | null): RankBucket => {
    if (!position || position <= 10) return 'Top';
    if (position <= 30) return 'Medium';
    return 'Low';
};

const getOpportunityType = (rank: RankBucket, volume: VolumeBucket): OpportunityType => {
    if (rank === 'Top' && volume === 'High') return 'Defensive / Core Asset';
    if (rank === 'Top' && volume === 'Low') return 'Stable / Low Risk';
    if (rank === 'Medium' && volume === 'High') return 'Low-Hanging Fruit';
    if (rank === 'Medium' && volume === 'Low') return 'Secondary Opportunity';
    if (rank === 'Low' && volume === 'High') return 'Strategic / Long-Term';
    return 'Ignore / Deprioritize';
};

const getSeoAction = (type: OpportunityType): string => {
    const actions: Record<OpportunityType, string> = {
        'Defensive / Core Asset': 'Maintain ranking, monitor weekly, protect with internal links & content freshness',
        'Stable / Low Risk': 'No immediate action, periodic review only',
        'Low-Hanging Fruit': 'Priority optimization: on-page improvements, content depth, internal linking',
        'Secondary Opportunity': 'Selective optimization, include in content clusters, improve relevance',
        'Strategic / Long-Term': 'Authority building: backlinks, pillar pages, topical clusters',
        'Ignore / Deprioritize': 'No active SEO effort, consider for semantic coverage only'
    };
    return actions[type];
};

const getPriorityLevel = (type: OpportunityType): PriorityLevel => {
    const priorities: Record<OpportunityType, PriorityLevel> = {
        'Defensive / Core Asset': 'Critical',
        'Stable / Low Risk': 'Low',
        'Low-Hanging Fruit': 'Very High',
        'Secondary Opportunity': 'Medium',
        'Strategic / Long-Term': 'Medium-High',
        'Ignore / Deprioritize': 'None'
    };
    return priorities[type];
};

// Tooltip content
const TOOLTIPS: Record<OpportunityType, string> = {
    'Defensive / Core Asset': 'High-impact keywords already ranking on page 1. Any ranking loss here directly impacts traffic and revenue.',
    'Stable / Low Risk': 'Keywords are well-ranked but demand is limited. Maintain naturally without active investment.',
    'Low-Hanging Fruit': 'High-demand keywords ranking between positions 11–30. Small SEO improvements can unlock significant traffic gains.',
    'Secondary Opportunity': 'Moderate ranking keywords with lower demand. Useful for topical depth and incremental traffic growth.',
    'Strategic / Long-Term': 'High-demand keywords where visibility is currently weak. Requires sustained SEO investment but offers large upside.',
    'Ignore / Deprioritize': 'Low-demand keywords with poor rankings. Not worth active SEO investment.'
};

const RANK_TOOLTIPS: Record<RankBucket, string> = {
    'Top': 'Positions 1-10: Keywords ranking on page 1 of search results',
    'Medium': 'Positions 11-30: Keywords on pages 2-3, within striking distance of page 1',
    'Low': 'Positions 31+: Keywords requiring significant improvement to reach page 1'
};

const VOLUME_TOOLTIPS = {
    'High': 'Top 30% of search volume within this domain+location dataset (≥ P70)',
    'Low': 'Bottom 70% of search volume within this domain+location dataset (< P70)'
};

const PRIORITY_COLORS: Record<PriorityLevel, string> = {
    'Critical': 'bg-red-100 text-red-800 border-red-300',
    'Very High': 'bg-orange-100 text-orange-800 border-orange-300',
    'Medium-High': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'Medium': 'bg-blue-100 text-blue-800 border-blue-300',
    'Low': 'bg-gray-100 text-gray-600 border-gray-300',
    'None': 'bg-gray-50 text-gray-400 border-gray-200'
};

const OPPORTUNITY_COLORS: Record<OpportunityType, string> = {
    'Defensive / Core Asset': 'bg-purple-100 text-purple-800',
    'Stable / Low Risk': 'bg-gray-100 text-gray-700',
    'Low-Hanging Fruit': 'bg-green-100 text-green-800',
    'Secondary Opportunity': 'bg-blue-100 text-blue-700',
    'Strategic / Long-Term': 'bg-amber-100 text-amber-800',
    'Ignore / Deprioritize': 'bg-gray-50 text-gray-400'
};

export default function KeywordOpportunityMatrixPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClient, setSelectedClient] = useState<string>('');
    const [records, setRecords] = useState<DomainKeywordRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [domainFilter, setDomainFilter] = useState<string>('all');
    const [locationFilter, setLocationFilter] = useState<string>('all');
    const [opportunityFilter, setOpportunityFilter] = useState<OpportunityType | 'all'>('all');
    const [sortField, setSortField] = useState<'volume' | 'position' | 'priority'>('priority');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Fetch clients
    useEffect(() => {
        fetch('/api/clients')
            .then(res => res.json())
            .then(data => {
                const activeClients = (data.clients || []).filter((c: { isActive: boolean }) => c.isActive);
                setClients(activeClients);
                if (activeClients.length > 0 && !selectedClient) {
                    setSelectedClient(activeClients[0].code);
                }
            })
            .catch(console.error);
    }, []);

    // Fetch keywords when client changes
    useEffect(() => {
        if (!selectedClient) return;
        setLoading(true);
        fetch(`/api/domain-keywords?clientCode=${selectedClient}`)
            .then(res => res.json())
            .then(data => {
                setRecords(data.records || []);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [selectedClient]);

    // Get unique domains and locations
    const domains = useMemo(() => Array.from(new Set(records.map(r => r.domain))), [records]);
    const locations = useMemo(() => Array.from(new Set(records.map(r => r.locationCode))), [records]);

    // Filter records
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            if (domainFilter !== 'all' && r.domain !== domainFilter) return false;
            if (locationFilter !== 'all' && r.locationCode !== locationFilter) return false;
            return true;
        });
    }, [records, domainFilter, locationFilter]);

    // Calculate P70 threshold per domain+location
    const volumeThresholds = useMemo(() => {
        const thresholds: Record<string, number> = {};

        // Group by domain+location
        const groups: Record<string, number[]> = {};
        filteredRecords.forEach(r => {
            const key = `${r.domain}|${r.locationCode}`;
            if (!groups[key]) groups[key] = [];
            if (r.searchVolume && r.searchVolume > 0) {
                groups[key].push(r.searchVolume);
            }
        });

        // Calculate P70 for each group
        Object.entries(groups).forEach(([key, volumes]) => {
            if (volumes.length === 0) {
                thresholds[key] = 0;
                return;
            }
            const sorted = [...volumes].sort((a, b) => a - b);
            const p70Index = Math.floor(sorted.length * 0.70);
            thresholds[key] = sorted[p70Index] || sorted[sorted.length - 1];
        });

        return thresholds;
    }, [filteredRecords]);

    // Classify all keywords
    const classifiedKeywords = useMemo((): ClassifiedKeyword[] => {
        return filteredRecords
            .filter(r => r.position !== null) // Only classify keywords with position data
            .map(r => {
                const key = `${r.domain}|${r.locationCode}`;
                const p70 = volumeThresholds[key] || 0;
                const rankBucket = getRankBucket(r.position);
                const volumeBucket: VolumeBucket = (r.searchVolume || 0) >= p70 ? 'High' : 'Low';
                const opportunityType = getOpportunityType(rankBucket, volumeBucket);

                return {
                    ...r,
                    rankBucket,
                    volumeBucket,
                    opportunityType,
                    seoAction: getSeoAction(opportunityType),
                    priorityLevel: getPriorityLevel(opportunityType)
                };
            });
    }, [filteredRecords, volumeThresholds]);

    // Apply opportunity filter and sort
    const displayKeywords = useMemo(() => {
        let result = classifiedKeywords;

        if (opportunityFilter !== 'all') {
            result = result.filter(k => k.opportunityType === opportunityFilter);
        }

        // Sort
        const priorityOrder: Record<PriorityLevel, number> = {
            'Critical': 6, 'Very High': 5, 'Medium-High': 4, 'Medium': 3, 'Low': 2, 'None': 1
        };

        result.sort((a, b) => {
            let comparison = 0;
            if (sortField === 'volume') {
                comparison = (a.searchVolume || 0) - (b.searchVolume || 0);
            } else if (sortField === 'position') {
                comparison = (a.position || 999) - (b.position || 999);
            } else {
                comparison = priorityOrder[a.priorityLevel] - priorityOrder[b.priorityLevel];
            }
            return sortOrder === 'desc' ? -comparison : comparison;
        });

        return result;
    }, [classifiedKeywords, opportunityFilter, sortField, sortOrder]);

    // Summary stats
    const summaryStats = useMemo(() => {
        const counts: Record<OpportunityType, number> = {
            'Defensive / Core Asset': 0,
            'Stable / Low Risk': 0,
            'Low-Hanging Fruit': 0,
            'Secondary Opportunity': 0,
            'Strategic / Long-Term': 0,
            'Ignore / Deprioritize': 0
        };
        classifiedKeywords.forEach(k => counts[k.opportunityType]++);
        return counts;
    }, [classifiedKeywords]);

    // Tooltip component
    const Tooltip = ({ content, children }: { content: string; children: React.ReactNode }) => (
        <div className="group relative inline-block">
            {children}
            <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                {content}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Keyword Opportunity Matrix</h1>
                    <p className="text-gray-600 mt-1">Classify keywords by position rank and volume percentile to prioritize SEO actions</p>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Client</label>
                            <select
                                value={selectedClient}
                                onChange={e => setSelectedClient(e.target.value)}
                                className="border rounded px-3 py-1.5 text-sm min-w-[150px]"
                            >
                                {clients.map(c => (
                                    <option key={c.code} value={c.code}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Domain</label>
                            <select
                                value={domainFilter}
                                onChange={e => setDomainFilter(e.target.value)}
                                className="border rounded px-3 py-1.5 text-sm min-w-[180px]"
                            >
                                <option value="all">All Domains</option>
                                {domains.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Location</label>
                            <select
                                value={locationFilter}
                                onChange={e => setLocationFilter(e.target.value)}
                                className="border rounded px-3 py-1.5 text-sm"
                            >
                                <option value="all">All Locations</option>
                                {locations.map(l => (
                                    <option key={l} value={l}>{l}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Opportunity Type</label>
                            <select
                                value={opportunityFilter}
                                onChange={e => setOpportunityFilter(e.target.value as OpportunityType | 'all')}
                                className="border rounded px-3 py-1.5 text-sm min-w-[180px]"
                            >
                                <option value="all">All Types</option>
                                <option value="Defensive / Core Asset">Defensive / Core Asset</option>
                                <option value="Low-Hanging Fruit">Low-Hanging Fruit</option>
                                <option value="Strategic / Long-Term">Strategic / Long-Term</option>
                                <option value="Secondary Opportunity">Secondary Opportunity</option>
                                <option value="Stable / Low Risk">Stable / Low Risk</option>
                                <option value="Ignore / Deprioritize">Ignore / Deprioritize</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Sort By</label>
                            <select
                                value={sortField}
                                onChange={e => setSortField(e.target.value as 'volume' | 'position' | 'priority')}
                                className="border rounded px-3 py-1.5 text-sm"
                            >
                                <option value="priority">Priority</option>
                                <option value="volume">Volume</option>
                                <option value="position">Position</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Order</label>
                            <select
                                value={sortOrder}
                                onChange={e => setSortOrder(e.target.value as 'asc' | 'desc')}
                                className="border rounded px-3 py-1.5 text-sm"
                            >
                                <option value="desc">High → Low</option>
                                <option value="asc">Low → High</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                    {(Object.entries(summaryStats) as [OpportunityType, number][]).map(([type, count]) => (
                        <Tooltip key={type} content={TOOLTIPS[type]}>
                            <div
                                className={`rounded-lg p-3 border cursor-pointer transition-all hover:shadow-md ${opportunityFilter === type ? 'ring-2 ring-indigo-500' : ''
                                    } ${OPPORTUNITY_COLORS[type]}`}
                                onClick={() => setOpportunityFilter(opportunityFilter === type ? 'all' : type)}
                            >
                                <div className="text-2xl font-bold">{count}</div>
                                <div className="text-xs truncate">{type}</div>
                            </div>
                        </Tooltip>
                    ))}
                </div>

                {/* Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Loading keywords...</div>
                    ) : displayKeywords.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">No keywords found</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Domain</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loc</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Keyword</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Volume</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Vol Bucket</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Position</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rank Bucket</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Opportunity</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Priority</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SEO Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {displayKeywords.slice(0, 200).map((kw, idx) => (
                                        <tr key={kw.id || idx} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 text-gray-600 truncate max-w-[120px]" title={kw.domain}>{kw.domain}</td>
                                            <td className="px-4 py-2 text-gray-500">{kw.locationCode}</td>
                                            <td className="px-4 py-2 font-medium text-gray-900 max-w-[200px] truncate" title={kw.keyword}>{kw.keyword}</td>
                                            <td className="px-4 py-2 text-right text-gray-600">{(kw.searchVolume || 0).toLocaleString()}</td>
                                            <td className="px-4 py-2 text-center">
                                                <Tooltip content={VOLUME_TOOLTIPS[kw.volumeBucket]}>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${kw.volumeBucket === 'High' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        {kw.volumeBucket}
                                                    </span>
                                                </Tooltip>
                                            </td>
                                            <td className="px-4 py-2 text-right text-gray-600">{kw.position}</td>
                                            <td className="px-4 py-2 text-center">
                                                <Tooltip content={RANK_TOOLTIPS[kw.rankBucket]}>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${kw.rankBucket === 'Top' ? 'bg-blue-100 text-blue-700' :
                                                        kw.rankBucket === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                                            'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        {kw.rankBucket}
                                                    </span>
                                                </Tooltip>
                                            </td>
                                            <td className="px-4 py-2">
                                                <Tooltip content={TOOLTIPS[kw.opportunityType]}>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${OPPORTUNITY_COLORS[kw.opportunityType]}`}>
                                                        {kw.opportunityType}
                                                    </span>
                                                </Tooltip>
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <span className={`px-2 py-0.5 rounded border text-xs font-medium ${PRIORITY_COLORS[kw.priorityLevel]}`}>
                                                    {kw.priorityLevel}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-xs text-gray-600 max-w-[250px]" title={kw.seoAction}>
                                                {kw.seoAction.length > 60 ? kw.seoAction.substring(0, 60) + '...' : kw.seoAction}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {displayKeywords.length > 200 && (
                                <div className="p-4 text-center text-sm text-gray-500 border-t">
                                    Showing 200 of {displayKeywords.length} keywords
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Legend */}
                <div className="mt-6 bg-white rounded-lg shadow p-4">
                    <h3 className="font-semibold text-gray-800 mb-3">Opportunity Matrix Legend</h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        {(Object.entries(TOOLTIPS) as [OpportunityType, string][]).map(([type, tooltip]) => (
                            <div key={type} className="flex gap-2">
                                <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium h-fit ${OPPORTUNITY_COLORS[type]}`}>
                                    {type.split(' / ')[0]}
                                </span>
                                <span className="text-gray-600 text-xs">{tooltip}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
