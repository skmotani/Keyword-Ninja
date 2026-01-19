import { NextRequest, NextResponse } from 'next/server';
import { getActiveCredentialByService } from '@/lib/apiCredentialsStore';

export async function GET(request: NextRequest) {
    try {
        // Check all API services
        const services: Array<'OPENAI' | 'DATAFORSEO' | 'GEMINI'> = ['OPENAI', 'DATAFORSEO', 'GEMINI'];
        const results: Record<string, { configured: boolean; label: string }> = {};

        for (const service of services) {
            const credential = await getActiveCredentialByService(service);

            let configured = false;
            if (credential) {
                // Check if there's a valid key (not just masked)
                if (credential.apiKey && !credential.apiKey.startsWith('****')) {
                    configured = true;
                } else if (credential.password && !credential.password.startsWith('****')) {
                    configured = true; // For username/password auth like DataForSEO
                }
            }

            // Also check environment variables as fallback
            if (!configured) {
                if (service === 'OPENAI' && process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('your-')) {
                    configured = true;
                }
                if (service === 'DATAFORSEO' && process.env.DATAFORSEO_LOGIN && !process.env.DATAFORSEO_LOGIN.includes('your-')) {
                    configured = true;
                }
                if (service === 'GEMINI' && process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('your-')) {
                    configured = true;
                }
            }

            results[service] = {
                configured,
                label: service === 'DATAFORSEO' ? 'DataForSEO' : service === 'OPENAI' ? 'OpenAI' : 'Gemini'
            };
        }

        return NextResponse.json({
            success: true,
            apis: results
        });

    } catch (error) {
        console.error('API Status Check Error:', error);
        return NextResponse.json({ error: 'Failed to check API status' }, { status: 500 });
    }
}
