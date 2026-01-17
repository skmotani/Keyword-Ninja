---
description: How to deploy to Railway with pre-flight checks
---

# Deploy to Railway

Before pushing to main (which triggers Railway deployment), always run these checks:

## Pre-Deploy Checklist

// turbo
1. Run TypeScript check to catch build errors locally:
```bash
npx tsc --noEmit
```

// turbo
2. If TypeScript passes, commit and push:
```bash
git add .
git commit -m "your message"
git push
```

## Notes
- Railway builds use stricter TypeScript settings than local dev
- Common issues: missing type properties, iterator/Set spread, optional chaining
- Always run `npx tsc --noEmit` before pushing to avoid wasted build time
