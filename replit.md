# SEO Keyword Intelligence Platform

## Overview
This project is a full-stack web application designed for comprehensive SEO research and data management. It enables users to manage clients, competitors, and keywords, integrating with SEO data providers for detailed analytics. The platform aims to streamline SEO workflows, providing tools for data collection, analysis, and reporting to enhance digital marketing strategies. It's built with Next.js, TypeScript, and Tailwind CSS, utilizing JSON files for data persistence.

## User Preferences
I prefer clear and concise explanations. When developing, please prioritize iterative development, focusing on one feature or module at a time. I value a clean, readable codebase with a strong emphasis on TypeScript for type safety. Before implementing significant changes or new features, please outline the proposed approach and ask for my approval. I prefer to be actively involved in major architectural decisions. Do not make changes to files outside the `src/` and `data/` directories unless absolutely necessary for core functionality.

## System Architecture

### UI/UX Decisions
The application features a clean, modern interface built with Tailwind CSS. Navigation is handled via a persistent navbar with dropdown menus for logical grouping of features (Home, Master, Reports, SeoData). A dedicated settings gear icon provides access to API credentials. Pages adhere to a consistent layout structure: `PageHeader`, control panel, notification area, refresh stats, location stats, filters panel, and a sortable data table with tooltips. Tooltips are designed for fixed positioning, left alignment, and have a max-width constraint.

### Technical Implementations
The project uses Next.js with the App Router for server-side rendering and API routes. Data persistence is managed through JSON files located in the `data/` directory, acting as a mock database. TypeScript is used throughout the application for strong typing and improved code quality. API routes handle CRUD operations for clients, competitors, keywords, and API credentials, as well as proxying requests to external SEO APIs.

### Feature Specifications
- **Client Management**: CRUD operations for client profiles, including multiple associated domains.
- **Competitor Management**: CRUD operations for competitors linked to specific clients, with bulk import functionality.
- **Manual Keyword Management**: CRUD for manually curated keywords, including bulk import.
- **Keyword API Data**: Displays keyword metrics (search volume, CPC, competition) fetched from SEO data providers. Features include client/location filtering, data refresh (replacing existing data), per-location summaries, and a sortable, filterable data table.
- **SERP Results**: Fetches and displays Google organic search results for specified keywords and locations. Includes filtering by keyword, domain, rank range, and featured snippets, with sortable columns for numerical data.
- **Domain Overview**: View domain-level organic visibility metrics (Traffic ETV & Keyword Counts) for competitor domains. Features client/location filtering, domain selection from competitors list, and batch data fetching from DataForSEO API.
- **Domain Top Pages**: View top 30 organic pages per domain with traffic and keyword counts. Supports filtering by domain and URL, with sortable columns for all numeric metrics.
- **Domain Top Keywords**: View top 100 ranked keywords per domain with search volume, CPC, position, and ranking URLs. Features domain selection grid, keyword filtering, and sortable data tables.
- **Unique Domains with AI Classification**: Reports page showing unique domains extracted from SERP results. Features AI-powered domain classification using OpenAI GPT-5 that analyzes each domain based on the client's AI profile and SERP context. Classification columns include Domain Type, Page Intent, Product Match Score, and Business Relevance Category. Supports per-domain and batch classification with progress tracking. Click on Business Relevance badge to view detailed explanation of the classification.
- **API Credentials Settings**: Secure management of API keys for various services (DataForSEO, OpenAI, etc.). Credentials are masked in display and stored, with actual secrets intended for Replit Secrets. Supports multiple authentication types and client-specific credentials.

### System Design Choices
- **JSON File Persistence**: Data is stored in `data/*.json` files for simplicity, easy backup, and version control.
- **Data Refresh Strategy**: When refreshing data from external APIs (e.g., Keyword API Data, SERP Results), existing records for the client and location are replaced entirely, ensuring data freshness. No append mode is supported.
- **Modular Data Stores**: Utility functions in `lib/` manage reading from and writing to JSON files, encapsulating data access logic.
- **Security**: Sensitive API keys and passwords are only stored in masked form in JSON files; actual secrets are expected to be managed via Replit Secrets.

## External Dependencies
- **DataForSEO API**: Used for fetching comprehensive keyword metrics and SERP results.
- **OpenAI API**: Integrated for potential AI-driven insights or content generation (credential management provided).
- **Google Search Console (GSC)**: Credential management for potential future integration.
- **Other AI Models**: Credential management for Gemini and Grok, indicating potential future integrations.