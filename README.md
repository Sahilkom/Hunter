# Hunter Memory

**Run this on your PC (recommended):** unzip or clone into `Desktop/Hunter-Memory`, then see [LOCAL-SETUP.md](./LOCAL-SETUP.md).

Open http://127.0.0.1:43217/ after `npm install && npm run dev`.

Job hunting workspace for early-career Software Engineers in India. One polished app with four tools:

1. **Job Finder** — daily refresh of 0–2 YOE SE openings across big tech, banks, strong firms, and startups (Bangalore / Hyderabad / Delhi/NCR). Curated official career URLs + seeded public-style listings. Already-applied roles drop out of the feed.
2. **Resume Tailor** — upload a resume, pick a job, emphasize overlapping skills/bullets without inventing experience. PDF download.
3. **Resume Updater** — freeform update directives (`add skills:`, `add project:`, `add bullet:`, …) applied in the same resume format. PDF download.
4. **Application Tracker** — statuses, notes, optional notify email (stored for future notifications). Status board synced with Job Finder.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43217](http://127.0.0.1:43217).

Production-style:

```bash
npm run build
npm start
```

## Storage

Persists jobs, applications, and the active resume to JSON:

1. **Preferred:** `~/Desktop/Hunter-Memory/store.json` (created automatically when Desktop exists)
2. **Fallback:** `data/store.json` in the repo

Existing repo data is copied to the Desktop folder on first run when the Desktop path is empty.

Deep-link tools with `?tool=finder|tailor|updater|tracker`.

## Limits

- No LinkedIn / Naukri authenticated scraping or ToS-violating scrapers.
- Refresh rotates curated career URLs + demo discovery pool, updates timestamps, and HEAD/GETs official career pages for reachability (no HTML scrape).
- PDF upload uses `pdf-parse`; DOCX/TXT still give the most reliable structure. **Load sample** works offline.
- Notify email is stored for a future notifications pass; inbox scraping waits on credentials.
- Tracker supports CSV export via **Export CSV**.

## Stack

Next.js · TypeScript · Tailwind CSS · shadcn/ui · pdf-lib · mammoth
