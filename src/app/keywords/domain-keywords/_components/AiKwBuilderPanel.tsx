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
    // Callback to refresh profile data after dictionary changes
    onDictionaryChange?: () => void;
}

// Visual constants
const COLORS = {
    include: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200', fill: '#dcfce7' },
    exclude: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200', fill: '#fee2e2' },
    brand: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200', fill: '#f3e8ff' },
    review: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200', fill: '#fef9c3' },
    unassigned: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', fill: '#f9fafb' }
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

export default function AiKwBuilderPanel({ isOpen, onClose, clientCode, domain, industryKey = 'general', rawKeywords = [], onDictionaryChange }: AiKwBuilderPanelProps) {
    // --- State ---
    const [terms, setTerms] = useState<UiTermEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Multi-select state
    const [selectedTerms, setSelectedTerms] = useState<Set<string>>(new Set());

    // Brand names from Competitor Master for auto-tagging
    const [domainBrandNames, setDomainBrandNames] = useState<string[]>([]);

    const [filters, setFilters] = useState({
        ngram: 'unigram' as NgramType | 'full',
        minFreq: 2,
        search: '',
        showUnassignedOnly: false,
        bucketFilter: [] as string[], // Multi-select: include, exclude, brand, review, unassigned
        limit: 150
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
        } catch (e) {
            console.error('Failed to fetch brand names:', e);
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
    useEffect(() => {
        // Force regeneration if hash changed (means different keywords, not just different length)
        if (rawKeywordsHash !== prevRawKeywordsHash && rawKeywords.length > 0) {
            console.log('[AiKwBuilder] rawKeywords changed, regenerating terms');
            console.log('[AiKwBuilder] Old hash:', prevRawKeywordsHash.substring(0, 50));
            console.log('[AiKwBuilder] New hash:', rawKeywordsHash.substring(0, 50));
            setPrevRawKeywordsHash(rawKeywordsHash);
            // Clear and regenerate
            setTerms([]);
            const newTerms: UiTermEntry[] = [];
            const ngramTypes: (NgramType | 'full')[] = ['unigram', 'bigram', 'full'];

            // Log raw keywords count for debugging
            console.log('[AiKwBuilder] Raw keywords received:', rawKeywords.length);
            console.log('[AiKwBuilder] Unique keywords:', new Set(rawKeywords).size);

            ngramTypes.forEach(type => {
                const freqMap = new Map<string, number>();
                const examplesMap = new Map<string, string[]>();

                rawKeywords.forEach(kw => {
                    const normalizedKw = kw.toLowerCase().replace(/[^a-z0-9\s]/g, '');
                    const words = normalizedKw.split(/\s+/).filter(w => w.length > 0);

                    if (type === 'unigram') {
                        words.forEach(w => {
                            if (w.length > 2) {
                                freqMap.set(w, (freqMap.get(w) || 0) + 1);
                                if ((examplesMap.get(w) || []).length < 3) {
                                    const ex = examplesMap.get(w) || [];
                                    if (!ex.includes(kw)) ex.push(kw);
                                    examplesMap.set(w, ex);
                                }
                            }
                        });
                    } else if (type === 'bigram') {
                        for (let i = 0; i < words.length - 1; i++) {
                            const bigram = `${words[i]} ${words[i + 1]}`;
                            if (bigram.length > 4) {
                                freqMap.set(bigram, (freqMap.get(bigram) || 0) + 1);
                                if ((examplesMap.get(bigram) || []).length < 3) {
                                    const ex = examplesMap.get(bigram) || [];
                                    if (!ex.includes(kw)) ex.push(kw);
                                    examplesMap.set(bigram, ex);
                                }
                            }
                        }
                    } else if (type === 'full') {
                        // Include ALL keywords regardless of length
                        freqMap.set(kw, (freqMap.get(kw) || 0) + 1);
                        if (!examplesMap.has(kw)) examplesMap.set(kw, [kw]);
                    }
                });

                const entries: UiTermEntry[] = Array.from(freqMap.entries())
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

                        // Check if term contains any brand name (case-insensitive partial match)
                        const normalizedTerm = term.toLowerCase();
                        const isBrand = brandNamesToCheck.some(b => normalizedTerm.includes(b) && b.length >= 3);
                        const isExclude = COMMON_EXCLUSIONS.has(term.toLowerCase());

                        let bucket: TermBucket | undefined;
                        let source: 'user' | 'ai' | 'system' = 'system';
                        let confidence = 0;

                        if (isBrand) {
                            bucket = 'brand';
                            source = 'ai';
                            confidence = 0.95;
                        } else if (isExclude && type === 'unigram') {
                            bucket = 'exclude';
                            source = 'ai';
                            confidence = 0.90;
                        }

                        return {
                            term,
                            freq,
                            ngramType: (type === 'full' ? 'trigram' : type) as NgramType,
                            source,
                            bucket,
                            confidence,
                            locked: false,
                            examples: examplesMap.get(term) || [],
                            isPending: false,
                            originalType: type
                        };
                    });

                newTerms.push(...entries);
            });

            newTerms.sort((a, b) => b.freq - a.freq);
            setTerms(prev => newTerms);
        }
    }, [rawKeywordsHash, prevRawKeywordsHash, rawKeywords, domain, domainBrandNames]);

    // Apply brand auto-tagging when brand names are loaded (after initial term generation)
    // Also put ALL non-brand terms into exclude bucket by default
    useEffect(() => {
        if (domainBrandNames.length > 0 && terms.length > 0) {
            console.log('[AiKwBuilder] Applying brand tagging with brands:', domainBrandNames);
            let brandCount = 0;
            setTerms(prev => prev.map(t => {
                // Skip if term already has a user-assigned bucket
                if (t.source === 'user') {
                    return t;
                }

                // Check if term contains any brand name (case-insensitive, substring match)
                // Brand names can be part of a larger word - user can manually remove false positives
                const normalizedTerm = t.term.toLowerCase();
                const matchesBrand = domainBrandNames.some(b => {
                    const brandLower = b.toLowerCase();
                    if (brandLower.length < 2) return false;
                    // Substring match - "meera" matches "meeraind" as well
                    return normalizedTerm.includes(brandLower);
                });

                if (matchesBrand) {
                    brandCount++;
                    // Put in Brand bucket
                    return {
                        ...t,
                        bucket: 'brand' as const,
                        source: 'ai' as const,
                        confidence: 0.95,
                        isPending: false
                    };
                }
                // Leave non-brand terms as unassigned - user will manually assign to Include/Exclude
                return t;
            }));
            console.log('[AiKwBuilder] Brand terms found:', brandCount);
        }
    }, [domainBrandNames, terms.length]);
    const mergeTerms = (currentTerms: UiTermEntry[], loadedTerms: TermEntry[]): UiTermEntry[] => {
        const dictMap = new Map(loadedTerms.map(t => [t.term.toLowerCase(), t]));
        return currentTerms.map(t => {
            const loaded = dictMap.get(t.term.toLowerCase());
            if (loaded) {
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
            alert('Dictionary Saved');
            // Refresh main page sidebar
            onDictionaryChange?.();
        } catch (e) {
            alert('Save failed');
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
        return terms
            .filter(t => {
                const type = (t as any).originalType || t.ngramType;
                return type === filters.ngram;
            })
            .filter(t => t.freq >= filters.minFreq)
            .filter(t => !filters.search || t.term.includes(filters.search))
            .filter(t => {
                // Bucket filter (multi-select)
                if (filters.bucketFilter.length === 0) return true;
                const termBucket = t.bucket || 'unassigned';
                return filters.bucketFilter.includes(termBucket);
            })
            .slice(0, filters.limit);
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


    // Calculate scaling
    const maxFreq = visibleTerms.length > 0 ? visibleTerms[0].freq : 1;
    const getScaleStyle = (freq: number) => {
        // Linear scale between 0.85em and 2.5em
        const ratio = freq / maxFreq;
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

                        <div className="flex gap-4 ml-6 text-sm border-l pl-6">
                            <div className="flex flex-col">
                                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Unigram</span>
                                <span className="font-bold text-gray-900 text-base">{filterCounts.unigram}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Bigram</span>
                                <span className="font-bold text-gray-900 text-base">{filterCounts.bigram}</span>
                            </div>
                            <div className="flex flex-col group relative">
                                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                                    Full Keyword
                                    <svg className="w-3 h-3 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </span>
                                <span className="font-bold text-blue-600 text-base">{filterCounts.full}</span>
                                <span className="text-[10px] text-gray-400">Unique Keywords</span>
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
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="px-6 py-3 border-b bg-white flex flex-wrap gap-4 items-center text-sm shadow-sm z-10 shrink-0">
                    <select
                        value={filters.ngram}
                        onChange={e => setFilters({ ...filters, ngram: e.target.value as any })}
                        className="border-gray-300 rounded px-2 py-1 text-sm focus:ring-indigo-500 focus:border-indigo-500 font-medium"
                    >
                        <option value="unigram">Unigram ({filterCounts.unigram})</option>
                        <option value="bigram">Bigram ({filterCounts.bigram})</option>
                        <option value="full">Full Keyword ({filterCounts.full})</option>
                    </select>

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

                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search Cloud..."
                            value={filters.search}
                            onChange={e => setFilters({ ...filters, search: e.target.value })}
                            className="pl-8 pr-3 py-1 border-gray-300 rounded px-3 w-48 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <svg className="w-4 h-4 text-gray-400 absolute left-2 top-1.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
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
                            {(['include', 'exclude', 'brand', 'review', 'unassigned'] as const).map(bucket => {
                                const isSelected = filters.bucketFilter.includes(bucket);
                                const colors: Record<string, string> = {
                                    include: 'bg-green-100 text-green-800 border-green-300',
                                    exclude: 'bg-red-100 text-red-800 border-red-300',
                                    brand: 'bg-purple-100 text-purple-800 border-purple-300',
                                    review: 'bg-yellow-100 text-yellow-800 border-yellow-300',
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
                                        className={`px-2 py-0.5 text-[10px] rounded border capitalize transition-all ${isSelected
                                            ? `${colors[bucket]} ring-2 ring-offset-1 ring-indigo-400`
                                            : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                                            }`}
                                    >
                                        {bucket}
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

                        <div className="flex flex-wrap justify-center content-center gap-3">
                            {visibleTerms.map((term) => {
                                const bucket = term.bucket || 'unassigned';
                                const style = COLORS[bucket] || COLORS.unassigned;
                                const scaleStyle = getScaleStyle(term.freq);
                                const isSelected = selectedTerms.has(term.term);

                                return (
                                    <div key={term.term} className="group relative">
                                        <button
                                            onClick={() => handleTermClick(term)}
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
                                        >
                                            {term.term}
                                            {term.confidence > 0.8 && bucket !== 'unassigned' && <span className="ml-0.5 text-[0.6em] opacity-60">✓</span>}
                                        </button>

                                        {/* Hover Tooltip with Examples */}
                                        <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 z-50 pointer-events-none shadow-xl opacity-0 group-hover:opacity-100 transition-opacity delay-100">
                                            <div className="font-bold flex justify-between mb-1 border-b border-gray-700 pb-1">
                                                <span>{term.term}</span>
                                                <span className="text-gray-400">freq: {term.freq}</span>
                                            </div>
                                            {term.examples && term.examples.length > 0 ? (
                                                <ul className="space-y-1 text-gray-300">
                                                    {term.examples.map((ex, i) => (
                                                        <li key={i} className="truncate">• {ex}</li>
                                                    ))}
                                                </ul>
                                            ) : <span className="text-gray-500 italic">No examples captured</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Controls / Buckets (Right Rail) */}
                    <div className="w-80 bg-white border-l p-4 flex flex-col gap-3 overflow-y-auto shrink-0 shadow-lg z-10">
                        <div className="mb-2">
                            <h3 className="font-bold text-gray-800">Assign Buckets</h3>
                            <p className="text-xs text-gray-500">Select terms on the left, then click (+) to assign.</p>
                        </div>

                        {(['include', 'exclude', 'brand', 'review'] as const).map(bucket => {
                            // Use ALL terms (not filtered by ngram) for bucket counts
                            const count = terms.filter(t => t.bucket === bucket).length;
                            return (
                                <div
                                    key={bucket}
                                    className={`relative p-3 rounded-xl border border-gray-200 bg-gray-50 flex flex-col gap-2 transition-all`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className={`font-bold capitalize flex items-center gap-2 ${COLORS[bucket].text}`}>
                                            <span className={`w-2 h-2 rounded-full ${COLORS[bucket].bg.replace('bg-', 'bg-')}`}></span>
                                            {bucket}
                                        </span>
                                        <span className="bg-white border text-gray-600 px-2 py-0.5 rounded-full text-xs font-mono font-bold">
                                            {count}
                                        </span>
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
            </div>
        </div>
    );
}

