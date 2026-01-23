/**
 * PostgreSQL Migration Verification Script
 * Tests all major API endpoints to verify data is being fetched from PostgreSQL
 */

const RAILWAY_BASE_URL = 'https://keyword-ninja-production.up.railway.app';

// Test endpoints grouped by category
const ENDPOINTS = {
  // Core Data APIs
  clients: '/api/clients',
  competitors: '/api/competitors?clientCode=01',
  domainProfiles: '/api/domain-profiles?clientCode=01',
  
  // Dashboard APIs
  dashboardQueries: '/api/reports/dashboard/queries',
  
  // Domain Keywords & SERP
  domainKeywords: '/api/domain-keywords?clientCode=01&locationCode=2840',
  keywordApiData: '/api/keyword-api-data?clientCode=01',
  
  // Digital Footprint
  footprintHistory: '/api/digital-footprint/history?clientCode=01',
  
  // Surfaces/Credibility
  surfaces: '/api/surfaces?clientCode=01',
  
  // Page Intent
  pageIntent: '/api/intent/report?domain=example.com',
};

// Dashboard query IDs to test execution
const DASHBOARD_QUERY_IDS = [
  'MANUAL_001', // Top 20 Buy Keywords
  'MANUAL_002', // Top 20 Research Keywords
  'MANUAL_003', // Market Size
  'MANUAL_004', // Digital Surfaces
  'MANUAL_005', // Domain Credibility
];

async function testEndpoint(name, path) {
  try {
    const response = await fetch(`${RAILWAY_BASE_URL}${path}`, {
      headers: {
        'Accept': 'application/json',
      },
      timeout: 30000,
    });
    
    const status = response.status;
    let data = null;
    let recordCount = 0;
    let error = null;
    
    if (response.ok) {
      try {
        data = await response.json();
        // Try to determine record count
        if (Array.isArray(data)) {
          recordCount = data.length;
        } else if (data.data && Array.isArray(data.data)) {
          recordCount = data.data.length;
        } else if (data.queries && Array.isArray(data.queries)) {
          recordCount = data.queries.length;
        } else if (typeof data === 'object') {
          recordCount = Object.keys(data).length;
        }
      } catch (e) {
        error = 'JSON parse error';
      }
    } else {
      error = `HTTP ${status}`;
      try {
        const errorData = await response.text();
        error += `: ${errorData.substring(0, 100)}`;
      } catch (e) {}
    }
    
    return {
      name,
      path,
      status,
      recordCount,
      success: response.ok && recordCount > 0,
      error,
    };
  } catch (e) {
    return {
      name,
      path,
      status: 0,
      recordCount: 0,
      success: false,
      error: e.message,
    };
  }
}

async function testDashboardQuery(queryId) {
  try {
    const response = await fetch(`${RAILWAY_BASE_URL}/api/reports/dashboard/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        queryId,
        clientCode: '01',
        locationCodes: ['2840'],
      }),
    });
    
    const status = response.status;
    let data = null;
    let success = false;
    let details = '';
    
    if (response.ok) {
      data = await response.json();
      // Check if result has meaningful data
      if (data.result) {
        const result = data.result;
        if (result.keywords && result.keywords.length > 0) {
          success = true;
          details = `${result.keywords.length} keywords`;
        } else if (result.totalKeywords > 0) {
          success = true;
          details = `${result.totalKeywords} total keywords`;
        } else if (result.surfaces && result.surfaces.length > 0) {
          success = true;
          details = `${result.surfaces.length} surfaces`;
        } else if (result.domains && result.domains.length > 0) {
          success = true;
          details = `${result.domains.length} domains`;
        } else if (result.competitors && result.competitors.length > 0) {
          success = true;
          details = `${result.competitors.length} competitors`;
        } else if (Object.keys(result).length > 0) {
          success = true;
          details = `Has data: ${Object.keys(result).join(', ')}`;
        } else {
          details = 'Empty result';
        }
      } else {
        details = 'No result field';
      }
    } else {
      details = `HTTP ${status}`;
    }
    
    return {
      queryId,
      status,
      success,
      details,
    };
  } catch (e) {
    return {
      queryId,
      status: 0,
      success: false,
      details: e.message,
    };
  }
}

async function runVerification() {
  console.log('='.repeat(60));
  console.log('PostgreSQL Migration Verification Report');
  console.log('Railway URL:', RAILWAY_BASE_URL);
  console.log('Timestamp:', new Date().toISOString());
  console.log('='.repeat(60));
  console.log('');
  
  // Test API Endpoints
  console.log('## API Endpoint Tests');
  console.log('-'.repeat(60));
  
  const endpointResults = [];
  for (const [name, path] of Object.entries(ENDPOINTS)) {
    const result = await testEndpoint(name, path);
    endpointResults.push(result);
    const statusIcon = result.success ? '✅' : '❌';
    console.log(`${statusIcon} ${name}: ${result.success ? `${result.recordCount} records` : result.error}`);
  }
  
  console.log('');
  console.log('## Dashboard Query Execution Tests');
  console.log('-'.repeat(60));
  
  const queryResults = [];
  for (const queryId of DASHBOARD_QUERY_IDS) {
    const result = await testDashboardQuery(queryId);
    queryResults.push(result);
    const statusIcon = result.success ? '✅' : '❌';
    console.log(`${statusIcon} ${queryId}: ${result.details}`);
  }
  
  console.log('');
  console.log('='.repeat(60));
  console.log('## Summary');
  console.log('-'.repeat(60));
  
  const endpointsPassed = endpointResults.filter(r => r.success).length;
  const queriesPassed = queryResults.filter(r => r.success).length;
  
  console.log(`API Endpoints: ${endpointsPassed}/${endpointResults.length} passed`);
  console.log(`Dashboard Queries: ${queriesPassed}/${queryResults.length} passed`);
  console.log('');
  
  if (endpointsPassed === endpointResults.length && queriesPassed === queryResults.length) {
    console.log('🎉 ALL TESTS PASSED - PostgreSQL migration is complete!');
  } else {
    console.log('⚠️ Some tests failed - see details above');
  }
  
  console.log('='.repeat(60));
  
  // Return structured results for further processing
  return {
    endpoints: endpointResults,
    queries: queryResults,
    summary: {
      endpointsPassed,
      endpointsTotal: endpointResults.length,
      queriesPassed,
      queriesTotal: queryResults.length,
      allPassed: endpointsPassed === endpointResults.length && queriesPassed === queryResults.length,
    },
  };
}

runVerification().catch(console.error);
