'use client';

import { useState, useEffect, useRef } from 'react';

interface ApiStatus {
    configured: boolean;
    label: string;
}

export default function ApiStatusIndicator() {
    const [apis, setApis] = useState<Record<string, ApiStatus>>({});
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function checkStatus() {
            try {
                const res = await fetch('/api/system/api-status');
                if (res.ok) {
                    const data = await res.json();
                    setApis(data.apis || {});
                }
            } catch (e) {
                console.error('Failed to check API status', e);
            } finally {
                setLoading(false);
            }
        }
        checkStatus();

        // Refresh every 60 seconds
        const interval = setInterval(checkStatus, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const apiList = Object.entries(apis);
    const allConfigured = apiList.every(([_, status]) => status.configured);
    const noneConfigured = apiList.every(([_, status]) => !status.configured);
    const configuredCount = apiList.filter(([_, status]) => status.configured).length;

    if (loading) {
        return (
            <div className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400">
                <div className="w-2 h-2 rounded-full bg-gray-300 animate-pulse"></div>
                <span className="hidden sm:inline">APIs</span>
            </div>
        );
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${allConfigured ? 'text-green-400 hover:bg-slate-800' : noneConfigured ? 'text-red-400 hover:bg-slate-800' : 'text-amber-400 hover:bg-slate-800'
                    }`}
                title="API Connection Status"
            >
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${allConfigured ? 'bg-green-500' : noneConfigured ? 'bg-red-500' : 'bg-amber-500'
                        }`}></div>
                    <span className="text-sm font-medium">
                        APIs {configuredCount}/{apiList.length}
                    </span>
                </div>
                <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute left-0 bottom-full mb-1 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50">
                    <div className="p-2 border-b border-slate-700">
                        <span className="text-xs font-semibold text-slate-400">API Status</span>
                    </div>
                    <div className="p-2 space-y-1">
                        {apiList.map(([key, status]) => (
                            <div key={key} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-slate-700">
                                <span className="text-xs text-slate-300">{status.label}</span>
                                <div className="flex items-center gap-1.5">
                                    <span className={`text-[10px] font-medium ${status.configured ? 'text-green-400' : 'text-red-400'}`}>
                                        {status.configured ? '✓' : '✗'}
                                    </span>
                                    <div className={`w-2 h-2 rounded-full ${status.configured ? 'bg-green-500' : 'bg-red-400'}`}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-2 border-t border-slate-700 space-y-1">
                        <div className="text-[10px] text-slate-500">
                            <span className="font-semibold text-slate-400">📁 Local Storage:</span>
                            <div className="ml-2 mt-0.5">
                                <div>• <code className="text-slate-400">.env.local</code> (env vars)</div>
                                <div>• <code className="text-slate-400">data/api_credentials.json</code></div>
                            </div>
                        </div>
                        <div className="text-[10px] text-slate-500">
                            <span className="font-semibold text-slate-400">☁️ Railway:</span>
                            <div className="ml-2 mt-0.5">
                                <div>• Project → Variables tab</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
