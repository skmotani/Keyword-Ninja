'use client';

import React from 'react';

// Blog Template Component for rendering published pages
// This will be used in /feed/[clientSlug]/[pageSlug]

interface BlogPageData {
    title: string;
    metaDescription: string;
    heroImage?: string;
    heroSubtitle?: string;
    bodyContent: string;
    faqs: Array<{ question: string; answer: string }>;
    author?: {
        name: string;
        bio: string;
        image?: string;
    };
    relatedPosts?: Array<{
        title: string;
        slug: string;
        image?: string;
    }>;
    publishedAt: string;
    readingTime?: number;
}

interface BlogTemplateProps {
    data: BlogPageData;
    clientSlug: string;
}

export default function BlogTemplate({ data, clientSlug }: BlogTemplateProps) {
    return (
        <article className="max-w-4xl mx-auto px-4 py-8">
            {/* Hero Section */}
            <header className="mb-12">
                {data.heroImage && (
                    <div className="aspect-video rounded-xl overflow-hidden mb-8">
                        <img
                            src={data.heroImage}
                            alt={data.title}
                            className="w-full h-full object-cover"
                        />
                    </div>
                )}
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                    {data.title}
                </h1>
                {data.heroSubtitle && (
                    <p className="text-xl text-gray-600 mb-6">{data.heroSubtitle}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-gray-500">
                    {data.author && (
                        <div className="flex items-center gap-2">
                            {data.author.image && (
                                <img
                                    src={data.author.image}
                                    alt={data.author.name}
                                    className="w-8 h-8 rounded-full"
                                />
                            )}
                            <span>{data.author.name}</span>
                        </div>
                    )}
                    <span>•</span>
                    <time>
                        {new Date(data.publishedAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                        })}
                    </time>
                    {data.readingTime && (
                        <>
                            <span>•</span>
                            <span>{data.readingTime} min read</span>
                        </>
                    )}
                </div>
            </header>

            {/* Table of Contents */}
            <nav className="mb-12 p-6 bg-gray-50 rounded-lg">
                <h2 className="text-lg font-semibold mb-4">Table of Contents</h2>
                <div id="toc-placeholder" className="text-sm text-gray-600">
                    {/* TOC will be generated from body content headings */}
                    <p className="italic">Auto-generated from page headings</p>
                </div>
            </nav>

            {/* Main Content */}
            <div
                className="prose prose-lg max-w-none mb-12"
                dangerouslySetInnerHTML={{ __html: data.bodyContent }}
            />

            {/* FAQ Section */}
            {data.faqs && data.faqs.length > 0 && (
                <section className="mb-12">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">
                        Frequently Asked Questions
                    </h2>
                    <div className="space-y-4">
                        {data.faqs.map((faq, index) => (
                            <details
                                key={index}
                                className="border rounded-lg overflow-hidden group"
                            >
                                <summary className="px-6 py-4 cursor-pointer font-medium text-gray-900 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between">
                                    {faq.question}
                                    <span className="text-gray-400 group-open:rotate-180 transition-transform">
                                        ▼
                                    </span>
                                </summary>
                                <div className="px-6 py-4 text-gray-600">{faq.answer}</div>
                            </details>
                        ))}
                    </div>
                </section>
            )}

            {/* Author Bio */}
            {data.author && (
                <section className="mb-12 p-6 bg-gray-50 rounded-lg flex items-start gap-6">
                    {data.author.image && (
                        <img
                            src={data.author.image}
                            alt={data.author.name}
                            className="w-20 h-20 rounded-full"
                        />
                    )}
                    <div>
                        <h3 className="font-semibold text-gray-900 mb-2">
                            About {data.author.name}
                        </h3>
                        <p className="text-gray-600">{data.author.bio}</p>
                    </div>
                </section>
            )}

            {/* Related Posts */}
            {data.relatedPosts && data.relatedPosts.length > 0 && (
                <section>
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">
                        Related Articles
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {data.relatedPosts.map((post, index) => (
                            <a
                                key={index}
                                href={`/feed/${clientSlug}/${post.slug}`}
                                className="group"
                            >
                                {post.image && (
                                    <div className="aspect-video rounded-lg overflow-hidden mb-3">
                                        <img
                                            src={post.image}
                                            alt={post.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                        />
                                    </div>
                                )}
                                <h3 className="font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
                                    {post.title}
                                </h3>
                            </a>
                        ))}
                    </div>
                </section>
            )}

            {/* JSON-LD Structured Data */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'Article',
                        headline: data.title,
                        description: data.metaDescription,
                        image: data.heroImage,
                        datePublished: data.publishedAt,
                        author: data.author
                            ? {
                                '@type': 'Person',
                                name: data.author.name,
                            }
                            : undefined,
                    }),
                }}
            />

            {/* FAQ Schema */}
            {data.faqs && data.faqs.length > 0 && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            '@context': 'https://schema.org',
                            '@type': 'FAQPage',
                            mainEntity: data.faqs.map((faq) => ({
                                '@type': 'Question',
                                name: faq.question,
                                acceptedAnswer: {
                                    '@type': 'Answer',
                                    text: faq.answer,
                                },
                            })),
                        }),
                    }}
                />
            )}
        </article>
    );
}
