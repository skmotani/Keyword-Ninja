// Footprint Registry - Seed Default Surfaces

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// Historical metadata for surfaces - researched from web
// launchYear: When the surface/platform became available
// technicalName: Original or technical name when released
// businessImpact: What businesses lose without presence
const HISTORICAL_METADATA: Record<string, { launchYear?: number; technicalName?: string; businessImpact?: object }> = {
    // ========== OWNED ==========
    'WEBSITE': { launchYear: 1991, technicalName: 'World Wide Web', businessImpact: { impactLevel: 'critical', absenceImpact: 'No digital storefront. Invisible to customers searching online.', partialImpact: 'Poor SSL/speed hurts trust and conversions.' } },
    'SCHEMA_ORG': { launchYear: 2011, technicalName: 'Microdata/JSON-LD', businessImpact: { impactLevel: 'high', absenceImpact: 'Miss rich snippets in search results. Reduced CTR.', partialImpact: 'Partial schema limits eligibility for featured results.' } },
    'ROBOTS_TXT': { launchYear: 1994, technicalName: 'Robots Exclusion Protocol', businessImpact: { impactLevel: 'low', absenceImpact: 'Search engines may crawl inefficiently.', partialImpact: 'May accidentally block important pages.' } },
    'SITEMAP_XML': { launchYear: 2005, technicalName: 'Sitemap Protocol', businessImpact: { impactLevel: 'medium', absenceImpact: 'New pages may be discovered slowly by search engines.' } },

    // ========== SEARCH ==========
    'GOOGLE_ORGANIC_BRAND': { launchYear: 1998, technicalName: 'PageRank Organic', businessImpact: { impactLevel: 'critical', absenceImpact: 'Customers searching your brand find competitors first.', partialImpact: 'Below position 3 loses 75%+ of clicks.' } },
    'GOOGLE_NEWS_MENTIONS': { launchYear: 2002, technicalName: 'Google News', businessImpact: { impactLevel: 'high', absenceImpact: 'Miss news carousel visibility and PR amplification.' } },
    'GOOGLE_IMAGES_BRAND': { launchYear: 2001, technicalName: 'Google Image Search', businessImpact: { impactLevel: 'low', absenceImpact: 'Miss visual discovery traffic for products.' } },
    'GOOGLE_AUTOCOMPLETE': { launchYear: 2008, technicalName: 'Google Suggest', businessImpact: { impactLevel: 'medium', absenceImpact: 'Brand not suggested means lower brand awareness signals.' } },
    'BING_ORGANIC_BRAND': { launchYear: 2009, technicalName: 'Bing Search', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss 5-10% of search traffic from Bing users.' } },

    // ========== SOCIAL ==========
    'LINKEDIN_COMPANY': { launchYear: 2003, technicalName: 'LinkedIn Company Pages', businessImpact: { impactLevel: 'critical', absenceImpact: 'No B2B credibility. Miss talent attraction and partner discovery.', partialImpact: 'Incomplete profile reduces trust.' } },
    'YOUTUBE_CHANNEL': { launchYear: 2005, technicalName: 'YouTube', businessImpact: { impactLevel: 'high', absenceImpact: 'Miss video search traffic and trust-building content.' } },
    'FACEBOOK_PAGE': { launchYear: 2007, technicalName: 'Facebook Pages', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss social proof and community engagement.' } },
    'INSTAGRAM_PROFILE': { launchYear: 2010, technicalName: 'Instagram for Business', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss visual brand discovery, especially for B2C.' } },
    'X_PROFILE': { launchYear: 2006, technicalName: 'Twitter', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss real-time brand conversations and news.' } },
    'PINTEREST_PRESENCE': { launchYear: 2010, technicalName: 'Pinterest', businessImpact: { impactLevel: 'low', absenceImpact: 'Miss visual discovery for lifestyle/retail products.' } },
    'TIKTOK_PRESENCE': { launchYear: 2016, technicalName: 'Douyin/TikTok', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss Gen-Z audience and viral content potential.' } },

    // ========== TRUST ==========
    'TRUSTPILOT': { launchYear: 2007, technicalName: 'Trustpilot', businessImpact: { impactLevel: 'high', absenceImpact: 'Miss review stars in search and trust signals.' } },
    'G2_LISTING': { launchYear: 2012, technicalName: 'G2 Crowd', businessImpact: { impactLevel: 'high', absenceImpact: 'Miss B2B software evaluation traffic.' } },
    'CAPTERRA_LISTING': { launchYear: 1999, technicalName: 'Capterra', businessImpact: { impactLevel: 'high', absenceImpact: 'Miss software buyer comparison traffic.' } },
    'GOOGLE_REVIEWS': { launchYear: 2007, technicalName: 'Google Local Business Reviews', businessImpact: { impactLevel: 'critical', absenceImpact: 'No star ratings in local pack. Major trust handicap.' } },
    'GLASSDOOR_PRESENCE': { launchYear: 2007, technicalName: 'Glassdoor', businessImpact: { impactLevel: 'high', absenceImpact: 'Miss employer brand signals for talent attraction.' } },
    'BBB_LISTING': { launchYear: 1912, technicalName: 'Better Business Bureau', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss legacy trust signal for US businesses.' } },

    // ========== AUTHORITY ==========
    'CRUNCHBASE_PROFILE': { launchYear: 2007, technicalName: 'CrunchBase', businessImpact: { impactLevel: 'high', absenceImpact: 'Miss investor/partner discovery credibility.' } },
    'PITCHBOOK_LISTING': { launchYear: 2007, technicalName: 'PitchBook', businessImpact: { impactLevel: 'medium', absenceImpact: 'Invisible to PE/VC research.' } },
    'WIKIPEDIA_PAGE': { launchYear: 2001, technicalName: 'Wikipedia', businessImpact: { impactLevel: 'critical', absenceImpact: 'No Knowledge Panel source. Miss entity credibility.' } },
    'WIKIDATA_ENTITY': { launchYear: 2012, technicalName: 'Wikidata', businessImpact: { impactLevel: 'high', absenceImpact: 'Not in structured knowledge graph. Miss AI entity linking.' } },

    // ========== MARKETPLACE ==========
    'AMAZON_SELLER': { launchYear: 2000, technicalName: 'Amazon Marketplace', businessImpact: { impactLevel: 'critical', absenceImpact: 'Miss the worlds largest product search engine.' } },
    'FLIPKART_SELLER': { launchYear: 2007, technicalName: 'Flipkart', businessImpact: { impactLevel: 'high', absenceImpact: 'Miss India largest ecommerce platform.' } },
    'INDIAMART_LISTING': { launchYear: 1999, technicalName: 'IndiaMART', businessImpact: { impactLevel: 'critical', absenceImpact: 'Miss Indias largest B2B marketplace for manufacturers.' } },
    'ALIBABA_LISTING': { launchYear: 1999, technicalName: 'Alibaba.com', businessImpact: { impactLevel: 'high', absenceImpact: 'Miss global B2B export opportunities.' } },
    'TRADEINDIA_LISTING': { launchYear: 1996, technicalName: 'TradeIndia', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss Indian B2B trade leads.' } },
    'EXPORTERSINDIA_LISTING': { launchYear: 1997, technicalName: 'ExportersIndia', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss export inquiry traffic.' } },

    // ========== TECHNICAL ==========
    'GSC_INDEXED': { launchYear: 2006, technicalName: 'Google Search Console', businessImpact: { impactLevel: 'critical', absenceImpact: 'No insight into Google crawl issues. Pages may be unindexed.' } },
    'BING_WMT_INDEXED': { launchYear: 2009, technicalName: 'Bing Webmaster Tools', businessImpact: { impactLevel: 'medium', absenceImpact: 'No insight into Bing indexing issues.' } },
    'PAGESPEED_SCORE': { launchYear: 2010, technicalName: 'PageSpeed Insights', businessImpact: { impactLevel: 'high', absenceImpact: 'Poor Core Web Vitals hurts rankings since 2021.' } },
    'MOBILE_USABILITY': { launchYear: 2015, technicalName: 'Mobile-First Indexing', businessImpact: { impactLevel: 'critical', absenceImpact: 'Non-mobile sites get demoted since Google mobile-first (2019).' } },
    'SSL_CERTIFICATE': { launchYear: 2014, technicalName: 'HTTPS as Ranking Signal', businessImpact: { impactLevel: 'critical', absenceImpact: 'Browser warnings hurt traffic. Ranking penalty since 2014.' } },

    // ========== AI / AEO ==========
    'CHATGPT_MENTIONS': { launchYear: 2023, technicalName: 'ChatGPT Web Browsing', businessImpact: { impactLevel: 'high', absenceImpact: 'Invisible to conversational AI users. Growing traffic source.' } },
    'PERPLEXITY_CITATIONS': { launchYear: 2022, technicalName: 'Perplexity AI', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss AI-powered research citations.' } },
    'GOOGLE_AI_OVERVIEW': { launchYear: 2024, technicalName: 'SGE → AI Overviews', businessImpact: { impactLevel: 'critical', absenceImpact: 'Not cited in Googles AI summaries means zero visibility in AI results.' } },
    'BING_COPILOT_CITATIONS': { launchYear: 2023, technicalName: 'Bing Chat → Copilot', businessImpact: { impactLevel: 'high', absenceImpact: 'Miss Microsoft ecosystem AI citations.' } },
    'GEMINI_CITATIONS': { launchYear: 2023, technicalName: 'Bard → Gemini', businessImpact: { impactLevel: 'high', absenceImpact: 'Miss Google AI citationsparticularly for Android/Google users.' } },
    'FAQ_SCHEMA': { launchYear: 2019, technicalName: 'FAQ Structured Data', businessImpact: { impactLevel: 'high', absenceImpact: 'Miss expanded SERP presence with FAQ dropdowns.' } },
    'HOWTO_SCHEMA': { launchYear: 2019, technicalName: 'HowTo Structured Data', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss step-by-step rich results for tutorials.' } },
    'SPEAKABLE_SCHEMA': { launchYear: 2018, technicalName: 'Speakable Markup', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss voice assistant citations (Google Assistant, Alexa).' } },

    // ========== E-E-A-T / ENTITY ==========
    'EEAT_AUTHOR_ENTITY': { launchYear: 2022, technicalName: 'E-A-T → E-E-A-T', businessImpact: { impactLevel: 'critical', absenceImpact: 'Content lacks authority. Penalized for YMYL topics since 2018 Medic update.' } },
    'EEAT_EXPERIENCE_SIGNALS': { launchYear: 2022, technicalName: 'Experience in E-E-A-T', businessImpact: { impactLevel: 'high', absenceImpact: 'Content lacks first-hand experience signals. Hurts helpful content rankings.' } },
    'KNOWLEDGE_PANEL': { launchYear: 2012, technicalName: 'Knowledge Graph', businessImpact: { impactLevel: 'critical', absenceImpact: 'No brand Knowledge Panel in SERP. Major credibility loss.' } },
    'FEATURED_SNIPPET': { launchYear: 2014, technicalName: 'Quick Answers', businessImpact: { impactLevel: 'critical', absenceImpact: 'Miss position-0 visibility and 35%+ CTR for informational queries.' } },
    'GOOGLE_BUSINESS_PROFILE': { launchYear: 2014, technicalName: 'Google My Business → GBP', businessImpact: { impactLevel: 'critical', absenceImpact: 'No local pack visibility. Miss 46% of Google searches with local intent.' } },
    'BING_PLACES': { launchYear: 2010, technicalName: 'Bing Places for Business', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss Bing local pack visibility.' } },
    'APPLE_MAPS_LISTING': { launchYear: 2012, technicalName: 'Apple Maps Connect', businessImpact: { impactLevel: 'medium', absenceImpact: 'Invisible to iOS Siri and Maps users.' } },

    // ========== COMMUNITY ==========
    'REDDIT_MENTIONS': { launchYear: 2005, technicalName: 'Reddit', businessImpact: { impactLevel: 'high', absenceImpact: 'Miss Reddit traffic (now in Google search results since 2024).' } },
    'QUORA_PRESENCE': { launchYear: 2009, technicalName: 'Quora', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss Q&A traffic and topical authority.' } },
    'STACK_OVERFLOW_PRESENCE': { launchYear: 2008, technicalName: 'Stack Overflow', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss developer community visibility.' } },
    'GITHUB_PROFILE': { launchYear: 2008, technicalName: 'GitHub', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss open-source credibility and developer recruitment.' } },
    'PRODUCTHUNT_LISTING': { launchYear: 2013, technicalName: 'Product Hunt', businessImpact: { impactLevel: 'high', absenceImpact: 'Miss early adopter discovery for tech products.' } },
    'HACKERNEWS_MENTIONS': { launchYear: 2007, technicalName: 'Hacker News (Y Combinator)', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss tech community amplification.' } },

    // ========== ADDITIONAL / ALTERNATE KEYS ==========
    'PINTEREST_PROFILE': { launchYear: 2010, technicalName: 'Pinterest', businessImpact: { impactLevel: 'low', absenceImpact: 'Miss visual discovery for lifestyle/retail products.' } },
    'QUORA_MENTIONS': { launchYear: 2009, technicalName: 'Quora', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss Q&A traffic and topical authority.' } },
    'GBP_LISTING': { launchYear: 2014, technicalName: 'Google My Business → GBP', businessImpact: { impactLevel: 'critical', absenceImpact: 'No local pack visibility. Miss 46% of Google searches with local intent.' } },
    'TRUSTPILOT_PROFILE': { launchYear: 2007, technicalName: 'Trustpilot', businessImpact: { impactLevel: 'high', absenceImpact: 'Miss review stars in search and trust signals.' } },
    'G2_PROFILE': { launchYear: 2012, technicalName: 'G2 Crowd', businessImpact: { impactLevel: 'high', absenceImpact: 'Miss B2B software evaluation traffic.' } },
    'CAPTERRA_PROFILE': { launchYear: 1999, technicalName: 'Capterra', businessImpact: { impactLevel: 'high', absenceImpact: 'Miss software buyer comparison traffic.' } },

    // ========== OWNED EXTENDED ==========
    'GSC_PROPERTY_VERIFIED': { launchYear: 2006, technicalName: 'Google Webmaster Tools → GSC', businessImpact: { impactLevel: 'critical', absenceImpact: 'No insight into indexing issues. Pages may be invisible.' } },
    'BING_WEBMASTER_VERIFIED': { launchYear: 2009, technicalName: 'Bing Webmaster Tools', businessImpact: { impactLevel: 'high', absenceImpact: 'No Bing indexing diagnostics.' } },
    'GA4_PROPERTY_PRESENT': { launchYear: 2020, technicalName: 'Google Analytics 4', businessImpact: { impactLevel: 'high', absenceImpact: 'No traffic analytics. Cannot measure SEO ROI.' } },
    'GTM_CONTAINER_PRESENT': { launchYear: 2012, technicalName: 'Google Tag Manager', businessImpact: { impactLevel: 'medium', absenceImpact: 'Difficult to manage tracking without code changes.' } },
    'ABOUT_CONTACT_PAGES_PRESENT': { launchYear: 1995, technicalName: 'About/Contact Pages', businessImpact: { impactLevel: 'high', absenceImpact: 'No entity clarity. Hurts trust and E-E-A-T.' } },
    'PRIVACY_TERMS_PAGES_PRESENT': { launchYear: 2000, technicalName: 'Privacy/Terms Pages', businessImpact: { impactLevel: 'medium', absenceImpact: 'No legal trust baseline. Enterprise buyers hesitate.' } },

    // ========== SEARCH EXTENDED ==========
    'GOOGLE_KNOWLEDGE_PANEL_BRAND': { launchYear: 2012, technicalName: 'Knowledge Graph Panel', businessImpact: { impactLevel: 'critical', absenceImpact: 'No entity presence in SERP. Major credibility loss.' } },
    'GOOGLE_MAPS_PACK_BRAND': { launchYear: 2007, technicalName: 'Google Maps Local Pack', businessImpact: { impactLevel: 'high', absenceImpact: 'Invisible in local searches even for branded queries.' } },
    'BING_PLACES_LISTING': { launchYear: 2010, technicalName: 'Bing Places', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss Bing local search visibility.' } },
    'PEOPLE_ALSO_ASK_CATEGORY': { launchYear: 2015, technicalName: 'PAA (People Also Ask)', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss question-based visibility and mid-funnel traffic.' } },
    'GOOGLE_PERSPECTIVES_MENTIONS': { launchYear: 2023, technicalName: 'Google Perspectives', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss discussion/UGC SERP feature visibility.' } },

    // ========== SOCIAL EXTENDED ==========
    'LINKEDIN_LEADERSHIP_PROFILES': { launchYear: 2003, technicalName: 'LinkedIn Personal Profiles', businessImpact: { impactLevel: 'high', absenceImpact: 'No founder/CXO credibility. Hurts B2B trust.' } },
    'WHATSAPP_BUSINESS_PROFILE': { launchYear: 2018, technicalName: 'WhatsApp Business', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss high-conversion contact channel (India/global).' } },

    // ========== VIDEO EXTENDED ==========
    'YOUTUBE_SHORTS_PRESENCE': { launchYear: 2020, technicalName: 'YouTube Shorts', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss short-form video discovery.' } },
    'VIDEO_SCHEMA_PRESENT': { launchYear: 2012, technicalName: 'VideoObject Schema', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss video rich results in search.' } },
    'VIDEO_SITEMAP_PRESENT': { launchYear: 2007, technicalName: 'Video Sitemap', businessImpact: { impactLevel: 'medium', absenceImpact: 'Slower video content discovery by search engines.' } },
    'YOUTUBE_SEARCH_CATEGORY_VISIBILITY': { launchYear: 2005, technicalName: 'YouTube Search', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss category video search traffic.' } },

    // ========== COMMUNITY EXTENDED ==========
    'INDUSTRY_FORUM_MENTIONS': { launchYear: 2000, technicalName: 'Industry Forums', businessImpact: { impactLevel: 'low', absenceImpact: 'Miss niche community discovery.' } },

    // ========== TRUST EXTENDED ==========
    'CLUTCH_PROFILE': { launchYear: 2013, technicalName: 'Clutch.co', businessImpact: { impactLevel: 'high', absenceImpact: 'Miss B2B service provider reviews.' } },
    'GOODFIRMS_PROFILE': { launchYear: 2014, technicalName: 'GoodFirms', businessImpact: { impactLevel: 'low', absenceImpact: 'Miss third-party review directory.' } },
    'GLASSDOOR_PROFILE': { launchYear: 2007, technicalName: 'Glassdoor', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss employer brand signals.' } },
    'AMBITIONBOX_PROFILE': { launchYear: 2015, technicalName: 'AmbitionBox', businessImpact: { impactLevel: 'low', absenceImpact: 'Miss India employer reputation platform.' } },

    // ========== MARKETPLACE EXTENDED ==========
    'GLOBALSOURCES_LISTING': { launchYear: 1995, technicalName: 'GlobalSources', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss global B2B supplier directory.' } },
    'KOMPASS_PROFILE': { launchYear: 1944, technicalName: 'Kompass', businessImpact: { impactLevel: 'low', absenceImpact: 'Miss international business directory.' } },

    // ========== TECHNICAL EXTENDED ==========
    'SPF_DKIM_DMARC': { launchYear: 2004, technicalName: 'Email Authentication (SPF/DKIM/DMARC)', businessImpact: { impactLevel: 'medium', absenceImpact: 'Email deliverability issues. Spoofing risk.' } },
    'DMARC_POLICY_ENFORCED': { launchYear: 2012, technicalName: 'DMARC', businessImpact: { impactLevel: 'high', absenceImpact: 'No email domain protection. Brand spoofing risk.' } },
    'BIMI_PRESENT': { launchYear: 2019, technicalName: 'BIMI (Brand Logo in Email)', businessImpact: { impactLevel: 'medium', absenceImpact: 'No logo in inbox. Lower email brand recognition.' } },
    'MTA_STS_PRESENT': { launchYear: 2018, technicalName: 'MTA-STS', businessImpact: { impactLevel: 'low', absenceImpact: 'Email transport security risk.' } },
    'TLS_RPT_PRESENT': { launchYear: 2018, technicalName: 'TLS-RPT', businessImpact: { impactLevel: 'low', absenceImpact: 'No email TLS issue reporting.' } },

    // ========== AEO / LLM ==========
    'ORG_SCHEMA_SAMEAS_COMPLETE': { launchYear: 2011, technicalName: 'Organization Schema sameAs', businessImpact: { impactLevel: 'critical', absenceImpact: 'Entity not connected across platforms. AI/LLM confusion.' } },
    'FAQ_SCHEMA_PRESENT': { launchYear: 2019, technicalName: 'FAQPage Schema', businessImpact: { impactLevel: 'high', absenceImpact: 'Miss FAQ rich results and AEO opportunities.' } },
    'LLMS_TXT_PRESENT': { launchYear: 2024, technicalName: 'llms.txt', businessImpact: { impactLevel: 'medium', absenceImpact: 'No AI crawler guidance (emerging standard).' } },

    // ========== PERFORMANCE & SECURITY ==========
    'CORE_WEB_VITALS_STATUS': { launchYear: 2020, technicalName: 'Core Web Vitals', businessImpact: { impactLevel: 'high', absenceImpact: 'Poor CWV hurts rankings since Page Experience update (2021).' } },
    'SECURITY_HEADERS_PRESENT': { launchYear: 2012, technicalName: 'Security Headers (HSTS/CSP)', businessImpact: { impactLevel: 'medium', absenceImpact: 'Security vulnerabilities. Enterprise buyers hesitate.' } },

    // ========== E-E-A-T / ENTITY ==========
    'WIKIDATA_ENTITY_COMPLETENESS': { launchYear: 2012, technicalName: 'Wikidata Q-ID', businessImpact: { impactLevel: 'high', absenceImpact: 'Incomplete entity facts. LLM/AI entity confusion.' } },
    'KNOWLEDGE_PANEL_FACTS_CONSISTENT': { launchYear: 2012, technicalName: 'Knowledge Panel', businessImpact: { impactLevel: 'critical', absenceImpact: 'Incorrect facts in SERP. Entity splitting risk.' } },
    'NAP_CONSISTENCY_CHECK': { launchYear: 2010, technicalName: 'NAP Consistency', businessImpact: { impactLevel: 'high', absenceImpact: 'Inconsistent NAP hurts local SEO and entity trust.' } },
    'BRAND_ASSETS_CONSISTENCY': { launchYear: 2000, technicalName: 'Brand Consistency', businessImpact: { impactLevel: 'medium', absenceImpact: 'Entity reconciliation problems across platforms.' } },
    'CASE_STUDIES_HUB_PRESENT': { launchYear: 2000, technicalName: 'Case Studies', businessImpact: { impactLevel: 'critical', absenceImpact: 'No proof of experience. Weak E-E-A-T for B2B.' } },
    'TESTIMONIALS_WITH_CONTEXT': { launchYear: 2000, technicalName: 'Testimonials', businessImpact: { impactLevel: 'high', absenceImpact: 'Generic testimonials lack trust signals.' } },
    'PROOF_MEDIA_LIBRARY': { launchYear: 2000, technicalName: 'Proof Media Gallery', businessImpact: { impactLevel: 'high', absenceImpact: 'No visual proof of work. Buyers hesitate.' } },
    'TEAM_LEADERSHIP_PAGE': { launchYear: 2000, technicalName: 'Team/Leadership Page', businessImpact: { impactLevel: 'high', absenceImpact: 'No human faces. Hurts trust and E-E-A-T.' } },
    'CERTIFICATIONS_BADGES_DISPLAY': { launchYear: 2000, technicalName: 'Certifications/Badges', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss authority signals for specific industries.' } },
    'CLIENTS_PARTNERS_LOGOS': { launchYear: 2000, technicalName: 'Client/Partner Logos', businessImpact: { impactLevel: 'high', absenceImpact: 'No social proof. Lower conversion confidence.' } },
    'AWARDS_RECOGNITION_SECTION': { launchYear: 2000, technicalName: 'Awards Section', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss third-party credibility signals.' } },

    // ========== FINAL BATCH - REMAINING SURFACES ==========
    'AUTHOR_PAGES_PRESENT': { launchYear: 2000, technicalName: 'Author Bio Pages', businessImpact: { impactLevel: 'high', absenceImpact: 'No expert credibility. Weak E-E-A-T for content.' } },
    'AUTHOR_SCHEMA_PRESENT': { launchYear: 2011, technicalName: 'Person Schema', businessImpact: { impactLevel: 'medium', absenceImpact: 'Authors not connected to content in structured data.' } },
    'EDITORIAL_POLICY_PAGE': { launchYear: 2018, technicalName: 'Editorial Policy', businessImpact: { impactLevel: 'medium', absenceImpact: 'No content quality transparency. Weak for YMYL.' } },
    'CERTIFICATIONS_PAGE_PRESENT': { launchYear: 2000, technicalName: 'Certifications Page', businessImpact: { impactLevel: 'high', absenceImpact: 'No compliance/quality proof for B2B buyers.' } },
    'BUSINESS_VERIFICATION_SIGNALS': { launchYear: 2000, technicalName: 'Business Verification', businessImpact: { impactLevel: 'high', absenceImpact: 'No visible company identity. Fraud perception risk.' } },
    'SERVICE_SUPPORT_PAGES': { launchYear: 2000, technicalName: 'Service/Support Pages', businessImpact: { impactLevel: 'high', absenceImpact: 'No after-sales clarity. Buyer hesitation.' } },
    'PRESS_MEDIA_MENTIONS': { launchYear: 2000, technicalName: 'Press Mentions', businessImpact: { impactLevel: 'high', absenceImpact: 'No third-party validation. Weak authority.' } },
    'ASSOCIATION_MEMBERSHIPS_LISTED': { launchYear: 2000, technicalName: 'Industry Associations', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss industry credibility signals.' } },
    'JUSTDIAL_LISTING': { launchYear: 1996, technicalName: 'JustDial', businessImpact: { impactLevel: 'high', absenceImpact: 'Miss Indias largest local business directory.' } },
    'TIKTOK_PROFILE': { launchYear: 2016, technicalName: 'TikTok', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss Gen-Z audience and viral content potential.' } },

    // ========== TRULY FINAL - LAST 4 MISSING ==========
    'CONFERENCE_SPEAKING_EVENTS': { launchYear: 2000, technicalName: 'Conference Speaking', businessImpact: { impactLevel: 'high', absenceImpact: 'Miss thought leadership visibility and industry authority.' } },
    'DATASHEETS_DOWNLOAD_HUB': { launchYear: 2000, technicalName: 'Datasheets Hub', businessImpact: { impactLevel: 'high', absenceImpact: 'No technical specs for B2B buyers. Weak product credibility.' } },
    'PRODUCT_SCHEMA_PRESENT': { launchYear: 2011, technicalName: 'Product Schema', businessImpact: { impactLevel: 'high', absenceImpact: 'Miss product rich results with price, availability, reviews.' } },
    'WEBINARS_EVENTS_ARCHIVE': { launchYear: 2010, technicalName: 'Webinars Archive', businessImpact: { impactLevel: 'medium', absenceImpact: 'Miss evergreen content for lead generation.' } },
};

// Default surface registry entries
const DEFAULT_SURFACES = [
    // ... (lines 8-364 implied unchanged, not replacing them)
    // We only need to replace the import section and the map function section.
    // But replace_file_content needs contiguous block. The map function is at the end. Import is at the start.
    // I can do in two chunks or use multi_replace.
    // Let's use multi_replace since I need to add import AND change the map loop.

    // ============ OWNED ============
    {
        surfaceKey: 'WEBSITE',
        label: 'Website Reachable',
        category: 'owned',
        importanceTier: 'CRITICAL',
        basePoints: 18,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'HTTP 200 response with valid HTML content and SSL certificate',
        presenceRules: { present: 'HTTP 200 + SSL', partial: 'HTTP 200 no SSL', absent: 'No response or error' },
        tooltipTemplates: {
            why: 'Your website is the foundation of your online presence.',
            how: 'Direct HTTP request to domain with SSL verification.',
            actionPresent: 'Ensure fast load times and mobile responsiveness.',
            actionAbsent: 'Set up a professional website immediately.',
        },
        officialnessRequired: false,
        evidenceFields: ['url', 'httpStatus', 'hasSSL', 'title'],
    },
    {
        surfaceKey: 'SCHEMA_ORG',
        label: 'Schema.org Markup',
        category: 'owned',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'JSON-LD or Microdata schema blocks with Organization/LocalBusiness type',
        presenceRules: { present: 'Organization schema found', partial: 'Other schema types only', absent: 'No schema' },
        tooltipTemplates: {
            why: 'Structured data helps search engines understand your business.',
            how: 'Parse HTML for JSON-LD and Microdata blocks.',
            actionAbsent: 'Add Organization schema to your homepage.',
        },
        officialnessRequired: false,
    },
    {
        surfaceKey: 'ROBOTS_TXT',
        label: 'Robots.txt Present',
        category: 'owned',
        importanceTier: 'LOW',
        basePoints: 2,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'Valid robots.txt file at /robots.txt',
        officialnessRequired: false,
    },
    {
        surfaceKey: 'SITEMAP_XML',
        label: 'Sitemap.xml Present',
        category: 'owned',
        importanceTier: 'LOW',
        basePoints: 2,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'Valid XML sitemap at /sitemap.xml or referenced in robots.txt',
        officialnessRequired: false,
    },

    // ============ SEARCH ============
    {
        surfaceKey: 'GOOGLE_ORGANIC_BRAND',
        label: 'Google Brand Search',
        category: 'search',
        importanceTier: 'CRITICAL',
        basePoints: 10,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['"{brand}"', '{brand} {industry}', '{brand} official site'],
        maxQueries: 2,
        confirmationArtifact: 'Brand website appears in top 3 organic results for brand name query',
        presenceRules: { present: 'Domain in top 3', partial: 'Domain in top 10', absent: 'Not found' },
        tooltipTemplates: {
            why: 'Brand searches show intent - customers looking specifically for you.',
            actionAbsent: 'Improve SEO and build brand awareness.',
        },
        evidenceFields: ['url', 'title', 'snippet', 'position'],
    },
    {
        surfaceKey: 'GOOGLE_NEWS_MENTIONS',
        label: 'Google News Mentions',
        category: 'search',
        importanceTier: 'HIGH',
        basePoints: 6,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['{brand} news', '{brand} announcement', '{brand} press release'],
        confirmationArtifact: 'News articles mentioning brand from reputable sources',
        officialnessRequired: false,
    },
    {
        surfaceKey: 'GOOGLE_IMAGES_BRAND',
        label: 'Google Images',
        category: 'search',
        importanceTier: 'LOW',
        basePoints: 2,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['{brand} logo', '{brand} products'],
        confirmationArtifact: 'Brand images appear in image search results',
        officialnessRequired: false,
    },
    {
        surfaceKey: 'GOOGLE_AUTOCOMPLETE',
        label: 'Google Autocomplete',
        category: 'search',
        importanceTier: 'MEDIUM',
        basePoints: 3,
        sourceType: 'DATAFORSEO_AUTOCOMPLETE',
        searchEngine: 'google',
        queryTemplates: ['{brand}'],
        confirmationArtifact: 'Brand name appears in autocomplete suggestions',
        officialnessRequired: false,
        evidenceFields: ['suggestion'],
    },
    {
        surfaceKey: 'BING_ORGANIC_BRAND',
        label: 'Bing Brand Search',
        category: 'search',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'bing',
        queryTemplates: ['"{brand}"', '{brand} official'],
        confirmationArtifact: 'Brand website in top 10 Bing results',
    },

    // ============ SOCIAL ============
    {
        surfaceKey: 'LINKEDIN_COMPANY',
        label: 'LinkedIn Company Page',
        category: 'social',
        importanceTier: 'CRITICAL',
        basePoints: 10,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:linkedin.com/company "{brand}"', '{brand} linkedin'],
        confirmationArtifact: 'LinkedIn company page URL with matching brand name',
        tooltipTemplates: {
            why: 'LinkedIn is essential for B2B credibility and recruitment.',
            actionAbsent: 'Create a LinkedIn Company Page and keep it updated.',
        },
        evidenceFields: ['url', 'title'],
    },
    {
        surfaceKey: 'YOUTUBE_CHANNEL',
        label: 'YouTube Channel',
        category: 'video',
        importanceTier: 'HIGH',
        basePoints: 8,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:youtube.com "{brand}"', '{brand} youtube channel'],
        confirmationArtifact: 'YouTube channel URL with brand name',
        tooltipTemplates: {
            why: 'Video content builds trust and increases engagement.',
            actionAbsent: 'Create a YouTube channel with product demos or tutorials.',
        },
    },
    {
        surfaceKey: 'FACEBOOK_PAGE',
        label: 'Facebook Page',
        category: 'social',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:facebook.com "{brand}"'],
        confirmationArtifact: 'Facebook business page with matching brand',
    },
    {
        surfaceKey: 'INSTAGRAM_PROFILE',
        label: 'Instagram Profile',
        category: 'social',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:instagram.com "{brand}"'],
        confirmationArtifact: 'Instagram profile with brand name',
    },
    {
        surfaceKey: 'X_PROFILE',
        label: 'X (Twitter) Profile',
        category: 'social',
        importanceTier: 'MEDIUM',
        basePoints: 3,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:x.com "{brand}"', 'site:twitter.com "{brand}"'],
        confirmationArtifact: 'X/Twitter profile with brand handle',
    },
    {
        surfaceKey: 'PINTEREST_PROFILE',
        label: 'Pinterest Profile',
        category: 'social',
        importanceTier: 'LOW',
        basePoints: 2,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:pinterest.com "{brand}"'],
        confirmationArtifact: 'Pinterest profile or boards with brand',
        industryOverrides: { 'home_decor': 1.0, 'fashion': 1.0, 'b2b_manufacturing': 0.2 },
    },

    // ============ COMMUNITY ============
    {
        surfaceKey: 'REDDIT_MENTIONS',
        label: 'Reddit Mentions',
        category: 'community',
        importanceTier: 'LOW',
        basePoints: 2,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:reddit.com "{brand}"'],
        confirmationArtifact: 'Reddit posts or comments mentioning brand',
        officialnessRequired: false,
    },
    {
        surfaceKey: 'QUORA_MENTIONS',
        label: 'Quora Mentions',
        category: 'community',
        importanceTier: 'LOW',
        basePoints: 2,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:quora.com "{brand}"'],
        confirmationArtifact: 'Quora questions or answers mentioning brand',
        officialnessRequired: false,
    },

    // ============ TRUST ============
    {
        surfaceKey: 'GBP_LISTING',
        label: 'Google Business Profile',
        category: 'trust',
        importanceTier: 'CRITICAL',
        basePoints: 10,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['{brand} {city}', '{brand} near me'],
        confirmationArtifact: 'Google Maps/Business listing with verified business',
        tooltipTemplates: {
            why: 'GBP is essential for local discovery and credibility.',
            actionAbsent: 'Claim and verify your Google Business Profile.',
        },
        geoOverrides: { 'local': 1.0, 'regional': 0.8, 'global': 0.3 },
    },
    {
        surfaceKey: 'TRUSTPILOT_PROFILE',
        label: 'Trustpilot Profile',
        category: 'trust',
        importanceTier: 'HIGH',
        basePoints: 5,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:trustpilot.com "{brand}"', '{brand} trustpilot reviews'],
        confirmationArtifact: 'Trustpilot business profile with reviews',
    },
    {
        surfaceKey: 'G2_PROFILE',
        label: 'G2 Profile',
        category: 'trust',
        importanceTier: 'HIGH',
        basePoints: 5,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:g2.com "{brand}"'],
        confirmationArtifact: 'G2 product listing with reviews',
        industryOverrides: { 'saas': 1.0, 'software': 1.0, 'retail': 0.1 },
    },
    {
        surfaceKey: 'CAPTERRA_PROFILE',
        label: 'Capterra Profile',
        category: 'trust',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:capterra.com "{brand}"'],
        confirmationArtifact: 'Capterra software listing',
        industryOverrides: { 'saas': 1.0, 'software': 1.0 },
    },

    // ============ AUTHORITY ============
    {
        surfaceKey: 'CRUNCHBASE_PROFILE',
        label: 'Crunchbase Profile',
        category: 'authority',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:crunchbase.com "{brand}"'],
        confirmationArtifact: 'Crunchbase company profile',
        industryOverrides: { 'startup': 1.0, 'tech': 0.8 },
    },
    {
        surfaceKey: 'WIKIPEDIA_PAGE',
        label: 'Wikipedia Page',
        category: 'authority',
        importanceTier: 'HIGH',
        basePoints: 8,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:wikipedia.org "{brand}"'],
        confirmationArtifact: 'Wikipedia article about company or brand',
        tooltipTemplates: {
            why: 'Wikipedia presence indicates notable brand recognition.',
            actionAbsent: 'Build notability through press coverage first.',
        },
    },

    // ============ MARKETPLACE ============
    {
        surfaceKey: 'INDIAMART_LISTING',
        label: 'IndiaMART Listing',
        category: 'marketplace',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:indiamart.com "{brand}"'],
        confirmationArtifact: 'IndiaMART supplier/product listing',
        geoOverrides: { 'india': 1.0, 'global': 0.2 },
        industryOverrides: { 'b2b_manufacturing': 1.0, 'wholesale': 1.0 },
    },
    {
        surfaceKey: 'ALIBABA_LISTING',
        label: 'Alibaba Listing',
        category: 'marketplace',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:alibaba.com "{brand}"'],
        confirmationArtifact: 'Alibaba supplier listing',
        industryOverrides: { 'b2b_manufacturing': 1.0, 'export': 1.0 },
    },

    // ============ TECHNICAL ============
    {
        surfaceKey: 'SPF_DKIM_DMARC',
        label: 'Email Authentication',
        category: 'technical',
        importanceTier: 'LOW',
        basePoints: 2,
        sourceType: 'DNS_LOOKUP',
        queryTemplates: [],
        confirmationArtifact: 'Valid SPF, DKIM, and DMARC DNS records',
        presenceRules: { present: 'All 3 present', partial: '1-2 present', absent: 'None' },
        officialnessRequired: false,
        enabled: false, // Disabled by default until DNS provider implemented
        notes: 'Requires DNS lookup capability. Enable when implemented.',
    },

    // ============ NEW: OWNED (EXTENDED) ============
    {
        surfaceKey: 'GSC_PROPERTY_VERIFIED',
        label: 'Google Search Console Property',
        category: 'owned',
        importanceTier: 'CRITICAL',
        basePoints: 10,
        sourceType: 'GSC_API',
        queryTemplates: [],
        confirmationArtifact: 'Verified GSC property with crawl diagnostics access',
        tooltipTemplates: {
            why: 'Proof of site ownership + direct indexing/crawl diagnostics (coverage, sitemaps, manual actions, rich results).',
            actionAbsent: 'Verify your site in Google Search Console immediately.',
        },
    },
    {
        surfaceKey: 'BING_WEBMASTER_VERIFIED',
        label: 'Bing Webmaster Tools Property',
        category: 'owned',
        importanceTier: 'HIGH',
        basePoints: 8,
        sourceType: 'BING_WMT_API',
        queryTemplates: [],
        confirmationArtifact: 'Verified Bing Webmaster property',
        tooltipTemplates: {
            why: 'Ownership + crawl/index diagnostics for Bing ecosystem (also influences Bing-powered assistants).',
        },
    },
    {
        surfaceKey: 'GA4_PROPERTY_PRESENT',
        label: 'GA4 Installed',
        category: 'owned',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'GA4 measurement ID detected in page source',
        tooltipTemplates: {
            why: 'Measurement foundation for SEO→lead attribution; supports CRO, content ROI, and channel diagnostics.',
        },
    },
    {
        surfaceKey: 'GTM_CONTAINER_PRESENT',
        label: 'Google Tag Manager Installed',
        category: 'owned',
        importanceTier: 'MEDIUM',
        basePoints: 3,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'GTM container ID detected in page source',
        tooltipTemplates: {
            why: 'Stable instrumentation for analytics/events without frequent code deploys; improves measurement hygiene.',
        },
    },
    {
        surfaceKey: 'ABOUT_CONTACT_PAGES_PRESENT',
        label: 'About + Contact Pages',
        category: 'owned',
        importanceTier: 'HIGH',
        basePoints: 6,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: '/about and /contact pages returning HTTP 200',
        tooltipTemplates: {
            why: 'Entity and trust clarity for users + crawlers; required for credibility and conversions in B2B.',
        },
    },
    {
        surfaceKey: 'PRIVACY_TERMS_PAGES_PRESENT',
        label: 'Privacy + Terms Pages',
        category: 'owned',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: '/privacy and /terms pages returning HTTP 200',
        tooltipTemplates: {
            why: 'Trust baseline; reduces risk and improves legitimacy signals for enterprise buyers and AI systems.',
        },
    },

    // ============ NEW: SEARCH (EXTENDED) ============
    {
        surfaceKey: 'GOOGLE_KNOWLEDGE_PANEL_BRAND',
        label: 'Google Knowledge Panel (Brand)',
        category: 'search',
        importanceTier: 'CRITICAL',
        basePoints: 10,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['"{brand}"'],
        confirmationArtifact: 'Knowledge panel appearing for brand search query',
        tooltipTemplates: {
            why: 'Brand entity surface; impacts brand SERP trust, navigation, and AI/LLM entity understanding.',
        },
    },
    {
        surfaceKey: 'GOOGLE_MAPS_PACK_BRAND',
        label: 'Google Maps Pack (Brand)',
        category: 'search',
        importanceTier: 'HIGH',
        basePoints: 6,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['{brand} {city}', '{brand} location'],
        confirmationArtifact: 'Brand appears in local 3-pack/maps results',
        tooltipTemplates: {
            why: 'Local brand discovery surface; supports trust, navigation and "near me" intent even for B2B.',
        },
    },
    {
        surfaceKey: 'BING_PLACES_LISTING',
        label: 'Bing Places Listing',
        category: 'search',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'bing',
        queryTemplates: ['{brand} {city}'],
        confirmationArtifact: 'Bing Places business listing',
        tooltipTemplates: {
            why: 'Local/entity listing for Bing ecosystem; supports assistant and map visibility.',
        },
    },
    {
        surfaceKey: 'PEOPLE_ALSO_ASK_CATEGORY',
        label: 'People Also Ask (Category Terms)',
        category: 'search',
        importanceTier: 'MEDIUM',
        basePoints: 3,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['{category} {industry}'],
        confirmationArtifact: 'Brand mentioned in PAA answers for category queries',
        tooltipTemplates: {
            why: 'Question-based visibility surface; informs content strategy and captures mid-funnel intent.',
        },
    },
    {
        surfaceKey: 'GOOGLE_PERSPECTIVES_MENTIONS',
        label: 'Google Perspectives / Discussions',
        category: 'search',
        importanceTier: 'LOW',
        basePoints: 2,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['{brand} review', '{brand} experience'],
        confirmationArtifact: 'Brand mentioned in Perspectives/Discussions SERP feature',
        tooltipTemplates: {
            why: 'Visibility inside discussion-heavy SERP features; supports reputation and social proof discovery.',
        },
    },

    // ============ NEW: SOCIAL (EXTENDED) ============
    {
        surfaceKey: 'LINKEDIN_LEADERSHIP_PROFILES',
        label: 'LinkedIn Leadership Profiles',
        category: 'social',
        importanceTier: 'HIGH',
        basePoints: 8,
        sourceType: 'MANUAL_REVIEW',
        queryTemplates: [],
        confirmationArtifact: 'Founder/CXO LinkedIn profiles with company association',
        tooltipTemplates: {
            why: 'Founder/leadership credibility; improves trust, conversions and citation signals for B2B buyers.',
        },
    },
    {
        surfaceKey: 'WHATSAPP_BUSINESS_PROFILE',
        label: 'WhatsApp Business Profile',
        category: 'social',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'MANUAL_REVIEW',
        queryTemplates: [],
        confirmationArtifact: 'WhatsApp Business profile with verified badge',
        geoOverrides: { 'india': 1.0, 'brazil': 1.0, 'global': 0.5 },
        tooltipTemplates: {
            why: 'High-conversion contact surface (India/global); supports lead capture and customer trust.',
        },
    },

    // ============ NEW: VIDEO (EXTENDED) ============
    {
        surfaceKey: 'YOUTUBE_SHORTS_PRESENCE',
        label: 'YouTube Shorts',
        category: 'video',
        importanceTier: 'HIGH',
        basePoints: 6,
        sourceType: 'MANUAL_REVIEW',
        queryTemplates: [],
        confirmationArtifact: 'YouTube Shorts content on channel',
        tooltipTemplates: {
            why: 'Short-form discovery layer; can rank separately and expand reach for product/brand queries.',
        },
    },
    {
        surfaceKey: 'VIDEO_SCHEMA_PRESENT',
        label: 'Video Schema Markup',
        category: 'video',
        importanceTier: 'HIGH',
        basePoints: 6,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'VideoObject schema detected on pages with embedded videos',
        tooltipTemplates: {
            why: 'Enables video rich results + clearer indexing of embedded videos.',
        },
    },
    {
        surfaceKey: 'VIDEO_SITEMAP_PRESENT',
        label: 'Video Sitemap',
        category: 'video',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'Video sitemap at /video-sitemap.xml or referenced in sitemap index',
        tooltipTemplates: {
            why: 'Helps discovery/indexing of video assets at scale; improves video SEO reliability.',
        },
    },
    {
        surfaceKey: 'YOUTUBE_SEARCH_CATEGORY_VISIBILITY',
        label: 'YouTube Search (Category Terms)',
        category: 'video',
        importanceTier: 'MEDIUM',
        basePoints: 3,
        sourceType: 'MANUAL_REVIEW',
        queryTemplates: [],
        confirmationArtifact: 'Brand videos ranking for category/product searches on YouTube',
        tooltipTemplates: {
            why: 'Measures discovery beyond brand search; key for scaling awareness and inbound demand.',
        },
    },

    // ============ NEW: COMMUNITY (EXTENDED) ============
    {
        surfaceKey: 'INDUSTRY_FORUM_MENTIONS',
        label: 'Industry Forum Mentions',
        category: 'community',
        importanceTier: 'LOW',
        basePoints: 2,
        sourceType: 'MANUAL_REVIEW',
        queryTemplates: [],
        confirmationArtifact: 'Brand mentioned in relevant industry forums/communities',
        tooltipTemplates: {
            why: 'Reputation and long-tail discovery via niche communities; can influence AI citations.',
        },
    },

    // ============ NEW: TRUST (EXTENDED) ============
    {
        surfaceKey: 'CLUTCH_PROFILE',
        label: 'Clutch Profile',
        category: 'trust',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:clutch.co "{brand}"'],
        confirmationArtifact: 'Clutch company profile with reviews',
        industryOverrides: { 'agency': 1.0, 'software': 0.8, 'b2b_services': 1.0 },
        tooltipTemplates: {
            why: 'Third-party validation for B2B services/products; improves conversion trust and brand authority.',
        },
    },
    {
        surfaceKey: 'GOODFIRMS_PROFILE',
        label: 'GoodFirms Profile',
        category: 'trust',
        importanceTier: 'LOW',
        basePoints: 2,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:goodfirms.co "{brand}"'],
        confirmationArtifact: 'GoodFirms company listing',
        tooltipTemplates: {
            why: 'Third-party review directory; supports trust and referral discovery.',
        },
    },
    {
        surfaceKey: 'GLASSDOOR_PROFILE',
        label: 'Glassdoor Company Profile',
        category: 'trust',
        importanceTier: 'LOW',
        basePoints: 2,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:glassdoor.com "{brand}"'],
        confirmationArtifact: 'Glassdoor employer profile',
        tooltipTemplates: {
            why: 'Employer brand trust; influences buyer confidence and recruiting visibility.',
        },
    },
    {
        surfaceKey: 'AMBITIONBOX_PROFILE',
        label: 'AmbitionBox Company Profile',
        category: 'trust',
        importanceTier: 'LOW',
        basePoints: 2,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:ambitionbox.com "{brand}"'],
        confirmationArtifact: 'AmbitionBox employer profile',
        geoOverrides: { 'india': 1.0, 'global': 0.1 },
        tooltipTemplates: {
            why: 'India employer reputation surface; impacts brand trust and hiring pipeline.',
        },
    },
    {
        surfaceKey: 'JUSTDIAL_LISTING',
        label: 'JustDial Listing',
        category: 'trust',
        importanceTier: 'MEDIUM',
        basePoints: 3,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:justdial.com "{brand}"'],
        confirmationArtifact: 'JustDial business listing',
        geoOverrides: { 'india': 1.0, 'global': 0.1 },
        tooltipTemplates: {
            why: 'India local discovery + credibility listing for many commercial categories.',
        },
    },

    // ============ NEW: AUTHORITY (EXTENDED) ============
    {
        surfaceKey: 'WIKIDATA_ENTITY',
        label: 'Wikidata Entity',
        category: 'authority',
        importanceTier: 'HIGH',
        basePoints: 8,
        sourceType: 'MANUAL_REVIEW',
        queryTemplates: [],
        confirmationArtifact: 'Wikidata entity (Q-ID) for company/brand',
        tooltipTemplates: {
            why: 'Structured entity graph for machines/LLMs; stabilizes brand facts and relationships.',
        },
    },

    // ============ NEW: MARKETPLACE (EXTENDED) ============
    {
        surfaceKey: 'TRADEINDIA_LISTING',
        label: 'TradeIndia Listing',
        category: 'marketplace',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:tradeindia.com "{brand}"'],
        confirmationArtifact: 'TradeIndia supplier listing',
        geoOverrides: { 'india': 1.0, 'global': 0.2 },
        tooltipTemplates: {
            why: 'India B2B marketplace discovery; supports supplier verification and lead gen.',
        },
    },
    {
        surfaceKey: 'EXPORTERSINDIA_LISTING',
        label: 'ExportersIndia Listing',
        category: 'marketplace',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:exportersindia.com "{brand}"'],
        confirmationArtifact: 'ExportersIndia supplier listing',
        geoOverrides: { 'india': 1.0, 'global': 0.2 },
        tooltipTemplates: {
            why: 'Exporter discovery surface; supports international inbound and directory citations.',
        },
    },
    {
        surfaceKey: 'GLOBALSOURCES_LISTING',
        label: 'GlobalSources Listing',
        category: 'marketplace',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:globalsources.com "{brand}"'],
        confirmationArtifact: 'GlobalSources supplier listing',
        industryOverrides: { 'b2b_manufacturing': 1.0, 'export': 1.0 },
        tooltipTemplates: {
            why: 'Global B2B directory/marketplace; strengthens authority + export lead flow.',
        },
    },
    {
        surfaceKey: 'KOMPASS_PROFILE',
        label: 'Kompass Profile',
        category: 'marketplace',
        importanceTier: 'LOW',
        basePoints: 2,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['site:kompass.com "{brand}"'],
        confirmationArtifact: 'Kompass company profile',
        tooltipTemplates: {
            why: 'International business directory; can appear in brand/category queries and AI citations.',
        },
    },

    // ============ NEW: AEO / LLM ============
    {
        surfaceKey: 'ORG_SCHEMA_SAMEAS_COMPLETE',
        label: 'Organization Schema (sameAs Complete)',
        category: 'aeo',
        importanceTier: 'CRITICAL',
        basePoints: 10,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'Organization schema with comprehensive sameAs array linking official profiles',
        tooltipTemplates: {
            why: 'Connects official profiles/listings; improves entity reconciliation for Google + LLMs.',
        },
    },
    {
        surfaceKey: 'FAQ_SCHEMA_PRESENT',
        label: 'FAQ Schema Markup',
        category: 'aeo',
        importanceTier: 'HIGH',
        basePoints: 6,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'FAQPage schema detected on relevant pages',
        tooltipTemplates: {
            why: 'Supports question-answer retrieval and rich results; helps AEO and mid-funnel queries.',
        },
    },
    {
        surfaceKey: 'LLMS_TXT_PRESENT',
        label: 'llms.txt Present',
        category: 'aeo',
        importanceTier: 'MEDIUM',
        basePoints: 3,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'llms.txt file present at /llms.txt',
        tooltipTemplates: {
            why: 'AI-crawler guidance for content consumption; improves LLM ingestion usability (emerging).',
        },
    },

    // ============ NEW: PERFORMANCE & SECURITY ============
    {
        surfaceKey: 'CORE_WEB_VITALS_STATUS',
        label: 'Core Web Vitals (PSI)',
        category: 'performance_security',
        importanceTier: 'HIGH',
        basePoints: 8,
        sourceType: 'PAGESPEED_API',
        queryTemplates: [],
        confirmationArtifact: 'All Core Web Vitals passing PageSpeed Insights assessment',
        presenceRules: { present: 'All CWV pass', partial: 'Some CWV pass', absent: 'All CWV fail' },
        tooltipTemplates: {
            why: 'Performance UX baseline; impacts rankings, crawl efficiency, and conversion rates.',
        },
    },
    {
        surfaceKey: 'SECURITY_HEADERS_PRESENT',
        label: 'Security Headers (HSTS/CSP/etc.)',
        category: 'performance_security',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'HSTS, CSP, X-Frame-Options, X-Content-Type-Options headers present',
        presenceRules: { present: 'All critical headers', partial: 'Some headers', absent: 'No headers' },
        tooltipTemplates: {
            why: 'Security posture trust signal; reduces risk and improves enterprise confidence.',
        },
    },
    {
        surfaceKey: 'DMARC_POLICY_ENFORCED',
        label: 'DMARC Enforced (p=quarantine/reject)',
        category: 'technical',
        importanceTier: 'HIGH',
        basePoints: 6,
        sourceType: 'DNS_LOOKUP',
        queryTemplates: [],
        confirmationArtifact: 'DMARC DNS record with p=quarantine or p=reject policy',
        tooltipTemplates: {
            why: 'Email domain trust; reduces spoofing, improves deliverability and brand integrity.',
        },
    },
    {
        surfaceKey: 'BIMI_PRESENT',
        label: 'BIMI (Brand Logo in Inbox)',
        category: 'technical',
        importanceTier: 'MEDIUM',
        basePoints: 3,
        sourceType: 'DNS_LOOKUP',
        queryTemplates: [],
        confirmationArtifact: 'BIMI DNS record present with valid logo URL',
        tooltipTemplates: {
            why: 'Brand trust in email; improves recognition and phishing resistance (requires DMARC).',
        },
    },
    {
        surfaceKey: 'MTA_STS_PRESENT',
        label: 'MTA-STS',
        category: 'technical',
        importanceTier: 'LOW',
        basePoints: 2,
        sourceType: 'DNS_LOOKUP',
        queryTemplates: [],
        confirmationArtifact: 'MTA-STS DNS record and policy file present',
        tooltipTemplates: {
            why: 'Email transport security; improves domain trust and reduces downgrade attacks.',
        },
    },
    {
        surfaceKey: 'TLS_RPT_PRESENT',
        label: 'TLS-RPT',
        category: 'technical',
        importanceTier: 'LOW',
        basePoints: 2,
        sourceType: 'DNS_LOOKUP',
        queryTemplates: [],
        confirmationArtifact: 'TLS-RPT DNS record with reporting email/endpoint',
        tooltipTemplates: {
            why: 'Reporting for email TLS issues; supports deliverability monitoring.',
        },
    },

    // ============ E-E-A-T + ENTITY ============
    {
        surfaceKey: 'WIKIDATA_ENTITY_COMPLETENESS',
        label: 'Wikidata Entity Completeness',
        category: 'eeat_entity',
        importanceTier: 'HIGH',
        basePoints: 8,
        sourceType: 'MANUAL_REVIEW',
        queryTemplates: [],
        confirmationArtifact: 'Wikidata entity with complete facts (name, website, industry, country, social links)',
        tooltipTemplates: {
            why: 'Validates structured entity facts. Reduces entity ambiguity for Google/LLMs.',
        },
    },
    {
        surfaceKey: 'KNOWLEDGE_PANEL_FACTS_CONSISTENT',
        label: 'Knowledge Panel Facts Consistency',
        category: 'eeat_entity',
        importanceTier: 'CRITICAL',
        basePoints: 10,
        sourceType: 'MANUAL_REVIEW',
        queryTemplates: [],
        confirmationArtifact: 'Knowledge Panel shows correct website, logo, socials, founders, location',
        tooltipTemplates: {
            why: 'Prevents entity splitting and misinformation. Critical for brand SERP control.',
        },
    },
    {
        surfaceKey: 'NAP_CONSISTENCY_CHECK',
        label: 'NAP Consistency (Name/Address/Phone)',
        category: 'eeat_entity',
        importanceTier: 'HIGH',
        basePoints: 6,
        sourceType: 'MANUAL_REVIEW',
        queryTemplates: [],
        confirmationArtifact: 'Consistent NAP across web listings and directories',
        tooltipTemplates: {
            why: 'Strengthens local/entity trust signals and reduces duplicate entities.',
        },
    },
    {
        surfaceKey: 'BRAND_ASSETS_CONSISTENCY',
        label: 'Brand Assets Consistency (Logo/Name/URL)',
        category: 'eeat_entity',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'MANUAL_REVIEW',
        queryTemplates: [],
        confirmationArtifact: 'Same logo, brand name, and canonical URL across key profiles and directories',
        tooltipTemplates: {
            why: 'Improves entity reconciliation for Google/LLMs.',
        },
    },
    {
        surfaceKey: 'CASE_STUDIES_HUB_PRESENT',
        label: 'Case Studies / Proof Hub',
        category: 'eeat_entity',
        importanceTier: 'CRITICAL',
        basePoints: 10,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'Dedicated case studies section with projects, outcomes, specs, photos, client type',
        tooltipTemplates: {
            why: 'Evidence of real-world experience. Strong E-E-A-T and conversion driver for B2B.',
        },
    },
    {
        surfaceKey: 'TESTIMONIALS_WITH_CONTEXT',
        label: 'Testimonials with Context',
        category: 'eeat_entity',
        importanceTier: 'HIGH',
        basePoints: 6,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'Testimonials tied to specific use-cases (industry, scope, outcome)',
        tooltipTemplates: {
            why: 'Increases trust beyond generic quotes and helps AI systems cite you confidently.',
        },
    },
    {
        surfaceKey: 'PROOF_MEDIA_LIBRARY',
        label: 'Proof Media Library (Factory/Projects)',
        category: 'eeat_entity',
        importanceTier: 'HIGH',
        basePoints: 6,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'Authentic photos/videos of team, facility, installations, demos',
        tooltipTemplates: {
            why: 'Reinforces "experience" and reduces perceived risk for buyers.',
        },
    },
    {
        surfaceKey: 'AUTHOR_PAGES_PRESENT',
        label: 'Author Pages (Experts/Leaders)',
        category: 'eeat_entity',
        importanceTier: 'HIGH',
        basePoints: 6,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'Dedicated author bios for technical content creators/leaders',
        tooltipTemplates: {
            why: 'Improves perceived expertise and trust for content-led acquisition.',
        },
    },
    {
        surfaceKey: 'AUTHOR_SCHEMA_PRESENT',
        label: 'Author Schema (Person)',
        category: 'eeat_entity',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'Structured Person schema for key authors/leaders',
        tooltipTemplates: {
            why: 'Helps machines connect content to credible people. Supports E-E-A-T and AEO.',
        },
    },
    {
        surfaceKey: 'EDITORIAL_POLICY_PAGE',
        label: 'Editorial Policy Page',
        category: 'eeat_entity',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'Page explaining how content is created, reviewed, updated, and by whom',
        tooltipTemplates: {
            why: 'Improves trust signals for Google and enterprise buyers.',
        },
    },
    {
        surfaceKey: 'CERTIFICATIONS_PAGE_PRESENT',
        label: 'Certifications / Compliance Page',
        category: 'eeat_entity',
        importanceTier: 'HIGH',
        basePoints: 6,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'Page displaying relevant certifications/standards, test methods, compliance proofs',
        tooltipTemplates: {
            why: 'Strong trust signal for B2B manufacturing/tech buyers.',
        },
    },
    {
        surfaceKey: 'BUSINESS_VERIFICATION_SIGNALS',
        label: 'Business Verification Signals',
        category: 'eeat_entity',
        importanceTier: 'HIGH',
        basePoints: 6,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'Visible company identity signals (legal name, registration, addresses, contact methods)',
        tooltipTemplates: {
            why: 'Reduces fraud perception and improves trust.',
        },
    },
    {
        surfaceKey: 'SERVICE_SUPPORT_PAGES',
        label: 'Service / Support / Warranty Pages',
        category: 'eeat_entity',
        importanceTier: 'HIGH',
        basePoints: 6,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'After-sales clarity (installation, warranty, support process)',
        tooltipTemplates: {
            why: 'Increases buyer confidence and reduces pre-sales friction.',
        },
    },
    {
        surfaceKey: 'PRESS_MEDIA_MENTIONS',
        label: 'Press / Media Mentions',
        category: 'eeat_entity',
        importanceTier: 'HIGH',
        basePoints: 6,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['{brand} news', '{brand} press release', '{brand} featured'],
        confirmationArtifact: 'Third-party recognition (trade magazines, portals, interviews)',
        tooltipTemplates: {
            why: 'Boosts authority and improves brand SERP trust.',
        },
    },
    {
        surfaceKey: 'ASSOCIATION_MEMBERSHIPS_LISTED',
        label: 'Industry Association Memberships',
        category: 'eeat_entity',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'MANUAL_REVIEW',
        queryTemplates: [],
        confirmationArtifact: 'Memberships in credible industry bodies listed on website',
        tooltipTemplates: {
            why: 'Strengthens authority and can generate high-trust citations/backlinks.',
        },
    },
    {
        surfaceKey: 'CONFERENCE_SPEAKING_EVENTS',
        label: 'Conference Speaking / Event Listings',
        category: 'eeat_entity',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'DATAFORSEO_SERP',
        searchEngine: 'google',
        queryTemplates: ['{brand} conference', '{brand} speaker', '{brand} event'],
        confirmationArtifact: 'Public speaking and event listings',
        tooltipTemplates: {
            why: 'Third-party validation and authority for your experts and brand.',
        },
    },
    {
        surfaceKey: 'PRODUCT_SCHEMA_PRESENT',
        label: 'Product Schema for Core Offerings',
        category: 'eeat_entity',
        importanceTier: 'HIGH',
        basePoints: 6,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'Product schema on product/service pages with specs, price, availability',
        tooltipTemplates: {
            why: 'Improves Google understanding and LLM extraction for your products.',
        },
    },
    {
        surfaceKey: 'DATASHEETS_DOWNLOAD_HUB',
        label: 'Datasheets / Catalog Download Hub',
        category: 'eeat_entity',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'Technical PDFs (datasheets, brochures, manuals) available for download',
        tooltipTemplates: {
            why: 'Improves buyer trust and increases citation likelihood in AI answers.',
        },
    },
    {
        surfaceKey: 'WEBINARS_EVENTS_ARCHIVE',
        label: 'Webinars / Events Archive',
        category: 'eeat_entity',
        importanceTier: 'MEDIUM',
        basePoints: 4,
        sourceType: 'WEBSITE_CRAWL',
        queryTemplates: [],
        confirmationArtifact: 'Recorded sessions + landing pages (ideally with transcripts)',
        tooltipTemplates: {
            why: 'Strengthens expertise proof and creates long-tail discovery surfaces.',
        },
    },
];

// POST - Seed or upsert surfaces (adds missing, updates existing if ?reset=true)
export async function POST(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const reset = searchParams.get('reset') === 'true';

        if (reset) {
            // Full reset: Delete all and recreate
            await prisma.footprintSurfaceRegistry.deleteMany();

            const created = await prisma.footprintSurfaceRegistry.createMany({
                data: DEFAULT_SURFACES.map(s => {
                    const src = s as any;
                    const hist = HISTORICAL_METADATA[src.surfaceKey] || {};
                    return {
                        surfaceKey: src.surfaceKey,
                        label: src.label,
                        category: src.category,
                        importanceTier: src.importanceTier,
                        basePoints: src.basePoints,
                        defaultRelevanceWeight: 1.0,
                        sourceType: src.sourceType,
                        searchEngine: src.searchEngine || null,
                        queryTemplates: (src.queryTemplates || []) as Prisma.InputJsonValue,
                        maxQueries: src.maxQueries || 2,
                        confirmationArtifact: src.confirmationArtifact,
                        presenceRules: src.presenceRules ? (src.presenceRules as Prisma.InputJsonValue) : Prisma.DbNull,
                        officialnessRules: src.officialnessRules ? (src.officialnessRules as Prisma.InputJsonValue) : Prisma.DbNull,
                        officialnessRequired: src.officialnessRequired ?? true,
                        evidenceFields: src.evidenceFields ? (src.evidenceFields as Prisma.InputJsonValue) : Prisma.DbNull,
                        tooltipTemplates: src.tooltipTemplates ? (src.tooltipTemplates as Prisma.InputJsonValue) : Prisma.DbNull,
                        enabled: src.enabled ?? true,
                        notes: src.notes || null,
                        industryOverrides: src.industryOverrides ? (src.industryOverrides as Prisma.InputJsonValue) : Prisma.DbNull,
                        geoOverrides: src.geoOverrides ? (src.geoOverrides as Prisma.InputJsonValue) : Prisma.DbNull,
                        // Historical metadata
                        launchYear: hist.launchYear || null,
                        technicalName: hist.technicalName || null,
                        businessImpact: hist.businessImpact ? (hist.businessImpact as Prisma.InputJsonValue) : Prisma.DbNull,
                    };
                }),
            });

            return NextResponse.json({
                success: true,
                message: `Reset complete. Seeded ${created.count} surfaces`,
                count: created.count,
            });
        }

        // Default: Upsert - add missing surfaces, keep existing
        const existingKeys = new Set(
            (await prisma.footprintSurfaceRegistry.findMany({ select: { surfaceKey: true } }))
                .map(s => s.surfaceKey)
        );

        const newSurfaces = DEFAULT_SURFACES.filter(s => !existingKeys.has(s.surfaceKey));

        if (newSurfaces.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No new surfaces to add. All surfaces already exist.',
                added: 0,
                existing: existingKeys.size,
            });
        }

        const created = await prisma.footprintSurfaceRegistry.createMany({
            data: newSurfaces.map(s => {
                const src = s as any;
                const hist = HISTORICAL_METADATA[src.surfaceKey] || {};
                return {
                    surfaceKey: src.surfaceKey,
                    label: src.label,
                    category: src.category,
                    importanceTier: src.importanceTier,
                    basePoints: src.basePoints,
                    defaultRelevanceWeight: 1.0,
                    sourceType: src.sourceType,
                    searchEngine: src.searchEngine || null,
                    queryTemplates: (src.queryTemplates || []) as Prisma.InputJsonValue,
                    maxQueries: src.maxQueries || 2,
                    confirmationArtifact: src.confirmationArtifact,
                    presenceRules: src.presenceRules ? (src.presenceRules as Prisma.InputJsonValue) : Prisma.DbNull,
                    officialnessRules: src.officialnessRules ? (src.officialnessRules as Prisma.InputJsonValue) : Prisma.DbNull,
                    officialnessRequired: src.officialnessRequired ?? true,
                    evidenceFields: src.evidenceFields ? (src.evidenceFields as Prisma.InputJsonValue) : Prisma.DbNull,
                    tooltipTemplates: src.tooltipTemplates ? (src.tooltipTemplates as Prisma.InputJsonValue) : Prisma.DbNull,
                    enabled: src.enabled ?? true,
                    notes: src.notes || null,
                    industryOverrides: src.industryOverrides ? (src.industryOverrides as Prisma.InputJsonValue) : Prisma.DbNull,
                    geoOverrides: src.geoOverrides ? (src.geoOverrides as Prisma.InputJsonValue) : Prisma.DbNull,
                    // Historical metadata
                    launchYear: hist.launchYear || null,
                    technicalName: hist.technicalName || null,
                    businessImpact: hist.businessImpact ? (hist.businessImpact as Prisma.InputJsonValue) : Prisma.DbNull,
                };
            }),
        });

        return NextResponse.json({
            success: true,
            message: `Added ${created.count} new surfaces`,
            added: created.count,
            existing: existingKeys.size,
            total: existingKeys.size + created.count,
        });
    } catch (error) {
        console.error('Failed to seed registry:', error);
        return NextResponse.json({ error: 'Failed to seed registry' }, { status: 500 });
    }
}
