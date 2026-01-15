'use client';

import React, { useState } from 'react';

export interface FieldHelpInfo {
  title: string;
  description: string;
  whyWeAddedThis: string;
  examples: string[];
  nuances?: string;
  useCases?: string[];
}

interface HelpInfoIconProps {
  helpInfo: FieldHelpInfo;
  className?: string;
}

export default function HelpInfoIcon({ helpInfo, className = '' }: HelpInfoIconProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center justify-center w-4 h-4 ml-1 text-[10px] font-bold rounded-full bg-gray-200 text-gray-600 hover:bg-indigo-100 hover:text-indigo-700 transition-colors cursor-help ${className}`}
        title="Click for more information"
      >
        ?
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white">
              <h3 className="font-semibold text-sm">{helpInfo.title}</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:text-indigo-200 text-xl font-bold leading-none"
              >
                ×
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[60vh] text-sm space-y-4">
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">Description</h4>
                <p className="text-gray-600">{helpInfo.description}</p>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                <h4 className="font-semibold text-indigo-800 mb-1">Why We Added This</h4>
                <p className="text-indigo-700 text-xs">{helpInfo.whyWeAddedThis}</p>
              </div>

              {helpInfo.examples.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-800 mb-1">Examples</h4>
                  <ul className="list-disc list-inside text-gray-600 text-xs space-y-1">
                    {helpInfo.examples.map((example, idx) => (
                      <li key={idx}>{example}</li>
                    ))}
                  </ul>
                </div>
              )}

              {helpInfo.nuances && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <h4 className="font-semibold text-amber-800 mb-1">Nuances</h4>
                  <p className="text-amber-700 text-xs">{helpInfo.nuances}</p>
                </div>
              )}

              {helpInfo.useCases && helpInfo.useCases.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-800 mb-1">Use Cases</h4>
                  <ul className="list-disc list-inside text-gray-600 text-xs space-y-1">
                    {helpInfo.useCases.map((useCase, idx) => (
                      <li key={idx}>{useCase}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="px-4 py-3 bg-gray-50 border-t">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export const FIELD_HELP_DEFINITIONS: Record<string, FieldHelpInfo> = {
  meta: {
    title: 'Profile Metadata',
    description: 'Basic identification information about the client profile including when it was generated and the industry classification.',
    whyWeAddedThis: 'The meta section provides quick context about the profile itself - when it was generated and what industry this client belongs to. This helps you quickly understand if the profile is current and relevant.',
    examples: [
      'industryTag: "textile_machinery_oem" for a textile equipment manufacturer',
      'industryTag: "online_education" for an e-learning platform',
      'summary: "B2B manufacturer of yarn twisting machinery serving global textile mills"'
    ],
    nuances: 'The industryTag uses snake_case for machine-readability. The summary should be 2-3 sentences that a human can quickly scan.',
    useCases: [
      'Quickly identify which industry this client operates in',
      'Check when the profile was last generated to assess freshness',
      'Get a quick overview without reading the entire profile'
    ]
  },

  coreIdentity: {
    title: 'Core Business Identity',
    description: 'Defines the fundamental aspects of the client\'s business including their business model, what they sell, and who they sell to.',
    whyWeAddedThis: 'Understanding the core identity helps classification systems distinguish between different types of businesses. For example, knowing if a client is a manufacturer vs. a service provider changes how we classify competing domains.',
    examples: [
      'primaryOfferTypes: ["machines", "equipment", "spare_parts"] for a machinery OEM',
      'customerSegments: ["textile_mills", "yarn_manufacturers", "fabric_producers"]',
      'industriesServed: ["textile", "synthetic_fiber", "technical_textiles"]'
    ],
    nuances: 'productLines and services are separate because some businesses offer both physical products AND services (like training or maintenance). This distinction matters for keyword classification.',
    useCases: [
      'Determine if a competing domain sells similar products',
      'Classify keywords as relevant or irrelevant based on product match',
      'Identify potential customer domains vs competitor domains'
    ]
  },

  domains: {
    title: 'Domain Classification Hints',
    description: 'Contains patterns and indicators that help identify whether an external domain is relevant to this client\'s industry.',
    whyWeAddedThis: 'When analyzing SERP results, we encounter hundreds of domains. This section provides client-specific hints to quickly filter relevant domains from irrelevant ones without manual review.',
    examples: [
      'positiveDomainHints: ["textile", "yarn", "fiber", "weaving", "spinning"] indicate industry relevance',
      'negativeDomainHints: ["movie", "music", "game", "crypto", "fashion-blog"] indicate irrelevance',
      'expectedTlds: [".com", ".in", ".de"] are common TLDs for this industry'
    ],
    nuances: 'Domain hints are lowercase fragments that can appear anywhere in a domain name. A domain matching positive hints is NOT automatically a competitor - it just means it\'s worth analyzing further.',
    useCases: [
      'Filter SERP results to show only industry-relevant domains',
      'Prioritize domains for deeper classification',
      'Quickly identify obviously irrelevant domains to skip'
    ]
  },

  urlClassificationSupport: {
    title: 'URL Path Classification Patterns',
    description: 'Client-specific URL slug patterns that help classify pages by their type (product page, blog, support, etc.) without hardcoding logic.',
    whyWeAddedThis: 'Different industries use different URL structures. A textile machinery company might use "/twister-machines" for products, while a software company uses "/features". This section makes page classification adaptable per client.',
    examples: [
      'productSlugPatterns.examples: ["twister", "winder", "heat-setting", "tfo-machine"]',
      'blogSlugPatterns.examples: ["news", "blog", "article", "insights", "updates"]',
      'supportSlugPatterns.examples: ["contact", "support", "help", "faq", "service-center"]'
    ],
    nuances: 'These are slug FRAGMENTS, not exact matches. "twister" would match "/yarn-twister-machine" or "/twister-500-series". The classification system uses these as hints alongside other signals.',
    useCases: [
      'Automatically classify competitor pages as product pages, blogs, etc.',
      'Identify which competitor pages are SEO-relevant for targeting',
      'Filter out non-SEO pages like login, legal, or account pages'
    ]
  },

  keywordClassificationSupport: {
    title: 'Keyword Intent Classification Patterns',
    description: 'Phrases and patterns that help determine the search intent behind keywords, specific to this client\'s domain.',
    whyWeAddedThis: 'Generic keyword intent classifiers don\'t understand industry context. "Twister" might be transactional for a machinery company but informational if someone is asking about the tornado. This section provides industry-specific intent signals.',
    examples: [
      'transactionalPhrases.examples: ["buy", "price", "cost", "quotation", "supplier", "manufacturer"]',
      'informationalPhrases.examples: ["how to", "what is", "guide", "process", "working principle"]',
      'directoryPhrases.examples: ["manufacturers in", "suppliers near", "list of", "directory"]'
    ],
    nuances: 'brandKeywords should include variations and misspellings of the client\'s brand. irrelevantKeywordTopics captures words that share terms with the industry but are wrong context (like "twister movie" for a machinery company).',
    useCases: [
      'Classify keywords by commercial intent for prioritization',
      'Identify branded keyword opportunities',
      'Filter out irrelevant keywords that share terminology'
    ]
  },

  businessRelevanceSupport: {
    title: 'Business Relevance Definitions',
    description: 'Natural language definitions that describe how to categorize domains and businesses relative to this client.',
    whyWeAddedThis: 'What counts as a "competitor" or "customer" varies by business model. For a machinery OEM, textile mills are customers, not competitors. These definitions help AI and humans consistently classify business relationships.',
    examples: [
      'directCompetitorDefinition: "Companies that manufacture and sell similar textile machinery products, competing for the same buyer organizations"',
      'potentialCustomerDefinition: "Textile mills, yarn manufacturers, or fabric producers who might purchase machinery"',
      'irrelevantDefinition: "Entertainment, unrelated manufacturing industries, or consumer goods companies"'
    ],
    nuances: 'These definitions are used both for automated AI classification AND as guidance for manual review. They should be specific enough to be actionable but broad enough to cover edge cases.',
    useCases: [
      'Guide AI domain classification decisions',
      'Provide consistent criteria for manual domain review',
      'Train team members on what makes a domain relevant'
    ]
  },

  industryType: {
    title: 'Industry Type Tag',
    description: 'A short, machine-friendly tag that identifies the client\'s primary industry sector.',
    whyWeAddedThis: 'Having a standardized industry tag allows for quick filtering and grouping of clients. It also helps when generating reports across multiple clients in similar industries.',
    examples: [
      '"textile_machinery_oem" for a textile equipment manufacturer',
      '"online_education" for an e-learning platform',
      '"saas_crm" for a CRM software company',
      '"industrial_automation" for factory automation systems'
    ],
    nuances: 'Use snake_case format. Be specific enough to be meaningful but not so specific that each client has a unique tag. The goal is to enable grouping of similar clients.',
    useCases: [
      'Filter clients by industry in multi-client dashboards',
      'Apply industry-specific classification rules',
      'Generate industry benchmark reports'
    ]
  },

  shortSummary: {
    title: 'Business Summary',
    description: 'A 2-3 sentence human-readable explanation of what this client does and for whom.',
    whyWeAddedThis: 'The summary provides quick context without reading the entire profile. It\'s especially useful for team members who need to understand a client they haven\'t worked with before.',
    examples: [
      '"Meera Industries is a B2B OEM manufacturer of textile machinery, specializing in yarn twisting and winding equipment. They serve textile mills and yarn producers globally, with a focus on the Indian and European markets."'
    ],
    nuances: 'Keep it factual and concise. Avoid marketing language. Focus on: what they make/do, who they sell to, and any geographic focus.',
    useCases: [
      'Quick orientation for team members new to a client',
      'Context for AI classification prompts',
      'Report headers and client overviews'
    ]
  },

  businessModel: {
    title: 'Business Model Description',
    description: 'Describes how the client operates and generates revenue.',
    whyWeAddedThis: 'The business model affects how we interpret competitors and customers. A B2B manufacturer has different competitive dynamics than a B2C retailer or a marketplace.',
    examples: [
      '"B2B OEM textile machinery manufacturer and exporter"',
      '"Freemium SaaS platform with enterprise tier"',
      '"Educational content platform with subscription model"'
    ],
    nuances: 'Include key distinctions like B2B vs B2C, OEM vs reseller, subscription vs one-time purchase. These affect classification logic.',
    useCases: [
      'Determine what type of domains are customers vs competitors',
      'Adjust relevance scoring based on business model fit',
      'Customize classification rules for different business types'
    ]
  },

  productLines: {
    title: 'Product Lines',
    description: 'Major product families or categories that the client offers.',
    whyWeAddedThis: 'Knowing the specific products helps match keywords and competitor pages to the client\'s offerings. It\'s more specific than industry type and enables precise relevance scoring.',
    examples: [
      '["Yarn Twisting Machines", "Winding Machines", "Heat-Setting Equipment", "Cabling Machines"]',
      '["Online Courses", "Live Webinars", "Certification Programs"]',
      '["CRM Software", "Marketing Automation", "Sales Analytics"]'
    ],
    nuances: 'Use the client\'s actual product terminology, not generic terms. These strings may be used for fuzzy matching against keyword and page content.',
    useCases: [
      'Match keywords to specific product lines',
      'Identify competitor pages selling similar products',
      'Calculate product match scores for domains'
    ]
  },

  targetCustomerSegments: {
    title: 'Target Customer Segments',
    description: 'Types of customers or buyer organizations that the client sells to.',
    whyWeAddedThis: 'Understanding who buys from the client helps identify domains that are potential customers rather than competitors. In B2B, buyer organizations often appear in SERP results.',
    examples: [
      '["Textile Mills", "Yarn Manufacturers", "Fabric Producers", "Technical Textile Companies"]',
      '["Students", "Working Professionals", "Corporate Training Departments"]',
      '["Small Businesses", "Enterprise Sales Teams", "Marketing Agencies"]'
    ],
    nuances: 'These should be organization types or buyer personas, not individual job titles. Focus on who makes purchasing decisions.',
    useCases: [
      'Classify domains as potential customers/leads',
      'Identify content opportunities targeting buyer segments',
      'Exclude customer domains from competitor analysis'
    ]
  },

  coreTopics: {
    title: 'Core Topics',
    description: 'Primary topics and themes that are directly relevant to the client\'s business.',
    whyWeAddedThis: 'Core topics define what content is ON-topic for this client. Keywords and pages matching core topics are considered highly relevant.',
    examples: [
      '["yarn twisting", "textile machinery", "winding technology", "filament processing"]',
      '["chemistry education", "NEET preparation", "JEE coaching", "organic chemistry"]'
    ],
    nuances: 'Keep topics at a conceptual level, not specific keywords. These are themes that encompass many related keywords.',
    useCases: [
      'Score keyword relevance to client business',
      'Identify content gaps in core topic areas',
      'Filter SERP results to core topic matches'
    ]
  },

  adjacentTopics: {
    title: 'Adjacent Topics',
    description: 'Related topics that are somewhat relevant but not the client\'s primary focus.',
    whyWeAddedThis: 'Adjacent topics help identify opportunities for expansion or content that provides context. They\'re relevant for SEO but lower priority than core topics.',
    examples: [
      '["textile industry trends", "manufacturing automation", "export regulations", "industrial maintenance"]',
      '["career guidance", "study techniques", "exam strategies", "college admissions"]'
    ],
    nuances: 'Adjacent topics should be genuinely related, not just anything in the same broad industry. They represent realistic expansion areas.',
    useCases: [
      'Identify secondary keyword opportunities',
      'Find content partnership or backlink prospects',
      'Broaden competitor analysis scope'
    ]
  },

  negativeTopics: {
    title: 'Negative Topics',
    description: 'Topics that share terminology with the client\'s industry but are NOT relevant.',
    whyWeAddedThis: 'Many industries share words with unrelated fields. "Twister" is both a textile machine and a movie. Negative topics prevent false matches and improve classification accuracy.',
    examples: [
      '["twister movie", "tornado", "textile fashion", "fabric retail", "clothing brands"]',
      '["chemistry movies", "laboratory entertainment", "science fiction"]'
    ],
    nuances: 'Focus on common false positives you\'ve observed. These should be specific enough to filter out wrong matches without removing valid content.',
    useCases: [
      'Filter out irrelevant keywords in data pulls',
      'Exclude obviously wrong domains from analysis',
      'Improve AI classification accuracy by providing negative examples'
    ]
  },

  domainTypePatterns: {
    title: 'Domain Type Classification Patterns',
    description: 'Indicator words that suggest what type of business a domain represents.',
    whyWeAddedThis: 'Different domain types require different handling. OEMs are competitors, service providers might be partners, marketplaces are channels. These patterns enable automatic domain type classification.',
    examples: [
      'oemManufacturerIndicators: ["industries", "manufacturing", "machinery", "equipment", "oem"]',
      'serviceProviderIndicators: ["solutions", "services", "consulting", "agency"]',
      'marketplaceIndicators: ["mart", "trade", "directory", "alibaba", "indiamart"]'
    ],
    nuances: 'These are domain name fragments, not keywords. A domain containing "solutions" is likely a service provider. Indicators should be common patterns observed across many domains.',
    useCases: [
      'Pre-classify domains before deeper analysis',
      'Prioritize competitor domains over service providers',
      'Identify marketplace/directory opportunities'
    ]
  },

  classificationIntentHints: {
    title: 'Keyword Intent Classification Hints',
    description: 'Keywords and phrases that indicate different search intents.',
    whyWeAddedThis: 'Intent classification helps prioritize keywords. Transactional keywords are highest priority for commerce, informational for content strategy. These hints enable automated intent classification.',
    examples: [
      'transactionalKeywords: ["buy", "price", "quotation", "order", "purchase", "supplier"]',
      'informationalKeywords: ["what is", "how to", "guide", "process", "benefits"]',
      'directoryKeywords: ["manufacturers in", "list of", "top 10", "suppliers near"]'
    ],
    nuances: 'These are phrase fragments that can appear anywhere in a keyword. "buy twister machine" and "twister machine buy" would both match "buy".',
    useCases: [
      'Classify keywords by commercial intent',
      'Prioritize transactional keywords for quick wins',
      'Identify informational content opportunities'
    ]
  },

  businessRelevanceLogicNotes: {
    title: 'Business Relevance Logic Notes',
    description: 'Detailed definitions for how to classify business relationships.',
    whyWeAddedThis: 'These notes serve as the "rules" for both AI classification and human review. Having explicit definitions ensures consistency across the team and over time.',
    examples: [
      'directCompetitorDefinition: "Other textile machinery OEMs manufacturing similar twisting, winding, or heat-setting equipment"',
      'potentialCustomerDefinition: "Textile mills, yarn producers, or fabric manufacturers who purchase machinery"'
    ],
    nuances: 'Write definitions as if explaining to a new team member. Be specific about what qualifies and what doesn\'t. Include edge cases if known.',
    useCases: [
      'Train AI classification models with consistent definitions',
      'Onboard new team members on classification criteria',
      'Resolve disputes about domain categorization'
    ]
  }
};
