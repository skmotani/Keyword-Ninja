# ⚠️ DATA FILES SYNC GUIDE

## Files that SYNC to Railway (via git push)
These files can be edited locally and will deploy to Railway:

| File | Purpose |
|------|---------|
| `dashboard_queries.json` | Query definitions |
| `dashboard_query_groups.json` | Query group definitions |
| `clients.json` | Client master data |
| `competitors.json` | Competitor master data |
| `client_ai_profiles.json` | AI profile data |

---

## ⛔ Files that DO NOT SYNC to Railway (Railway Volume Only)
**DO NOT edit these locally expecting them to appear on Railway!**
These are stored in Railway's persistent volume and managed via the UI:

| File | Purpose | How to Edit |
|------|---------|-------------|
| `dashboard_query_customizations.json` | Custom titles, page content, query order | Edit via Dashboard UI on Railway |
| Files created at runtime | Session data, cached results | Managed automatically |

---

## Why?
Railway volumes persist data across deployments. When you deploy:
1. Git files overwrite code files ✅
2. Volume files remain UNCHANGED ⚠️

This design allows users to customize without losing changes on redeploy.
