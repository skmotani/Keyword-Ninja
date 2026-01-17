---
description: How to deploy to Railway with pre-flight checks
---

# Deploy to Railway

All checks run automatically now! Just commit and push.

## Automatic Safeguards (Already Active)

### 1. Pre-commit Hook
✅ TypeScript check runs before every commit
✅ Blocks commit if errors found

### 2. Pre-push Hook  
✅ TypeScript check runs before every push
✅ Blocks push if errors found

### 3. Data Sync on Deploy
✅ `dashboard_queries.json` synced on every deploy
✅ `dashboard_query_groups.json` synced on every deploy

## To Deploy

// turbo-all
```bash
git add .
git commit -m "your changes"
git push
```

Railway auto-deploys from main branch.

## If You See Errors

1. **Build failed on Railway**: The pre-commit hook should have caught this. Run `npx tsc --noEmit` locally to check.

2. **Data not syncing**: Add the file to `ALWAYS_SYNC_FILES` in `scripts/init-data.js`
