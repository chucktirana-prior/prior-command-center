# PRIOR Claude — Project Directory

A collection of internal tools for PRIOR Magazine, built with Node.js, React, and various APIs.

---

## Projects

### 1. PRIOR Command Center (`prior-command-center/`)
**Status:** Active (demo-ready)
**Ports:** Backend `3002` | Frontend `5173`

Central dashboard integrating analytics, content management, and AI. Pulls data from multiple sources into a single interface.

- **Stack:** Node.js + Express (ES modules), React 19 + Vite, Tailwind CSS, Recharts, better-sqlite3
- **Integrations:** Contentful CMA, Claude API (Anthropic), Google Analytics, Instagram/Meta, Klaviyo
- **Start:** `cd prior-command-center && ./demo.sh` or `npm run dev`
- **Scheduling:** Syncs data via cron (default: 6am daily)

### 2. Article Uploader (`article-uploader/`)
**Status:** Active (development)
**Ports:** Backend `3001` | Frontend `3000`

Parses Google Docs PDF exports and creates draft entries in Contentful. Extracts labeled metadata (hed, dek, slug, author, keywords, etc.) and converts body text to markdown with bold/italic/link formatting.

- **Stack:** Node.js + Express (CommonJS), React + Vite, pdfjs-dist, Multer
- **Integrations:** Contentful CMA (article, person, category content types)
- **Start:** Double-click `start-app.command` or `npm run dev`
- **PDF parsing:** Uses `pdfjs-dist` with `page.getOperatorList()` for font loading; detects bold/italic via PostScript font names; handles Google redirect URL unwrapping and Drive link filtering
- **Tests:** `node tests/generate-test-pdfs.js` then `node tests/run-parser-tests.js` (170 assertions across 8 test PDFs)

### 3. Article Uploader Stable (`article-uploader-stable/`)
**Status:** Frozen stable copy
**Ports:** Backend `3001` | Frontend `3000`

Snapshot of the article uploader at a known-good state. Don't run simultaneously with the development version (same ports).

### 4. Hotel Price Checker (`hotel-price-checker/`)
**Status:** Active
**Ports:** Backend `3001` | Frontend (Vite default)

Scrapes hotel pricing and availability data using headless browser automation.

- **Stack:** Node.js + Express + Nodemon, React + Vite, Puppeteer, Cheerio, node-cron
- **Start:** `npm run dev`
- **Config:** 45s scraping timeout, 3 max retries, headless mode enabled

### 5. Booking Agent (`booking-agent/`)
**Status:** Active
**Ports:** Configured via env

Automated booking system for hotels and restaurants with email notifications.

- **Stack:** Node.js + Express, Puppeteer, Cheerio, Nodemailer, node-cron, Jest
- **Start:** `npm run dev`

### 6. Location Checker v2 (`locationcheckerv2/`)
**Status:** Active
**Type:** Electron desktop app

Desktop application for batch-verifying business locations using Google Maps, web scraping, and sentiment analysis.

- **Stack:** Electron, Puppeteer, Playwright, Cheerio, Google Maps API, Contentful, Nodemailer
- **Start:** `npm start` (opens Electron window)
- **Build:** `npm run build` (macOS DMG), `npm run build:win`, `npm run build:linux`
- **Features:** CSV batch processing, Google Maps verification, web presence analysis, social media scraping, screenshot capture, caching

### 7. Location Checker v1 (`locationcheckv1/`)
**Status:** Legacy (CLI tool)

Command-line predecessor to v2. Processes CSV files of business locations against the Google Maps API and generates JSON/CSV reports.

- **Stack:** Node.js, Google Maps Places API
- **Run:** `node application-data-and-logs/check-locations.js`
- **Output:** Date-organized reports in `application-data-and-logs/output/`

### 8. Editorial LLM (`prior_editorial_llm/`)
**Status:** Placeholder (empty)

Reserved for future AI-powered editorial content tools.

---

## Port Map

| Port | App |
|------|-----|
| `3000` | Article Uploader frontend |
| `3001` | Article Uploader backend |
| `3002` | Command Center backend |
| `5173` | Command Center frontend |

**Note:** Hotel Price Checker and Article Uploader Stable also default to port `3001`. Don't run them at the same time as the Article Uploader without changing their ports first.

---

## Quick Start

```bash
# Article Uploader (most common)
cd article-uploader
npm run dev
# → Backend: http://localhost:3001  Frontend: http://localhost:3000

# Command Center
cd prior-command-center
./demo.sh
# → Backend: http://localhost:3002  Frontend: http://localhost:5173

# Location Checker (desktop)
cd locationcheckerv2
npm start
```

---

## Environment Setup

Each project has its own `.env` file with API keys. Required keys vary by project:

| Key | Used By |
|-----|---------|
| `CONTENTFUL_SPACE_ID` / `CONTENTFUL_CMA_TOKEN` | Command Center, Article Uploader, Location Checker v2 |
| `ANTHROPIC_API_KEY` | Command Center |
| `GA_PROPERTY_ID` / `GOOGLE_CLIENT_*` / `GOOGLE_REFRESH_TOKEN` | Command Center |
| `INSTAGRAM_ACCESS_TOKEN` / `INSTAGRAM_BUSINESS_ACCOUNT_ID` | Command Center |
| `KLAVIYO_API_KEY` | Command Center |
| `GOOGLE_MAPS_API_KEY` | Location Checker v1 & v2 |

---

## Shared Patterns

- **Backend:** Node.js + Express on all full-stack projects
- **Frontend:** React + Vite on all web UIs
- **CMS:** Contentful (articles, people, categories)
- **Scraping:** Puppeteer and/or Cheerio across multiple projects
- **Config:** `.env` files with `dotenv` for secrets; never committed to git
