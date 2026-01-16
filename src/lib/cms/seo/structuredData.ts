// CMS SEO - Structured Data (JSON-LD) Generator

export interface ArticleSchemaInput {
    title: string;
    description: string;
    url: string;
    image?: string;
    publishedAt: string;
    modifiedAt?: string;
    author?: {
        name: string;
        url?: string;
    };
    publisher: {
        name: string;
        logo?: string;
    };
}

export interface ProductSchemaInput {
    name: string;
    description: string;
    url: string;
    image: string;
    price: string;
    currency: string;
    availability: 'InStock' | 'OutOfStock' | 'PreOrder';
    brand?: string;
    sku?: string;
    rating?: {
        value: number;
        count: number;
    };
}

export interface FAQSchemaInput {
    questions: Array<{
        question: string;
        answer: string;
    }>;
}

export interface BreadcrumbSchemaInput {
    items: Array<{
        name: string;
        url: string;
    }>;
}

export interface LocalBusinessSchemaInput {
    name: string;
    description: string;
    url: string;
    phone?: string;
    email?: string;
    address?: {
        street: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
    };
    image?: string;
    priceRange?: string;
}

// Generate Article Schema (for blog posts)
export function generateArticleSchema(input: ArticleSchemaInput): object {
    return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: input.title,
        description: input.description,
        url: input.url,
        image: input.image,
        datePublished: input.publishedAt,
        dateModified: input.modifiedAt || input.publishedAt,
        author: input.author ? {
            '@type': 'Person',
            name: input.author.name,
            url: input.author.url,
        } : undefined,
        publisher: {
            '@type': 'Organization',
            name: input.publisher.name,
            logo: input.publisher.logo ? {
                '@type': 'ImageObject',
                url: input.publisher.logo,
            } : undefined,
        },
        mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': input.url,
        },
    };
}

// Generate Product Schema (for e-commerce)
export function generateProductSchema(input: ProductSchemaInput): object {
    const schema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: input.name,
        description: input.description,
        url: input.url,
        image: input.image,
        offers: {
            '@type': 'Offer',
            price: input.price,
            priceCurrency: input.currency,
            availability: `https://schema.org/${input.availability}`,
            url: input.url,
        },
    };

    if (input.brand) {
        schema.brand = {
            '@type': 'Brand',
            name: input.brand,
        };
    }

    if (input.sku) {
        schema.sku = input.sku;
    }

    if (input.rating) {
        schema.aggregateRating = {
            '@type': 'AggregateRating',
            ratingValue: input.rating.value,
            reviewCount: input.rating.count,
        };
    }

    return schema;
}

// Generate FAQ Schema
export function generateFAQSchema(input: FAQSchemaInput): object {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: input.questions.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer,
            },
        })),
    };
}

// Generate Breadcrumb Schema
export function generateBreadcrumbSchema(input: BreadcrumbSchemaInput): object {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: input.items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: item.url,
        })),
    };
}

// Generate LocalBusiness Schema
export function generateLocalBusinessSchema(input: LocalBusinessSchemaInput): object {
    const schema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: input.name,
        description: input.description,
        url: input.url,
        image: input.image,
        telephone: input.phone,
        email: input.email,
        priceRange: input.priceRange,
    };

    if (input.address) {
        schema.address = {
            '@type': 'PostalAddress',
            streetAddress: input.address.street,
            addressLocality: input.address.city,
            addressRegion: input.address.state,
            postalCode: input.address.postalCode,
            addressCountry: input.address.country,
        };
    }

    return schema;
}

// Generate WebSite Schema (for homepage)
export function generateWebsiteSchema(
    name: string,
    url: string,
    searchUrl?: string
): object {
    const schema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name,
        url,
    };

    if (searchUrl) {
        schema.potentialAction = {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: searchUrl,
            },
            'query-input': 'required name=search_term_string',
        };
    }

    return schema;
}

// Combine multiple schemas into a single LD+JSON script
export function combineSchemas(schemas: object[]): string {
    if (schemas.length === 1) {
        return JSON.stringify(schemas[0], null, 2);
    }

    return JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': schemas.map((schema) => {
            // Remove @context from nested schemas
            const { '@context': _, ...rest } = schema as Record<string, unknown>;
            return rest;
        }),
    }, null, 2);
}

// Render schema as script tag
export function renderSchemaScript(schemas: object | object[]): string {
    const schemaArray = Array.isArray(schemas) ? schemas : [schemas];
    const combined = combineSchemas(schemaArray);
    return `<script type="application/ld+json">${combined}</script>`;
}
