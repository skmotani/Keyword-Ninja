import { ClientAIProfile, PageClassificationConfig, PatternWithExamples } from '@/types';

const DEFAULT_PRODUCT_SLUG_PATTERNS = [
  'product', 'products', 'machine', 'machines', 'equipment', 'item', 'items',
  'model', 'models', 'solution', 'device', 'devices', 'tool', 'tools',
  'service', 'services', 'offering', 'offerings'
];

const DEFAULT_CATEGORY_SLUG_PATTERNS = [
  'category', 'categories', 'industry', 'industries', 'application', 'applications',
  'solutions', 'segments', 'markets', 'use-cases', 'use-case', 'product-category',
  'collection', 'collections', 'sector', 'sectors'
];

const DEFAULT_BLOG_SLUG_PATTERNS = [
  'blog', 'news', 'article', 'articles', 'insights', 'resources', 'stories',
  'magazine', 'press', 'media', 'post', 'posts', 'updates'
];

const DEFAULT_RESOURCE_SLUG_PATTERNS = [
  'guide', 'guides', 'tutorial', 'tutorials', 'whitepaper', 'whitepapers',
  'ebook', 'ebooks', 'documentation', 'docs', 'manual', 'manuals', 'handbook',
  'datasheet', 'datasheets', 'brochure', 'brochures', 'download', 'downloads',
  'technical-document', 'pdf'
];

const DEFAULT_SUPPORT_SLUG_PATTERNS = [
  'contact', 'support', 'help', 'faq', 'faqs', 'customer-service',
  'dealer-locator', 'enquiry', 'inquiry', 'service-center', 'assistance'
];

const DEFAULT_LEGAL_SLUG_PATTERNS = [
  'privacy', 'privacy-policy', 'terms', 'terms-of-service', 'tos',
  'cookies', 'cookie-policy', 'disclaimer', 'legal', 'gdpr', 'policy', 'policies'
];

const DEFAULT_ACCOUNT_SLUG_PATTERNS = [
  'login', 'signin', 'sign-in', 'signup', 'sign-up', 'account', 'my-account',
  'dashboard', 'auth', 'register', 'logout', 'profile', 'settings'
];

const DEFAULT_CAREERS_SLUG_PATTERNS = [
  'career', 'careers', 'job', 'jobs', 'vacancy', 'vacancies', 'join-our-team',
  'hiring', 'openings', 'work-with-us', 'employment', 'positions'
];

const DEFAULT_ABOUT_COMPANY_SLUG_PATTERNS = [
  'about', 'about-us', 'our-story', 'company', 'who-we-are', 'team',
  'leadership', 'management', 'history', 'mission', 'vision', 'values'
];

const DEFAULT_MARKETING_LANDING_PATTERNS = [
  'landing', 'campaign', 'promo', 'offer', 'special', 'lp', 'get-started',
  'demo', 'trial', 'free-trial', 'webinar', 'event', 'promotion'
];

const DEFAULT_CONFIG: PageClassificationConfig = {
  brandNames: [],
  productKeywords: [],
  serviceKeywords: [],
  blogMarkers: [
    'guide',
    'what is',
    'how to',
    'benefits',
    'vs',
    'comparison',
    'tutorial',
    'tips',
    'best practices',
    'introduction',
    'overview',
    'explained',
    'understanding',
  ],
  nonSeoPathFragments: [
    'privacy',
    'terms',
    'login',
    'account',
    'signin',
    'signup',
    'auth',
    'dashboard',
    'cart',
    'checkout',
    'cookie',
    'cookies',
    'disclaimer',
  ],
  productSlugPatterns: DEFAULT_PRODUCT_SLUG_PATTERNS,
  categorySlugPatterns: DEFAULT_CATEGORY_SLUG_PATTERNS,
  blogSlugPatterns: DEFAULT_BLOG_SLUG_PATTERNS,
  resourceSlugPatterns: DEFAULT_RESOURCE_SLUG_PATTERNS,
  supportSlugPatterns: DEFAULT_SUPPORT_SLUG_PATTERNS,
  legalSlugPatterns: DEFAULT_LEGAL_SLUG_PATTERNS,
  accountSlugPatterns: DEFAULT_ACCOUNT_SLUG_PATTERNS,
  careersSlugPatterns: DEFAULT_CAREERS_SLUG_PATTERNS,
  aboutCompanySlugPatterns: DEFAULT_ABOUT_COMPANY_SLUG_PATTERNS,
  marketingLandingPatterns: DEFAULT_MARKETING_LANDING_PATTERNS,
};

function extractExamples(pattern: PatternWithExamples | undefined): string[] {
  if (!pattern || !pattern.examples) return [];
  return pattern.examples.filter(Boolean);
}

