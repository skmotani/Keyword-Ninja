'use client';

import React, { useState } from 'react';

interface AIPromptPanelProps {
    templateType: 'blog' | 'ecommerce';
    topic: string;
    primaryKeyword: string;
    keywords: string[];
    searchVolume: number;
    intentType: string;
    clientInfo: {
        name: string;
        industry: string;
    };
    onGenerated: (data: GeneratedContent) => void;
    disabled?: boolean;
}

interface GeneratedContent {
    hero: {
        title: string;
        subtitle: string;
    };
    body: string;
    faqs: Array<{ question: string; answer: string }>;
    meta: {
        title: string;
        description: string;
        keywords: string;
    };
}

export default function AIPromptPanel({
    templateType,
    topic,
    primaryKeyword,
    keywords,
    searchVolume,
    intentType,
    clientInfo,
    onGenerated,
    disabled = false,
}: AIPromptPanelProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [customInstructions, setCustomInstructions] = useState('');

    async function handleGenerate() {
        if (!topic || !primaryKeyword) {
            setError('Please enter a topic and primary keyword');
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            const response = await fetch('/api/cms/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: templateType,
                    action: 'generate',
                    topic,
                    primaryKeyword,
                    keywords,
                    searchVolume,
                    intentType,
                    clientInfo,
                    customInstructions: customInstructions || undefined,
                }),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Generation failed');
            }

            onGenerated(result.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Generation failed');
        } finally {
            setIsGenerating(false);
        }
    }

    const canGenerate = topic && primaryKeyword && !disabled && !isGenerating;

    return (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border border-purple-200 p-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">🤖</span>
                    <h3 className="font-semibold text-gray-900">AI Content Generator</h3>
                </div>
                <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                    {templateType === 'blog' ? '📝 Blog' : '🛒 E-commerce'}
                </span>
            </div>

            {/* Topic Info Display */}
            <div className="bg-white rounded-md p-3 mb-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <span className="text-gray-500">Topic:</span>
                        <span className="ml-2 font-medium">{topic || '—'}</span>
                    </div>
                    <div>
                        <span className="text-gray-500">Keyword:</span>
                        <span className="ml-2 font-medium">{primaryKeyword || '—'}</span>
                    </div>
                    <div>
                        <span className="text-gray-500">Volume:</span>
                        <span className="ml-2 font-medium">{searchVolume?.toLocaleString() || '—'}</span>
                    </div>
                    <div>
                        <span className="text-gray-500">Intent:</span>
                        <span className="ml-2 font-medium capitalize">{intentType || '—'}</span>
                    </div>
                </div>
            </div>

            {/* Advanced Options Toggle */}
            <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-purple-600 hover:text-purple-800 mb-3 flex items-center gap-1"
            >
                <span>{showAdvanced ? '▼' : '▶'}</span>
                Advanced Options
            </button>

            {showAdvanced && (
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Custom Instructions (optional)
                    </label>
                    <textarea
                        value={customInstructions}
                        onChange={(e) => setCustomInstructions(e.target.value)}
                        placeholder="E.g., Focus on beginners, Include pricing information, Use casual tone..."
                        rows={3}
                        className="w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* Generate Button */}
            <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className={`w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${canGenerate
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-md hover:shadow-lg'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
            >
                {isGenerating ? (
                    <>
                        <span className="animate-spin">⏳</span>
                        Generating Content...
                    </>
                ) : (
                    <>
                        <span>✨</span>
                        Generate Full Page Content
                    </>
                )}
            </button>

            {/* Helper text */}
            <p className="mt-3 text-xs text-gray-500 text-center">
                AI will generate hero, body content, FAQs, and meta data based on the topic.
                You can edit everything after generation.
            </p>
        </div>
    );
}
