'use client';

import React from 'react';

// E-Commerce Category Template Component for rendering published pages
// This will be used in /feed/[clientSlug]/[pageSlug]

interface Product {
    id: string;
    name: string;
    image: string;
    price: string;
    originalPrice?: string;
    rating?: number;
    reviewCount?: number;
    url: string;
}

interface Review {
    author: string;
    rating: number;
    text: string;
    date: string;
}

interface EcommerceCategoryData {
    title: string;
    metaDescription: string;
    heroImage?: string;
    heroSubtitle?: string;
    heroCta?: {
        text: string;
        url: string;
    };
    products: Product[];
    categoryDescription: string;
    reviews: Review[];
    filters?: {
        brands: string[];
        priceRanges: string[];
    };
    publishedAt: string;
}

interface EcommerceTemplateProps {
    data: EcommerceCategoryData;
    clientSlug: string;
}

// Star Rating Component
const StarRating: React.FC<{ rating: number }> = ({ rating }) => (
    <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
            <span
                key={star}
                className={star <= rating ? 'text-yellow-400' : 'text-gray-300'}
            >
                ★
            </span>
        ))}
    </div>
);

export default function EcommerceTemplate({
    data,
    clientSlug,
}: EcommerceTemplateProps) {
    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Hero Section */}
            <header className="relative rounded-xl overflow-hidden mb-12">
                {data.heroImage ? (
                    <div className="aspect-[3/1] relative">
                        <img
                            src={data.heroImage}
                            alt={data.title}
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent flex items-center">
                            <div className="p-8 md:p-12 max-w-2xl text-white">
                                <h1 className="text-3xl md:text-5xl font-bold mb-4">
                                    {data.title}
                                </h1>
                                {data.heroSubtitle && (
                                    <p className="text-lg md:text-xl mb-6 opacity-90">
                                        {data.heroSubtitle}
                                    </p>
                                )}
                                {data.heroCta && (
                                    <a
                                        href={data.heroCta.url}
                                        className="inline-block bg-white text-gray-900 font-medium px-6 py-3 rounded-lg hover:bg-gray-100 transition-colors"
                                    >
                                        {data.heroCta.text}
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 py-12 px-8 text-white">
                        <h1 className="text-3xl md:text-5xl font-bold mb-4">{data.title}</h1>
                        {data.heroSubtitle && (
                            <p className="text-lg md:text-xl opacity-90">{data.heroSubtitle}</p>
                        )}
                    </div>
                )}
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Sidebar Filters */}
                {data.filters && (
                    <aside className="lg:col-span-1">
                        <div className="sticky top-4 space-y-6">
                            {/* Brand Filter */}
                            {data.filters.brands && data.filters.brands.length > 0 && (
                                <div className="bg-white rounded-lg border p-4">
                                    <h3 className="font-semibold text-gray-900 mb-3">Brands</h3>
                                    <div className="space-y-2">
                                        {data.filters.brands.map((brand) => (
                                            <label key={brand} className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" className="rounded text-indigo-600" />
                                                <span className="text-sm text-gray-700">{brand}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Price Range Filter */}
                            {data.filters.priceRanges && data.filters.priceRanges.length > 0 && (
                                <div className="bg-white rounded-lg border p-4">
                                    <h3 className="font-semibold text-gray-900 mb-3">Price Range</h3>
                                    <div className="space-y-2">
                                        {data.filters.priceRanges.map((range) => (
                                            <label key={range} className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" name="price" className="text-indigo-600" />
                                                <span className="text-sm text-gray-700">{range}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </aside>
                )}

                {/* Main Content */}
                <main className={data.filters ? 'lg:col-span-3' : 'lg:col-span-4'}>
                    {/* Product Count */}
                    <div className="flex items-center justify-between mb-6">
                        <p className="text-gray-600">
                            Showing <strong>{data.products.length}</strong> products
                        </p>
                        <select className="border rounded-lg px-3 py-2 text-sm">
                            <option>Sort by: Featured</option>
                            <option>Price: Low to High</option>
                            <option>Price: High to Low</option>
                            <option>Customer Rating</option>
                        </select>
                    </div>

                    {/* Product Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                        {data.products.map((product) => (
                            <a
                                key={product.id}
                                href={product.url}
                                className="bg-white rounded-lg border overflow-hidden group hover:shadow-lg transition-shadow"
                            >
                                <div className="aspect-square overflow-hidden">
                                    <img
                                        src={product.image}
                                        alt={product.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                    />
                                </div>
                                <div className="p-4">
                                    <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">
                                        {product.name}
                                    </h3>
                                    {product.rating && (
                                        <div className="flex items-center gap-2 mb-2">
                                            <StarRating rating={product.rating} />
                                            {product.reviewCount && (
                                                <span className="text-xs text-gray-500">
                                                    ({product.reviewCount})
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-bold text-gray-900">
                                            {product.price}
                                        </span>
                                        {product.originalPrice && (
                                            <span className="text-sm text-gray-500 line-through">
                                                {product.originalPrice}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </a>
                        ))}
                    </div>

                    {/* Category Description */}
                    {data.categoryDescription && (
                        <section className="mb-12 bg-gray-50 rounded-lg p-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">
                                About {data.title}
                            </h2>
                            <div
                                className="prose max-w-none text-gray-600"
                                dangerouslySetInnerHTML={{ __html: data.categoryDescription }}
                            />
                        </section>
                    )}

                    {/* Customer Reviews */}
                    {data.reviews && data.reviews.length > 0 && (
                        <section>
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">
                                Customer Reviews
                            </h2>
                            <div className="space-y-4">
                                {data.reviews.map((review, index) => (
                                    <div key={index} className="bg-white rounded-lg border p-6">
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <div className="font-medium text-gray-900">
                                                    {review.author}
                                                </div>
                                                <StarRating rating={review.rating} />
                                            </div>
                                            <time className="text-sm text-gray-500">{review.date}</time>
                                        </div>
                                        <p className="text-gray-600">{review.text}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </main>
            </div>

            {/* JSON-LD Structured Data */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'CollectionPage',
                        name: data.title,
                        description: data.metaDescription,
                        url: `https://example.com/feed/${clientSlug}`,
                    }),
                }}
            />

            {/* Product Schema */}
            {data.products.length > 0 && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            '@context': 'https://schema.org',
                            '@type': 'ItemList',
                            itemListElement: data.products.map((product, index) => ({
                                '@type': 'ListItem',
                                position: index + 1,
                                item: {
                                    '@type': 'Product',
                                    name: product.name,
                                    image: product.image,
                                    url: product.url,
                                },
                            })),
                        }),
                    }}
                />
            )}
        </div>
    );
}
