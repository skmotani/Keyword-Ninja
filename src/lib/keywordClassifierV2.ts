/**
 * Product Relevance Filter 2 - Dynamic Keyword Classification
 * 
 * Generates classification patterns from Client AI Profile - works for ANY industry.
 * Classifies keywords into: RELEVANT, IRRELEVANT, BRAND, REVIEW
 */

import { ClientAIProfile, Tag2Status } from '@/types';

// =============================================================================
// UNIVERSAL STOPWORDS (Industry-Agnostic - Always treated as noise)
// =============================================================================

const UNIVERSAL_STOPWORDS = new Set([
    // Question words
    "what", "how", "why", "when", "where", "which", "who", "whose", "whom",

    // Articles & Prepositions
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "into", "through", "during", "before",
    "after", "above", "below", "between", "under", "over", "out", "off",
    "up", "down", "about", "against", "is", "are", "was", "were", "be",
    "been", "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "must", "shall", "can",
    "that", "this", "these", "those", "it", "its", "they", "them", "their",

    // Business suffixes (not meaningful for relevance)
    "pvt", "ltd", "limited", "private", "corp", "corporation", "company",
    "inc", "incorporated", "llc", "llp", "co", "group", "holdings",
    "enterprises", "industries", "international", "global", "solutions",

    // Generic web/document terms
    "meaning", "definition", "wikipedia", "wiki", "pdf", "download",
    "free", "online", "website", "site", "page", "click", "here",
    "login", "signup", "register", "account", "password", "email",

    // Generic modifiers
    "best", "top", "new", "old", "good", "bad", "cheap", "expensive",
    "near", "nearby", "me", "you", "my", "your", "our", "vs", "versus"
]);

// Generic irrelevant categories
const GENERIC_IRRELEVANT = new Set([
    "jobs", "job", "career", "careers", "hiring", "vacancy", "vacancies",
    "recruitment", "recruiter", "resume", "cv", "salary", "interview",
    "news", "latest", "update", "updates", "today", "yesterday",
    "video", "videos", "image", "images", "photo", "photos", "gallery",
    "review", "reviews", "rating", "ratings", "comment", "comments",
    "blog", "blogs", "article", "articles", "post", "posts",
    "stock", "stocks", "share", "shares", "investor", "investors",
    "trading", "trader", "forex", "crypto", "bitcoin", "investment"
]);

// =============================================================================
// DYNAMIC PATTERN BUILDER
// =============================================================================

export interface ClassificationPatterns {
    brandPatterns: Set<string>;
    relevantPatterns: Set<string>;
    irrelevantPatterns: Set<string>;
    reviewPatterns: Set<string>;
}

