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

interface SerpOrganicResult {
  type: string;
  rank_group: number;
  rank_absolute: number;
  domain: string;
  url: string;
  title: string;
  description: string;
  breadcrumb: string | null;
  is_featured_snippet: boolean;
  is_image: boolean;
  is_video: boolean;
  highlighted: string[] | null;
  etv: number | null;
  estimated_paid_traffic_cost: number | null;
}

interface SerpTaskResult {
  keyword: string;
  location_code: number;
  language_code: string;
  items: SerpOrganicResult[];
}

interface DataForSEOSerpResponse {
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
      keyword: string;
      location_code: number;
      language_code: string;
      depth: number;
    };
    result: SerpTaskResult[] | null;
  }>;
}

export interface SerpLocationResults {
  locationCode: string;
  numericLocationCode: number;
  languageCode: string;
  results: Array<{
    keyword: string;
    items: SerpOrganicResult[];
  }>;
}

export interface SerpBatchFetchResult {
  locationResults: SerpLocationResults[];
  rawResponse: string;
}

export async function fetchSerpFromDataForSEO(
  credentials: { username: string; password: string },
  keywords: string[],
  locationCodes: string[]
): Promise<SerpBatchFetchResult> {
  const authString = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');

  console.log('[DataForSEO SERP] Making API requests for SERP data:', {
    endpoint: 'serp/google/organic/live/advanced',
    keywordCount: keywords.length,
    locations: locationCodes,
    note: 'DataForSEO SERP Live API only allows 1 keyword per request',
  });

  const allLocationResults: SerpLocationResults[] = [];
  const allRawResponses: string[] = [];
  const errors: string[] = [];

  for (const locCode of locationCodes) {
    const numericLocCode = LOCATION_CODE_MAP[locCode] || 2840;
    const langCode = LANGUAGE_CODE_MAP[locCode] || 'en';

    const locResults: SerpLocationResults = {
      locationCode: locCode,
      numericLocationCode: numericLocCode,
      languageCode: langCode,
      results: [],
    };

    console.log(`[DataForSEO SERP] Fetching for location ${locCode} (${numericLocCode}), ${keywords.length} keywords (one request per keyword)`);

    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];
      
      try {
        const requestBody = [{
          keyword: keyword,
          location_code: numericLocCode,
          language_code: langCode,
          depth: 10,
        }];

        if (i > 0 && i % 10 === 0) {
          console.log(`[DataForSEO SERP] Progress for ${locCode}: ${i}/${keywords.length} keywords processed`);
        }

        const response = await fetch(
          'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
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

        if (!response.ok) {
          console.error(`[DataForSEO SERP] API Error for ${locCode}/${keyword}:`, rawResponseText);
          errors.push(`${locCode}/${keyword}: HTTP ${response.status}`);
          continue;
        }

        let data: DataForSEOSerpResponse;
        try {
          data = JSON.parse(rawResponseText);
        } catch (e) {
          console.error(`[DataForSEO SERP] Failed to parse response for ${locCode}/${keyword}`);
          errors.push(`${locCode}/${keyword}: Invalid JSON response`);
          continue;
        }

        if (data.status_code !== 20000) {
          errors.push(`${locCode}/${keyword}: ${data.status_message}`);
          continue;
        }

        for (const task of data.tasks || []) {
          if (task.status_code !== 20000) {
            console.warn(`[DataForSEO SERP] Task error for ${locCode}/${keyword}:`, task.status_message);
            continue;
          }

          const taskKeyword = task.data?.keyword || keyword;
          const taskResults = task.result || [];

          for (const result of taskResults) {
            const organicItems = (result.items || [])
              .filter((item: SerpOrganicResult) => item.type === 'organic')
              .slice(0, 10);

            locResults.results.push({
              keyword: taskKeyword,
              items: organicItems,
            });
          }
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[DataForSEO SERP] Error fetching ${locCode}/${keyword}:`, errMsg);
        errors.push(`${locCode}/${keyword}: ${errMsg}`);
      }
    }

    allLocationResults.push(locResults);
    console.log(`[DataForSEO SERP] Completed ${locCode}: ${locResults.results.length} keywords with SERP data`);
  }

  if (allLocationResults.length === 0 && errors.length > 0) {
    throw new Error(`All SERP locations failed: ${errors.join('; ')}`);
  }

  console.log('[DataForSEO SERP] Final results:', allLocationResults.map(lr => ({
    location: lr.locationCode,
    keywordsWithResults: lr.results.length,
    totalOrganicResults: lr.results.reduce((sum, r) => sum + r.items.length, 0),
  })));

  const combinedRawResponse = JSON.stringify({
    combined: true,
    locations: locationCodes,
    keywordCount: keywords.length,
    rawResponseCount: allRawResponses.length,
  });

  return {
    locationResults: allLocationResults,
    rawResponse: combinedRawResponse,
  };
}
