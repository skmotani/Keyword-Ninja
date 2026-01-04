import {
    upsertExportPage,
    upsertColumns,
    ExportPageEntry,
    ExportColumnEntry
} from './exportRegistryStore';

export interface DiscoveryResult {
    pagesDiscovered: number;
    pagesUpdated: number;
    columnsRegistered: number;
}

// Hardcoded manifest of all pages that support clientCode filter
// Each entry defines the page metadata and its exportable columns
// IMPORTANT: sourceField must exactly match the JSON field names
interface PageManifest {
    pageKey: string;
    pageName: string;
    route: string;
    module: string;
    clientFilterField: string;
    dataSourceType: 'JSON_FILE' | 'API';
    dataSourceRef: string;
    description: string;
    rowDescription: string;
    columns: Array<{
        columnName: string;
        displayName: string;
        dataType: string;
        sourceField: string;
        metricMatchKey: string | null;
    }>;
}

const PAGE_MANIFEST: PageManifest[] = [
    {
        pageKey: 'client-master',
        pageName: 'Client Master',
        route: '/clients',
        module: 'Master',
        clientFilterField: 'code',
        dataSourceType: 'JSON_FILE',
        dataSourceRef: 'clients.json',
        description: 'Primary registry for all clients. Links business entities to their digital properties.',
        rowDescription: 'One row per client organization.',
        columns: [
            { columnName: 'id', displayName: 'ID', dataType: 'string', sourceField: 'id', metricMatchKey: null },
            { columnName: 'code', displayName: 'Client Code', dataType: 'string', sourceField: 'code', metricMatchKey: null },
            { columnName: 'name', displayName: 'Client Name', dataType: 'string', sourceField: 'name', metricMatchKey: null },
            { columnName: 'mainDomain', displayName: 'Main Domain', dataType: 'string', sourceField: 'mainDomain', metricMatchKey: null },
            { columnName: 'domains', displayName: 'All Domains', dataType: 'string', sourceField: 'domains', metricMatchKey: null },
            { columnName: 'notes', displayName: 'Notes', dataType: 'string', sourceField: 'notes', metricMatchKey: null },
            { columnName: 'isActive', displayName: 'Is Active', dataType: 'boolean', sourceField: 'isActive', metricMatchKey: null },
            { columnName: 'industry', displayName: 'Industry', dataType: 'string', sourceField: 'industry', metricMatchKey: null },
            { columnName: 'ctrTop5', displayName: 'CTR (Top 1-5)', dataType: 'string', sourceField: 'businessMetrics.ctrTop5', metricMatchKey: null },
            { columnName: 'ctrTop10', displayName: 'CTR (Top 1-10)', dataType: 'string', sourceField: 'businessMetrics.ctrTop10', metricMatchKey: null },
            { columnName: 'visitToRfq', displayName: 'Visit→RFQ %', dataType: 'string', sourceField: 'businessMetrics.visitToRfq', metricMatchKey: null },
            { columnName: 'rfqToOrder', displayName: 'RFQ→Order %', dataType: 'string', sourceField: 'businessMetrics.rfqToOrder', metricMatchKey: null },
            { columnName: 'avgTicketSize', displayName: 'Avg Ticket Size', dataType: 'string', sourceField: 'businessMetrics.avgTicketSize', metricMatchKey: null },
        ],
    },
    {
        pageKey: 'client-ai-profile',
        pageName: 'Client AI Profile',
        route: '/clients',
        module: 'Master',
        clientFilterField: 'clientCode',
        dataSourceType: 'JSON_FILE',
        dataSourceRef: 'client_ai_profiles.json',
        description: 'AI-generated business profiles containing industry classification, product lines, target segments, and matching dictionaries.',
        rowDescription: 'One row per client AI profile.',
        columns: [
            { columnName: 'id', displayName: 'ID', dataType: 'string', sourceField: 'id', metricMatchKey: null },
            { columnName: 'clientCode', displayName: 'Client Code', dataType: 'string', sourceField: 'clientCode', metricMatchKey: null },
            { columnName: 'clientName', displayName: 'Client Name', dataType: 'string', sourceField: 'clientName', metricMatchKey: null },
            { columnName: 'primaryDomains', displayName: 'Primary Domains', dataType: 'string', sourceField: 'primaryDomains', metricMatchKey: null },
            { columnName: 'domainsUsedForGeneration', displayName: 'Domains Used', dataType: 'string', sourceField: 'domainsUsedForGeneration', metricMatchKey: null },
            { columnName: 'industryType', displayName: 'Industry Type', dataType: 'string', sourceField: 'industryType', metricMatchKey: null },
            { columnName: 'shortSummary', displayName: 'Short Summary', dataType: 'string', sourceField: 'shortSummary', metricMatchKey: null },
            { columnName: 'businessModel', displayName: 'Business Model', dataType: 'string', sourceField: 'businessModel', metricMatchKey: null },
            { columnName: 'productLines', displayName: 'Product Lines', dataType: 'string', sourceField: 'productLines', metricMatchKey: null },
            { columnName: 'targetCustomerSegments', displayName: 'Target Segments', dataType: 'string', sourceField: 'targetCustomerSegments', metricMatchKey: null },
            { columnName: 'targetGeographies', displayName: 'Target Geographies', dataType: 'string', sourceField: 'targetGeographies', metricMatchKey: null },
            { columnName: 'coreTopics', displayName: 'Core Topics', dataType: 'string', sourceField: 'coreTopics', metricMatchKey: null },
            { columnName: 'adjacentTopics', displayName: 'Adjacent Topics', dataType: 'string', sourceField: 'adjacentTopics', metricMatchKey: null },
            { columnName: 'negativeTopics', displayName: 'Negative Topics', dataType: 'string', sourceField: 'negativeTopics', metricMatchKey: null },
            { columnName: 'generatedAt', displayName: 'Generated At', dataType: 'date', sourceField: 'generatedAt', metricMatchKey: null },
            { columnName: 'updatedAt', displayName: 'Updated At', dataType: 'date', sourceField: 'updatedAt', metricMatchKey: null },
        ],
    },
    {
        pageKey: 'competitors',
        pageName: 'Competitors',
        route: '/competitors',
        module: 'Master',
        clientFilterField: 'clientCode',
        dataSourceType: 'JSON_FILE',
        dataSourceRef: 'competitors.json',
        description: 'Registry of competitor domains for each client. Used for competitive analysis and SERP tracking.',
        rowDescription: 'One row per competitor domain.',
        columns: [
            { columnName: 'id', displayName: 'ID', dataType: 'string', sourceField: 'id', metricMatchKey: null },
            { columnName: 'clientCode', displayName: 'Client Code', dataType: 'string', sourceField: 'clientCode', metricMatchKey: null },
            { columnName: 'name', displayName: 'Competitor Name', dataType: 'string', sourceField: 'name', metricMatchKey: null },
            { columnName: 'domain', displayName: 'Domain', dataType: 'string', sourceField: 'domain', metricMatchKey: null },
            { columnName: 'notes', displayName: 'Notes', dataType: 'string', sourceField: 'notes', metricMatchKey: null },
            { columnName: 'isActive', displayName: 'Is Active', dataType: 'boolean', sourceField: 'isActive', metricMatchKey: null },
            { columnName: 'source', displayName: 'Source', dataType: 'string', sourceField: 'source', metricMatchKey: null },
            { columnName: 'importanceScore', displayName: 'Importance Score', dataType: 'number', sourceField: 'importanceScore', metricMatchKey: null },
            { columnName: 'domainType', displayName: 'Domain Type', dataType: 'string', sourceField: 'domainType', metricMatchKey: 'domain_type' },
            { columnName: 'pageIntent', displayName: 'Page Intent', dataType: 'string', sourceField: 'pageIntent', metricMatchKey: 'page_intent' },
            { columnName: 'productMatchScoreValue', displayName: 'Product Match Score', dataType: 'number', sourceField: 'productMatchScoreValue', metricMatchKey: null },
            { columnName: 'productMatchScoreBucket', displayName: 'Product Match Bucket', dataType: 'string', sourceField: 'productMatchScoreBucket', metricMatchKey: null },
            { columnName: 'businessRelevanceCategory', displayName: 'Business Relevance', dataType: 'string', sourceField: 'businessRelevanceCategory', metricMatchKey: null },
            { columnName: 'explanationSummary', displayName: 'Explanation', dataType: 'string', sourceField: 'explanationSummary', metricMatchKey: null },
            { columnName: 'competitionType', displayName: 'Competition Type', dataType: 'string', sourceField: 'competitionType', metricMatchKey: null },
            { columnName: 'competitorForProducts', displayName: 'Competitor For Products', dataType: 'string', sourceField: 'competitorForProducts', metricMatchKey: null },
            { columnName: 'brandNames', displayName: 'Brand Names', dataType: 'string', sourceField: 'brandNames', metricMatchKey: null },
            { columnName: 'addedAt', displayName: 'Added At', dataType: 'date', sourceField: 'addedAt', metricMatchKey: null },
        ],
    },
    {
        // DomainKeywordRecord type fields
        pageKey: 'domain-keywords',
        pageName: 'Domain Keywords',
        route: '/keywords/domain-keywords',
        module: 'Keywords',
        clientFilterField: 'clientCode',
        dataSourceType: 'JSON_FILE',
        dataSourceRef: 'domain_keywords.json',
        description: 'Top organic keywords for competitor domains. Shows what keywords competitors are ranking for.',
        rowDescription: 'One row per keyword-domain-location combination.',
        columns: [
            { columnName: 'id', displayName: 'ID', dataType: 'string', sourceField: 'id', metricMatchKey: null },
            { columnName: 'clientCode', displayName: 'Client Code', dataType: 'string', sourceField: 'clientCode', metricMatchKey: null },
            { columnName: 'domain', displayName: 'Domain', dataType: 'string', sourceField: 'domain', metricMatchKey: null },
            { columnName: 'label', displayName: 'Label', dataType: 'string', sourceField: 'label', metricMatchKey: null },
            { columnName: 'locationCode', displayName: 'Location Code', dataType: 'string', sourceField: 'locationCode', metricMatchKey: 'location_code' },
            { columnName: 'languageCode', displayName: 'Language Code', dataType: 'string', sourceField: 'languageCode', metricMatchKey: 'language_code' },
            { columnName: 'keyword', displayName: 'Keyword', dataType: 'string', sourceField: 'keyword', metricMatchKey: null },
            { columnName: 'position', displayName: 'Position', dataType: 'number', sourceField: 'position', metricMatchKey: 'position' },
            { columnName: 'searchVolume', displayName: 'Search Volume', dataType: 'number', sourceField: 'searchVolume', metricMatchKey: 'search_volume' },
            { columnName: 'cpc', displayName: 'CPC', dataType: 'number', sourceField: 'cpc', metricMatchKey: 'cpc' },
            { columnName: 'url', displayName: 'Ranking URL', dataType: 'string', sourceField: 'url', metricMatchKey: null },
            { columnName: 'fetchedAt', displayName: 'Fetched At', dataType: 'date', sourceField: 'fetchedAt', metricMatchKey: 'fetched_at' },
            { columnName: 'snapshotDate', displayName: 'Snapshot Date', dataType: 'date', sourceField: 'snapshotDate', metricMatchKey: 'snapshot_date' },
        ],
    },
    {
        // DomainPageRecord type fields
        pageKey: 'domain-pages',
        pageName: 'Domain Top Pages',
        route: '/keywords/domain-pages',
        module: 'Keywords',
        clientFilterField: 'clientCode',
        dataSourceType: 'JSON_FILE',
        dataSourceRef: 'domain_pages.json',
        description: 'Top organic pages for competitor domains ranked by estimated traffic value.',
        rowDescription: 'One row per page URL.',
        columns: [
            { columnName: 'id', displayName: 'ID', dataType: 'string', sourceField: 'id', metricMatchKey: null },
            { columnName: 'clientCode', displayName: 'Client Code', dataType: 'string', sourceField: 'clientCode', metricMatchKey: null },
            { columnName: 'domain', displayName: 'Domain', dataType: 'string', sourceField: 'domain', metricMatchKey: null },
            { columnName: 'label', displayName: 'Label', dataType: 'string', sourceField: 'label', metricMatchKey: null },
            { columnName: 'locationCode', displayName: 'Location Code', dataType: 'string', sourceField: 'locationCode', metricMatchKey: 'location_code' },
            { columnName: 'languageCode', displayName: 'Language Code', dataType: 'string', sourceField: 'languageCode', metricMatchKey: 'language_code' },
            { columnName: 'pageURL', displayName: 'Page URL', dataType: 'string', sourceField: 'pageURL', metricMatchKey: null },
            { columnName: 'estTrafficETV', displayName: 'Est. Traffic (ETV)', dataType: 'number', sourceField: 'estTrafficETV', metricMatchKey: 'etv' },
            { columnName: 'keywordsCount', displayName: 'Keywords Count', dataType: 'number', sourceField: 'keywordsCount', metricMatchKey: null },
            { columnName: 'fetchedAt', displayName: 'Fetched At', dataType: 'date', sourceField: 'fetchedAt', metricMatchKey: 'fetched_at' },
            { columnName: 'snapshotDate', displayName: 'Snapshot Date', dataType: 'date', sourceField: 'snapshotDate', metricMatchKey: 'snapshot_date' },
            { columnName: 'pageType', displayName: 'Page Type', dataType: 'string', sourceField: 'pageType', metricMatchKey: 'page_type' },
            { columnName: 'pageIntent', displayName: 'Page Intent', dataType: 'string', sourceField: 'pageIntent', metricMatchKey: 'page_intent' },
            { columnName: 'isSeoRelevant', displayName: 'SEO Relevant', dataType: 'boolean', sourceField: 'isSeoRelevant', metricMatchKey: null },
            { columnName: 'seoAction', displayName: 'SEO Action', dataType: 'string', sourceField: 'seoAction', metricMatchKey: 'seo_action' },
            { columnName: 'priorityScore', displayName: 'Priority Score', dataType: 'number', sourceField: 'priorityScore', metricMatchKey: 'priority_score' },
            { columnName: 'priorityTier', displayName: 'Priority Tier', dataType: 'string', sourceField: 'priorityTier', metricMatchKey: 'priority_tier' },
            { columnName: 'matchedProduct', displayName: 'Matched Product', dataType: 'string', sourceField: 'matchedProduct', metricMatchKey: null },
            { columnName: 'clusterName', displayName: 'Cluster Name', dataType: 'string', sourceField: 'clusterName', metricMatchKey: null },
        ],
    },
    {
        // DomainOverviewRecord type fields
        pageKey: 'domain-overview',
        pageName: 'Domain Overview',
        route: '/keywords/domain-overview',
        module: 'Keywords',
        clientFilterField: 'clientCode',
        dataSourceType: 'JSON_FILE',
        dataSourceRef: 'domain_overview.json',
        description: 'High-level domain metrics including organic traffic estimates and keyword counts.',
        rowDescription: 'One row per domain-location combination.',
        columns: [
            { columnName: 'id', displayName: 'ID', dataType: 'string', sourceField: 'id', metricMatchKey: null },
            { columnName: 'clientCode', displayName: 'Client Code', dataType: 'string', sourceField: 'clientCode', metricMatchKey: null },
            { columnName: 'domain', displayName: 'Domain', dataType: 'string', sourceField: 'domain', metricMatchKey: null },
            { columnName: 'label', displayName: 'Label', dataType: 'string', sourceField: 'label', metricMatchKey: null },
            { columnName: 'locationCode', displayName: 'Location Code', dataType: 'string', sourceField: 'locationCode', metricMatchKey: 'location_code' },
            { columnName: 'languageCode', displayName: 'Language Code', dataType: 'string', sourceField: 'languageCode', metricMatchKey: 'language_code' },
            { columnName: 'organicTrafficETV', displayName: 'Organic Traffic (ETV)', dataType: 'number', sourceField: 'organicTrafficETV', metricMatchKey: 'etv' },
            { columnName: 'organicKeywordsCount', displayName: 'Organic Keywords Count', dataType: 'number', sourceField: 'organicKeywordsCount', metricMatchKey: 'organic_keywords_count' },
            { columnName: 'fetchedAt', displayName: 'Fetched At', dataType: 'date', sourceField: 'fetchedAt', metricMatchKey: 'fetched_at' },
            { columnName: 'snapshotDate', displayName: 'Snapshot Date', dataType: 'date', sourceField: 'snapshotDate', metricMatchKey: 'snapshot_date' },
        ],
    },
    {
        // SerpResult type fields
        pageKey: 'serp-results',
        pageName: 'SERP Results',
        route: '/keywords/serp-results',
        module: 'Keywords',
        clientFilterField: 'clientCode',
        dataSourceType: 'JSON_FILE',
        dataSourceRef: 'serp_results.json',
        description: 'Detailed SERP (Search Engine Results Page) data for tracked keywords showing top ranking pages.',
        rowDescription: 'One row per keyword-rank position in SERP.',
        columns: [
            { columnName: 'id', displayName: 'ID', dataType: 'string', sourceField: 'id', metricMatchKey: null },
            { columnName: 'clientCode', displayName: 'Client Code', dataType: 'string', sourceField: 'clientCode', metricMatchKey: null },
            { columnName: 'keyword', displayName: 'Keyword', dataType: 'string', sourceField: 'keyword', metricMatchKey: null },
            { columnName: 'locationCode', displayName: 'Location Code', dataType: 'number', sourceField: 'locationCode', metricMatchKey: 'location_code' },
            { columnName: 'languageCode', displayName: 'Language Code', dataType: 'string', sourceField: 'languageCode', metricMatchKey: 'language_code' },
            { columnName: 'rank', displayName: 'Rank', dataType: 'number', sourceField: 'rank', metricMatchKey: 'rank' },
            { columnName: 'rankAbsolute', displayName: 'Rank Absolute', dataType: 'number', sourceField: 'rankAbsolute', metricMatchKey: 'rank_absolute' },
            { columnName: 'url', displayName: 'URL', dataType: 'string', sourceField: 'url', metricMatchKey: null },
            { columnName: 'title', displayName: 'Title', dataType: 'string', sourceField: 'title', metricMatchKey: null },
            { columnName: 'description', displayName: 'Description', dataType: 'string', sourceField: 'description', metricMatchKey: null },
            { columnName: 'domain', displayName: 'Domain', dataType: 'string', sourceField: 'domain', metricMatchKey: null },
            { columnName: 'breadcrumb', displayName: 'Breadcrumb', dataType: 'string', sourceField: 'breadcrumb', metricMatchKey: null },
            { columnName: 'isFeaturedSnippet', displayName: 'Featured Snippet', dataType: 'boolean', sourceField: 'isFeaturedSnippet', metricMatchKey: 'featured_snippet' },
            { columnName: 'isImage', displayName: 'Is Image', dataType: 'boolean', sourceField: 'isImage', metricMatchKey: null },
            { columnName: 'isVideo', displayName: 'Is Video', dataType: 'boolean', sourceField: 'isVideo', metricMatchKey: null },
            { columnName: 'etv', displayName: 'ETV', dataType: 'number', sourceField: 'etv', metricMatchKey: 'etv' },
            { columnName: 'estimatedPaidTrafficCost', displayName: 'Est. Paid Traffic Cost', dataType: 'number', sourceField: 'estimatedPaidTrafficCost', metricMatchKey: 'estimated_paid_traffic_cost' },
            { columnName: 'fetchedAt', displayName: 'Fetched At', dataType: 'date', sourceField: 'fetchedAt', metricMatchKey: 'fetched_at' },
        ],
    },
    {
        // KeywordApiDataRecord type fields
        pageKey: 'keyword-api-data',
        pageName: 'Keyword API Data',
        route: '/keywords/api-data',
        module: 'Keywords',
        clientFilterField: 'clientCode',
        dataSourceType: 'JSON_FILE',
        dataSourceRef: 'keyword_api_data.json',
        description: 'Raw keyword metrics from DataForSEO including search volume, CPC, and competition data.',
        rowDescription: 'One row per keyword-location combination.',
        columns: [
            { columnName: 'id', displayName: 'ID', dataType: 'string', sourceField: 'id', metricMatchKey: null },
            { columnName: 'clientCode', displayName: 'Client Code', dataType: 'string', sourceField: 'clientCode', metricMatchKey: null },
            { columnName: 'keywordText', displayName: 'Keyword', dataType: 'string', sourceField: 'keywordText', metricMatchKey: null },
            { columnName: 'normalizedKeyword', displayName: 'Normalized Keyword', dataType: 'string', sourceField: 'normalizedKeyword', metricMatchKey: null },
            { columnName: 'searchVolume', displayName: 'Search Volume', dataType: 'number', sourceField: 'searchVolume', metricMatchKey: 'search_volume' },
            { columnName: 'cpc', displayName: 'CPC', dataType: 'number', sourceField: 'cpc', metricMatchKey: 'cpc' },
            { columnName: 'competition', displayName: 'Competition', dataType: 'string', sourceField: 'competition', metricMatchKey: 'competition' },
            { columnName: 'lowTopOfPageBid', displayName: 'Low Top of Page Bid', dataType: 'number', sourceField: 'lowTopOfPageBid', metricMatchKey: 'low_top_of_page_bid' },
            { columnName: 'highTopOfPageBid', displayName: 'High Top of Page Bid', dataType: 'number', sourceField: 'highTopOfPageBid', metricMatchKey: 'high_top_of_page_bid' },
            { columnName: 'locationCode', displayName: 'Location Code', dataType: 'number', sourceField: 'locationCode', metricMatchKey: 'location_code' },
            { columnName: 'languageCode', displayName: 'Language Code', dataType: 'string', sourceField: 'languageCode', metricMatchKey: 'language_code' },
            { columnName: 'sourceApi', displayName: 'Source API', dataType: 'string', sourceField: 'sourceApi', metricMatchKey: null },
            { columnName: 'snapshotDate', displayName: 'Snapshot Date', dataType: 'date', sourceField: 'snapshotDate', metricMatchKey: 'snapshot_date' },
            { columnName: 'lastPulledAt', displayName: 'Last Pulled At', dataType: 'date', sourceField: 'lastPulledAt', metricMatchKey: 'last_pulled_at' },
        ],
    },
    {
        // ManualKeyword type fields
        pageKey: 'manual-keywords',
        pageName: 'Manual Keywords',
        route: '/keywords/manual',
        module: 'Master',
        clientFilterField: 'clientCode',
        dataSourceType: 'JSON_FILE',
        dataSourceRef: 'manualKeywords.json',
        description: 'Manually added keywords for tracking and analysis.',
        rowDescription: 'One row per manually added keyword.',
        columns: [
            { columnName: 'id', displayName: 'ID', dataType: 'string', sourceField: 'id', metricMatchKey: null },
            { columnName: 'clientCode', displayName: 'Client Code', dataType: 'string', sourceField: 'clientCode', metricMatchKey: null },
            { columnName: 'keywordText', displayName: 'Keyword', dataType: 'string', sourceField: 'keywordText', metricMatchKey: null },
            { columnName: 'notes', displayName: 'Notes', dataType: 'string', sourceField: 'notes', metricMatchKey: null },
            { columnName: 'isActive', displayName: 'Is Active', dataType: 'boolean', sourceField: 'isActive', metricMatchKey: null },
            { columnName: 'source', displayName: 'Source', dataType: 'string', sourceField: 'source', metricMatchKey: null },
        ],
    },
    {
        // Client Position SERP data - different from ClientPosition type
        // This is the client_positions_serp.json file used for live SERP tracking
        pageKey: 'client-position',
        pageName: 'Client Position SERP',
        route: '/curated/client-position',
        module: 'Curated',
        clientFilterField: 'clientCode',
        dataSourceType: 'JSON_FILE',
        dataSourceRef: 'client_positions_serp.json',
        description: 'Live SERP tracking for client keywords with rank positions from forensic SERP fetch.',
        rowDescription: 'One row per keyword-location with live SERP data.',
        columns: [
            { columnName: 'id', displayName: 'ID', dataType: 'string', sourceField: 'id', metricMatchKey: null },
            { columnName: 'clientCode', displayName: 'Client Code', dataType: 'string', sourceField: 'clientCode', metricMatchKey: null },
            { columnName: 'keyword', displayName: 'Keyword', dataType: 'string', sourceField: 'keyword', metricMatchKey: null },
            { columnName: 'locationType', displayName: 'Location Type', dataType: 'string', sourceField: 'locationType', metricMatchKey: null },
            { columnName: 'selectedDomain', displayName: 'Client Domain', dataType: 'string', sourceField: 'selectedDomain', metricMatchKey: null },
            { columnName: 'rank', displayName: 'Rank', dataType: 'number', sourceField: 'rank', metricMatchKey: 'rank' },
            { columnName: 'rankLabel', displayName: 'Rank Label', dataType: 'string', sourceField: 'rankLabel', metricMatchKey: null },
            { columnName: 'searchVolume', displayName: 'Search Volume', dataType: 'number', sourceField: 'searchVolume', metricMatchKey: 'search_volume' },
            { columnName: 'cpc', displayName: 'CPC', dataType: 'number', sourceField: 'cpc', metricMatchKey: 'cpc' },
            { columnName: 'competition', displayName: 'Competition', dataType: 'number', sourceField: 'competition', metricMatchKey: 'competition' },
            { columnName: 'source', displayName: 'Source', dataType: 'string', sourceField: 'source', metricMatchKey: null },
            { columnName: 'lastPulledAt', displayName: 'Last Pulled At', dataType: 'date', sourceField: 'lastPulledAt', metricMatchKey: 'last_pulled_at' },
        ],
    },
    {
        // ClientPosition type fields - Historical positioning data
        pageKey: 'client-rank',
        pageName: 'Client Rank History',
        route: '/curated/client-rank',
        module: 'Curated',
        clientFilterField: 'clientCode',
        dataSourceType: 'JSON_FILE',
        dataSourceRef: 'client_positions.json',
        description: 'Historical positioning and competitor tracking for client keywords.',
        rowDescription: 'One row per keyword position record.',
        columns: [
            { columnName: 'id', displayName: 'ID', dataType: 'string', sourceField: 'id', metricMatchKey: null },
            { columnName: 'clientCode', displayName: 'Client Code', dataType: 'string', sourceField: 'clientCode', metricMatchKey: null },
            { columnName: 'keywordOrTheme', displayName: 'Keyword/Theme', dataType: 'string', sourceField: 'keywordOrTheme', metricMatchKey: null },
            { columnName: 'currentPosition', displayName: 'Current Position', dataType: 'string', sourceField: 'currentPosition', metricMatchKey: null },
            { columnName: 'competitor', displayName: 'Competitor', dataType: 'string', sourceField: 'competitor', metricMatchKey: null },
            { columnName: 'source', displayName: 'Source', dataType: 'string', sourceField: 'source', metricMatchKey: null },
            { columnName: 'notes', displayName: 'Notes', dataType: 'string', sourceField: 'notes', metricMatchKey: null },
            { columnName: 'asOfDate', displayName: 'As Of Date', dataType: 'date', sourceField: 'asOfDate', metricMatchKey: null },
            { columnName: 'createdAt', displayName: 'Created At', dataType: 'date', sourceField: 'createdAt', metricMatchKey: null },
            { columnName: 'updatedAt', displayName: 'Updated At', dataType: 'date', sourceField: 'updatedAt', metricMatchKey: null },
        ],
    },
    {
        // CuratedKeyword type fields
        pageKey: 'curated-keywords',
        pageName: 'Curated Keywords',
        route: '/curated/keywords',
        module: 'Curated',
        clientFilterField: 'clientCode',
        dataSourceType: 'JSON_FILE',
        dataSourceRef: 'curated_keywords.json',
        description: 'Curated list of priority keywords selected for monitoring.',
        rowDescription: 'One row per curated keyword.',
        columns: [
            { columnName: 'id', displayName: 'ID', dataType: 'string', sourceField: 'id', metricMatchKey: null },
            { columnName: 'clientCode', displayName: 'Client Code', dataType: 'string', sourceField: 'clientCode', metricMatchKey: null },
            { columnName: 'keyword', displayName: 'Keyword', dataType: 'string', sourceField: 'keyword', metricMatchKey: null },
            { columnName: 'source', displayName: 'Source', dataType: 'string', sourceField: 'source', metricMatchKey: null },
            { columnName: 'notes', displayName: 'Notes', dataType: 'string', sourceField: 'notes', metricMatchKey: null },
            { columnName: 'createdAt', displayName: 'Created At', dataType: 'date', sourceField: 'createdAt', metricMatchKey: null },
            { columnName: 'updatedAt', displayName: 'Updated At', dataType: 'date', sourceField: 'updatedAt', metricMatchKey: null },
        ],
    },
    {
        // DomainProfile type fields
        pageKey: 'domain-profiles',
        pageName: 'Domain Profiles',
        route: '/clients',
        module: 'Master',
        clientFilterField: 'clientCode',
        dataSourceType: 'JSON_FILE',
        dataSourceRef: 'domainProfiles.json',
        description: 'Domain profile information including title, meta, traffic, and domain metrics from DataForSEO.',
        rowDescription: 'One row per domain profile.',
        columns: [
            { columnName: 'id', displayName: 'ID', dataType: 'string', sourceField: 'id', metricMatchKey: null },
            { columnName: 'clientCode', displayName: 'Client Code', dataType: 'string', sourceField: 'clientCode', metricMatchKey: null },
            { columnName: 'domain', displayName: 'Domain', dataType: 'string', sourceField: 'domain', metricMatchKey: null },
            { columnName: 'title', displayName: 'Title', dataType: 'string', sourceField: 'title', metricMatchKey: null },
            { columnName: 'metaDescription', displayName: 'Meta Description', dataType: 'string', sourceField: 'metaDescription', metricMatchKey: null },
            { columnName: 'inferredCategory', displayName: 'Inferred Category', dataType: 'string', sourceField: 'inferredCategory', metricMatchKey: null },
            { columnName: 'organicTraffic', displayName: 'Organic Traffic', dataType: 'number', sourceField: 'organicTraffic', metricMatchKey: 'organic_traffic' },
            { columnName: 'organicKeywordsCount', displayName: 'Organic Keywords Count', dataType: 'number', sourceField: 'organicKeywordsCount', metricMatchKey: 'organic_keywords_count' },
            { columnName: 'backlinksCount', displayName: 'Backlinks Count', dataType: 'number', sourceField: 'backlinksCount', metricMatchKey: 'backlinks_count' },
            { columnName: 'referringDomainsCount', displayName: 'Referring Domains Count', dataType: 'number', sourceField: 'referringDomainsCount', metricMatchKey: 'referring_domains_count' },
            { columnName: 'domainRank', displayName: 'Domain Rank', dataType: 'number', sourceField: 'domainRank', metricMatchKey: 'domain_rank' },
            { columnName: 'fetchStatus', displayName: 'Fetch Status', dataType: 'string', sourceField: 'fetchStatus', metricMatchKey: null },
            { columnName: 'errorMessage', displayName: 'Error Message', dataType: 'string', sourceField: 'errorMessage', metricMatchKey: null },
            { columnName: 'lastFetchedAt', displayName: 'Last Fetched At', dataType: 'date', sourceField: 'lastFetchedAt', metricMatchKey: 'last_pulled_at' },
            { columnName: 'createdAt', displayName: 'Created At', dataType: 'date', sourceField: 'createdAt', metricMatchKey: null },
            { columnName: 'updatedAt', displayName: 'Updated At', dataType: 'date', sourceField: 'updatedAt', metricMatchKey: null },
        ],
    },
];

