/**
 * API: GET /api/keywords/page-intent-analysis/test-api-key
 * 
 * Tests if the OpenAI API key is valid and working.
 * Makes a minimal API call to verify credentials.
 */
import { NextResponse } from 'next/server';
import { getActiveCredentialByService } from '@/lib/apiCredentialsStore';

export async function GET() {
    const startTime = Date.now();

    try {
        // Get API key from credentials store
        const credential = await getActiveCredentialByService('OPENAI');

        const apiKey = credential?.apiKey && !credential.apiKey.startsWith('****')
            ? credential.apiKey
            : process.env.OPENAI_API_KEY;

        if (!apiKey) {
            return NextResponse.json({
                success: false,
                error: 'No OpenAI API key configured',
                message: 'Please set your OpenAI API key in Settings → API Credentials',
                source: 'none',
            });
        }

        const source = credential?.apiKey && !credential.apiKey.startsWith('****') ? 'settings' : 'environment';
        const maskedKey = `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`;

        // Make a minimal test call to OpenAI
        console.log(`[TestAPIKey] Testing OpenAI API key from ${source}...`);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'user', content: 'Say "OK" in one word.' }
                ],
                max_tokens: 5,
            }),
        });

        const elapsed = Date.now() - startTime;

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData?.error?.message || `HTTP ${response.status}`;

            console.log(`[TestAPIKey] ❌ API key invalid: ${errorMessage}`);

            return NextResponse.json({
                success: false,
                error: errorMessage,
                message: response.status === 401
                    ? 'Invalid API key. Please update in Settings → API Credentials'
                    : `API error: ${errorMessage}`,
                source,
                maskedKey,
                elapsed,
            });
        }

        const data = await response.json();
        const testResponse = data.choices?.[0]?.message?.content || 'OK';

        console.log(`[TestAPIKey] ✓ API key valid! Response: ${testResponse}`);

        return NextResponse.json({
            success: true,
            message: 'OpenAI API key is valid and working!',
            source,
            maskedKey,
            testResponse: testResponse.trim(),
            model: 'gpt-4o-mini',
            elapsed,
        });

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('[TestAPIKey] Error:', errorMsg);

        return NextResponse.json({
            success: false,
            error: errorMsg,
            message: 'Failed to test API key',
        });
    }
}
