'use client';

import React from 'react';
import { ClientAIProfile, PatternWithExamples } from '@/types';
import HelpInfoIcon, { FIELD_HELP_DEFINITIONS, FieldHelpInfo } from './HelpInfoIcon';

interface ProfileViewModalProps {
  profile: ClientAIProfile;
  onClose: () => void;
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

function PatternSection({ pattern, label, helpKey }: { pattern?: PatternWithExamples; label: string; helpKey?: string }) {
  if (!pattern) return null;
  
  return (
    <div className="border rounded-lg p-3 bg-gray-50">
      <FieldLabel label={label} helpKey={helpKey} />
      <p className="text-xs text-gray-600 mt-1 mb-2">{pattern.description}</p>
      <TagList items={pattern.examples} color="indigo" />
    </div>
  );
}

export default function ProfileViewModal({ profile, onClose }: ProfileViewModalProps) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 bg-indigo-600 text-white shrink-0">
          <div>
            <h2 className="text-lg font-semibold">{profile.clientName} - AI Profile</h2>
            <p className="text-indigo-200 text-xs">Generated: {new Date(profile.generatedAt).toLocaleDateString()}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-indigo-200 text-2xl font-bold leading-none"
          >
            ×
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {profile.meta && (
            <section className="border rounded-lg p-4">
              <SectionHeader title="Profile Metadata" helpKey="meta" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel label="Industry Tag" helpKey="industryType" />
                  <span className="inline-block mt-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                    {profile.meta.industryTag}
                  </span>
                </div>
                <div>
                  <FieldLabel label="Generated At" />
                  <p className="text-sm text-gray-700 mt-1">{new Date(profile.meta.generatedAt).toLocaleString()}</p>
                </div>
                <div className="col-span-2">
                  <FieldLabel label="Summary" helpKey="shortSummary" />
                  <p className="text-sm text-gray-700 mt-1">{profile.meta.summary}</p>
                </div>
              </div>
            </section>
          )}

