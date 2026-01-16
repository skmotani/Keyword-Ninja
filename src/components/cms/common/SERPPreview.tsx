'use client';

import React from 'react';

interface SERPPreviewProps {
    title: string;
    url: string;
    description: string;
    favicon?: string;
}

export default function SERPPreview({
    title,
    url,
    description,
    favicon,
}: SERPPreviewProps) {
    // Truncate title to ~60 chars
    const displayTitle = title.length > 60
        ? title.slice(0, 57) + '...'
        : title || 'Page Title';

    // Truncate description to ~160 chars
    const displayDesc = description.length > 160
        ? description.slice(0, 157) + '...'
        : description || 'Add a meta description to see how your page will appear in search results.';

    // Format URL for display
    const displayUrl = url || 'example.com/your-page';

    return (
        <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">🔍</span>
                <span className="text-sm font-medium text-gray-700">Google SERP Preview</span>
            </div>

            {/* Google-style result card */}
            <div className="bg-gray-50 rounded-lg p-4 border">
                {/* Favicon and URL */}
                <div className="flex items-center gap-2 mb-1">
                    {favicon ? (
                        <img src={favicon} alt="" className="w-4 h-4 rounded" />
                    ) : (
                        <div className="w-4 h-4 rounded bg-gray-300 flex items-center justify-center">
                            <span className="text-[8px] text-gray-500">🌐</span>
                        </div>
                    )}
                    <div className="text-xs text-gray-600 flex flex-col">
                        <span className="text-[11px] text-gray-700">{displayUrl.split('/')[0] || 'example.com'}</span>
                        <span className="text-[11px] text-gray-500 truncate max-w-[400px]">
                            {displayUrl}
                        </span>
                    </div>
                </div>

                {/* Title */}
                <h3 className="text-lg text-[#1a0dab] hover:underline cursor-pointer mb-1 font-normal leading-snug">
                    {displayTitle}
                </h3>

                {/* Description */}
                <p className="text-sm text-gray-600 leading-relaxed">
                    {displayDesc}
                </p>
            </div>

            {/* Character counts */}
            <div className="mt-3 flex gap-4 text-xs text-gray-500">
                <div className={title.length > 60 ? 'text-orange-600' : title.length > 50 ? 'text-green-600' : ''}>
                    Title: {title.length}/60 chars
                    {title.length > 60 && ' ⚠️ Too long'}
                    {title.length === 0 && ' ⚠️ Missing'}
                </div>
                <div className={description.length > 160 ? 'text-orange-600' : description.length > 120 ? 'text-green-600' : ''}>
                    Description: {description.length}/160 chars
                    {description.length > 160 && ' ⚠️ Too long'}
                    {description.length === 0 && ' ⚠️ Missing'}
                </div>
            </div>
        </div>
    );
}
