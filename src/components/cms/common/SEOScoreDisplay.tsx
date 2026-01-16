'use client';

import React from 'react';
import { SEOScoreResult } from '@/lib/cms/seo/seoScore';

interface SEOScoreDisplayProps {
    result: SEOScoreResult;
}

const gradeColors = {
    A: 'bg-green-500',
    B: 'bg-green-400',
    C: 'bg-yellow-500',
    D: 'bg-orange-500',
    F: 'bg-red-500',
};

const gradeTextColors = {
    A: 'text-green-700',
    B: 'text-green-600',
    C: 'text-yellow-700',
    D: 'text-orange-700',
    F: 'text-red-700',
};

export default function SEOScoreDisplay({ result }: SEOScoreDisplayProps) {
    return (
        <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">SEO Score</h3>
                <div className="flex items-center gap-3">
                    {/* Score Circle */}
                    <div className="relative w-16 h-16">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle
                                cx="32"
                                cy="32"
                                r="28"
                                fill="none"
                                stroke="#e5e7eb"
                                strokeWidth="8"
                            />
                            <circle
                                cx="32"
                                cy="32"
                                r="28"
                                fill="none"
                                stroke={result.score >= 80 ? '#22c55e' : result.score >= 60 ? '#eab308' : '#ef4444'}
                                strokeWidth="8"
                                strokeDasharray={`${(result.score / 100) * 175.9} 175.9`}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-lg font-bold">{result.score}</span>
                        </div>
                    </div>
                    {/* Grade Badge */}
                    <div className={`w-10 h-10 rounded-lg ${gradeColors[result.grade]} flex items-center justify-center`}>
                        <span className="text-xl font-bold text-white">{result.grade}</span>
                    </div>
                </div>
            </div>

            {/* Checks Summary */}
            <div className="space-y-2 mb-4">
                {result.checks.map((check, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                            <span>{check.passed ? '✅' : '❌'}</span>
                            <span className={check.passed ? 'text-gray-700' : 'text-gray-500'}>
                                {check.name}
                            </span>
                        </div>
                        <span className="text-gray-400 text-xs">
                            {check.score}/{check.maxScore}
                        </span>
                    </div>
                ))}
            </div>

            {/* Suggestions */}
            {result.suggestions.length > 0 && (
                <div className="border-t pt-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">💡 Suggestions</h4>
                    <ul className="space-y-1">
                        {result.suggestions.map((suggestion, index) => (
                            <li key={index} className="text-xs text-gray-600 flex items-start gap-2">
                                <span className="text-yellow-500">→</span>
                                {suggestion}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
