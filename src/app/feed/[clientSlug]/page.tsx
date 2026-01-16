// Feed Index Page - List of published pages
// /feed/[clientSlug]/page.tsx

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Metadata } from 'next';

interface PageProps {
    params: { clientSlug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { clientSlug } = params;

    const cmsConfig = await prisma.cmsClientConfig.findUnique({
        where: { slug: clientSlug },
        include: { client: true },
    });

    if (!cmsConfig) return {};

    return {
        title: `${cmsConfig.client.name} - Articles & Resources`,
        description: `Explore articles, guides, and resources from ${cmsConfig.client.name}`,
    };
}

export default async function FeedIndexPage({ params }: PageProps) {
    const { clientSlug } = params;

    // Get client config
    const cmsConfig = await prisma.cmsClientConfig.findUnique({
        where: { slug: clientSlug },
        include: {
            client: {
                include: {
                    cmsPages: {
                        where: { status: 'published' },
                        orderBy: { publishedAt: 'desc' },
                        include: {
                            template: {
                                select: { type: true },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!cmsConfig) {
        notFound();
    }

    const { client } = cmsConfig;
    const pages = client.cmsPages;

    return (
        <div className="feed-index max-w-4xl mx-auto px-4 py-12">
            {/* Header */}
            <header className="mb-12 text-center">
                {cmsConfig.logo && (
                    <img
                        src={cmsConfig.logo}
                        alt={client.name}
                        className="h-16 mx-auto mb-4"
                    />
                )}
                <h1 className="text-4xl font-bold text-gray-900 mb-2">
                    {client.name}
                </h1>
                <p className="text-lg text-gray-600">
                    Articles, Guides & Resources
                </p>
            </header>

            {/* Pages Grid */}
            {pages.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2">
                    {pages.map((page) => {
                        const content = page.content as {
                            hero?: { title?: string; subtitle?: string; image?: string };
                        };

                        return (
                            <Link
                                key={page.id}
                                href={`/feed/${clientSlug}/${page.slug}`}
                                className="block bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow overflow-hidden"
                            >
                                {content.hero?.image && (
                                    <div className="aspect-video bg-gray-100">
                                        <img
                                            src={content.hero.image}
                                            alt={page.title}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                )}
                                <div className="p-4">
                                    <div className="text-xs text-gray-500 mb-2 uppercase">
                                        {page.template.type}
                                    </div>
                                    <h2 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                                        {page.title}
                                    </h2>
                                    {page.metaDescription && (
                                        <p className="text-sm text-gray-600 line-clamp-2">
                                            {page.metaDescription}
                                        </p>
                                    )}
                                    <div className="mt-3 text-xs text-gray-400">
                                        {page.publishedAt?.toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                        })}
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-12 text-gray-500">
                    <p>No published articles yet.</p>
                </div>
            )}

            {/* Footer */}
            <footer className="mt-12 pt-8 border-t text-center text-sm text-gray-500">
                <p>© {new Date().getFullYear()} {client.name}. All rights reserved.</p>
            </footer>
        </div>
    );
}
