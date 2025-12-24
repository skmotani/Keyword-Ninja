'use client';

import React, { useState, useEffect } from 'react';
import { ClientAIProfile, PatternWithExamples, ProfileCoreIdentity, ProfileDomains, ProfileUrlClassificationSupport, ProfileKeywordClassificationSupport, ProfileBusinessRelevanceSupport, DomainTypePatterns, ClassificationIntentHints, BusinessRelevanceLogicNotes } from '@/types';
import HelpInfoIcon, { FIELD_HELP_DEFINITIONS } from './HelpInfoIcon';

interface ProfileViewModalProps {
  profile: ClientAIProfile;
  onClose: () => void;
  onProfileUpdated?: (updatedProfile: ClientAIProfile) => void;
}

function SectionHeader({ title, helpKey }: { title: string; helpKey?: string }) {
  return (
    <div className="flex items-center gap-1 mb-3">
      <h3 className="text-base font-semibold text-gray-800">{title}</h3>
      {helpKey && FIELD_HELP_DEFINITIONS[helpKey] && (
        <HelpInfoIcon helpInfo={FIELD_HELP_DEFINITIONS[helpKey]} />
      )}
    </div>
  );
}

function FieldLabel({ label, helpKey }: { label: string; helpKey?: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      {helpKey && FIELD_HELP_DEFINITIONS[helpKey] && (
        <HelpInfoIcon helpInfo={FIELD_HELP_DEFINITIONS[helpKey]} className="w-3 h-3 text-[8px]" />
      )}
    </div>
  );
}

