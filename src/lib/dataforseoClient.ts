import { DataForSEOKeywordResult } from '@/types';

interface DataForSEOCredentials {
  username: string;
  password: string;
}

export function sanitizeKeywordForAPI(keyword: string): string | null {
  let sanitized = keyword
    .replace(/[\/\\]/g, ' ')
    .replace(/,/g, ' ')
    .replace(/[;:!@#$%^&*()+=\[\]{}<>|~`"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (sanitized.length > 80) {
    sanitized = sanitized.substring(0, 80).trim();
  }
  
  const words = sanitized.split(' ').filter(w => w.length > 0);
  if (words.length > 10) {
    return null;
  }
  
  return sanitized;
}

interface DataForSEOResponse {
  version: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  tasks_count: number;
  tasks_error: number;
  tasks: Array<{
    id: string;
    status_code: number;
    status_message: string;
    time: string;
    cost: number;
    result_count: number;
    path: string[];
    data: {
      api: string;
      function: string;
      keywords: string[];
      location_code: number;
      language_code: string;
    };
    result: Array<{
      keyword: string;
      location_code: number;
      language_code: string;
      search_partners: boolean;
      competition: number | null;
      competition_level: string | null;
      cpc: number | null;
      search_volume: number | null;
      low_top_of_page_bid: number | null;
      high_top_of_page_bid: number | null;
      monthly_searches: Array<{
        year: number;
        month: number;
        search_volume: number;
      }> | null;
      keyword_annotations: {
        concepts: Array<{
          name: string;
          concept_group: {
            name: string;
            type: string;
          };
        }> | null;
      } | null;
    }>;
  }>;
}

const LOCATION_CODE_MAP: Record<string, number> = {
  'IN': 2356,
  'GL': 2840,
  'US': 2840,
  'UK': 2826,
  'AU': 2036,
  'CA': 2124,
};

const LANGUAGE_CODE_MAP: Record<string, string> = {
  'IN': 'en',
  'GL': 'en',
  'US': 'en',
  'UK': 'en',
  'AU': 'en',
  'CA': 'en',
};

export async function fetchKeywordsFromDataForSEO(
  credentials: DataForSEOCredentials,
  keywords: string[],
  locationCode: string
): Promise<{ results: DataForSEOKeywordResult[]; rawResponse: string }> {
  const numericLocationCode = LOCATION_CODE_MAP[locationCode] || 2840;
  const languageCode = LANGUAGE_CODE_MAP[locationCode] || 'en';

  const authString = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');

  const requestBody = [
    {
      keywords: keywords,
      location_code: numericLocationCode,
      language_code: languageCode,
    },
  ];

  console.log('[DataForSEO] Making API request:', {
    endpoint: 'keywords_data/google_ads/search_volume/live',
    keywordCount: keywords.length,
    locationCode: numericLocationCode,
    languageCode,
  });

  const response = await fetch(
    'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live',
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );

  const rawResponseText = await response.text();
  
  console.log('[DataForSEO] Response status:', response.status);
  
  if (!response.ok) {
    console.error('[DataForSEO] API Error:', rawResponseText);
    throw new Error(`DataForSEO API error: ${response.status} - ${rawResponseText}`);
  }

  let data: DataForSEOResponse;
  try {
    data = JSON.parse(rawResponseText);
  } catch (e) {
    console.error('[DataForSEO] Failed to parse response:', rawResponseText);
    throw new Error('Failed to parse DataForSEO response');
  }

  console.log('[DataForSEO] Response summary:', {
    statusCode: data.status_code,
    statusMessage: data.status_message,
    cost: data.cost,
    tasksCount: data.tasks_count,
    tasksError: data.tasks_error,
  });

  if (data.status_code !== 20000) {
    throw new Error(`DataForSEO API error: ${data.status_message}`);
  }

  const results: DataForSEOKeywordResult[] = [];

  for (const task of data.tasks || []) {
    if (task.status_code !== 20000) {
      console.warn('[DataForSEO] Task error:', task.status_message);
      continue;
    }

    for (const result of task.result || []) {
      results.push({
        keyword: result.keyword,
        search_volume: result.search_volume,
        cpc: result.cpc,
        competition: result.competition,
        competition_level: result.competition_level,
        monthly_searches: result.monthly_searches,
      });
    }
  }

  console.log('[DataForSEO] Parsed results count:', results.length);

  return {
    results,
    rawResponse: rawResponseText,
  };
}

export function getLocationCodeMapping(): Record<string, number> {
  return { ...LOCATION_CODE_MAP };
}
