// CMS SEO - SEO Score Calculator

export interface SEOScoreInput {
    title: string;
    metaDescription: string;
    bodyContent: string;
    primaryKeyword: string;
    keywords: string[];
    url: string;
    hasImages: boolean;
    hasHeadings: boolean;
    hasInternalLinks: boolean;
    hasExternalLinks: boolean;
    hasFAQ: boolean;
}

export interface SEOScoreResult {
    score: number; // 0-100
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    checks: SEOCheck[];
    suggestions: string[];
}

export interface SEOCheck {
    name: string;
    passed: boolean;
    score: number;
    maxScore: number;
    message: string;
}

// Calculate SEO score
export function calculateSEOScore(input: SEOScoreInput): SEOScoreResult {
    const checks: SEOCheck[] = [];
    const suggestions: string[] = [];

    // 1. Title checks (15 points max)
    const titleLength = input.title.length;
    const titleHasKeyword = input.primaryKeyword
        ? input.title.toLowerCase().includes(input.primaryKeyword.toLowerCase())
        : false;

    if (titleLength >= 30 && titleLength <= 60) {
        checks.push({
            name: 'Title Length',
            passed: true,
            score: 10,
            maxScore: 10,
            message: `Title length is optimal (${titleLength} characters)`,
        });
    } else if (titleLength > 0) {
        checks.push({
            name: 'Title Length',
            passed: false,
            score: 5,
            maxScore: 10,
            message: titleLength < 30
                ? `Title is too short (${titleLength} chars). Aim for 30-60 characters.`
                : `Title is too long (${titleLength} chars). Keep under 60 characters.`,
        });
        suggestions.push('Optimize title length to 30-60 characters for better display in search results');
    } else {
        checks.push({
            name: 'Title Length',
            passed: false,
            score: 0,
            maxScore: 10,
            message: 'Missing title',
        });
        suggestions.push('Add a compelling title to your page');
    }

    checks.push({
        name: 'Keyword in Title',
        passed: titleHasKeyword,
        score: titleHasKeyword ? 5 : 0,
        maxScore: 5,
        message: titleHasKeyword
            ? 'Primary keyword found in title'
            : 'Primary keyword not found in title',
    });
    if (!titleHasKeyword && input.primaryKeyword) {
        suggestions.push('Include your primary keyword in the title');
    }

    // 2. Meta description checks (15 points max)
    const descLength = input.metaDescription.length;
    const descHasKeyword = input.primaryKeyword
        ? input.metaDescription.toLowerCase().includes(input.primaryKeyword.toLowerCase())
        : false;

    if (descLength >= 120 && descLength <= 160) {
        checks.push({
            name: 'Meta Description Length',
            passed: true,
            score: 10,
            maxScore: 10,
            message: `Meta description length is optimal (${descLength} characters)`,
        });
    } else if (descLength > 0) {
        checks.push({
            name: 'Meta Description Length',
            passed: false,
            score: 5,
            maxScore: 10,
            message: descLength < 120
                ? `Meta description is short (${descLength} chars). Aim for 120-160 characters.`
                : `Meta description is long (${descLength} chars). Keep under 160 characters.`,
        });
        suggestions.push('Optimize meta description to 120-160 characters');
    } else {
        checks.push({
            name: 'Meta Description Length',
            passed: false,
            score: 0,
            maxScore: 10,
            message: 'Missing meta description',
        });
        suggestions.push('Add a compelling meta description');
    }

    checks.push({
        name: 'Keyword in Description',
        passed: descHasKeyword,
        score: descHasKeyword ? 5 : 0,
        maxScore: 5,
        message: descHasKeyword
            ? 'Primary keyword found in meta description'
            : 'Primary keyword not found in meta description',
    });
    if (!descHasKeyword && input.primaryKeyword) {
        suggestions.push('Include your primary keyword in the meta description');
    }

    // 3. Content checks (30 points max)
    const wordCount = input.bodyContent.split(/\s+/).filter(Boolean).length;
    const contentHasKeyword = input.primaryKeyword
        ? input.bodyContent.toLowerCase().includes(input.primaryKeyword.toLowerCase())
        : false;

    if (wordCount >= 1500) {
        checks.push({
            name: 'Content Length',
            passed: true,
            score: 15,
            maxScore: 15,
            message: `Excellent content length (${wordCount} words)`,
        });
    } else if (wordCount >= 800) {
        checks.push({
            name: 'Content Length',
            passed: true,
            score: 10,
            maxScore: 15,
            message: `Good content length (${wordCount} words). Consider adding more content.`,
        });
    } else if (wordCount >= 300) {
        checks.push({
            name: 'Content Length',
            passed: false,
            score: 5,
            maxScore: 15,
            message: `Content is thin (${wordCount} words). Aim for 1500+ words.`,
        });
        suggestions.push('Add more comprehensive content (1500+ words recommended)');
    } else {
        checks.push({
            name: 'Content Length',
            passed: false,
            score: 0,
            maxScore: 15,
            message: `Very short content (${wordCount} words)`,
        });
        suggestions.push('Add substantial content to improve SEO');
    }

    checks.push({
        name: 'Keyword in Content',
        passed: contentHasKeyword,
        score: contentHasKeyword ? 10 : 0,
        maxScore: 10,
        message: contentHasKeyword
            ? 'Primary keyword found in content'
            : 'Primary keyword not found in content',
    });

    checks.push({
        name: 'Has Headings',
        passed: input.hasHeadings,
        score: input.hasHeadings ? 5 : 0,
        maxScore: 5,
        message: input.hasHeadings
            ? 'Content uses proper heading structure'
            : 'Missing heading structure',
    });
    if (!input.hasHeadings) {
        suggestions.push('Use H2 and H3 headings to structure your content');
    }

    // 4. Media & Links (20 points max)
    checks.push({
        name: 'Has Images',
        passed: input.hasImages,
        score: input.hasImages ? 10 : 0,
        maxScore: 10,
        message: input.hasImages
            ? 'Page includes images'
            : 'No images found on page',
    });
    if (!input.hasImages) {
        suggestions.push('Add relevant images to enhance content');
    }

    checks.push({
        name: 'Has Internal Links',
        passed: input.hasInternalLinks,
        score: input.hasInternalLinks ? 5 : 0,
        maxScore: 5,
        message: input.hasInternalLinks
            ? 'Page has internal links'
            : 'No internal links found',
    });
    if (!input.hasInternalLinks) {
        suggestions.push('Add internal links to related content');
    }

    checks.push({
        name: 'Has External Links',
        passed: input.hasExternalLinks,
        score: input.hasExternalLinks ? 5 : 0,
        maxScore: 5,
        message: input.hasExternalLinks
            ? 'Page has external links'
            : 'No external links found',
    });

    // 5. Structured Data (10 points max)
    checks.push({
        name: 'Has FAQ Section',
        passed: input.hasFAQ,
        score: input.hasFAQ ? 10 : 0,
        maxScore: 10,
        message: input.hasFAQ
            ? 'Page includes FAQ section (good for rich snippets)'
            : 'No FAQ section found',
    });
    if (!input.hasFAQ) {
        suggestions.push('Add FAQ section for rich snippet opportunities');
    }

    // 6. URL check (10 points max)
    const urlSlug = input.url.split('/').pop() || '';
    const urlHasKeyword = input.primaryKeyword
        ? urlSlug.toLowerCase().includes(
            input.primaryKeyword.toLowerCase().replace(/\s+/g, '-')
        )
        : false;

    checks.push({
        name: 'Keyword in URL',
        passed: urlHasKeyword,
        score: urlHasKeyword ? 10 : 5,
        maxScore: 10,
        message: urlHasKeyword
            ? 'URL contains the primary keyword'
            : 'Consider including keyword in URL',
    });

    // Calculate total score
    const totalScore = checks.reduce((sum, check) => sum + check.score, 0);
    const maxPossible = checks.reduce((sum, check) => sum + check.maxScore, 0);
    const percentage = Math.round((totalScore / maxPossible) * 100);

    // Determine grade
    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (percentage >= 90) grade = 'A';
    else if (percentage >= 80) grade = 'B';
    else if (percentage >= 70) grade = 'C';
    else if (percentage >= 60) grade = 'D';
    else grade = 'F';

    return {
        score: percentage,
        grade,
        checks,
        suggestions: suggestions.slice(0, 5), // Top 5 suggestions
    };
}