export function buildPatternsFromProfile(
    profile: ClientAIProfile,
    domains: string[]
): ClassificationPatterns {
    const brandPatterns = new Set<string>();
    const relevantPatterns = new Set<string>();
    const irrelevantPatterns = new Set<string>();
    const reviewPatterns = new Set<string>();

    // --- BRAND PATTERNS ---
    // Extract from domain names
    domains.forEach(domain => {
        const extracted = extractBrandFromDomain(domain);
        extracted.forEach(b => brandPatterns.add(b));
    });

    // Add primary domains from profile
    profile.primaryDomains?.forEach(domain => {
        const extracted = extractBrandFromDomain(domain);
        extracted.forEach(b => brandPatterns.add(b));
    });

    // Add brand keywords from profile
    profile.keywordClassificationSupport?.brandKeywords?.examples?.forEach(kw => {
        brandPatterns.add(kw.toLowerCase());
    });

    // --- IRRELEVANT PATTERNS ---
    // Universal stopwords
    UNIVERSAL_STOPWORDS.forEach(w => irrelevantPatterns.add(w));
    GENERIC_IRRELEVANT.forEach(w => irrelevantPatterns.add(w));

    // Negative topics from profile
    profile.negativeTopics?.forEach(topic => {
        irrelevantPatterns.add(topic.toLowerCase());
        topic.toLowerCase().split(/\s+/).forEach(word => {
            if (word.length > 2) irrelevantPatterns.add(word);
        });
    });

    // Irrelevant keyword topics from profile
    profile.keywordClassificationSupport?.irrelevantKeywordTopics?.examples?.forEach(kw => {
        irrelevantPatterns.add(kw.toLowerCase());
        kw.toLowerCase().split(/\s+/).forEach(word => {
            if (word.length > 2) irrelevantPatterns.add(word);
        });
    });

    // End customer indicators for B2B
    if (profile.businessModel?.toUpperCase() === 'B2B') {
        profile.domainTypePatterns?.endCustomerIndicators?.forEach(term => {
            irrelevantPatterns.add(term.toLowerCase());
        });
    }

    // --- RELEVANT PATTERNS ---
    // Core topics
    profile.coreTopics?.forEach(topic => {
        relevantPatterns.add(topic.toLowerCase());
        topic.toLowerCase().split(/\s+/).forEach(word => {
            if (word.length > 2 && !UNIVERSAL_STOPWORDS.has(word)) {
                relevantPatterns.add(word);
            }
        });
    });

    // Product lines
    profile.productLines?.forEach(product => {
        relevantPatterns.add(product.toLowerCase());
        product.toLowerCase().split(/\s+/).forEach(word => {
            if (word.length > 2 && !UNIVERSAL_STOPWORDS.has(word)) {
                relevantPatterns.add(word);
            }
        });
    });

    // Target customer segments
    profile.targetCustomerSegments?.forEach(segment => {
        relevantPatterns.add(segment.toLowerCase());
        segment.toLowerCase().split(/\s+/).forEach(word => {
            if (word.length > 2 && !UNIVERSAL_STOPWORDS.has(word)) {
                relevantPatterns.add(word);
            }
        });
    });

    // OEM indicators
    profile.domainTypePatterns?.oemManufacturerIndicators?.forEach(term => {
        relevantPatterns.add(term.toLowerCase());
    });

    // Transactional keywords (buying intent = relevant)
    profile.classificationIntentHints?.transactionalKeywords?.forEach(term => {
        relevantPatterns.add(term.toLowerCase());
    });

    // Commercial research phrases
    profile.keywordClassificationSupport?.commercialResearchPhrases?.examples?.forEach(kw => {
        relevantPatterns.add(kw.toLowerCase());
    });

    // Transactional phrases
    profile.keywordClassificationSupport?.transactionalPhrases?.examples?.forEach(kw => {
        relevantPatterns.add(kw.toLowerCase());
    });

    // Industry expansion based on existing terms
    const industryExpansion = getIndustryExpansionTerms(relevantPatterns);
    industryExpansion.forEach(t => relevantPatterns.add(t));

    // --- REVIEW PATTERNS ---
    // Adjacent topics
    profile.adjacentTopics?.forEach(topic => {
        reviewPatterns.add(topic.toLowerCase());
        topic.toLowerCase().split(/\s+/).forEach(word => {
            if (word.length > 2 && !UNIVERSAL_STOPWORDS.has(word)) {
                reviewPatterns.add(word);
            }
        });
    });

    // Educational indicators
    profile.domainTypePatterns?.educationalMediaIndicators?.forEach(term => {
        reviewPatterns.add(term.toLowerCase());
    });

    // Informational keywords
    profile.classificationIntentHints?.informationalKeywords?.forEach(term => {
        reviewPatterns.add(term.toLowerCase());
    });

    // Informational phrases
    profile.keywordClassificationSupport?.informationalPhrases?.examples?.forEach(kw => {
        reviewPatterns.add(kw.toLowerCase());
    });

    return { brandPatterns, relevantPatterns, irrelevantPatterns, reviewPatterns };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function extractBrandFromDomain(domain: string): Set<string> {
    const brandTerms = new Set<string>();

    // Remove protocol and www
    let cleaned = domain.replace(/^https?:\/\//, '').replace(/^www\./, '');

    // Remove TLDs
    const tldPatterns = ['.com', '.in', '.co.in', '.ind.in', '.org', '.net', '.io', '.co', '.biz', '.info'];
    for (const tld of tldPatterns) {
        if (cleaned.endsWith(tld)) {
            cleaned = cleaned.slice(0, -tld.length);
            break;
        }
    }

    // Handle subdomains
    cleaned = cleaned.split('.').pop() || cleaned;

    if (cleaned.length > 2) {
        brandTerms.add(cleaned.toLowerCase());
    }

    // Split by hyphens
    if (cleaned.includes('-')) {
        const parts = cleaned.split('-');
        parts.forEach(part => {
            if (part.length > 2 && !UNIVERSAL_STOPWORDS.has(part.toLowerCase())) {
                brandTerms.add(part.toLowerCase());
            }
        });
        brandTerms.add(cleaned.replace(/-/g, '').toLowerCase());
    }

    // Extract brand prefix from common suffixes
    const commonSuffixes = ['ind', 'tech', 'corp', 'group', 'mfg', 'eng', 'sys', 'pro', 'hub'];
    for (const suffix of commonSuffixes) {
        if (cleaned.toLowerCase().endsWith(suffix) && cleaned.length > suffix.length + 2) {
            const prefix = cleaned.slice(0, -suffix.length).toLowerCase();
            brandTerms.add(prefix);
        }
    }

    return brandTerms;
}

function getIndustryExpansionTerms(existingTerms: Set<string>): Set<string> {
    const expansion = new Set<string>();

    const termFamilies: Record<string, string[]> = {
        "machine": ["machinery", "machines", "equipment", "apparatus", "device"],
        "machinery": ["machine", "machines", "equipment", "apparatus"],
        "manufacturer": ["manufacturing", "maker", "producer", "fabricator"],
        "manufacturing": ["manufacturer", "production", "fabrication", "making"],
        "supplier": ["supply", "vendor", "provider", "distributor"],
        "exporter": ["export", "exporting", "exports"],
        "industrial": ["industry", "industries", "factory", "plant"],
        "textile": ["textiles", "fabric", "fabrics", "cloth", "fiber", "fibre"],
        "yarn": ["yarns", "thread", "threads", "filament", "fiber"],
        "spinning": ["spinner", "spun", "spin"],
        "weaving": ["weave", "woven", "weaver", "loom"],
        "twisting": ["twist", "twister", "twisted"],
        "winding": ["winder", "wind", "wound"],
        "dyeing": ["dye", "dyed", "dyehouse"],
        "knitting": ["knit", "knitted", "knitwear"],
        "packaging": ["package", "packages", "packing", "pack"],
        "film": ["films", "sheet", "sheets", "foil"],
        "plastic": ["plastics", "polymer", "polymers"],
        "automation": ["automated", "automatic", "automate"],
        "processing": ["process", "processor", "processed"],
        "production": ["produce", "product", "products"],
    };

    for (const [keyTerm, relatedTerms] of Object.entries(termFamilies)) {
        if (existingTerms.has(keyTerm)) {
            relatedTerms.forEach(t => expansion.add(t));
        }
        for (const related of relatedTerms) {
            if (existingTerms.has(related)) {
                expansion.add(keyTerm);
                relatedTerms.forEach(t => expansion.add(t));
                break;
            }
        }
    }

    return expansion;
}

// =============================================================================
// KEYWORD CLASSIFIER
// =============================================================================

export interface ClassificationResult {
    tag2Status: Tag2Status;
    rationale: string;
}

export function classifyKeyword(
    keyword: string,
    patterns: ClassificationPatterns
): ClassificationResult {
    const keywordLower = keyword.toLowerCase().trim();
    const words = keywordLower.split(/\s+/).filter(w => w.length > 1);

    // Single word classification
    if (words.length === 1) {
        return classifyTerm(keywordLower, patterns);
    }

    // Multi-word classification
    const classifications: { status: Tag2Status; rationale: string }[] = [];

    for (const word of words) {
        const result = classifyTerm(word, patterns);
        classifications.push({ status: result.tag2Status, rationale: result.rationale });
    }

    // Count classifications
    const counts = { RELEVANT: 0, IRRELEVANT: 0, BRAND: 0, REVIEW: 0, BLANK: 0 };
    classifications.forEach(c => counts[c.status]++);

    // Decision logic

    // Rule 1: ANY Brand term → Brand
    if (counts.BRAND > 0) {
        const brandRationale = classifications
            .filter(c => c.status === 'BRAND')
            .map(c => c.rationale)
            .slice(0, 2)
            .join('; ');
        return { tag2Status: 'BRAND', rationale: brandRationale };
    }

    // Rule 2: Check for full phrase matches first
    for (const pattern of Array.from(patterns.relevantPatterns)) {
        if (pattern.length > 5 && keywordLower.includes(pattern)) {
            return { tag2Status: 'RELEVANT', rationale: `Phrase:${pattern}` };
        }
    }

    for (const pattern of Array.from(patterns.irrelevantPatterns)) {
        if (pattern.length > 5 && keywordLower.includes(pattern)) {
            return { tag2Status: 'IRRELEVANT', rationale: `Phrase:${pattern}` };
        }
    }

    // Rule 3: Word-level classification
    const relevanceRatio = counts.RELEVANT / words.length;
    const irrelevanceRatio = counts.IRRELEVANT / words.length;

    if (counts.RELEVANT > counts.IRRELEVANT && relevanceRatio > 0.3) {
        const relevantRationale = classifications
            .filter(c => c.status === 'RELEVANT')
            .map(c => c.rationale)
            .slice(0, 3)
            .join('; ');
        return { tag2Status: 'RELEVANT', rationale: relevantRationale };
    }

    if (counts.IRRELEVANT > counts.RELEVANT && irrelevanceRatio > 0.5) {
        const irrelevantRationale = classifications
            .filter(c => c.status === 'IRRELEVANT')
            .map(c => c.rationale)
            .slice(0, 2)
            .join('; ');
        return { tag2Status: 'IRRELEVANT', rationale: irrelevantRationale };
    }

    // Rule 4: Review if mixed or uncertain
    return { tag2Status: 'REVIEW', rationale: 'Mixed/Unclassified' };
}

function classifyTerm(
    term: string,
    patterns: ClassificationPatterns
): ClassificationResult {
    const termLower = term.toLowerCase().trim();

    // Priority 1: Brand
    for (const brand of Array.from(patterns.brandPatterns)) {
        if (fuzzyMatch(termLower, brand)) {
            return { tag2Status: 'BRAND', rationale: `Brand:${brand}` };
        }
    }

    // Priority 2: Irrelevant
    if (patterns.irrelevantPatterns.has(termLower)) {
        return { tag2Status: 'IRRELEVANT', rationale: `Neg:${termLower}` };
    }

    for (const neg of Array.from(patterns.irrelevantPatterns)) {
        if (neg.length > 3 && termLower.includes(neg)) {
            return { tag2Status: 'IRRELEVANT', rationale: `Neg:${neg}` };
        }
    }

    // Priority 3: Relevant
    if (patterns.relevantPatterns.has(termLower)) {
        return { tag2Status: 'RELEVANT', rationale: `Pos:${termLower}` };
    }

    for (const pos of Array.from(patterns.relevantPatterns)) {
        if (pos.length > 3 && termLower.includes(pos)) {
            return { tag2Status: 'RELEVANT', rationale: `Pos:${pos}` };
        }
    }

    // Priority 4: Review
    if (patterns.reviewPatterns.has(termLower)) {
        return { tag2Status: 'REVIEW', rationale: `Amb:${termLower}` };
    }

    for (const amb of Array.from(patterns.reviewPatterns)) {
        if (amb.length > 3 && termLower.includes(amb)) {
            return { tag2Status: 'REVIEW', rationale: `Amb:${amb}` };
        }
    }

    // Default: Blank (unclassified)
    return { tag2Status: 'BLANK', rationale: 'Unclassified' };
}

function fuzzyMatch(term: string, pattern: string): boolean {
    // Exact match
    if (term === pattern) return true;

    // Contains match (either direction)
    if (pattern.length >= 4 && (term.includes(pattern) || pattern.includes(term))) {
        return true;
    }

    // Character similarity (Jaccard-like)
    if (term.length > 2 && pattern.length > 2) {
        const termCharsArr = term.split('');
        const patternCharsArr = pattern.split('');
        const termCharSet = new Set(termCharsArr);
        const patternCharSet = new Set(patternCharsArr);
        const intersection = termCharsArr.filter(c => patternCharSet.has(c)).length;
        const unionSet = new Set([...termCharsArr, ...patternCharsArr]);
        const union = unionSet.size;
        const similarity = union > 0 ? intersection / union : 0;

        if (similarity >= 0.7) return true;
    }

    return false;
}

// =============================================================================
// MAIN CLASSIFICATION FUNCTION
// =============================================================================

export interface ClassificationStats {
    total: number;
    relevant: number;
    irrelevant: number;
    brand: number;
    review: number;
    blank: number;
}

export function classifyAllKeywords(
    keywords: string[],
    profile: ClientAIProfile,
    domains: string[]
): { results: Map<string, ClassificationResult>; stats: ClassificationStats } {
    // Build patterns from profile
    const patterns = buildPatternsFromProfile(profile, domains);

    // Classify each keyword
    const results = new Map<string, ClassificationResult>();
    const stats: ClassificationStats = {
        total: keywords.length,
        relevant: 0,
        irrelevant: 0,
        brand: 0,
        review: 0,
        blank: 0
    };

    for (const keyword of keywords) {
        const result = classifyKeyword(keyword, patterns);
        results.set(keyword.toLowerCase().trim(), result);

        switch (result.tag2Status) {
            case 'RELEVANT': stats.relevant++; break;
            case 'IRRELEVANT': stats.irrelevant++; break;
            case 'BRAND': stats.brand++; break;
            case 'REVIEW': stats.review++; break;
            case 'BLANK': stats.blank++; break;
        }
    }

    return { results, stats };
}
