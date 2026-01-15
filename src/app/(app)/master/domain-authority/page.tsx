'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';

// Types
interface Client { id: string; code: string; name: string; domains?: string[]; isActive: boolean; }
interface Competitor { id: string; clientCode: string; name: string; domain: string; isActive: boolean; competitionType?: string; competitorForProducts?: string[]; }
interface CredibilityRecord {
    id: string; clientCode: string; domain: string; domainType: 'client' | 'competitor';
    domainAgeYears: number | null; referringDomains: number | null; totalBacklinks: number | null;
    dofollowBacklinks: number | null; nofollowBacklinks: number | null;
    organicTraffic: number | null; organicCost: number | null;
    organicKeywordsCount: number | null; paidKeywordsCount: number | null;
    organicTop3: number | null; organicTop10: number | null; organicTop100: number | null;
    keywordVisibilityScore: number | null; paidTraffic: number | null; paidCost: number | null;
    fetchedAt: string; errors: string[];
}
interface DomainEntry {
    domain: string; cleanDomain: string; type: 'client' | 'competitor'; label?: string;
    selected: boolean; storedData: CredibilityRecord | null;
    needsWhois: boolean; needsBacklinks: boolean; needsLabs: boolean; estimatedCost: number;
    competitionType?: string; competitorForProducts?: string[];
}
interface FetchPlan {
    totalDomains: number; domainsNeedingFetch: number; domainsComplete: number;
    apiCalls: { whois: number; backlinks: number; labs: number; total: number };
    cost: { whois: number; backlinks: number; labs: number; total: number };
}
interface ApiLog { id: string; timestamp: string; apiType: string; domain?: string; cost: number; success: boolean; }

// Pricing
const API_PRICING = { whois: { perDomain: 0.101 }, backlinks: { perDomain: 0.020 }, labs: { perDomain: 0.101 }, fullDomain: 0.222 };

// Column Tooltips - Detailed DataForSEO metric descriptions
const COLUMNS: Record<string, { t: string; d: string; details: string; e: string; c?: string; sortKey?: string; source?: string }> = {
    domain: {
        t: 'Domain',
        d: 'Website domain being analyzed',
        details: 'The root domain name without protocol or path. Used as the target for all API calls.',
        e: 'example.com',
        sortKey: 'domain'
    },
    type: {
        t: 'Type',
        d: 'Domain classification',
        details: 'C = Your client\'s domain (highlighted in blue)\nX = Competitor domain\n\nClient domains are defined in Client Master, competitors in Competitor Master.',
        e: 'C or X',
        sortKey: 'type'
    },
    age: {
        t: 'Domain Age',
        d: 'Years since domain registration',
        details: 'Calculated from WHOIS creation date.\n\n• Older domains (10+ years) typically have more authority\n• New domains (<1 year) may struggle to rank\n• Age alone doesn\'t guarantee rankings, but is a trust signal',
        e: '15.2 years',
        c: '$0.101 (Whois API)',
        sortKey: 'age',
        source: 'domain_analytics/whois/overview'
    },
    rd: {
        t: 'Referring Domains (RD)',
        d: 'Count of unique domains linking to this site',
        details: 'The number of unique root domains that contain at least one backlink to the target.\n\n• Key SEO metric - more important than total backlinks\n• Quality matters: 100 links from 100 domains > 1000 links from 10 domains\n• Industry benchmark: Top 10 rankings often have 50+ RDs',
        e: '1,234 domains',
        c: '$0.020 (Backlinks API)',
        sortKey: 'rd',
        source: 'backlinks/summary'
    },
    bl: {
        t: 'Total Backlinks',
        d: 'Total number of incoming links',
        details: 'Sum of all backlinks pointing to the target domain from external sources.\n\n• Includes all link types (dofollow, nofollow, sponsored, ugc)\n• High numbers can indicate popularity OR spam\n• Compare with referring domains ratio',
        e: '15,000 links',
        c: '$0.020 (Backlinks API)',
        sortKey: 'bl',
        source: 'backlinks/summary'
    },
    df: {
        t: 'Dofollow Backlinks',
        d: 'Links that pass PageRank / SEO value',
        details: 'Backlinks without rel="nofollow" attribute.\n\n• These links pass "link juice" to the target\n• Most valuable for SEO\n• Healthy ratio: 70-90% dofollow is normal\n• 100% dofollow may indicate unnatural link profile',
        e: '10,000 links',
        c: '$0.020 (Backlinks API)',
        sortKey: 'df',
        source: 'backlinks/summary'
    },
    traffic: {
        t: 'Estimated Organic Traffic',
        d: 'Monthly organic visitors from Google',
        details: 'Estimated monthly organic search traffic based on:\n• Ranking positions for all tracked keywords\n• Search volume of each keyword\n• Expected CTR for each position\n\n• Does NOT include direct, referral, or paid traffic\n• Accuracy: ±30-50% compared to actual Analytics',
        e: '25,000/month',
        c: '$0.101 (Labs API)',
        sortKey: 'traffic',
        source: 'dataforseo_labs/domain_rank_overview'
    },
    etv: {
        t: 'Estimated Traffic Value (ETV)',
        d: 'Monthly value of organic traffic in USD',
        details: 'What you would pay for equivalent traffic via Google Ads.\n\nCalculation:\nΣ (Traffic per keyword × CPC of that keyword)\n\n• Higher ETV = More valuable keywords\n• Useful for ROI analysis\n• Compare with actual PPC spend',
        e: '$5,200/month',
        c: '$0.101 (Labs API)',
        sortKey: 'etv',
        source: 'dataforseo_labs/domain_rank_overview'
    },
    vis: {
        t: 'Visibility Score',
        d: 'Keyword ranking strength (0-100)',
        details: 'Custom calculated score based on keyword positions:\n\n• Position 1: 100 points\n• Position 2-3: 70 points\n• Position 4-10: 40 points\n• Position 11-20: 20 points\n• Position 21+: Diminishing points\n\nScore = (Weighted sum / Max possible) × 100\n\n• 50+: Strong visibility\n• 20-50: Moderate\n• <20: Weak presence',
        e: '45.2 (moderate)',
        c: '$0.101 (Labs API)',
        sortKey: 'vis',
        source: 'Calculated from position data'
    },
    rank: {
        t: 'Ranking Distribution',
        d: 'Keywords by position bucket',
        details: 'Shows how many keywords rank in each position range:\n\nTop 3 / Top 10 / Top 100\n\nExample: 18/66/214 means:\n• 18 keywords in positions 1-3 (high visibility)\n• 66 keywords in positions 1-10 (first page)\n• 214 keywords in positions 1-100 (total tracked)\n\nIdeal: High Top 3/Top 10 ratio',
        e: '18/66/214',
        c: '$0.101 (Labs API)',
        sortKey: 'top10',
        source: 'dataforseo_labs/domain_rank_overview'
    },
    cost: {
        t: 'Fetch Cost',
        d: 'API cost to fetch missing data',
        details: 'Smart fetch only calls APIs for missing data:\n\n• Whois (Age): $0.101\n• Backlinks (RD, BL, DF): $0.020\n• Labs (Traffic, ETV, Vis, Rank): $0.101\n\nFull fetch: $0.222/domain\n\nFREE = All data already fetched',
        e: '$0.10 or FREE',
        sortKey: 'cost'
    },
    status: {
        t: 'Data Status',
        d: 'Completeness of fetched data',
        details: '✓ Complete: All 3 APIs fetched successfully\n◐ Partial: Some APIs fetched, others missing\n○ Not fetched: No data yet\n\nPartial data shows which APIs are missing:\n• Age = Whois needed\n• BL = Backlinks needed\n• KW = Labs needed',
        e: '✓ or ◐ or ○',
        sortKey: 'status'
    },
};

