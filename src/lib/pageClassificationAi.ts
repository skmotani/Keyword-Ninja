import OpenAI from 'openai';
import {
  PageTypeValue,
  PageClassificationIntent,
  ClassificationConfidenceValue,
  SeoActionValue,
  ClassificationExplanation,
  PageClassificationConfig,
} from '@/types';
import { PageRow, RuleClassificationResult } from './pageClassificationRules';

const VALID_PAGE_TYPES: PageTypeValue[] = [
  'PRODUCT_SERVICE',
  'CATEGORY_COLLECTION',
  'BLOG_ARTICLE_NEWS',
  'RESOURCE_GUIDE_DOC',
  'PRICING_PLANS',
  'LANDING_CAMPAIGN',
  'COMPANY_ABOUT',
  'SUPPORT_CONTACT',
  'CAREERS_HR',
  'LEGAL_POLICY',
  'ACCOUNT_AUTH',
  'OTHER_MISC',
];

const VALID_PAGE_INTENTS: PageClassificationIntent[] = [
  'INFORMATIONAL',
  'COMMERCIAL_RESEARCH',
  'TRANSACTIONAL',
  'NAVIGATIONAL',
  'SUPPORT',
  'IRRELEVANT_SEO',
];

const VALID_SEO_ACTIONS: SeoActionValue[] = [
  'HIGH_PRIORITY_TARGET',
  'CREATE_EQUIVALENT_PAGE',
  'OPTIMIZE_EXISTING_PAGE',
  'ADD_TO_CONTENT_CLUSTER',
  'BACKLINK_PROSPECT',
  'MONITOR_ONLY',
  'IGNORE_IRRELEVANT',
];

const VALID_CONFIDENCES: ClassificationConfidenceValue[] = ['HIGH', 'MEDIUM', 'LOW'];

export interface AiClassificationResult {
  pageType: PageTypeValue;
  pageIntent: PageClassificationIntent;
  isSeoRelevant: boolean;
  classificationMethod: 'AI';
  classificationConfidence: ClassificationConfidenceValue;
  needsAiReview: false;
  seoAction: SeoActionValue;
  explanation: ClassificationExplanation;
}

interface AiResponse {
  pageType: string;
  pageIntent: string;
  isSeoRelevant: boolean;
  classificationConfidence: string;
  seoAction: string;
  reasoning: string;
}

function buildSystemPrompt(): string {
  return `You are a strict page classifier for SEO analysis. You MUST classify pages using ONLY the exact enum values provided below. Return ONLY valid JSON with no additional text.

VALID pageType values (choose exactly one):
- PRODUCT_SERVICE: Product pages, service pages, solution pages
- CATEGORY_COLLECTION: Category listings, product collections, solution overviews
- BLOG_ARTICLE_NEWS: Blog posts, news articles, insights, magazine content
- RESOURCE_GUIDE_DOC: Guides, tutorials, whitepapers, documentation, manuals
- PRICING_PLANS: Pricing pages, subscription plans, rate cards, quotes
- LANDING_CAMPAIGN: Marketing landing pages, promotional campaigns, offers
- COMPANY_ABOUT: About us, company info, team pages, leadership, history
- SUPPORT_CONTACT: Contact forms, support pages, FAQ, help center, dealer locator
- CAREERS_HR: Job listings, career pages, hiring, work with us
- LEGAL_POLICY: Privacy policy, terms of service, cookie policy, disclaimers
- ACCOUNT_AUTH: Login, signup, account management, dashboard, authentication
- OTHER_MISC: Pages that don't fit any other category

VALID pageIntent values (choose exactly one):
- INFORMATIONAL: User wants to learn or understand something
- COMMERCIAL_RESEARCH: User is comparing options, reading reviews, researching before purchase
- TRANSACTIONAL: User wants to buy, order, get a quote, or take action
- NAVIGATIONAL: User is looking for a specific brand or website
- SUPPORT: User needs help, support, or contact information
- IRRELEVANT_SEO: Page has no SEO value (login, legal, account pages)

VALID seoAction values (choose exactly one):
- HIGH_PRIORITY_TARGET: High-traffic commercial page to target and outrank
- CREATE_EQUIVALENT_PAGE: Topic/page type we should create
- OPTIMIZE_EXISTING_PAGE: Existing page to optimize
- ADD_TO_CONTENT_CLUSTER: Supporting content for topic clusters
- BACKLINK_PROSPECT: Good for backlink research/outreach
- MONITOR_ONLY: Watch but no immediate action
- IGNORE_IRRELEVANT: No SEO impact, ignore

VALID classificationConfidence values: HIGH, MEDIUM, LOW

RULES:
1. Return ONLY a JSON object with keys: pageType, pageIntent, isSeoRelevant (boolean), classificationConfidence, seoAction, reasoning
2. Use EXACT enum values as shown above (case-sensitive)
3. Be concise but specific in reasoning (1-2 sentences)
4. If the initial rule-based guess is provided, use it as a starting point but correct if clearly wrong`;
}