export function extractPageClassificationConfig(
  profile: ClientAIProfile | null
): PageClassificationConfig {
  if (!profile) {
    return DEFAULT_CONFIG;
  }

  const brandNames = [
    profile.clientName,
    ...profile.primaryDomains.map((d) => d.replace(/^www\./, '').split('.')[0]),
  ].filter(Boolean);

  const productKeywords = [
    ...profile.productLines,
    ...profile.coreTopics,
    ...(profile.domainTypePatterns?.oemManufacturerIndicators || []),
  ].filter(Boolean);

  const serviceKeywords = [
    ...(profile.domainTypePatterns?.serviceProviderIndicators || []),
  ].filter(Boolean);

  const blogMarkers = [
    ...DEFAULT_CONFIG.blogMarkers,
    ...(profile.classificationIntentHints?.informationalKeywords || []),
  ].filter(Boolean);

  const nonSeoPathFragments = [...DEFAULT_CONFIG.nonSeoPathFragments];

  const urlSupport = profile.urlClassificationSupport;

  const productSlugPatterns = [
    ...DEFAULT_PRODUCT_SLUG_PATTERNS,
    ...extractExamples(urlSupport?.productSlugPatterns),
  ];

  const categorySlugPatterns = [
    ...DEFAULT_CATEGORY_SLUG_PATTERNS,
    ...extractExamples(urlSupport?.categorySlugPatterns),
  ];

  const blogSlugPatterns = [
    ...DEFAULT_BLOG_SLUG_PATTERNS,
    ...extractExamples(urlSupport?.blogSlugPatterns),
  ];

  const resourceSlugPatterns = [
    ...DEFAULT_RESOURCE_SLUG_PATTERNS,
    ...extractExamples(urlSupport?.resourceSlugPatterns),
  ];

  const supportSlugPatterns = [
    ...DEFAULT_SUPPORT_SLUG_PATTERNS,
    ...extractExamples(urlSupport?.supportSlugPatterns),
  ];

  const legalSlugPatterns = [
    ...DEFAULT_LEGAL_SLUG_PATTERNS,
    ...extractExamples(urlSupport?.legalSlugPatterns),
  ];

  const accountSlugPatterns = [
    ...DEFAULT_ACCOUNT_SLUG_PATTERNS,
    ...extractExamples(urlSupport?.accountSlugPatterns),
  ];

  const careersSlugPatterns = [
    ...DEFAULT_CAREERS_SLUG_PATTERNS,
    ...extractExamples(urlSupport?.careersSlugPatterns),
  ];

  const aboutCompanySlugPatterns = [
    ...DEFAULT_ABOUT_COMPANY_SLUG_PATTERNS,
    ...extractExamples(urlSupport?.aboutCompanySlugPatterns),
  ];

  const marketingLandingPatterns = [
    ...DEFAULT_MARKETING_LANDING_PATTERNS,
    ...extractExamples(urlSupport?.marketingLandingPatterns),
  ];

  return {
    brandNames: Array.from(new Set(brandNames.map((b) => b.toLowerCase()))),
    productKeywords: Array.from(new Set(productKeywords.map((p) => p.toLowerCase()))),
    serviceKeywords: Array.from(new Set(serviceKeywords.map((s) => s.toLowerCase()))),
    blogMarkers: Array.from(new Set(blogMarkers.map((b) => b.toLowerCase()))),
    nonSeoPathFragments: Array.from(new Set(nonSeoPathFragments.map((n) => n.toLowerCase()))),
    productSlugPatterns: Array.from(new Set(productSlugPatterns.map((s) => s.toLowerCase()))),
    categorySlugPatterns: Array.from(new Set(categorySlugPatterns.map((s) => s.toLowerCase()))),
    blogSlugPatterns: Array.from(new Set(blogSlugPatterns.map((s) => s.toLowerCase()))),
    resourceSlugPatterns: Array.from(new Set(resourceSlugPatterns.map((s) => s.toLowerCase()))),
    supportSlugPatterns: Array.from(new Set(supportSlugPatterns.map((s) => s.toLowerCase()))),
    legalSlugPatterns: Array.from(new Set(legalSlugPatterns.map((s) => s.toLowerCase()))),
    accountSlugPatterns: Array.from(new Set(accountSlugPatterns.map((s) => s.toLowerCase()))),
    careersSlugPatterns: Array.from(new Set(careersSlugPatterns.map((s) => s.toLowerCase()))),
    aboutCompanySlugPatterns: Array.from(new Set(aboutCompanySlugPatterns.map((s) => s.toLowerCase()))),
    marketingLandingPatterns: Array.from(new Set(marketingLandingPatterns.map((s) => s.toLowerCase()))),
  };
}

export function getDefaultConfig(): PageClassificationConfig {
  return { ...DEFAULT_CONFIG };
}