function TagList({ items, color = 'gray' }: { items: string[]; color?: 'gray' | 'indigo' | 'green' | 'amber' | 'red' }) {
  if (!items || items.length === 0) return <span className="text-xs text-gray-400 italic">Not specified</span>;

  const colorClasses = {
    gray: 'bg-gray-100 text-gray-700',
    indigo: 'bg-indigo-100 text-indigo-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
  };

  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item, idx) => (
        <span key={idx} className={`px-2 py-0.5 rounded text-xs ${colorClasses[color]}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function TagEditor({
  value,
  onChange
}: {
  value: string[];
  onChange: (newValue: string[]) => void
}) {
  const [text, setText] = useState(value ? value.join(', ') : '');

  useEffect(() => {
    setText(value ? value.join(', ') : '');
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const items = e.target.value
      .split(/[,\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    onChange(items);
  };

  return (
    <textarea
      className="w-full text-xs p-2 border rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
      rows={3}
      value={text}
      onChange={handleChange}
      placeholder="Separate items with commas"
    />
  );
}

function PatternSection({
  pattern,
  label,
  helpKey,
  isEditing,
  onUpdate
}: {
  pattern?: PatternWithExamples;
  label: string;
  helpKey?: string;
  isEditing?: boolean;
  onUpdate?: (newPattern: PatternWithExamples) => void;
}) {
  const currentPattern = pattern || { description: '', examples: [] };

  if (isEditing && onUpdate) {
    return (
      <div className="border rounded-lg p-3 bg-white border-indigo-200 shadow-sm">
        <FieldLabel label={label} helpKey={helpKey} />
        <div className="mt-2 space-y-2">
          <div>
            <label className="text-[10px] text-gray-500 uppercase font-semibold">Description</label>
            <textarea
              className="w-full text-xs p-2 border rounded focus:outline-none focus:border-indigo-500"
              rows={2}
              value={currentPattern.description}
              onChange={e => onUpdate({ ...currentPattern, description: e.target.value })}
              placeholder="Description pattern..."
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase font-semibold">Examples</label>
            <TagEditor
              value={currentPattern.examples}
              onChange={ex => onUpdate({ ...currentPattern, examples: ex })}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!pattern) return null;

  return (
    <div className="border rounded-lg p-3 bg-gray-50">
      <FieldLabel label={label} helpKey={helpKey} />
      <p className="text-xs text-gray-600 mt-1 mb-2">{pattern.description}</p>
      <TagList items={pattern.examples} color="indigo" />
    </div>
  );
}

function TextAreaEditor({ value, onChange, rows = 3 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea
      className="w-full text-sm p-2 border rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none"
      rows={rows}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  );
}

function InputEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      className="w-full text-sm p-2 border rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none"
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  );
}

export default function ProfileViewModal({ profile, onClose, onProfileUpdated }: ProfileViewModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editProfile, setEditProfile] = useState<ClientAIProfile>(profile);
  const [isSaving, setIsSaving] = useState(false);

  // Reset edit profile when prop changes
  useEffect(() => {
    setEditProfile(profile);
  }, [profile]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/client-ai-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editProfile)
      });

      if (res.ok) {
        if (onProfileUpdated) onProfileUpdated(editProfile);
        setIsEditing(false);
        // Optionally show success message
      } else {
        alert('Failed to save profile changes. Please try again.');
      }
    } catch (e) {
      console.error(e);
      alert('An error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditProfile(profile);
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 bg-indigo-600 text-white shrink-0">
          <div>
            <h2 className="text-lg font-semibold">{profile.clientName} - AI Profile</h2>
            <p className="text-indigo-200 text-xs">Generated: {new Date(profile.generatedAt).toLocaleDateString()}</p>
          </div>
          <div className="flex items-center gap-3">
            {!isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium rounded transition-colors"
                >
                  Edit Profile
                </button>
                <button
                  onClick={onClose}
                  className="text-white hover:text-indigo-200 text-2xl font-bold leading-none"
                >
                  ×
                </button>
              </>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-1 bg-green-500 hover:bg-green-400 text-white text-sm font-medium rounded transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {isEditing && (
          <div className="bg-amber-50 border-b border-amber-100 px-6 py-3 text-amber-800 text-sm flex items-start gap-2">
            <span className="text-lg leading-none">⚠️</span>
            <p><strong>Note:</strong> You are in editing mode. Any manual changes you make here will be overwritten if you choose to "Regenerate AI Profile" in the future.</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {profile.meta && (
            <section className={`border rounded-lg p-4 ${isEditing ? 'border-dashed border-indigo-300 bg-indigo-50/30' : ''}`}>
              <SectionHeader title="Profile Metadata" helpKey="meta" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel label="Industry Tag" helpKey="industryType" />
                  {isEditing ? (
                    <div className="mt-1">
                      <InputEditor
                        value={editProfile.meta?.industryTag || ''}
                        onChange={v => setEditProfile(prev => ({ ...prev, meta: { ...prev.meta!, industryTag: v } }))}
                      />
                    </div>
                  ) : (
                    <span className="inline-block mt-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                      {profile.meta.industryTag}
                    </span>
                  )}
                </div>
                <div>
                  <FieldLabel label="Generated At" />
                  <p className="text-sm text-gray-700 mt-1">{new Date(profile.meta.generatedAt).toLocaleString()}</p>
                </div>
                <div className="col-span-2">
                  <FieldLabel label="Summary" helpKey="shortSummary" />
                  {isEditing ? (
                    <div className="mt-1">
                      <TextAreaEditor
                        value={editProfile.meta?.summary || ''}
                        onChange={v => setEditProfile(prev => ({ ...prev, meta: { ...prev.meta!, summary: v } }))}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 mt-1">{profile.meta.summary}</p>
                  )}
                </div>
              </div>
            </section>
          )}

          {profile.coreIdentity && (
            <section className={`border rounded-lg p-4 ${isEditing ? 'border-dashed border-indigo-300 bg-indigo-50/30' : ''}`}>
              <SectionHeader title="Core Business Identity" helpKey="coreIdentity" />
              <div className="space-y-4">
                <div>
                  <FieldLabel label="Business Model" helpKey="businessModel" />
                  {isEditing ? (
                    <div className="mt-1">
                      <InputEditor
                        value={editProfile.coreIdentity?.businessModel || ''}
                        onChange={v => setEditProfile(prev => ({ ...prev, coreIdentity: { ...prev.coreIdentity!, businessModel: v } }))}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 mt-1">{profile.coreIdentity.businessModel}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Primary Offer Types', key: 'primaryOfferTypes', color: 'indigo' },
                    { label: 'Product Lines', key: 'productLines', color: 'green', helpKey: 'productLines' },
                    { label: 'Services', key: 'services', color: 'amber' },
                    { label: 'Industries Served', key: 'industriesServed', color: 'gray' },
                    { label: 'Customer Segments', key: 'customerSegments', color: 'indigo', helpKey: 'targetCustomerSegments', fullWidth: true }
                  ].map((field) => (
                    <div key={field.key} className={field.fullWidth ? 'col-span-2' : ''}>
                      <FieldLabel label={field.label} helpKey={field.helpKey} />
                      <div className="mt-1">
                        {isEditing ? (
                          <TagEditor
                            value={editProfile.coreIdentity?.[field.key as keyof ProfileCoreIdentity] as string[] || []}
                            onChange={v => setEditProfile(prev => ({ ...prev, coreIdentity: { ...prev.coreIdentity!, [field.key]: v } }))}
                          />
                        ) : (
                          <TagList items={profile.coreIdentity?.[field.key as keyof ProfileCoreIdentity] as string[] || []} color={field.color as any} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {profile.domains && (
            <section className={`border rounded-lg p-4 ${isEditing ? 'border-dashed border-indigo-300 bg-indigo-50/30' : ''}`}>
              <SectionHeader title="Domain Classification Hints" helpKey="domains" />
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Primary Domains', key: 'primaryDomains', color: 'indigo' },
                    { label: 'Secondary Domains', key: 'secondaryDomains', color: 'gray' },
                    { label: 'Expected TLDs', key: 'expectedTlds', color: 'gray' }
                  ].map(field => (
                    <div key={field.key}>
                      <FieldLabel label={field.label} />
                      <div className="mt-1">
                        {isEditing ? (
                          <TagEditor
                            value={editProfile.domains?.[field.key as keyof ProfileDomains] as string[] || []}
                            onChange={v => setEditProfile(prev => ({ ...prev, domains: { ...prev.domains!, [field.key]: v } }))}
                          />
                        ) : (
                          <TagList items={profile.domains?.[field.key as keyof ProfileDomains] as string[] || []} color={field.color as any} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {[
                  { label: 'Positive Domain Hints (Industry Indicators)', key: 'positiveDomainHints', color: 'green' },
                  { label: 'Negative Domain Hints (Non-Industry Indicators)', key: 'negativeDomainHints', color: 'red' }
                ].map(field => (
                  <div key={field.key}>
                    <FieldLabel label={field.label} />
                    <div className="mt-1">
                      {isEditing ? (
                        <TagEditor
                          value={editProfile.domains?.[field.key as keyof ProfileDomains] as string[] || []}
                          onChange={v => setEditProfile(prev => ({ ...prev, domains: { ...prev.domains!, [field.key]: v } }))}
                        />
                      ) : (
                        <TagList items={profile.domains?.[field.key as keyof ProfileDomains] as string[] || []} color={field.color as any} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {profile.urlClassificationSupport && (
            <section className={`border rounded-lg p-4 ${isEditing ? 'border-dashed border-indigo-300 bg-indigo-50/30' : ''}`}>
              <SectionHeader title="URL Path Classification Patterns" helpKey="urlClassificationSupport" />
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'productSlugPatterns', label: 'Product Slugs' },
                  { key: 'categorySlugPatterns', label: 'Category Slugs' },
                  { key: 'blogSlugPatterns', label: 'Blog Slugs' },
                  { key: 'resourceSlugPatterns', label: 'Resource Slugs' },
                  { key: 'supportSlugPatterns', label: 'Support Slugs' },
                  { key: 'legalSlugPatterns', label: 'Legal Slugs' },
                  { key: 'accountSlugPatterns', label: 'Account Slugs' },
                  { key: 'careersSlugPatterns', label: 'Careers Slugs' },
                  { key: 'aboutCompanySlugPatterns', label: 'About Company Slugs' },
                  { key: 'marketingLandingPatterns', label: 'Marketing Landing Slugs' }
                ].map(item => (
                  <PatternSection
                    key={item.key}
                    pattern={editProfile.urlClassificationSupport?.[item.key as keyof ProfileUrlClassificationSupport]}
                    label={item.label}
                    isEditing={isEditing}
                    onUpdate={newPattern => setEditProfile(prev => ({
                      ...prev,
                      urlClassificationSupport: {
                        ...prev.urlClassificationSupport!,
                        [item.key]: newPattern
                      }
                    }))}
                  />
                ))}
              </div>
            </section>
          )}

          {profile.keywordClassificationSupport && (
            <section className={`border rounded-lg p-4 ${isEditing ? 'border-dashed border-indigo-300 bg-indigo-50/30' : ''}`}>
              <SectionHeader title="Keyword Intent Classification Patterns" helpKey="keywordClassificationSupport" />
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'brandKeywords', label: 'Brand Keywords' },
                  { key: 'transactionalPhrases', label: 'Transactional Phrases' },
                  { key: 'commercialResearchPhrases', label: 'Commercial Research Phrases' },
                  { key: 'informationalPhrases', label: 'Informational Phrases' },
                  { key: 'directoryPhrases', label: 'Directory Phrases' },
                  { key: 'irrelevantKeywordTopics', label: 'Irrelevant Keyword Topics' }
                ].map(item => (
                  <PatternSection
                    key={item.key}
                    pattern={editProfile.keywordClassificationSupport?.[item.key as keyof ProfileKeywordClassificationSupport]}
                    label={item.label}
                    isEditing={isEditing}
                    onUpdate={newPattern => setEditProfile(prev => ({
                      ...prev,
                      keywordClassificationSupport: {
                        ...prev.keywordClassificationSupport!,
                        [item.key]: newPattern
                      }
                    }))}
                  />
                ))}
              </div>
            </section>
          )}

          {profile.businessRelevanceSupport && (
            <section className={`border rounded-lg p-4 ${isEditing ? 'border-dashed border-indigo-300 bg-indigo-50/30' : ''}`}>
              <SectionHeader title="Business Relevance Definitions" helpKey="businessRelevanceSupport" />
              <div className="space-y-3">
                {[
                  { key: 'directCompetitorDefinition', label: 'Direct Competitor Definition', color: 'green' },
                  { key: 'potentialCustomerDefinition', label: 'Potential Customer Definition', color: 'blue' },
                  { key: 'marketplaceDefinition', label: 'Marketplace Definition', color: 'amber' },
                  { key: 'irrelevantDefinition', label: 'Irrelevant Definition', color: 'gray' },
                ].map(item => (
                  <div key={item.key} className={`border-l-4 border-${item.color}-500 pl-3`}>
                    <FieldLabel label={item.label} />
                    {isEditing ? (
                      <div className="mt-1">
                        <TextAreaEditor
                          value={editProfile.businessRelevanceSupport?.[item.key as keyof ProfileBusinessRelevanceSupport] as string || ''}
                          onChange={v => setEditProfile(prev => ({ ...prev, businessRelevanceSupport: { ...prev.businessRelevanceSupport!, [item.key]: v } }))}
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-gray-700 mt-1">{profile.businessRelevanceSupport?.[item.key as keyof ProfileBusinessRelevanceSupport]}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className={`border rounded-lg p-4 ${isEditing ? 'border-dashed border-indigo-300 bg-indigo-50/30' : ''}`}>
            <SectionHeader title="Core Topics & Themes" helpKey="coreTopics" />
            <div className="space-y-4">
              {[
                { key: 'coreTopics', label: 'Core Topics (Primary Focus)', helpKey: 'coreTopics', color: 'green' },
                { key: 'adjacentTopics', label: 'Adjacent Topics (Related but Secondary)', helpKey: 'adjacentTopics', color: 'amber' },
                { key: 'negativeTopics', label: 'Negative Topics (Exclude These)', helpKey: 'negativeTopics', color: 'red' },
              ].map(item => (
                <div key={item.key}>
                  <FieldLabel label={item.label} helpKey={item.helpKey} />
                  <div className="mt-1">
                    {isEditing ? (
                      <TagEditor
                        value={editProfile[item.key as 'coreTopics' | 'adjacentTopics' | 'negativeTopics'] || []}
                        onChange={v => setEditProfile(prev => ({ ...prev, [item.key]: v }))}
                      />
                    ) : (
                      <TagList items={profile[item.key as 'coreTopics' | 'adjacentTopics' | 'negativeTopics'] || []} color={item.color as any} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={`border rounded-lg p-4 ${isEditing ? 'border-dashed border-indigo-300 bg-indigo-50/30' : ''}`}>
            <SectionHeader title="Domain Type Patterns" helpKey="domainTypePatterns" />
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'oemManufacturerIndicators', label: 'OEM/Manufacturer Indicators', color: 'indigo' },
                { key: 'serviceProviderIndicators', label: 'Service Provider Indicators', color: 'green' },
                { key: 'marketplaceIndicators', label: 'Marketplace Indicators', color: 'amber' },
                { key: 'endCustomerIndicators', label: 'End Customer Indicators', color: 'gray' },
                { key: 'educationalMediaIndicators', label: 'Educational/Media Indicators', color: 'gray', fullWidth: true },
              ].map(item => (
                <div key={item.key} className={item.fullWidth ? 'col-span-2' : ''}>
                  <FieldLabel label={item.label} />
                  <div className="mt-1">
                    {isEditing ? (
                      <TagEditor
                        value={editProfile.domainTypePatterns?.[item.key as keyof DomainTypePatterns] || []}
                        onChange={v => setEditProfile(prev => ({ ...prev, domainTypePatterns: { ...prev.domainTypePatterns!, [item.key]: v } }))}
                      />
                    ) : (
                      <TagList items={profile.domainTypePatterns?.[item.key as keyof DomainTypePatterns] || []} color={item.color as any} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={`border rounded-lg p-4 ${isEditing ? 'border-dashed border-indigo-300 bg-indigo-50/30' : ''}`}>
            <SectionHeader title="Classification Intent Hints" helpKey="classificationIntentHints" />
            <div className="grid grid-cols-3 gap-4">
              {[
                { key: 'transactionalKeywords', label: 'Transactional Keywords', color: 'green' },
                { key: 'informationalKeywords', label: 'Informational Keywords', color: 'indigo' },
                { key: 'directoryKeywords', label: 'Directory Keywords', color: 'amber' },
              ].map(item => (
                <div key={item.key}>
                  <FieldLabel label={item.label} />
                  <div className="mt-1">
                    {isEditing ? (
                      <TagEditor
                        value={editProfile.classificationIntentHints?.[item.key as keyof ClassificationIntentHints] || []}
                        onChange={v => setEditProfile(prev => ({ ...prev, classificationIntentHints: { ...prev.classificationIntentHints!, [item.key]: v } }))}
                      />
                    ) : (
                      <TagList items={profile.classificationIntentHints?.[item.key as keyof ClassificationIntentHints] || []} color={item.color as any} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={`border rounded-lg p-4 ${isEditing ? 'border-dashed border-indigo-300 bg-indigo-50/30' : ''}`}>
            <SectionHeader title="Business Relevance Logic Notes" helpKey="businessRelevanceLogicNotes" />
            <div className="space-y-3">
              {[
                { key: 'directCompetitorDefinition', label: 'Direct Competitor', color: 'red' },
                { key: 'potentialCustomerDefinition', label: 'Potential Customer', color: 'blue' },
                { key: 'marketplaceChannelDefinition', label: 'Marketplace/Channel', color: 'amber' },
                { key: 'irrelevantDefinition', label: 'Irrelevant', color: 'gray' },
              ].map(item => (
                <div key={item.key} className={`border-l-4 border-${item.color}-500 pl-3`}>
                  <FieldLabel label={item.label} />
                  {isEditing ? (
                    <div className="mt-1">
                      <TextAreaEditor
                        value={editProfile.businessRelevanceLogicNotes?.[item.key as keyof BusinessRelevanceLogicNotes] || ''}
                        onChange={v => setEditProfile(prev => ({ ...prev, businessRelevanceLogicNotes: { ...prev.businessRelevanceLogicNotes!, [item.key]: v } }))}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 mt-1">{profile.businessRelevanceLogicNotes?.[item.key as keyof BusinessRelevanceLogicNotes]}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-base font-semibold text-gray-800 mb-3">Additional Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel label="Client Code" />
                <p className="text-sm text-gray-700 mt-1 font-mono">{profile.clientCode}</p>
              </div>
              <div>
                <FieldLabel label="Last Updated" />
                <p className="text-sm text-gray-700 mt-1">{new Date(profile.updatedAt).toLocaleString()}</p>
              </div>
              <div>
                <FieldLabel label="Primary Domains" />
                {isEditing ? (
                  <div className="mt-1">
                    <TagEditor
                      value={editProfile.primaryDomains || []}
                      onChange={v => setEditProfile(prev => ({ ...prev, primaryDomains: v }))}
                    />
                  </div>
                ) : (
                  <div className="mt-1"><TagList items={profile.primaryDomains} color="indigo" /></div>
                )}
              </div>
              <div>
                <FieldLabel label="Domains Used for Generation" />
                <div className="mt-1"><TagList items={profile.domainsUsedForGeneration} /></div>
              </div>
              <div>
                <FieldLabel label="Target Geographies" />
                {isEditing ? (
                  <div className="mt-1">
                    <TagEditor
                      value={editProfile.targetGeographies || []}
                      onChange={v => setEditProfile(prev => ({ ...prev, targetGeographies: v }))}
                    />
                  </div>
                ) : (
                  <div className="mt-1"><TagList items={profile.targetGeographies} /></div>
                )}
              </div>
            </div>
          </section>
        </div>

        {!isEditing && (
          <div className="px-6 py-4 bg-gray-50 border-t shrink-0">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
