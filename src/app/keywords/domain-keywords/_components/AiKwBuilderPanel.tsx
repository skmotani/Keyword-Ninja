'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TermEntry, TermBucket, NgramType } from '@/types/termDictionary';

// Local extension of TermEntry to support UI logic
interface UiTermEntry extends TermEntry {
    isPending?: boolean;
    originalType?: string;
}

interface AiKwBuilderPanelProps {
    isOpen: boolean;
    onClose: () => void;
    clientCode: string;
    domain: string;
    industryKey?: string;
    // We accept raw keywords to build terms from if load doesn't provide them
    rawKeywords?: string[];
    // NEW: Keyword with volume data for volume-based sizing
    rawKeywordData?: { keyword: string; volume: number; domain?: string; position?: number; competitionType?: string }[];
    // Callback to refresh profile data after dictionary changes
    onDictionaryChange?: () => void;
}

// Visual constants
const COLORS = {
    include: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200', fill: '#dcfce7' },
    exclude: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200', fill: '#fee2e2' },
    brand: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200', fill: '#f3e8ff' },
    review: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200', fill: '#dbeafe' },
    unassigned: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', fill: '#f9fafb' }
};

// Bucket display names with intent labels (old → new mapping)
const BUCKET_DISPLAY_NAMES: Record<string, string> = {
    include: 'Include | Buy',
    exclude: 'Exclude | Noise',
    brand: 'Brand | Nav',
    review: 'Include | Learn',
    unassigned: 'Unassigned'
};

// Bucket tooltips explaining intent and usage
const BUCKET_TOOLTIPS: Record<string, string> = {
    include: 'Keywords with direct commercial intent related to the client\'s products, machines, services, or solutions. These keywords indicate users who are actively evaluating, comparing, or intending to buy. Used for product pages, category pages, solution pages, and RFQ-driven content.',
    review: 'Keywords with informational or educational intent that support awareness, research, and early-stage decision-making. This bucket also includes high-traffic industry pages, process explanations, and concept-driven searches that help build authority and support internal linking to commercial pages.',
    brand: 'Keywords related to brand names, including the client\'s brand and competitor brands. Primarily navigational in nature, these keywords are used for brand protection, comparison content, and competitive positioning analysis.',
    exclude: 'Keywords that are irrelevant, ambiguous, or out of scope for the client\'s business and content strategy. These keywords do not justify content creation or optimization and are intentionally excluded to keep strategy focused.',
    unassigned: 'Keywords not yet classified. Review and assign to appropriate buckets.'
};

// Auto-exclude common words (pronouns, conjunctions, articles, company suffixes, prepositions, etc.)
const COMMON_EXCLUSIONS = new Set([
    // Pronouns
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'this', 'that', 'these', 'those', 'who', 'what', 'which',
    // Conjunctions
    'and', 'or', 'but', 'if', 'for', 'so', 'yet', 'nor',
    // Articles
    'a', 'an', 'the',
    // Company suffixes
    'ltd', 'llp', 'pvt', 'inc', 'corp', 'limited', 'private', 'company', 'co',
    // Common adjectives
    'best', 'top', 'good', 'new', 'great', 'free', 'online', 'cheap', 'easy', 'fast', 'high', 'low', 'big', 'small',
    // Verbs
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'get', 'got', 'can', 'will', 'would', 'should', 'could', 'may', 'might',
    // Prepositions
    'in', 'on', 'at', 'to', 'from', 'with', 'by', 'of', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'over',
    // Question words
    'how', 'why', 'when', 'where',
    // Common words
    'more', 'most', 'very', 'just', 'also', 'only', 'any', 'all', 'no', 'not', 'yes'
]);

