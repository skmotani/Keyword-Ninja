import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getCompetitors, updateCompetitor } from '@/lib/db';
import { getActiveCredentialByService } from '@/lib/apiCredentialsStore';

async function getOpenAIKey() {
    // Try credential store first (Settings → API Credentials)
    const credential = await getActiveCredentialByService('OPENAI');

    // Use stored key or fallback to env var
    const apiKey = credential?.apiKey || credential?.apiKeyMasked || process.env.OPENAI_API_KEY;

    // Don't use masked values
    if (apiKey && apiKey.startsWith('****')) {
        return process.env.OPENAI_API_KEY;
    }

    return (credential?.apiKey && !credential.apiKey.startsWith('****'))
        ? credential.apiKey
        : process.env.OPENAI_API_KEY;
}

export async function POST(request: NextRequest) {
    try {
        const { domains } = await request.json();

        if (!domains || !Array.isArray(domains) || domains.length === 0) {
            return NextResponse.json({ error: 'List of domains is required' }, { status: 400 });
        }

        const apiKey = await getOpenAIKey();
        if (!apiKey) {
            return NextResponse.json({ error: 'OpenAI API Key not configured. Please set it in Settings → API Credentials.' }, { status: 500 });
        }

        const openai = new OpenAI({ apiKey });

        console.log(`[Bulk-Brand] Processing ${domains.length} domains...`);

        const targetDomains = domains.slice(0, 100);

        const prompt = `
        You are a Data Cleaning Specialist.
        I will provide a list of domain names.
        
        Task: Identify the **Official Brand Name** for each domain.
        
        Rules:
        1. **Strip fluff**: Remove "Private Limited", "Inc", "Co", "Official Site", "Best Coaching", "Manufacturer".
        2. **Fix formatting**: "chemved.com" -> "Chem Ved Academy" (if known) or "Chemved". "my-brand-name.com" -> "My Brand Name".
        3. **Consistency**: Use Title Case.
        4. **Return JSON Only**: A map where Key = Domain, Value = Brand Name.

        Domains:
        ${targetDomains.join('\n')}
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "You represent a strict clean data extraction engine. Output JSON only." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        });

        const responseContent = completion.choices[0].message.content;
        if (!responseContent) throw new Error("No response from AI");

        const result = JSON.parse(responseContent);
        // Result should be { "domain1.com": "Name1", ... }

        // Load all competitors
        const allCompetitors = await getCompetitors();
        let updatedCount = 0;

        for (const domain of targetDomains) {
            let brandName = result[domain];

            // Fallback: search ignoring case if exact match missing
            if (!brandName) {
                const key = Object.keys(result).find(k => k.toLowerCase() === domain.toLowerCase());
                if (key) brandName = result[key];
            }

            if (brandName) {
                // Find matching competitor(s) by domain
                const matchingCompetitors = allCompetitors.filter(c =>
                    c.domain.toLowerCase().includes(domain.toLowerCase()) ||
                    domain.toLowerCase().includes(c.domain.toLowerCase().replace(/^www\./, ''))
                );

                for (const competitor of matchingCompetitors) {
                    await updateCompetitor(competitor.id, { officialBrandName: brandName });
                    updatedCount++;
                }
            }
        }

        return NextResponse.json({
            success: true,
            updatedCount,
            mapping: result
        });

    } catch (error: any) {
        console.error("Bulk Brand Name Error:", error);
        return NextResponse.json({
            error: "Failed to process bulk names",
            details: error?.message || String(error)
        }, { status: 500 });
    }
}