/**
 * Runs the discovery scan to register all known exportable pages and their columns.
 */
export async function runDiscoveryScan(): Promise<DiscoveryResult> {
    let pagesDiscovered = 0;
    let pagesUpdated = 0;
    let columnsRegistered = 0;

    for (const manifest of PAGE_MANIFEST) {
        // Upsert page entry
        await upsertExportPage({
            pageKey: manifest.pageKey,
            pageName: manifest.pageName,
            route: manifest.route,
            module: manifest.module,
            clientFilterField: manifest.clientFilterField,
            dataSourceType: manifest.dataSourceType,
            dataSourceRef: manifest.dataSourceRef,
            description: manifest.description,
            rowDescription: manifest.rowDescription,
            status: 'ACTIVE',
            lastDiscoveredAt: new Date().toISOString(),
        });
        pagesDiscovered++;
        pagesUpdated++;

        // Upsert columns
        await upsertColumns(manifest.pageKey, manifest.columns.map(col => ({
            columnName: col.columnName,
            displayName: col.displayName,
            dataType: col.dataType,
            sourceField: col.sourceField,
            metricMatchKey: col.metricMatchKey,
            notes: null,
        })));
        columnsRegistered += manifest.columns.length;
    }

    return {
        pagesDiscovered,
        pagesUpdated,
        columnsRegistered,
    };
}

/**
 * Get the page manifest (useful for debugging/introspection)
 */
export function getPageManifest(): PageManifest[] {
    return PAGE_MANIFEST;
}
