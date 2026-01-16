// Server-rendered Feed Page
// /feed/[clientSlug]/[pageSlug]/page.tsx

import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Metadata } from 'next';
import {
    generateArticleSchema,
    generateFAQSchema,
    combineSchemas,
} from '@/lib/cms/seo/structuredData';

interface PageProps {
    params: { clientSlug: string; pageSlug: string };
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { clientSlug, pageSlug } = params;

    const cmsConfig = await prisma.cmsClientConfig.findUnique({
        where: { slug: clientSlug },
        include: { client: true },
    });

    if (!cmsConfig) return {};

    const page = await prisma.cmsPage.findUnique({
        where: {
            clientCode_slug: {
                clientCode: cmsConfig.clientCode,
                slug: pageSlug,
            },
        },
    });

    if (!page || page.status !== 'published') return {};

    return {
        title: page.ogTitle || page.title,
        description: page.ogDescription || page.metaDescription || '',
        keywords: page.metaKeywords || '',
        openGraph: {
            title: page.ogTitle || page.title,
            description: page.ogDescription || page.metaDescription || '',
            images: page.ogImage ? [page.ogImage] : cmsConfig.defaultOgImage ? [cmsConfig.defaultOgImage] : [],
            url: `https://${cmsConfig.client.mainDomain}/feed/${clientSlug}/${pageSlug}`,
            type: 'article',
        },
        alternates: {
            canonical: page.canonicalUrl || undefined,
        },
    };
}

// Static params for build (optional - for static generation)
// During Docker build, DATABASE_URL may not be available, so we return empty array
export async function generateStaticParams() {
    try {
        const configs = await prisma.cmsClientConfig.findMany({
            include: {
                client: {
                    include: {
                        cmsPages: {
                            where: { status: 'published' },
                            select: { slug: true },
                        },
                    },
                },
            },
        });

        const paths: Array<{ clientSlug: string; pageSlug: string }> = [];

        for (const config of configs) {
            for (const page of config.client.cmsPages) {
                paths.push({
                    clientSlug: config.slug,
                    pageSlug: page.slug,
                });
            }
        }

        return paths;
    } catch {
        // Database not available during build - return empty array for dynamic rendering
        return [];
    }
}

export default async function FeedPage({ params }: PageProps) {
    const { clientSlug, pageSlug } = params;

    // Get client config by slug
    const cmsConfig = await prisma.cmsClientConfig.findUnique({
        where: { slug: clientSlug },
        include: { client: true },
    });

    if (!cmsConfig) {
        notFound();
    }

    // Get page
    const page = await prisma.cmsPage.findUnique({
        where: {
            clientCode_slug: {
                clientCode: cmsConfig.clientCode,
                slug: pageSlug,
            },
        },
        include: {
            template: true,
        },
    });

    if (!page || page.status !== 'published') {
        notFound();
    }

    // Increment view count (async, don't wait)
    prisma.cmsPage.update({
        where: { id: page.id },
        data: { views: { increment: 1 } },
    }).catch(() => { }); // Ignore errors

    // Parse content
    const content = page.content as {
        hero?: { title?: string; subtitle?: string; image?: string };
        body?: string;
        faq?: Array<{ question: string; answer: string }>;
        author?: { name?: string; bio?: string; image?: string };
        categoryDescription?: string;
    };

    // Build structured data
    const schemas = [];

    // Article schema
    schemas.push(
        generateArticleSchema({
            title: page.title,
            description: page.metaDescription || '',
            url: `https://${cmsConfig.client.mainDomain}/feed/${clientSlug}/${pageSlug}`,
            image: content.hero?.image || page.ogImage || undefined,
            publishedAt: page.publishedAt?.toISOString() || new Date().toISOString(),
            modifiedAt: page.updatedAt.toISOString(),
            author: content.author?.name ? { name: content.author.name } : undefined,
            publisher: {
                name: cmsConfig.client.name,
                logo: cmsConfig.logo || undefined,
            },
        })
    );

    // FAQ schema if FAQs exist
    if (content.faq && content.faq.length > 0) {
        schemas.push(generateFAQSchema({ questions: content.faq }));
    }

    const structuredData = combineSchemas(schemas);

    return (
        <>
            {/* Structured Data */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: structuredData }}
            />

            <article className="feed-page">
                {/* Hero Section */}
                {content.hero && (
                    <header className="hero-section">
                        {content.hero.image && (
                            <div className="hero-image">
                                <img
                                    src={content.hero.image}
                                    alt={content.hero.title || page.title}
                                    className="w-full h-auto"
                                />
                            </div>
                        )}
                        <div className="hero-content max-w-4xl mx-auto px-4 py-12">
                            <h1 className="text-4xl font-bold text-gray-900 mb-4">
                                {content.hero.title || page.title}
                            </h1>
                            {content.hero.subtitle && (
                                <p className="text-xl text-gray-600">{content.hero.subtitle}</p>
                            )}
                            <div className="mt-4 text-sm text-gray-500">
                                Published: {page.publishedAt?.toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                })}
                            </div>
                        </div>
                    </header>
                )}

                {/* Main Body Content */}
                <main className="body-section max-w-4xl mx-auto px-4 py-8">
                    {content.body && (
                        <div
                            className="prose prose-lg max-w-none"
                            dangerouslySetInnerHTML={{ __html: content.body }}
                        />
                    )}

                    {content.categoryDescription && (
                        <div
                            className="prose prose-lg max-w-none"
                            dangerouslySetInnerHTML={{ __html: content.categoryDescription }}
                        />
                    )}
                </main>

                {/* FAQ Section */}
                {content.faq && content.faq.length > 0 && (
                    <section className="faq-section max-w-4xl mx-auto px-4 py-8 bg-gray-50">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">
                            Frequently Asked Questions
                        </h2>
                        <div className="space-y-4">
                            {content.faq.map((item, index) => (
                                <details
                                    key={index}
                                    className="bg-white rounded-lg shadow-sm border p-4"
                                >
                                    <summary className="font-medium text-gray-900 cursor-pointer">
                                        {item.question}
                                    </summary>
                                    <p className="mt-3 text-gray-600">{item.answer}</p>
                                </details>
                            ))}
                        </div>
                    </section>
                )}

                {/* Author Bio */}
                {content.author && content.author.name && (
                    <footer className="author-section max-w-4xl mx-auto px-4 py-8 border-t">
                        <div className="flex items-center gap-4">
                            {content.author.image && (
                                <img
                                    src={content.author.image}
                                    alt={content.author.name}
                                    className="w-16 h-16 rounded-full"
                                />
                            )}
                            <div>
                                <div className="font-medium text-gray-900">
                                    {content.author.name}
                                </div>
                                {content.author.bio && (
                                    <p className="text-sm text-gray-600">{content.author.bio}</p>
                                )}
                            </div>
                        </div>
                    </footer>
                )}
            </article>

            {/* Analytics tracking (if configured) */}
            {cmsConfig.gaTrackingId && (
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${cmsConfig.gaTrackingId}');
            `,
                    }}
                />
            )}
        </>
    );
}
