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

export interface LocationResults {
  locationCode: string;
  numericLocationCode: number;
  languageCode: string;
  results: DataForSEOKeywordResult[];
}

export interface BatchFetchResult {
  locationResults: LocationResults[];
  rawResponse: string;
}

export async function fetchKeywordsFromDataForSEOBatch(
  credentials: DataForSEOCredentials,
  keywords: string[],
  locationCodes: string[]
): Promise<BatchFetchResult> {
  const authString = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');

  const requestBody = locationCodes.map(locCode => ({
    keywords: keywords,
    location_code: LOCATION_CODE_MAP[locCode] || 2840,
    language_code: LANGUAGE_CODE_MAP[locCode] || 'en',
  }));

  console.log('[DataForSEO] Making batch API request:', {
    endpoint: 'keywords_data/google_ads/search_volume/live',
    keywordCount: keywords.length,
    locations: locationCodes.map(loc => ({
      code: loc,
      numericCode: LOCATION_CODE_MAP[loc] || 2840,
      language: LANGUAGE_CODE_MAP[loc] || 'en',
    })),
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

  const locationResultsMap = new Map<number, LocationResults>();

  for (const task of data.tasks || []) {
    if (task.status_code !== 20000) {
      console.warn('[DataForSEO] Task error:', task.status_message);
      continue;
    }

    const taskLocationCode = task.data?.location_code;
    const taskLanguageCode = task.data?.language_code || 'en';
    
    const locCodeStr = Object.entries(LOCATION_CODE_MAP).find(
      ([, num]) => num === taskLocationCode
    )?.[0] || 'GL';

    if (!locationResultsMap.has(taskLocationCode)) {
      locationResultsMap.set(taskLocationCode, {
        locationCode: locCodeStr,
        numericLocationCode: taskLocationCode,
        languageCode: taskLanguageCode,
        results: [],
      });
    }

    const locResults = locationResultsMap.get(taskLocationCode)!;

    for (const result of task.result || []) {
      locResults.results.push({
        keyword: result.keyword,
        search_volume: result.search_volume,
        cpc: result.cpc,
        competition: result.competition_level,
        low_top_of_page_bid: result.low_top_of_page_bid,
        high_top_of_page_bid: result.high_top_of_page_bid,
        location_code: result.location_code,
        language_code: result.language_code,
      });
    }
  }

  const locationResults = Array.from(locationResultsMap.values());

  console.log('[DataForSEO] Parsed results:', locationResults.map(lr => ({
    location: lr.locationCode,
    count: lr.results.length,
  })));

  return {
    locationResults,
    rawResponse: rawResponseText,
  };
}

export function getLocationCodeMapping(): Record<string, number> {
  return { ...LOCATION_CODE_MAP };
}
