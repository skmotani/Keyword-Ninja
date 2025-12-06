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
│   │   │   └── seo/keywords/   # SEO keyword API data endpoints
│   │   ├── clients/            # Client Master page
│   │   ├── competitors/        # Competitor Master page
│   │   ├── keywords/
│   │   │   ├── manual/         # Keyword Manual Master page
│   │   │   └── api-data/       # Keyword API Data page
│   │   ├── globals.css         # Global styles
│   │   ├── layout.tsx          # Root layout with navbar
│   │   └── page.tsx            # Home page
│   ├── components/             # Reusable components
│   │   ├── Navbar.tsx          # Navigation bar
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
- `serviceName`: string
- `serviceType`: 'SEO_DATA' | 'ANALYTICS' | 'OTHER'
- `apiKey`: string
- `apiSecret`: optional string
- `notes`: optional string
- `isActive`: boolean
- `createdAt`: string (ISO date)
- `updatedAt`: string (ISO date)

### KeywordApiDataRecord
- `id`: string (UUID)
- `clientCode`: string (references Client.code)
- `keywordText`: string
- `normalizedKeyword`: string
- `searchVolume`: number | null
- `cpc`: number | null
- `competitionIndex`: number | null
- `locationCode`: string ('IN', 'GL')
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
  - Client and location dropdowns for filtering
  - Refresh button to fetch latest data (requires active SEO_DATA API credential)
  - Summary statistics (total keywords, search volume count, avg competition)
  - Compact read-only data table

## Storage
Data is persisted in JSON files in the `data/` folder. This allows for easy backup, migration, and version control of data.
