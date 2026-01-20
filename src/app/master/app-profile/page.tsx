'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';

interface AppLogo {
    id: string;
    name: string;
    filename: string;
    url: string;
    isPrimary: boolean;
    createdAt: string;
}

interface AppProfile {
    id: string;
    appName: string;
    tagline: string | null;
    punchline: string | null;
    metaTitle: string | null;
    metaDescription: string | null;
    customFields: Record<string, string> | null;
    logos: AppLogo[];
}

export default function AppProfilePage() {
    const [profile, setProfile] = useState<AppProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Form state
    const [appName, setAppName] = useState('');
    const [tagline, setTagline] = useState('');
    const [punchline, setPunchline] = useState('');
    const [metaTitle, setMetaTitle] = useState('');
    const [metaDescription, setMetaDescription] = useState('');
    const [customFields, setCustomFields] = useState<Record<string, string>>({});
    const [newFieldKey, setNewFieldKey] = useState('');
    const [newFieldValue, setNewFieldValue] = useState('');

    const showNotification = (type: 'success' | 'error', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 3000);
    };

    // Load profile
    const loadProfile = useCallback(async () => {
        try {
            const res = await fetch('/api/app-profile');
            const data = await res.json();
            if (data.success && data.profile) {
                const p = data.profile;
                setProfile(p);
                setAppName(p.appName || '');
                setTagline(p.tagline || '');
                setPunchline(p.punchline || '');
                setMetaTitle(p.metaTitle || '');
                setMetaDescription(p.metaDescription || '');
                setCustomFields(p.customFields || {});
            }
        } catch (error) {
            console.error('Failed to load profile:', error);
            showNotification('error', 'Failed to load profile');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    // Save profile
    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/app-profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    appName,
                    tagline,
                    punchline,
                    metaTitle,
                    metaDescription,
                    customFields
                })
            });
            const data = await res.json();
            if (data.success) {
                setProfile(data.profile);
                showNotification('success', 'Profile saved successfully!');
            } else {
                showNotification('error', data.error || 'Failed to save');
            }
        } catch (error) {
            console.error('Save error:', error);
            showNotification('error', 'Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    // Upload logo
    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('name', file.name.replace(/\.[^/.]+$/, ''));
            formData.append('isPrimary', String(profile?.logos.length === 0));

            const res = await fetch('/api/app-profile/logos', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                loadProfile();
                showNotification('success', 'Logo uploaded!');
            } else {
                showNotification('error', data.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            showNotification('error', 'Failed to upload logo');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    // Delete logo
    const handleDeleteLogo = async (id: string) => {
        if (!confirm('Delete this logo?')) return;

        try {
            const res = await fetch(`/api/app-profile/logos?id=${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                loadProfile();
                showNotification('success', 'Logo deleted');
            }
        } catch (error) {
            console.error('Delete error:', error);
        }
    };

    // Set primary logo
    const handleSetPrimary = async (id: string) => {
        try {
            const res = await fetch(`/api/app-profile/logos?id=${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPrimary: true })
            });
            const data = await res.json();
            if (data.success) {
                loadProfile();
            }
        } catch (error) {
            console.error('Set primary error:', error);
        }
    };

    // Add custom field
    const handleAddField = () => {
        if (!newFieldKey.trim()) return;
        setCustomFields(prev => ({ ...prev, [newFieldKey.trim()]: newFieldValue }));
        setNewFieldKey('');
        setNewFieldValue('');
    };

    // Remove custom field
    const handleRemoveField = (key: string) => {
        setCustomFields(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <PageHeader
                title="App Profile"
                description="Manage app branding, logos, and SEO metadata"
            />

            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {/* Notification */}
                {notification && (
                    <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
                        }`}>
                        {notification.message}
                    </div>
                )}

                {/* Logos Section */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">🖼️ App Logos</h2>
                    <div className="flex flex-wrap gap-4 mb-4">
                        {profile?.logos.map(logo => (
                            <div key={logo.id} className="relative group">
                                <div className={`w-24 h-24 border-2 rounded-lg overflow-hidden flex items-center justify-center bg-gray-50 ${logo.isPrimary ? 'border-indigo-500' : 'border-gray-200'
                                    }`}>
                                    <img src={logo.url} alt={logo.name} className="max-w-full max-h-full object-contain" />
                                </div>
                                {logo.isPrimary && (
                                    <span className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-indigo-500 text-white text-[10px] rounded-full">
                                        Primary
                                    </span>
                                )}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-1">
                                    {!logo.isPrimary && (
                                        <button
                                            onClick={() => handleSetPrimary(logo.id)}
                                            className="p-1 bg-white rounded text-xs hover:bg-gray-100"
                                            title="Set as primary"
                                        >
                                            ⭐
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDeleteLogo(logo.id)}
                                        className="p-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                                        title="Delete"
                                    >
                                        🗑️
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 text-center mt-1 truncate w-24">{logo.name}</p>
                            </div>
                        ))}

                        {/* Upload button */}
                        <label className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                className="hidden"
                                disabled={uploading}
                            />
                            {uploading ? (
                                <div className="animate-spin h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
                            ) : (
                                <>
                                    <span className="text-2xl">➕</span>
                                    <span className="text-xs text-gray-500">Add Logo</span>
                                </>
                            )}
                        </label>
                    </div>
                </div>

                {/* Branding Section */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">✨ Branding</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">App Name</label>
                            <input
                                type="text"
                                value={appName}
                                onChange={e => setAppName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="Keyword Ninja"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
                            <input
                                type="text"
                                value={tagline}
                                onChange={e => setTagline(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="SEO Intelligence Platform"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Punchline</label>
                            <input
                                type="text"
                                value={punchline}
                                onChange={e => setPunchline(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="Your SEO Partner for Growth"
                            />
                        </div>
                    </div>
                </div>

                {/* SEO Meta Section */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">🔍 SEO Meta</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Meta Title</label>
                            <input
                                type="text"
                                value={metaTitle}
                                onChange={e => setMetaTitle(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="Keyword Ninja - SEO Intelligence Platform"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description</label>
                            <textarea
                                value={metaDescription}
                                onChange={e => setMetaDescription(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="Advanced SEO analysis and keyword research tool..."
                            />
                        </div>
                    </div>
                </div>

                {/* Custom Fields Section */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">⚙️ Custom Fields</h2>
                    <div className="space-y-3">
                        {Object.entries(customFields).map(([key, value]) => (
                            <div key={key} className="flex gap-2 items-center">
                                <input
                                    type="text"
                                    value={key}
                                    disabled
                                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                                />
                                <input
                                    type="text"
                                    value={value}
                                    onChange={e => setCustomFields(prev => ({ ...prev, [key]: e.target.value }))}
                                    className="flex-[2] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                />
                                <button
                                    onClick={() => handleRemoveField(key)}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}

                        {/* Add new field */}
                        <div className="flex gap-2 items-center pt-2 border-t">
                            <input
                                type="text"
                                value={newFieldKey}
                                onChange={e => setNewFieldKey(e.target.value)}
                                placeholder="Field name"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            />
                            <input
                                type="text"
                                value={newFieldValue}
                                onChange={e => setNewFieldValue(e.target.value)}
                                placeholder="Value"
                                className="flex-[2] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                                onClick={handleAddField}
                                disabled={!newFieldKey.trim()}
                                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                            >
                                + Add
                            </button>
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
                    >
                        {saving ? (
                            <>
                                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                Saving...
                            </>
                        ) : (
                            <>💾 Save Profile</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
