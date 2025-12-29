'use client';

import React, { useState, useEffect, useMemo } from 'react';

// Types
interface Client { id: string; code: string; name: string; domains?: string[]; isActive: boolean; }
interface Competitor { id: string; clientCode: string; name: string; domain: string; isActive: boolean; }

interface DomainData {
    domain: string;
    type: 'client' | 'competitor';
    name: string;
    organicKeywordsCount: number | null;
    organicTraffic: number | null;
    organicCost: number | null;
}

export default function DomainGapAnalysisPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [competitors, setCompetitors] = useState<Competitor[]>([]);
    const [clientCode, setClientCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [domains, setDomains] = useState<DomainData[]>([]);

    // Selected domains for comparison
    const [selectedClient, setSelectedClient] = useState<string>('');
    const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);

    // Load clients and competitors
    useEffect(() => {
        fetch('/api/clients').then(r => r.json()).then(d => {
            const list = (d.clients || d || []).filter((c: Client) => c.isActive);
            setClients(list);
            const m = list.find((c: Client) => c.name.toUpperCase().includes('MEERA') && !c.name.includes('CCP'));
            setClientCode(m?.code || list[0]?.code || '');
        });
        fetch('/api/competitors').then(r => r.json()).then(d => setCompetitors(d.competitors || d || []));
    }, []);

    // Get current client
    const client = useMemo(() => clients.find(c => c.code === clientCode), [clients, clientCode]);

    // Get client domains
    const clientDomains = useMemo(() => {
        return client?.domains?.map(d => d.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '')) || [];
    }, [client]);

    // Get competitor domains for this client
    const competitorDomains = useMemo(() => {
        return competitors
            .filter(c => c.clientCode === clientCode && c.isActive)
            .map(c => ({
                domain: c.domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, ''),
                name: c.name
            }));
    }, [competitors, clientCode]);

    // Format number with K/M suffix
    const fmt = (n: number | null | undefined) => {
        if (n === null || n === undefined) return '-';
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return n.toLocaleString();
    };

    const fmtUSD = (n: number | null | undefined) => {
        if (n === null || n === undefined) return '-';
        if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
        return '$' + n.toLocaleString();
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Domain Gap Analysis</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Compare your domains with competitors to identify keyword gaps and opportunities
                    </p>
                </div>

                {/* Client Selector */}
                <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
                    <div className="flex items-center gap-4 flex-wrap">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Client</label>
                            <select
                                value={clientCode}
                                onChange={e => setClientCode(e.target.value)}
                                className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {clients.map(c => (
                                    <option key={c.code} value={c.code}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="border-l pl-4">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Your Domains</label>
                            <div className="flex gap-2 flex-wrap">
                                {clientDomains.map(d => (
                                    <span key={d} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                                        {d}
                                    </span>
                                ))}
                                {clientDomains.length === 0 && (
                                    <span className="text-gray-400 text-xs">No domains configured</span>
                                )}
                            </div>
                        </div>

                        <div className="border-l pl-4">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Competitors</label>
                            <div className="flex gap-2 flex-wrap">
                                {competitorDomains.slice(0, 5).map(c => (
                                    <span key={c.domain} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                        {c.domain}
                                    </span>
                                ))}
                                {competitorDomains.length > 5 && (
                                    <span className="text-gray-400 text-xs">+{competitorDomains.length - 5} more</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Domain Selection for Gap Analysis */}
                <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">Select Domains to Compare</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Client Domain Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                🔵 Your Domain (Target)
                            </label>
                            <select
                                value={selectedClient}
                                onChange={e => setSelectedClient(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Select your domain...</option>
                                {clientDomains.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                        </div>

                        {/* Competitor Domain Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                ⚪ Competitor Domains (Compare Against)
                            </label>
                            <div className="border rounded-lg p-3 max-h-48 overflow-y-auto bg-gray-50">
                                {competitorDomains.map(c => (
                                    <label key={c.domain} className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-white rounded px-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedCompetitors.includes(c.domain)}
                                            onChange={e => {
                                                if (e.target.checked) {
                                                    setSelectedCompetitors([...selectedCompetitors, c.domain]);
                                                } else {
                                                    setSelectedCompetitors(selectedCompetitors.filter(d => d !== c.domain));
                                                }
                                            }}
                                            className="w-4 h-4 rounded"
                                        />
                                        <span className="text-sm text-gray-700">{c.domain}</span>
                                        <span className="text-xs text-gray-400">({c.name})</span>
                                    </label>
                                ))}
                                {competitorDomains.length === 0 && (
                                    <p className="text-gray-400 text-sm">No competitors configured for this client</p>
                                )}
                            </div>
                            <div className="mt-2 flex gap-2">
                                <button
                                    onClick={() => setSelectedCompetitors(competitorDomains.map(c => c.domain))}
                                    className="text-xs text-blue-600 hover:underline"
                                >
                                    Select All
                                </button>
                                <span className="text-gray-300">|</span>
                                <button
                                    onClick={() => setSelectedCompetitors([])}
                                    className="text-xs text-red-600 hover:underline"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Run Analysis Button */}
                    <div className="mt-6 flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                            {selectedClient && selectedCompetitors.length > 0 ? (
                                <span className="text-green-600">
                                    ✓ Ready to analyze: {selectedClient} vs {selectedCompetitors.length} competitor{selectedCompetitors.length > 1 ? 's' : ''}
                                </span>
                            ) : (
                                <span className="text-amber-600">
                                    ⚠ Select your domain and at least one competitor
                                </span>
                            )}
                        </div>
                        <button
                            disabled={!selectedClient || selectedCompetitors.length === 0}
                            className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${selectedClient && selectedCompetitors.length > 0
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            🔍 Run Gap Analysis
                        </button>
                    </div>
                </div>

                {/* Placeholder for Results */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">Gap Analysis Results</h2>
                    <div className="text-center py-12 text-gray-400">
                        <div className="text-4xl mb-3">📊</div>
                        <p className="text-sm">Select domains above and run analysis to see keyword gaps</p>
                        <p className="text-xs mt-2">
                            This will show keywords your competitors rank for but you don't
                        </p>
                    </div>
                </div>

                {/* Info Box */}
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-blue-800 mb-2">💡 What is Domain Gap Analysis?</h3>
                    <p className="text-xs text-blue-700">
                        Domain Gap Analysis identifies keywords that your competitors are ranking for, but your website is not.
                        This helps you discover new keyword opportunities and content gaps that you can target to improve your SEO visibility.
                    </p>
                </div>
            </div>
        </div>
    );
}
