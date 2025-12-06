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
│   │   │   └── seo/keywords/   # SEO keyword API data endpoints
│   │   ├── clients/            # Client Master page
│   │   ├── competitors/        # Competitor Master page
│   │   ├── keywords/
│   │   │   ├── manual/         # Keyword Manual Master page
│   │   │   └── api-data/       # Keyword API Data page
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
│   │   └── keywordApiStore.ts  # Keyword API data management
│   └── types/                  # TypeScript type definitions
│       └── index.ts            # Data models
├── data/                       # JSON data files (mock database)
│   ├── clients.json
│   ├── competitors.json
│   ├── manualKeywords.json
│   ├── api_credentials.json
│   └── keyword_api_data.json
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
  - One row per keyword per location (no duplicates)
- **API Credentials Settings** (gear icon in navbar)
  - Three organized boxes: DataForSEO, API Key-based, Custom/GSC
  - Add/Edit/Delete credentials with modal forms
  - Toggle active status
  - Masked display for sensitive fields
  - Support for multiple auth types

## Navigation
- Main navigation links in the navbar header
- Settings gear icon (⚙️) on the far right navigates to `/settings/api-credentials`

## Storage
Data is persisted in JSON files in the `data/` folder. This allows for easy backup, migration, and version control of data.

## Security
- Only masked versions of API keys and passwords are stored in JSON files
- Real secrets should be stored in Replit Secrets
- The credential management UI is for reference/configuration only
