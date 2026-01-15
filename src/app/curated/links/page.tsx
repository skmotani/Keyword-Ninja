'use client';

import React from 'react';
import PageHeader from '@/components/PageHeader';
import PageComments from '@/components/PageComments';

export default function CuratedLinksPage() {
    return (
        <div className="p-6 max-w-7xl mx-auto">
            <PageHeader
                title="Curated Links"
                description="Central repository for strategic internal, link-building, and competitor URLs."
            />

            <div className="bg-white p-8 rounded-lg shadow-sm border text-center py-24">
                <div className="text-6xl mb-4">🔗</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Coming Soon</h2>
                <p className="text-gray-500 max-w-md mx-auto">
                    This module will store curated internal, competitor, and reference links with metadata and relationship tracking.
                </p>
                <div className="mt-8 inline-block px-4 py-2 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded text-sm">
                    Phase 2 Implementation
                </div>
            </div>

            <div className="mt-8">
                <PageComments pagePath="/curated/links" />
            </div>
        </div>
    );
}
