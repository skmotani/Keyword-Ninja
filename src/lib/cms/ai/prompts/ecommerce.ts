// CMS AI Content Generation - E-commerce Prompts

export interface EcommerceGenerationInput {
    topic: string;
    primaryKeyword: string;
    keywords: string[];
    searchVolume: number;
    intentType: string;
    clientInfo: {
        name: string;
        industry: string;
        tone?: string;
        productsContext?: string;
    };
}

export interface EcommerceGenerationOutput {
    hero: {
        title: string;
        subtitle: string;
    };
    categoryDescription: string;
    faqs: Array<{
        question: string;
        answer: string;
    }>;
    meta: {
        title: string;
        description: string;
        keywords: string;
    };
    suggestedFilters: {
        brands: string[];
        priceRanges: string[];
        features: string[];
    };
}

export function buildEcommercePrompt(input: EcommerceGenerationInput): string {
    const keywordList = input.keywords.slice(0, 10).join(', ');

    return `You are an expert e-commerce SEO content writer creating a category page.

## CATEGORY INFORMATION
- **Category/Topic**: ${input.topic}
- **Primary Keyword**: ${input.primaryKeyword}
- **Related Keywords**: ${keywordList}
- **Monthly Search Volume**: ${input.searchVolume}
- **Search Intent**: ${input.intentType}

## CLIENT CONTEXT
- **Store Name**: ${input.clientInfo.name}
- **Industry**: ${input.clientInfo.industry}
- **Product Context**: ${input.clientInfo.productsContext || 'General products in this category'}
- **Tone**: ${input.clientInfo.tone || 'Professional and helpful'}

## CONTENT REQUIREMENTS

Generate content for an e-commerce category page:

### 1. HERO SECTION
Create a compelling category headline and subtitle that:
- Clearly describes the category
- Includes the primary keyword
- Encourages shopping/browsing

### 2. CATEGORY DESCRIPTION
Write an SEO-optimized category description (500-800 words) that:
- Explains what products are in this category
- Highlights key features and benefits
- Uses proper H2/H3 structure
- Naturally incorporates keywords
- Helps customers make informed decisions
- Builds trust with buyers

### 3. FAQ SECTION
Generate 4-6 frequently asked questions about:
- Product selection guidance
- Features and specifications
- Buying considerations
- Common customer concerns

### 4. META DATA
Create SEO-optimized metadata:
- Meta Title (50-60 characters)
- Meta Description (150-160 characters)
- Focus Keywords

### 5. SUGGESTED FILTERS
Suggest relevant filter options for this category:
- Suggested brands (5-8)
- Price ranges (4-5 ranges)
- Key features/attributes (5-8)

## OUTPUT FORMAT
Respond in valid JSON format:
{
  "hero": {
    "title": "Category headline",
    "subtitle": "Engaging subtitle"
  },
  "categoryDescription": "<h2>Section</h2><p>HTML formatted content...</p>",
  "faqs": [
    {"question": "Question 1?", "answer": "Answer 1"},
    {"question": "Question 2?", "answer": "Answer 2"}
  ],
  "meta": {
    "title": "SEO Title | Store",
    "description": "Meta description",
    "keywords": "keyword1, keyword2"
  },
  "suggestedFilters": {
    "brands": ["Brand A", "Brand B"],
    "priceRanges": ["Under $50", "$50-$100"],
    "features": ["Feature 1", "Feature 2"]
  }
}

IMPORTANT: 
- Return ONLY valid JSON, no markdown code blocks
- Use proper HTML tags in categoryDescription (h2, h3, p, ul, li, strong)
- Make content conversion-focused and buyer-helpful`;
}

export function buildEcommerceRegenerationPrompt(
    section: 'hero' | 'categoryDescription' | 'faqs',
    currentContent: string,
    input: EcommerceGenerationInput,
    instructions?: string
): string {
    const sectionPrompts = {
        hero: `Regenerate the hero section for this e-commerce category page.
Current: ${currentContent}
${instructions ? `Instructions: ${instructions}` : ''}

Return JSON: {"title": "...", "subtitle": "..."}`,

        categoryDescription: `Regenerate the category description content.
Category: ${input.topic}
Keywords: ${input.keywords.slice(0, 5).join(', ')}
${instructions ? `Instructions: ${instructions}` : ''}

Return HTML content as a string.`,

        faqs: `Regenerate FAQs for this e-commerce category.
Category: ${input.topic}
${instructions ? `Instructions: ${instructions}` : ''}

Return JSON array: [{"question": "...", "answer": "..."}, ...]`
    };

    return sectionPrompts[section];
}
