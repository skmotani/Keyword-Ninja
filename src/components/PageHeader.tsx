'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import HelpInfoIcon, { FieldHelpInfo } from './HelpInfoIcon';
import PageComments from './PageComments';

interface PageHeaderProps {
  title: string;
  description?: string;
  helpInfo?: FieldHelpInfo;
  extendedDescription?: string;
}

export default function PageHeader({ title, description, helpInfo, extendedDescription }: PageHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const pathname = usePathname();

  const [userDescription, setUserDescription] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPageConfig();
  }, [pathname]);

  async function fetchPageConfig() {
    try {
      const res = await fetch(`/api/page-config?path=${encodeURIComponent(pathname)}`);
      if (res.ok) {
        const data = await res.json();
        setUserDescription(data.userDescription || '');
      }
    } catch (error) {
      console.error('Failed to fetch page config:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveUserDescription() {
    setIsSaving(true);
    try {
      await fetch('/api/page-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: pathname,
          userDescription: userDescription
        }),
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save page config:', error);
      alert('Failed to save definition');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        {helpInfo && <HelpInfoIcon helpInfo={helpInfo} className="w-5 h-5 text-xs" />}
      </div>

      {description && (
        <p className="text-gray-600 mb-2">{description}</p>
      )}

      {(extendedDescription || userDescription || isEditing) && (
        <div className="mt-2">
          {/* ... existing detailed description logic ... */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors focus:outline-none"
          >
            <span className={`transform transition-transform duration-200 mr-1 ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
            About this page {userDescription && <span className="ml-2 text-xs text-green-600 bg-green-50 px-1 rounded border border-green-200">Customized</span>}
          </button>

          {isExpanded && (
            <div className="mt-2 text-sm text-gray-700 leading-relaxed animate-in fade-in slide-in-from-top-2 duration-200 space-y-4">

              {/* User Definition Section */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-yellow-800 flex items-center gap-1">
                    <span>📝</span> Your Definition / Notes
                  </h4>
                  {!isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      className="w-full p-2 border border-yellow-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      rows={4}
                      placeholder="Add your own definition, business context, or notes for this page..."
                      value={userDescription}
                      onChange={(e) => setUserDescription(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          fetchPageConfig(); // Revert
                        }}
                        className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                        disabled={isSaving}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveUserDescription}
                        className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                        disabled={isSaving}
                      >
                        {isSaving ? 'Saving...' : 'Save Notes'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {userDescription ? (
                      <div className="whitespace-pre-wrap text-gray-800">{userDescription}</div>
                    ) : (
                      <p className="text-gray-500 italic text-xs">
                        You can add your own custom definition or notes here to supplement the system description.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* System Description Section */}
              {extendedDescription && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                  <h4 className="font-semibold text-indigo-900 mb-2 flex items-center gap-1">
                    <span>ℹ️</span> System Description
                  </h4>
                  <div className="whitespace-pre-wrap">{extendedDescription}</div>
                </div>
              )}

            </div>
          )}
        </div>
      )}

      {/* Page Comments Section */}
      <PageComments pagePath={pathname} />

    </div>
  );
}
