import React, { useState } from 'react';
import { ApiDebugStep, UseApiDebugPipelineReturn } from '@/hooks/useApiDebugPipeline';

interface ApiDebugPanelProps {
    pipeline: UseApiDebugPipelineReturn;
}

export default function ApiDebugPanel({ pipeline }: ApiDebugPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

    // Development Mode Toggle (simulated local state or prop if app-wide)
    // For now, we assume this panel is mounted conditionally or always visible but collapsible.
    // Ideally, "Developer Mode" is a global context, but per instructions, we just toggle visibility.

    if (!pipeline) return null;

    const toggleStep = (id: string) => {
        setExpandedStepId(prev => prev === id ? null : id);
    };

    const copyToClipboard = (data: any) => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        alert('Copied to clipboard');
    };

    return (
        <div className="fixed bottom-0 right-0 z-50 flex flex-col items-end pointer-events-none">
            {/* Toggle Button */}
            <div className="pointer-events-auto mr-4 mb-2">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`px-3 py-1.5 rounded-t-lg font-mono text-xs font-bold shadow-lg border-t border-l border-r 
                        ${isOpen ? 'bg-slate-900 text-cyan-400 border-slate-700' : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'}`}
                >
                    {isOpen ? '▼ Hide Debug Pipeline' : '▲ API Debug'}
                </button>
            </div>

            {/* Panel Drawer */}
            {isOpen && (
                <div className="pointer-events-auto bg-slate-900 border text-slate-200 w-[450px] max-h-[80vh] overflow-y-auto shadow-2xl border-slate-700 rounded-tl-lg mr-4 mb-0 flex flex-col font-mono text-xs">

                    {/* Header */}
                    <div className="p-3 border-b border-slate-700 bg-slate-800 flex justify-between items-center sticky top-0 z-10">
                        <div>
                            <h3 className="font-bold text-cyan-400">API Pipeline Inspector</h3>
                            <div className="text-[10px] text-slate-500">Run ID: {pipeline.correlationId || 'N/A'}</div>
                        </div>
                        <button onClick={pipeline.resetPipeline} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[10px]">Reset</button>
                    </div>

                    {/* Steps List */}
                    <div className="flex-1 p-2 space-y-2">
                        {pipeline.steps.length === 0 && (
                            <div className="text-center py-6 text-slate-500 italic">No steps initialized.</div>
                        )}

                        {pipeline.steps.map((step) => {
                            const isExpanded = expandedStepId === step.id;
                            const duration = step.finishedAt && step.startedAt ? (step.finishedAt - step.startedAt) + 'ms' : null;

                            // Status Colors
                            let statusColor = 'text-slate-500';
                            let icon = '○';
                            let bgColor = 'bg-slate-900';

                            if (step.status === 'running') {
                                statusColor = 'text-blue-400';
                                icon = 'ea'; // spinner proxy
                                bgColor = 'bg-slate-800/50';
                            } else if (step.status === 'success') {
                                statusColor = 'text-green-500';
                                icon = '✓';
                                bgColor = 'bg-green-900/10';
                            } else if (step.status === 'error') {
                                statusColor = 'text-red-500';
                                icon = '✗';
                                bgColor = 'bg-red-900/10';
                            }

                            return (
                                <div key={step.id} className={`border border-slate-700 rounded overflow-hidden ${bgColor}`}>
                                    {/* Step Header */}
                                    <div
                                        onClick={() => toggleStep(step.id)}
                                        className="flex items-center gap-3 p-2 cursor-pointer hover:bg-slate-800 transition-colors"
                                    >
                                        <div className={`font-bold w-4 text-center ${statusColor}`}>
                                            {step.status === 'running' ? <span className="animate-spin inline-block">C</span> : icon}
                                        </div>
                                        <div className="flex-1">
                                            <div className={`font-bold ${step.status === 'idle' ? 'text-slate-500' : 'text-slate-200'}`}>
                                                {step.label}
                                            </div>
                                            {step.summary && (
                                                <div className={`mt-0.5 ${step.status === 'error' ? 'text-red-400' : 'text-slate-400'}`}>
                                                    {step.summary}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-slate-500 w-12 text-right">
                                            {duration || (step.status === 'running' ? '...' : '')}
                                        </div>
                                        <div className="text-slate-600">
                                            {isExpanded ? '▼' : '▶'}
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && step.details && (
                                        <div className="border-t border-slate-700 bg-slate-950 p-2 relative group text-[10px] font-mono">

                                            {/* Rich Header for HTTP Errors */}
                                            {step.details.errorCategory && (
                                                <div className="mb-2 p-2 bg-red-900/20 border border-red-900/50 rounded">
                                                    <div className="font-bold text-red-400">
                                                        HTTP {step.details.httpStatus} — {step.details.errorCategory}
                                                    </div>
                                                    <div className="text-slate-400 mt-1">
                                                        {step.details.method} {step.details.url}
                                                    </div>
                                                    {step.details.errorCategory === 'ROUTE_NOT_FOUND' && (
                                                        <div className="mt-1 text-slate-500 italic">
                                                            Check that the API route exists at <code>app/api/.../route.ts</code> and matches the HTTP method.
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <button
                                                onClick={(e) => { e.stopPropagation(); copyToClipboard(step.details); }}
                                                className="absolute top-2 right-2 px-2 py-0.5 bg-slate-800 border border-slate-700 rounded hover:bg-slate-700 text-[9px] opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                            >
                                                Copy Details
                                            </button>

                                            {/* Default JSON Dump */}
                                            <pre className="overflow-x-auto text-green-300 p-1">
                                                {JSON.stringify(step.details, null, 2)}
                                            </pre>

                                            {/* Smart Hints for common errors */}
                                            {step.status === 'error' && (
                                                <div className="mt-2 pt-2 border-t border-slate-800 text-orange-400 italic">
                                                    {getSmartHint(step)}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

function getSmartHint(step: ApiDebugStep): string | null {
    const d = step.details || {};
    // New Category Based Hints
    if (d.errorCategory === 'ROUTE_NOT_FOUND') return null; // Handled in UI explicitly
    if (d.errorCategory === 'UNAUTHORIZED') return "Hint: Check DFS_LOGIN and DFS_PASSWORD in .env or your session.";
    if (d.errorCategory === 'SERVER_ERROR') return "Hint: Check server console logs for exception details.";
    if (d.errorCategory === 'NETWORK_ERROR') return "Hint: Is the server running? Check connection.";

    // Fallback string matching
    const s = JSON.stringify(d);
    if (s.includes('40502') || s.includes('parameter validation')) return "Hint: Check request body fields. likely invalid location_code or language.";
    if (s.includes('Empty')) return "Hint: Ensure you have selected items or entered keywords.";
    return null;
}
