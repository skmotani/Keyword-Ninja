'use client';

import { useState, useEffect, useRef } from 'react';

interface DeploymentStatus {
    commit: string;
    commitFull: string;
    branch: string;
    environment: 'railway' | 'local';
    environmentId: string;
    publicDomain: string;
    timestamp: string;
}

type BuildState = 'synced' | 'building' | 'error' | 'checking' | 'local';

export default function RailwayStatusIndicator() {
    const [railwayStatus, setRailwayStatus] = useState<DeploymentStatus | null>(null);
    const [localCommit, setLocalCommit] = useState<string | null>(null);
    const [buildState, setBuildState] = useState<BuildState>('checking');
    const [isOpen, setIsOpen] = useState(false);
    const [lastChecked, setLastChecked] = useState<string | null>(null);
    const [checkCount, setCheckCount] = useState(0);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Check Railway deployment status
    const checkRailwayStatus = async () => {
        try {
            // Get Railway deployment status
            const railwayUrl = process.env.NEXT_PUBLIC_RAILWAY_URL || 'https://keyword-ninja-production.up.railway.app';
            
            const res = await fetch(`${railwayUrl}/api/system/deployment-status`, {
                cache: 'no-store',
                signal: AbortSignal.timeout(5000), // 5 second timeout
            });
            
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.deployment) {
                    setRailwayStatus(data.deployment);
                    return data.deployment;
                }
            }
            return null;
        } catch (e) {
            console.warn('Failed to check Railway status:', e);
            return null;
        }
    };

    // Get local git commit
    const getLocalCommit = async () => {
        try {
            const res = await fetch('/api/system/deployment-status');
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.deployment) {
                    setLocalCommit(data.deployment.commit);
                    return data.deployment.commit;
                }
            }
            return null;
        } catch (e) {
            console.warn('Failed to get local commit:', e);
            return null;
        }
    };

    // Compare commits and determine build state
    const checkStatus = async () => {
        setBuildState('checking');
        setCheckCount(c => c + 1);
        
        const [railway, local] = await Promise.all([
            checkRailwayStatus(),
            getLocalCommit(),
        ]);
        
        setLastChecked(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        
        if (!railway) {
            setBuildState('error');
            return;
        }
        
        if (railway.environment === 'local') {
            setBuildState('local');
            return;
        }
        
        if (!local) {
            setBuildState('error');
            return;
        }
        
        // Compare commits
        if (railway.commit === local) {
            setBuildState('synced');
        } else {
            setBuildState('building');
        }
    };

    useEffect(() => {
        checkStatus();
        
        // Check every 15 seconds when building, otherwise every 60 seconds
        const interval = setInterval(() => {
            checkStatus();
        }, buildState === 'building' ? 15000 : 60000);
        
        return () => clearInterval(interval);
    }, [buildState]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getStateConfig = () => {
        switch (buildState) {
            case 'synced':
                return {
                    color: 'text-green-400',
                    bgColor: 'bg-green-500',
                    label: 'Deployed',
                    icon: '✓',
                    pulse: false,
                };
            case 'building':
                return {
                    color: 'text-amber-400',
                    bgColor: 'bg-amber-500',
                    label: 'Building',
                    icon: '⟳',
                    pulse: true,
                };
            case 'error':
                return {
                    color: 'text-red-400',
                    bgColor: 'bg-red-500',
                    label: 'Error',
                    icon: '!',
                    pulse: false,
                };
            case 'local':
                return {
                    color: 'text-blue-400',
                    bgColor: 'bg-blue-500',
                    label: 'Local',
                    icon: '◉',
                    pulse: false,
                };
            default:
                return {
                    color: 'text-slate-400',
                    bgColor: 'bg-slate-500',
                    label: 'Checking',
                    icon: '...',
                    pulse: true,
                };
        }
    };

    const config = getStateConfig();

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${config.color} hover:bg-slate-800`}
                title="Railway Deployment Status"
            >
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${config.bgColor} ${config.pulse ? 'animate-pulse' : ''}`}></div>
                    <span className="text-sm font-medium">
                        🚂 {config.label}
                    </span>
                </div>
                <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute left-0 bottom-full mb-1 w-72 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50">
                    <div className="p-2 border-b border-slate-700 flex justify-between items-center">
                        <span className="text-xs font-semibold text-slate-400">Railway Status</span>
                        <button 
                            onClick={checkStatus}
                            className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
                        >
                            ↻ Refresh
                        </button>
                    </div>
                    
                    <div className="p-3 space-y-2">
                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${config.bgColor} ${config.pulse ? 'animate-pulse' : ''}`}></div>
                            <span className={`text-sm font-semibold ${config.color}`}>
                                {buildState === 'building' ? '🔨 Build in Progress...' : 
                                 buildState === 'synced' ? '✅ Up to Date' :
                                 buildState === 'error' ? '⚠️ Waiting for Deployment' :
                                 buildState === 'local' ? '💻 Running Locally' :
                                 '⏳ Checking...'}
                            </span>
                        </div>
                        
                        {/* Commit Info */}
                        {railwayStatus && buildState !== 'error' && (
                            <div className="bg-slate-700/50 rounded-lg p-2 text-xs space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Railway Commit:</span>
                                    <code className="text-green-400 font-mono">{railwayStatus.commit}</code>
                                </div>
                                {localCommit && localCommit !== railwayStatus.commit && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Local Commit:</span>
                                        <code className="text-amber-400 font-mono">{localCommit}</code>
                                    </div>
                                )}
                                {railwayStatus.branch && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Branch:</span>
                                        <span className="text-slate-300">{railwayStatus.branch}</span>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* Building Animation */}
                        {buildState === 'building' && (
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 text-xs text-amber-300">
                                <div className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <span>Waiting for new deployment...</span>
                                </div>
                                <div className="text-[10px] text-amber-500/70 mt-1">
                                    Auto-checking every 15s (Check #{checkCount})
                                </div>
                            </div>
                        )}
                        
                        {/* Error/Waiting State */}
                        {buildState === 'error' && (
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 text-xs text-amber-300">
                                <div className="mb-1 font-medium">Railway not reachable</div>
                                <div className="text-[10px] text-amber-400/70">
                                    The deployment status endpoint may not be deployed yet. 
                                    Once Railway finishes building, this will update automatically.
                                </div>
                            </div>
                        )}
                        
                        {/* Show commit info section even when checking */}
                        {buildState === 'checking' && (
                            <div className="bg-slate-700/50 rounded-lg p-2 text-xs space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Railway Commit:</span>
                                    <code className="text-amber-400 font-mono">unknown</code>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Branch:</span>
                                    <span className="text-slate-400">unknown</span>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {lastChecked && (
                        <div className="px-3 pb-2 text-[10px] text-slate-500">
                            Last checked: {lastChecked}
                        </div>
                    )}
                    
                    <div className="p-2 border-t border-slate-700">
                        <a 
                            href="https://railway.app/dashboard" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1"
                        >
                            Open Railway Dashboard →
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
