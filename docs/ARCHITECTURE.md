# Keyword Ninja - Data Architecture & Deployment Guide

> **Last Updated:** January 15, 2026  
> **Purpose:** Reference document for understanding how data storage, local development, and Railway deployment work together.

---

## 🟢 Deployment Status

| Component | Status | Details |
|-----------|--------|---------|
| **Railway App** | ✅ Live | https://keyword-ninja-production.up.railway.app |
| **PostgreSQL** | ✅ Running | User auth, sessions, accounts |
| **Volume** | ✅ Mounted | `/app/data` - JSON files persist |
| **Data Init** | ✅ Working | Auto-copies data on first deploy |
| **Google OAuth** | ✅ Working | Sign in with Google enabled |

**Last Successful Deploy:** January 15, 2026

---


## Table of Contents

1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Data Storage Strategy](#data-storage-strategy)
4. [Development Workflow](#development-workflow)
5. [What's Possible & What's Not](#whats-possible--whats-not)
6. [Step-by-Step Setup](#step-by-step-setup)
7. [Future Migration Plan](#future-migration-plan)

---

## Overview

### Current Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           KEYWORD NINJA APP                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   DATA STORAGE (Two Types)                                                   │
│   ────────────────────────                                                   │
│                                                                              │
│   1. JSON Files (Application Data)     2. PostgreSQL (Auth Data)            │
│      • Client profiles                    • User accounts                    │
│      • Keywords                           • Sessions                         │
│      • Domain data                        • OAuth tokens                     │
│      • SERP results                                                          │
│      • API credentials                                                       │
│                                                                              │
│   DEPLOYMENT                                                                 │
│   ──────────                                                                 │
│   • Railway (Production)                                                     │
│   • Local (Development)                                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Diagram

### Complete System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│                              RAILWAY (Production)                            │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                      │   │
│   │   ┌─────────────────┐         ┌─────────────────┐                   │   │
│   │   │  NEXT.JS APP    │◄───────►│   PostgreSQL    │                   │   │
│   │   │  (Container)    │         │   (Database)    │                   │   │
│   │   └────────┬────────┘         │                 │                   │   │
│   │            │                  │  • Users        │                   │   │
│   │            ▼                  │  • Accounts     │                   │   │
│   │   ┌─────────────────┐         │  • Sessions     │                   │   │
│   │   │  VOLUME         │         │  • Future data  │                   │   │
│   │   │  (Persistent)   │         └─────────────────┘                   │   │
│   │   │                 │                  ▲                            │   │
│   │   │  • JSON files   │                  │                            │   │
│   │   │  • App data     │                  │ Same Database              │   │
│   │   │  • Survives     │                  │ Connection                 │   │
│   │   │    redeploys    │                  │                            │   │
│   │   └─────────────────┘                  │                            │   │
│   │                                        │                            │   │
│   └────────────────────────────────────────┼────────────────────────────┘   │
│                                            │                                 │
└────────────────────────────────────────────┼─────────────────────────────────┘
                                             │
                                             │ Internet Connection
                                             │
┌────────────────────────────────────────────┼─────────────────────────────────┐
│                                            │                                 │
│                         LOCAL DEVELOPMENT  │                                 │
│   ┌────────────────────────────────────────┼────────────────────────────────┐│
│   │                                        ▼                                ││
│   │   ┌─────────────────┐         ┌─────────────────┐                      ││
│   │   │  NEXT.JS APP    │◄───────►│   Railway       │                      ││
│   │   │  (npm run dev)  │         │   PostgreSQL    │                      ││
│   │   └────────┬────────┘         │   (Remote)      │                      ││
│   │            │                  └─────────────────┘                      ││
│   │            ▼                                                            ││
│   │   ┌─────────────────┐                                                   ││
│   │   │  LOCAL FILES    │         ┌─────────────────┐                      ││
│   │   │  (data/ folder) │         │  NOT SYNCED     │                      ││
│   │   │                 │◄───────►│  TO RAILWAY     │                      ││
│   │   │  • JSON files   │         │  (Separate!)    │                      ││
│   │   │  • Test data    │         └─────────────────┘                      ││
│   │   └─────────────────┘                                                   ││
│   │                                                                         ││
│   └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Storage Strategy

### Current State

| Data Type | Storage | Location | Persists? |
|-----------|---------|----------|-----------|
| User accounts, auth | PostgreSQL | Railway | ✅ Yes |
| Client profiles | JSON | Railway Volume | ✅ Yes (with Volume) |
| Keywords | JSON | Railway Volume | ✅ Yes (with Volume) |
| Domain data | JSON | Railway Volume | ✅ Yes (with Volume) |
| SERP results | JSON | Railway Volume | ✅ Yes (with Volume) |
| API credentials | JSON | Railway Volume | ✅ Yes (with Volume) |

### Data Files in `data/` Folder

```
data/
├── api_credentials.json      # API keys (sensitive - in Volume)
├── client_ai_profiles.json   # AI profiles for clients
├── client_positions.json     # Client ranking positions
├── clients.json              # Client list
├── competitors.json          # Competitor data
├── domain_keywords.json      # Keywords by domain
├── domain_pages.json         # Page data
├── domain_overview.json      # Domain summaries
├── keyword_tags.json         # Keyword classifications
├── serp_results.json         # Search results
└── ... more files
```

---

## Development Workflow

### Workflow Options

You can choose between two approaches depending on the situation:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   OPTION A: Test Locally First (Recommended for complex changes)            │
│   ──────────────────────────────────────────────────────────────            │
│                                                                              │
│   1. Write code locally                                                      │
│   2. Run: npm run dev                                                        │
│   3. Test at http://localhost:5000                                          │
│   4. Fix any bugs                                                            │
│   5. When satisfied: git push                                               │
│   6. Railway auto-deploys                                                    │
│                                                                              │
│   Best for: New features, complex logic, risky changes                      │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   OPTION B: Push Directly to Railway (Faster for simple changes)            │
│   ──────────────────────────────────────────────────────────────            │
│                                                                              │
│   1. Write code locally                                                      │
│   2. git push                                                                │
│   3. Wait ~2 minutes for Railway deploy                                     │
│   4. Test on live site                                                       │
│                                                                              │
│   Best for: UI tweaks, small fixes, text changes                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Git Push Flow

```
LOCAL CODE                    GITHUB                      RAILWAY
──────────                    ──────                      ───────
    │                            │                            │
    │  git add .                 │                            │
    │  git commit -m "..."       │                            │
    │  git push                  │                            │
    ├───────────────────────────►│                            │
    │                            │  Webhook triggers          │
    │                            ├───────────────────────────►│
    │                            │                            │
    │                            │                    Build & Deploy
    │                            │                       (~2 min)
    │                            │                            │
    │                            │                    ┌───────▼───────┐
    │                            │                    │ App is LIVE!  │
    │                            │                    └───────────────┘
```

---

## What's Possible & What's Not

### ✅ POSSIBLE

| Action | How |
|--------|-----|
| Access same PostgreSQL from local and Railway | Use Railway DATABASE_URL in local .env |
| Persist JSON data on Railway | Use Railway Volume |
| Test locally before deploying | Run `npm run dev` |
| Push directly to Railway | Just `git push` |
| View/edit PostgreSQL data | Prisma Studio (local or Railway) |

### ❌ NOT POSSIBLE

| Action | Why |
|--------|-----|
| Auto-sync JSON files between local and Railway | No built-in sync mechanism |
| Use SQLite on Railway | Railway filesystem is temporary |
| Keep JSON data without Volume | Lost on every redeploy |
| Access Railway Volume from local | Volume is only available inside Railway container |

### ⚠️ IMPORTANT LIMITATIONS

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   LOCAL JSON FILES ≠ RAILWAY JSON FILES                                     │
│   ────────────────────────────────────────                                   │
│                                                                              │
│   • Local data/ folder is SEPARATE from Railway Volume                      │
│   • Changes made locally do NOT appear on Railway                           │
│   • Changes made on Railway do NOT appear locally                           │
│   • This is by design (separate environments)                               │
│                                                                              │
│   SOLUTION: For testing with real data, use Railway directly                │
│             For code development, use local with test data                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Setup

### 1. Railway Volume Setup (One-time)

```
1. Go to Railway Dashboard
2. Click on Keyword-Ninja service
3. Go to Settings → Volumes
4. Click "Add Volume"
5. Mount path: /app/data
6. Size: Start with 1GB (can increase later)
7. Deploy the app
```

### 2. Push Initial Data to Volume (One-time)

```bash
# Commit all JSON data files
git add data/
git commit -m "Add initial application data"
git push

# Railway will deploy and copy files to Volume
```

### 3. Local Development with Railway PostgreSQL

Update your local `.env.local` file:

```env
# Use Railway PostgreSQL for local development
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@YOUR_HOST.railway.app:PORT/railway"

# Get this URL from Railway:
# Dashboard → Postgres → Connect → Connection URL
```

---

## Future Migration Plan

### Phase 1: Current State (Now)
```
JSON Files (in Volume) ──────► Application Data
PostgreSQL            ──────► Auth Data Only
```

### Phase 2: Gradual Migration (Future)
```
JSON Files (in Volume) ──────► Legacy Data (read-only)
PostgreSQL            ──────► Auth + New Features
```

### Phase 3: Full Migration (Eventually)
```
PostgreSQL            ──────► ALL Data
JSON Files            ──────► Backup/Archive only
```

### Migration Priority

| Priority | Data | Reason |
|----------|------|--------|
| 1 (High) | New features | Start fresh with PostgreSQL |
| 2 (Medium) | Frequently updated data | Benefits from database features |
| 3 (Low) | Static/reference data | Can stay as JSON |

---

## Quick Reference

### Commands

```bash
# Local development
npm run dev                    # Start local server

# Deploy to Railway
git add .
git commit -m "Your message"
git push                       # Auto-deploys to Railway

# Database
npx prisma studio              # View/edit database
npx prisma db push             # Update database schema
```

### URLs

| Environment | URL |
|-------------|-----|
| Local | http://localhost:5000 |
| Railway | https://keyword-ninja-production.up.railway.app |
| Railway Dashboard | https://railway.app/dashboard |

### Files

| File | Purpose |
|------|---------|
| `.env.local` | Local environment variables |
| `prisma/schema.prisma` | Database schema |
| `data/*.json` | Application data (JSON) |

---

## Troubleshooting

### Data not appearing on Railway?
- Check if Volume is mounted correctly
- Verify data files are committed to git
- Redeploy after adding Volume

### Database errors?
- Check DATABASE_URL is correct
- Run `npx prisma db push` after schema changes
- Verify Railway PostgreSQL is running

### Deploy not working?
- Check Railway dashboard for build errors
- Verify git push succeeded
- Check Railway logs for runtime errors

---

## Contact & Support

For questions about this architecture, refer to the conversation history in Cursor/Gemini chat where these decisions were made (January 2026).
