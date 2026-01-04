'use client';

import { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import {
    DomainIntentSummaryRow,
    PageIntentDetail,
    PAGE_INTENT_BUCKETS,
    getIntentLabel
} from '@/types/pageIntent';

interface Client {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
}

const pageHelp = {
    title: 'Page Intent Analysis',
    description: 'Analyze competitor and client sitemap pages to classify them into funnel stages (TOFU/MOFU/BOFU) using AI.',
    whyWeAddedThis: 'Understanding the content mix of competitor websites helps identify content gaps and opportunities.',
    examples: ['Product pages = Transactional (BOFU)', 'Blog posts = Educational (TOFU)', 'Comparison guides = Commercial Investigation (MOFU)'],
    nuances: 'Results depend on sitemap availability. Some sites may not have complete sitemaps.',
    useCases: [
        'Compare content strategies across competitors',
        'Identify content gaps in your funnel',
        'Plan content calendar based on funnel balance'
    ]
};

function getIntentColor(bucket: string): string {
    switch (bucket) {
        case 'problem_aware_solution_tofu':
            return 'bg-cyan-100 text-cyan-800';
        case 'educational_informational_tofu':
            return 'bg-blue-100 text-blue-800';
        case 'commercial_investigation_mofu':
            return 'bg-amber-100 text-amber-800';
        case 'trust_proof_mofu':
            return 'bg-purple-100 text-purple-800';
        case 'brand_navigation_bofu':
            return 'bg-gray-100 text-gray-800';
        case 'transactional_bofu':
            return 'bg-green-100 text-green-800';
        default:
            return 'bg-gray-100 text-gray-600';
    }
}

function getFunnelStageColor(stage: string): string {
    switch (stage) {
        case 'TOFU':
            return 'bg-blue-50 text-blue-700';
        case 'MOFU':
            return 'bg-amber-50 text-amber-700';
        case 'BOFU':
            return 'bg-green-50 text-green-700';
        default:
            return 'bg-gray-50 text-gray-600';
    }
}

export default function PageIntentAnalysisPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClient, setSelectedClient] = useState<string>('');
    const [domains, setDomains] = useState<DomainIntentSummaryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchingDomains, setFetchingDomains] = useState<Set<string>>(new Set());
    const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());
    const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
    const [domainPages, setDomainPages] = useState<Record<string, PageIntentDetail[]>>({});
    const [loadingPages, setLoadingPages] = useState<Set<string>>(new Set());
    const [summaryModal, setSummaryModal] = useState<DomainIntentSummaryRow | null>(null);
    const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
    const [apiKeyStatus, setApiKeyStatus] = useState<{ status: 'idle' | 'testing' | 'valid' | 'invalid'; message?: string }>({ status: 'idle' });
    const [showPromptEditor, setShowPromptEditor] = useState(false);
    const [customPrompt, setCustomPrompt] = useState<string>(`You are an SEO expert analyzing website URLs to classify them into funnel stages.

Classify each URL into ONE of these intent buckets:
{{BUCKET_DESCRIPTIONS}}

Bucket Definitions:
1. problem_aware_solution_tofu - Pages addressing problems/pain points, "how to solve X" type content
2. educational_informational_tofu - Blog posts, guides, educational resources, general industry information
3. commercial_investigation_mofu - Comparison pages, reviews, "best X for Y", product research content
4. trust_proof_mofu - Case studies, testimonials, about us, certifications, awards
5. brand_navigation_bofu - Homepage, contact, locations, careers, press, company navigation
6. transactional_bofu - Product pages, pricing, buy now, checkout, cart, quote requests

Analyze these URLs and respond with a JSON array. Each object should have "url" and "intent" fields.
Only use the exact bucket codes listed above.

URLs to classify:
{{URLS}}

Respond ONLY with a valid JSON array, no other text:`);

    // Test OpenAI API Key
    const handleTestApiKey = async () => {
        setApiKeyStatus({ status: 'testing' });
        try {
            const res = await fetch('/api/keywords/page-intent-analysis/test-api-key');
            const data = await res.json();

            if (data.success) {
                setApiKeyStatus({
                    status: 'valid',
                    message: `✓ API key valid (${data.maskedKey}) - ${data.elapsed}ms`
                });
                setTimeout(() => setApiKeyStatus({ status: 'idle' }), 5000);
            } else {
                setApiKeyStatus({
                    status: 'invalid',
                    message: data.message || 'Invalid API key'
                });
            }
        } catch (error) {
            setApiKeyStatus({
                status: 'invalid',
                message: 'Failed to test API key'
            });
        }
    };

    // Fetch clients on mount
    useEffect(() => {
        async function fetchClients() {
            try {
                const res = await fetch('/api/clients');
                const data = await res.json();
                const activeClients = data.filter((c: Client) => c.isActive);
                setClients(activeClients);

                // Default to first client (Meera if available)
                const meeraClient = activeClients.find((c: Client) => c.name.toLowerCase().includes('meera'));
                setSelectedClient(meeraClient?.code || activeClients[0]?.code || '');
            } catch (error) {
                console.error('Failed to fetch clients:', error);
            }
        }
        fetchClients();
    }, []);

    // Fetch domains when client changes
    useEffect(() => {
        if (!selectedClient) {
            setDomains([]);
            setLoading(false);
            return;
        }

        async function fetchDomains() {
            setLoading(true);
            try {
                const res = await fetch(`/api/keywords/page-intent-analysis/domains?clientCode=${selectedClient}`);
                const data = await res.json();

                if (res.ok) {
                    setDomains(Array.isArray(data) ? data : []);
                } else {
                    console.error('Failed to fetch domains:', data.error);
                    setDomains([]);
                }
            } catch (error) {
                console.error('Failed to fetch domains:', error);
                setDomains([]);
            } finally {
                setLoading(false);
            }
        }
        fetchDomains();
    }, [selectedClient]);

    // Toggle domain selection
    const toggleDomain = (domain: string) => {
        setSelectedDomains(prev => {
            const next = new Set(prev);
            if (next.has(domain)) {
                next.delete(domain);
            } else {
                next.add(domain);
            }
            return next;
        });
    };

    // Select/deselect all
    const toggleSelectAll = () => {
        if (selectedDomains.size === domains.length) {
            setSelectedDomains(new Set());
        } else {
            setSelectedDomains(new Set(domains.map(d => d.domain)));
        }
    };

    // Fetch and analyze selected domains
    const handleFetchAnalyze = async () => {
        if (selectedDomains.size === 0 || !selectedClient) return;

        const domainsToFetch = Array.from(selectedDomains);
        setFetchingDomains(new Set(domainsToFetch));
        setNotification({ type: 'info', message: `Analyzing ${domainsToFetch.length} domain(s)... This may take a while.` });

        try {
            const res = await fetch('/api/keywords/page-intent-analysis/fetch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientCode: selectedClient,
                    domains: domainsToFetch,
                    customPrompt: customPrompt, // Pass the editable prompt
                }),
            });

            const data = await res.json();

            if (res.ok) {
                // Refresh domains list
                const refreshRes = await fetch(`/api/keywords/page-intent-analysis/domains?clientCode=${selectedClient}`);
                const refreshData = await refreshRes.json();
                if (refreshRes.ok) {
                    setDomains(Array.isArray(refreshData) ? refreshData : []);
                }

                const successCount = data.results?.filter((r: { error?: string }) => !r.error).length || 0;
                const errorCount = data.results?.filter((r: { error?: string }) => r.error).length || 0;

                if (errorCount > 0) {
                    setNotification({
                        type: 'info',
                        message: `Completed: ${successCount} domain(s) analyzed, ${errorCount} had issues.`
                    });
                } else {
                    setNotification({
                        type: 'success',
                        message: `Successfully analyzed ${successCount} domain(s)!`
                    });
                }
            } else {
                setNotification({ type: 'error', message: data.error || 'Failed to analyze domains' });
            }
        } catch (error) {
            console.error('Fetch analyze error:', error);
            setNotification({ type: 'error', message: 'Failed to analyze domains' });
        } finally {
            setFetchingDomains(new Set());
            setSelectedDomains(new Set());
        }
    };

    // Toggle domain expansion
    const toggleExpand = async (domain: string) => {
        if (expandedDomains.has(domain)) {
            setExpandedDomains(prev => {
                const next = new Set(prev);
                next.delete(domain);
                return next;
            });
            return;
        }

        // Expand and fetch pages if needed
        setExpandedDomains(prev => new Set(prev).add(domain));

        if (!domainPages[domain]) {
            setLoadingPages(prev => new Set(prev).add(domain));
            try {
                const res = await fetch(`/api/keywords/page-intent-analysis/pages?clientCode=${selectedClient}&domain=${domain}`);
                const data = await res.json();
                if (res.ok && data.pages) {
                    setDomainPages(prev => ({ ...prev, [domain]: data.pages }));
                }
            } catch (error) {
                console.error('Failed to fetch pages:', error);
            } finally {
                setLoadingPages(prev => {
                    const next = new Set(prev);
                    next.delete(domain);
                    return next;
                });
            }
        }
    };

    // Sort domains - ones with data first
    const sortedDomains = useMemo(() => {
        return [...domains].sort((a, b) => {
            if (a.hasDetails && !b.hasDetails) return -1;
            if (!a.hasDetails && b.hasDetails) return 1;
            return a.domain.localeCompare(b.domain);
        });
    }, [domains]);

    if (loading && clients.length === 0) {
        return <div className="text-center py-8">Loading...</div>;
    }

    return (
        <div>
            <PageHeader
                title="Page Intent Analysis"
                description="Analyze competitor sitemap pages by TOFU/MOFU/BOFU intent buckets using AI."
                helpInfo={pageHelp}
            />

            {notification && (
                <div className={`mb-4 p-3 rounded-lg text-sm flex items-center justify-between ${notification.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
                    notification.type === 'info' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                        'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                    <span>{notification.message}</span>
                    <button onClick={() => setNotification(null)} className="text-gray-500 hover:text-gray-700 ml-2">&#10005;</button>
                </div>
            )}

            {/* AI Prompt Editor - Collapsible */}
            <div className="bg-white rounded-lg shadow-sm border mb-4">
                <button
                    onClick={() => setShowPromptEditor(!showPromptEditor)}
                    className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50"
                >
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">🤖 AI Classification Prompt</span>
                        <span className="text-[10px] text-gray-400">(Click to edit)</span>
                    </div>
                    <span className="text-gray-400">{showPromptEditor ? '▲' : '▼'}</span>
                </button>

                {showPromptEditor && (
                    <div className="px-4 pb-4 border-t">
                        <div className="mt-3">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-medium text-gray-600">
                                    Prompt Template
                                </label>
                                <span className="text-[9px] text-gray-400">
                                    Use {'{{BUCKET_DESCRIPTIONS}}'} and {'{{URLS}}'} as placeholders
                                </span>
                            </div>
                            <textarea
                                value={customPrompt}
                                onChange={(e) => setCustomPrompt(e.target.value)}
                                rows={12}
                                className="w-full px-3 py-2 text-xs font-mono border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-200 focus:outline-none"
                                placeholder="Enter your custom prompt..."
                            />
                            <div className="flex items-center justify-between mt-2">
                                <p className="text-[9px] text-gray-400">
                                    ⚠️ Changes will apply to the next analysis run. The prompt should output a JSON array with {'"url"'} and {'"intent"'} fields.
                                </p>
                                <button
                                    onClick={() => setCustomPrompt(`You are an SEO expert analyzing website URLs to classify them into funnel stages.

Classify each URL into ONE of these intent buckets:
{{BUCKET_DESCRIPTIONS}}

Bucket Definitions:
1. problem_aware_solution_tofu - Pages addressing problems/pain points, "how to solve X" type content
2. educational_informational_tofu - Blog posts, guides, educational resources, general industry information
3. commercial_investigation_mofu - Comparison pages, reviews, "best X for Y", product research content
4. trust_proof_mofu - Case studies, testimonials, about us, certifications, awards
5. brand_navigation_bofu - Homepage, contact, locations, careers, press, company navigation
6. transactional_bofu - Product pages, pricing, buy now, checkout, cart, quote requests

Analyze these URLs and respond with a JSON array. Each object should have "url" and "intent" fields.
Only use the exact bucket codes listed above.

URLs to classify:
{{URLS}}

Respond ONLY with a valid JSON array, no other text:`)}
                                    className="px-3 py-1 text-[10px] bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                                >
                                    Reset to Default
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls Bar */}
            <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
                <div className="flex flex-wrap items-center gap-4">
                    {/* Client Selector */}
                    <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Client</label>
                        <select
                            value={selectedClient}
                            onChange={e => setSelectedClient(e.target.value)}
                            className="px-3 py-1.5 border rounded text-sm w-48"
                        >
                            <option value="">Select Client</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.code}>{c.code} - {c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 px-4 border-l">
                        <div className="text-center">
                            <div className="text-xl font-bold text-indigo-600">{domains.length}</div>
                            <div className="text-[10px] text-gray-500">Domains</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xl font-bold text-green-600">{domains.filter(d => d.hasDetails).length}</div>
                            <div className="text-[10px] text-gray-500">Analyzed</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xl font-bold text-gray-400">{selectedDomains.size}</div>
                            <div className="text-[10px] text-gray-500">Selected</div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="ml-auto flex items-center gap-3">
                        {/* API Key Status / Test Button */}
                        <div className="flex items-center gap-2">
                            {apiKeyStatus.status === 'invalid' && (
                                <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                                    ❌ {apiKeyStatus.message}
                                </span>
                            )}
                            {apiKeyStatus.status === 'valid' && (
                                <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                                    {apiKeyStatus.message}
                                </span>
                            )}
                            <button
                                onClick={handleTestApiKey}
                                disabled={apiKeyStatus.status === 'testing'}
                                className={`px-3 py-2 rounded text-xs font-medium flex items-center gap-1 border ${apiKeyStatus.status === 'testing'
                                    ? 'bg-gray-100 text-gray-400 cursor-wait'
                                    : apiKeyStatus.status === 'invalid'
                                        ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                    }`}
                                title="Test if OpenAI API key is working"
                            >
                                {apiKeyStatus.status === 'testing' ? (
                                    <>
                                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Testing...
                                    </>
                                ) : (
                                    <>🔑 Test API Key</>
                                )}
                            </button>
                        </div>

                        {/* Main Action Button */}
                        <button
                            onClick={handleFetchAnalyze}
                            disabled={selectedDomains.size === 0 || fetchingDomains.size > 0}
                            className={`px-4 py-2 rounded text-sm font-medium flex items-center gap-2 ${selectedDomains.size === 0 || fetchingDomains.size > 0
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                }`}
                        >
                            {fetchingDomains.size > 0 ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    🔍 Fetch Sitemap & Analyse Intent (AI)
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Domain Table */}
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-2 py-2 text-left">
                                    <input
                                        type="checkbox"
                                        checked={selectedDomains.size === domains.length && domains.length > 0}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 rounded"
                                    />
                                </th>
                                <th className="px-2 py-2 text-left text-[9px] font-semibold text-gray-600 uppercase">Company</th>
                                <th className="px-2 py-2 text-left text-[9px] font-semibold text-gray-600 uppercase">Domain</th>
                                <th className="px-2 py-2 text-center text-[9px] font-semibold text-gray-600 uppercase">Pages</th>
                                <th className="px-2 py-2 text-center text-[9px] font-semibold text-blue-600 uppercase" title="Problem-Aware / Solution (TOFU)">TOFU-P</th>
                                <th className="px-2 py-2 text-center text-[9px] font-semibold text-blue-600 uppercase" title="Educational / Informational (TOFU)">TOFU-E</th>
                                <th className="px-2 py-2 text-center text-[9px] font-semibold text-amber-600 uppercase" title="Commercial Investigation (MOFU)">MOFU-C</th>
                                <th className="px-2 py-2 text-center text-[9px] font-semibold text-amber-600 uppercase" title="Trust & Proof (MOFU)">MOFU-T</th>
                                <th className="px-2 py-2 text-center text-[9px] font-semibold text-green-600 uppercase" title="Brand / Navigation (BOFU)">BOFU-B</th>
                                <th className="px-2 py-2 text-center text-[9px] font-semibold text-green-600 uppercase" title="Transactional (BOFU)">BOFU-T</th>
                                <th className="px-2 py-2 text-center text-[9px] font-semibold text-gray-600 uppercase">Summary</th>
                                <th className="px-2 py-2 text-center text-[9px] font-semibold text-gray-600 uppercase">Expand</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={12} className="px-6 py-8 text-center text-gray-500">Loading domains...</td>
                                </tr>
                            ) : sortedDomains.length === 0 ? (
                                <tr>
                                    <td colSpan={12} className="px-6 py-8 text-center text-gray-500">
                                        {selectedClient ? 'No domains found for this client.' : 'Please select a client.'}
                                    </td>
                                </tr>
                            ) : (
                                sortedDomains.map((d) => (
                                    <>
                                        <tr key={d.domain} className={`hover:bg-gray-50 ${fetchingDomains.has(d.domain) ? 'bg-yellow-50' : ''}`}>
                                            <td className="px-2 py-2">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedDomains.has(d.domain)}
                                                    onChange={() => toggleDomain(d.domain)}
                                                    disabled={fetchingDomains.has(d.domain)}
                                                    className="w-4 h-4 rounded"
                                                />
                                            </td>
                                            <td className="px-2 py-2 text-xs text-gray-700">{d.companyName}</td>
                                            <td className="px-2 py-2">
                                                <a
                                                    href={`https://${d.domain}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-indigo-600 hover:underline"
                                                >
                                                    {d.domain}
                                                </a>
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                {d.totalPages !== null ? (
                                                    <span className="text-xs font-semibold text-gray-700">{d.totalPages}</span>
                                                ) : (
                                                    <span className="text-xs text-gray-400">–</span>
                                                )}
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                <BucketCell count={d.problemAwareSolutionCount} percent={d.problemAwareSolutionPercent} hasData={d.hasDetails} />
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                <BucketCell count={d.educationalInformationalCount} percent={d.educationalInformationalPercent} hasData={d.hasDetails} />
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                <BucketCell count={d.commercialInvestigationCount} percent={d.commercialInvestigationPercent} hasData={d.hasDetails} />
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                <BucketCell count={d.trustProofCount} percent={d.trustProofPercent} hasData={d.hasDetails} />
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                <BucketCell count={d.brandNavigationCount} percent={d.brandNavigationPercent} hasData={d.hasDetails} />
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                <BucketCell count={d.transactionalCount} percent={d.transactionalPercent} hasData={d.hasDetails} />
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                <button
                                                    onClick={() => setSummaryModal(d)}
                                                    disabled={!d.hasDetails}
                                                    className={`px-2 py-1 text-[10px] rounded ${d.hasDetails
                                                        ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                        }`}
                                                >
                                                    Summary
                                                </button>
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                <button
                                                    onClick={() => toggleExpand(d.domain)}
                                                    disabled={!d.hasDetails}
                                                    className={`px-2 py-1 text-[10px] ${d.hasDetails
                                                        ? 'text-gray-600 hover:text-gray-800'
                                                        : 'text-gray-300 cursor-not-allowed'
                                                        }`}
                                                >
                                                    {expandedDomains.has(d.domain) ? '▲' : '▼'}
                                                </button>
                                            </td>
                                        </tr>
                                        {/* Expanded Row */}
                                        {expandedDomains.has(d.domain) && (
                                            <tr>
                                                <td colSpan={12} className="bg-gray-50 px-4 py-2">
                                                    <ExpandedPages
                                                        domain={d.domain}
                                                        pages={domainPages[d.domain] || []}
                                                        loading={loadingPages.has(d.domain)}
                                                    />
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Summary Modal */}
            {summaryModal && (
                <SummaryModal domain={summaryModal} onClose={() => setSummaryModal(null)} />
            )}
        </div>
    );
}

// Bucket cell component
function BucketCell({ count, percent, hasData }: { count: number; percent: number; hasData: boolean }) {
    if (!hasData) {
        return <span className="text-xs text-gray-300">–</span>;
    }

    return (
        <div className="flex flex-col items-center">
            <span className="text-xs font-medium text-gray-700">{count}</span>
            <span className="text-[9px] text-gray-400">{percent}%</span>
        </div>
    );
}

// Expanded pages table with filter
function ExpandedPages({ domain, pages, loading }: { domain: string; pages: PageIntentDetail[]; loading: boolean }) {
    const [intentFilter, setIntentFilter] = useState<string>('all');

    if (loading) {
        return <div className="text-xs text-gray-500 py-4 text-center">Loading pages...</div>;
    }

    if (pages.length === 0) {
        return <div className="text-xs text-gray-500 py-4 text-center">No pages found for {domain}</div>;
    }

    // Filter pages by intent
    const filteredPages = intentFilter === 'all'
        ? pages
        : pages.filter(p => p.intent === intentFilter);

    // Get unique intents for filter dropdown
    const uniqueIntents = Array.from(new Set(pages.map(p => p.intent)));

    return (
        <div>
            {/* Filter Bar */}
            <div className="flex items-center gap-3 mb-2 px-2">
                <label className="text-[10px] text-gray-500">Filter by Intent:</label>
                <select
                    value={intentFilter}
                    onChange={(e) => setIntentFilter(e.target.value)}
                    className="px-2 py-1 text-xs border rounded bg-white"
                >
                    <option value="all">All ({pages.length})</option>
                    {PAGE_INTENT_BUCKETS.filter(b => uniqueIntents.includes(b.code)).map(bucket => {
                        const count = pages.filter(p => p.intent === bucket.code).length;
                        return (
                            <option key={bucket.code} value={bucket.code}>
                                {bucket.label} ({count})
                            </option>
                        );
                    })}
                </select>
                <span className="text-[10px] text-gray-400">
                    Showing {filteredPages.length} of {pages.length} pages
                </span>
            </div>

            {/* Pages Table */}
            <div className="max-h-72 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100 sticky top-0">
                        <tr>
                            <th className="px-2 py-1 text-left text-[9px] font-semibold text-gray-500 w-8">#</th>
                            <th className="px-2 py-1 text-left text-[9px] font-semibold text-gray-500">Page URL (Sitemap)</th>
                            <th className="px-2 py-1 text-left text-[9px] font-semibold text-gray-500 w-48">Intent Bucket</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredPages.map((page, idx) => (
                            <tr key={page.id} className="hover:bg-gray-100">
                                <td className="px-2 py-1 text-[9px] text-gray-400">{idx + 1}</td>
                                <td className="px-2 py-1">
                                    <a
                                        href={page.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] text-indigo-600 hover:underline break-all"
                                        title={page.url}
                                    >
                                        {page.url}
                                    </a>
                                </td>
                                <td className="px-2 py-1">
                                    <span className={`px-1.5 py-0.5 text-[9px] rounded ${getIntentColor(page.intent)}`}>
                                        {getIntentLabel(page.intent)}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}


// Summary modal component
function SummaryModal({ domain, onClose }: { domain: DomainIntentSummaryRow; onClose: () => void }) {
    const buckets = [
        { label: 'Problem-Aware / Solution (TOFU)', count: domain.problemAwareSolutionCount, percent: domain.problemAwareSolutionPercent, stage: 'TOFU' },
        { label: 'Educational / Informational (TOFU)', count: domain.educationalInformationalCount, percent: domain.educationalInformationalPercent, stage: 'TOFU' },
        { label: 'Commercial Investigation (MOFU)', count: domain.commercialInvestigationCount, percent: domain.commercialInvestigationPercent, stage: 'MOFU' },
        { label: 'Trust & Proof (MOFU)', count: domain.trustProofCount, percent: domain.trustProofPercent, stage: 'MOFU' },
        { label: 'Brand / Navigation (BOFU)', count: domain.brandNavigationCount, percent: domain.brandNavigationPercent, stage: 'BOFU' },
        { label: 'Transactional (BOFU)', count: domain.transactionalCount, percent: domain.transactionalPercent, stage: 'BOFU' },
    ];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800">Intent Summary</h3>
                        <p className="text-sm text-gray-500">{domain.companyName} ({domain.domain})</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
                </div>

                <div className="p-4">
                    <table className="min-w-full">
                        <thead>
                            <tr className="border-b">
                                <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Bucket</th>
                                <th className="px-2 py-2 text-right text-xs font-semibold text-gray-600">Count</th>
                                <th className="px-2 py-2 text-right text-xs font-semibold text-gray-600">% of Total</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-32">Distribution</th>
                            </tr>
                        </thead>
                        <tbody>
                            {buckets.map((b, i) => (
                                <tr key={i} className="border-b last:border-0">
                                    <td className="px-2 py-2">
                                        <span className={`text-xs px-1.5 py-0.5 rounded ${getFunnelStageColor(b.stage)}`}>
                                            {b.label}
                                        </span>
                                    </td>
                                    <td className="px-2 py-2 text-right text-sm font-medium text-gray-700">{b.count}</td>
                                    <td className="px-2 py-2 text-right text-sm text-gray-600">{b.percent}%</td>
                                    <td className="px-2 py-2">
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full ${b.stage === 'TOFU' ? 'bg-blue-500' :
                                                    b.stage === 'MOFU' ? 'bg-amber-500' : 'bg-green-500'
                                                    }`}
                                                style={{ width: `${Math.min(b.percent, 100)}%` }}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gray-50">
                                <td className="px-2 py-2 text-xs font-bold text-gray-700">Total Pages</td>
                                <td className="px-2 py-2 text-right text-sm font-bold text-gray-700">{domain.totalPages}</td>
                                <td className="px-2 py-2 text-right text-sm font-bold text-gray-700">100%</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>

                    {/* Funnel Stage Summary */}
                    <div className="mt-4 pt-4 border-t">
                        <h4 className="text-xs font-semibold text-gray-600 mb-2">FUNNEL STAGE TOTALS</h4>
                        <div className="flex gap-4">
                            <div className="flex-1 bg-blue-50 rounded p-3 text-center">
                                <div className="text-lg font-bold text-blue-700">
                                    {domain.problemAwareSolutionCount + domain.educationalInformationalCount}
                                </div>
                                <div className="text-[10px] text-blue-600">TOFU ({domain.problemAwareSolutionPercent + domain.educationalInformationalPercent}%)</div>
                            </div>
                            <div className="flex-1 bg-amber-50 rounded p-3 text-center">
                                <div className="text-lg font-bold text-amber-700">
                                    {domain.commercialInvestigationCount + domain.trustProofCount}
                                </div>
                                <div className="text-[10px] text-amber-600">MOFU ({domain.commercialInvestigationPercent + domain.trustProofPercent}%)</div>
                            </div>
                            <div className="flex-1 bg-green-50 rounded p-3 text-center">
                                <div className="text-lg font-bold text-green-700">
                                    {domain.brandNavigationCount + domain.transactionalCount}
                                </div>
                                <div className="text-[10px] text-green-600">BOFU ({domain.brandNavigationPercent + domain.transactionalPercent}%)</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t bg-gray-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
