'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';

interface ClientConfig {
    slug: string;
    logo: string;
    cfApiToken: string;
    cfZoneId: string;
    cfAccountId: string;
    defaultOgImage: string;
    robotsTxt: string;
    gaTrackingId: string;
    gscPropertyUrl: string;
    autoPublish: boolean;
    requireReview: boolean;
    openaiApiKey: string;
}

interface ClientInfo {
    code: string;
    name: string;
    mainDomain: string;
    domains: string[];
}

export default function ClientSettingsPage() {
    const params = useParams();
    const clientCode = params.clientCode as string;

    const [client, setClient] = useState<ClientInfo | null>(null);
    const [config, setConfig] = useState<Partial<ClientConfig>>({
        slug: '',
        autoPublish: false,
        requireReview: true,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    useEffect(() => {
        fetchClientInfo();
    }, [clientCode]); // eslint-disable-line react-hooks/exhaustive-deps

    async function fetchClientInfo() {
        try {
            const res = await fetch('/api/clients');
            const clients = await res.json();
            const found = clients.find((c: ClientInfo) => c.code === clientCode);
            if (found) {
                setClient(found);
                // Initialize slug from client code if not set
                setConfig(prev => ({
                    ...prev,
                    slug: prev.slug || found.code.toLowerCase().replace(/\s+/g, '-'),
                }));
            }
        } catch (error) {
            console.error('Failed to fetch client info:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        setSaving(true);
        try {
            // This will save to CmsClientConfig once DB is available
            // For now, just show success
            setNotification({ type: 'success', message: 'Settings saved (DB pending)' });
            setTimeout(() => setNotification(null), 3000);
        } catch (error) {
            setNotification({ type: 'error', message: 'Failed to save settings' });
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <div className="text-center py-8">Loading...</div>;
    }

    if (!client) {
        return <div className="text-center py-8 text-red-600">Client not found</div>;
    }

    return (
        <div>
            <PageHeader
                title={`Settings - ${client.name}`}
                description="Configure CMS and publishing settings for this client"
            />

            {/* Breadcrumb */}
            <div className="mb-4 text-sm text-gray-500">
                <Link href="/cms" className="hover:text-indigo-600">CMS</Link>
                {' > '}
                <span className="text-gray-900">{client.name}</span>
                {' > '}
                <span className="text-gray-900">Settings</span>
            </div>

            {notification && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${notification.type === 'success'
                        ? 'bg-green-50 text-green-800 border border-green-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                    {notification.message}
                </div>
            )}

            <div className="space-y-6">
                {/* CMS Slug */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h3 className="text-lg font-semibold mb-4">Feed URL</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Client Slug (for /feed/{'{slug}'})
                            </label>
                            <input
                                type="text"
                                value={config.slug || ''}
                                onChange={(e) => setConfig({ ...config, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                                placeholder="e.g., meera-industries"
                                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Pages will be served at: /feed/{config.slug || 'your-slug'}/page-slug
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Logo URL
                            </label>
                            <input
                                type="url"
                                value={config.logo || ''}
                                onChange={(e) => setConfig({ ...config, logo: e.target.value })}
                                placeholder="https://example.com/logo.png"
                                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                {/* SEO Settings */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h3 className="text-lg font-semibold mb-4">SEO Settings</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Default OG Image
                            </label>
                            <input
                                type="url"
                                value={config.defaultOgImage || ''}
                                onChange={(e) => setConfig({ ...config, defaultOgImage: e.target.value })}
                                placeholder="https://example.com/og-image.jpg"
                                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Google Analytics Tracking ID
                            </label>
                            <input
                                type="text"
                                value={config.gaTrackingId || ''}
                                onChange={(e) => setConfig({ ...config, gaTrackingId: e.target.value })}
                                placeholder="G-XXXXXXXXXX"
                                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Google Search Console Property URL
                            </label>
                            <input
                                type="url"
                                value={config.gscPropertyUrl || ''}
                                onChange={(e) => setConfig({ ...config, gscPropertyUrl: e.target.value })}
                                placeholder="https://example.com"
                                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Custom robots.txt
                            </label>
                            <textarea
                                value={config.robotsTxt || ''}
                                onChange={(e) => setConfig({ ...config, robotsTxt: e.target.value })}
                                placeholder="User-agent: *&#10;Allow: /"
                                rows={4}
                                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Publishing Settings */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h3 className="text-lg font-semibold mb-4">Publishing Settings</h3>
                    <div className="space-y-4">
                        <label className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={config.requireReview || false}
                                onChange={(e) => setConfig({ ...config, requireReview: e.target.checked })}
                                className="h-4 w-4 text-indigo-600 rounded"
                            />
                            <span className="text-sm text-gray-700">Require review before publishing</span>
                        </label>
                        <label className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={config.autoPublish || false}
                                onChange={(e) => setConfig({ ...config, autoPublish: e.target.checked })}
                                className="h-4 w-4 text-indigo-600 rounded"
                            />
                            <span className="text-sm text-gray-700">Auto-publish after review approval</span>
                        </label>
                    </div>
                </div>

                {/* Cloudflare Settings */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Cloudflare Integration</h3>
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Phase 6</span>
                    </div>
                    <div className="space-y-4 opacity-60">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Cloudflare API Token
                            </label>
                            <input
                                type="password"
                                value={config.cfApiToken || ''}
                                onChange={(e) => setConfig({ ...config, cfApiToken: e.target.value })}
                                placeholder="••••••••••••••••"
                                disabled
                                className="w-full px-3 py-2 border rounded-md bg-gray-50"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Zone ID
                                </label>
                                <input
                                    type="text"
                                    value={config.cfZoneId || ''}
                                    disabled
                                    className="w-full px-3 py-2 border rounded-md bg-gray-50"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Account ID
                                </label>
                                <input
                                    type="text"
                                    value={config.cfAccountId || ''}
                                    disabled
                                    className="w-full px-3 py-2 border rounded-md bg-gray-50"
                                />
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">
                            Cloudflare integration will be available in Phase 6.
                        </p>
                    </div>
                </div>

                {/* AI Content Settings */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">AI Content Generation</h3>
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Phase 3</span>
                    </div>
                    <div className="space-y-4 opacity-60">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                OpenAI API Key (Client-specific, optional)
                            </label>
                            <input
                                type="password"
                                value={config.openaiApiKey || ''}
                                disabled
                                placeholder="Uses system key if not set"
                                className="w-full px-3 py-2 border rounded-md bg-gray-50"
                            />
                        </div>
                        <p className="text-xs text-gray-500">
                            AI content generation will be available in Phase 3.
                        </p>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>
        </div>
    );
}
