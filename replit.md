# SEO Keyword Intelligence Platform

## Overview
A full-stack web application for managing SEO research data including clients, competitors, and keywords. Built with Next.js, TypeScript, and Tailwind CSS with JSON file-based persistence.

## Project Structure
```
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/                # API routes
│   │   │   ├── clients/        # Client CRUD endpoints
│   │   │   ├── competitors/    # Competitor CRUD endpoints
│   │   │   ├── keywords/       # Keywords CRUD endpoints
│   │   │   ├── api-credentials/# API credentials CRUD endpoints
│   │   │   └── seo/
│   │   │       ├── keywords/   # SEO keyword API data endpoints
│   │   │       └── serp/       # SERP results endpoints
│   │   ├── clients/            # Client Master page
│   │   ├── competitors/        # Competitor Master page
│   │   ├── keywords/
│   │   │   ├── manual/         # Keyword Manual Master page
│   │   │   ├── api-data/       # Keyword API Data page
│   │   │   ├── serp-results/   # SERP Results page
│   │   │   └── domain-overview/# Domain Overview page (placeholder)
│   │   ├── settings/
│   │   │   └── api-credentials/# API Credentials Settings page
│   │   ├── globals.css         # Global styles
│   │   ├── layout.tsx          # Root layout with navbar
│   │   └── page.tsx            # Home page
│   ├── components/             # Reusable components
│   │   ├── Navbar.tsx          # Navigation bar with gear icon
│   │   └── PageHeader.tsx      # Page header component
│   ├── lib/                    # Utility libraries
│   │   ├── db.ts               # JSON file data access layer
│   │   ├── apiCredentialsStore.ts  # API credentials management
│   │   ├── keywordApiStore.ts  # Keyword API data management
│   │   └── serpStore.ts        # SERP results data management
│   └── types/                  # TypeScript type definitions
│       └── index.ts            # Data models
├── data/                       # JSON data files (mock database)
│   ├── clients.json
│   ├── competitors.json
│   ├── manualKeywords.json
│   ├── api_credentials.json
│   ├── keyword_api_data.json
│   └── serp_results.json
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
└── next.config.js
```

## Data Models

### Client
- `id`: string (UUID)
- `code`: string (e.g., "01", "02")
- `name`: string
- `mainDomain`: string
- `notes`: optional string
- `isActive`: boolean (false = archived)

### Competitor
- `id`: string (UUID)
- `clientCode`: string (references Client.code)
- `name`: string
- `domain`: string
- `notes`: optional string
- `isActive`: boolean

### ManualKeyword
- `id`: string (UUID)
- `clientCode`: string (references Client.code)
- `keywordText`: string
- `notes`: optional string
- `isActive`: boolean

### ApiCredential
- `id`: string (UUID)
- `userId`: string (default "admin")
- `serviceType`: 'DATAFORSEO' | 'SEO_SERP' | 'OPENAI' | 'GEMINI' | 'GROK' | 'GSC' | 'CUSTOM'
- `authType`: 'USERNAME_PASSWORD' | 'API_KEY' | 'OAUTH' | 'CUSTOM'
- `username`: optional string (masked, for USERNAME_PASSWORD auth)
- `passwordMasked`: optional string (masked version only)
- `apiKeyMasked`: optional string (masked version only)
- `customConfig`: optional string (for OAuth/JSON configs)
- `label`: string (human-friendly name)
- `clientCode`: optional string (if credential is client-specific)
- `notes`: optional string
- `isActive`: boolean
- `createdAt`: string (ISO date)
- `updatedAt`: string (ISO date)

**IMPORTANT**: Only masked versions of secrets are stored in JSON. Real API keys/passwords should be stored in Replit Secrets.

### KeywordApiDataRecord
- `id`: string (UUID)
- `clientCode`: string (references Client.code)
- `keywordText`: string
- `normalizedKeyword`: string
- `searchVolume`: number | null - Monthly average search volume
- `cpc`: number | null - Cost per click
- `competition`: string | null - Competition level (HIGH, MEDIUM, LOW)
- `lowTopOfPageBid`: number | null - Minimum bid for top of page (~20th percentile)
- `highTopOfPageBid`: number | null - Maximum bid for top of page (~80th percentile)
- `locationCode`: number - Numeric location code (2356=India, 2840=Global/US)
- `languageCode`: string - Language code (e.g., 'en')
- `sourceApi`: string (e.g., 'DATAFORSEO')
- `snapshotDate`: string
- `lastPulledAt`: string (ISO date)

### SerpResult
- `id`: string (UUID)
- `clientCode`: string (references Client.code)
- `keyword`: string - The search keyword
- `locationCode`: number - Numeric location code (2356=India, 2840=Global/US)
- `languageCode`: string - Language code (e.g., 'en')
- `rank`: number - Position within organic results (1-10)
- `rankAbsolute`: number - Absolute position including all SERP elements
- `url`: string - Full URL of the result
- `title`: string - Page title displayed in SERP
- `description`: string - Meta description/snippet
- `domain`: string - Domain of the ranking page
- `breadcrumb`: string | null - Breadcrumb path shown in SERP
- `isFeaturedSnippet`: boolean - Whether it's a featured snippet
- `isImage`: boolean - Whether result includes an image
- `isVideo`: boolean - Whether result includes video
- `highlighted`: string[] - Keywords highlighted in the snippet
- `etv`: number | null - Estimated traffic value
- `estimatedPaidTrafficCost`: number | null - Estimated cost if traffic was paid
- `fetchedAt`: string (ISO date)

