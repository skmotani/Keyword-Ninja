'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';

interface CmsPageRecord {
    id: string;
    clientCode: string;
    title: string;
    slug: string;
    status: 'draft' | 'review' | 'scheduled' | 'published' | 'archived';
    templateType: string;
    publishedAt: string | null;
    scheduledAt: string | null;
    createdAt: string;
    updatedAt: string;
    views: number;
}

const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    review: 'bg-yellow-100 text-yellow-800',
    scheduled: 'bg-blue-100 text-blue-800',
    published: 'bg-green-100 text-green-800',
    archived: 'bg-red-100 text-red-800',
};

export default function ClientPagesPage() {
    const params = useParams();
    const clientCode = params.clientCode as string;

    const [pages, setPages] = useState<CmsPageRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [clientName, setClientName] = useState<string>('');

    useEffect(() => {
        fetchClientInfo();
        fetchPages();
    }, [clientCode]); // eslint-disable-line react-hooks/exhaustive-deps

    async function fetchClientInfo() {
        try {
            const res = await fetch('/api/clients');
            const clients = await res.json();
            const client = clients.find((c: { code: string; name: string }) => c.code === clientCode);
            if (client) {
                setClientName(client.name);
            }
        } catch (error) {
            console.error('Failed to fetch client info:', error);
        }
    }

    async function fetchPages() {
        try {
            const res = await fetch(`/api/cms/clients/${clientCode}/pages`);
            if (!res.ok) throw new Error('Failed to fetch pages');
            const data = await res.json();
            setPages(data.pages || []);
        } catch (error) {
            console.error('Failed to fetch pages:', error);
            setPages([]);
        } finally {
            setLoading(false);
        }
    }

    const filteredPages = statusFilter === 'all'
        ? pages
        : pages.filter(p => p.status === statusFilter);

    const statusCounts = {
        all: pages.length,
        draft: pages.filter(p => p.status === 'draft').length,
        review: pages.filter(p => p.status === 'review').length,
        scheduled: pages.filter(p => p.status === 'scheduled').length,
        published: pages.filter(p => p.status === 'published').length,
        archived: pages.filter(p => p.status === 'archived').length,
    };

    if (loading) {
        return <div className="text-center py-8">Loading...</div>;
    }

    return (
        <div>
            <PageHeader
                title={`Pages - ${clientName || clientCode}`}
                description="Manage content pages for this client"
            />

            {/* Breadcrumb */}
            <div className="mb-4 text-sm text-gray-500">
                <Link href="/cms" className="hover:text-indigo-600">CMS</Link>
                {' > '}
                <span className="text-gray-900">{clientName || clientCode}</span>
                {' > '}
                <span className="text-gray-900">Pages</span>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex gap-2">
                    {Object.entries(statusCounts).map(([status, count]) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${statusFilter === status
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
                        </button>
                    ))}
                </div>

                <Link
                    href={`/cms/clients/${clientCode}/pages/new`}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors flex items-center gap-2"
                >
                    <span>+</span>
                    <span>New Page</span>
                </Link>
            </div>

            {/* Pages Table */}
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                {filteredPages.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                        <div className="text-gray-400 text-4xl mb-4">📄</div>
                        <div className="text-gray-600 mb-2">No pages yet</div>
                        <div className="text-sm text-gray-500 mb-4">
                            Create your first page or import topics from Intent Analysis.
                        </div>
                        <div className="flex justify-center gap-3">
                            <Link
                                href={`/cms/clients/${clientCode}/pages/new`}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm"
                            >
                                Create Page
                            </Link>
                            <Link
                                href={`/cms/clients/${clientCode}/topics`}
                                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 text-sm"
                            >
                                View Topics
                            </Link>
                        </div>
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slug</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Template</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Views</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredPages.map((page) => (
                                <tr key={page.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <Link
                                            href={`/cms/clients/${clientCode}/pages/${page.id}/edit`}
                                            className="font-medium text-gray-900 hover:text-indigo-600"
                                        >
                                            {page.title}
                                        </Link>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        /{page.slug}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 capitalize">
                                        {page.templateType}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs rounded-full ${statusColors[page.status]}`}>
                                            {page.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {(page.views ?? 0).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {new Date(page.updatedAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-sm space-x-2">
                                        <Link
                                            href={`/cms/clients/${clientCode}/pages/${page.id}/edit`}
                                            className="text-indigo-600 hover:text-indigo-800"
                                        >
                                            Edit
                                        </Link>
                                        {page.status === 'published' && (
                                            <Link
                                                href={`/feed/${clientCode}/${page.slug}`}
                                                target="_blank"
                                                className="text-green-600 hover:text-green-800"
                                            >
                                                View
                                            </Link>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
