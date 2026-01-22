---
description: Guidelines for PostgreSQL-only development - never use JSON for data storage
---

# PostgreSQL-Only Development Guidelines

## 🚫 NEVER Use JSON Files for Data Storage

All new features MUST use PostgreSQL for data storage. JSON files should only be used for:
- Static configuration (glossary, dictionaries)
- API credentials (security)
- Temporary logs/caches (debug only)

---

## ✅ How to Add New Data Storage

### Step 1: Add Prisma Schema
Edit `prisma/schema.prisma` and add your model:

```prisma
model YourNewTable {
  id          String   @id @default(uuid())
  clientCode  String
  // ... your fields
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([clientCode])
}
```

### Step 2: Run Prisma Migration
```bash
npx prisma db push
npx prisma generate
```

### Step 3: Create Store File
Create `src/lib/storage/yourNewStore.ts`:

```typescript
import { prisma } from '@/lib/prisma';

export async function getRecords(clientCode: string) {
    return prisma.yourNewTable.findMany({ where: { clientCode } });
}

export async function createRecord(data: { clientCode: string; ... }) {
    return prisma.yourNewTable.create({ data });
}

export async function updateRecord(id: string, data: Partial<...>) {
    return prisma.yourNewTable.update({ where: { id }, data });
}

export async function deleteRecord(id: string) {
    return prisma.yourNewTable.delete({ where: { id } });
}
```

---

## ⚠️ Prohibited Patterns

### ❌ NEVER DO THIS:
```typescript
// BAD - Writing to JSON file
import fs from 'fs';
await fs.writeFile('data/mydata.json', JSON.stringify(data));

// BAD - Reading from JSON file for persistent data
const data = JSON.parse(await fs.readFile('data/mydata.json'));
```

### ✅ ALWAYS DO THIS:
```typescript
// GOOD - Using Prisma
import { prisma } from '@/lib/prisma';

// Read
const data = await prisma.myTable.findMany();

// Write
await prisma.myTable.create({ data });
```

---

## 📋 Pre-Commit Checklist

Before committing new code, verify:

1. ☐ No new `fs.writeFile` calls for data storage
2. ☐ No new JSON file paths in `data/` directory
3. ☐ All new data uses Prisma models
4. ☐ Schema changes pushed with `npx prisma db push`

---

## 🔧 Existing Feature Flags

All these flags are enabled - data goes to PostgreSQL:

```env
USE_POSTGRES_PROFILES=true
USE_POSTGRES_COMPETITORS=true
USE_POSTGRES_MANUAL_KEYWORDS=true
USE_POSTGRES_DOMAIN_KEYWORDS=true
USE_POSTGRES_DOMAIN_PAGES=true
USE_POSTGRES_SERP_RESULTS=true
USE_POSTGRES_KEYWORD_TAGS=true
USE_POSTGRES_DOMAIN_OVERVIEW=true
USE_POSTGRES_CLIENT_POSITIONS=true
USE_POSTGRES_DOMAIN_CLASSIFICATIONS=true
USE_POSTGRES_CLIENT_POSITIONS_SERP=true
USE_POSTGRES_DOMAIN_CREDIBILITY=true
USE_POSTGRES_DOMAIN_PROFILES=true
USE_POSTGRES_PAGE_CONFIGS=true
USE_POSTGRES_KEYWORD_API_DATA=true
USE_POSTGRES_CURATED_KEYWORDS=true
USE_POSTGRES_DASHBOARD_QUERIES=true
USE_POSTGRES_EXPORT_REGISTRY=true
USE_POSTGRES_PAGE_INTENT=true
```
