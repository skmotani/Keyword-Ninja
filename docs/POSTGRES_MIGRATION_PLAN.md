# JSON to PostgreSQL Migration Plan

> **Status:** 📋 Planning Document (Not Started)  
> **Created:** January 15, 2026  
> **Priority:** Future Enhancement  

---

## Executive Summary

This document outlines the plan to migrate application data from JSON files to PostgreSQL database. The migration will be done in phases using a separate Git branch to ensure the existing app remains functional.

---

## Current State vs Target State

```
CURRENT STATE                          TARGET STATE
─────────────────                      ─────────────────
JSON Files (Volume)                    PostgreSQL Database
├── clients.json          ───────►    ├── clients table
├── domain_keywords.json  ───────►    ├── domain_keywords table
├── competitors.json      ───────►    ├── competitors table
├── domain_pages.json     ───────►    ├── domain_pages table
├── serp_results.json     ───────►    ├── serp_results table
└── ... more files        ───────►    └── ... more tables
```

---

## Difficulty Assessment

| Aspect | Rating | Notes |
|--------|--------|-------|
| **Technical Complexity** | 🟡 Medium | Schema design + API changes |
| **Risk Level** | 🟢 Low | Branch strategy protects main app |
| **Data Volume** | 🟡 Medium | ~30MB of JSON data |
| **Testing Required** | 🟡 Medium | Need to verify all features work |

---

## Safe Approach: Branch Strategy

```
main (production) ──────────────────────────────────────────────►
                    │
                    │ Create branch
                    ▼
              feature/postgres-migration ──────────────────────►
                    │                          │
                    │ Develop & Test           │ Merge when ready
                    │                          ▼
                    └─────────────────────────► main (updated)
```

**Key Safety Rules:**
1. ✅ Never merge until fully tested
2. ✅ Keep main branch working with JSON
3. ✅ Test in Railway preview environment before merging
4. ✅ Backup all JSON data before migration

---

## Migration Phases

### Phase 1: Setup & Schema Design (2-3 hours)
**Prompts Needed:** 2-3

| Task | Description |
|------|-------------|
| 1.1 | Create new Git branch `feature/postgres-migration` |
| 1.2 | Design PostgreSQL schema (tables, relationships) |
| 1.3 | Update `prisma/schema.prisma` with new models |
| 1.4 | Generate Prisma migrations |

**Checklist:**
- [ ] Create branch
- [ ] Design schema for all JSON files
- [ ] Add models to schema.prisma
- [ ] Run `prisma migrate dev`
- [ ] Verify tables created locally

---

### Phase 2: Data Layer Implementation (4-6 hours)
**Prompts Needed:** 5-8

| Task | Description |
|------|-------------|
| 2.1 | Create data access functions for each entity |
| 2.2 | Replace JSON read/write with Prisma queries |
| 2.3 | Update API routes to use new data layer |
| 2.4 | Handle data relationships (foreign keys) |

**Files to Modify:**
- `src/lib/data/*.ts` - New data layer files
- `src/app/api/**/*.ts` - API routes
- Any file that reads/writes JSON directly

**Checklist:**
- [ ] Create data layer for clients
- [ ] Create data layer for keywords
- [ ] Create data layer for competitors
- [ ] Create data layer for domain pages
- [ ] Create data layer for SERP results
- [ ] Create data layer for other entities
- [ ] Update all API routes

---

### Phase 3: Data Migration Script (2-3 hours)
**Prompts Needed:** 2-3

| Task | Description |
|------|-------------|
| 3.1 | Create migration script to read JSON files |
| 3.2 | Transform data to match new schema |
| 3.3 | Insert data into PostgreSQL |
| 3.4 | Verify data integrity |

**Script Location:** `scripts/migrate-json-to-postgres.ts`

**Checklist:**
- [ ] Create migration script
- [ ] Test with sample data
- [ ] Run full migration locally
- [ ] Verify record counts match
- [ ] Verify data integrity

---

### Phase 4: Testing (2-4 hours)
**Prompts Needed:** 2-3

| Task | Description |
|------|-------------|
| 4.1 | Test all pages load correctly |
| 4.2 | Test data CRUD operations |
| 4.3 | Test search/filter functionality |
| 4.4 | Performance testing |

**Checklist:**
- [ ] Home page loads
- [ ] All data pages show correct data
- [ ] Add/Edit/Delete operations work
- [ ] Search and filters work
- [ ] No console errors
- [ ] Performance acceptable

---

### Phase 5: Railway Deployment (1-2 hours)
**Prompts Needed:** 1-2

| Task | Description |
|------|-------------|
| 5.1 | Create Railway preview environment |
| 5.2 | Deploy branch to preview |
| 5.3 | Run migration script on Railway |
| 5.4 | Test in preview environment |

**Checklist:**
- [ ] Create preview environment
- [ ] Deploy feature branch
- [ ] Run migration script
- [ ] Test all functionality
- [ ] Verify data persists across redeploys

---

### Phase 6: Go Live (1 hour)
**Prompts Needed:** 1

| Task | Description |
|------|-------------|
| 6.1 | Final backup of JSON data |
| 6.2 | Merge branch to main |
| 6.3 | Monitor production |
| 6.4 | Remove Volume (optional, can keep as backup) |

**Checklist:**
- [ ] Backup JSON files
- [ ] Merge to main
- [ ] Production deployment successful
- [ ] All features working
- [ ] Documentation updated

