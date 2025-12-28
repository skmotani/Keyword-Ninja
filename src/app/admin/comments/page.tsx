'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageComment } from '@/lib/db';

interface AdminComment extends PageComment {
    pagePath: string;
    isUpdating?: boolean;
}

export default function AdminCommentsPage() {
    const [comments, setComments] = useState<AdminComment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchComments();
    }, []);

    const fetchComments = async () => {
        try {
            const res = await fetch('/api/admin/comments');
            if (res.ok) {
                const data = await res.json();
                setComments(data);
            }
        } catch (error) {
            console.error('Failed to fetch comments:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = async (comment: AdminComment) => {
        const newStatus = comment.status === 'completed' ? 'pending' : 'completed';

        // Optimistic update
        setComments(prev => prev.map(c =>
            c.id === comment.id ? { ...c, status: newStatus, isUpdating: true } : c
        ));

        try {
            const res = await fetch('/api/admin/comments', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pagePath: comment.pagePath,
                    commentId: comment.id,
                    status: newStatus
                })
            });

            if (!res.ok) throw new Error('Failed to update');

        } catch (error) {
            console.error('Failed to update status', error);
            // Revert
            setComments(prev => prev.map(c =>
                c.id === comment.id ? { ...c, status: comment.status, isUpdating: false } : c
            ));
            alert('Failed to update status');
        } finally {
            setComments(prev => prev.map(c =>
                c.id === comment.id ? { ...c, isUpdating: false } : c
            ));
        }
    };

    const getAge = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        const diffYear = Math.floor(diffDay / 365);

        if (diffSec < 60) return `${diffSec}s ago`;
        if (diffMin < 60) return `${diffMin}m ago`;
        if (diffHour < 24) return `${diffHour}h ago`;
        if (diffDay < 365) return `${diffDay}d ago`;
        return `${diffYear}y ago`;
    };

    if (loading) return <div className="p-8">Loading Comments...</div>;

    const pendingCount = comments.filter(c => c.status !== 'completed').length;

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Comments & Tasks</h1>
                    <p className="text-gray-600">Manage comments and track pending tasks across all pages.</p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => {
                            setLoading(true);
                            fetchComments();
                        }}
                        className="px-4 py-2 bg-indigo-50 text-indigo-700 font-medium rounded-lg border border-indigo-200 hover:bg-indigo-100 flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                    <div className="bg-white px-4 py-2 rounded-lg border shadow-sm">
                        <span className="text-sm font-medium text-gray-500">Pending Tasks</span>
                        <div className="text-2xl font-bold text-indigo-600">{pendingCount}</div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comment / Task</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-64">Page</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Age</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">Date</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {comments.map((comment) => (
                            <tr key={comment.id} className={`hover:bg-gray-50 ${comment.status === 'completed' ? 'bg-gray-50 opacity-75' : ''}`}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <button
                                        onClick={() => toggleStatus(comment)}
                                        disabled={comment.isUpdating}
                                        className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-colors ${comment.status === 'completed'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-yellow-100 text-yellow-800'
                                            }`}
                                    >
                                        {comment.isUpdating ? '...' : (
                                            <>
                                                <input
                                                    type="checkbox"
                                                    checked={comment.status === 'completed'}
                                                    readOnly
                                                    className="h-3 w-3 rounded text-green-600 focus:ring-green-500 cursor-pointer pointer-events-none"
                                                />
                                                {comment.status === 'completed' ? 'Done' : 'Pending'}
                                            </>
                                        )}
                                    </button>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900 whitespace-pre-wrap">
                                    {comment.text}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <Link href={comment.pagePath} className="text-indigo-600 hover:text-indigo-900 hover:underline flex items-center gap-1">
                                        📄 {comment.pagePath}
                                    </Link>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {getAge(comment.createdAt)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(comment.createdAt).toLocaleDateString()}
                                    <span className="block text-xs text-gray-400">{new Date(comment.createdAt).toLocaleTimeString()}</span>
                                </td>
                            </tr>
                        ))}
                        {comments.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">No comments found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
