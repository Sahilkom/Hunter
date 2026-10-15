# Hunter Memory

**Run this on your PC (recommended):** unzip or clone into `Desktop/Hunter-Memory`, then see [LOCAL-SETUP.md](./LOCAL-SETUP.md).

Open http://127.0.0.1:43217/ after `npm install && npm run dev`.

Job hunting workspace for early-career Software Engineers in India. One polished app with four tools:

1. **Job Finder** — live software engineering openings across India (any YOE) from the public job feeds of ~100 big tech companies, banks, MNCs and startups, plus LinkedIn / Naukri / Indeed listings through JSearch when `RAPIDAPI_KEY` is set, merged with the curated list. Filters for company, years of experience, date posted, city, tier and source, plus keyword search; filters are saved. Newly discovered jobs sort to the top, **View job** opens the exact posting, and applied or removed jobs drop out of the feed.
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

Persists jobs, applications, the active resume, removed jobs and saved filters to JSON:

1. **Google Drive (recommended on Render):** click the **Storage** card, paste a Drive folder link and **Connect Google Drive**. Data is saved as `hunter-memory-store.json` in that folder. If the folder is empty, the current data is copied there.
2. **Local file:** `~/Desktop/Hunter-Memory/store.json` (created automatically when Desktop exists), else `data/store.json` in the repo, or `$DATA_DIR/store.json` when `DATA_DIR` is set.

Render's free plan wipes the local disk on every deploy/restart, so use Google Drive there.

### One-time Google Drive setup

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the **Google Drive API**.
2. **OAuth consent screen:** User type *External*, add your Gmail as a test user, then click **Publish app** (In production). While the app stays in *Testing*, Google expires the sign-in after 7 days. Google shows an "unverified app" warning for personal apps; continue past it.
3. **Credentials → Create OAuth client ID → Web application.** Add the authorized redirect URI `https://<your-app>.onrender.com/api/drive/callback` (and `http://127.0.0.1:43217/api/drive/callback` for local use).
4. In Render → Environment, set:
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` from step 3
   - `SESSION_SECRET` — any long random string (encrypts the Drive sign-in stored in your browser cookie; changing it signs you out of Drive)
   - optional `APP_URL` if you use a custom domain (Render's `RENDER_EXTERNAL_URL` is used otherwise)
5. Redeploy, open the app, click **Storage**, paste the folder link (`https://drive.google.com/drive/folders/…`) and connect.

The connection is remembered per browser. On another device, connect the same folder to see the same data. To pin a folder for every browser instead, set `GOOGLE_DRIVE_REFRESH_TOKEN` and `GOOGLE_DRIVE_FOLDER_ID`.

Deep-link tools with `?tool=finder|tailor|updater|tracker`.

## Job sources

- **Company job feeds (no key needed):** public Greenhouse, Lever, Ashby, SmartRecruiters and Workday boards plus Google, Microsoft and Amazon careers search, filtered to software roles in India. The list lives in `src/lib/jobs/live/companies.ts`; a company whose feed fails is skipped for that refresh. A full refresh takes about a minute.
- **LinkedIn / Naukri / Indeed (optional):** set `RAPIDAPI_KEY` from [JSearch on RapidAPI](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch). Each refresh or **Search** makes one call per distinct query, reused for 6 hours to stay inside the free quota.
- **Curated list:** the original hand-picked roles stay; their button reads **Career page** unless a matching posting was found on the company feed.
- Listings that disappear from a company feed for 3 days are treated as closed and removed (unless you are tracking them).

## Limits

- No LinkedIn / Naukri authenticated scraping or ToS-violating scrapers; LinkedIn/Naukri listings come only through JSearch.
- Many Indian companies (Flipkart, Zomato, Razorpay, TCS, Infosys, etc.) run careers on custom sites without a public job feed; their openings appear only through JSearch or the curated list.
- PDF upload uses `pdf-parse`; DOCX/TXT still give the most reliable structure. **Load sample** works offline.
- Notify email is stored for a future notifications pass; inbox scraping waits on credentials.
- Tracker supports CSV export via **Export CSV**.

## Stack

Next.js · TypeScript · Tailwind CSS · shadcn/ui · pdf-lib · mammoth
