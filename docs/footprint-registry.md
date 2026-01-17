# Footprint Registry

The Footprint Registry is the master list of "surfaces" (places/platforms) where a brand's digital presence is checked during a Digital Footprint scan.

## Overview

**Route:** `/admin/footprint-registry`

The registry defines:
- **What** to search for (query templates)
- **Where** to search (source type, search engine)
- **How** to confirm presence (confirmation artifacts)
- **How** to classify results (Present/Partial/Absent/Unknown)
- **How** to score (base points × relevance × status factor)

## How the Scan Uses the Registry

1. **Load Registry:** The scan loads all enabled surfaces from `FootprintSurfaceRegistry`
2. **Generate Queries:** For each surface, substitute tokens in query templates:
   - `{brand}` → Brand name
   - `{domain}` → Domain without protocol
   - `{city}` → City (if provided)
   - `{country}` → Country (if provided)
   - `{industry}` → Industry type
   - `{variant1}`...`{variant5}` → Brand variants
3. **Execute Search:** Based on `sourceType`:
   - `WEBSITE_CRAWL` → Direct HTTP request to domain
   - `DATAFORSEO_SERP` → DataForSEO SERP API
   - `DATAFORSEO_AUTOCOMPLETE` → DataForSEO Autocomplete API
   - `DNS_LOOKUP` → DNS record check
4. **Evaluate Presence:** Apply presence rules:
   - **PRESENT** → Official evidence found (matches domain/brand)
   - **PARTIAL** → Evidence found but not official
   - **ABSENT** → No evidence found
   - **UNKNOWN** → Error or timeout
5. **Calculate Score:** 
   ```
   score = basePoints × relevanceWeight × statusFactor
   ```
   Where `statusFactor` is:
   - PRESENT = 1.0
   - PARTIAL = 0.5
   - ABSENT = 0.0
   - UNKNOWN = 0.0

## Adding New Surfaces

### Required Fields

| Field | Description | Example |
|-------|-------------|---------|
| `surfaceKey` | Unique uppercase snake_case ID | `LINKEDIN_COMPANY` |
| `label` | Display name | `LinkedIn Company Page` |
| `category` | Group (owned/search/social/etc.) | `social` |
| `importanceTier` | CRITICAL/HIGH/MEDIUM/LOW | `HIGH` |
| `sourceType` | Data source type | `DATAFORSEO_SERP` |
| `confirmationArtifact` | What confirms presence | `LinkedIn URL with brand name` |

### Query Templates

Use tokens to create dynamic queries:

```
// Simple brand search
"{brand}"

// Platform-specific
"site:linkedin.com/company \"{brand}\""

// Location-specific
"{brand} {city}"

// With variants
"{brand} OR {variant1} official"
```

### Categories

| Category | Description | Examples |
|----------|-------------|----------|
| `owned` | Brand-controlled assets | Website, Schema, Sitemap |
| `search` | Search engine presence | Google organic, News, Images |
| `social` | Social platforms | LinkedIn, Facebook, X |
| `video` | Video platforms | YouTube |
| `community` | Forums/communities | Reddit, Quora |
| `trust` | Review platforms | Trustpilot, G2, GBP |
| `authority` | Authority markers | Wikipedia, Crunchbase |
| `marketplace` | B2B marketplaces | IndiaMART, Alibaba |
| `technical` | Technical signals | DNS, Email auth |
| `ai` | AI knowledge | Wikidata entity |

### Importance Tiers

| Tier | Points Range | Meaning |
|------|-------------|---------|
| CRITICAL | 10-18 | Must-have for any business |
| HIGH | 5-10 | Important for most businesses |
| MEDIUM | 3-5 | Valuable but not essential |
| LOW | 1-2 | Nice to have |

## Industry/Geo Overrides

Surfaces can have overrides for specific industries or geographies:

```json
{
  "industryOverrides": {
    "saas": 1.0,
    "manufacturing": 0.2
  },
  "geoOverrides": {
    "local": 1.0,
    "global": 0.5
  }
}
```

During scan, the profiler determines industry/geo and applies matching weight.

## Test Query Tool

Before adding a new surface, use the Test Query tool:

1. Open registry → Select surface → View details
2. Enter domain and brand name
3. Click "Run Test"
4. Review:
   - Queries generated
   - Evidence found
   - Computed status
   - Score preview

This prevents broken registry entries from affecting production scans.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/footprint-registry` | GET | List surfaces with filters |
| `/api/admin/footprint-registry` | POST | Create new surface |
| `/api/admin/footprint-registry/[id]` | GET | Get single surface |
| `/api/admin/footprint-registry/[id]` | PUT | Update surface |
| `/api/admin/footprint-registry/[id]` | DELETE | Delete surface |
| `/api/admin/footprint-registry/seed` | POST | Reset to defaults |
| `/api/admin/footprint-registry/export` | GET | Export as JSON/CSV |
| `/api/admin/footprint-registry/import` | POST | Bulk import |
| `/api/admin/footprint-registry/test` | POST | Run test query |

## Database Schema

```prisma
model FootprintSurfaceRegistry {
  id                     String   @id @default(cuid())
  surfaceKey             String   @unique
  label                  String
  category               String
  importanceTier         String
  basePoints             Int      @default(10)
  defaultRelevanceWeight Float    @default(1)
  sourceType             String
  searchEngine           String?
  queryTemplates         Json
  maxQueries             Int      @default(2)
  confirmationArtifact   String   @db.Text
  presenceRules          Json?
  officialnessRules      Json?
  officialnessRequired   Boolean  @default(true)
  evidenceFields         Json?
  tooltipTemplates       Json?
  enabled                Boolean  @default(true)
  notes                  String?  @db.Text
  industryOverrides      Json?
  geoOverrides           Json?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
}
```

## Best Practices

1. **Always test before enabling** - Use the Test Query tool
2. **Start with MEDIUM tier** - Upgrade based on evidence
3. **Be specific in confirmationArtifact** - Helps debugging
4. **Use industry overrides** - G2 matters for SaaS, not retail
5. **Keep query templates focused** - Max 2-3 per surface
6. **Document in notes field** - Future maintainability
