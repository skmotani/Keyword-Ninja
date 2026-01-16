'use client';

import React, { useState } from 'react';

interface OnboardingWizardProps {
    onComplete: (config: OnboardingConfig) => void;
    onCancel: () => void;
}

interface OnboardingConfig {
    clientName: string;
    clientCode: string;
    domain: string;
    industry: string;
    useCloudflareDns: boolean;
    cloudflareApiToken?: string;
    cloudflareZoneId?: string;
    templateType: 'blog' | 'ecommerce';
}

const STEPS = [
    { id: 'basics', title: 'Client Basics', icon: '📝' },
    { id: 'domain', title: 'Domain Setup', icon: '🌐' },
    { id: 'cloudflare', title: 'Cloudflare', icon: '☁️' },
    { id: 'template', title: 'Template', icon: '📄' },
    { id: 'review', title: 'Review', icon: '✅' },
];

const INDUSTRIES = [
    'E-commerce',
    'SaaS / Technology',
    'Finance',
    'Healthcare',
    'Real Estate',
    'Education',
    'Manufacturing',
    'Professional Services',
    'Other',
];

export default function OnboardingWizard({
    onComplete,
    onCancel,
}: OnboardingWizardProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [config, setConfig] = useState<OnboardingConfig>({
        clientName: '',
        clientCode: '',
        domain: '',
        industry: '',
        useCloudflareDns: false,
        templateType: 'blog',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    function updateConfig(updates: Partial<OnboardingConfig>) {
        setConfig((prev) => ({ ...prev, ...updates }));
        // Clear errors for updated fields
        const clearedErrors = { ...errors };
        Object.keys(updates).forEach((key) => {
            delete clearedErrors[key];
        });
        setErrors(clearedErrors);
    }

    function generateClientCode(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 20);
    }

    function validateStep(step: number): boolean {
        const newErrors: Record<string, string> = {};

        switch (step) {
            case 0: // Basics
                if (!config.clientName.trim()) {
                    newErrors.clientName = 'Client name is required';
                }
                if (!config.clientCode.trim()) {
                    newErrors.clientCode = 'Client code is required';
                } else if (!/^[a-z0-9-]+$/.test(config.clientCode)) {
                    newErrors.clientCode = 'Only lowercase letters, numbers, and hyphens allowed';
                }
                if (!config.industry) {
                    newErrors.industry = 'Please select an industry';
                }
                break;

            case 1: // Domain
                if (!config.domain.trim()) {
                    newErrors.domain = 'Domain is required';
                } else if (config.domain.startsWith('http')) {
                    newErrors.domain = 'Enter domain without http/https';
                }
                break;

            case 2: // Cloudflare
                if (config.useCloudflareDns) {
                    if (!config.cloudflareApiToken) {
                        newErrors.cloudflareApiToken = 'API token is required for DNS setup';
                    }
                    if (!config.cloudflareZoneId) {
                        newErrors.cloudflareZoneId = 'Zone ID is required for DNS setup';
                    }
                }
                break;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    function handleNext() {
        if (validateStep(currentStep)) {
            if (currentStep < STEPS.length - 1) {
                setCurrentStep(currentStep + 1);
            } else {
                onComplete(config);
            }
        }
    }

    function handleBack() {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    }

    return (
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
                <h2 className="text-2xl font-bold">New Client Onboarding</h2>
                <p className="text-indigo-100 mt-1">Set up a new CMS client in a few steps</p>
            </div>

            {/* Progress Steps */}
            <div className="px-6 py-4 bg-gray-50 border-b">
                <div className="flex justify-between">
                    {STEPS.map((step, index) => (
                        <div
                            key={step.id}
                            className={`flex flex-col items-center ${index <= currentStep ? 'text-indigo-600' : 'text-gray-400'
                                }`}
                        >
                            <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${index < currentStep
                                        ? 'bg-green-500 text-white'
                                        : index === currentStep
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-gray-200'
                                    }`}
                            >
                                {index < currentStep ? '✓' : step.icon}
                            </div>
                            <span className="text-xs mt-1 hidden sm:block">{step.title}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Step Content */}
            <div className="p-6 min-h-[300px]">
                {currentStep === 0 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Client Basics</h3>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Client Name *
                            </label>
                            <input
                                type="text"
                                value={config.clientName}
                                onChange={(e) => {
                                    const name = e.target.value;
                                    updateConfig({
                                        clientName: name,
                                        clientCode: config.clientCode || generateClientCode(name),
                                    });
                                }}
                                placeholder="Acme Corporation"
                                className={`w-full px-3 py-2 border rounded-md ${errors.clientName ? 'border-red-500' : ''
                                    }`}
                            />
                            {errors.clientName && (
                                <p className="text-red-500 text-xs mt-1">{errors.clientName}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Client Code *
                            </label>
                            <input
                                type="text"
                                value={config.clientCode}
                                onChange={(e) => updateConfig({ clientCode: e.target.value.toLowerCase() })}
                                placeholder="acme-corp"
                                className={`w-full px-3 py-2 border rounded-md ${errors.clientCode ? 'border-red-500' : ''
                                    }`}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Used in URLs: /feed/{config.clientCode || 'client-code'}/
                            </p>
                            {errors.clientCode && (
                                <p className="text-red-500 text-xs mt-1">{errors.clientCode}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Industry *
                            </label>
                            <select
                                value={config.industry}
                                onChange={(e) => updateConfig({ industry: e.target.value })}
                                className={`w-full px-3 py-2 border rounded-md ${errors.industry ? 'border-red-500' : ''
                                    }`}
                            >
                                <option value="">Select industry...</option>
                                {INDUSTRIES.map((ind) => (
                                    <option key={ind} value={ind}>{ind}</option>
                                ))}
                            </select>
                            {errors.industry && (
                                <p className="text-red-500 text-xs mt-1">{errors.industry}</p>
                            )}
                        </div>
                    </div>
                )}

                {currentStep === 1 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Domain Setup</h3>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Main Domain *
                            </label>
                            <input
                                type="text"
                                value={config.domain}
                                onChange={(e) => updateConfig({ domain: e.target.value })}
                                placeholder="example.com"
                                className={`w-full px-3 py-2 border rounded-md ${errors.domain ? 'border-red-500' : ''
                                    }`}
                            />
                            {errors.domain && (
                                <p className="text-red-500 text-xs mt-1">{errors.domain}</p>
                            )}
                        </div>

                        <div className="bg-blue-50 p-4 rounded-md text-sm">
                            <p className="font-medium text-blue-800 mb-2">📍 Feed URL Pattern</p>
                            <p className="text-blue-700">
                                Pages will be served at:<br />
                                <code className="bg-blue-100 px-1 rounded">
                                    https://feed.{config.domain || 'example.com'}/feed/{config.clientCode}/[page-slug]
                                </code>
                            </p>
                        </div>
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Cloudflare Integration</h3>

                        <label className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                            <input
                                type="checkbox"
                                checked={config.useCloudflareDns}
                                onChange={(e) => updateConfig({ useCloudflareDns: e.target.checked })}
                                className="w-5 h-5 text-indigo-600 rounded"
                            />
                            <div>
                                <span className="font-medium">Enable Cloudflare DNS Management</span>
                                <p className="text-xs text-gray-500">Automatically configure DNS records</p>
                            </div>
                        </label>

                        {config.useCloudflareDns && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Cloudflare API Token *
                                    </label>
                                    <input
                                        type="password"
                                        value={config.cloudflareApiToken || ''}
                                        onChange={(e) => updateConfig({ cloudflareApiToken: e.target.value })}
                                        placeholder="Enter API token"
                                        className={`w-full px-3 py-2 border rounded-md ${errors.cloudflareApiToken ? 'border-red-500' : ''
                                            }`}
                                    />
                                    {errors.cloudflareApiToken && (
                                        <p className="text-red-500 text-xs mt-1">{errors.cloudflareApiToken}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Zone ID *
                                    </label>
                                    <input
                                        type="text"
                                        value={config.cloudflareZoneId || ''}
                                        onChange={(e) => updateConfig({ cloudflareZoneId: e.target.value })}
                                        placeholder="e.g., abc123..."
                                        className={`w-full px-3 py-2 border rounded-md ${errors.cloudflareZoneId ? 'border-red-500' : ''
                                            }`}
                                    />
                                    {errors.cloudflareZoneId && (
                                        <p className="text-red-500 text-xs mt-1">{errors.cloudflareZoneId}</p>
                                    )}
                                </div>
                            </>
                        )}

                        {!config.useCloudflareDns && (
                            <div className="bg-yellow-50 p-4 rounded-md text-sm">
                                <p className="text-yellow-800">
                                    ⚠️ Without Cloudflare, you'll need to manually configure DNS records.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {currentStep === 3 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Default Template</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => updateConfig({ templateType: 'blog' })}
                                className={`p-4 border-2 rounded-lg text-left transition-colors ${config.templateType === 'blog'
                                        ? 'border-indigo-500 bg-indigo-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <span className="text-2xl">📝</span>
                                <div className="font-medium mt-2">Blog Articles</div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Hero, TOC, Body, FAQ, Author
                                </p>
                            </button>

                            <button
                                onClick={() => updateConfig({ templateType: 'ecommerce' })}
                                className={`p-4 border-2 rounded-lg text-left transition-colors ${config.templateType === 'ecommerce'
                                        ? 'border-indigo-500 bg-indigo-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <span className="text-2xl">🛒</span>
                                <div className="font-medium mt-2">E-Commerce</div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Hero, Products, Categories
                                </p>
                            </button>
                        </div>
                    </div>
                )}

                {currentStep === 4 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Review & Confirm</h3>

                        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Client Name:</span>
                                <span className="font-medium">{config.clientName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Client Code:</span>
                                <span className="font-mono">{config.clientCode}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Domain:</span>
                                <span>{config.domain}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Industry:</span>
                                <span>{config.industry}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Cloudflare DNS:</span>
                                <span>{config.useCloudflareDns ? '✅ Enabled' : '❌ Manual'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Template:</span>
                                <span>{config.templateType === 'blog' ? '📝 Blog' : '🛒 E-Commerce'}</span>
                            </div>
                        </div>

                        <div className="bg-green-50 p-4 rounded-md text-sm text-green-800">
                            ✅ Ready to create client. Click "Complete Setup" to proceed.
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-between">
                <button
                    onClick={currentStep === 0 ? onCancel : handleBack}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                    {currentStep === 0 ? 'Cancel' : '← Back'}
                </button>
                <button
                    onClick={handleNext}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                >
                    {currentStep === STEPS.length - 1 ? 'Complete Setup ✓' : 'Next →'}
                </button>
            </div>
        </div>
    );
}