## Running the Application
```bash
npm run dev
```
The app runs on port 5000.

## Features
- **Home**: Dashboard with navigation cards
- **Clients**: CRUD operations for client management
- **Competitors**: CRUD operations linked to clients
  - **Bulk Import**: Add multiple competitors at once by pasting domain names (one per line)
- **Keyword Manual**: CRUD operations for manually collected keywords
  - **Bulk Import**: Add multiple keywords at once by pasting keywords (one per line)
- **Keyword API Data**: View keyword metrics fetched from SEO data providers
  - Client and location checkboxes for filtering (India IN, Global GL)
  - Refresh button fetches both locations in a single batched API call
  - Per-location summary showing total records
  - Refresh summary showing: original keywords, skipped, sent to API, records created, duplicates removed
  - Table filters: keyword search, location, competition level, min/max search volume
  - Table columns with tooltips: Keyword, Search Vol, CPC, Competition, Low Bid, High Bid, Location, Lang, Last Pulled
  - Sortable numerical columns (Search Vol, CPC, Low Bid, High Bid) with ascending/descending toggle
  - One row per keyword per location (no duplicates)
- **SERP Results**: Google organic search results for keywords
  - Uses keywords from Keyword API Data as input (no duplicates)
  - Fetches top 10 organic results per keyword per location
  - Client dropdown + Location checkboxes (IN, GL)
  - Refresh button calls DataForSEO SERP API and replaces existing data
  - Table columns: Date, Keyword, Scope, Rank, Abs Rank, Domain, URL, Title, Snippet, Breadcrumb, Featured Snippet, Image, Video, ETV, Est. Cost
  - Filters: keyword search, domain search, location, rank range, featured snippet filter
  - Sortable numerical columns (Rank, Abs Rank, ETV, Est. Cost)
  - Left-aligned tooltips on column headers
- **API Credentials Settings** (gear icon in navbar)
  - Three organized boxes: DataForSEO, API Key-based, Custom/GSC
  - Add/Edit/Delete credentials with modal forms
  - Toggle active status
  - Masked display for sensitive fields
  - Support for multiple auth types

## Navigation
The navbar uses dropdown menus organized by category:
- **Home** - Direct link to dashboard
- **Master** (dropdown) - Clients, Keyword Manual
- **Reports** (dropdown) - Competitors
- **SeoData** (dropdown) - Keyword API Data, SERP Results, Domain Overview
- **Settings gear icon** (⚙️) on the far right navigates to `/settings/api-credentials`

## Storage
Data is persisted in JSON files in the `data/` folder. This allows for easy backup, migration, and version control of data.

## Security
- Only masked versions of API keys and passwords are stored in JSON files
- Real secrets should be stored in Replit Secrets
- The credential management UI is for reference/configuration only

## Shared UI Patterns (For Building New Pages)

When building new data pages similar to Keyword API Data or SERP Results, follow these patterns:

### Page Layout Structure
```
1. PageHeader component with title and description
2. Control panel (client dropdown, location checkboxes, refresh button)
3. Notification area (success/error messages)
4. Refresh stats summary (collapsible, shows after refresh)
5. Location stats summary (per-location record counts)
6. Filters panel (search inputs, dropdowns, clear button)
7. Data table (sortable columns, tooltips)
```

### Data Refresh Behavior
- **Replace strategy**: When refreshing, delete existing records for client+location combo and insert new ones
- No append mode - data is completely overwritten per refresh
- Use `replaceXxxDataForClientAndLocations()` pattern in store files

### Tooltip Component Pattern
```tsx
function Tooltip({ text, children }: TooltipProps) {
  // Uses fixed positioning for proper visibility outside table cells
  // Left-aligned positioning (not center)
  // Arrow indicator pointing down
  // Max width constraint for long text
}
```

### Sortable Columns Pattern
```tsx
type SortField = 'fieldA' | 'fieldB' | null;
type SortDirection = 'asc' | 'desc';

// State
const [sortField, setSortField] = useState<SortField>(null);
const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

// Handler toggles direction if same field, resets if different field
const handleSort = (field: SortField) => { ... };

// Icon shows ↑ or ↓ based on current sort
const getSortIcon = (field: SortField) => { ... };

// Sort in filteredRecords useMemo, push nulls to bottom
```

### Filter Pattern
- Filter inputs in grid layout
- "Clear all filters" button appears when any filter is active
- Filters applied in useMemo for performance
- Combined with sorting in same useMemo

### Date Formatting
- Use format: "M/D HH:mm" (e.g., "12/6 14:30")
- Include both date and time for last-pulled timestamps

### Location Codes
- India (IN): 2356
- Global/US (GL): 2840
- Store numeric codes, display string labels

### API Route Patterns
- GET endpoint: Fetch stored data by clientCode and locationCodes
- POST /fetch endpoint: Call external API, transform data, replace in store
- Return stats object with per-location breakdown

### Store File Pattern (lib/xxxStore.ts)
```
- readXxxData() - internal read from JSON
- writeXxxData() - internal write to JSON
- getXxxData() - public get all
- getXxxDataByClientAndLocations() - public filtered get
- replaceXxxDataForClientAndLocations() - public replace
- saveXxxApiLog() - save raw API response for debugging
```