type SortKey = 'domain' | 'type' | 'age' | 'rd' | 'bl' | 'df' | 'traffic' | 'etv' | 'vis' | 'top3' | 'top10' | 'top100' | 'cost' | 'status';

// Helpers
const clean = (d: string) => d.toLowerCase().trim().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
const fmt = (n: number | null | undefined) => n == null ? '-' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toLocaleString();
const fmtUSD = (n: number | null | undefined) => n == null ? '-' : '$' + (n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(0));

function analyzeData(d: CredibilityRecord | null) {
    if (!d) return { hasWhois: false, hasBacklinks: false, hasLabs: false };
    return {
        hasWhois: d.domainAgeYears !== null,
        hasBacklinks: d.referringDomains !== null && d.totalBacklinks !== null,
        hasLabs: d.organicKeywordsCount !== null,
    };
}

// Tooltip Component - Shows detailed metric info in a popup
function Tip({ k }: { k: string }) {
    const [show, setShow] = useState(false);
    const info = COLUMNS[k];
    if (!info) return null;

    return (
        <>
            <span
                className="cursor-help text-blue-400 hover:text-blue-600 text-[10px] ml-1"
                onClick={() => setShow(true)}
            >
                ⓘ
            </span>
            {show && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30" onClick={() => setShow(false)}>
                    <div
                        className="bg-white rounded-lg shadow-2xl w-96 max-w-[90vw] overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex justify-between items-center">
                            <h3 className="text-white font-bold text-sm">{info.t}</h3>
                            <button onClick={() => setShow(false)} className="text-white/80 hover:text-white text-lg">✕</button>
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-3 text-left">
                            {/* Summary */}
                            <div className="text-gray-600 text-sm">{info.d}</div>

                            {/* Details */}
                            <div className="bg-gray-50 rounded p-3 text-xs text-gray-700 whitespace-pre-line leading-relaxed text-left">
                                {info.details}
                            </div>

                            {/* Example */}
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-500">Example:</span>
                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-mono">{info.e}</span>
                            </div>

                            {/* API Cost & Source */}
                            <div className="flex flex-wrap gap-2 text-xs pt-2 border-t">
                                {info.c && (
                                    <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                                        💰 {info.c}
                                    </span>
                                )}
                                {info.source && (
                                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-mono text-[10px]">
                                        📡 {info.source}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// Pricing Info Tooltip
function PricingInfo() {
    const [show, setShow] = useState(false);
    return (
        <span className="relative">
            <button className="text-xs text-gray-500 hover:text-blue-600 ml-2" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>💰 Pricing</button>
            {show && (
                <div className="absolute z-[100] w-72 p-3 bg-gray-900 text-white text-xs rounded shadow-xl left-0 top-6">
                    <div className="font-bold text-yellow-300 mb-2">DataForSEO API Pricing</div>
                    <div className="space-y-1">
                        <div className="flex justify-between"><span className="text-blue-300">Whois API:</span><span>$0.101/domain</span></div>
                        <div className="flex justify-between"><span className="text-purple-300">Backlinks API:</span><span>$0.020/domain</span></div>
                        <div className="flex justify-between"><span className="text-green-300">Labs API:</span><span>$0.101/domain</span></div>
                        <div className="border-t border-gray-700 pt-1 mt-1 flex justify-between font-bold"><span>Full Fetch:</span><span className="text-yellow-300">$0.222/domain</span></div>
                    </div>
                    <div className="mt-2 text-gray-400 text-[9px]">Smart Fetch only calls APIs for missing data!</div>
                    <div className="absolute -top-1 left-3 w-2 h-2 bg-gray-900 rotate-45"></div>
                </div>
            )}
        </span>
    );
}

// Balance Widget with API Logs
function BalanceWidget({ refresh }: { refresh: number }) {
    const [data, setData] = useState<{ balance: number; domainsAffordable: number; totals: any; recentLogs: ApiLog[] } | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [showLogs, setShowLogs] = useState(false);

    useEffect(() => {
        fetch('/api/dataforseo/usage').then(r => r.json()).then(d => d.success && setData(d)).catch(() => { });
    }, [refresh]);

    if (!data) return <div className="text-xs text-gray-400 p-2 border rounded">Loading...</div>;
    const low = data.balance < 5, critical = data.balance < 1;

    return (
        <div className={`rounded border text-xs ${critical ? 'bg-red-50 border-red-300' : low ? 'bg-yellow-50 border-yellow-300' : 'bg-green-50 border-green-200'}`}>
            <div className="p-2 flex items-center gap-2">
                <span className={`font-bold text-lg ${critical ? 'text-red-600' : low ? 'text-yellow-600' : 'text-green-600'}`}>${data.balance?.toFixed(2)}</span>
                <span className="text-gray-500">Balance</span>
                <button onClick={() => setExpanded(!expanded)} className="ml-auto text-gray-400">{expanded ? '▲' : '▼'}</button>
            </div>
            {expanded && (
                <div className="px-2 pb-2 border-t space-y-1">
                    <div className="flex justify-between pt-1"><span>Can fetch:</span><span className="font-bold">~{data.domainsAffordable} domains</span></div>
                    <div className="flex justify-between"><span>Total spent:</span><span>${data.totals?.allTimeCost?.toFixed(2) || '0'}</span></div>
                    <div className="flex justify-between"><span>Total calls:</span><span>{data.totals?.allTimeCalls || 0}</span></div>
                    <button onClick={() => setShowLogs(!showLogs)} className="text-blue-500 text-[10px]">{showLogs ? '▼ Hide' : '▶ Show'} API Logs</button>
                    {showLogs && data.recentLogs && (
                        <div className="max-h-32 overflow-y-auto bg-white rounded p-1 text-[9px] border">
                            {data.recentLogs.length === 0 ? <div className="text-gray-400">No logs yet</div> : data.recentLogs.map(log => (
                                <div key={log.id} className="flex justify-between py-0.5 border-b">
                                    <span className="truncate">{log.domain || log.apiType}</span>
                                    <span className={log.success ? 'text-green-600' : 'text-red-600'}>${log.cost.toFixed(3)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {critical && <div className="px-2 pb-1 text-red-600 text-[10px]">⚠️ Balance low!</div>}
        </div>
    );
}

// Confirmation Dialog
function ConfirmDialog({ plan, balance, isReset, onConfirm, onCancel }: { plan: FetchPlan; balance: number | null; isReset: boolean; onConfirm: () => void; onCancel: () => void }) {
    const canAfford = balance === null || balance >= plan.cost.total;
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-5 max-w-md w-full mx-4">
                <h3 className="text-lg font-bold mb-3">{isReset ? '⚠️ Reset & Re-fetch ALL' : 'Confirm Fetch'}</h3>
                {isReset && <div className="bg-red-50 text-red-700 p-2 rounded mb-3 text-sm">This will re-fetch ALL data, even existing. Expensive!</div>}
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between p-2 bg-gray-50 rounded"><span>Domains:</span><span className="font-bold">{plan.totalDomains}</span></div>
                    {!isReset && <div className="flex justify-between p-2 bg-green-50 rounded"><span>Already Complete:</span><span className="text-green-600 font-bold">{plan.domainsComplete} (FREE)</span></div>}
                    <div className="flex justify-between p-2 bg-yellow-50 rounded"><span>Need Fetch:</span><span className="font-bold">{plan.domainsNeedingFetch}</span></div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="p-2 bg-blue-50 rounded"><div className="text-gray-500">Whois</div><div className="font-bold">{plan.apiCalls.whois}</div><div>${plan.cost.whois.toFixed(2)}</div></div>
                        <div className="p-2 bg-purple-50 rounded"><div className="text-gray-500">Backlinks</div><div className="font-bold">{plan.apiCalls.backlinks}</div><div>${plan.cost.backlinks.toFixed(2)}</div></div>
                        <div className="p-2 bg-green-50 rounded"><div className="text-gray-500">Labs</div><div className="font-bold">{plan.apiCalls.labs}</div><div>${plan.cost.labs.toFixed(2)}</div></div>
                    </div>
                    <div className="flex justify-between p-3 bg-yellow-100 rounded text-lg"><span className="font-bold">Total Cost:</span><span className={`font-bold ${canAfford ? 'text-green-600' : 'text-red-600'}`}>${plan.cost.total.toFixed(2)}</span></div>
                    {balance !== null && <div className="flex justify-between text-gray-500"><span>Balance:</span><span>${balance.toFixed(2)}</span></div>}
                    {!canAfford && <div className="bg-red-100 text-red-700 p-2 rounded text-center">⚠️ Insufficient balance!</div>}
                </div>
                <div className="flex gap-3 mt-4">
                    <button onClick={onCancel} className="flex-1 px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
                    <button onClick={onConfirm} disabled={!canAfford} className={`flex-1 px-4 py-2 rounded text-white ${canAfford ? (isReset ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700') : 'bg-gray-400'}`}>
                        {canAfford ? 'Confirm' : 'Insufficient'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Multi-Select Filter Dropdown
function MultiSelectFilter({
    options,
    selected,
    onChange,
    placeholder = 'All',
    width = 'w-full'
}: {
    options: { value: string; label: string; className?: string }[];
    selected: string[];
    onChange: (selected: string[]) => void;
    placeholder?: string;
    width?: string;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (value: string) => {
        if (selected.includes(value)) {
            onChange(selected.filter(v => v !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    const selectAll = () => onChange(options.map(o => o.value));
    const clearAll = () => onChange([]);

    const displayText = selected.length === 0
        ? placeholder
        : selected.length === options.length
            ? 'All'
            : selected.length === 1
                ? options.find(o => o.value === selected[0])?.label || selected[0]
                : `${selected.length} selected`;

    return (
        <div ref={ref} className={`relative ${width}`}>
            <button
                onClick={() => setOpen(!open)}
                className={`w-full px-2 py-1 text-[10px] border rounded flex items-center justify-between gap-1 ${selected.length > 0 ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-600'
                    } hover:bg-gray-50`}
            >
                <span className="truncate">{displayText}</span>
                <span className="text-[8px]">{open ? '▲' : '▼'}</span>
            </button>

            {open && (
                <div className="absolute z-50 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-auto">
                    {/* Quick Actions */}
                    <div className="flex border-b bg-gray-50 px-2 py-1 gap-2 text-[9px] sticky top-0">
                        <button onClick={selectAll} className="text-blue-600 hover:underline">Select All</button>
                        <span className="text-gray-300">|</span>
                        <button onClick={clearAll} className="text-red-600 hover:underline">Clear</button>
                    </div>

                    {/* Options */}
                    <div className="p-0.5">
                        {options.map(opt => (
                            <label
                                key={opt.value}
                                className="flex items-center gap-1.5 px-2 py-1 hover:bg-gray-100 rounded cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    checked={selected.includes(opt.value)}
                                    onChange={() => toggleOption(opt.value)}
                                    className="w-3 h-3 rounded"
                                />
                                <span className={`text-[10px] ${opt.className || 'text-gray-700'}`}>{opt.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// Simple text filter for domain search
function TextFilter({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
        <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder || '...'}
            className="w-full px-2 py-1 text-[11px] border rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
        />
    );
}

// Main Component
export default function DomainAuthorityPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [competitors, setCompetitors] = useState<Competitor[]>([]);
    const [clientCode, setClientCode] = useState('');
    const [records, setRecords] = useState<CredibilityRecord[]>([]);
    const [domains, setDomains] = useState<DomainEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [balance, setBalance] = useState<number | null>(null);
    const [balanceRefresh, setBalanceRefresh] = useState(0);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showReset, setShowReset] = useState(false);
    const [fetchPlan, setFetchPlan] = useState<FetchPlan | null>(null);
    const [fetchResult, setFetchResult] = useState<{ before: number; after: number; cost: number; fetched: number } | null>(null);

    // Sorting
    const [sortKey, setSortKey] = useState<SortKey>('traffic');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    // Filters - Domain is multi-select, Status is multi-select
    const [domainFilter, setDomainFilter] = useState<string[]>([]);  // Empty = all domains
    const [statusFilter, setStatusFilter] = useState<string[]>([]); // ['complete', 'partial', 'none']
    const [competitionFilter, setCompetitionFilter] = useState<string[]>([]); // Competition type filter
    const [productFilter, setProductFilter] = useState<string[]>([]); // Product filter

    // Load data
    useEffect(() => {
        fetch('/api/dataforseo/usage').then(r => r.json()).then(d => setBalance(d.balance)).catch(() => { });
        fetch('/api/clients').then(r => r.json()).then(d => {
            const list = (d.clients || d || []).filter((c: Client) => c.isActive);
            setClients(list);
            const m = list.find((c: Client) => c.name.toUpperCase().includes('MEERA') && !c.name.includes('CCP'));
            setClientCode(m?.code || list[0]?.code || '');
        });
        fetch('/api/competitors').then(r => r.json()).then(d => setCompetitors(d.competitors || d || []));
    }, []);

    useEffect(() => {
        if (!clientCode) return;
        setLoading(true);
        fetch(`/api/domain-credibility?clientCode=${encodeURIComponent(clientCode)}&location=IN`)
            .then(r => r.json()).then(d => setRecords(d.records || [])).finally(() => setLoading(false));
    }, [clientCode]);

    useEffect(() => {
        if (!clientCode) { setDomains([]); return; }
        const seen = new Set<string>(), list: DomainEntry[] = [];
        const client = clients.find(c => c.code === clientCode);
        const add = (raw: string, type: 'client' | 'competitor', label?: string, competitionType?: string, competitorForProducts?: string[]) => {
            const c = clean(raw);
            if (!c || seen.has(c)) return;
            seen.add(c);
            const stored = records.find(r => clean(r.domain) === c) || null;
            const { hasWhois, hasBacklinks, hasLabs } = analyzeData(stored);
            const nW = !hasWhois, nB = !hasBacklinks, nL = !hasLabs;
            list.push({
                domain: raw.replace(/^https?:\/\//, '').replace(/\/$/, ''), cleanDomain: c, type, label, selected: true, storedData: stored,
                needsWhois: nW, needsBacklinks: nB, needsLabs: nL,
                estimatedCost: (nW ? 0.101 : 0) + (nB ? 0.020 : 0) + (nL ? 0.101 : 0),
                competitionType, competitorForProducts,
            });
        };
        (client?.domains || []).forEach(d => add(d, 'client', client?.name));
        competitors.filter(c => c.clientCode === clientCode && c.isActive).forEach(c =>
            add(c.domain, 'competitor', c.name, c.competitionType, c.competitorForProducts)
        );
        setDomains(list);
    }, [clientCode, clients, competitors, records]);

    // Filter and Sort
    const filteredAndSorted = useMemo(() => {
        let result = [...domains];

        // Apply filters
        // Domain multi-select filter
        if (domainFilter.length > 0) {
            result = result.filter(e => domainFilter.includes(e.cleanDomain));
        }

        // Status multi-select filter  
        if (statusFilter.length > 0) {
            result = result.filter(e => {
                const { hasWhois, hasBacklinks, hasLabs } = analyzeData(e.storedData);
                const complete = hasWhois && hasBacklinks && hasLabs;

                if (statusFilter.includes('complete') && complete) return true;
                if (statusFilter.includes('partial') && e.storedData && !complete) return true;
                if (statusFilter.includes('none') && !e.storedData) return true;
                return false;
            });
        }

        // Competition type filter
        if (competitionFilter.length > 0) {
            result = result.filter(e => {
                if (e.type === 'client') return competitionFilter.includes('Client');
                return e.competitionType && competitionFilter.includes(e.competitionType);
            });
        }

        // Product filter
        if (productFilter.length > 0) {
            result = result.filter(e => {
                if (!e.competitorForProducts || e.competitorForProducts.length === 0) return false;
                return e.competitorForProducts.some(p => productFilter.includes(p));
            });
        }

        // Sort
        result.sort((a, b) => {
            const ad = a.storedData, bd = b.storedData;
            let av: number = 0, bv: number = 0;

            switch (sortKey) {
                case 'domain': return sortDir === 'asc' ? a.domain.localeCompare(b.domain) : b.domain.localeCompare(a.domain);
                case 'type': av = a.type === 'client' ? 0 : 1; bv = b.type === 'client' ? 0 : 1; break;
                case 'age': av = ad?.domainAgeYears ?? -1; bv = bd?.domainAgeYears ?? -1; break;
                case 'rd': av = ad?.referringDomains ?? -1; bv = bd?.referringDomains ?? -1; break;
                case 'bl': av = ad?.totalBacklinks ?? -1; bv = bd?.totalBacklinks ?? -1; break;
                case 'df': av = ad?.dofollowBacklinks ?? -1; bv = bd?.dofollowBacklinks ?? -1; break;
                case 'traffic': av = ad?.organicTraffic ?? -1; bv = bd?.organicTraffic ?? -1; break;
                case 'etv': av = ad?.organicCost ?? -1; bv = bd?.organicCost ?? -1; break;
                case 'vis': av = ad?.keywordVisibilityScore ?? -1; bv = bd?.keywordVisibilityScore ?? -1; break;
                case 'top3': av = ad?.organicTop3 ?? -1; bv = bd?.organicTop3 ?? -1; break;
                case 'top10': av = ad?.organicTop10 ?? -1; bv = bd?.organicTop10 ?? -1; break;
                case 'top100': av = ad?.organicTop100 ?? -1; bv = bd?.organicTop100 ?? -1; break;
                case 'cost': av = a.estimatedCost; bv = b.estimatedCost; break;
                case 'status':
                    const aComplete = analyzeData(ad);
                    const bComplete = analyzeData(bd);
                    av = (aComplete.hasWhois && aComplete.hasBacklinks && aComplete.hasLabs) ? 2 : ad ? 1 : 0;
                    bv = (bComplete.hasWhois && bComplete.hasBacklinks && bComplete.hasLabs) ? 2 : bd ? 1 : 0;
                    break;
            }
            return sortDir === 'asc' ? av - bv : bv - av;
        });

        return result;
    }, [domains, domainFilter, statusFilter, competitionFilter, productFilter, sortKey, sortDir]);

    const selected = useMemo(() => domains.filter(d => d.selected), [domains]);

    const smartPlan = useMemo((): FetchPlan => {
        const need = selected.filter(d => d.estimatedCost > 0);
        return {
            totalDomains: selected.length, domainsNeedingFetch: need.length, domainsComplete: selected.length - need.length,
            apiCalls: { whois: need.filter(d => d.needsWhois).length, backlinks: need.filter(d => d.needsBacklinks).length, labs: need.filter(d => d.needsLabs).length, total: need.reduce((s, d) => s + (d.needsWhois ? 1 : 0) + (d.needsBacklinks ? 1 : 0) + (d.needsLabs ? 1 : 0), 0) },
            cost: { whois: need.filter(d => d.needsWhois).length * 0.101, backlinks: need.filter(d => d.needsBacklinks).length * 0.020, labs: need.filter(d => d.needsLabs).length * 0.101, total: need.reduce((s, d) => s + d.estimatedCost, 0) },
        };
    }, [selected]);

    const resetPlan = useMemo((): FetchPlan => {
        const n = selected.length;
        return {
            totalDomains: n, domainsNeedingFetch: n, domainsComplete: 0,
            apiCalls: { whois: n, backlinks: n, labs: n, total: n * 3 },
            cost: { whois: n * 0.101, backlinks: n * 0.020, labs: n * 0.101, total: n * 0.222 },
        };
    }, [selected]);

    const handleSelectAll = (v: boolean) => setDomains(p => p.map(d => ({ ...d, selected: v })));
    const handleSelect = (c: string, v: boolean) => setDomains(p => p.map(d => d.cleanDomain === c ? { ...d, selected: v } : d));

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };

    // Excel Export
    const handleExport = () => {
        const headers = ['#', 'Domain', 'Type', 'Age (years)', 'Referring Domains', 'Backlinks', 'Dofollow', 'Traffic', 'ETV ($)', 'Visibility', 'Top3', 'Top10', 'Top100', 'Cost', 'Status'];
        const rows = filteredAndSorted.map((e, i) => {
            const d = e.storedData;
            const { hasWhois, hasBacklinks, hasLabs } = analyzeData(d);
            const complete = hasWhois && hasBacklinks && hasLabs;
            return [
                i + 1,
                e.domain,
                e.type === 'client' ? 'Client' : 'Competitor',
                d?.domainAgeYears?.toFixed(1) || '',
                d?.referringDomains || '',
                d?.totalBacklinks || '',
                d?.dofollowBacklinks || '',
                d?.organicTraffic || '',
                d?.organicCost || '',
                d?.keywordVisibilityScore?.toFixed(1) || '',
                d?.organicTop3 || '',
                d?.organicTop10 || '',
                d?.organicTop100 || '',
                e.estimatedCost === 0 ? 'FREE' : `$${e.estimatedCost.toFixed(2)}`,
                complete ? 'Complete' : d ? 'Partial' : 'Not Fetched',
            ];
        });

        const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `domain-authority-${clientCode}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleSmartFetch = () => {
        if (smartPlan.domainsNeedingFetch === 0) { setSuccess('✓ All selected domains already complete!'); return; }
        setFetchPlan(smartPlan); setShowConfirm(true);
    };

    const handleResetFetch = () => {
        if (selected.length === 0) return;
        setFetchPlan(resetPlan); setShowReset(true);
    };

    const executeFetch = async (force: boolean) => {
        setShowConfirm(false); setShowReset(false); setFetching(true); setError(null); setSuccess(null); setFetchResult(null);
        try {
            const res = await fetch('/api/domain-credibility', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientCode, domains: selected.map(d => ({ domain: d.cleanDomain, type: d.type, label: d.label })), locationCode: 'IN', page: 'domain-authority', forceRefetch: force }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setFetchResult({ before: data.balanceBefore, after: data.balanceAfter, cost: data.actualCost, fetched: data.recordsFetched });
            setBalanceRefresh(r => r + 1);
            const reload = await fetch(`/api/domain-credibility?clientCode=${encodeURIComponent(clientCode)}&location=IN`);
            if (reload.ok) setRecords((await reload.json()).records || []);
            setSuccess(`✓ Fetched ${data.recordsFetched} domains`);
        } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
        finally { setFetching(false); }
    };

    // Sort indicator
    const SortIcon = ({ col }: { col: SortKey }) => {
        if (sortKey !== col) return <span className="text-gray-300 ml-0.5">↕</span>;
        return <span className="text-blue-500 ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <div className="p-4 h-screen flex flex-col">
            {/* Header */}
            <div className="mb-3 flex justify-between gap-4 flex-shrink-0">
                <div><h1 className="text-xl font-bold">Domain Authority</h1><p className="text-gray-500 text-xs">Smart Fetch - Only fetches missing data</p></div>
                <div className="w-64"><BalanceWidget refresh={balanceRefresh} /></div>
            </div>

            {/* Controls */}
            <div className="bg-white rounded shadow p-3 mb-3 flex flex-wrap items-center gap-2 flex-shrink-0">
                <select value={clientCode} onChange={e => setClientCode(e.target.value)} className="border rounded px-2 py-1 text-sm" disabled={fetching}>
                    <option value="">Select Client</option>
                    {clients.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
                <button onClick={handleSmartFetch} disabled={!clientCode || fetching || selected.length === 0} className={`px-3 py-1 text-sm rounded ${fetching ? 'bg-gray-300' : smartPlan.domainsNeedingFetch === 0 ? 'bg-green-100 text-green-700' : 'bg-green-600 text-white hover:bg-green-700'}`}>
                    {fetching ? '⏳...' : smartPlan.domainsNeedingFetch === 0 ? `✓ All ${smartPlan.totalDomains} Complete` : `Fetch ${smartPlan.domainsNeedingFetch} Missing ~$${smartPlan.cost.total.toFixed(2)}`}
                </button>
                <button onClick={handleResetFetch} disabled={!clientCode || fetching || selected.length === 0} className="px-3 py-1 text-sm rounded border border-red-300 text-red-600 hover:bg-red-50">🔄 Reset All</button>
                <PricingInfo />
                <button onClick={handleExport} disabled={filteredAndSorted.length === 0} className="px-3 py-1 text-sm rounded border border-blue-300 text-blue-600 hover:bg-blue-50">📊 Export CSV</button>
                <span className="ml-auto text-xs text-gray-500">{filteredAndSorted.length} shown • {selected.length} selected • {smartPlan.domainsComplete} complete</span>
            </div>

            {/* Messages */}
            {error && <div className="bg-red-50 text-red-600 text-sm p-2 rounded mb-2 flex-shrink-0">⚠️ {error}</div>}
            {success && <div className="bg-green-50 text-green-600 text-sm p-2 rounded mb-2 flex-shrink-0">{success}{fetchResult && <span className="text-xs ml-2">(${fetchResult.before?.toFixed(2)} → ${fetchResult.after?.toFixed(2)}, Cost: ${fetchResult.cost?.toFixed(3)})</span>}</div>}

            {/* Table with sticky header */}
            <div className="bg-white rounded shadow flex-1 overflow-auto border">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                        {/* Header Row */}
                        <tr className="border-b border-gray-200">
                            <th className="px-3 py-3 w-10 bg-gray-50"><input type="checkbox" checked={domains.length > 0 && domains.every(d => d.selected)} onChange={e => handleSelectAll(e.target.checked)} className="w-4 h-4" /></th>
                            <th className="px-2 py-3 w-10 bg-gray-50 text-left text-gray-500 font-medium">#</th>
                            <th className="px-4 py-3 text-left bg-gray-50 cursor-pointer hover:bg-gray-100 font-medium text-gray-700" onClick={() => handleSort('domain')}>Domain<Tip k="domain" /><SortIcon col="domain" /></th>
                            <th className="px-3 py-3 w-12 bg-gray-50 cursor-pointer hover:bg-gray-100 text-center font-medium text-gray-700" onClick={() => handleSort('type')}>T<Tip k="type" /><SortIcon col="type" /></th>
                            <th className="px-3 py-3 w-20 bg-gray-50 text-center font-medium text-gray-700">Comp</th>
                            <th className="px-3 py-3 w-24 bg-gray-50 text-center font-medium text-gray-700">Products</th>
                            <th className="px-3 py-3 w-16 bg-gray-50 cursor-pointer hover:bg-gray-100 text-right font-medium text-gray-700" onClick={() => handleSort('age')}>Age<Tip k="age" /><SortIcon col="age" /></th>
                            <th className="px-3 py-3 w-16 bg-gray-50 cursor-pointer hover:bg-gray-100 text-right font-medium text-gray-700" onClick={() => handleSort('rd')}>RD<Tip k="rd" /><SortIcon col="rd" /></th>
                            <th className="px-3 py-3 w-16 bg-gray-50 cursor-pointer hover:bg-gray-100 text-right font-medium text-gray-700" onClick={() => handleSort('bl')}>BL<Tip k="bl" /><SortIcon col="bl" /></th>
                            <th className="px-3 py-3 w-16 bg-gray-50 cursor-pointer hover:bg-gray-100 text-right font-medium text-gray-700" onClick={() => handleSort('df')}>DF<Tip k="df" /><SortIcon col="df" /></th>
                            <th className="px-3 py-3 w-20 bg-gray-50 cursor-pointer hover:bg-gray-100 text-right font-medium text-gray-700" onClick={() => handleSort('traffic')}>Traffic<Tip k="traffic" /><SortIcon col="traffic" /></th>
                            <th className="px-3 py-3 w-20 bg-gray-50 cursor-pointer hover:bg-gray-100 text-right font-medium text-gray-700" onClick={() => handleSort('etv')}>ETV<Tip k="etv" /><SortIcon col="etv" /></th>
                            <th className="px-3 py-3 w-14 bg-gray-50 cursor-pointer hover:bg-gray-100 text-right font-medium text-gray-700" onClick={() => handleSort('vis')}>Vis<Tip k="vis" /><SortIcon col="vis" /></th>
                            <th className="px-3 py-3 w-28 bg-gray-50 cursor-pointer hover:bg-gray-100 text-center font-medium text-gray-700" onClick={() => handleSort('top10')}>Rank Dist<Tip k="rank" /><SortIcon col="top10" /></th>
                            <th className="px-3 py-3 w-16 bg-gray-50 cursor-pointer hover:bg-gray-100 text-center font-medium text-gray-700" onClick={() => handleSort('cost')}>Cost<Tip k="cost" /><SortIcon col="cost" /></th>
                            <th className="px-3 py-3 w-12 bg-gray-50 cursor-pointer hover:bg-gray-100 text-center font-medium text-gray-700" onClick={() => handleSort('status')}>St<Tip k="status" /><SortIcon col="status" /></th>
                        </tr>
                        {/* Filter Row */}
                        <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="px-1 py-2 bg-gray-50"></th>
                            <th className="px-1 py-2 bg-gray-50"></th>
                            <th className="px-2 py-2 bg-gray-50">
                                <MultiSelectFilter
                                    options={domains.map(d => ({
                                        value: d.cleanDomain,
                                        label: d.domain,
                                        className: d.type === 'client' ? 'text-blue-600 font-medium' : 'text-gray-600'
                                    }))}
                                    selected={domainFilter}
                                    onChange={setDomainFilter}
                                    placeholder="All Domains"
                                />
                            </th>
                            <th className="px-2 py-2 bg-gray-50">
                                <MultiSelectFilter
                                    options={[
                                        { value: 'Client', label: 'Client' },
                                        ...Array.from(new Set(domains.filter(d => d.competitionType).map(d => d.competitionType!))).map(t => ({ value: t, label: t }))
                                    ]}
                                    selected={competitionFilter}
                                    onChange={setCompetitionFilter}
                                    placeholder="Competition"
                                />
                            </th>
                            <th className="px-2 py-2 bg-gray-50">
                                <MultiSelectFilter
                                    options={Array.from(new Set(domains.flatMap(d => d.competitorForProducts || []))).map(p => ({ value: p, label: p }))}
                                    selected={productFilter}
                                    onChange={setProductFilter}
                                    placeholder="Products"
                                />
                            </th>
                            <th className="px-1 py-2 bg-gray-50"></th>
                            <th className="px-1 py-2 bg-gray-50"></th>
                            <th className="px-1 py-2 bg-gray-50"></th>
                            <th className="px-1 py-2 bg-gray-50"></th>
                            <th className="px-1 py-2 bg-gray-50"></th>
                            <th className="px-1 py-2 bg-gray-50"></th>
                            <th className="px-1 py-2 bg-gray-50"></th>
                            <th className="px-2 py-2 bg-gray-50">
                                <MultiSelectFilter
                                    options={[
                                        { value: 'complete', label: '✓ Complete' },
                                        { value: 'partial', label: '◐ Partial' },
                                        { value: 'none', label: '○ None' }
                                    ]}
                                    selected={statusFilter}
                                    onChange={setStatusFilter}
                                    placeholder="Status"
                                />
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredAndSorted.map((e, i) => {
                            const d = e.storedData;
                            const { hasWhois, hasBacklinks, hasLabs } = analyzeData(d);
                            const complete = hasWhois && hasBacklinks && hasLabs;
                            return (
                                <tr key={e.cleanDomain} className={`${e.type === 'client' ? 'bg-blue-50/50' : 'bg-white'} hover:bg-gray-50 transition-colors`}>
                                    <td className="px-3 py-2.5"><input type="checkbox" checked={e.selected} onChange={ev => handleSelect(e.cleanDomain, ev.target.checked)} className="w-4 h-4" /></td>
                                    <td className="px-2 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                                    <td className="px-4 py-2.5">
                                        <a href={`https://${e.cleanDomain}`} target="_blank" className="text-blue-600 hover:underline font-medium">{e.domain}</a>
                                        <div className="text-[11px] text-gray-400 mt-0.5">{complete ? '✓ Complete' : `Need: ${[!hasWhois && 'Age', !hasBacklinks && 'BL', !hasLabs && 'KW'].filter(Boolean).join(', ')}`}</div>
                                    </td>
                                    <td className="px-3 py-2.5 text-center"><span className={`inline-block w-6 h-6 leading-6 text-center rounded text-xs font-medium ${e.type === 'client' ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'}`}>{e.type === 'client' ? 'C' : 'X'}</span></td>
                                    <td className="px-3 py-2.5 text-center text-[10px]">
                                        {e.type === 'client' ? (
                                            <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Client</span>
                                        ) : e.competitionType ? (
                                            <span className={`px-1.5 py-0.5 rounded ${e.competitionType === 'Main Competitor' ? 'bg-red-100 text-red-700' :
                                                    e.competitionType === 'Partial Competitor' ? 'bg-amber-100 text-amber-700' :
                                                        e.competitionType === 'Not a Competitor' ? 'bg-gray-100 text-gray-600' :
                                                            'bg-purple-100 text-purple-700'
                                                }`}>{e.competitionType}</span>
                                        ) : <span className="text-gray-300">-</span>}
                                    </td>
                                    <td className="px-3 py-2.5 text-center text-[10px]">
                                        {e.competitorForProducts && e.competitorForProducts.length > 0 ? (
                                            <div className="flex flex-wrap gap-0.5 justify-center">
                                                {e.competitorForProducts.slice(0, 2).map(p => (
                                                    <span key={p} className="px-1 py-0.5 bg-purple-100 text-purple-700 rounded">{p}</span>
                                                ))}
                                                {e.competitorForProducts.length > 2 && (
                                                    <span className="text-gray-400">+{e.competitorForProducts.length - 2}</span>
                                                )}
                                            </div>
                                        ) : <span className="text-gray-300">-</span>}
                                    </td>
                                    <td className={`px-3 py-2.5 text-right font-mono text-xs ${!hasWhois ? 'text-gray-300' : 'text-gray-700'}`}>{d?.domainAgeYears != null ? d.domainAgeYears.toFixed(1) + 'y' : '-'}</td>
                                    <td className={`px-3 py-2.5 text-right font-mono text-xs ${!hasBacklinks ? 'text-gray-300' : 'text-gray-700'}`}>{fmt(d?.referringDomains)}</td>
                                    <td className={`px-3 py-2.5 text-right font-mono text-xs ${!hasBacklinks ? 'text-gray-300' : 'text-gray-700'}`}>{fmt(d?.totalBacklinks)}</td>
                                    <td className={`px-3 py-2.5 text-right font-mono text-xs ${!hasBacklinks ? 'text-gray-300' : 'text-gray-700'}`}>{fmt(d?.dofollowBacklinks)}</td>
                                    <td className={`px-3 py-2.5 text-right font-mono text-xs font-semibold ${!hasLabs ? 'text-gray-300' : 'text-gray-900'}`}>{fmt(d?.organicTraffic)}</td>
                                    <td className={`px-3 py-2.5 text-right font-mono text-xs ${!hasLabs ? 'text-gray-300' : 'text-green-600'}`}>{fmtUSD(d?.organicCost)}</td>
                                    <td className={`px-3 py-2.5 text-right font-mono text-xs ${!hasLabs ? 'text-gray-300' : 'text-gray-700'}`}>{d?.keywordVisibilityScore?.toFixed(1) || '-'}</td>
                                    <td className={`px-3 py-2.5 text-center font-mono text-xs ${!hasLabs ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {d?.organicTop3 != null ? (
                                            <span title={`Top 3: ${d.organicTop3} keywords\nTop 10: ${d.organicTop10} keywords\nTop 100: ${d.organicTop100} keywords`}>
                                                <span className="text-green-600">{d.organicTop3}</span>/<span className="text-blue-600">{d.organicTop10}</span>/<span className="text-gray-500">{fmt(d.organicTop100)}</span>
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        {e.estimatedCost === 0 ? <span className="text-green-600 font-semibold text-xs">FREE</span> : <span className="text-amber-600 font-mono text-xs" title={`W:${e.needsWhois ? '$0.10' : '✓'} B:${e.needsBacklinks ? '$0.02' : '✓'} L:${e.needsLabs ? '$0.10' : '✓'}`}>${e.estimatedCost.toFixed(2)}</span>}
                                    </td>
                                    <td className="px-3 py-2.5 text-center text-lg">{complete ? <span className="text-green-500">✓</span> : d ? <span className="text-yellow-500">◐</span> : <span className="text-gray-300">○</span>}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="mt-2 text-[10px] text-gray-400 flex-shrink-0">
                ✓ Complete • ◐ Partial • ○ Not fetched | <span className="text-green-600">FREE</span> = No API needed | Rank Dist = Top3/Top10/Top100 keywords | Click column header to sort
            </div>

            {/* Dialogs */}
            {showConfirm && fetchPlan && <ConfirmDialog plan={fetchPlan} balance={balance} isReset={false} onConfirm={() => executeFetch(false)} onCancel={() => setShowConfirm(false)} />}
            {showReset && fetchPlan && <ConfirmDialog plan={fetchPlan} balance={balance} isReset={true} onConfirm={() => executeFetch(true)} onCancel={() => setShowReset(false)} />}
        </div>
    );
}
