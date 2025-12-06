import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getActiveCredentialByService } from '@/lib/apiCredentialsStore';
import { getKeywordApiDataByClientAndLocations } from '@/lib/keywordApiStore';
import { replaceSerpDataForClientAndLocations, saveSerpApiLog } from '@/lib/serpStore';
import { getLocationCodeMapping, sanitizeKeywordForAPI } from '@/lib/dataforseoClient';
import { SerpResult } from '@/types';

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

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { clientCode, locationCodes } = body;

  if (!clientCode) {
    return new Response(JSON.stringify({ error: 'clientCode is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const locCodes: string[] = Array.isArray(locationCodes) 
    ? locationCodes 
    : (locationCodes ? [locationCodes] : ['IN', 'GL']);

  if (locCodes.length === 0) {
    return new Response(JSON.stringify({ error: 'At least one locationCode is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const credential = await getActiveCredentialByService('DATAFORSEO', clientCode);
  if (!credential) {
    return new Response(JSON.stringify({ error: 'No active DATAFORSEO API credential found' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!credential.username) {
    return new Response(JSON.stringify({ error: 'DataForSEO credential is missing username' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const password = process.env.DATAFORSEO_PASSWORD;
  if (!password) {
    return new Response(JSON.stringify({ error: 'DataForSEO password not configured' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const locationCodeMapping = getLocationCodeMapping();
  const numericLocationCodes = locCodes.map(lc => locationCodeMapping[lc] || 2840);

  const keywordRecords = await getKeywordApiDataByClientAndLocations(clientCode, numericLocationCodes);

  if (keywordRecords.length === 0) {
    return new Response(JSON.stringify({ error: 'No keywords found in Keyword API Data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const uniqueKeywords = Array.from(new Set(keywordRecords.map(r => r.keywordText)));
  const sanitizedKeywords: string[] = [];
  for (const keyword of uniqueKeywords) {
    const sanitized = sanitizeKeywordForAPI(keyword);
    if (sanitized !== null && sanitized.length > 0) {
      sanitizedKeywords.push(sanitized);
    }
  }

  if (sanitizedKeywords.length === 0) {
    return new Response(JSON.stringify({ error: 'No valid keywords to fetch' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const authString = Buffer.from(`${credential.username}:${password}`).toString('base64');
  const totalTasks = sanitizedKeywords.length * locCodes.length;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      sendProgress({
        type: 'start',
        totalKeywords: sanitizedKeywords.length,
        totalLocations: locCodes.length,
        totalTasks,
      });

      const now = new Date().toISOString();
      const allNewRecords: SerpResult[] = [];
      const statsPerLocation: Record<string, { keywordsProcessed: number; resultsCreated: number }> = {};
      let completedTasks = 0;

      for (const locCode of locCodes) {
        const numericLocCode = LOCATION_CODE_MAP[locCode] || 2840;
        const langCode = LANGUAGE_CODE_MAP[locCode] || 'en';
        let keywordsProcessed = 0;
        let resultsCreated = 0;

        sendProgress({
          type: 'location_start',
          location: locCode,
          numericLocationCode: numericLocCode,
        });

        for (let i = 0; i < sanitizedKeywords.length; i++) {
          const keyword = sanitizedKeywords[i];
          completedTasks++;

          try {
            const requestBody = [{
              keyword: keyword,
              location_code: numericLocCode,
              language_code: langCode,
              depth: 10,
            }];

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

            if (response.ok) {
              const data = await response.json();

              if (data.status_code === 20000) {
                for (const task of data.tasks || []) {
                  if (task.status_code === 20000) {
                    const taskKeyword = task.data?.keyword || keyword;
                    const taskResults = task.result || [];

                    for (const result of taskResults) {
                      const organicItems = (result.items || [])
                        .filter((item: SerpOrganicResult) => item.type === 'organic')
                        .slice(0, 10);

                      for (const item of organicItems) {
                        allNewRecords.push({
                          id: uuidv4(),
                          clientCode,
                          keyword: taskKeyword,
                          locationCode: numericLocCode,
                          languageCode: langCode,
                          rank: item.rank_group,
                          rankAbsolute: item.rank_absolute,
                          url: item.url || '',
                          title: item.title || '',
                          description: item.description || '',
                          domain: item.domain || '',
                          breadcrumb: item.breadcrumb || null,
                          isFeaturedSnippet: item.is_featured_snippet || false,
                          isImage: item.is_image || false,
                          isVideo: item.is_video || false,
                          highlighted: item.highlighted || [],
                          etv: item.etv || null,
                          estimatedPaidTrafficCost: item.estimated_paid_traffic_cost || null,
                          fetchedAt: now,
                        });
                        resultsCreated++;
                      }
                    }
                    keywordsProcessed++;
                  }
                }
              }
            }
          } catch (error) {
            console.error(`Error fetching ${locCode}/${keyword}:`, error);
          }

          sendProgress({
            type: 'progress',
            completedTasks,
            totalTasks,
            percent: Math.round((completedTasks / totalTasks) * 100),
            currentLocation: locCode,
            currentKeyword: keyword,
            keywordIndex: i + 1,
            totalKeywords: sanitizedKeywords.length,
            resultsCollected: allNewRecords.length,
          });
        }

        statsPerLocation[locCode] = {
          keywordsProcessed,
          resultsCreated,
        };

        sendProgress({
          type: 'location_complete',
          location: locCode,
          keywordsProcessed,
          resultsCreated,
        });
      }

      await replaceSerpDataForClientAndLocations(clientCode, numericLocationCodes, allNewRecords);

      sendProgress({
        type: 'complete',
        success: true,
        totalResults: allNewRecords.length,
        stats: statsPerLocation,
        lastPulledAt: now,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