function buildUserPrompt(
  row: PageRow,
  config: PageClassificationConfig,
  ruleBasedResult?: RuleClassificationResult
): string {
  let prompt = `Classify this page for SEO analysis:

PAGE URL: ${row.pageUrl}
DOMAIN: ${row.domain}`;

  if (row.keyword) {
    prompt += `\nKEYWORD: ${row.keyword}`;
  }
  if (row.pageTitle) {
    prompt += `\nPAGE TITLE: ${row.pageTitle}`;
  }
  if (row.pageSnippet) {
    prompt += `\nPAGE SNIPPET: ${row.pageSnippet}`;
  }
  if (row.estTraffic || row.etv) {
    prompt += `\nESTIMATED TRAFFIC: ${row.estTraffic ?? row.etv}`;
  }

  prompt += `\n\nCLIENT CONTEXT:
- Brand Names: ${config.brandNames.slice(0, 5).join(', ') || 'N/A'}
- Product Keywords: ${config.productKeywords.slice(0, 10).join(', ') || 'N/A'}
- Service Keywords: ${config.serviceKeywords.slice(0, 5).join(', ') || 'N/A'}`;

  if (ruleBasedResult) {
    prompt += `\n\nINITIAL RULE-BASED GUESS (verify or correct):
- pageType: ${ruleBasedResult.pageType}
- pageIntent: ${ruleBasedResult.pageIntent}
- isSeoRelevant: ${ruleBasedResult.isSeoRelevant}
- seoAction: ${ruleBasedResult.seoAction}
- confidence: ${ruleBasedResult.classificationConfidence}
- Rules fired: ${ruleBasedResult.explanation.firedRules?.join(', ')}`;
  }

  prompt += `\n\nReturn a JSON object with: pageType, pageIntent, isSeoRelevant, classificationConfidence, seoAction, reasoning`;

  return prompt;
}

function parseAndValidateResponse(responseText: string): AiResponse | null {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as AiResponse;

    if (!VALID_PAGE_TYPES.includes(parsed.pageType as PageTypeValue)) return null;
    if (!VALID_PAGE_INTENTS.includes(parsed.pageIntent as PageClassificationIntent)) return null;
    if (!VALID_SEO_ACTIONS.includes(parsed.seoAction as SeoActionValue)) return null;
    if (!VALID_CONFIDENCES.includes(parsed.classificationConfidence as ClassificationConfidenceValue)) return null;
    if (typeof parsed.isSeoRelevant !== 'boolean') return null;

    return parsed;
  } catch {
    return null;
  }
}

export async function classifyPageWithAi(
  row: PageRow,
  config: PageClassificationConfig,
  ruleBasedResult?: RuleClassificationResult
): Promise<AiClassificationResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY not found in environment variables');
    return null;
  }

  const openai = new OpenAI({ apiKey });

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(row, config, ruleBasedResult);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error('Empty response from OpenAI');
      return null;
    }

    const parsed = parseAndValidateResponse(content);
    if (!parsed) {
      console.error('Failed to parse/validate AI response:', content);
      return null;
    }

    return {
      pageType: parsed.pageType as PageTypeValue,
      pageIntent: parsed.pageIntent as PageClassificationIntent,
      isSeoRelevant: parsed.isSeoRelevant,
      classificationMethod: 'AI',
      classificationConfidence: parsed.classificationConfidence as ClassificationConfidenceValue,
      needsAiReview: false,
      seoAction: parsed.seoAction as SeoActionValue,
      explanation: {
        source: 'AI',
        reasoning: parsed.reasoning || 'AI classification completed.',
        inputs: {
          pageUrl: row.pageUrl,
          keyword: row.keyword || null,
          pageTitle: row.pageTitle || null,
          pageSnippet: row.pageSnippet || null,
          configSnapshot: config,
        },
        model: 'gpt-4o-mini',
        prompt: {
          system: systemPrompt.substring(0, 200) + '...',
          user: userPrompt,
        },
        rawResponse: {
          pageType: parsed.pageType,
          pageIntent: parsed.pageIntent,
          isSeoRelevant: parsed.isSeoRelevant,
          classificationConfidence: parsed.classificationConfidence,
          seoAction: parsed.seoAction,
          reasoning: parsed.reasoning,
        },
      },
    };
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return null;
  }
}
