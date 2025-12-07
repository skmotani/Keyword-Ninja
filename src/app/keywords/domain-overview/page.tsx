'use client';

import PageHeader from '@/components/PageHeader';

export default function DomainOverviewPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <PageHeader 
        title="Domain Overview" 
        description="View domain-level SEO metrics and analytics"
      />
      
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="text-gray-400 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-700 mb-2">Coming Soon</h3>
        <p className="text-gray-500">Domain overview features are under development.</p>
      </div>
    </div>
  );
}
