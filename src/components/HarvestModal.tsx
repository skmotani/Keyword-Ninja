import React, { useState, useEffect, useMemo } from 'react';
import { MatchingDictionary } from '@/types';
import { normalizeToken } from '@/lib/dictionaryService';

export interface HarvestProps {
    isOpen: boolean;
    onClose: () => void;
    keywords: string[]; // List of keywords to analyze
    clientCode: string;
    onHarvestComplete: () => void;
    // productLines removed as per generic design requirement
}

interface TermCandidate {
    term: string;
    freq: number;
    type: 'Unigram' | 'Bigram' | 'Trigram';
    selectedBucket: string;
    examples: string[];
}

const STOPWORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'for', 'to', 'of', 'in', 'on', 'at', 'by', 'width', 'length', 'height',
    'with', 'from', 'about', 'near', 'best', 'top', 'vs', 'versus', 'price',
    'cost', 'buy', 'shop', 'online', 'sale', 'new', 'used', 'reviews', 'guide',
    'what', 'how', 'where', 'why', 'when', 'who', 'list', 'images', 'pdf', '2023', '2024', '2025'
]);

// --- Tooltip Content Definitions ---
const TOOLTIPS: Record<string, { desc: string; effect: string; examples: string[] }> = {
    POSITIVE: {
        desc: "Indicates strong relevance to the user’s offering.",
        effect: "Adds positive weight to scoring (Core/Review).",
        examples: ["twisting, winding, automation", "‘twisting machine price’ → helps push toward CORE"]
    },
    ANCHOR: {
        desc: "Provides required context for ambiguous terms.",
        effect: "Enables Ambiguous terms to contribute to CORE.",
        examples: ["machine, machinery, equipment, manufacturer", "‘ring machine’ → Anchor validates ambiguous ‘ring’"]
    },
    AMBIGUOUS: {
        desc: "Too broad to decide intent on its own.",
        effect: "Ignored unless an Anchor is present.",
        examples: ["ring, line, frame, unit", "‘ring’ alone → REVIEW", "‘ring machine’ → can become CORE (with Anchor)"]
    },
    NEGATIVE: { // Soft Neg
        desc: "Weak exclusion signal. Reduces relevance but doesn't block.",
        effect: "Downranks confidence, may force REVIEW.",
        examples: ["cheap, manual, basic", "‘cheap twisting machine’ → likely REVIEW instead of CORE"]
    },
    HARD_NEG: {
        desc: "Strong exclusion signal. Always blocks matching.",
        effect: "Immediately blocks CORE or REVIEW (Force NO MATCH).",
        examples: ["jobs, salary, toy, repair, second hand", "‘ring twister toy’ → NO MATCH"]
    },
    BRAND: {
        desc: "Identifies a brand, company, or proprietary name.",
        effect: "Used for brand intent and filtering.",
        examples: ["meera, saurer, lakshmi machine works", "‘meera twisting machine’ → brand-aware CORE"]
    },
    IGNORE: {
        desc: "Noise or filler term. Ignored completely.",
        effect: "Removed from all calculations.",
        examples: ["best, price, near, list, pdf, 2025", "‘best twisting machine price’ → ‘best’ and ‘price’ ignored"]
    }
};

