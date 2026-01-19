import { NextRequest, NextResponse } from 'next/server';
import { getActiveCredentialByService } from '@/lib/apiCredentialsStore';
import OpenAI from 'openai';

// Helper to actually validate OpenAI key
async function validateOpenAI(apiKey: string): Promise<boolean> {
    try {
        const openai = new OpenAI({ apiKey, timeout: 5000 });
        // Simple models list call - cheap and fast
        await openai.models.list();
        return true;
    } catch (e: any) {
        console.log('[API Status] OpenAI validation failed:', e?.message);
        return false;
    }
}

// Helper to validate DataForSEO credentials
async function validateDataForSEO(login: string, password: string): Promise<boolean> {
    try {
        const auth = Buffer.from(`${login}:${password}`).toString('base64');
        const res = await fetch('https://api.dataforseo.com/v3/appendix/user_data', {
            method: 'GET',
            headers: { 'Authorization': `Basic ${auth}` },
            signal: AbortSignal.timeout(5000)
        });
        return res.ok;
    } catch (e: any) {
        console.log('[API Status] DataForSEO validation failed:', e?.message);
        return false;
    }
}

// Helper to validate Gemini key
async function validateGemini(apiKey: string): Promise<boolean> {
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });
        return res.ok;
    } catch (e: any) {
        console.log('[API Status] Gemini validation failed:', e?.message);
        return false;
    }
}

export async function GET(request: NextRequest) {
    try {
        const results: Record<string, { configured: boolean; label: string }> = {};

        // Check OpenAI
        let openaiConfigured = false;
        const openaiCred = await getActiveCredentialByService('OPENAI');
        const openaiKey = (openaiCred?.apiKey && !openaiCred.apiKey.startsWith('****'))
            ? openaiCred.apiKey
            : process.env.OPENAI_API_KEY;

        if (openaiKey && openaiKey.startsWith('sk-') && !openaiKey.includes('your-')) {
            openaiConfigured = await validateOpenAI(openaiKey);
        }
        results['OPENAI'] = { configured: openaiConfigured, label: 'OpenAI' };

        // Check DataForSEO
        let dataforseConfigured = false;
        const dfsCred = await getActiveCredentialByService('DATAFORSEO');
        const dfsLogin = dfsCred?.username || process.env.DATAFORSEO_LOGIN;
        const dfsPassword = (dfsCred?.password && !dfsCred.password.startsWith('****'))
            ? dfsCred.password
            : process.env.DATAFORSEO_PASSWORD;

        if (dfsLogin && dfsPassword && !dfsLogin.includes('your-') && !dfsPassword.includes('your-')) {
            dataforseConfigured = await validateDataForSEO(dfsLogin, dfsPassword);
        }
        results['DATAFORSEO'] = { configured: dataforseConfigured, label: 'DataForSEO' };

        // Check Gemini
        let geminiConfigured = false;
        const geminiCred = await getActiveCredentialByService('GEMINI');
        const geminiKey = (geminiCred?.apiKey && !geminiCred.apiKey.startsWith('****'))
            ? geminiCred.apiKey
            : process.env.GEMINI_API_KEY;

        if (geminiKey && !geminiKey.includes('your-')) {
            geminiConfigured = await validateGemini(geminiKey);
        }
        results['GEMINI'] = { configured: geminiConfigured, label: 'Gemini' };

        return NextResponse.json({
            success: true,
            apis: results
        });

    } catch (error) {
        console.error('API Status Check Error:', error);
        return NextResponse.json({ error: 'Failed to check API status' }, { status: 500 });
    }
}