---

## 📋 Master Checklist (All 31 Items)

### Phase 1: Setup & Schema (2-3 hours)
- [ ] Create Git branch `feature/postgres-migration`
- [ ] Design database tables for each JSON file
- [ ] Add table definitions to `prisma/schema.prisma`
- [ ] Run `prisma migrate dev` to create tables
- [ ] Verify tables exist in local database

### Phase 2: Data Layer (4-6 hours)
- [ ] Create data access file for clients
- [ ] Create data access file for keywords
- [ ] Create data access file for competitors
- [ ] Create data access file for domain pages
- [ ] Create data access file for SERP results
- [ ] Create data access file for other entities
- [ ] Update all API routes to use PostgreSQL instead of JSON
- [ ] Remove JSON file read/write code

### Phase 3: Migration Script (2-3 hours)
- [ ] Create script that reads all JSON files
- [ ] Transform JSON data to match table structure
- [ ] Insert all data into PostgreSQL tables
- [ ] Test with sample data first
- [ ] Run full migration locally
- [ ] Verify record counts match JSON
- [ ] Verify no data is missing

### Phase 4: Testing (2-4 hours)
- [ ] Home page loads correctly
- [ ] All data pages show correct data
- [ ] Add new record works
- [ ] Edit record works
- [ ] Delete record works
- [ ] Search functionality works
- [ ] Filter functionality works
- [ ] No console errors
- [ ] Performance is acceptable

### Phase 5: Railway Deploy (1-2 hours)
- [ ] Create Railway preview environment
- [ ] Deploy feature branch to preview
- [ ] Run migration script on Railway
- [ ] Test all pages on preview
- [ ] Verify data persists after redeploy

### Phase 6: Go Live (1 hour)
- [ ] Final backup of all JSON files
- [ ] Merge branch to main
- [ ] Production deployment completes
- [ ] All features working on production
- [ ] Update documentation
- [ ] Keep Volume for 30 days as backup

---

## Estimated Effort


| Phase | Hours | Prompts |
|-------|-------|---------|
| Phase 1: Setup & Schema | 2-3 | 2-3 |
| Phase 2: Data Layer | 4-6 | 5-8 |
| Phase 3: Migration Script | 2-3 | 2-3 |
| Phase 4: Testing | 2-4 | 2-3 |
| Phase 5: Railway Deploy | 1-2 | 1-2 |
| Phase 6: Go Live | 1 | 1 |
| **TOTAL** | **12-19 hours** | **13-20 prompts** |

---

## JSON Files to Migrate

| File | Size | Priority | Complexity |
|------|------|----------|------------|
| clients.json | 1.6 KB | High | Low |
| domain_keywords.json | 7.5 MB | High | Medium |
| domain_pages.json | 19 MB | High | Medium |
| competitors.json | 197 KB | Medium | Low |
| client_ai_profiles.json | 1.1 MB | Medium | Medium |
| serp_results.json | 3.9 MB | Medium | High |
| keyword_tags.json | 5.2 MB | Medium | Medium |
| domain_classifications.json | 381 KB | Low | Low |
| domain_overview.json | 66 KB | Low | Low |
| api_credentials.json | 1.4 KB | Low | Low |
| Others | ~500 KB | Low | Low |

---

## Proposed Schema (Draft)

```prisma
// Add to existing schema.prisma

model Client {
  id        String   @id @default(cuid())
  name      String
  domain    String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  keywords    DomainKeyword[]
  pages       DomainPage[]
  competitors Competitor[]
}

model DomainKeyword {
  id        String   @id @default(cuid())
  keyword   String
  volume    Int?
  position  Int?
  url       String?
  clientId  String
  client    Client   @relation(fields: [clientId], references: [id])
  createdAt DateTime @default(now())
  
  @@index([clientId])
  @@index([keyword])
}

model DomainPage {
  id          String   @id @default(cuid())
  url         String
  title       String?
  traffic     Int?
  keywords    Int?
  clientId    String
  client      Client   @relation(fields: [clientId], references: [id])
  createdAt   DateTime @default(now())
  
  @@index([clientId])
}

model Competitor {
  id        String   @id @default(cuid())
  domain    String
  clientId  String
  client    Client   @relation(fields: [clientId], references: [id])
  createdAt DateTime @default(now())
  
  @@index([clientId])
}

model SerpResult {
  id        String   @id @default(cuid())
  keyword   String
  position  Int?
  url       String?
  title     String?
  snippet   String?
  createdAt DateTime @default(now())
  
  @@index([keyword])
}
```

---

## Rollback Plan

If something goes wrong:

1. **Keep JSON-based code on main** - Can always switch back
2. **Don't delete Volume immediately** - Keep as backup for 30 days
3. **Export PostgreSQL data** - Before any destructive changes

---

## Commands Reference

```bash
# Create branch
git checkout -b feature/postgres-migration

# Run Prisma migration
npx prisma migrate dev --name add_app_data_tables

# Run migration script
npx ts-node scripts/migrate-json-to-postgres.ts

# Switch back to main if needed
git checkout main

# Merge when ready
git checkout main
git merge feature/postgres-migration
git push
```

---

## Next Steps (When Ready)

When you decide to start the migration:
1. Say: "Let's start the PostgreSQL migration"
2. We'll begin with Phase 1
3. Work through each phase systematically

---

**Document saved for future reference. Migration will NOT start until explicitly requested.**
