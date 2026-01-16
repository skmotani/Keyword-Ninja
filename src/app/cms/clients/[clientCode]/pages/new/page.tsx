'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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

interface PageFormData {
    title: string;
    slug: string;
    metaDescription: string;
    metaKeywords: string;
    templateId: string;
    templateType: 'blog' | 'ecommerce';
    sections: SectionData[];
    status: string;
    // AI-related fields
    primaryKeyword: string;
    keywords: string[];
    searchVolume: number;
    intentType: string;
}

// Default sections for blog template
const blogSections: SectionData[] = [
    { id: 'hero', type: 'hero', title: 'Hero Section', content: '{}', order: 0, isRequired: true },
    { id: 'toc', type: 'toc', title: 'Table of Contents', content: '', order: 1 },
    { id: 'body', type: 'body', title: 'Main Content', content: '', order: 2, isRequired: true },
    { id: 'faq', type: 'faq', title: 'FAQ Section', content: '[]', order: 3 },
    { id: 'author', type: 'author', title: 'Author Bio', content: '', order: 4 },
    { id: 'related', type: 'related', title: 'Related Posts', content: '', order: 5 },
];

// Default sections for e-commerce template
const ecommerceSections: SectionData[] = [
    { id: 'hero', type: 'hero', title: 'Category Hero', content: '{}', order: 0, isRequired: true },
    { id: 'filters', type: 'filters', title: 'Filters', content: '', order: 1 },
    { id: 'product_grid', type: 'product_grid', title: 'Product Grid', content: '', order: 2, isRequired: true },
    { id: 'category_desc', type: 'category_desc', title: 'Category Description', content: '', order: 3 },
    { id: 'reviews', type: 'reviews', title: 'Customer Reviews', content: '', order: 4 },
];

