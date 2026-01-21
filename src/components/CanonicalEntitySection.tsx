'use client';

import React, { useState, useEffect } from 'react';
import { Client, CanonicalEntity, CanonicalEntityStatus } from '@/types';

interface CanonicalEntitySectionProps {
    client: Client;
    onUpdate: () => void;
    showNotification: (type: 'success' | 'error', message: string) => void;
}

// Tooltip text
const CANONICAL_ENTITY_TOOLTIP = `Many brands share the same name across the web. This Canonical Entity ID defines your business's unique identity (official domains, phone, address, legal name, and unique product identifiers). We use it to confirm that each of the 82 digital surfaces found during scans truly belongs to this business and to prevent false-positive matches.`;

export default function CanonicalEntitySection({ client, onUpdate, showNotification }: CanonicalEntitySectionProps) {
    const [canonicalEntity, setCanonicalEntity] = useState<CanonicalEntity | null>(null);
    const [status, setStatus] = useState<CanonicalEntityStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [overwriteAll, setOverwriteAll] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['identity', 'web']));
    const [generationNotes, setGenerationNotes] = useState<{ sources: string[]; absent: { field: string; reason: string }[] } | null>(null);

    // Local edits
    const [edits, setEdits] = useState<Partial<CanonicalEntity>>({});

    useEffect(() => {
        loadCanonicalEntity();
    }, [client.id]);

    const loadCanonicalEntity = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/clients/${client.id}/canonical-entity`);
            if (res.ok) {
                const data = await res.json();
                setCanonicalEntity(data.canonicalEntity);
                setStatus(data.canonicalEntityStatus);
            }
        } catch (err) {
            console.error('Failed to load canonical entity:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const res = await fetch(`/api/clients/${client.id}/canonical-entity/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ overwriteAll }),
            });
            if (res.ok) {
                const data = await res.json();
                setCanonicalEntity(data.canonicalEntity);
                setStatus(data.canonicalEntityStatus);
                if (data.generationNotes) {
                    setGenerationNotes(data.generationNotes);
                }
                const sourceCount = data.generationNotes?.sources?.length || 0;
                const absentCount = data.generationNotes?.absent?.length || 0;
                showNotification('success', `Generated from ${sourceCount} source(s). ${absentCount} field(s) need manual entry.`);
                onUpdate();
            } else {
                showNotification('error', 'Failed to generate Canonical Entity ID');
            }
        } catch (err) {
            showNotification('error', 'Failed to generate Canonical Entity ID');
        } finally {
            setGenerating(false);
        }
    };

    const handleSave = async () => {
        if (!canonicalEntity) return;
        setSaving(true);
        try {
            const updatedEntity = { ...canonicalEntity, ...edits };
            const res = await fetch(`/api/clients/${client.id}/canonical-entity`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ canonicalEntity: updatedEntity }),
            });
            if (res.ok) {
                const data = await res.json();
                setCanonicalEntity(data.canonicalEntity);
                setEdits({});
                showNotification('success', 'Canonical Entity saved');
                onUpdate();
            }
        } catch (err) {
            showNotification('error', 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const handleMarkReviewed = async () => {
        try {
            const res = await fetch(`/api/clients/${client.id}/canonical-entity`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'markReviewed' }),
            });
            if (res.ok) {
                const data = await res.json();
                setStatus(data.canonicalEntityStatus);
                showNotification('success', 'Marked as reviewed');
            }
        } catch (err) {
            showNotification('error', 'Failed to mark as reviewed');
        }
    };

    const toggleSection = (section: string) => {
        setExpandedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(section)) {
                newSet.delete(section);
            } else {
                newSet.add(section);
            }
            return newSet;
        });
    };

    const getStatusBadge = () => {
        if (!status) return null;
        const colors = {
            draft: 'bg-yellow-100 text-yellow-700 border-yellow-300',
            generated: 'bg-blue-100 text-blue-700 border-blue-300',
            reviewed: 'bg-green-100 text-green-700 border-green-300',
        };
        return (
            <span className={`px-2 py-0.5 text-xs font-medium rounded border ${colors[status.status]}`}>
                {status.status.toUpperCase()}
            </span>
        );
    };

    // Field editor component
    const FieldEditor = ({ label, value, onChange, placeholder = '', multiline = false, aiGenerated = false }: {
        label: string;
        value: string;
        onChange: (value: string) => void;
        placeholder?: string;
        multiline?: boolean;
        aiGenerated?: boolean;
    }) => (
        <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">
                {label}
                {aiGenerated && <span className="ml-1 text-xs bg-purple-100 text-purple-600 px-1 rounded">AI</span>}
            </label>
            {multiline ? (
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    rows={2}
                />
            ) : (
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
            )}
        </div>
    );

    // Array editor component  
    const ArrayEditor = ({ label, values, onChange, placeholder = '' }: {
        label: string;
        values: string[];
        onChange: (values: string[]) => void;
        placeholder?: string;
    }) => (
        <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            <div className="flex flex-wrap gap-1 mb-1">
                {values.map((v, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs bg-gray-100 px-2 py-0.5 rounded">
                        {v}
                        <button onClick={() => onChange(values.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-700">×</button>
                    </span>
                ))}
            </div>
            <input
                type="text"
                placeholder={placeholder}
                className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-indigo-500"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                        onChange([...values, (e.target as HTMLInputElement).value.trim()]);
                        (e.target as HTMLInputElement).value = '';
                        e.preventDefault();
                    }
                }}
            />
        </div>
    );

    // Collapsible section
    const Section = ({ id, title, icon, children }: { id: string; title: string; icon: string; children: React.ReactNode }) => (
        <div className="border rounded-lg mb-2">
            <button
                onClick={() => toggleSection(id)}
                className="w-full px-3 py-2 text-left flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-t-lg"
            >
                <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <span>{icon}</span> {title}
                </span>
                <span>{expandedSections.has(id) ? '▼' : '▶'}</span>
            </button>
            {expandedSections.has(id) && (
                <div className="p-3 bg-white rounded-b-lg">
                    {children}
                </div>
            )}
        </div>
    );

    if (loading) {
        return (
            <div className="bg-white rounded-lg border p-4 mt-4">
                <div className="text-center text-gray-500 py-4">Loading Canonical Entity...</div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg border border-blue-200 p-4 mt-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <span>🆔</span> Canonical Entity ID (Matching Profile)
                    </h4>
                    <div className="relative group">
                        <span className="text-gray-400 cursor-help">ⓘ</span>
                        <div className="hidden group-hover:block absolute left-0 top-6 w-80 p-3 bg-gray-800 text-white text-xs rounded shadow-lg z-10">
                            <div className="font-medium mb-1">Why this exists</div>
                            {CANONICAL_ENTITY_TOOLTIP}
                        </div>
                    </div>
                    {getStatusBadge()}
                </div>
                <div className="flex items-center gap-2">
                    {canonicalEntity && Object.keys(edits).length > 0 && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    )}
                    {canonicalEntity && status?.status !== 'reviewed' && (
                        <button
                            onClick={handleMarkReviewed}
                            className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                        >
                            ✓ Mark as Reviewed
                        </button>
                    )}
                </div>
            </div>

            {/* Generate Controls */}
            {!canonicalEntity && (
                <div className="bg-white rounded-lg p-4 mb-4 text-center">
                    <p className="text-sm text-gray-600 mb-3">No Canonical Entity ID defined yet. Generate one to enable accurate presence verification.</p>
                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                    >
                        {generating ? '⏳ Generating...' : '🤖 Generate Canonical Entity ID (AI)'}
                    </button>
                </div>
            )}

            {canonicalEntity && (
                <>
                    {/* Regenerate controls */}
                    <div className="flex items-center justify-between mb-4 p-2 bg-white rounded border">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleGenerate}
                                disabled={generating}
                                className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                            >
                                {generating ? '⏳ Regenerating...' : '🔄 Regenerate (AI)'}
                            </button>
                            <label className="flex items-center gap-2 text-xs text-gray-600">
                                <input
                                    type="checkbox"
                                    checked={overwriteAll}
                                    onChange={(e) => setOverwriteAll(e.target.checked)}
                                    className="rounded"
                                />
                                Overwrite all fields
                            </label>
                        </div>
                        <div className="text-xs text-gray-500">
                            Entity ID: <code className="bg-gray-100 px-1 rounded">{canonicalEntity.entityId}</code>
                        </div>
                    </div>

                    {/* Generation Notes - show absent fields */}
                    {generationNotes && generationNotes.absent.length > 0 && (
                        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <span>⚠️</span>
                                <span className="text-sm font-medium text-amber-800">Fields Not Found (Manual Entry Needed)</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                                {generationNotes.absent.map((item, i) => (
                                    <div key={i} className="flex items-start gap-1 text-amber-700">
                                        <span className="text-amber-500">•</span>
                                        <div>
                                            <span className="font-medium">{item.field}:</span> <span className="text-amber-600">{item.reason}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {generationNotes.sources.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-amber-200 text-xs text-amber-600">
                                    <span className="font-medium">Data sources used:</span> {generationNotes.sources.join(', ')}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Sections */}
                    <Section id="identity" title="Identity" icon="👤">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FieldEditor
                                label="Brand Name"
                                value={edits.names?.brand ?? canonicalEntity.names.brand}
                                onChange={(v) => setEdits({ ...edits, names: { ...canonicalEntity.names, ...edits.names, brand: v } })}
                                placeholder="Primary brand name"
                                aiGenerated
                            />
                            <FieldEditor
                                label="Legal Name"
                                value={edits.names?.legal ?? canonicalEntity.names.legal}
                                onChange={(v) => setEdits({ ...edits, names: { ...canonicalEntity.names, ...edits.names, legal: v } })}
                                placeholder="Legal entity name"
                            />
                        </div>
                        <ArrayEditor
                            label="Aliases (press Enter to add)"
                            values={edits.names?.aliases ?? canonicalEntity.names.aliases}
                            onChange={(v) => setEdits({ ...edits, names: { ...canonicalEntity.names, ...edits.names, aliases: v } })}
                            placeholder="Add alias..."
                        />
                    </Section>

                    <Section id="web" title="Web & Domains" icon="🌐">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FieldEditor
                                label="Canonical Domain"
                                value={edits.web?.canonicalDomain ?? canonicalEntity.web.canonicalDomain}
                                onChange={(v) => setEdits({ ...edits, web: { ...canonicalEntity.web, ...edits.web, canonicalDomain: v } })}
                                placeholder="example.com"
                                aiGenerated
                            />
                            <FieldEditor
                                label="Canonical URL"
                                value={edits.web?.canonicalUrl ?? canonicalEntity.web.canonicalUrl}
                                onChange={(v) => setEdits({ ...edits, web: { ...canonicalEntity.web, ...edits.web, canonicalUrl: v } })}
                                placeholder="https://www.example.com"
                            />
                        </div>
                        <ArrayEditor
                            label="Allowed Domains"
                            values={edits.web?.allowedDomains ?? canonicalEntity.web.allowedDomains}
                            onChange={(v) => setEdits({ ...edits, web: { ...canonicalEntity.web, ...edits.web, allowedDomains: v } })}
                            placeholder="Add domain..."
                        />
                        <ArrayEditor
                            label="Brand Email Domains"
                            values={edits.web?.brandEmailDomains ?? canonicalEntity.web.brandEmailDomains}
                            onChange={(v) => setEdits({ ...edits, web: { ...canonicalEntity.web, ...edits.web, brandEmailDomains: v } })}
                            placeholder="Add email domain..."
                        />
                    </Section>

                    <Section id="contact" title="Contact & Location" icon="📍">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FieldEditor
                                label="Primary Phone (E.164)"
                                value={edits.contact?.primaryPhoneE164 ?? canonicalEntity.contact.primaryPhoneE164}
                                onChange={(v) => setEdits({ ...edits, contact: { ...canonicalEntity.contact, ...edits.contact, primaryPhoneE164: v } })}
                                placeholder="+1234567890"
                            />
                            <ArrayEditor
                                label="Support Emails"
                                values={edits.contact?.supportEmails ?? canonicalEntity.contact.supportEmails}
                                onChange={(v) => setEdits({ ...edits, contact: { ...canonicalEntity.contact, ...edits.contact, supportEmails: v } })}
                                placeholder="Add email..."
                            />
                        </div>
                        <div className="mt-3 p-3 bg-gray-50 rounded">
                            <div className="text-xs font-medium text-gray-600 mb-2">Headquarters Address</div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                <input type="text" placeholder="Address Line" className="px-2 py-1 text-sm border rounded"
                                    value={edits.location?.hq?.addressLine ?? canonicalEntity.location.hq.addressLine}
                                    onChange={(e) => setEdits({
                                        ...edits,
                                        location: {
                                            ...canonicalEntity.location,
                                            ...edits.location,
                                            hq: { ...canonicalEntity.location.hq, ...edits.location?.hq, addressLine: e.target.value }
                                        }
                                    })}
                                />
                                <input type="text" placeholder="City" className="px-2 py-1 text-sm border rounded"
                                    value={edits.location?.hq?.city ?? canonicalEntity.location.hq.city}
                                    onChange={(e) => setEdits({
                                        ...edits,
                                        location: {
                                            ...canonicalEntity.location,
                                            ...edits.location,
                                            hq: { ...canonicalEntity.location.hq, ...edits.location?.hq, city: e.target.value }
                                        }
                                    })}
                                />
                                <input type="text" placeholder="State" className="px-2 py-1 text-sm border rounded"
                                    value={edits.location?.hq?.state ?? canonicalEntity.location.hq.state}
                                    onChange={(e) => setEdits({
                                        ...edits,
                                        location: {
                                            ...canonicalEntity.location,
                                            ...edits.location,
                                            hq: { ...canonicalEntity.location.hq, ...edits.location?.hq, state: e.target.value }
                                        }
                                    })}
                                />
                                <input type="text" placeholder="Country" className="px-2 py-1 text-sm border rounded"
                                    value={edits.location?.hq?.country ?? canonicalEntity.location.hq.country}
                                    onChange={(e) => setEdits({
                                        ...edits,
                                        location: {
                                            ...canonicalEntity.location,
                                            ...edits.location,
                                            hq: { ...canonicalEntity.location.hq, ...edits.location?.hq, country: e.target.value }
                                        }
                                    })}
                                />
                                <input type="text" placeholder="Postal Code" className="px-2 py-1 text-sm border rounded"
                                    value={edits.location?.hq?.postalCode ?? canonicalEntity.location.hq.postalCode}
                                    onChange={(e) => setEdits({
                                        ...edits,
                                        location: {
                                            ...canonicalEntity.location,
                                            ...edits.location,
                                            hq: { ...canonicalEntity.location.hq, ...edits.location?.hq, postalCode: e.target.value }
                                        }
                                    })}
                                />
                            </div>
                        </div>
                        <ArrayEditor
                            label="Service Geographies"
                            values={edits.location?.serviceGeographies ?? canonicalEntity.location.serviceGeographies}
                            onChange={(v) => setEdits({ ...edits, location: { ...canonicalEntity.location, ...edits.location, serviceGeographies: v } })}
                            placeholder="Add geography..."
                        />
                    </Section>

                    <Section id="industry" title="Industry & Identifiers" icon="🏭">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FieldEditor
                                label="Business Model"
                                value={edits.industry?.businessModel ?? canonicalEntity.industry.businessModel}
                                onChange={(v) => setEdits({ ...edits, industry: { ...canonicalEntity.industry, ...edits.industry, businessModel: v } })}
                                placeholder="B2B, B2C, etc."
                                aiGenerated
                            />
                            <FieldEditor
                                label="Industry"
                                value={edits.industry?.industry ?? canonicalEntity.industry.industry}
                                onChange={(v) => setEdits({ ...edits, industry: { ...canonicalEntity.industry, ...edits.industry, industry: v } })}
                                placeholder="Industry vertical"
                                aiGenerated
                            />
                        </div>
                        <ArrayEditor
                            label="Products"
                            values={edits.industry?.products ?? canonicalEntity.industry.products}
                            onChange={(v) => setEdits({ ...edits, industry: { ...canonicalEntity.industry, ...edits.industry, products: v } })}
                            placeholder="Add product..."
                        />
                        <ArrayEditor
                            label="Keywords"
                            values={edits.industry?.keywords ?? canonicalEntity.industry.keywords}
                            onChange={(v) => setEdits({ ...edits, industry: { ...canonicalEntity.industry, ...edits.industry, keywords: v } })}
                            placeholder="Add keyword..."
                        />
                        <ArrayEditor
                            label="Unique Identifiers (SKUs, model numbers, certifications)"
                            values={edits.industry?.uniqueIdentifiers ?? canonicalEntity.industry.uniqueIdentifiers}
                            onChange={(v) => setEdits({ ...edits, industry: { ...canonicalEntity.industry, ...edits.industry, uniqueIdentifiers: v } })}
                            placeholder="Add identifier..."
                        />
                    </Section>

                    <Section id="profiles" title="Official Profiles" icon="🔗">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="bg-gray-50 p-2 rounded">
                                <div className="font-medium text-gray-600 mb-2">Google Business</div>
                                <input type="text" placeholder="Place ID" className="w-full px-2 py-1 mb-1 border rounded text-sm" />
                                <input type="text" placeholder="CID" className="w-full px-2 py-1 border rounded text-sm" />
                            </div>
                            <div className="bg-gray-50 p-2 rounded">
                                <div className="font-medium text-gray-600 mb-2">Knowledge Graph</div>
                                <input type="text" placeholder="Wikidata QID" className="w-full px-2 py-1 mb-1 border rounded text-sm" />
                                <input type="text" placeholder="Wikipedia URL" className="w-full px-2 py-1 border rounded text-sm" />
                            </div>
                            <div className="bg-gray-50 p-2 rounded">
                                <div className="font-medium text-gray-600 mb-2">Social</div>
                                <input type="text" placeholder="LinkedIn Company Slug" className="w-full px-2 py-1 mb-1 border rounded text-sm" />
                                <input type="text" placeholder="YouTube Handle" className="w-full px-2 py-1 mb-1 border rounded text-sm" />
                                <input type="text" placeholder="X Handle" className="w-full px-2 py-1 border rounded text-sm" />
                            </div>
                            <div className="bg-gray-50 p-2 rounded">
                                <div className="font-medium text-gray-600 mb-2">Directories</div>
                                <input type="text" placeholder="Crunchbase URL" className="w-full px-2 py-1 mb-1 border rounded text-sm" />
                                <input type="text" placeholder="G2 URL" className="w-full px-2 py-1 mb-1 border rounded text-sm" />
                                <input type="text" placeholder="Trustpilot URL" className="w-full px-2 py-1 border rounded text-sm" />
                            </div>
                        </div>
                    </Section>

                    <Section id="proof" title="Proof Signals" icon="✓">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FieldEditor
                                label="Logo URL"
                                value={edits.proofSignals?.logoUrl ?? canonicalEntity.proofSignals.logoUrl ?? ''}
                                onChange={(v) => setEdits({ ...edits, proofSignals: { ...canonicalEntity.proofSignals, ...edits.proofSignals, logoUrl: v } })}
                                placeholder="https://..."
                            />
                            <FieldEditor
                                label="Tagline"
                                value={edits.proofSignals?.tagline ?? canonicalEntity.proofSignals.tagline ?? ''}
                                onChange={(v) => setEdits({ ...edits, proofSignals: { ...canonicalEntity.proofSignals, ...edits.proofSignals, tagline: v } })}
                                placeholder="Company tagline"
                                aiGenerated
                            />
                        </div>
                        <ArrayEditor
                            label="Key People (CEO, Founders)"
                            values={edits.proofSignals?.keyPeople ?? canonicalEntity.proofSignals.keyPeople ?? []}
                            onChange={(v) => setEdits({ ...edits, proofSignals: { ...canonicalEntity.proofSignals, ...edits.proofSignals, keyPeople: v } })}
                            placeholder="Add person (e.g., John Smith - CEO)..."
                        />
                    </Section>

                    <Section id="disambiguation" title="Disambiguation Controls" icon="🎯">
                        <ArrayEditor
                            label="Top Competitors"
                            values={edits.disambiguation?.topCompetitors ?? canonicalEntity.disambiguation.topCompetitors ?? []}
                            onChange={(v) => setEdits({ ...edits, disambiguation: { ...canonicalEntity.disambiguation, ...edits.disambiguation, topCompetitors: v } })}
                            placeholder="Add competitor..."
                        />
                        <ArrayEditor
                            label="Negative Keywords (entities to distinguish from)"
                            values={edits.disambiguation?.negativeKeywords ?? canonicalEntity.disambiguation.negativeKeywords ?? []}
                            onChange={(v) => setEdits({ ...edits, disambiguation: { ...canonicalEntity.disambiguation, ...edits.disambiguation, negativeKeywords: v } })}
                            placeholder="Add negative keyword..."
                        />
                    </Section>
                </>
            )}
        </div>
    );
}
