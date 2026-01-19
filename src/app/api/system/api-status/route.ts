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
        const results: Record<string, { configured: boolean; label: string; debug?: string }> = {};
        console.log('[API Status] Starting validation...');

        // Check OpenAI
        let openaiConfigured = false;
        let openaiDebug = '';
        const openaiCred = await getActiveCredentialByService('OPENAI');
        const openaiKey = (openaiCred?.apiKey && !openaiCred.apiKey.startsWith('****'))
            ? openaiCred.apiKey
            : process.env.OPENAI_API_KEY;

        console.log('[API Status] OpenAI key source:', openaiCred?.apiKey ? 'credential store' : 'env var');
        console.log('[API Status] OpenAI key exists:', !!openaiKey);

        if (openaiKey && openaiKey.startsWith('sk-') && !openaiKey.includes('your-')) {
            openaiConfigured = await validateOpenAI(openaiKey);
            openaiDebug = openaiConfigured ? 'validated' : 'key invalid';
        } else {
            openaiDebug = openaiKey ? 'invalid format' : 'missing';
        }
        results['OPENAI'] = { configured: openaiConfigured, label: 'OpenAI', debug: openaiDebug };

        // Check DataForSEO
        let dataforseConfigured = false;
        let dfsDebug = '';
        const dfsCred = await getActiveCredentialByService('DATAFORSEO');
        const dfsLogin = dfsCred?.username || process.env.DATAFORSEO_LOGIN;
        const dfsPassword = (dfsCred?.password && !dfsCred.password.startsWith('****'))
            ? dfsCred.password
            : process.env.DATAFORSEO_PASSWORD;

        console.log('[API Status] DataForSEO login source:', dfsCred?.username ? 'credential store' : 'env var');

        if (dfsLogin && dfsPassword && !dfsLogin.includes('your-') && !dfsPassword.includes('your-')) {
            dataforseConfigured = await validateDataForSEO(dfsLogin, dfsPassword);
            dfsDebug = dataforseConfigured ? 'validated' : 'credentials invalid';
        } else {
            dfsDebug = !dfsLogin ? 'login missing' : !dfsPassword ? 'password missing' : 'placeholder values';
        }
        results['DATAFORSEO'] = { configured: dataforseConfigured, label: 'DataForSEO', debug: dfsDebug };

        // Check Gemini
        let geminiConfigured = false;
        let geminiDebug = '';
        const geminiCred = await getActiveCredentialByService('GEMINI');
        const geminiKey = (geminiCred?.apiKey && !geminiCred.apiKey.startsWith('****'))
            ? geminiCred.apiKey
            : process.env.GEMINI_API_KEY;

        if (geminiKey && !geminiKey.includes('your-')) {
            geminiConfigured = await validateGemini(geminiKey);
            geminiDebug = geminiConfigured ? 'validated' : 'key invalid';
        } else {
            geminiDebug = geminiKey ? 'placeholder value' : 'missing';
        }
        results['GEMINI'] = { configured: geminiConfigured, label: 'Gemini', debug: geminiDebug };

        console.log('[API Status] Validation complete:', JSON.stringify(results));

        return NextResponse.json({
            success: true,
            apis: results,
            lastChecked: new Date().toISOString()
        });

    } catch (error) {
        console.error('API Status Check Error:', error);
        return NextResponse.json({ error: 'Failed to check API status' }, { status: 500 });
    }
}
