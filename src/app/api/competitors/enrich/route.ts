import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Helper to get OpenAI key
function getOpenAIKey() {
    return process.env.OPENAI_API_KEY;
}

export async function POST(request: NextRequest) {
    try {
        const { domain } = await request.json();

        if (!domain) {
            return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
        }

        const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        const protocol = 'https://';
        const fullUrl = `${protocol}${cleanDomain}`;

        const enrichedData = {
            logos: [] as string[],
            metaTitle: '',
            metaDescription: '',
            officialBrandName: '',
        };

        // 1. Known Logo APIs (High Quality)
        // Google High-Res Favicon (size 128) - Highly reliable
        enrichedData.logos.push(`https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=128`);

        // 2. Fetch Page Content & Deep Scrape
        let title = '';
        let description = '';
        let ogSiteName = '';
        let htmlContent = '';

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const response = await fetch(fullUrl, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                htmlContent = await response.text();

                // Metadata Extraction
                const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
                title = titleMatch ? titleMatch[1].trim() : '';
                enrichedData.metaTitle = title;

                const descMatch = htmlContent.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
                    htmlContent.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
                description = descMatch ? descMatch[1].trim() : '';
                enrichedData.metaDescription = description;

                const ogSiteNameMatch = htmlContent.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']*)["'][^>]*>/i);
                ogSiteName = ogSiteNameMatch ? ogSiteNameMatch[1].trim() : '';

                // OG Image
                const ogImageMatch = htmlContent.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["'][^>]*>/i);
                const scrapedCandidates: { url: string, score: number }[] = [];

                if (ogImageMatch && ogImageMatch[1]) {
                    const ogImageUrl = resolveUrl(ogImageMatch[1], fullUrl);
                    scrapedCandidates.push({ url: ogImageUrl, score: 100 });
                }

                // Deep Scrape: Look for <img> tags with 'logo' in src/id/class/alt
                const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
                let match;

                while ((match = imgRegex.exec(htmlContent)) !== null) {
                    const imgTag = match[0];
                    const src = match[1];

                    if (imgTag.match(/logo/i) || src.match(/logo/i)) {
                        if (!src.match(/facebook|twitter|instagram|linkedin|social|payment|footer|white/i)) {
                            const resolvedSrc = resolveUrl(src, fullUrl);

                            // Calculate Score based on attributes and format
                            let score = 0;
                            if (src.endsWith('.svg')) score += 50;
                            if (src.includes('header') || src.includes('main')) score += 20;

                            // Try to parse width/height
                            const widthMatch = imgTag.match(/width=["']?(\d+)["']?/);
                            const heightMatch = imgTag.match(/height=["']?(\d+)["']?/);
                            if (widthMatch) score += parseInt(widthMatch[1], 10);

                            scrapedCandidates.push({ url: resolvedSrc, score });
                        }
                    }
                }

                // Sort by score (descending)
                scrapedCandidates.sort((a, b) => b.score - a.score);

                // Add the best candidate if exists
                if (scrapedCandidates.length > 0) {
                    enrichedData.logos.push(scrapedCandidates[0].url);
                }
            }
        } catch (e) {
            console.log('Scraping error', e);
        }

        // 3. AI Brand Extraction (Strict)
        const apiKey = getOpenAIKey();
        console.log(`[Enrich] OpenAI Key present: ${!!apiKey}`);

        if (apiKey) {
            try {
                const openai = new OpenAI({ apiKey });
                const aiResponse = await openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'system', content: `You are a specialist in brand identity. 
                        Task: Extract the **Official Brand Name** from the website metadata.
                        
                        Rules:
                        1. **Ignore SEO keywords** (e.g. "Best Online Coaching", "Manufacturer", "Wholesaler").
                        2. **Ignore standard numbers/grades** (e.g. "Class 6-10", "10th", "12th" are NOT brands).
                        3. **Extract the real entity name** (e.g. "Allen" from "Allen Career Institute", "Aakash" from "Aakash Threads").
                        4. If the title is "ALLEN - India's Best...", the brand is "ALLEN".
                        5. If multiple valid names exist, separate with commas.
                        6. If you cannot find a clear brand name, return "Unknown".
                        
                        Return JSON: { "brandName": "..." }` },
                        {
                            role: 'user', content: `Metadata:
                        Domain: ${domain}
                        Title: ${title}
                        Description: ${description}
                        OG Site Name: ${ogSiteName}`
                        }
                    ],
                    response_format: { type: 'json_object' }
                });

                const content = aiResponse.choices[0]?.message?.content;
                console.log(`[Enrich] AI Response for ${domain}:`, content);

                if (content) {
                    const parsed = JSON.parse(content);
                    if (parsed.brandName && parsed.brandName !== 'Unknown') {
                        enrichedData.officialBrandName = parsed.brandName;
                    }
                }
            } catch (aiError) {
                console.error('AI Extraction failed', aiError);
            }
        }

        // Fallback: If AI didn't run or returned empty
        if (!enrichedData.officialBrandName || enrichedData.officialBrandName === 'Unknown') {
            if (ogSiteName) {
                enrichedData.officialBrandName = ogSiteName;
            } else if (title) {
                // Improved Fallback: Avoid taking short last parts blindly
                const parts = title.split(/[|:-]/).map(p => p.trim());

                // Find the part that looks most like a brand (matches domain or is first/last and substantial)
                const domainBase = cleanDomain.split('.')[0];

                let bestPart = '';
                // 1. Look for part containing domain base (ignoring case)
                const domainMatch = parts.find(p => p.toLowerCase().includes(domainBase));
                if (domainMatch) {
                    bestPart = domainMatch;
                } else {
                    // 2. Take the first part if it's not a generic SEO term -> risky, but better than "10th"
                    // Often the brand is at the start "Brand | Slogan"
                    if (parts[0].length < 30) bestPart = parts[0];
                    // Or at the end "Slogan | Brand"
                    else if (parts[parts.length - 1].length < 30) bestPart = parts[parts.length - 1];
                }

                if (bestPart) enrichedData.officialBrandName = bestPart;
                else enrichedData.officialBrandName = cleanDomain; // Last resort
            }
        }

        // Filter and De-duplicate logos
        enrichedData.logos = Array.from(new Set(enrichedData.logos))
            .filter(url => url && !url.includes('data:image'))
            .slice(0, 2); // Strict Limit to 2

        // Decode HTML Entities for final output
        enrichedData.metaTitle = decodeHtml(enrichedData.metaTitle);
        enrichedData.metaDescription = decodeHtml(enrichedData.metaDescription);
        enrichedData.officialBrandName = decodeHtml(enrichedData.officialBrandName);

        return NextResponse.json(enrichedData);
    } catch (error) {
        console.error('Enrichment error:', error);
        return NextResponse.json({ error: 'Failed to enrich domain' }, { status: 500 });
    }
}

function resolveUrl(url: string, baseUrl: string): string {
    if (!url) return '';
    try {
        const urlObj = new URL(url, baseUrl);
        return urlObj.href;
    } catch (e) {
        return url;
    }
}

function decodeHtml(html: string) {
    if (!html) return '';
    return html
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&ndash;/g, '–')
        .replace(/&mdash;/g, '—')
        .replace(/&copy;/g, '©')
        .replace(/&reg;/g, '®')
        .replace(/&trade;/g, '™');
}
