import React, { useState, useEffect } from 'react';
import { ClientAIProfile, MatchingDictionary, TokenEntry, DictionaryScope } from '@/types';
import { migrateLegacyDictionary, makeEntry, upsertToken } from '@/lib/dictionaryService';

interface Props {
    clientCode: string; // explicitly passed for API calls
    profile: ClientAIProfile;
    onProfileUpdated: (p: ClientAIProfile) => void;
}

export default function MatchingDictionaryEditor({ clientCode, profile, onProfileUpdated }: Props) {
    const [isEditing, setIsEditing] = useState(false);
    const [localDict, setLocalDict] = useState<MatchingDictionary | undefined>(undefined);
    const [isSaving, setIsSaving] = useState(false);
    const [expandModalOpen, setExpandModalOpen] = useState(false);

    // Sync and Migrate
    useEffect(() => {
        if (profile.matchingDictionary) {
            // Ensure we work with the latest schema structure
            setLocalDict(migrateLegacyDictionary(profile.matchingDictionary));
        }
    }, [profile]);

    if (!localDict) {
        return (
            <div className="bg-red-50 text-red-700 p-3 rounded border border-red-200 text-sm flex items-center gap-2">
                <span>⚠️</span>
                <span>Dictionary loading...</span>
            </div>
        );
    }

    // --- ACTIONS ---

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updatedProfile = { ...profile, matchingDictionary: localDict };

            await fetch('/api/client-ai-profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedProfile)
            });

            onProfileUpdated(updatedProfile);
            setIsEditing(false);
        } catch (e) {
            alert('Failed to save dictionary');
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const updateTokenList = (bucket: keyof MatchingDictionary, newTokens: TokenEntry[]) => {
        if (!localDict) return;
        setLocalDict(prev => {
            if (!prev) return prev;
            return { ...prev, [bucket]: newTokens };
        });
    };

    const updateProductMap = (token: string, lines: string[]) => {
        if (!localDict) return;
        setLocalDict(prev => {
            if (!prev) return prev;
            const nextMap = { ...prev.productLineMap };
            if (lines.length === 0) {
                delete nextMap[token]; // Remove mapping if empty
            } else {
                nextMap[token] = lines;
            }
            return { ...prev, productLineMap: nextMap };
        });
    };

    const downloadPdf = () => {
        window.open(`/api/client-ai-profile/pdf?clientCode=${clientCode}`, '_blank');
    };

    // Helper to derive "Product Line -> Tokens" for display
    const getProductLinesDisplay = () => {
        const display: Record<string, string[]> = {};
        Object.entries(localDict.productLineMap).forEach(([token, lines]) => {
            lines.forEach(line => {
                if (!display[line]) display[line] = [];
                display[line].push(token);
            });
        });
        return display;
    };
    const productDisplay = getProductLinesDisplay();

    return (
        <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200 mt-4">
            <div className="flex items-center justify-between mb-4">
                <h5 className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
                    <span>🔑</span> Master Dictionary
                </h5>
                <div className="flex items-center gap-2">
                    <button onClick={downloadPdf} className="text-xs bg-white border border-gray-300 text-gray-700 px-2 py-1 rounded hover:bg-gray-50 flex items-center gap-1">
                        <span>📄</span> PDF
                    </button>
                    <div className="relative group">
                        <button onClick={() => setExpandModalOpen(true)} className="text-xs bg-purple-100 border border-purple-200 text-purple-700 px-2 py-1 rounded hover:bg-purple-200 flex items-center gap-1">
                            <span>✨</span> AI Expand
                        </button>
                        {/* Tooltip for AI Expand */}
                    </div>
                    {isEditing ? (
                        <>
                            <button onClick={() => setIsEditing(false)} className="text-xs text-gray-600 hover:text-gray-800 px-2">Cancel</button>
                            <button onClick={handleSave} disabled={isSaving} className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </>
                    ) : (
                        <button onClick={() => setIsEditing(true)} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700">
                            Edit Tokens
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                {/* Row 1: Brand & Negative */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TokenSection
                        title="Brand Tokens (Override)"
                        tokens={localDict.brandTokens}
                        isEditing={isEditing}
                        onChange={(t) => updateTokenList('brandTokens', t)}
                        color="indigo"
                    />
                    <TokenSection
                        title="Negative Tokens (Blockers)"
                        tokens={localDict.negativeTokens}
                        isEditing={isEditing}
                        onChange={(t) => updateTokenList('negativeTokens', t)}
                        color="red"
                    />
                </div>

                {/* Row 2: Positive & Products */}
                <div className="bg-white p-3 rounded border border-indigo-100">
                    <div className="font-medium text-xs text-gray-500 uppercase mb-2">Positive Tokens & Product Lines</div>
                    <div className="mb-4">
                        <div className="text-xs text-gray-600 mb-1">
                            All Positive Tokens (Core, Adjacent, Product) - <b>{localDict.positiveTokens.length}</b> total
                        </div>
                        {/* Just list all positives? Too many? No, usually < 200. */}
                        <TokenList
                            tokens={localDict.positiveTokens}
                            isEditing={isEditing}
                            onChange={(t) => updateTokenList('positiveTokens', t)}
                            color="green"
                        />
                    </div>

                    {/* Product Mapping View */}
                    <div className="border-t pt-3">
                        <div className="text-xs font-semibold text-gray-700 mb-2">Product Line Mapping (Derived)</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {Object.entries(productDisplay).map(([line, tokens]) => (
                                <div key={line} className="bg-blue-50/50 p-2 rounded">
                                    <div className="text-xs font-semibold text-blue-800 mb-1">{line}</div>
                                    <div className="flex flex-wrap gap-1">
                                        {tokens.map(t => <span key={t} className="text-[10px] px-1 bg-white border border-blue-100 rounded text-blue-600">{t}</span>)}
                                    </div>
                                </div>
                            ))}
                            {Object.keys(productDisplay).length === 0 && <div className="text-xs text-gray-400 italic">No product lines mapped yet.</div>}
                        </div>
                    </div>
                </div>

                {/* Row 3: Ambiguous & Anchors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TokenSection
                        title="Ambiguous Tokens (Need Anchor)"
                        tokens={localDict.ambiguousTokens}
                        isEditing={isEditing}
                        onChange={(t) => updateTokenList('ambiguousTokens', t)}
                        color="yellow"
                    />
                    <TokenSection
                        title="Anchor Tokens (Context Validators)"
                        tokens={localDict.anchorTokens}
                        isEditing={isEditing}
                        onChange={(t) => updateTokenList('anchorTokens', t)}
                        color="purple"
                    />
                </div>

                {/* Ignored */}
                <div className="bg-gray-50 p-3 rounded border border-gray-100">
                    <div className="text-xs text-gray-500 font-medium mb-1">Ignored / Stop Tokens</div>
                    <TokenList
                        tokens={localDict.ignoreTokens}
                        isEditing={isEditing}
                        onChange={(t) => updateTokenList('ignoreTokens', t)}
                        color="gray"
                    />
                </div>
            </div>

            {expandModalOpen && (
                <AIExpandModal clientCode={clientCode} onClose={() => setExpandModalOpen(false)} onApplied={() => {
                    window.location.reload();
                }} />
            )}
        </div>
    );
}

// Sub-components

function TokenSection({ title, tokens, isEditing, onChange, color }: { title: string, tokens: TokenEntry[], isEditing: boolean, onChange: (t: TokenEntry[]) => void, color: string }) {
    return (
        <div className="bg-white p-3 rounded border border-indigo-100 h-full">
            <div className="font-medium text-xs text-gray-500 uppercase mb-2">{title}</div>
            <TokenList tokens={tokens} isEditing={isEditing} onChange={onChange} color={color} />
        </div>
    );
}

function TokenList({ tokens, isEditing, onChange, color }: { tokens: TokenEntry[], isEditing: boolean, onChange: (t: TokenEntry[]) => void, color: string }) {
    const [addText, setAddText] = useState('');
    const [isBulkOpen, setIsBulkOpen] = useState(false);
    const [bulkText, setBulkText] = useState('');

    const validTokens = Array.isArray(tokens) ? tokens : [];

    const remove = (tokenStr: string) => {
        const next = validTokens.filter(t => t.token !== tokenStr);
        onChange(next);
    };

    const add = () => {
        if (!addText.trim()) return;
        const raw = addText.split(/,|\n/);
        const clean = raw.map(s => s.trim().toLowerCase()).filter(Boolean);
        const next = [...validTokens];
        clean.forEach(c => {
            if (!next.find(t => t.token === c)) {
                next.push(makeEntry(c, 'CLIENT'));
            }
        });
        onChange(next);
        setAddText('');
    };

    const saveBulk = () => {
        const raw = bulkText.split(/,|\n/);
        const clean = raw.map(s => s.trim().toLowerCase()).filter(Boolean);
        const next = [...validTokens];
        clean.forEach(c => {
            if (!next.find(t => t.token === c)) {
                next.push(makeEntry(c, 'CLIENT'));
            }
        });
        onChange(next);
        setIsBulkOpen(false);
        setBulkText('');
    };

    const getColorClass = (tok: TokenEntry) => {
        // We could style based on Scope too?
        return `bg-${color}-50 text-${color}-700 border-${color}-100`;
    };

    if (isEditing) {
        return (
            <div>
                <div className="flex flex-wrap gap-1 mb-2">
                    {validTokens.map((t, i) => (
                        <span key={t.token} className={`text-xs px-2 py-0.5 rounded border flex items-center gap-1 ${getColorClass(t)}`}>
                            {t.token}
                            {/* Scope Indicator */}
                            {t.scope === 'GLOBAL' && <span className="text-[9px] text-gray-400">G</span>}
                            <button onClick={() => remove(t.token)} className="hover:text-red-600 font-bold ml-1">×</button>
                        </span>
                    ))}
                </div>
                <div className="flex gap-1 mb-1">
                    <input
                        type="text"
                        value={addText}
                        onChange={e => setAddText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && add()}
                        placeholder="Add token..."
                        className="text-xs border rounded px-2 py-1 flex-1"
                    />
                    <button onClick={add} className="bg-gray-100 border px-2 text-xs rounded hover:bg-gray-200">+</button>
                </div>
                <div>
                    <button onClick={() => setIsBulkOpen(true)} className="text-[10px] text-blue-600 hover:underline">
                        + Bulk Add (Textarea)
                    </button>
                </div>

                {isBulkOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                        <div className="bg-white p-4 rounded-lg w-96 shadow-xl">
                            <h4 className="font-bold text-sm mb-2">Bulk Add Tokens</h4>
                            <p className="text-xs text-gray-500 mb-2">Paste comma or newline separated tokens.</p>
                            <textarea
                                className="w-full border rounded p-2 text-xs h-32"
                                value={bulkText}
                                onChange={e => setBulkText(e.target.value)}
                            />
                            <div className="flex justify-end gap-2 mt-2">
                                <button onClick={() => setIsBulkOpen(false)} className="px-3 py-1 text-xs text-gray-600">Cancel</button>
                                <button onClick={saveBulk} className="px-3 py-1 text-xs bg-blue-600 text-white rounded">Add Tokens</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-wrap gap-1">
            {validTokens.map((t, i) => (
                <span key={t.token} className={`text-xs px-2 py-0.5 rounded border ${getColorClass(t)}`}>
                    {t.token}
                </span>
            ))}
            {validTokens.length === 0 && <span className="text-xs text-gray-400 italic">None</span>}
        </div>
    );
}

function AIExpandModal({ clientCode, onClose, onApplied }: any) {
    // Placeholder for now, reusing previous logic but adapting for new schema
    // Since Phase 3 is Harvesting, we might revisit this later.
    // For now, keep it simple/disabled or basic legacy mode.
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded p-6">
                <h3>AI Expansion temporarily unavailable during Master Dictionary migration.</h3>
                <button onClick={onClose} className="mt-4 bg-gray-200 px-4 py-2 rounded">Close</button>
            </div>
        </div>
    )
}
