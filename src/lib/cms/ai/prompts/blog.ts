// CMS AI Content Generation - Blog Prompts

export interface BlogGenerationInput {
    topic: string;
    primaryKeyword: string;
    keywords: string[];
    searchVolume: number;
    intentType: string;
    clientInfo: {
        name: string;
        industry: string;
        tone?: string;
    };
}

export interface BlogGenerationOutput {
    hero: {
        title: string;
        subtitle: string;
    };
    body: string;
    faqs: Array<{
        question: string;
        answer: string;
    }>;
    meta: {
        title: string;
        description: string;
        keywords: string;
    };
}

export function buildBlogPrompt(input: BlogGenerationInput): string {
    const keywordList = input.keywords.slice(0, 10).join(', ');

    return `You are an expert SEO content writer creating a comprehensive blog article.

## TOPIC INFORMATION
- **Topic**: ${input.topic}
- **Primary Keyword**: ${input.primaryKeyword}
- **Related Keywords**: ${keywordList}
- **Monthly Search Volume**: ${input.searchVolume}
- **Search Intent**: ${input.intentType}

## CLIENT CONTEXT
- **Business Name**: ${input.clientInfo.name}
- **Industry**: ${input.clientInfo.industry}
- **Tone**: ${input.clientInfo.tone || 'Professional and informative'}

## CONTENT REQUIREMENTS

Generate a complete blog article with the following sections:

### 1. HERO SECTION
Create a compelling headline and subtitle that:
- Includes the primary keyword naturally
- Creates curiosity and promises value
- Is optimized for CTR in search results

### 2. MAIN BODY CONTENT
Write a comprehensive article (2000-2500 words) that:
- Uses proper H2 and H3 heading structure
- Naturally incorporates the primary and related keywords
- Provides actionable, valuable information
- Includes bullet points and numbered lists where appropriate
- Follows the ${input.intentType} search intent
- Uses clear, scannable formatting

### 3. FAQ SECTION
Generate 5-7 commonly asked questions related to the topic that:
- Address real user queries
- Include keywords naturally
- Provide concise, helpful answers
- Are suitable for FAQ schema markup

### 4. META DATA
Create SEO-optimized metadata:
- Meta Title (50-60 characters)
- Meta Description (150-160 characters)
- Focus Keywords (comma-separated)

## OUTPUT FORMAT
Respond in valid JSON format:
{
  "hero": {
    "title": "Compelling headline here",
    "subtitle": "Engaging subtitle that expands on the headline"
  },
  "body": "<h2>First Section</h2><p>Content with proper HTML formatting...</p>",
  "faqs": [
    {"question": "Question 1?", "answer": "Answer 1"},
    {"question": "Question 2?", "answer": "Answer 2"}
  ],
  "meta": {
    "title": "SEO Title | Brand",
    "description": "Meta description here",
    "keywords": "keyword1, keyword2, keyword3"
  }
}

IMPORTANT: 
- Return ONLY valid JSON, no markdown code blocks
- Use proper HTML tags in the body content (h2, h3, p, ul, li, strong, em)
- Ensure all content is original and valuable`;
}

export function buildBlogRegenerationPrompt(
    section: 'hero' | 'body' | 'faqs',
    currentContent: string,
    input: BlogGenerationInput,
    instructions?: string
): string {
    const sectionPrompts = {
        hero: `Regenerate the hero section (title and subtitle) for this blog article.
Current: ${currentContent}
${instructions ? `User Instructions: ${instructions}` : ''}

Return JSON: {"title": "...", "subtitle": "..."}`,

        body: `Regenerate the main body content for this blog article.
Topic: ${input.topic}
Keywords: ${input.keywords.slice(0, 5).join(', ')}
${instructions ? `User Instructions: ${instructions}` : ''}

Return the HTML content as a string.`,

        faqs: `Regenerate the FAQ section for this blog article.
Topic: ${input.topic}
${instructions ? `User Instructions: ${instructions}` : ''}

Return JSON array: [{"question": "...", "answer": "..."}, ...]`
    };

    return sectionPrompts[section];
}