          {profile.coreIdentity && (
            <section className="border rounded-lg p-4">
              <SectionHeader title="Core Business Identity" helpKey="coreIdentity" />
              <div className="space-y-4">
                <div>
                  <FieldLabel label="Business Model" helpKey="businessModel" />
                  <p className="text-sm text-gray-700 mt-1">{profile.coreIdentity.businessModel}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel label="Primary Offer Types" />
                    <div className="mt-1"><TagList items={profile.coreIdentity.primaryOfferTypes} color="indigo" /></div>
                  </div>
                  <div>
                    <FieldLabel label="Product Lines" helpKey="productLines" />
                    <div className="mt-1"><TagList items={profile.coreIdentity.productLines} color="green" /></div>
                  </div>
                  <div>
                    <FieldLabel label="Services" />
                    <div className="mt-1"><TagList items={profile.coreIdentity.services} color="amber" /></div>
                  </div>
                  <div>
                    <FieldLabel label="Industries Served" />
                    <div className="mt-1"><TagList items={profile.coreIdentity.industriesServed} /></div>
                  </div>
                  <div className="col-span-2">
                    <FieldLabel label="Customer Segments" helpKey="targetCustomerSegments" />
                    <div className="mt-1"><TagList items={profile.coreIdentity.customerSegments} color="indigo" /></div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {profile.domains && (
            <section className="border rounded-lg p-4">
              <SectionHeader title="Domain Classification Hints" helpKey="domains" />
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel label="Primary Domains" />
                    <div className="mt-1"><TagList items={profile.domains.primaryDomains} color="indigo" /></div>
                  </div>
                  <div>
                    <FieldLabel label="Secondary Domains" />
                    <div className="mt-1"><TagList items={profile.domains.secondaryDomains} /></div>
                  </div>
                  <div>
                    <FieldLabel label="Expected TLDs" />
                    <div className="mt-1"><TagList items={profile.domains.expectedTlds} /></div>
                  </div>
                </div>
                <div>
                  <FieldLabel label="Positive Domain Hints (Industry Indicators)" />
                  <div className="mt-1"><TagList items={profile.domains.positiveDomainHints} color="green" /></div>
                </div>
                <div>
                  <FieldLabel label="Negative Domain Hints (Non-Industry Indicators)" />
                  <div className="mt-1"><TagList items={profile.domains.negativeDomainHints} color="red" /></div>
                </div>
              </div>
            </section>
          )}

          {profile.urlClassificationSupport && (
            <section className="border rounded-lg p-4">
              <SectionHeader title="URL Path Classification Patterns" helpKey="urlClassificationSupport" />
              <div className="grid grid-cols-2 gap-3">
                <PatternSection pattern={profile.urlClassificationSupport.productSlugPatterns} label="Product Slugs" />
                <PatternSection pattern={profile.urlClassificationSupport.categorySlugPatterns} label="Category Slugs" />
                <PatternSection pattern={profile.urlClassificationSupport.blogSlugPatterns} label="Blog Slugs" />
                <PatternSection pattern={profile.urlClassificationSupport.resourceSlugPatterns} label="Resource Slugs" />
                <PatternSection pattern={profile.urlClassificationSupport.supportSlugPatterns} label="Support Slugs" />
                <PatternSection pattern={profile.urlClassificationSupport.legalSlugPatterns} label="Legal Slugs" />
                <PatternSection pattern={profile.urlClassificationSupport.accountSlugPatterns} label="Account Slugs" />
                <PatternSection pattern={profile.urlClassificationSupport.careersSlugPatterns} label="Careers Slugs" />
                <PatternSection pattern={profile.urlClassificationSupport.aboutCompanySlugPatterns} label="About Company Slugs" />
                <PatternSection pattern={profile.urlClassificationSupport.marketingLandingPatterns} label="Marketing Landing Slugs" />
              </div>
            </section>
          )}

          {profile.keywordClassificationSupport && (
            <section className="border rounded-lg p-4">
              <SectionHeader title="Keyword Intent Classification Patterns" helpKey="keywordClassificationSupport" />
              <div className="grid grid-cols-2 gap-3">
                <PatternSection pattern={profile.keywordClassificationSupport.brandKeywords} label="Brand Keywords" />
                <PatternSection pattern={profile.keywordClassificationSupport.transactionalPhrases} label="Transactional Phrases" />
                <PatternSection pattern={profile.keywordClassificationSupport.commercialResearchPhrases} label="Commercial Research Phrases" />
                <PatternSection pattern={profile.keywordClassificationSupport.informationalPhrases} label="Informational Phrases" />
                <PatternSection pattern={profile.keywordClassificationSupport.directoryPhrases} label="Directory Phrases" />
                <PatternSection pattern={profile.keywordClassificationSupport.irrelevantKeywordTopics} label="Irrelevant Keyword Topics" />
              </div>
            </section>
          )}

          {profile.businessRelevanceSupport && (
            <section className="border rounded-lg p-4">
              <SectionHeader title="Business Relevance Definitions" helpKey="businessRelevanceSupport" />
              <div className="space-y-3">
                <div className="border-l-4 border-green-500 pl-3">
                  <FieldLabel label="Direct Competitor Definition" />
                  <p className="text-sm text-gray-700 mt-1">{profile.businessRelevanceSupport.directCompetitorDefinition}</p>
                </div>
                <div className="border-l-4 border-blue-500 pl-3">
                  <FieldLabel label="Potential Customer Definition" />
                  <p className="text-sm text-gray-700 mt-1">{profile.businessRelevanceSupport.potentialCustomerDefinition}</p>
                </div>
                <div className="border-l-4 border-amber-500 pl-3">
                  <FieldLabel label="Marketplace Definition" />
                  <p className="text-sm text-gray-700 mt-1">{profile.businessRelevanceSupport.marketplaceDefinition}</p>
                </div>
                <div className="border-l-4 border-gray-400 pl-3">
                  <FieldLabel label="Irrelevant Definition" />
                  <p className="text-sm text-gray-700 mt-1">{profile.businessRelevanceSupport.irrelevantDefinition}</p>
                </div>
              </div>
            </section>
          )}

          <section className="border rounded-lg p-4">
            <SectionHeader title="Core Topics & Themes" helpKey="coreTopics" />
            <div className="space-y-4">
              <div>
                <FieldLabel label="Core Topics (Primary Focus)" helpKey="coreTopics" />
                <div className="mt-1"><TagList items={profile.coreTopics} color="green" /></div>
              </div>
              <div>
                <FieldLabel label="Adjacent Topics (Related but Secondary)" helpKey="adjacentTopics" />
                <div className="mt-1"><TagList items={profile.adjacentTopics} color="amber" /></div>
              </div>
              <div>
                <FieldLabel label="Negative Topics (Exclude These)" helpKey="negativeTopics" />
                <div className="mt-1"><TagList items={profile.negativeTopics} color="red" /></div>
              </div>
            </div>
          </section>

          <section className="border rounded-lg p-4">
            <SectionHeader title="Domain Type Patterns" helpKey="domainTypePatterns" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel label="OEM/Manufacturer Indicators" />
                <div className="mt-1"><TagList items={profile.domainTypePatterns.oemManufacturerIndicators} color="indigo" /></div>
              </div>
              <div>
                <FieldLabel label="Service Provider Indicators" />
                <div className="mt-1"><TagList items={profile.domainTypePatterns.serviceProviderIndicators} color="green" /></div>
              </div>
              <div>
                <FieldLabel label="Marketplace Indicators" />
                <div className="mt-1"><TagList items={profile.domainTypePatterns.marketplaceIndicators} color="amber" /></div>
              </div>
              <div>
                <FieldLabel label="End Customer Indicators" />
                <div className="mt-1"><TagList items={profile.domainTypePatterns.endCustomerIndicators} /></div>
              </div>
              <div className="col-span-2">
                <FieldLabel label="Educational/Media Indicators" />
                <div className="mt-1"><TagList items={profile.domainTypePatterns.educationalMediaIndicators} /></div>
              </div>
            </div>
          </section>

          <section className="border rounded-lg p-4">
            <SectionHeader title="Classification Intent Hints" helpKey="classificationIntentHints" />
            <div className="grid grid-cols-3 gap-4">
              <div>
                <FieldLabel label="Transactional Keywords" />
                <div className="mt-1"><TagList items={profile.classificationIntentHints.transactionalKeywords} color="green" /></div>
              </div>
              <div>
                <FieldLabel label="Informational Keywords" />
                <div className="mt-1"><TagList items={profile.classificationIntentHints.informationalKeywords} color="indigo" /></div>
              </div>
              <div>
                <FieldLabel label="Directory Keywords" />
                <div className="mt-1"><TagList items={profile.classificationIntentHints.directoryKeywords} color="amber" /></div>
              </div>
            </div>
          </section>

          <section className="border rounded-lg p-4">
            <SectionHeader title="Business Relevance Logic Notes" helpKey="businessRelevanceLogicNotes" />
            <div className="space-y-3">
              <div className="border-l-4 border-red-500 pl-3">
                <FieldLabel label="Direct Competitor" />
                <p className="text-sm text-gray-700 mt-1">{profile.businessRelevanceLogicNotes.directCompetitorDefinition}</p>
              </div>
              <div className="border-l-4 border-blue-500 pl-3">
                <FieldLabel label="Potential Customer" />
                <p className="text-sm text-gray-700 mt-1">{profile.businessRelevanceLogicNotes.potentialCustomerDefinition}</p>
              </div>
              <div className="border-l-4 border-amber-500 pl-3">
                <FieldLabel label="Marketplace/Channel" />
                <p className="text-sm text-gray-700 mt-1">{profile.businessRelevanceLogicNotes.marketplaceChannelDefinition}</p>
              </div>
              <div className="border-l-4 border-gray-400 pl-3">
                <FieldLabel label="Irrelevant" />
                <p className="text-sm text-gray-700 mt-1">{profile.businessRelevanceLogicNotes.irrelevantDefinition}</p>
              </div>
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
                <div className="mt-1"><TagList items={profile.primaryDomains} color="indigo" /></div>
              </div>
              <div>
                <FieldLabel label="Domains Used for Generation" />
                <div className="mt-1"><TagList items={profile.domainsUsedForGeneration} /></div>
              </div>
              <div>
                <FieldLabel label="Target Geographies" />
                <div className="mt-1"><TagList items={profile.targetGeographies} /></div>
              </div>
            </div>
          </section>
        </div>
        
        <div className="px-6 py-4 bg-gray-50 border-t shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