export default function NewPageEditor() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const clientCode = params.clientCode as string;
    const topicId = searchParams.get('topicId');

    const [clientName, setClientName] = useState<string>('');
    const [clientIndustry, setClientIndustry] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'content' | 'seo'>('content');
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const [formData, setFormData] = useState<PageFormData>({
        title: '',
        slug: '',
        metaDescription: '',
        metaKeywords: '',
        templateId: 'tpl_blog_default',
        templateType: 'blog',
        sections: blogSections,
        status: 'draft',
        // AI-related fields
        primaryKeyword: '',
        keywords: [],
        searchVolume: 0,
        intentType: 'informational',
    });

    useEffect(() => {
        fetchClientInfo();
        if (topicId) {
            fetchTopicInfo();
        }
    }, [clientCode, topicId]); // eslint-disable-line react-hooks/exhaustive-deps

    async function fetchClientInfo() {
        try {
            const res = await fetch('/api/clients');
            const clients = await res.json();
            const client = clients.find((c: { code: string; name: string; industry?: string }) => c.code === clientCode);
            if (client) {
                setClientName(client.name);
                setClientIndustry(client.industry || 'General');
            }
        } catch (error) {
            console.error('Failed to fetch client info:', error);
        }
    }

    async function fetchTopicInfo() {
        if (!topicId) return;
        try {
            const res = await fetch(`/api/cms/clients/${clientCode}/topics`);
            const data = await res.json();
            const topic = data.topics?.find((t: { id: string }) => t.id === topicId);
            if (topic) {
                setFormData((prev) => ({
                    ...prev,
                    title: topic.name,
                    slug: topic.slug,
                    primaryKeyword: topic.primaryKeyword,
                    keywords: topic.keywords || [],
                    searchVolume: topic.searchVolume || 0,
                    intentType: topic.intentType || 'informational',
                }));
            }
        } catch (error) {
            console.error('Failed to fetch topic info:', error);
        }
    }

    function handleTemplateChange(templateType: 'blog' | 'ecommerce') {
        setFormData((prev) => ({
            ...prev,
            templateType,
            templateId: templateType === 'blog' ? 'tpl_blog_default' : 'tpl_ecommerce_default',
            sections: templateType === 'blog' ? blogSections : ecommerceSections,
        }));
    }

    function generateSlug(title: string): string {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }

    async function handleSave(status: string = 'draft') {
        if (!formData.title.trim()) {
            setNotification({ type: 'error', message: 'Title is required' });
            return;
        }

        if (!formData.slug.trim()) {
            setNotification({ type: 'error', message: 'URL slug is required' });
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

            // Get template ID from API (fetch real template)
            const templatesRes = await fetch('/api/cms/templates');
            const templatesData = await templatesRes.json();
            const template = templatesData.templates?.find(
                (t: { type: string }) => t.type === formData.templateType
            );
            const templateId = template?.id;

            if (!templateId) {
                // Seed templates if none exist
                await fetch('/api/cms/templates/seed', { method: 'POST' });
                setNotification({ type: 'error', message: 'Templates were seeded. Please try again.' });
                setSaving(false);
                return;
            }

            // Save page via API
            const res = await fetch(`/api/cms/clients/${clientCode}/pages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: formData.title,
                    slug: formData.slug,
                    templateId,
                    topicId: topicId || undefined,
                    content,
                    metaDescription: formData.metaDescription,
                    metaKeywords: formData.metaKeywords,
                    status,
                }),
            });

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.error || 'Failed to save page');
            }

            setNotification({ type: 'success', message: `Page saved as ${status}` });
            setTimeout(() => {
                router.push(`/cms/clients/${clientCode}/pages`);
            }, 1500);
        } catch (error) {
            setNotification({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to save page'
            });
        } finally {
            setSaving(false);
        }
    }

    return (
        <div>
            <PageHeader
                title="Create New Page"
                description={clientName || clientCode}
            />

            {/* Breadcrumb */}
            <div className="mb-4 text-sm text-gray-500">
                <Link href="/cms" className="hover:text-indigo-600">CMS</Link>
                {' > '}
                <Link href={`/cms/clients/${clientCode}/pages`} className="hover:text-indigo-600">
                    {clientName || clientCode}
                </Link>
                {' > '}
                <span className="text-gray-900">New Page</span>
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
                            onChange={(e) => {
                                const title = e.target.value;
                                setFormData((prev) => ({
                                    ...prev,
                                    title,
                                    slug: prev.slug || generateSlug(title),
                                }));
                            }}
                            placeholder="Enter page title..."
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
                                    templateType={formData.templateType}
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
                                                onChange={(e) =>
                                                    setFormData((prev) => ({ ...prev, slug: e.target.value }))
                                                }
                                                placeholder="page-url-slug"
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
                                            onChange={(e) =>
                                                setFormData((prev) => ({ ...prev, metaDescription: e.target.value }))
                                            }
                                            placeholder="Brief description for search results (160 chars recommended)"
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
                                            onChange={(e) =>
                                                setFormData((prev) => ({ ...prev, metaKeywords: e.target.value }))
                                            }
                                            placeholder="keyword1, keyword2, keyword3"
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
                    {/* Template Selection */}
                    <div className="bg-white rounded-lg shadow-sm border p-4">
                        <h3 className="font-medium text-gray-900 mb-3">Template</h3>
                        <div className="space-y-2">
                            <button
                                onClick={() => handleTemplateChange('blog')}
                                className={`w-full p-3 rounded-md border text-left transition-colors ${formData.templateType === 'blog'
                                    ? 'border-indigo-500 bg-indigo-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <div className="font-medium">📝 Blog Article</div>
                                <div className="text-xs text-gray-500">Hero, TOC, Body, FAQ, Author</div>
                            </button>
                            <button
                                onClick={() => handleTemplateChange('ecommerce')}
                                className={`w-full p-3 rounded-md border text-left transition-colors ${formData.templateType === 'ecommerce'
                                    ? 'border-indigo-500 bg-indigo-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <div className="font-medium">🛒 E-Commerce Category</div>
                                <div className="text-xs text-gray-500">Hero, Grid, Description, Reviews</div>
                            </button>
                        </div>
                    </div>

                    {/* Status */}
                    <div className="bg-white rounded-lg shadow-sm border p-4">
                        <h3 className="font-medium text-gray-900 mb-3">Status</h3>
                        <div className="px-3 py-2 bg-gray-100 rounded-md text-sm">
                            <span className="inline-flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                                Draft
                            </span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="bg-white rounded-lg shadow-sm border p-4 space-y-3">
                        <button
                            onClick={() => handleSave('draft')}
                            disabled={saving}
                            className="w-full py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save Draft'}
                        </button>
                        <button
                            onClick={() => handleSave('review')}
                            disabled={saving}
                            className="w-full py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                            Submit for Review
                        </button>
                    </div>

                    {/* AI Generate Panel */}
                    <AIPromptPanel
                        templateType={formData.templateType}
                        topic={formData.title}
                        primaryKeyword={formData.primaryKeyword || formData.title}
                        keywords={formData.keywords}
                        searchVolume={formData.searchVolume}
                        intentType={formData.intentType}
                        clientInfo={{
                            name: clientName || 'Company',
                            industry: clientIndustry || 'General',
                        }}
                        disabled={!formData.title}
                        onGenerated={(data) => {
                            // Apply generated content to sections
                            const updatedSections = formData.sections.map((section) => {
                                if (section.type === 'hero' && data.hero) {
                                    return { ...section, content: JSON.stringify(data.hero) };
                                }
                                if ((section.type === 'body' || section.type === 'category_desc') && data.body) {
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
                                title: prev.title || data.hero?.title || prev.title,
                            }));

                            setNotification({ type: 'success', message: 'AI content generated! Review and edit as needed.' });
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
