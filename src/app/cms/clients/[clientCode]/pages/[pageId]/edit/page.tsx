'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import dynamic from 'next/dynamic';
import type { SectionData } from '@/components/cms/editor/SectionEditor';

// Import SectionEditor dynamically
const SectionEditor = dynamic(
    () => import('@/components/cms/editor/SectionEditor'),
    { ssr: false }
);

// Import AIPromptPanel dynamically
const AIPromptPanel = dynamic(
    () => import('@/components/cms/editor/AIPromptPanel'),
    { ssr: false }
);

interface PageData {
    id: string;
    title: string;
    slug: string;
    metaDescription: string;
    metaKeywords: string;
    content: Record<string, unknown>;
    status: string;
    template: { id: string; type: string; name: string };
    topic?: { id: string; name: string; primaryKeyword: string };
}

export default function EditPageEditor() {
    const params = useParams();
    const router = useRouter();
    const clientCode = params.clientCode as string;
    const pageId = params.pageId as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [clientName, setClientName] = useState('');
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [activeTab, setActiveTab] = useState<'content' | 'seo'>('content');

    const [pageData, setPageData] = useState<PageData | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        slug: '',
        metaDescription: '',
        metaKeywords: '',
        sections: [] as SectionData[],
        status: 'draft',
    });

    useEffect(() => {
        fetchPageData();
    }, [pageId]); // eslint-disable-line react-hooks/exhaustive-deps

    async function fetchPageData() {
        try {
            const res = await fetch(`/api/cms/clients/${clientCode}/pages/${pageId}`);
            if (!res.ok) throw new Error('Page not found');

            const data = await res.json();
            setPageData(data);
            setClientName(data.client?.name || clientCode);

            // Convert content to sections
            const content = data.content || {};
            const sections: SectionData[] = [];
            let order = 0;

            // Hero section
            if (content.hero !== undefined) {
                sections.push({
                    id: 'hero',
                    type: 'hero',
                    title: 'Hero Section',
                    content: typeof content.hero === 'string' ? content.hero : JSON.stringify(content.hero),
                    order: order++,
                    isRequired: true,
                });
            }

            // Body section
            if (content.body !== undefined) {
                sections.push({
                    id: 'body',
                    type: 'body',
                    title: 'Main Content',
                    content: content.body as string,
                    order: order++,
                    isRequired: true,
                });
            }

            // FAQ section
            if (content.faq !== undefined) {
                sections.push({
                    id: 'faq',
                    type: 'faq',
                    title: 'FAQ Section',
                    content: typeof content.faq === 'string' ? content.faq : JSON.stringify(content.faq),
                    order: order++,
                });
            }

            // Category description (e-commerce)
            if (content.category_desc !== undefined) {
                sections.push({
                    id: 'category_desc',
                    type: 'category_desc',
                    title: 'Category Description',
                    content: content.category_desc as string,
                    order: order++,
                });
            }

            setFormData({
                title: data.title,
                slug: data.slug,
                metaDescription: data.metaDescription || '',
                metaKeywords: data.metaKeywords || '',
                sections,
                status: data.status,
            });
        } catch (error) {
            console.error('Failed to fetch page:', error);
            setNotification({ type: 'error', message: 'Failed to load page' });
        } finally {
            setLoading(false);
        }
    }

    async function handleSave(newStatus?: string) {
        if (!formData.title.trim()) {
            setNotification({ type: 'error', message: 'Title is required' });
            return;
        }

        setSaving(true);
        try {
            // Build content object from sections
            const content: Record<string, unknown> = {};
            formData.sections.forEach((section) => {
                if (section.type === 'hero' || section.type === 'faq') {
                    try {
                        content[section.type] = JSON.parse(section.content || '{}');
                    } catch {
                        content[section.type] = section.content;
                    }
                } else {
                    content[section.type] = section.content;
                }
            });

            const res = await fetch(`/api/cms/clients/${clientCode}/pages/${pageId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: formData.title,
                    slug: formData.slug,
                    content,
                    metaDescription: formData.metaDescription,
                    metaKeywords: formData.metaKeywords,
                    status: newStatus || formData.status,
                    changeNote: 'Updated via editor',
                }),
            });

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.error || 'Failed to save page');
            }

            setFormData((prev) => ({ ...prev, status: newStatus || prev.status }));
            setNotification({ type: 'success', message: 'Page saved successfully' });
        } catch (error) {
            setNotification({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to save page',
            });
        } finally {
            setSaving(false);
        }
    }

    async function handlePublish(action: string) {
        setSaving(true);
        try {
            const res = await fetch(`/api/cms/clients/${clientCode}/pages/${pageId}/publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.error || 'Failed to update status');
            }

            setFormData((prev) => ({ ...prev, status: result.page.status }));
            setNotification({ type: 'success', message: `Page ${action}ed successfully` });
        } catch (error) {
            setNotification({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to update status',
            });
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        setDeleting(true);
        try {
            const res = await fetch(`/api/cms/clients/${clientCode}/pages/${pageId}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                throw new Error('Failed to delete page');
            }

            router.push(`/cms/clients/${clientCode}/pages`);
        } catch (error) {
            setNotification({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to delete page',
            });
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    }

    if (loading) {
        return <div className="text-center py-8">Loading page...</div>;
    }

    if (!pageData) {
        return (
            <div className="text-center py-8">
                <p className="text-gray-500">Page not found</p>
                <Link href={`/cms/clients/${clientCode}/pages`} className="text-indigo-600 hover:underline">
                    Back to pages
                </Link>
            </div>
        );
    }

    const statusColors: Record<string, string> = {
        draft: 'bg-gray-100 text-gray-700',
        review: 'bg-yellow-100 text-yellow-700',
        scheduled: 'bg-blue-100 text-blue-700',
        published: 'bg-green-100 text-green-700',
        archived: 'bg-red-100 text-red-700',
    };

    return (
        <div>
            <PageHeader
                title={`Edit: ${formData.title || 'Untitled'}`}
                description={clientName}
            />

            {/* Breadcrumb */}
            <div className="mb-4 text-sm text-gray-500">
                <Link href="/cms" className="hover:text-indigo-600">CMS</Link>
                {' > '}
                <Link href={`/cms/clients/${clientCode}/pages`} className="hover:text-indigo-600">
                    {clientName}
                </Link>
                {' > '}
                <span className="text-gray-900">Edit Page</span>
            </div>

            {notification && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${notification.type === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                    {notification.message}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Title */}
                    <div className="bg-white rounded-lg shadow-sm border p-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Page Title *
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-md text-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                    </div>

                    {/* Tabs */}
                    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                        <div className="flex border-b">
                            <button
                                onClick={() => setActiveTab('content')}
                                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'content'
                                    ? 'bg-white border-b-2 border-indigo-600 text-indigo-600'
                                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                📝 Content
                            </button>
                            <button
                                onClick={() => setActiveTab('seo')}
                                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'seo'
                                    ? 'bg-white border-b-2 border-indigo-600 text-indigo-600'
                                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                🔍 SEO Settings
                            </button>
                        </div>

                        <div className="p-4">
                            {activeTab === 'content' ? (
                                <SectionEditor
                                    sections={formData.sections}
                                    onChange={(sections) => setFormData((prev) => ({ ...prev, sections }))}
                                    templateType={pageData.template.type as 'blog' | 'ecommerce'}
                                />
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            URL Slug
                                        </label>
                                        <div className="flex items-center">
                                            <span className="text-gray-500 text-sm mr-2">
                                                /feed/{clientCode}/
                                            </span>
                                            <input
                                                type="text"
                                                value={formData.slug}
                                                onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                                                className="flex-1 px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Meta Description
                                        </label>
                                        <textarea
                                            value={formData.metaDescription}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, metaDescription: e.target.value }))}
                                            rows={3}
                                            maxLength={300}
                                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                        />
                                        <div className="text-xs text-gray-500 mt-1">
                                            {formData.metaDescription.length}/160 characters
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Meta Keywords
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.metaKeywords}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, metaKeywords: e.target.value }))}
                                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Status */}
                    <div className="bg-white rounded-lg shadow-sm border p-4">
                        <h3 className="font-medium text-gray-900 mb-3">Status</h3>
                        <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-md ${statusColors[formData.status]}`}>
                            <span className="capitalize font-medium">{formData.status}</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="bg-white rounded-lg shadow-sm border p-4 space-y-3">
                        <button
                            onClick={() => handleSave()}
                            disabled={saving}
                            className="w-full py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : '💾 Save Changes'}
                        </button>

                        {formData.status === 'draft' && (
                            <>
                                <button
                                    onClick={() => handlePublish('submit_review')}
                                    disabled={saving}
                                    className="w-full py-2 bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200 transition-colors disabled:opacity-50"
                                >
                                    👁️ Submit for Review
                                </button>
                                <button
                                    onClick={() => handlePublish('publish')}
                                    disabled={saving}
                                    className="w-full py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                                >
                                    ✅ Publish Now
                                </button>
                            </>
                        )}

                        {formData.status === 'review' && (
                            <button
                                onClick={() => handlePublish('publish')}
                                disabled={saving}
                                className="w-full py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                                ✅ Approve & Publish
                            </button>
                        )}

                        {formData.status === 'published' && (
                            <>
                                <Link
                                    href={`/feed/${clientCode}/${formData.slug}`}
                                    target="_blank"
                                    className="block w-full py-2 text-center bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                                >
                                    🔗 View Live Page
                                </Link>
                                <button
                                    onClick={() => handlePublish('unpublish')}
                                    disabled={saving}
                                    className="w-full py-2 bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50"
                                >
                                    🔒 Unpublish
                                </button>
                            </>
                        )}
                    </div>

                    {/* Delete Page */}
                    <div className="bg-white rounded-lg shadow-sm border p-4">
                        <h3 className="font-medium text-gray-900 mb-3">Danger Zone</h3>
                        {!showDeleteConfirm ? (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="w-full py-2 text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                            >
                                🗑️ Delete Page
                            </button>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-sm text-red-600">Are you sure? This cannot be undone.</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleDelete}
                                        disabled={deleting}
                                        className="flex-1 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                                    >
                                        {deleting ? 'Deleting...' : 'Yes, Delete'}
                                    </button>
                                    <button
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="flex-1 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* AI Regenerate (for published/draft) */}
                    {pageData.topic && (
                        <AIPromptPanel
                            templateType={pageData.template.type as 'blog' | 'ecommerce'}
                            topic={formData.title}
                            primaryKeyword={pageData.topic.primaryKeyword || formData.title}
                            keywords={[]}
                            searchVolume={0}
                            intentType="informational"
                            clientInfo={{ name: clientName, industry: 'General' }}
                            disabled={saving}
                            onGenerated={(data) => {
                                const updatedSections = formData.sections.map((section) => {
                                    if (section.type === 'hero' && data.hero) {
                                        return { ...section, content: JSON.stringify(data.hero) };
                                    }
                                    if (section.type === 'body' && data.body) {
                                        return { ...section, content: data.body };
                                    }
                                    if (section.type === 'faq' && data.faqs) {
                                        return { ...section, content: JSON.stringify(data.faqs) };
                                    }
                                    return section;
                                });
                                setFormData((prev) => ({
                                    ...prev,
                                    sections: updatedSections,
                                    metaDescription: data.meta?.description || prev.metaDescription,
                                    metaKeywords: data.meta?.keywords || prev.metaKeywords,
                                }));
                                setNotification({ type: 'success', message: 'AI content regenerated!' });
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