export default function AiKwBuilderPanel({ isOpen, onClose, clientCode, domain, industryKey = 'general', rawKeywords = [], rawKeywordData = [], onDictionaryChange }: AiKwBuilderPanelProps) {
    // --- State ---
    const [terms, setTerms] = useState<UiTermEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Multi-select state
    const [selectedTerms, setSelectedTerms] = useState<Set<string>>(new Set());

    // Brand names from Competitor Master for auto-tagging
    const [domainBrandNames, setDomainBrandNames] = useState<string[]>([]);
    const [brandNamesFetched, setBrandNamesFetched] = useState(false); // Track when fetch completes

    // NEW: Track new brand keywords that need to be saved
    const [newBrandKeywordsCount, setNewBrandKeywordsCount] = useState(0);
    const [showNewBrandPrompt, setShowNewBrandPrompt] = useState(false);
    const [savedBrandTerms, setSavedBrandTerms] = useState<Set<string>>(new Set());

    // Tooltip popup state
    const [activeBucketTooltip, setActiveBucketTooltip] = useState<string | null>(null);

    const [filters, setFilters] = useState({
        ngram: 'full' as NgramType | 'full',
        minFreq: 1,  // Default to 1 for strategic filters
        minVolume: 0,  // NEW: Minimum search volume filter
        search: '',
        showUnassignedOnly: false,
        bucketFilter: [] as string[], // Multi-select: include, exclude, brand, review, unassigned
        limit: 99999,  // Default to All for strategic filters
        sizeBy: 'volume' as 'frequency' | 'volume',  // Size balloon by frequency or search volume (default: volume)
        sortOrder: 'desc' as 'desc' | 'asc',  // Sort order (largest first or smallest first)
        positionRange: '' as '' | '1-3' | '1-5' | '1-10' | '5-10' | '10-20' | '20-50' | '50+',  // Position filter
        volumePercentile: [] as ('ultra-high' | 'high' | 'mid' | 'low' | 'ultra-low')[],  // Volume percentile filter: multi-select
        strategicFilter: [] as ('core' | 'wins' | 'leakage' | 'build' | 'gaps' | 'niche' | 'passive' | 'uncategorized')[],  // Multi-select strategic filters
        competitionType: [] as string[],  // NEW: Competition type filter (Main, Marketplace, Partial, Self, Small, Not Assigned)
        selectedDomains: [] as string[]  // NEW: Domain multi-select filter
    });

    // --- Loading Logic ---
    // Reset state when clientCode changes (client switch)
    useEffect(() => {
        // Clear all terms and reset state for new client
        setTerms([]);
        setDomainBrandNames([]);
        setHasUnsavedChanges(false);
        setSelectedTerms(new Set());
    }, [clientCode]);

    // Fetch brand names from Competitor Master for this domain
    useEffect(() => {
        if (isOpen && clientCode && domain) {
            fetchDomainBrandNames();
        }
    }, [isOpen, clientCode, domain]);

    const fetchDomainBrandNames = async () => {
        try {
            const res = await fetch('/api/competitors');
            const competitors = await res.json();

            // Collect ONLY brand names from brandNames column in Competitor Master
            // Do NOT extract from domain names to avoid false matches
            const allBrandNames = new Set<string>();

            competitors
                .filter((c: any) => c.clientCode === clientCode && c.isActive)
                .forEach((c: any) => {
                    // Add brand names from Competitor Master brandNames column ONLY
                    if (c.brandNames) {
                        let brands: string[] = [];
                        if (Array.isArray(c.brandNames)) {
                            brands = c.brandNames;
                        } else if (typeof c.brandNames === 'string') {
                            // Split by comma
                            brands = c.brandNames.split(',').map((b: string) => b.trim()).filter((b: string) => b);
                        }
                        brands.forEach((b: string) => {
                            if (b && b.trim().length >= 2) {
                                allBrandNames.add(b.toLowerCase().trim());
                            }
                        });
                    }
                    // NOTE: We intentionally do NOT extract from domain names
                    // as this causes false matches (e.g., "meeraind" → "ind" → matches "winder")
                });

            if (allBrandNames.size > 0) {
                setDomainBrandNames(Array.from(allBrandNames));
                console.log('[AiKwBuilder] Brand names loaded from Competitor Master:', Array.from(allBrandNames));
            } else {
                console.log('[AiKwBuilder] No brand names found in Competitor Master');
                setDomainBrandNames([]);
            }
            setBrandNamesFetched(true); // Mark fetch as complete regardless of result
        } catch (e) {
            console.error('Failed to fetch brand names:', e);
            setBrandNamesFetched(true); // Mark as complete even on error so terms can still generate
        }
    };

    useEffect(() => {
        if (isOpen && clientCode) {
            loadDictionary();
        }
    }, [isOpen, clientCode]);
    // Create a hash of rawKeywords to detect content changes (not just length)
    const rawKeywordsHash = useMemo(() => {
        if (rawKeywords.length === 0) return '';
        // Use first 10 and last 10 keywords to create a unique hash
        const sample = [...rawKeywords.slice(0, 10), ...rawKeywords.slice(-10)].join('|');
        return `${rawKeywords.length}_${sample.length}_${sample.substring(0, 100)}`;
    }, [rawKeywords]);

    // Track previous hash to detect changes
    const [prevRawKeywordsHash, setPrevRawKeywordsHash] = useState('');

    // Initial Term Generation with Examples - regenerate when rawKeywords content changes
    // IMPORTANT: Wait for brand names fetch to complete before generating terms
    useEffect(() => {
        // Only generate terms AFTER brand names fetch has completed
        // This ensures brand detection has the latest Competitor Master data
        if (!brandNamesFetched) {
            console.log('[AiKwBuilder] Waiting for brand names to load before generating terms...');
            return;
        }

        // Force regeneration if hash changed (means different keywords, not just different length)
        if (rawKeywordsHash !== prevRawKeywordsHash && rawKeywords.length > 0) {
            console.log('[AiKwBuilder] Generating terms with brand names:', domainBrandNames);
            setPrevRawKeywordsHash(rawKeywordsHash);
            // Clear and regenerate
            setTerms([]);

            // Log raw keywords count for debugging
            console.log('[AiKwBuilder] Raw keywords received:', rawKeywords.length);
            console.log('[AiKwBuilder] Unique keywords:', new Set(rawKeywords).size);

            // ONLY process FULL KEYWORDS (no unigrams or bigrams)
            const freqMap = new Map<string, number>();
            const volumeMap = new Map<string, number>();
            const domainPositionsMap = new Map<string, { domain: string; position: number; competitionType?: string }[]>();

            rawKeywords.forEach(kw => {
                // Include ALL keywords regardless of length
                freqMap.set(kw, (freqMap.get(kw) || 0) + 1);

                // Get volume, domain, position, competitionType from rawKeywordData
                const allKwData = rawKeywordData.filter(d => d.keyword.toLowerCase() === kw.toLowerCase());
                allKwData.forEach(kwData => {
                    if (kwData.volume && !volumeMap.has(kw)) {
                        volumeMap.set(kw, kwData.volume);
                    }
                    // Store domain + position + competitionType info for tooltip and filtering (unique domains only)
                    if (kwData.domain && kwData.position) {
                        const existing = domainPositionsMap.get(kw) || [];
                        if (!existing.some(e => e.domain === kwData.domain)) {
                            existing.push({ domain: kwData.domain, position: kwData.position, competitionType: kwData.competitionType });
                            domainPositionsMap.set(kw, existing);
                        }
                    }
                });
            });

            // Create term entries for all full keywords
            const newTerms: UiTermEntry[] = Array.from(freqMap.entries())
                .filter(([_, freq]) => freq >= 1)
                .map(([term, freq]) => {
                    // Use brand names from Competitor Master (or fallback to domain-based extraction)
                    const brandNamesToCheck = domainBrandNames.length > 0
                        ? domainBrandNames
                        : (() => {
                            const domainParts = domain.split('.')[0].toLowerCase();
                            const fallback = [domainParts];
                            if (domainParts.length > 4) {
                                for (let len = 4; len < domainParts.length; len++) {
                                    fallback.push(domainParts.substring(0, len));
                                }
                            }
                            return fallback;
                        })();

                    // Check if keyword contains any brand name (case-insensitive partial match)
                    const normalizedTerm = term.toLowerCase();
                    const isBrand = brandNamesToCheck.some(b => normalizedTerm.includes(b) && b.length >= 3);

                    let bucket: TermBucket | undefined;
                    let source: 'user' | 'ai' | 'system' = 'system';
                    let confidence = 0;

                    if (isBrand) {
                        // bucket = 'brand'; // DISABLE AUTO-ASSIGNMENT ON LOAD
                        source = 'ai';
                        confidence = 0.95;
                    }

                    return {
                        term,
                        freq,
                        ngramType: 'trigram' as NgramType, // All full keywords use 'trigram'
                        source,
                        bucket,
                        confidence,
                        locked: false,
                        examples: [],
                        isPending: false,
                        originalType: 'full',
                        // Add searchVolume for volume-based sizing
                        ...(volumeMap.has(term) ? { searchVolume: volumeMap.get(term) } : {}),
                        // Add domain+position info for tooltip display
                        ...(domainPositionsMap.has(term) ? { domainPositions: domainPositionsMap.get(term) } : {})
                    };
                });

            newTerms.sort((a, b) => b.freq - a.freq);
            setTerms(newTerms);
            console.log('[AiKwBuilder] Generated', newTerms.length, 'full keyword terms');
        }
    }, [rawKeywordsHash, prevRawKeywordsHash, rawKeywords, rawKeywordData, domain, domainBrandNames, brandNamesFetched]);

    // NOTE: Brand detection is now handled directly in term generation above.
    // The separate brand auto-tagging effect was removed because:
    // 1. It caused race conditions (running after term generation and overwriting)
    // 2. It could produce different results depending on when it ran
    // 3. Term generation already has access to domainBrandNames for accurate detection

    // NEW: Detect new brand keywords not in saved dictionary and prompt to save
    useEffect(() => {
        // Only check after both terms and saved brands are loaded
        if (terms.length === 0 || !isOpen) return;

        // Get current brand terms from terms state
        const currentBrandTerms = terms
            .filter(t => t.bucket === 'brand')
            .map(t => t.term.toLowerCase().trim());

        if (currentBrandTerms.length === 0) {
            setNewBrandKeywordsCount(0);
            setShowNewBrandPrompt(false);
            return;
        }

        // Find brand terms that are NOT in saved dictionary
        const newBrandTerms = currentBrandTerms.filter(term => !savedBrandTerms.has(term));

        if (newBrandTerms.length > 0) {
            console.log('[AiKwBuilder] New brand keywords detected:', newBrandTerms.length, newBrandTerms.slice(0, 5));
            setNewBrandKeywordsCount(newBrandTerms.length);
            // Show prompt only if there are new brand keywords
            setShowNewBrandPrompt(true);
        } else {
            setNewBrandKeywordsCount(0);
            setShowNewBrandPrompt(false);
        }
    }, [terms, savedBrandTerms, isOpen]);

    const handleSaveNewBrandKeywords = async () => {
        try {
            const termsToSave = terms
                .filter(t => t.bucket)
                .map(({ isPending, originalType, ...t }) => t);

            await fetch('/api/dictionary/term-builder/save', {
                method: 'POST',
                body: JSON.stringify({
                    clientCode,
                    domain,
                    industryKey,
                    saveToClient: true,
                    saveToGlobal: false,
                    terms: termsToSave
                })
            });

            // Update saved brand terms cache
            const newSavedBrands = new Set<string>(
                termsToSave
                    .filter(t => t.bucket === 'brand')
                    .map(t => t.term.toLowerCase().trim())
            );
            setSavedBrandTerms(newSavedBrands);
            setNewBrandKeywordsCount(0);
            setShowNewBrandPrompt(false);
            setHasUnsavedChanges(false);
            alert(`Saved ${newSavedBrands.size} brand keywords to dictionary.`);
            onDictionaryChange?.();
        } catch (e) {
            alert('Save failed');
        }
    };

    const mergeTerms = (currentTerms: UiTermEntry[], loadedTerms: TermEntry[]): UiTermEntry[] => {
        const dictMap = new Map(loadedTerms.map(t => [t.term.toLowerCase(), t]));
        return currentTerms.map(t => {
            const loaded = dictMap.get(t.term.toLowerCase());
            if (loaded) {
                // IMPORTANT: If current term was freshly detected as brand by AI,
                // KEEP the brand assignment - don't overwrite with saved dictionary
                // This ensures new brand keywords from Competitor Master are always detected
                // DISABLE AUTO-OVERRIDE of loaded terms by fresh AI detection
                // if (t.bucket === 'brand' && t.source === 'ai') {
                //    return { ...t, isPending: false };
                // }

                // For non-brand or user-assigned terms, use the saved dictionary values
                return {
                    ...t,
                    bucket: loaded.bucket,
                    source: loaded.source,
                    locked: loaded.locked,
                    confidence: loaded.confidence || t.confidence,
                    isPending: false
                };
            }
            return t;
        });
    };

    const loadDictionary = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/dictionary/term-builder/load', {
                method: 'POST',
                body: JSON.stringify({ clientCode, domain, industryKey })
            });
            const data = await res.json();

            if (data.clientDictionary?.terms) {
                // Track saved brand terms for new brand keywords detection
                const savedBrandsArray = data.clientDictionary.terms
                    .filter((t: any) => t.bucket === 'brand')
                    .map((t: any) => (t.term as string).toLowerCase().trim());
                const savedBrands = new Set<string>(savedBrandsArray);
                setSavedBrandTerms(savedBrands);
                console.log('[AiKwBuilder] Saved brand terms loaded:', savedBrands.size);

                setTerms(prev => {
                    if (prev.length === 0) return prev;
                    return mergeTerms(prev, data.clientDictionary.terms);
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            const termsToSave = terms
                .filter(t => t.bucket)
                .map(({ isPending, originalType, ...t }) => t);

            // Debug logging
            const brandTermsCount = termsToSave.filter(t => t.bucket === 'brand').length;
            console.log('[AiKwBuilder] Saving dictionary:');
            console.log('[AiKwBuilder] - Total terms with bucket:', termsToSave.length);
            console.log('[AiKwBuilder] - Brand terms:', brandTermsCount);
            console.log('[AiKwBuilder] - Sample brand terms:', termsToSave.filter(t => t.bucket === 'brand').slice(0, 5).map(t => t.term));

            await fetch('/api/dictionary/term-builder/save', {
                method: 'POST',
                body: JSON.stringify({
                    clientCode,
                    domain,
                    industryKey,
                    saveToClient: true,
                    saveToGlobal: false, // Disabled - only save to Client Profile
                    terms: termsToSave
                })
            });

            setTerms(prev => prev.map(t => ({ ...t, isPending: false })));
            setHasUnsavedChanges(false);
            alert(`Dictionary Saved! (${brandTermsCount} brand terms)`);
            // Refresh main page sidebar
            onDictionaryChange?.();
        } catch (e) {
            alert('Save failed');
        }
    };

    // NEW: Manual Auto-Tag handler
    const handleAutoTagBrands = () => {
        // Use brand names from Competitor Master (or fallback)
        const brandNamesToCheck = domainBrandNames.length > 0
            ? domainBrandNames
            : (() => {
                const domainParts = domain.split('.')[0].toLowerCase();
                const fallback = [domainParts];
                if (domainParts.length > 4) {
                    for (let len = 4; len < domainParts.length; len++) {
                        fallback.push(domainParts.substring(0, len));
                    }
                }
                return fallback;
            })();

        let taggedCount = 0;

        setTerms(prev => prev.map(t => {
            const normalizedTerm = t.term.toLowerCase();
            const isBrand = brandNamesToCheck.some(b => normalizedTerm.includes(b) && b.length >= 3);

            if (isBrand) {
                taggedCount++;
                return {
                    ...t,
                    bucket: 'brand',
                    source: 'ai',
                    confidence: 0.95,
                    locked: false,
                    isPending: true
                };
            }
            return t;
        }));

        setHasUnsavedChanges(true);
        if (taggedCount > 0) {
            alert(`Auto-tagged ${taggedCount} brand keywords.`);
        } else {
            alert('No brand keywords found to tag.');
        }
    };

    // --- Counts for Filters ---
    const filterCounts = useMemo(() => {
        return {
            unigram: terms.filter(t => (t.originalType || t.ngramType) === 'unigram').length,
            bigram: terms.filter(t => (t.originalType || t.ngramType) === 'bigram').length,
            full: terms.filter(t => (t.originalType || t.ngramType) === 'full').length
        };
    }, [terms]);

    // Bucket counts for the current ngram type (for bucket filter pills)
    const bucketCounts = useMemo(() => {
        const activeTypeTerms = terms.filter(t => {
            const type = (t as any).originalType || t.ngramType;
            return type === filters.ngram;
        });
        return {
            include: activeTypeTerms.filter(t => t.bucket === 'include').length,
            exclude: activeTypeTerms.filter(t => t.bucket === 'exclude').length,
            brand: activeTypeTerms.filter(t => t.bucket === 'brand').length,
            review: activeTypeTerms.filter(t => t.bucket === 'review').length,
            unassigned: activeTypeTerms.filter(t => !t.bucket).length
        };
    }, [terms, filters.ngram]);

    // Volume percentile counts for the current ngram type (for volume filter pills)
    const volumePercentileCounts = useMemo(() => {
        if (filters.ngram !== 'full') return { ultraHigh: 0, high: 0, mid: 0, low: 0, ultraLow: 0, p15: 0, p40: 0, p75: 0, p95: 0 };

        const activeTypeTerms = terms.filter(t => {
            const type = (t as any).originalType || t.ngramType;
            return type === filters.ngram;
        });

        // Get volumes and calculate percentiles
        const volumes = activeTypeTerms
            .map(t => (t as any).searchVolume || 0)
            .filter(v => v > 0)
            .sort((a, b) => a - b);

        if (volumes.length === 0) return { ultraHigh: 0, high: 0, mid: 0, low: 0, ultraLow: 0, p15: 0, p40: 0, p75: 0, p95: 0 };

        const p15Index = Math.floor(volumes.length * 0.15);
        const p40Index = Math.floor(volumes.length * 0.40);
        const p75Index = Math.floor(volumes.length * 0.75);
        const p95Index = Math.floor(volumes.length * 0.95);
        const p15Value = volumes[p15Index] || 0;
        const p40Value = volumes[p40Index] || 0;
        const p75Value = volumes[p75Index] || 0;
        const p95Value = volumes[p95Index] || volumes[volumes.length - 1];

        // Count keywords in each bucket
        let ultraHighCount = 0, highCount = 0, midCount = 0, lowCount = 0, ultraLowCount = 0;
        activeTypeTerms.forEach(t => {
            const vol = (t as any).searchVolume || 0;
            if (vol === 0) return;
            if (vol >= p95Value) ultraHighCount++;
            else if (vol >= p75Value) highCount++;
            else if (vol >= p40Value) midCount++;
            else if (vol >= p15Value) lowCount++;
            else ultraLowCount++;
        });

        return { ultraHigh: ultraHighCount, high: highCount, mid: midCount, low: lowCount, ultraLow: ultraLowCount, p15: p15Value, p40: p40Value, p75: p75Value, p95: p95Value };
    }, [terms, filters.ngram]);

    // Competition type counts for filter UI
    const competitionTypeCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        terms.forEach(t => {
            const positions = (t as any).domainPositions as { domain: string; position: number; competitionType?: string }[] | undefined;
            if (positions) {
                positions.forEach(p => {
                    const type = p.competitionType || 'Not Assigned';
                    counts[type] = (counts[type] || 0) + 1;
                });
            }
        });
        return counts;
    }, [terms]);

    // Unique competition types
    const uniqueCompetitionTypes = useMemo(() => {
        return Object.keys(competitionTypeCounts).sort((a, b) => {
            const order = ['Main', 'Self', 'Partial', 'Small', 'Marketplace', 'Not a', 'Not Assigned'];
            return order.indexOf(a) - order.indexOf(b);
        });
    }, [competitionTypeCounts]);

    // Unique domains with counts for filter
    const uniqueDomains = useMemo(() => {
        const domainCounts: Record<string, number> = {};
        terms.forEach(t => {
            const positions = (t as any).domainPositions as { domain: string; position: number; competitionType?: string }[] | undefined;
            if (positions) {
                positions.forEach(p => {
                    domainCounts[p.domain] = (domainCounts[p.domain] || 0) + 1;
                });
            }
        });
        return domainCounts;
    }, [terms]);

    // --- Interaction ---
    const handleTermClick = (term: TermEntry) => {
        const newSet = new Set(selectedTerms);
        if (newSet.has(term.term)) {
            newSet.delete(term.term);
        } else {
            newSet.add(term.term);
        }
        setSelectedTerms(newSet);
    };

    const assignSelectedTerms = (bucket: TermBucket) => {
        if (selectedTerms.size === 0) return;

        setHasUnsavedChanges(true);
        setTerms(prev => prev.map(t => {
            if (selectedTerms.has(t.term)) {
                return {
                    ...t,
                    bucket,
                    source: 'user',
                    locked: true,
                    confidence: 1,
                    isPending: true
                };
            }
            return t;
        }));
        setSelectedTerms(new Set()); // Clear selection after assignment
    };

    // Remove term from bucket (returns to unassigned)
    const removeFromBucket = (termName: string) => {
        setHasUnsavedChanges(true);
        setTerms(prev => prev.map(t => {
            if (t.term === termName) {
                return {
                    ...t,
                    bucket: undefined,
                    source: 'system' as const,
                    locked: false,
                    confidence: 0,
                    isPending: false
                };
            }
            return t;
        }));
    };

    // --- Filtering ---
    const visibleTerms = useMemo(() => {
        let filtered = terms
            .filter(t => {
                const type = (t as any).originalType || t.ngramType;
                return type === filters.ngram;
            })
            .filter(t => t.freq >= filters.minFreq)
            // NEW: Min volume filter (only applies when sizeBy is volume)
            .filter(t => {
                if (filters.sizeBy !== 'volume' || filters.minVolume === 0) return true;
                const vol = (t as any).searchVolume || 0;
                return vol >= filters.minVolume;
            })
            .filter(t => {
                if (!filters.search) return true;
                const searchTerm = filters.search.trim();
                const termLower = t.term.toLowerCase();

                // Exact word match: wrap in quotes (e.g., "age" matches "calculate age" but NOT "image")
                if (searchTerm.startsWith('"') && searchTerm.endsWith('"') && searchTerm.length > 2) {
                    const exactWord = searchTerm.slice(1, -1).toLowerCase();
                    // Match as whole word using word boundaries
                    const wordRegex = new RegExp(`\\b${exactWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                    return wordRegex.test(termLower);
                }

                // Default: substring match (case-insensitive)
                return termLower.includes(searchTerm.toLowerCase());
            })
            .filter(t => {
                // Bucket filter (multi-select)
                if (filters.bucketFilter.length === 0) return true;
                const termBucket = t.bucket || 'unassigned';
                return filters.bucketFilter.includes(termBucket);
            })
            // Position range filter (only for full keywords with domainPositions)
            .filter(t => {
                if (!filters.positionRange || filters.ngram !== 'full') return true;
                const positions = (t as any).domainPositions as { domain: string; position: number }[] | undefined;
                if (!positions || positions.length === 0) return false;

                // Check if any position falls within the range
                const ranges: Record<string, [number, number]> = {
                    '1-3': [1, 3],
                    '1-5': [1, 5],
                    '1-10': [1, 10],
                    '5-10': [5, 10],
                    '10-20': [10, 20],
                    '20-50': [20, 50],
                    '50+': [50, 999]
                };
                const range = ranges[filters.positionRange];
                if (!range) return true;

                return positions.some(p => p.position >= range[0] && p.position <= range[1]);
            })
            // Competition Type filter (multi-select)
            .filter(t => {
                if (filters.competitionType.length === 0) return true;
                const positions = (t as any).domainPositions as { domain: string; position: number; competitionType?: string }[] | undefined;
                if (!positions || positions.length === 0) return filters.competitionType.includes('Not Assigned');
                return positions.some(p => filters.competitionType.includes(p.competitionType || 'Not Assigned'));
            })
            // Domain filter (multi-select)
            .filter(t => {
                if (filters.selectedDomains.length === 0) return true;
                const positions = (t as any).domainPositions as { domain: string; position: number }[] | undefined;
                if (!positions || positions.length === 0) return false;
                return positions.some(p => filters.selectedDomains.includes(p.domain));
            });
        // Volume percentile filter (only applies when volume data is available)
        if (filters.volumePercentile.length > 0 && filters.ngram === 'full') {
            // Get all volumes for percentile calculation
            const allVolumes = filtered
                .map(t => (t as any).searchVolume || 0)
                .filter(v => v > 0)
                .sort((a, b) => a - b);

            if (allVolumes.length > 0) {
                const p15Index = Math.floor(allVolumes.length * 0.15);
                const p40Index = Math.floor(allVolumes.length * 0.40);
                const p75Index = Math.floor(allVolumes.length * 0.75);
                const p95Index = Math.floor(allVolumes.length * 0.95);
                const p15Value = allVolumes[p15Index] || 0;
                const p40Value = allVolumes[p40Index] || 0;
                const p75Value = allVolumes[p75Index] || 0;
                const p95Value = allVolumes[p95Index] || allVolumes[allVolumes.length - 1];

                filtered = filtered.filter(t => {
                    const vol = (t as any).searchVolume || 0;
                    if (vol === 0) return false; // Exclude zero-volume keywords

                    const isUltraHigh = vol >= p95Value;
                    const isHigh = vol >= p75Value && vol < p95Value;
                    const isMid = vol >= p40Value && vol < p75Value;
                    const isLow = vol >= p15Value && vol < p40Value;
                    const isUltraLow = vol < p15Value;

                    return (
                        (filters.volumePercentile.includes('ultra-high') && isUltraHigh) ||
                        (filters.volumePercentile.includes('high') && isHigh) ||
                        (filters.volumePercentile.includes('mid') && isMid) ||
                        (filters.volumePercentile.includes('low') && isLow) ||
                        (filters.volumePercentile.includes('ultra-low') && isUltraLow)
                    );
                });
            }
        }

        // Strategic filter logic - preset Volume Tier + Position Range combinations (multi-select)
        if (filters.strategicFilter.length > 0 && filters.ngram === 'full') {
            // Compute volume percentiles
            const allVolumes = filtered
                .map(t => (t as any).searchVolume || 0)
                .filter(v => v > 0)
                .sort((a, b) => a - b);

            if (allVolumes.length > 0) {
                const p15Index = Math.floor(allVolumes.length * 0.15);
                const p40Index = Math.floor(allVolumes.length * 0.40);
                const p75Index = Math.floor(allVolumes.length * 0.75);
                const p95Index = Math.floor(allVolumes.length * 0.95);
                const p15Value = allVolumes[p15Index] || 0;
                const p40Value = allVolumes[p40Index] || 0;
                const p75Value = allVolumes[p75Index] || 0;
                const p95Value = allVolumes[p95Index] || allVolumes[allVolumes.length - 1];

                const getVolumeTier = (vol: number): 'ultra-high' | 'high' | 'mid' | 'low' | 'ultra-low' => {
                    if (vol >= p95Value) return 'ultra-high';
                    if (vol >= p75Value) return 'high';
                    if (vol >= p40Value) return 'mid';
                    if (vol >= p15Value) return 'low';
                    return 'ultra-low';
                };

                const getBestPosition = (t: any): number | null => {
                    const positions = t.domainPositions as { domain: string; position: number }[] | undefined;
                    if (!positions || positions.length === 0) return null;
                    return Math.min(...positions.map(p => p.position));
                };

                filtered = filtered.filter(t => {
                    const vol = (t as any).searchVolume || 0;
                    const tier = getVolumeTier(vol);
                    const pos = getBestPosition(t);

                    if (vol === 0 || pos === null) return false;

                    // Helper function to check if keyword matches a specific filter
                    const matchesFilter = (filterName: string): boolean => {
                        switch (filterName) {
                            case 'core': return (tier === 'ultra-high' || tier === 'high') && pos >= 1 && pos <= 10;
                            case 'wins': return (tier === 'high' || tier === 'mid') && pos >= 5 && pos <= 10;
                            case 'leakage': return (tier === 'ultra-high' || tier === 'high') && pos >= 10 && pos <= 20;
                            case 'build': return tier === 'mid' && pos >= 20 && pos <= 50;
                            case 'gaps': return (tier === 'ultra-high' || tier === 'high') && pos >= 50;
                            case 'niche': return (tier === 'low' || tier === 'mid') && pos >= 1 && pos <= 10;
                            case 'passive': return (tier === 'low' || tier === 'ultra-low') && pos >= 20;
                            case 'uncategorized': {
                                const matchesAny =
                                    ((tier === 'ultra-high' || tier === 'high') && pos >= 1 && pos <= 10) ||
                                    ((tier === 'high' || tier === 'mid') && pos >= 5 && pos <= 10) ||
                                    ((tier === 'ultra-high' || tier === 'high') && pos >= 10 && pos <= 20) ||
                                    (tier === 'mid' && pos >= 20 && pos <= 50) ||
                                    ((tier === 'ultra-high' || tier === 'high') && pos >= 50) ||
                                    ((tier === 'low' || tier === 'mid') && pos >= 1 && pos <= 10) ||
                                    ((tier === 'low' || tier === 'ultra-low') && pos >= 20);
                                return !matchesAny;
                            }
                            default: return false;
                        }
                    };

                    // Multi-select: keyword passes if it matches ANY of the selected filters
                    return filters.strategicFilter.some(f => matchesFilter(f));
                });
            }
        }

        // Sort based on sizeBy (volume or frequency) and sortOrder
        if (filters.sizeBy === 'volume') {
            filtered = filtered.sort((a, b) => {
                const volA = (a as any).searchVolume || 0;
                const volB = (b as any).searchVolume || 0;
                return filters.sortOrder === 'desc' ? volB - volA : volA - volB;
            });
        } else {
            filtered = filtered.sort((a, b) => {
                return filters.sortOrder === 'desc' ? b.freq - a.freq : a.freq - b.freq;
            });
        }

        return filtered.slice(0, filters.limit);
    }, [terms, filters]);

    // Metrics & Scaling
    const activeTypeTerms = useMemo(() => {
        return terms.filter(t => {
            const type = (t as any).originalType || t.ngramType;
            return type === filters.ngram;
        });
    }, [terms, filters.ngram]);

    const totalCount = activeTypeTerms.length;
    const unassignedCount = activeTypeTerms.filter(t => !t.bucket).length;

    // Strategic filter configurations and counts
    // Each strategic filter is a preset combination of Volume Tier + Position Range
    const strategicFilterCounts = useMemo(() => {
        // First, compute volume percentiles for ALL full keywords (not just visible ones)
        const fullKeywords = terms.filter(t => {
            const type = (t as any).originalType || t.ngramType;
            return type === 'full';
        });

        const allVolumes = fullKeywords
            .map(t => (t as any).searchVolume || 0)
            .filter(v => v > 0)
            .sort((a, b) => a - b);

        if (allVolumes.length === 0) {
            return { core: 0, wins: 0, leakage: 0, build: 0, gaps: 0, niche: 0, total: 0, allMatched: 0 };
        }

        const p15Index = Math.floor(allVolumes.length * 0.15);
        const p40Index = Math.floor(allVolumes.length * 0.40);
        const p75Index = Math.floor(allVolumes.length * 0.75);
        const p95Index = Math.floor(allVolumes.length * 0.95);
        const p15Value = allVolumes[p15Index] || 0;
        const p40Value = allVolumes[p40Index] || 0;
        const p75Value = allVolumes[p75Index] || 0;
        const p95Value = allVolumes[p95Index] || allVolumes[allVolumes.length - 1];

        const getVolumeTier = (vol: number): 'ultra-high' | 'high' | 'mid' | 'low' | 'ultra-low' => {
            if (vol >= p95Value) return 'ultra-high';
            if (vol >= p75Value) return 'high';
            if (vol >= p40Value) return 'mid';
            if (vol >= p15Value) return 'low';
            return 'ultra-low';
        };

        const getBestPosition = (t: any): number | null => {
            const positions = t.domainPositions as { domain: string; position: number }[] | undefined;
            if (!positions || positions.length === 0) return null;
            return Math.min(...positions.map(p => p.position));
        };

        const matchesStrategicFilter = (t: any, filterName: string): boolean => {
            const vol = t.searchVolume || 0;
            const tier = getVolumeTier(vol);
            const pos = getBestPosition(t);

            if (vol === 0 || pos === null) return false;

            switch (filterName) {
                case 'core': // 🔴 UH+H | 1-10
                    return (tier === 'ultra-high' || tier === 'high') && pos >= 1 && pos <= 10;
                case 'wins': // 🟢 H+M | 5-10
                    return (tier === 'high' || tier === 'mid') && pos >= 5 && pos <= 10;
                case 'leakage': // 🟠 UH+H | 10-20
                    return (tier === 'ultra-high' || tier === 'high') && pos >= 10 && pos <= 20;
                case 'build': // 🔵 M | 20-50
                    return tier === 'mid' && pos >= 20 && pos <= 50;
                case 'gaps': // 🟣 UH+H | 50+
                    return (tier === 'ultra-high' || tier === 'high') && pos >= 50;
                case 'niche': // ⚪ L+M | 1-10
                    return (tier === 'low' || tier === 'mid') && pos >= 1 && pos <= 10;
                case 'passive': // ⚫ L+UL | 20+
                    return (tier === 'low' || tier === 'ultra-low') && pos >= 20;
                default:
                    return false;
            }
        };

        let core = 0, wins = 0, leakage = 0, build = 0, gaps = 0, niche = 0, passive = 0, uncategorized = 0;
        const matchedKeywords = new Set<string>();

        fullKeywords.forEach(t => {
            let matched = false;
            if (matchesStrategicFilter(t, 'core')) { core++; matchedKeywords.add(t.term); matched = true; }
            if (matchesStrategicFilter(t, 'wins')) { wins++; matchedKeywords.add(t.term); matched = true; }
            if (matchesStrategicFilter(t, 'leakage')) { leakage++; matchedKeywords.add(t.term); matched = true; }
            if (matchesStrategicFilter(t, 'build')) { build++; matchedKeywords.add(t.term); matched = true; }
            if (matchesStrategicFilter(t, 'gaps')) { gaps++; matchedKeywords.add(t.term); matched = true; }
            if (matchesStrategicFilter(t, 'niche')) { niche++; matchedKeywords.add(t.term); matched = true; }
            if (matchesStrategicFilter(t, 'passive')) { passive++; matchedKeywords.add(t.term); matched = true; }
            // Uncategorized: keywords that don't match any of the 7 strategic filters
            if (!matched) { uncategorized++; matchedKeywords.add(t.term); }
        });

        return {
            core, wins, leakage, build, gaps, niche, passive, uncategorized,
            total: fullKeywords.length,
            allMatched: matchedKeywords.size
        };
    }, [terms]);

    // Calculate scaling - support both frequency and volume as size basis
    const maxFreq = visibleTerms.length > 0 ? visibleTerms[0].freq : 1;
    const maxVolume = useMemo(() => {
        const volumes = visibleTerms.map(t => (t as any).searchVolume || 0).filter(v => v > 0);
        return volumes.length > 0 ? Math.max(...volumes) : 1;
    }, [visibleTerms]);

    const getScaleStyle = (term: UiTermEntry) => {
        // Linear scale between 0.85em and 2.5em
        let ratio: number;
        if (filters.sizeBy === 'volume') {
            const volume = (term as any).searchVolume || 0;
            ratio = maxVolume > 0 ? volume / maxVolume : 0;
        } else {
            ratio = maxFreq > 0 ? term.freq / maxFreq : 0;
        }
        const size = 0.85 + (ratio * 1.5);
        return { fontSize: `${Math.min(size, 2.5)}rem` };
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-6xl bg-white h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden transform transition-all scale-100">
                {/* Header */}
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-gray-800">Product Relevance Filter</h2>

                        {/* Client indicator */}
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-bold border border-indigo-200">
                            Client: {clientCode}
                        </span>
                        <span className="text-xs text-gray-400">
                            (Raw KWs: {rawKeywords.length})
                        </span>

                        <div className="group relative ml-2">
                            <svg className="w-5 h-5 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="hidden group-hover:block absolute top-full left-0 mt-2 w-96 p-4 bg-gray-900 text-white text-sm rounded-lg shadow-xl z-50">
                                <h3 className="font-bold mb-2">How Product Relevance Filter Works</h3>
                                <p className="mb-2">Classify keywords into 4 buckets. These power the "Tag All (Rules)" feature.</p>
                                <ul className="space-y-1 mb-3">
                                    <li><strong className="text-green-400">Include</strong> → FIT = CORE_MATCH (target these keywords)</li>
                                    <li><strong className="text-red-400">Exclude</strong> → FIT = NO_MATCH (ignore these keywords)</li>
                                    <li><strong className="text-purple-400">Brand</strong> → FIT = BRAND_KW (brand-related keywords)</li>
                                    <li><strong className="text-yellow-400">Review</strong> → FIT = REVIEW (needs human review)</li>
                                </ul>
                                <p className="mb-2 text-xs text-gray-400">Priority: Exclude → Brand → Include → Review</p>
                                <p>Auto-detection: Brand terms from domain name, common words auto-excluded.</p>
                            </div>
                        </div>

                        {/* Simplified header stats - only show keywords count and current view */}
                        <div className="flex gap-4 ml-6 text-sm border-l pl-6">
                            <div className="flex flex-col group relative">
                                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                                    Total Keywords
                                    <svg className="w-3 h-3 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </span>
                                <span className="font-bold text-blue-600 text-base">{terms.length}</span>
                                <span className="text-[10px] text-gray-400">Unique Full Keywords</span>
                                {/* Tooltip */}
                                <div className="hidden group-hover:block absolute top-full left-0 mt-1 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-50">
                                    <p className="font-bold mb-1">Why is this different from the main page?</p>
                                    <p className="text-gray-300">The main page shows <strong>total rows</strong> (includes duplicates across domains). This panel shows <strong>unique keywords</strong> to avoid classifying the same keyword twice.</p>
                                    <p className="mt-2 text-gray-400 text-[10px]">Example: "textile machine" may appear for 3 domains = 3 rows, but 1 unique keyword.</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-4 text-sm border-l pl-6">
                            <div className="flex flex-col">
                                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Current View</span>
                                <span className="font-bold text-gray-900 text-base">{totalCount}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Unassigned</span>
                                <span className="font-bold text-orange-600 text-base">{unassignedCount}</span>
                            </div>
                            {selectedTerms.size > 0 && (
                                <div className="flex flex-col animate-in fade-in slide-in-from-left-2 duration-200">
                                    <span className="text-xs text-indigo-500 uppercase tracking-wider font-semibold">Selected</span>
                                    <span className="font-bold text-indigo-600 text-base">{selectedTerms.size}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Reset Dictionary Button */}
                        <button
                            onClick={async () => {
                                if (confirm('Reset all bucket assignments? This will clear Include/Exclude/Brand from BOTH UI and database (Client Profile + Global Dictionary).')) {
                                    try {
                                        // 1. Clear local UI state
                                        setTerms(prev => prev.map(t => {
                                            // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                            const { bucket, source, ...rest } = t;
                                            return { ...rest, isPending: false } as UiTermEntry;
                                        }));
                                        setSelectedTerms(new Set());

                                        // 2. Save empty dictionary to database
                                        await fetch('/api/dictionary/term-builder/save', {
                                            method: 'POST',
                                            body: JSON.stringify({
                                                clientCode,
                                                domain,
                                                industryKey,
                                                saveToClient: true,
                                                saveToGlobal: false, // Disabled - only save to Client Profile
                                                terms: [] // Empty array clears the dictionary
                                            })
                                        });

                                        setHasUnsavedChanges(false);
                                        alert('Dictionary reset and saved to database.');
                                        // Refresh main page sidebar
                                        onDictionaryChange?.();
                                    } catch (e) {
                                        alert('Reset saved locally but database save failed.');
                                        setHasUnsavedChanges(true);
                                    }
                                }
                            }}
                            className="px-3 py-2 rounded-lg text-sm font-medium border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                            title="Clear all bucket assignments and save to database"
                        >
                            Reset Dictionary
                        </button>
                        {/* Select All Visible Button */}
                        <button
                            onClick={() => {
                                const allVisibleTermNames = visibleTerms.map(t => t.term);
                                setSelectedTerms(new Set(allVisibleTermNames));
                            }}
                            className="px-3 py-2 rounded-lg text-sm font-medium border border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Select all visible terms in current view"
                        >
                            Select All Visible ({visibleTerms.length})
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!hasUnsavedChanges}
                            title={`Saves changes to Client & Global Dictionaries.`}
                            className={`px-4 py-2 rounded-lg font-bold shadow-sm active:scale-95 transition-all ${hasUnsavedChanges ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                        >
                            Save Dictionary
                            {hasUnsavedChanges && <span className="ml-2 w-2 h-2 inline-block bg-white/50 rounded-full animate-pulse"></span>}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-gray-200"
                            title="Close"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* NEW: Prompt banner for new brand keywords */}
                {showNewBrandPrompt && newBrandKeywordsCount > 0 && (
                    <div className="px-6 py-3 bg-purple-50 border-b border-purple-200 flex items-center justify-between animate-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-purple-800">
                                    Found <span className="font-bold">{newBrandKeywordsCount}</span> new brand keywords
                                </p>
                                <p className="text-xs text-purple-600">
                                    These brand keywords from Competitor Master are not yet saved to the dictionary.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowNewBrandPrompt(false)}
                                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                Dismiss
                            </button>
                            <button
                                onClick={handleSaveNewBrandKeywords}
                                className="px-4 py-1.5 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Save Now
                            </button>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="px-6 py-3 border-b bg-white flex flex-wrap gap-4 items-center text-sm shadow-sm z-10 shrink-0">
                    {/* Removed ngram dropdown - now only full keywords are used */}

                    <div className="flex items-center gap-2">
                        <span className="text-gray-500">Min Freq:</span>
                        <input
                            type="range" min="1" max="50"
                            value={filters.minFreq}
                            onChange={e => setFilters({ ...filters, minFreq: Number(e.target.value) })}
                            className="w-24 accent-indigo-600"
                        />
                        <span className="w-6 text-center font-mono">{filters.minFreq}</span>
                    </div>

                    {/* Balloon Size dropdown - Volume auto-switches to Full Keyword with minFreq=1 */}
                    <div className="flex items-center gap-2 border-l pl-4">
                        <span className="text-gray-500">Size By:</span>
                        <select
                            value={filters.sizeBy}
                            onChange={e => {
                                const newSizeBy = e.target.value as 'frequency' | 'volume';
                                if (newSizeBy === 'volume') {
                                    // Auto-switch to Full Keyword and set minFreq to 1
                                    setFilters({ ...filters, sizeBy: newSizeBy, ngram: 'full', minFreq: 1, sortOrder: 'desc' });
                                } else {
                                    setFilters({ ...filters, sizeBy: newSizeBy });
                                }
                            }}
                            className="border-gray-300 rounded px-2 py-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="frequency">Frequency</option>
                            <option value="volume">Search Volume</option>
                        </select>
                    </div>

                    {/* Sort Order dropdown */}
                    <div className="flex items-center gap-2 border-l pl-4">
                        <span className="text-gray-500">{filters.sizeBy === 'volume' ? 'Sort by Volume:' : 'Sort by Frequency:'}</span>
                        <select
                            value={filters.sortOrder}
                            onChange={e => setFilters({ ...filters, sortOrder: e.target.value as 'desc' | 'asc' })}
                            className="border-gray-300 rounded px-2 py-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="desc">Largest First</option>
                            <option value="asc">Smallest First</option>
                        </select>
                    </div>

                    {/* Min Volume filter - only shows when sizeBy is volume */}
                    {filters.sizeBy === 'volume' && (
                        <div className="flex items-center gap-2 border-l pl-4">
                            <span className="text-gray-500">Min Vol:</span>
                            <input
                                type="number"
                                value={filters.minVolume}
                                onChange={e => setFilters({ ...filters, minVolume: Number(e.target.value) })}
                                className="border-gray-300 rounded px-2 py-1 text-sm w-20 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="0"
                                min="0"
                                step="100"
                            />
                        </div>
                    )}

                    {/* Volume Percentile Filter - only shows when sizeBy is volume and ngram is full */}
                    {filters.sizeBy === 'volume' && filters.ngram === 'full' && (
                        <div className="flex items-center gap-2 border-l pl-4">
                            <span className="text-gray-500 text-xs">Volume Tier:</span>
                            <div className="flex gap-1">
                                {/* Ultra-High Volume */}
                                <div className="group relative">
                                    <button
                                        onClick={() => {
                                            const isSelected = filters.volumePercentile.includes('ultra-high');
                                            setFilters(prev => ({
                                                ...prev,
                                                volumePercentile: isSelected
                                                    ? prev.volumePercentile.filter(p => p !== 'ultra-high')
                                                    : [...prev.volumePercentile, 'ultra-high']
                                            }));
                                        }}
                                        className={`px-2 py-0.5 text-[10px] rounded border transition-all ${filters.volumePercentile.includes('ultra-high')
                                            ? 'bg-red-100 text-red-800 border-red-300 ring-2 ring-offset-1 ring-indigo-400'
                                            : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                                            }`}
                                    >
                                        Ultra-High ({volumePercentileCounts.ultraHigh})
                                    </button>
                                    <div className="hidden group-hover:block absolute top-full left-0 mt-1 w-80 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-50">
                                        <h4 className="font-bold text-red-400 mb-1">Ultra-High Volume</h4>
                                        <p className="text-gray-300 mb-1"><strong>Percentile:</strong> Top 5% (≥ P95)</p>
                                        <p className="text-gray-300 mb-2"><strong>Range:</strong> ≥ {volumePercentileCounts.p95.toLocaleString()} searches</p>
                                        <div className="border-t border-gray-700 pt-2 mt-2">
                                            <p className="mb-1"><strong className="text-gray-200">Role in SEO:</strong> Category-defining keywords that represent the core of market demand</p>
                                            <p className="mb-1 text-gray-400"><strong>Characteristics:</strong> Extremely competitive, high CPC, strong commercial intent, dominated by brands</p>
                                            <p className="mb-1"><strong className="text-gray-200">Use Cases:</strong> Market size estimation, revenue/RFQ leakage, authority positioning</p>
                                            <p className="text-yellow-300 text-[10px] mt-2 italic">⚡ Non-negotiable for category leadership but requires sustained investment</p>
                                        </div>
                                    </div>
                                </div>

                                {/* High Volume */}
                                <div className="group relative">
                                    <button
                                        onClick={() => {
                                            const isSelected = filters.volumePercentile.includes('high');
                                            setFilters(prev => ({
                                                ...prev,
                                                volumePercentile: isSelected
                                                    ? prev.volumePercentile.filter(p => p !== 'high')
                                                    : [...prev.volumePercentile, 'high']
                                            }));
                                        }}
                                        className={`px-2 py-0.5 text-[10px] rounded border transition-all ${filters.volumePercentile.includes('high')
                                            ? 'bg-orange-100 text-orange-800 border-orange-300 ring-2 ring-offset-1 ring-indigo-400'
                                            : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                                            }`}
                                    >
                                        High ({volumePercentileCounts.high})
                                    </button>
                                    <div className="hidden group-hover:block absolute top-full left-0 mt-1 w-80 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-50">
                                        <h4 className="font-bold text-orange-400 mb-1">High Volume</h4>
                                        <p className="text-gray-300 mb-1"><strong>Percentile:</strong> P75 – P95</p>
                                        <p className="text-gray-300 mb-2"><strong>Range:</strong> {volumePercentileCounts.p75.toLocaleString()} – {volumePercentileCounts.p95.toLocaleString()} searches</p>
                                        <div className="border-t border-gray-700 pt-2 mt-2">
                                            <p className="mb-1"><strong className="text-gray-200">Role in SEO:</strong> Primary demand drivers with strong traffic and conversion potential</p>
                                            <p className="mb-1 text-gray-400"><strong>Characteristics:</strong> Commercial or mixed intent, achievable with structured content, clear ROI</p>
                                            <p className="mb-1"><strong className="text-gray-200">Use Cases:</strong> Priority gap analysis, competitor displacement, money-page optimization</p>
                                            <p className="text-green-300 text-[10px] mt-2 italic">💰 Highest risk-adjusted ROI in most SEO programs</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Mid Volume */}
                                <div className="group relative">
                                    <button
                                        onClick={() => {
                                            const isSelected = filters.volumePercentile.includes('mid');
                                            setFilters(prev => ({
                                                ...prev,
                                                volumePercentile: isSelected
                                                    ? prev.volumePercentile.filter(p => p !== 'mid')
                                                    : [...prev.volumePercentile, 'mid']
                                            }));
                                        }}
                                        className={`px-2 py-0.5 text-[10px] rounded border transition-all ${filters.volumePercentile.includes('mid')
                                            ? 'bg-yellow-100 text-yellow-800 border-yellow-300 ring-2 ring-offset-1 ring-indigo-400'
                                            : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                                            }`}
                                    >
                                        Mid ({volumePercentileCounts.mid})
                                    </button>
                                    <div className="hidden group-hover:block absolute top-full left-0 mt-1 w-80 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-50">
                                        <h4 className="font-bold text-yellow-400 mb-1">Mid Volume</h4>
                                        <p className="text-gray-300 mb-1"><strong>Percentile:</strong> P40 – P75</p>
                                        <p className="text-gray-300 mb-2"><strong>Range:</strong> {volumePercentileCounts.p40.toLocaleString()} – {volumePercentileCounts.p75.toLocaleString()} searches</p>
                                        <div className="border-t border-gray-700 pt-2 mt-2">
                                            <p className="mb-1"><strong className="text-gray-200">Role in SEO:</strong> Scalable growth layer that compounds traffic over time</p>
                                            <p className="mb-1 text-gray-400"><strong>Characteristics:</strong> Mixed intent, easier to rank than high-volume, strong internal-link leverage</p>
                                            <p className="mb-1"><strong className="text-gray-200">Use Cases:</strong> Content cluster expansion, medium-term growth, supporting high-volume rankings</p>
                                            <p className="text-blue-300 text-[10px] mt-2 italic">🔧 The workhorse bucket for consistent SEO growth</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Low Volume */}
                                <div className="group relative">
                                    <button
                                        onClick={() => {
                                            const isSelected = filters.volumePercentile.includes('low');
                                            setFilters(prev => ({
                                                ...prev,
                                                volumePercentile: isSelected
                                                    ? prev.volumePercentile.filter(p => p !== 'low')
                                                    : [...prev.volumePercentile, 'low']
                                            }));
                                        }}
                                        className={`px-2 py-0.5 text-[10px] rounded border transition-all ${filters.volumePercentile.includes('low')
                                            ? 'bg-green-100 text-green-800 border-green-300 ring-2 ring-offset-1 ring-indigo-400'
                                            : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                                            }`}
                                    >
                                        Low ({volumePercentileCounts.low})
                                    </button>
                                    <div className="hidden group-hover:block absolute top-full left-0 mt-1 w-80 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-50">
                                        <h4 className="font-bold text-green-400 mb-1">Low Volume</h4>
                                        <p className="text-gray-300 mb-1"><strong>Percentile:</strong> P15 – P40</p>
                                        <p className="text-gray-300 mb-2"><strong>Range:</strong> {volumePercentileCounts.p15.toLocaleString()} – {volumePercentileCounts.p40.toLocaleString()} searches</p>
                                        <div className="border-t border-gray-700 pt-2 mt-2">
                                            <p className="mb-1"><strong className="text-gray-200">Role in SEO:</strong> Intent-rich long-tail keywords with high relevance</p>
                                            <p className="mb-1 text-gray-400"><strong>Characteristics:</strong> Specific queries, lower competition, higher conversion probability</p>
                                            <p className="mb-1"><strong className="text-gray-200">Use Cases:</strong> TOFU/MOFU content, FAQs, use cases, internal linking depth</p>
                                            <p className="text-purple-300 text-[10px] mt-2 italic">🎯 Individually small, collectively powerful for authority</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Ultra-Low Volume */}
                                <div className="group relative">
                                    <button
                                        onClick={() => {
                                            const isSelected = filters.volumePercentile.includes('ultra-low');
                                            setFilters(prev => ({
                                                ...prev,
                                                volumePercentile: isSelected
                                                    ? prev.volumePercentile.filter(p => p !== 'ultra-low')
                                                    : [...prev.volumePercentile, 'ultra-low']
                                            }));
                                        }}
                                        className={`px-2 py-0.5 text-[10px] rounded border transition-all ${filters.volumePercentile.includes('ultra-low')
                                            ? 'bg-blue-100 text-blue-800 border-blue-300 ring-2 ring-offset-1 ring-indigo-400'
                                            : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                                            }`}
                                    >
                                        Ultra-Low ({volumePercentileCounts.ultraLow})
                                    </button>
                                    <div className="hidden group-hover:block absolute top-full left-0 mt-1 w-80 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-50">
                                        <h4 className="font-bold text-blue-400 mb-1">Ultra-Low Volume</h4>
                                        <p className="text-gray-300 mb-1"><strong>Percentile:</strong> Bottom 15% (&lt; P15)</p>
                                        <p className="text-gray-300 mb-2"><strong>Range:</strong> &lt; {volumePercentileCounts.p15.toLocaleString()} searches</p>
                                        <div className="border-t border-gray-700 pt-2 mt-2">
                                            <p className="mb-1"><strong className="text-gray-200">Role in SEO:</strong> Topical completeness and semantic coverage</p>
                                            <p className="mb-1 text-gray-400"><strong>Characteristics:</strong> Very niche/emerging, often zero-click, minimal standalone traffic</p>
                                            <p className="mb-1"><strong className="text-gray-200">Use Cases:</strong> Topical authority, semantic relevance, future demand capture</p>
                                            <p className="text-gray-400 text-[10px] mt-2 italic">📚 Rarely standalone pages but critical for E-E-A-T and trust</p>
                                        </div>
                                    </div>
                                </div>

                                {filters.volumePercentile.length > 0 && (
                                    <button
                                        onClick={() => setFilters(prev => ({ ...prev, volumePercentile: [] }))}
                                        className="px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-gray-600"
                                        title="Clear volume tier filter"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Position Range filter - only shows for Full Keyword view */}
                    {filters.ngram === 'full' && (
                        <div className="flex items-center gap-2 border-l pl-4">
                            <span className="text-gray-500">Rank:</span>
                            <select
                                value={filters.positionRange}
                                onChange={e => setFilters({ ...filters, positionRange: e.target.value as any })}
                                className="border-gray-300 rounded px-2 py-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="">All Positions</option>
                                <option value="1-3">Top 3 (1-3)</option>
                                <option value="1-5">Top 5 (1-5)</option>
                                <option value="1-10">Top 10 (1-10)</option>
                                <option value="5-10">5-10</option>
                                <option value="10-20">10-20</option>
                                <option value="20-50">20-50</option>
                                <option value="50+">50+</option>
                            </select>
                        </div>
                    )}

                    <div className="relative group">
                        <input
                            type="text"
                            placeholder='Search... (use "word" for exact)'
                            value={filters.search}
                            onChange={e => setFilters({ ...filters, search: e.target.value })}
                            className="pl-8 pr-3 py-1 border-gray-300 rounded px-3 w-56 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <svg className="w-4 h-4 text-gray-400 absolute left-2 top-1.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <div className="hidden group-hover:block absolute top-full left-0 mt-1 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-50">
                            <p className="mb-1"><strong>Substring:</strong> age → matches "im<u>age</u>", "<u>age</u> calc"</p>
                            <p><strong>Exact word:</strong> "age" → matches "<u>age</u> calc" but NOT "image"</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 border-l pl-4">
                        <span className="text-gray-500">Limit:</span>
                        <select
                            value={filters.limit}
                            onChange={e => setFilters({ ...filters, limit: Number(e.target.value) })}
                            className="border-gray-300 rounded px-2 py-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="150">150</option>
                            <option value="300">300</option>
                            <option value="500">500</option>
                            <option value="1000">1000</option>
                            <option value="99999">All</option>
                        </select>
                    </div>
                    {/* Bucket Filter (Multi-select) */}
                    <div className="flex items-center gap-2 border-l pl-4">
                        <span className="text-gray-500 text-xs">Bucket:</span>
                        <div className="flex gap-1">
                            {(['include', 'review', 'brand', 'exclude', 'unassigned'] as const).map(bucket => {
                                const isSelected = filters.bucketFilter.includes(bucket);
                                const colors: Record<string, string> = {
                                    include: 'bg-green-100 text-green-800 border-green-300',
                                    exclude: 'bg-red-100 text-red-800 border-red-300',
                                    brand: 'bg-purple-100 text-purple-800 border-purple-300',
                                    review: 'bg-blue-100 text-blue-800 border-blue-300',
                                    unassigned: 'bg-gray-100 text-gray-600 border-gray-300'
                                };
                                return (
                                    <button
                                        key={bucket}
                                        onClick={() => {
                                            setFilters(prev => ({
                                                ...prev,
                                                bucketFilter: isSelected
                                                    ? prev.bucketFilter.filter(b => b !== bucket)
                                                    : [...prev.bucketFilter, bucket]
                                            }));
                                        }}
                                        className={`px-2 py-0.5 text-[10px] rounded border transition-all ${isSelected
                                            ? `${colors[bucket]} ring-2 ring-offset-1 ring-indigo-400`
                                            : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                                            }`}
                                        title={BUCKET_TOOLTIPS[bucket]}
                                    >
                                        {BUCKET_DISPLAY_NAMES[bucket]} ({bucketCounts[bucket]})
                                    </button>
                                );
                            })}
                            {filters.bucketFilter.length > 0 && (
                                <button
                                    onClick={() => setFilters(prev => ({ ...prev, bucketFilter: [] }))}
                                    className="px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-gray-600"
                                    title="Clear all bucket filters"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Competition Type and Domain Filter Row */}
                <div className="px-6 py-2 border-b bg-gray-50/50 flex flex-wrap gap-4 items-center text-sm shrink-0">
                    {/* Competition Type Filter */}
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs">Competition Type:</span>
                        <div className="flex gap-1 flex-wrap">
                            {uniqueCompetitionTypes.map(type => {
                                const isSelected = filters.competitionType.includes(type);
                                const count = competitionTypeCounts[type] || 0;
                                const colorClass = type === 'Main' ? 'bg-red-100 text-red-700 border-red-300' :
                                    type === 'Self' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                                        type === 'Partial' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                                            type === 'Small' ? 'bg-orange-100 text-orange-700 border-orange-300' :
                                                type === 'Marketplace' ? 'bg-purple-100 text-purple-700 border-purple-300' :
                                                    type === 'Not a' ? 'bg-gray-100 text-gray-600 border-gray-300' :
                                                        'bg-gray-50 text-gray-500 border-gray-200';
                                return (
                                    <button
                                        key={type}
                                        onClick={() => {
                                            setFilters(prev => ({
                                                ...prev,
                                                competitionType: isSelected
                                                    ? prev.competitionType.filter(t => t !== type)
                                                    : [...prev.competitionType, type]
                                            }));
                                        }}
                                        className={`px-2 py-0.5 text-[10px] rounded border transition-all ${isSelected
                                            ? `${colorClass} ring-2 ring-offset-1 ring-indigo-400 font-bold`
                                            : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                                            }`}
                                    >
                                        {type} ({count})
                                    </button>
                                );
                            })}
                            {filters.competitionType.length > 0 && (
                                <button
                                    onClick={() => setFilters(prev => ({ ...prev, competitionType: [] }))}
                                    className="px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-gray-600"
                                    title="Clear competition type filter"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Domain Filter - Multi-select with search */}
                    <div className="flex items-center gap-2 border-l pl-4">
                        <span className="text-gray-500 text-xs">Domain:</span>
                        <div className="relative">
                            <select
                                className="text-xs border border-gray-200 rounded px-2 py-1 bg-white min-w-[150px] max-w-[200px]"
                                value=""
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val && !filters.selectedDomains.includes(val)) {
                                        setFilters(prev => ({ ...prev, selectedDomains: [...prev.selectedDomains, val] }));
                                    }
                                }}
                            >
                                <option value="">Select domain...</option>
                                {Object.entries(uniqueDomains).map(([domain, count]) => (
                                    <option key={domain} value={domain} disabled={filters.selectedDomains.includes(domain)}>
                                        {domain} ({count})
                                    </option>
                                ))}
                            </select>
                        </div>
                        {filters.selectedDomains.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                                {filters.selectedDomains.map(domain => (
                                    <span
                                        key={domain}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] rounded border border-indigo-200"
                                    >
                                        {domain}
                                        <button
                                            onClick={() => setFilters(prev => ({
                                                ...prev,
                                                selectedDomains: prev.selectedDomains.filter(d => d !== domain)
                                            }))}
                                            className="text-indigo-400 hover:text-indigo-600"
                                        >
                                            ✕
                                        </button>
                                    </span>
                                ))}
                                <button
                                    onClick={() => setFilters(prev => ({ ...prev, selectedDomains: [] }))}
                                    className="px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-red-500"
                                    title="Clear all domains"
                                >
                                    Clear all
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-6 py-2.5 border-b bg-gradient-to-r from-slate-100/80 via-white to-slate-50/50 flex flex-wrap gap-2 items-center text-sm shrink-0">
                    <div className="flex items-center gap-2 mr-2">
                        <span className="text-gray-700 font-bold text-xs uppercase tracking-wide">Strategy</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${strategicFilterCounts.allMatched === strategicFilterCounts.total
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-100 text-amber-700 border border-amber-200'
                            }`}>
                            {Math.round((strategicFilterCounts.allMatched / strategicFilterCounts.total) * 100)}%
                        </span>
                    </div>

                    {/* Core Filter */}
                    <div className="group relative">
                        <button
                            onClick={() => setFilters(prev => ({ ...prev, strategicFilter: prev.strategicFilter.includes('core') ? prev.strategicFilter.filter(f => f !== 'core') : [...prev.strategicFilter, 'core'], volumePercentile: [], positionRange: '' }))}
                            className={`px-3 py-1 text-[11px] rounded-full border-2 font-bold transition-all ${filters.strategicFilter.includes('core')
                                ? 'bg-red-500 text-white border-red-500 ring-2 ring-offset-1 ring-red-300 shadow-lg'
                                : 'bg-white text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400'
                                }`}
                        >
                            🔴 Core ({strategicFilterCounts.core})
                        </button>
                        <div className="hidden group-hover:block absolute top-full left-0 mt-2 w-80 p-4 bg-gray-900 text-white text-xs rounded-xl shadow-2xl z-50 border border-gray-700">
                            <h4 className="font-bold text-red-400 mb-2 text-sm">🔴 Core (UH+H | 1–10)</h4>
                            <p className="text-gray-300 mb-2"><strong>Question:</strong> Are we visible in the core markets where demand already exists?</p>
                            <div className="bg-gray-800 rounded p-2 mb-2">
                                <span className="text-red-300 font-mono text-[10px]">Volume: Ultra-High + High | Rank: 1–10</span>
                            </div>
                            <p className="text-gray-400 mb-2 text-[10px]">These keywords define the core demand of the industry. If competitors rank on page one and you don't, it signals a fundamental relevance and positioning gap.</p>
                            <div className="border-t border-gray-700 pt-2 mt-2">
                                <p className="text-yellow-300 text-[10px]">💡 <strong>Content Strategy:</strong> Mandatory category/product pages, core solution pages, commercial intent alignment</p>
                            </div>
                        </div>
                    </div>

                    {/* Wins Filter */}
                    <div className="group relative">
                        <button
                            onClick={() => setFilters(prev => ({ ...prev, strategicFilter: prev.strategicFilter.includes('wins') ? prev.strategicFilter.filter(f => f !== 'wins') : [...prev.strategicFilter, 'wins'], volumePercentile: [], positionRange: '' }))}
                            className={`px-3 py-1 text-[11px] rounded-full border-2 font-bold transition-all ${filters.strategicFilter.includes('wins')
                                ? 'bg-green-500 text-white border-green-500 ring-2 ring-offset-1 ring-green-300 shadow-lg'
                                : 'bg-white text-green-600 border-green-300 hover:bg-green-50 hover:border-green-400'
                                }`}
                        >
                            🟢 Wins ({strategicFilterCounts.wins})
                        </button>
                        <div className="hidden group-hover:block absolute top-full left-0 mt-2 w-80 p-4 bg-gray-900 text-white text-xs rounded-xl shadow-2xl z-50 border border-gray-700">
                            <h4 className="font-bold text-green-400 mb-2 text-sm">🟢 Wins (H+M | 5–10)</h4>
                            <p className="text-gray-300 mb-2"><strong>Question:</strong> Which keywords can you win quickly with minimal effort?</p>
                            <div className="bg-gray-800 rounded p-2 mb-2">
                                <span className="text-green-300 font-mono text-[10px]">Volume: High + Mid | Rank: 5–10</span>
                            </div>
                            <p className="text-gray-400 mb-2 text-[10px]">These keywords already rank on page one but aren't fully optimized. They represent the fastest SEO ROI opportunities.</p>
                            <div className="border-t border-gray-700 pt-2 mt-2">
                                <p className="text-yellow-300 text-[10px]">💡 <strong>Content Strategy:</strong> Content refresh, title/CTR optimization, internal linking, schema enhancements</p>
                            </div>
                        </div>
                    </div>

                    {/* Leakage Filter */}
                    <div className="group relative">
                        <button
                            onClick={() => setFilters(prev => ({ ...prev, strategicFilter: prev.strategicFilter.includes('leakage') ? prev.strategicFilter.filter(f => f !== 'leakage') : [...prev.strategicFilter, 'leakage'], volumePercentile: [], positionRange: '' }))}
                            className={`px-3 py-1 text-[11px] rounded-full border-2 font-bold transition-all ${filters.strategicFilter.includes('leakage')
                                ? 'bg-orange-500 text-white border-orange-500 ring-2 ring-offset-1 ring-orange-300 shadow-lg'
                                : 'bg-white text-orange-600 border-orange-300 hover:bg-orange-50 hover:border-orange-400'
                                }`}
                        >
                            🟠 Leakage ({strategicFilterCounts.leakage})
                        </button>
                        <div className="hidden group-hover:block absolute top-full left-0 mt-2 w-80 p-4 bg-gray-900 text-white text-xs rounded-xl shadow-2xl z-50 border border-gray-700">
                            <h4 className="font-bold text-orange-400 mb-2 text-sm">🟠 Leakage (UH+H | 10–20)</h4>
                            <p className="text-gray-300 mb-2"><strong>Question:</strong> Where is high-value demand leaking to competitors?</p>
                            <div className="bg-gray-800 rounded p-2 mb-2">
                                <span className="text-orange-300 font-mono text-[10px]">Volume: Ultra-High + High | Rank: 10–20</span>
                            </div>
                            <p className="text-gray-400 mb-2 text-[10px]">These have strong demand but sit on page two where visibility is minimal. They represent lost traffic, lost inquiries, and lost revenue.</p>
                            <div className="border-t border-gray-700 pt-2 mt-2">
                                <p className="text-yellow-300 text-[10px]">💡 <strong>Content Strategy:</strong> Deep content rewrites, competitive comparison pages, trust/proof content</p>
                            </div>
                        </div>
                    </div>

                    {/* Build Filter */}
                    <div className="group relative">
                        <button
                            onClick={() => setFilters(prev => ({ ...prev, strategicFilter: prev.strategicFilter.includes('build') ? prev.strategicFilter.filter(f => f !== 'build') : [...prev.strategicFilter, 'build'], volumePercentile: [], positionRange: '' }))}
                            className={`px-3 py-1 text-[11px] rounded-full border-2 font-bold transition-all ${filters.strategicFilter.includes('build')
                                ? 'bg-blue-500 text-white border-blue-500 ring-2 ring-offset-1 ring-blue-300 shadow-lg'
                                : 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50 hover:border-blue-400'
                                }`}
                        >
                            🔵 Build ({strategicFilterCounts.build})
                        </button>
                        <div className="hidden group-hover:block absolute top-full left-0 mt-2 w-80 p-4 bg-gray-900 text-white text-xs rounded-xl shadow-2xl z-50 border border-gray-700">
                            <h4 className="font-bold text-blue-400 mb-2 text-sm">🔵 Build (M | 20–50)</h4>
                            <p className="text-gray-300 mb-2"><strong>Question:</strong> Where should you invest to build future authority?</p>
                            <div className="bg-gray-800 rounded p-2 mb-2">
                                <span className="text-blue-300 font-mono text-[10px]">Volume: Mid | Rank: 20–50</span>
                            </div>
                            <p className="text-gray-400 mb-2 text-[10px]">Consistent demand with manageable competition. Ideal for scalable content expansion, not short-term wins.</p>
                            <div className="border-t border-gray-700 pt-2 mt-2">
                                <p className="text-yellow-300 text-[10px]">💡 <strong>Content Strategy:</strong> Educational content, use-case pages, topic clusters, internal linking</p>
                            </div>
                        </div>
                    </div>

                    {/* Gaps Filter */}
                    <div className="group relative">
                        <button
                            onClick={() => setFilters(prev => ({ ...prev, strategicFilter: prev.strategicFilter.includes('gaps') ? prev.strategicFilter.filter(f => f !== 'gaps') : [...prev.strategicFilter, 'gaps'], volumePercentile: [], positionRange: '' }))}
                            className={`px-3 py-1 text-[11px] rounded-full border-2 font-bold transition-all ${filters.strategicFilter.includes('gaps')
                                ? 'bg-purple-500 text-white border-purple-500 ring-2 ring-offset-1 ring-purple-300 shadow-lg'
                                : 'bg-white text-purple-600 border-purple-300 hover:bg-purple-50 hover:border-purple-400'
                                }`}
                        >
                            🟣 Gaps ({strategicFilterCounts.gaps})
                        </button>
                        <div className="hidden group-hover:block absolute top-full left-0 mt-2 w-80 p-4 bg-gray-900 text-white text-xs rounded-xl shadow-2xl z-50 border border-gray-700">
                            <h4 className="font-bold text-purple-400 mb-2 text-sm">🟣 Gaps (UH+H | 50+)</h4>
                            <p className="text-gray-300 mb-2"><strong>Question:</strong> Which markets do competitors dominate but you don't?</p>
                            <div className="bg-gray-800 rounded p-2 mb-2">
                                <span className="text-purple-300 font-mono text-[10px]">Volume: Ultra-High + High | Rank: 50+</span>
                            </div>
                            <p className="text-gray-400 mb-2 text-[10px]">Entire market segments where you have little or no presence. This is a business positioning insight, not just an SEO gap.</p>
                            <div className="border-t border-gray-700 pt-2 mt-2">
                                <p className="text-yellow-300 text-[10px]">💡 <strong>Content Strategy:</strong> New category creation, full topic clusters, long-term authority building</p>
                            </div>
                        </div>
                    </div>

                    {/* Niche Filter */}
                    <div className="group relative">
                        <button
                            onClick={() => setFilters(prev => ({ ...prev, strategicFilter: prev.strategicFilter.includes('niche') ? prev.strategicFilter.filter(f => f !== 'niche') : [...prev.strategicFilter, 'niche'], volumePercentile: [], positionRange: '' }))}
                            className={`px-3 py-1 text-[11px] rounded-full border-2 font-bold transition-all ${filters.strategicFilter.includes('niche')
                                ? 'bg-gray-500 text-white border-gray-500 ring-2 ring-offset-1 ring-gray-300 shadow-lg'
                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                                }`}
                        >
                            ⚪ Niche ({strategicFilterCounts.niche})
                        </button>
                        <div className="hidden group-hover:block absolute top-full left-0 mt-2 w-80 p-4 bg-gray-900 text-white text-xs rounded-xl shadow-2xl z-50 border border-gray-700">
                            <h4 className="font-bold text-gray-300 mb-2 text-sm">⚪ Niche (L+M | 1–10)</h4>
                            <p className="text-gray-300 mb-2"><strong>Question:</strong> Which keywords support high-intent, qualified conversions?</p>
                            <div className="bg-gray-800 rounded p-2 mb-2">
                                <span className="text-gray-400 font-mono text-[10px]">Volume: Low + Mid | Rank: 1–10</span>
                            </div>
                            <p className="text-gray-400 mb-2 text-[10px]">Low volume but often strong commercial or technical intent. They support sales conversations and decision-stage users.</p>
                            <div className="border-t border-gray-700 pt-2 mt-2">
                                <p className="text-yellow-300 text-[10px]">💡 <strong>Content Strategy:</strong> Technical FAQs, specification pages, sales enablement content</p>
                            </div>
                        </div>
                    </div>

                    {/* Passive / Ignore Filter */}
                    <div className="group relative">
                        <button
                            onClick={() => setFilters(prev => ({ ...prev, strategicFilter: prev.strategicFilter.includes('passive') ? prev.strategicFilter.filter(f => f !== 'passive') : [...prev.strategicFilter, 'passive'], volumePercentile: [], positionRange: '' }))}
                            className={`px-3 py-1 text-[11px] rounded-full border-2 font-bold transition-all ${filters.strategicFilter.includes('passive')
                                ? 'bg-gray-800 text-white border-gray-800 ring-2 ring-offset-1 ring-gray-500 shadow-lg'
                                : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-100 hover:border-gray-400'
                                }`}
                        >
                            ⚫ Passive ({strategicFilterCounts.passive})
                        </button>
                        <div className="hidden group-hover:block absolute top-full right-0 mt-2 w-96 p-4 bg-gray-900 text-white text-xs rounded-xl shadow-2xl z-50 border border-gray-700">
                            <h4 className="font-bold text-gray-400 mb-2 text-sm">⚫ Passive / Ignore (L+UL | 20+)</h4>
                            <p className="text-gray-300 mb-2"><strong>Definition:</strong> Keywords that do not meet minimum thresholds for traffic, relevance, or strategic impact.</p>
                            <div className="bg-gray-800 rounded p-2 mb-2">
                                <span className="text-gray-400 font-mono text-[10px]">Volume: Low + Ultra-Low | Rank: 20+</span>
                            </div>
                            <div className="bg-red-900/30 border border-red-700/50 rounded p-2 mb-2">
                                <p className="text-red-300 text-[10px] font-bold mb-1">❌ Action: EXCLUDED FROM STRATEGY</p>
                                <ul className="text-gray-400 text-[10px] list-disc list-inside space-y-0.5">
                                    <li>No content creation</li>
                                    <li>No optimization</li>
                                    <li>No reporting emphasis</li>
                                    <li>Auto-check quarterly for promotion</li>
                                </ul>
                            </div>
                            <div className="border-t border-gray-700 pt-2 mt-2">
                                <p className="text-yellow-300 text-[10px] italic">"SEO success is not about handling more keywords. It is about handling fewer keywords correctly."</p>
                            </div>
                        </div>
                    </div>

                    {/* Uncategorized Filter */}
                    <div className="group relative">
                        <button
                            onClick={() => setFilters(prev => ({ ...prev, strategicFilter: prev.strategicFilter.includes('uncategorized') ? prev.strategicFilter.filter(f => f !== 'uncategorized') : [...prev.strategicFilter, 'uncategorized'], volumePercentile: [], positionRange: '' }))}
                            className={`px-3 py-1 text-[11px] rounded-full border-2 font-bold transition-all ${filters.strategicFilter.includes('uncategorized')
                                ? 'bg-slate-600 text-white border-slate-600 ring-2 ring-offset-1 ring-slate-400 shadow-lg'
                                : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50 hover:border-slate-400'
                                }`}
                        >
                            🔘 Other ({strategicFilterCounts.uncategorized})
                        </button>
                        <div className="hidden group-hover:block absolute top-full right-0 mt-2 w-96 p-4 bg-gray-900 text-white text-xs rounded-xl shadow-2xl z-50 border border-gray-700">
                            <h4 className="font-bold text-slate-300 mb-2 text-sm">🔘 Uncategorized / Edge Cases</h4>
                            <p className="text-gray-300 mb-2"><strong>Definition:</strong> Keywords that fall between the strategic filter boundaries - not clearly actionable in any priority bucket.</p>
                            <div className="bg-gray-800 rounded p-2 mb-2">
                                <span className="text-slate-400 font-mono text-[10px]">Examples: UH/H rank 11-19, Mid rank 1-4 or 11-19, Low rank 11-19, Ultra-Low rank 1-19</span>
                            </div>
                            <div className="bg-blue-900/30 border border-blue-700/50 rounded p-2 mb-2">
                                <p className="text-blue-300 text-[10px] font-bold mb-1">🔍 Review Recommended</p>
                                <ul className="text-gray-400 text-[10px] list-disc list-inside space-y-0.5">
                                    <li>May contain hidden opportunities</li>
                                    <li>Could be promoted to strategic buckets with ranking improvements</li>
                                    <li>Review quarterly for potential upgrades</li>
                                    <li>Some may deserve manual investigation</li>
                                </ul>
                            </div>
                            <div className="border-t border-gray-700 pt-2 mt-2">
                                <p className="text-yellow-300 text-[10px] italic">These keywords exist in the "gray zone" between clear strategic priorities. They aren't bad - just not the first place to invest time.</p>
                            </div>
                        </div>
                    </div>

                    {/* Clear and Coverage Stats */}
                    {filters.strategicFilter.length > 0 && (
                        <button
                            onClick={() => setFilters(prev => ({ ...prev, strategicFilter: [] }))}
                            className="px-2 py-0.5 text-[10px] text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Clear all strategic filters"
                        >
                            ✕ Clear
                        </button>
                    )}
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-hidden flex flex-row">

                    {/* Visualizer (Cloud) */}
                    <div className="flex-1 p-8 overflow-y-auto bg-slate-50 relative">
                        {loading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-20">
                                <span className="flex items-center gap-2 text-indigo-600 font-medium">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                                    Loading dictionary...
                                </span>
                            </div>
                        )}

                        {!loading && visibleTerms.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
                                <p>No terms found matching filters.</p>
                            </div>
                        )}

                        {/* Visible Keywords Count Badge */}
                        {!loading && visibleTerms.length > 0 && (
                            <div className="absolute top-3 left-3 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-sm border border-gray-200 z-10">
                                <span className="text-xs text-gray-500">Showing:</span>
                                <span className="text-sm font-bold text-indigo-600">{visibleTerms.length.toLocaleString()}</span>
                                <span className="text-xs text-gray-400">/ {totalCount.toLocaleString()} keywords</span>
                            </div>
                        )}

                        <div className="flex flex-wrap justify-center content-center gap-3">
                            {visibleTerms.map((term) => {
                                const bucket = term.bucket || 'unassigned';
                                const style = COLORS[bucket] || COLORS.unassigned;
                                const scaleStyle = getScaleStyle(term);
                                const isSelected = selectedTerms.has(term.term);

                                return (
                                    <div key={term.term} className="group relative">
                                        <button
                                            onClick={() => handleTermClick(term)}
                                            onDoubleClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(term.term)}`, '_blank')}
                                            style={scaleStyle}
                                            className={`
                                                transition-colors duration-75 rounded-full px-3 py-1 leading-none
                                                ${style.bg} ${style.text}
                                                border-2
                                                ${isSelected ? 'border-indigo-600 ring-2 ring-indigo-400 z-10' : style.border}
                                                hover:opacity-80 active:scale-95
                                                focus:outline-none
                                                cursor-pointer select-none
                                            `}
                                            title="Double-click to Google search"
                                        >
                                            {term.term}
                                            {term.confidence > 0.8 && bucket !== 'unassigned' && <span className="ml-0.5 text-[0.6em] opacity-60">✓</span>}
                                        </button>

                                        {/* Show BOTH volume and frequency badges */}
                                        {/* Volume badge (top-right) - always show for full keywords with volume */}
                                        {(term as any).searchVolume > 0 && (
                                            <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[8px] px-1 rounded-full font-bold shadow-sm" title={`Search Volume: ${(term as any).searchVolume.toLocaleString()}`}>
                                                {(term as any).searchVolume >= 1000
                                                    ? `${((term as any).searchVolume / 1000).toFixed(1)}k`
                                                    : (term as any).searchVolume}
                                            </span>
                                        )}
                                        {/* Frequency badge (top-left) - only if freq > 1 */}
                                        {term.freq > 1 && (
                                            <span className="absolute -top-1 -left-1 bg-gray-500 text-white text-[8px] px-1 rounded-full font-bold shadow-sm" title={`Frequency: ${term.freq}x`}>
                                                {term.freq}x
                                            </span>
                                        )}

                                        {/* Hover Tooltip - well formatted with all info */}
                                        <div className="invisible group-hover:visible absolute top-full left-1/2 -translate-x-1/2 mt-1 w-80 bg-gray-900 text-white text-xs rounded-lg p-3 z-50 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                            {/* Header with keyword and stats */}
                                            <div className="font-bold text-sm mb-2 text-white border-b border-gray-700 pb-2">
                                                {term.term}
                                            </div>

                                            {/* Stats row */}
                                            <div className="flex gap-4 mb-2 text-[11px]">
                                                <div>
                                                    <span className="text-gray-400">Frequency:</span>
                                                    <span className="ml-1 text-green-400 font-bold">{term.freq}x</span>
                                                </div>
                                                {(term as any).searchVolume > 0 && (
                                                    <div>
                                                        <span className="text-gray-400">Volume:</span>
                                                        <span className="ml-1 text-blue-400 font-bold">{(term as any).searchVolume.toLocaleString()}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Domain + Position info */}
                                            {(term as any).domainPositions && (term as any).domainPositions.length > 0 && (
                                                <div className="border-t border-gray-700 pt-2">
                                                    <div className="text-gray-400 text-[10px] uppercase mb-1">Ranking Domains ({(term as any).domainPositions.length})</div>
                                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                                        {(() => {
                                                            // Sort domains by position
                                                            const positions = (term as any).domainPositions as { domain: string; position: number }[];
                                                            const clientDomain = domain.toLowerCase().replace(/^www\./, '');
                                                            const sorted = [...positions].sort((a, b) => {
                                                                const aIsClient = a.domain.toLowerCase().replace(/^www\./, '').includes(clientDomain) || clientDomain.includes(a.domain.toLowerCase().replace(/^www\./, ''));
                                                                const bIsClient = b.domain.toLowerCase().replace(/^www\./, '').includes(clientDomain) || clientDomain.includes(b.domain.toLowerCase().replace(/^www\./, ''));
                                                                if (aIsClient && !bIsClient) return -1;
                                                                if (!aIsClient && bIsClient) return 1;
                                                                return a.position - b.position;
                                                            });
                                                            return sorted.map((dp, i) => {
                                                                const isClient = dp.domain.toLowerCase().replace(/^www\./, '').includes(clientDomain) || clientDomain.includes(dp.domain.toLowerCase().replace(/^www\./, ''));
                                                                const domainUrl = `https://${dp.domain}`;
                                                                return (
                                                                    <div key={i} className="flex justify-between items-center py-0.5">
                                                                        <a
                                                                            href={domainUrl}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className={`truncate max-w-[200px] hover:underline cursor-pointer ${isClient ? 'text-green-400 font-bold' : 'text-blue-300 hover:text-blue-200'}`}
                                                                        >
                                                                            {isClient && '★ '}{dp.domain}
                                                                        </a>
                                                                        <span className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${isClient ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-yellow-300'}`}>
                                                                            #{dp.position}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            });
                                                        })()}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Tip */}
                                            <div className="text-[9px] text-gray-500 mt-2 pt-1 border-t border-gray-800">
                                                Double-click to search on Google
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Controls / Buckets (Right Rail) */}
                    <div className="w-80 bg-white border-l p-4 flex flex-col gap-3 overflow-y-auto overflow-x-visible shrink-0 shadow-lg z-10">
                        <div className="mb-2">
                            <h3 className="font-bold text-gray-800">Assign Buckets</h3>
                            <p className="text-xs text-gray-500">Select terms on the left, then click (+) to assign.</p>
                        </div>

                        {(['include', 'review', 'brand', 'exclude'] as const).map(bucket => {
                            // Use ALL terms (not filtered by ngram) for bucket counts
                            const count = terms.filter(t => t.bucket === bucket).length;
                            return (
                                <div
                                    key={bucket}
                                    className={`relative p-3 rounded-xl border border-gray-200 bg-gray-50 flex flex-col gap-2 transition-all`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <span className={`font-bold flex items-center gap-2 ${COLORS[bucket].text}`}>
                                                <span className={`w-2 h-2 rounded-full ${COLORS[bucket].bg.replace('bg-', 'bg-')}`}></span>
                                                {BUCKET_DISPLAY_NAMES[bucket]}
                                            </span>
                                            {/* NEW: Auto-Tag Button for Brand Bucket */}
                                            {bucket === 'brand' && (
                                                <button
                                                    onClick={handleAutoTagBrands}
                                                    className="ml-2 text-[10px] bg-purple-50 text-purple-600 border border-purple-200 px-2 py-0.5 rounded hover:bg-purple-100 flex items-center gap-1 transition-colors"
                                                    title="⚠️ Warning: This will overwrite manual changes! Automatically detects and tags brand keywords."
                                                >
                                                    <span>⚡ Auto-Tag</span>
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setActiveBucketTooltip(activeBucketTooltip === bucket ? null : bucket)}
                                                className={`text-xs transition-colors ${activeBucketTooltip === bucket ? 'text-indigo-600' : 'text-gray-400 hover:text-indigo-600'}`}
                                            >
                                                ℹ️
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {count > 0 && (
                                                <button
                                                    onClick={() => {
                                                        // Empty this bucket - return all terms to unassigned
                                                        setTerms(prev => prev.map(t =>
                                                            t.bucket === bucket
                                                                ? { ...t, bucket: undefined, isPending: false } as UiTermEntry
                                                                : t
                                                        ));
                                                        setHasUnsavedChanges(true);
                                                    }}
                                                    className="text-[10px] px-1.5 py-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    title={`Clear all ${count} terms from ${BUCKET_DISPLAY_NAMES[bucket]} bucket`}
                                                >
                                                    Clear All
                                                </button>
                                            )}
                                            <span className="bg-white border text-gray-600 px-2 py-0.5 rounded-full text-xs font-mono font-bold">
                                                {count}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Bucket terms with remove buttons */}
                                    <div className="max-h-36 overflow-y-auto rounded bg-white border border-gray-100 p-1.5">
                                        <div className="flex flex-wrap gap-1">
                                            {/* Show ALL terms in this bucket (not filtered by ngram) */}
                                            {terms.filter(t => t.bucket === bucket).map(t => (
                                                <span
                                                    key={t.term}
                                                    className={`group inline-flex items-center gap-0.5 text-[9px] ${COLORS[bucket].bg} ${COLORS[bucket].text} px-1.5 py-0.5 rounded border ${COLORS[bucket].border}`}
                                                >
                                                    {t.term}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); removeFromBucket(t.term); }}
                                                        className="opacity-0 group-hover:opacity-100 ml-0.5 text-gray-500 hover:text-red-600 transition-opacity"
                                                        title="Remove from bucket"
                                                    >
                                                        ✕
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    <button
                                        onClick={() => assignSelectedTerms(bucket)}
                                        disabled={selectedTerms.size === 0}
                                        className={`
                                            flex items-center justify-center gap-2 w-full py-2 rounded-lg font-bold text-sm transition-all
                                            ${selectedTerms.size > 0
                                                ? 'bg-white border-2 border-indigo-600 text-indigo-700 hover:bg-indigo-50 shadow-sm active:scale-95'
                                                : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-transparent'
                                            }
                                        `}
                                    >
                                        {selectedTerms.size > 0 ? (
                                            <>
                                                <span>Assign {selectedTerms.size}</span>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                            </>
                                        ) : (
                                            <span className="opacity-50">Select terms to assign</span>
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                </div>
            </div >

            {/* Bucket Tooltip Popup Modal */}
            {activeBucketTooltip && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center"
                    onClick={() => setActiveBucketTooltip(null)}
                >
                    {/* Backdrop - slight dim */}
                    <div className="absolute inset-0 bg-black/20" />

                    {/* Popup Content */}
                    <div
                        className="relative bg-gray-900 text-white rounded-xl shadow-2xl p-5 max-w-md mx-4 animate-in zoom-in-95 duration-150"
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setActiveBucketTooltip(null)}
                            className="absolute top-2 right-2 text-gray-400 hover:text-white transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <div className="flex items-center gap-2 mb-3">
                            <span className={`w-3 h-3 rounded-full ${COLORS[activeBucketTooltip as keyof typeof COLORS]?.bg || 'bg-gray-400'}`}></span>
                            <h3 className={`font-bold text-lg ${activeBucketTooltip === 'include' ? 'text-green-400' :
                                activeBucketTooltip === 'review' ? 'text-blue-400' :
                                    activeBucketTooltip === 'brand' ? 'text-purple-400' :
                                        'text-red-400'
                                }`}>
                                {BUCKET_DISPLAY_NAMES[activeBucketTooltip]}
                            </h3>
                        </div>

                        <p className="text-gray-200 text-sm leading-relaxed">
                            {BUCKET_TOOLTIPS[activeBucketTooltip]}
                        </p>

                        <div className="mt-4 pt-3 border-t border-gray-700 text-xs text-gray-400">
                            Click anywhere to close
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}

