'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';

interface CmsTopic {
    id: string;
    clientCode: string;
    name: string;
    slug: string;
    primaryKeyword: string;
    searchVolume: number;
    intentType: string | null;
    intentScore: number | null;
    status: 'pending' | 'in_progress' | 'completed' | 'skipped';
    priority: number;
    createdAt: string;
}

const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    skipped: 'bg-red-100 text-red-800',
};

const intentColors: Record<string, string> = {
    informational: 'bg-blue-50 text-blue-700 border-blue-200',
    transactional: 'bg-green-50 text-green-700 border-green-200',
    navigational: 'bg-purple-50 text-purple-700 border-purple-200',
    commercial: 'bg-orange-50 text-orange-700 border-orange-200',
};

export default function ClientTopicsPage() {
    const params = useParams();
    const clientCode = params.clientCode as string;

    const [topics, setTopics] = useState<CmsTopic[]>([]);
    const [loading, setLoading] = useState(true);
    const [clientName, setClientName] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    useEffect(() => {
        fetchClientInfo();
        fetchTopics();
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

    async function fetchTopics() {
        try {
            const res = await fetch(`/api/cms/clients/${clientCode}/topics`);
            if (!res.ok) throw new Error('Failed to fetch topics');
            const data = await res.json();
            setTopics(data.topics || []);
        } catch (error) {
            console.error('Failed to fetch topics:', error);
            setTopics([]);
        } finally {
            setLoading(false);
        }
    }

    const filteredTopics = statusFilter === 'all'
        ? topics
        : topics.filter(t => t.status === statusFilter);

    const statusCounts = {
        all: topics.length,
        pending: topics.filter(t => t.status === 'pending').length,
        in_progress: topics.filter(t => t.status === 'in_progress').length,
        completed: topics.filter(t => t.status === 'completed').length,
        skipped: topics.filter(t => t.status === 'skipped').length,
    };

    if (loading) {
        return <div className="text-center py-8">Loading...</div>;
    }

    return (
        <div>
            <PageHeader
                title={`Topics Queue - ${clientName || clientCode}`}
                description="Topics from Intent Analysis ready for content creation"
            />

            {/* Breadcrumb */}
            <div className="mb-4 text-sm text-gray-500">
                <Link href="/cms" className="hover:text-indigo-600">CMS</Link>
                {' > '}
                <span className="text-gray-900">{clientName || clientCode}</span>
                {' > '}
                <span className="text-gray-900">Topics</span>
            </div>

            {/* Info Banner */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                    <span className="text-2xl">💡</span>
                    <div>
                        <div className="font-medium text-purple-900">Topics come from Intent Analysis</div>
                        <div className="text-sm text-purple-700 mt-1">
                            Topics are automatically imported when you run Intent Analysis on client keywords.
                            Each topic represents a content opportunity based on keyword clusters and search intent.
                        </div>
                        <Link
                            href={`/keywords/cluster-intent-studio`}
                            className="inline-block mt-2 text-sm text-purple-600 hover:text-purple-800 underline"
                        >
                            Go to Cluster & Intent Studio →
                        </Link>
                    </div>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex gap-2">
                    {Object.entries(statusCounts).map(([status, count]) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${statusFilter === status
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)} ({count})
                        </button>
                    ))}
                </div>
                <Link
                    href={`/keywords/cluster-intent-studio?client=${clientCode}`}
                    className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 text-sm"
                >
                    + Import Topics
                </Link>
            </div>

            {/* Topics Table */}
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                {filteredTopics.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                        <div className="text-gray-400 text-4xl mb-4">📋</div>
                        <div className="text-gray-600 mb-2">No topics in queue</div>
                        <div className="text-sm text-gray-500 mb-4">
                            Run Intent Analysis on client keywords to generate topics for content creation.
                        </div>
                        <Link
                            href={`/keywords/cluster-intent-studio?client=${clientCode}`}
                            className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 text-sm inline-block"
                        >
                            Go to Cluster & Intent Studio
                        </Link>
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Topic</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Primary Keyword</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Volume</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Intent</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredTopics.map((topic) => (
                                <tr key={topic.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900">{topic.name}</div>
                                        <div className="text-xs text-gray-500">/{topic.slug}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900">
                                        {topic.primaryKeyword}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {topic.searchVolume.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        {topic.intentType && (
                                            <span className={`px-2 py-1 text-xs rounded border ${intentColors[topic.intentType] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                                                {topic.intentType}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs rounded-full ${statusColors[topic.status]}`}>
                                            {topic.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {topic.priority}
                                    </td>
                                    <td className="px-6 py-4 text-sm space-x-2">
                                        {topic.status === 'pending' && (
                                            <Link
                                                href={`/cms/clients/${clientCode}/pages/new?topicId=${topic.id}`}
                                                className="text-indigo-600 hover:text-indigo-800"
                                            >
                                                Create Page
                                            </Link>
                                        )}
                                        {topic.status === 'completed' && (
                                            <span className="text-green-600">✓ Page Created</span>
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
