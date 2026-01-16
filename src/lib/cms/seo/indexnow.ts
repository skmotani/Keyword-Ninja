// CMS SEO - IndexNow Integration
// IndexNow is a protocol for instant URL indexing by search engines

export interface IndexNowOptions {
    host: string;
    key: string;
    keyLocation?: string;
    urls: string[];
}

export interface IndexNowResult {
    success: boolean;
    statusCode?: number;
    error?: string;
    submittedUrls: number;
}

// Supported IndexNow endpoints
const INDEXNOW_ENDPOINTS = [
    'https://api.indexnow.org/indexnow',
    'https://www.bing.com/indexnow',
    'https://yandex.com/indexnow',
];

// Submit URLs to IndexNow
export async function submitToIndexNow(
    options: IndexNowOptions
): Promise<IndexNowResult> {
    const { host, key, keyLocation, urls } = options;

    if (!key) {
        return {
            success: false,
            error: 'IndexNow API key is required',
            submittedUrls: 0,
        };
    }

    if (urls.length === 0) {
        return {
            success: true,
            submittedUrls: 0,
        };
    }

    // Build request body
    const body = {
        host,
        key,
        keyLocation: keyLocation || `https://${host}/${key}.txt`,
        urlList: urls,
    };

    try {
        // Try primary endpoint first
        const response = await fetch(INDEXNOW_ENDPOINTS[0], {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify(body),
        });

        if (response.ok || response.status === 202) {
            return {
                success: true,
                statusCode: response.status,
                submittedUrls: urls.length,
            };
        }

        // Handle known status codes
        if (response.status === 400) {
            return {
                success: false,
                statusCode: 400,
                error: 'Invalid request format',
                submittedUrls: 0,
            };
        }

        if (response.status === 403) {
            return {
                success: false,
                statusCode: 403,
                error: 'Invalid or missing API key',
                submittedUrls: 0,
            };
        }

        if (response.status === 422) {
            return {
                success: false,
                statusCode: 422,
                error: 'URLs do not match the host',
                submittedUrls: 0,
            };
        }

        return {
            success: false,
            statusCode: response.status,
            error: `IndexNow returned status ${response.status}`,
            submittedUrls: 0,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Network error',
            submittedUrls: 0,
        };
    }
}

// Submit a single URL
export async function submitSingleUrl(
    host: string,
    key: string,
    url: string
): Promise<IndexNowResult> {
    return submitToIndexNow({
        host,
        key,
        urls: [url],
    });
}

// Generate IndexNow key file content
// This should be placed at /{key}.txt on the website root
export function generateKeyFile(key: string): string {
    return key;
}

// Validate IndexNow key format (alphanumeric, 8-128 chars)
export function validateIndexNowKey(key: string): boolean {
    return /^[a-zA-Z0-9-]{8,128}$/.test(key);
}

// Generate a random IndexNow key
export function generateIndexNowKey(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';
    for (let i = 0; i < 32; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
}
