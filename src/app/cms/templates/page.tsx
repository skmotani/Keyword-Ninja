'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';

interface Template {
    id: string;
    name: string;
    slug: string;
    type: string;
    description: string;
    isSystem: boolean;
    isActive: boolean;
    thumbnail: string | null;
}

// Default system templates
const systemTemplates: Template[] = [
    {
        id: 'tpl_blog_default',
        name: 'Blog Article',
        slug: 'blog-default',
        type: 'blog',
        description: 'Standard blog post with hero, TOC, body content, FAQ section, author bio, and related posts.',
        isSystem: true,
        isActive: true,
        thumbnail: null,
    },
    {
        id: 'tpl_ecommerce_default',
        name: 'E-commerce Category',
        slug: 'ecommerce-default',
        type: 'ecommerce',
        description: 'Category page with hero banner, product grid, category description, and customer reviews.',
        isSystem: true,
        isActive: true,
        thumbnail: null,
    },
];

export default function TemplatesPage() {
    const [templates] = React.useState<Template[]>(systemTemplates);
    const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

    return (
        <div>
            <PageHeader
                title="Templates"
                description="Manage page templates for different content types"
            />

            {/* Breadcrumb */}
            <div className="mb-4 text-sm text-gray-500">
                <Link href="/cms" className="hover:text-indigo-600">CMS</Link>
                {' > '}
                <span className="text-gray-900">Templates</span>
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                    <span className="text-2xl">📄</span>
                    <div>
                        <div className="font-medium text-blue-900">Template System</div>
                        <div className="text-sm text-blue-700 mt-1">
                            Templates define the structure and layout of your CMS pages.
                            System templates are pre-built and cannot be deleted, but you can create custom templates.
                        </div>
                    </div>
                </div>
            </div>

            {/* Template Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map((template) => (
                    <div
                        key={template.id}
                        className="bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow"
                    >
                        {/* Thumbnail */}
                        <div className="h-40 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                            {template.thumbnail ? (
                                <img src={template.thumbnail} alt={template.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-6xl">
                                    {template.type === 'blog' ? '📝' : template.type === 'ecommerce' ? '🛒' : '📄'}
                                </div>
                            )}
                        </div>

                        {/* Content */}
                        <div className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold text-gray-900">{template.name}</h3>
                                <div className="flex gap-1">
                                    {template.isSystem && (
                                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">System</span>
                                    )}
                                    <span className={`text-xs px-2 py-0.5 rounded ${template.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                        {template.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            </div>

                            <div className="text-xs text-gray-500 mb-2 capitalize">
                                Type: {template.type}
                            </div>

                            <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                                {template.description}
                            </p>

                            <div className="flex gap-2">
                                <button
                                    className="flex-1 text-sm text-indigo-600 hover:text-indigo-800 py-2 border border-indigo-200 rounded hover:bg-indigo-50 transition-colors"
                                    onClick={() => setPreviewTemplate(template)}
                                >
                                    Preview
                                </button>
                                {!template.isSystem && (
                                    <button
                                        className="flex-1 text-sm text-gray-600 hover:text-gray-800 py-2 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                                    >
                                        Edit
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {/* Add Template Card */}
                <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center min-h-[280px] hover:border-gray-400 transition-colors cursor-not-allowed opacity-60">
                    <div className="text-center p-6">
                        <div className="text-4xl mb-2">➕</div>
                        <div className="font-medium text-gray-600">Create Template</div>
                        <div className="text-xs text-gray-500 mt-1">Coming in Phase 2</div>
                    </div>
                </div>
            </div>

            {/* Template Sections Preview */}
            <div className="mt-8">
                <h2 className="text-lg font-semibold mb-4">Template Sections Reference</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Blog Template */}
                    <div className="bg-white rounded-lg shadow-sm border p-4">
                        <h3 className="font-medium text-gray-900 mb-3">📝 Blog Article Sections</h3>
                        <ul className="space-y-2 text-sm text-gray-600">
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                                <span><strong>Hero:</strong> Title, subtitle, featured image</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                                <span><strong>TOC:</strong> Auto-generated table of contents</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                                <span><strong>Body:</strong> Rich text content with headings</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                                <span><strong>FAQ:</strong> Expandable question/answer pairs</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                                <span><strong>Author Bio:</strong> Author info and avatar</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                                <span><strong>Related Posts:</strong> Links to similar articles</span>
                            </li>
                        </ul>
                    </div>

                    {/* E-commerce Template */}
                    <div className="bg-white rounded-lg shadow-sm border p-4">
                        <h3 className="font-medium text-gray-900 mb-3">🛒 E-commerce Category Sections</h3>
                        <ul className="space-y-2 text-sm text-gray-600">
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                <span><strong>Hero:</strong> Category banner with CTA</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                <span><strong>Filters:</strong> Price, brand, attributes</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                <span><strong>Product Grid:</strong> Product cards with quick view</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                <span><strong>Category Description:</strong> SEO content block</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                <span><strong>Reviews:</strong> Customer testimonials</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                <span><strong>Related Categories:</strong> Cross-links</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            {previewTemplate && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-semibold">{previewTemplate.name} Preview</h2>
                            <button
                                onClick={() => setPreviewTemplate(null)}
                                className="text-gray-500 hover:text-gray-700 text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[60vh]">
                            <div className="text-6xl text-center mb-4">
                                {previewTemplate.type === 'blog' ? '📝' : '🛒'}
                            </div>
                            <h3 className="font-medium text-center mb-2">{previewTemplate.name}</h3>
                            <p className="text-sm text-gray-600 text-center mb-6">{previewTemplate.description}</p>

                            <h4 className="font-medium mb-3">Template Sections:</h4>
                            <ul className="space-y-2 text-sm">
                                {previewTemplate.type === 'blog' ? (
                                    <>
                                        <li className="flex items-center gap-2"><span className="w-2 h-2 bg-indigo-500 rounded-full"></span> Hero Section</li>
                                        <li className="flex items-center gap-2"><span className="w-2 h-2 bg-indigo-500 rounded-full"></span> Table of Contents</li>
                                        <li className="flex items-center gap-2"><span className="w-2 h-2 bg-indigo-500 rounded-full"></span> Main Body Content</li>
                                        <li className="flex items-center gap-2"><span className="w-2 h-2 bg-indigo-500 rounded-full"></span> FAQ Section</li>
                                        <li className="flex items-center gap-2"><span className="w-2 h-2 bg-indigo-500 rounded-full"></span> Author Bio</li>
                                        <li className="flex items-center gap-2"><span className="w-2 h-2 bg-indigo-500 rounded-full"></span> Related Posts</li>
                                    </>
                                ) : (
                                    <>
                                        <li className="flex items-center gap-2"><span className="w-2 h-2 bg-green-500 rounded-full"></span> Category Hero</li>
                                        <li className="flex items-center gap-2"><span className="w-2 h-2 bg-green-500 rounded-full"></span> Product Filters</li>
                                        <li className="flex items-center gap-2"><span className="w-2 h-2 bg-green-500 rounded-full"></span> Product Grid</li>
                                        <li className="flex items-center gap-2"><span className="w-2 h-2 bg-green-500 rounded-full"></span> Category Description</li>
                                        <li className="flex items-center gap-2"><span className="w-2 h-2 bg-green-500 rounded-full"></span> Customer Reviews</li>
                                    </>
                                )}
                            </ul>
                        </div>
                        <div className="p-4 border-t flex justify-end">
                            <button
                                onClick={() => setPreviewTemplate(null)}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
