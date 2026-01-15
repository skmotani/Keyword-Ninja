'use client';

import { useState, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';

const pageHelp = {
    title: 'AI Agent Testing Dashboard',
    description: 'Test different AI models for keyword intent classification using a Gradio-powered dashboard.',
    features: [
        'Model selection dropdown',
        'Single text analysis',
        'Batch file upload (CSV/TXT)',
        'Custom zero-shot labels'
    ],
    useCases: [
        'Test intent classification models',
        'Compare model performance',
        'Batch process keywords for intent'
    ]
};

export default function GradioTestPage() {
    const [gradioStatus, setGradioStatus] = useState<'checking' | 'running' | 'stopped'>('checking');
    const [gradioUrl] = useState('http://localhost:7860');

    useEffect(() => {
        // Check if Gradio is running
        const checkGradio = async () => {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);

                await fetch(gradioUrl, {
                    method: 'HEAD',
                    mode: 'no-cors',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                setGradioStatus('running');
            } catch {
                setGradioStatus('stopped');
            }
        };

        checkGradio();
        const interval = setInterval(checkGradio, 10000);
        return () => clearInterval(interval);
    }, [gradioUrl]);

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <PageHeader
                title="🧠 AI Agent Testing Dashboard"
                description={pageHelp.description}
            />

            {/* Status Banner */}
            <div className={`mb-6 p-4 rounded-lg border ${gradioStatus === 'running'
                ? 'bg-green-50 border-green-200'
                : gradioStatus === 'stopped'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-gray-50 border-gray-200'
                }`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className={`w-3 h-3 rounded-full ${gradioStatus === 'running' ? 'bg-green-500 animate-pulse' :
                            gradioStatus === 'stopped' ? 'bg-yellow-500' : 'bg-gray-400'
                            }`} />
                        <span className="font-medium">
                            {gradioStatus === 'running' && '✅ Gradio Dashboard is Running'}
                            {gradioStatus === 'stopped' && '⚠️ Gradio Dashboard is Not Running'}
                            {gradioStatus === 'checking' && '🔄 Checking Gradio status...'}
                        </span>
                    </div>

                    {gradioStatus === 'stopped' && (
                        <div className="text-sm text-gray-600">
                            <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                                python scripts/gradio_test.py
                            </span>
                            <span className="ml-2">to start</span>
                        </div>
                    )}

                    {gradioStatus === 'running' && (
                        <a
                            href={gradioUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                        >
                            Open in New Tab ↗
                        </a>
                    )}
                </div>
            </div>

            {/* Instructions when stopped */}
            {gradioStatus === 'stopped' && (
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">📋 How to Start the AI Dashboard</h3>

                    <ol className="list-decimal list-inside space-y-3 text-gray-700">
                        <li>
                            <span className="font-medium">Open a new terminal</span> in your project folder
                        </li>
                        <li>
                            <span className="font-medium">Activate the AI environment:</span>
                            <pre className="mt-2 bg-gray-100 p-3 rounded-lg text-sm font-mono">
                                ai_brain_env\Scripts\activate
                            </pre>
                        </li>
                        <li>
                            <span className="font-medium">Run the Gradio dashboard:</span>
                            <pre className="mt-2 bg-gray-100 p-3 rounded-lg text-sm font-mono">
                                python scripts/gradio_test.py
                            </pre>
                        </li>
                        <li>
                            <span className="font-medium">Access the dashboard at:</span>
                            <a href={gradioUrl} className="ml-2 text-purple-600 hover:underline font-mono">
                                {gradioUrl}
                            </a>
                        </li>
                    </ol>

                    <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <h4 className="font-semibold text-purple-800 mb-2">📦 Installed AI Agents</h4>
                        <ul className="space-y-1 text-sm text-purple-700">
                            <li>• <strong>intent_agent</strong> - Fast intent classification (Falconsai)</li>
                            <li>• <strong>logic_agent</strong> - Zero-shot reasoning (BART-MNLI)</li>
                        </ul>
                    </div>
                </div>
            )}

            {/* Embedded Gradio when running */}
            {gradioStatus === 'running' && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <iframe
                        src={gradioUrl}
                        className="w-full border-0"
                        style={{ height: 'calc(100vh - 300px)', minHeight: '600px' }}
                        title="Gradio AI Dashboard"
                    />
                </div>
            )}

            {/* Quick Test Section */}
            <div className="mt-6 bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">🚀 Quick Model Reference</h3>

                <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="font-bold text-blue-800">intent_agent</h4>
                        <p className="text-sm text-blue-700 mt-1">
                            Fast intent detection. Best for quick classification with pre-trained labels.
                        </p>
                        <p className="text-xs text-blue-600 mt-2 font-mono">
                            Model: Falconsai/intent_classification
                        </p>
                    </div>

                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <h4 className="font-bold text-green-800">logic_agent</h4>
                        <p className="text-sm text-green-700 mt-1">
                            Zero-shot reasoning. Accepts custom labels for flexible SEO classification.
                        </p>
                        <p className="text-xs text-green-600 mt-2 font-mono">
                            Model: facebook/bart-large-mnli
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
