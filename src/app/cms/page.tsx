'use client';

import React from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';

const cmsHelpInfo = {
    title: 'CMS Dashboard',
    description: 'Central hub for managing your client content. Create SEO-optimized pages from topics, manage templates, and publish to client websites.',
    whyWeAddedThis: 'After Intent Analysis generates topics, the CMS allows you to transform those topics into fully optimized, publishable web pages.',
    examples: ['Create blog posts from informational keywords', 'Build product pages for transactional keywords'],
    nuances: 'Pages are server-rendered and served from /feed/{clientSlug}/ for Cloudflare reverse proxy.',
    useCases: [
        'Generate AI-powered content from topics',
        'Review and edit before publishing',
        'Schedule content for future publication',
        'Track page performance'
    ]
};

interface ClientSummary {
    code: string;
    name: string;
    pagesCount: number;
    topicsCount: number;
    publishedCount: number;
    draftCount: number;
}

export default function CmsDashboardPage() {
    const [clients, setClients] = React.useState<ClientSummary[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        fetchClients();
    }, []);

    async function fetchClients() {
        try {
            const res = await fetch('/api/clients');
            const data = await res.json();
            // For now, just map client data - CMS stats will come from CMS tables later
            const clientSummaries: ClientSummary[] = data.map((c: { code: string; name: string }) => ({
                code: c.code,
                name: c.name,
                pagesCount: 0,
                topicsCount: 0,
                publishedCount: 0,
                draftCount: 0,
            }));
            setClients(clientSummaries);
        } catch (error) {
            console.error('Failed to fetch clients:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return <div className="text-center py-8">Loading...</div>;
    }

    return (
        <div>
            <PageHeader
                title="CMS Dashboard"
                description="Manage content for all your clients"
                helpInfo={cmsHelpInfo}
            />

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-lg shadow-sm border p-4">
                    <div className="text-2xl font-bold text-indigo-600">{clients.length}</div>
                    <div className="text-sm text-gray-600">Total Clients</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border p-4">
                    <div className="text-2xl font-bold text-green-600">
                        {clients.reduce((sum, c) => sum + c.publishedCount, 0)}
                    </div>
                    <div className="text-sm text-gray-600">Published Pages</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border p-4">
                    <div className="text-2xl font-bold text-yellow-600">
                        {clients.reduce((sum, c) => sum + c.draftCount, 0)}
                    </div>
                    <div className="text-sm text-gray-600">Draft Pages</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border p-4">
                    <div className="text-2xl font-bold text-purple-600">
                        {clients.reduce((sum, c) => sum + c.topicsCount, 0)}
                    </div>
                    <div className="text-sm text-gray-600">Pending Topics</div>
                </div>
            </div>

            {/* Client List */}
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <div className="px-6 py-4 border-b bg-gray-50">
                    <h2 className="text-lg font-semibold">Clients</h2>
                </div>

                {clients.length === 0 ? (
                    <div className="px-6 py-8 text-center text-gray-500">
                        No clients found. Add clients in the <Link href="/clients" className="text-indigo-600 hover:underline">Client Master</Link> first.
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pages</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Published</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Drafts</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Topics Queue</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {clients.map((client) => (
                                <tr key={client.code} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="font-medium text-gray-900">{client.name}</div>
                                        <div className="text-sm text-gray-500">Code: {client.code}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {client.pagesCount}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                                            {client.publishedCount}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
                                            {client.draftCount}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">
                                            {client.topicsCount}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                                        <Link
                                            href={`/cms/clients/${client.code}/pages`}
                                            className="text-indigo-600 hover:text-indigo-800"
                                        >
                                            Pages
                                        </Link>
                                        <Link
                                            href={`/cms/clients/${client.code}/topics`}
                                            className="text-purple-600 hover:text-purple-800"
                                        >
                                            Topics
                                        </Link>
                                        <Link
                                            href={`/cms/clients/${client.code}/settings`}
                                            className="text-gray-600 hover:text-gray-800"
                                        >
                                            Settings
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Quick Actions */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link
                    href="/cms/templates"
                    className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow"
                >
                    <div className="text-lg font-semibold text-gray-900 mb-2">📄 Templates</div>
                    <div className="text-sm text-gray-600">
                        Manage page templates for blogs, e-commerce, and landing pages.
                    </div>
                </Link>

                <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-6 opacity-60">
                    <div className="text-lg font-semibold text-gray-500 mb-2">🤖 AI Content Engine</div>
                    <div className="text-sm text-gray-500">
                        Coming in Phase 3 - Generate content with AI prompts.
                    </div>
                </div>

                <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-6 opacity-60">
                    <div className="text-lg font-semibold text-gray-500 mb-2">☁️ Cloudflare Setup</div>
                    <div className="text-sm text-gray-500">
                        Coming in Phase 6 - Configure DNS and deployment.
                    </div>
                </div>
            </div>
        </div>
    );
}
