import { ClientAIProfile, PageClassificationConfig } from '@/types';

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
};

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

  return {
    brandNames: Array.from(new Set(brandNames.map((b) => b.toLowerCase()))),
    productKeywords: Array.from(new Set(productKeywords.map((p) => p.toLowerCase()))),
    serviceKeywords: Array.from(new Set(serviceKeywords.map((s) => s.toLowerCase()))),
    blogMarkers: Array.from(new Set(blogMarkers.map((b) => b.toLowerCase()))),
    nonSeoPathFragments: Array.from(new Set(nonSeoPathFragments.map((n) => n.toLowerCase()))),
  };
}

export function getDefaultConfig(): PageClassificationConfig {
  return { ...DEFAULT_CONFIG };
}
