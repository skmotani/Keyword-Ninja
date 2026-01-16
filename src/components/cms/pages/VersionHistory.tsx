'use client';

import React from 'react';
import { PageVersion, formatVersionNumber } from '@/lib/cms/publishing/versionManager';

interface VersionHistoryProps {
    versions: PageVersion[];
    currentVersionId?: string;
    onRestore?: (version: PageVersion) => void;
    onCompare?: (version1: PageVersion, version2: PageVersion) => void;
}

export default function VersionHistory({
    versions,
    currentVersionId,
    onRestore,
    onCompare,
}: VersionHistoryProps) {
    if (versions.length === 0) {
        return (
            <div className="bg-white rounded-lg border p-4 text-center">
                <p className="text-gray-500 text-sm">No version history yet</p>
                <p className="text-xs text-gray-400 mt-1">
                    Versions are created when you save changes
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b">
                <h3 className="font-medium text-gray-900">Version History</h3>
                <p className="text-xs text-gray-500">{versions.length} version{versions.length !== 1 ? 's' : ''}</p>
            </div>

            <div className="divide-y max-h-[400px] overflow-y-auto">
                {versions.map((version, index) => {
                    const isLatest = index === 0;
                    const isCurrent = version.id === currentVersionId;
                    const prevVersion = versions[index + 1];

                    return (
                        <div
                            key={version.id}
                            className={`p-4 ${isCurrent ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm font-mono ${isCurrent ? 'text-indigo-600 font-bold' : 'text-gray-600'}`}>
                                        {formatVersionNumber(version.version)}
                                    </span>
                                    {isLatest && (
                                        <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                                            Latest
                                        </span>
                                    )}
                                    {isCurrent && (
                                        <span className="text-xs px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded">
                                            Current
                                        </span>
                                    )}
                                </div>

                                <div className="flex gap-1">
                                    {onRestore && !isLatest && (
                                        <button
                                            onClick={() => onRestore(version)}
                                            className="text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50"
                                        >
                                            Restore
                                        </button>
                                    )}
                                    {onCompare && prevVersion && (
                                        <button
                                            onClick={() => onCompare(prevVersion, version)}
                                            className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"
                                        >
                                            Compare
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="mt-2 text-sm text-gray-600">
                                {version.title}
                            </div>

                            {version.changeNote && (
                                <p className="mt-1 text-xs text-gray-500 italic">
                                    "{version.changeNote}"
                                </p>
                            )}

                            <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                                <span>
                                    {new Date(version.createdAt).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </span>
                                {version.createdByName && (
                                    <span>by {version.createdByName}</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
