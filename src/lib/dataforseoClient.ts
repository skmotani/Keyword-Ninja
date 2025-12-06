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

  console.log('[DataForSEO] Making separate API requests for each location:', {
    endpoint: 'keywords_data/google_ads/search_volume/live',
    keywordCount: keywords.length,
    locations: locationCodes.map(loc => ({
      code: loc,
      numericCode: LOCATION_CODE_MAP[loc] || 2840,
      language: LANGUAGE_CODE_MAP[loc] || 'en',
    })),
  });

  const allLocationResults: LocationResults[] = [];
  const allRawResponses: string[] = [];

  const errors: string[] = [];

  for (const locCode of locationCodes) {
    try {
      const requestBody = [{
        keywords: keywords,
        location_code: LOCATION_CODE_MAP[locCode] || 2840,
        language_code: LANGUAGE_CODE_MAP[locCode] || 'en',
      }];

      console.log(`[DataForSEO] Fetching for location ${locCode} (${LOCATION_CODE_MAP[locCode]})`);

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
      allRawResponses.push(rawResponseText);
      
      console.log(`[DataForSEO] Response status for ${locCode}:`, response.status);
      
      if (!response.ok) {
        console.error(`[DataForSEO] API Error for ${locCode}:`, rawResponseText);
        errors.push(`${locCode}: HTTP ${response.status}`);
        continue;
      }

      let data: DataForSEOResponse;
      try {
        data = JSON.parse(rawResponseText);
      } catch (e) {
        console.error(`[DataForSEO] Failed to parse response for ${locCode}:`, rawResponseText);
        errors.push(`${locCode}: Invalid JSON response`);
        continue;
      }

      console.log(`[DataForSEO] Response summary for ${locCode}:`, {
        statusCode: data.status_code,
        statusMessage: data.status_message,
        cost: data.cost,
        tasksCount: data.tasks_count,
        tasksError: data.tasks_error,
      });

      if (data.status_code !== 20000) {
        errors.push(`${locCode}: ${data.status_message}`);
        continue;
      }

      for (const task of data.tasks || []) {
        if (task.status_code !== 20000) {
          console.warn(`[DataForSEO] Task error for ${locCode}:`, task.status_message);
          continue;
        }

        const taskLocationCode = task.data?.location_code;
        const taskLanguageCode = task.data?.language_code || 'en';
        
        const locCodeStr = Object.entries(LOCATION_CODE_MAP).find(
          ([, num]) => num === taskLocationCode
        )?.[0] || locCode;

        const locResults: LocationResults = {
          locationCode: locCodeStr,
          numericLocationCode: taskLocationCode,
          languageCode: taskLanguageCode,
          results: [],
        };

        for (const result of task.result || []) {
          const compValue = result.competition_level || (typeof result.competition === 'string' ? result.competition : null);
          locResults.results.push({
            keyword: result.keyword,
            search_volume: result.search_volume,
            cpc: result.cpc,
            competition: compValue,
            low_top_of_page_bid: result.low_top_of_page_bid,
            high_top_of_page_bid: result.high_top_of_page_bid,
            location_code: result.location_code,
            language_code: result.language_code,
          });
        }

        allLocationResults.push(locResults);
        console.log(`[DataForSEO] Parsed ${locResults.results.length} results for ${locCode}`);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[DataForSEO] Error fetching ${locCode}:`, errMsg);
      errors.push(`${locCode}: ${errMsg}`);
    }
  }

  if (allLocationResults.length === 0 && errors.length > 0) {
    throw new Error(`All locations failed: ${errors.join('; ')}`);
  }

  console.log('[DataForSEO] Final results:', allLocationResults.map(lr => ({
    location: lr.locationCode,
    count: lr.results.length,
  })));

  const combinedRawResponse = JSON.stringify({
    combined: true,
    locations: locationCodes,
    rawResponses: allRawResponses,
  });

  return {
    locationResults: allLocationResults,
    rawResponse: combinedRawResponse,
  };
}

export function getLocationCodeMapping(): Record<string, number> {
  return { ...LOCATION_CODE_MAP };
}