export default function HarvestModal({ isOpen, onClose, keywords, clientCode, onHarvestComplete }: HarvestProps) {
    const [candidates, setCandidates] = useState<TermCandidate[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [minFreq, setMinFreq] = useState(2);
    const [filterType, setFilterType] = useState<'ALL' | 'Unigram' | 'Bigram' | 'Trigram'>('ALL');

    // Track counts for the header
    const [counts, setCounts] = useState({ unigrams: 0, bigrams: 0, trigrams: 0 });

    useEffect(() => {
        if (isOpen && keywords.length > 0) {
            analyzeKeywords();
        }
    }, [isOpen, keywords, minFreq]);

    const analyzeKeywords = () => {
        setIsProcessing(true);
        // Use setTimeout to allow UI to render the "Analyzing..." state
        setTimeout(() => {
            const termCounts: Record<string, { freq: number, type: 'Unigram' | 'Bigram' | 'Trigram', examples: string[] }> = {};

            keywords.forEach(kw => {
                // Pre-processing
                const norm = kw.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
                if (!norm) return;

                const tokens = norm.split(' ').filter(t => t.length > 1 && !STOPWORDS.has(t));

                // Unigrams
                tokens.forEach(t => {
                    if (!termCounts[t]) termCounts[t] = { freq: 0, type: 'Unigram', examples: [] };
                    termCounts[t].freq++;
                    if (termCounts[t].examples.length < 3) termCounts[t].examples.push(kw);
                });

                // Bigrams
                for (let i = 0; i < tokens.length - 1; i++) {
                    const bigram = `${tokens[i]} ${tokens[i + 1]}`;
                    if (!termCounts[bigram]) termCounts[bigram] = { freq: 0, type: 'Bigram', examples: [] };
                    termCounts[bigram].freq++;
                    if (termCounts[bigram].examples.length < 3) termCounts[bigram].examples.push(kw);
                }

                // Trigrams
                for (let i = 0; i < tokens.length - 2; i++) {
                    const trigram = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
                    if (!termCounts[trigram]) termCounts[trigram] = { freq: 0, type: 'Trigram', examples: [] };
                    termCounts[trigram].freq++;
                    if (termCounts[trigram].examples.length < 3) termCounts[trigram].examples.push(kw);
                }
            });

            const sorted = Object.entries(termCounts)
                .map(([term, data]) => ({
                    term,
                    ...data,
                    selectedBucket: 'SKIP' // Default unassigned
                }))
                .filter(item => item.freq >= minFreq)
                .sort((a, b) => b.freq - a.freq);

            // Calculate stats
            const stats = { unigrams: 0, bigrams: 0, trigrams: 0 };
            sorted.forEach(c => {
                if (c.type === 'Unigram') stats.unigrams++;
                else if (c.type === 'Bigram') stats.bigrams++;
                else if (c.type === 'Trigram') stats.trigrams++;
            });

            setCandidates(sorted);
            setCounts(stats);
            setIsProcessing(false);
        }, 100);
    };

    const filteredCandidates = useMemo(() => {
        if (filterType === 'ALL') return candidates;
        return candidates.filter(c => c.type === filterType);
    }, [candidates, filterType]);

    const handleSave = async () => {
        setIsSaving(true);
        // Only save explicitly tagged or explicitly ignored items. 
        // Per requirement, unassigned ('SKIP') become 'IGNORE'.
        const toSave = filteredCandidates.map(c => ({
            ...c,
            selectedBucket: c.selectedBucket === 'SKIP' ? 'IGNORE' : c.selectedBucket
        }));

        if (toSave.length === 0) {
            onClose();
            return;
        }

        const payload = {
            clientCode,
            terms: toSave.map(c => {
                let bucket = 'ignoreTokens';
                let isHardNegative = false;

                switch (c.selectedBucket) {
                    case 'BRAND': bucket = 'brandTokens'; break;
                    case 'POSITIVE': bucket = 'positiveTokens'; break;
                    case 'NEGATIVE': bucket = 'negativeTokens'; break;
                    case 'HARD_NEG': bucket = 'negativeTokens'; isHardNegative = true; break;
                    case 'AMBIGUOUS': bucket = 'ambiguousTokens'; break;
                    case 'ANCHOR': bucket = 'anchorTokens'; break;
                    case 'IGNORE': bucket = 'ignoreTokens'; break;
                }

                return {
                    token: c.term,
                    bucket,
                    scope: 'DOMAIN',
                    isHardNegative,
                    productLine: undefined // Product lines removed
                };
            })
        };

        try {
            await fetch('/api/dictionary/harvest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            onHarvestComplete();
            onClose();
        } catch (e) {
            console.error(e);
            alert('Error saving harvested terms');
        } finally {
            setIsSaving(false);
        }
    };

    const updateCandidate = (term: string, bucket: string) => {
        setCandidates(prev => prev.map(c => c.term === term ? { ...c, selectedBucket: bucket } : c));
    };


    const Row = ({ index, style }: { index: number, style: React.CSSProperties }) => {
        const c = filteredCandidates[index];
        return (
            <div style={style} className={`flex items-center border-b px-4 hover:bg-gray-50/50 ${c.selectedBucket !== 'SKIP' ? 'bg-indigo-50/30' : ''}`}>

                {/* Term Info */}
                <div className="w-1/4 pr-4 py-2 flex flex-col justify-center">
                    <div className="font-bold text-gray-800 text-sm truncate" title={c.term}>{c.term}</div>
                    <div className="flex gap-2 text-[10px] text-gray-500 mt-0.5" title="Document Frequency">
                        <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{c.type}</span>
                        <span>Freq: {c.freq}</span>
                    </div>
                    <div className="text-[10px] text-gray-400 italic truncate mt-0.5" title={`In: ${c.examples.join(', ')}`}>
                        {c.examples.slice(0, 2).map((ex, i) => (
                            <span key={i} className="mr-1">{ex}{i < c.examples.slice(0, 2).length - 1 && ','}</span>
                        ))}
                    </div>
                </div>

                {/* Bucket Selection - Generic Design - EXACT ORDER: Positive, Anchor, Ambiguous, Soft Neg, Hard Neg, Brand, Ignore */}
                <div className="flex-1 flex flex-wrap gap-2 py-2 items-center">
                    <BucketOption label="Positive" value="POSITIVE" current={c.selectedBucket} onClick={() => updateCandidate(c.term, 'POSITIVE')} color="green" tooltipKey="POSITIVE" />
                    <BucketOption label="Anchor" value="ANCHOR" current={c.selectedBucket} onClick={() => updateCandidate(c.term, 'ANCHOR')} color="teal" tooltipKey="ANCHOR" />
                    <BucketOption label="Ambiguous" value="AMBIGUOUS" current={c.selectedBucket} onClick={() => updateCandidate(c.term, 'AMBIGUOUS')} color="orange" tooltipKey="AMBIGUOUS" />
                    <BucketOption label="Soft Neg" value="NEGATIVE" current={c.selectedBucket} onClick={() => updateCandidate(c.term, 'NEGATIVE')} color="red" tooltipKey="NEGATIVE" />
                    <BucketOption label="Hard Neg" value="HARD_NEG" current={c.selectedBucket} onClick={() => updateCandidate(c.term, 'HARD_NEG')} color="red" tooltipKey="HARD_NEG" />
                    <BucketOption label="Brand" value="BRAND" current={c.selectedBucket} onClick={() => updateCandidate(c.term, 'BRAND')} color="indigo" tooltipKey="BRAND" />
                    <BucketOption label="Ignore" value="IGNORE" current={c.selectedBucket} onClick={() => updateCandidate(c.term, 'IGNORE')} color="gray" tooltipKey="IGNORE" />
                </div>
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-[1000px] h-[85vh] flex flex-col border border-gray-200">

                {/* Header */}
                <div className="p-5 border-b bg-gray-50 rounded-t-xl flex justify-between items-start">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <span>🌾</span> Dictionary Harvesting & Bucketing
                        </h3>
                        {/* Term/Frequency Tooltip Header Explanation */}
                        <div className="group relative inline-block mt-1">
                            <p className="text-sm text-gray-500 cursor-help border-b border-dotted border-gray-400 inline-block">
                                Analyze keywords to extract recurring terms. What do counts mean?
                            </p>
                            <div className="absolute left-0 top-full mt-2 w-80 bg-gray-800 text-white text-xs rounded-lg p-3 z-50 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all delay-100">
                                <p className="font-bold mb-1">Frequency & Counts:</p>
                                <p className="mb-2">“Frequency shows how many keyword rows contain this term at least once (document frequency), not total repetitions.”</p>
                                <p className="font-bold mb-1">Example:</p>
                                <ul className="list-disc pl-4 space-y-1 text-gray-300">
                                    <li>‘twisting machine’</li>
                                    <li>‘twisting machines price’</li>
                                    <li>Term: ‘twisting’ → Frequency = 2</li>
                                </ul>
                            </div>
                        </div>

                        {/* N-gram Stats / Tabs */}
                        <div className="flex gap-2 mt-4 items-center">
                            <FilterTab label="All" count={candidates.length} active={filterType === 'ALL'} onClick={() => setFilterType('ALL')} />

                            <div className="group relative">
                                <FilterTab label="Unigrams" count={counts.unigrams} active={filterType === 'Unigram'} onClick={() => setFilterType('Unigram')} />
                                <NgramTooltip type="Unigrams" example="twisting, machine, price" />
                            </div>

                            <div className="group relative">
                                <FilterTab label="Bigrams" count={counts.bigrams} active={filterType === 'Bigram'} onClick={() => setFilterType('Bigram')} />
                                <NgramTooltip type="Bigrams" example="twisting machine, machine price" />
                            </div>

                            <div className="group relative">
                                <FilterTab label="Trigrams" count={counts.trigrams} active={filterType === 'Trigram'} onClick={() => setFilterType('Trigram')} />
                                <NgramTooltip type="Trigrams" example="twisting machine price" />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                        <div className="flex items-center gap-2 text-xs bg-white p-2 rounded border shadow-sm">
                            <span className="font-semibold text-gray-600">Min Freq:</span>
                            <input
                                type="number"
                                value={minFreq}
                                onChange={e => setMinFreq(Math.max(1, Number(e.target.value)))}
                                className="w-12 border rounded px-1.5 py-0.5 text-center font-mono"
                            />
                        </div>
                    </div>
                </div>

                {/* Content Area (Simple Map for Stability) */}
                <div className="flex-1 bg-white relative">
                    {isProcessing ? (
                        <div className="absolute inset-0 flex items-center justify-center flex-col gap-3">
                            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                            <p className="text-gray-500 font-medium animate-pulse">Analyzing vocabulary...</p>
                        </div>
                    ) : filteredCandidates.length === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                            No terms found with current filters.
                        </div>
                    ) : (
                        <div className="h-[600px] overflow-auto border rounded-xl bg-gray-50/10">
                            {filteredCandidates.slice(0, 100).map((c, index) => (
                                <Row key={index} index={index} style={{}} />
                            ))}
                            {filteredCandidates.length > 100 && (
                                <div className="p-8 text-center text-gray-500 italic">
                                    <p>Showing first 100 of {filteredCandidates.length} terms.</p>
                                    <p className="text-xs mt-1">Refine filters (Min Freq) or use the search (coming soon) to see more.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-between items-center z-10">
                    <div className="text-xs text-gray-500 group relative cursor-help">
                        <p>
                            <strong>Classified:</strong> {filteredCandidates.filter(c => c.selectedBucket !== 'SKIP').length} / {filteredCandidates.length}
                        </p>
                        <p className="text-gray-400 mt-0.5 border-b border-dotted border-gray-300 inline-block">Unassigned terms will be auto-ignored on save. ⓘ</p>

                        {/* Footer Tooltip */}
                        <div className="absolute bottom-full left-0 mb-2 w-64 bg-gray-800 text-white text-xs rounded-lg p-3 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                            “Any term not explicitly bucketed will be saved as Ignore, so you do not need to classify everything manually.”
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-100 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving || isProcessing}
                            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all active:scale-95"
                        >
                            {isSaving ? 'Saving...' : 'Save & Re-Tag'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}

// --- Helper Components ---

const BucketOption = ({ label, value, current, onClick, color, tooltipKey }: any) => {
    const isSelected = current === value;
    const tooltip = TOOLTIPS[tooltipKey];

    const baseColors = {
        indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200',
        green: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200',
        red: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200',
        orange: 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200',
        teal: 'bg-teal-100 text-teal-800 border-teal-200 hover:bg-teal-200',
        gray: 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200',
    };

    const activeColors = {
        indigo: 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-200',
        green: 'bg-green-600 text-white border-green-700 shadow-md ring-2 ring-green-200',
        red: 'bg-red-600 text-white border-red-700 shadow-md ring-2 ring-red-200',
        orange: 'bg-orange-500 text-white border-orange-600 shadow-md ring-2 ring-orange-200',
        teal: 'bg-teal-600 text-white border-teal-700 shadow-md ring-2 ring-teal-200',
        gray: 'bg-gray-600 text-white border-gray-700 shadow-md ring-2 ring-gray-200',
    };

    return (
        <div className="group/tooltip relative">
            <button
                onClick={onClick}
                className={`
                    px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all
                    ${isSelected ? activeColors[color as keyof typeof activeColors] : baseColors[color as keyof typeof baseColors]}
                    ${isSelected ? 'scale-105' : 'scale-100'}
                `}
            >
                {label}
            </button>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900/95 text-white text-xs rounded-lg p-3 shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none backdrop-blur-sm border border-gray-700">
                <p className="font-bold text-indigo-300 mb-1">{label} Bucket</p>
                <p className="mb-2 text-gray-300 leading-relaxed">{tooltip?.desc}</p>

                <div className="mb-2 bg-gray-800 p-1.5 rounded border border-gray-700">
                    <p className="font-semibold text-gray-400 text-[10px] uppercase tracking-wider mb-0.5">Effect</p>
                    <p className="text-gray-200">{tooltip?.effect}</p>
                </div>

                <div className="border-t border-gray-700 pt-2 mt-2">
                    <p className="font-semibold text-gray-400 text-[10px] uppercase tracking-wider mb-1">Examples</p>
                    <ul className="list-disc pl-3 space-y-1 text-gray-300 text-[10px]">
                        {tooltip?.examples.map((ex, i) => <li key={i}>{ex}</li>)}
                    </ul>
                </div>

                {/* Arrow */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900/95"></div>
            </div>
        </div>
    );
};

const FilterTab = ({ label, count, active, onClick }: any) => (
    <button
        onClick={onClick}
        className={`
            px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors flex items-center gap-2
            ${active ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}
        `}
    >
        {label}
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${active ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-500'}`}>
            {count}
        </span>
    </button>
);

const NgramTooltip = ({ type, example }: { type: string, example: string }) => (
    <div className="absolute left-0 top-full mt-2 w-72 bg-gray-800 text-white text-xs rounded-lg p-3 z-50 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all delay-75">
        <p className="font-bold mb-1">{type}:</p>
        <p className="mb-2 text-gray-300">“These counts represent UNIQUE normalized terms or phrases extracted from the selected keywords, after removing stopwords.”</p>
        <div className="bg-gray-700/50 p-2 rounded">
            <span className="text-gray-400 text-[10px] uppercase">Example (from 'twisting machine price'):</span>
            <p className="font-mono text-[10px] mt-1 text-indigo-200">{example}</p>
        </div>
    </div>
);
