import type { Job } from "@/lib/types";

type Opening = {
  careerJobId: string;
  title: string;
  location: string;
  applyUrl: string;
};

type CareerHit = {
  careerJobId: string;
  careerTitle: string;
  applyUrl: string;
};

const MATCH_THRESHOLD = 80;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

async function fetchText(url: string, timeoutMs = 12000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

const FILLER = new Set([
  "early",
  "career",
  "associate",
  "graduate",
  "new",
  "college",
  "fresher",
  "freshers",
  "junior",
  "entry",
  "level",
  "the",
  "and",
  "for",
  "with",
  "of",
  "in",
  "to",
]);

const CONFLICT = new Set([
  "phd",
  "manager",
  "staff",
  "principal",
  "director",
  "senior",
  "lead",
  "architect",
  "intern",
  "internship",
  "ii",
  "iii",
  "iv",
]);

const HARMLESS = new Set([
  "india",
  "bangalore",
  "bengaluru",
  "hyderabad",
  "karnataka",
  "telangana",
  "delhi",
  "noida",
  "gurgaon",
  "gurugram",
  "pune",
  "chennai",
  "mumbai",
  "remote",
  "hybrid",
  "onsite",
  "technology",
  "engineering",
]);

const SPECIALTY = new Set([
  "backend",
  "frontend",
  "fullstack",
  "mobile",
  "security",
  "cloud",
  "data",
  "platform",
  "android",
  "ios",
]);

function canonical(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bsde\b/g, "software development engineer")
    .replace(/\bswe\b/g, "software engineer")
    .replace(/\bfull stack\b/g, "fullstack")
    .replace(/\bfront end\b/g, "frontend")
    .replace(/\bback end\b/g, "backend")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningful(value: string): string[] {
  return canonical(value)
    .split(" ")
    .filter((token) => token.length > 1 && !FILLER.has(token));
}

function cityMatches(job: Job, location: string): boolean {
  const loc = location.toLowerCase();
  if (job.city === "Bangalore") return /bangalore|bengaluru/.test(loc);
  if (job.city === "Hyderabad") return /hyderabad/.test(loc);
  if (job.city === "Delhi/NCR") return /delhi|noida|gurgaon|gurugram|ncr/.test(loc);
  if (job.city === "Remote-India") return /remote/.test(loc);
  return /india/.test(loc);
}

function scoreOpening(job: Job, opening: Opening): number {
  const internOpening = /\bintern\b/.test(canonical(opening.title));
  if (job.employmentType === "Internship" && !internOpening) return 0;
  if (job.employmentType !== "Internship" && internOpening) return 0;

  const catalogTokens = meaningful(job.title);
  const openingTokens = meaningful(opening.title);
  if (!catalogTokens.length || !openingTokens.length) return 0;

  const catalogSet = new Set(catalogTokens);
  if (openingTokens.some((token) => CONFLICT.has(token) && !catalogSet.has(token))) return 0;
  if (catalogTokens.some((token) => CONFLICT.has(token) && !openingTokens.includes(token))) return 0;

  const openingSet = new Set(openingTokens);
  if (catalogTokens.some((token) => SPECIALTY.has(token) && !openingSet.has(token))) return 0;
  if (openingTokens.some((token) => SPECIALTY.has(token) && !catalogSet.has(token))) return 0;

  const covered = catalogTokens.filter((token) => openingSet.has(token)).length;
  if (covered !== catalogTokens.length) return 0;

  const extras = openingTokens.filter((token) => !catalogSet.has(token));
  if (extras.some((token) => !HARMLESS.has(token))) return 0;
  return 100 - Math.min(extras.length, 12) + (cityMatches(job, opening.location) ? 5 : 0);
}

function dedupe(openings: Opening[]): Opening[] {
  const seen = new Set<string>();
  const result: Opening[] = [];
  for (const opening of openings) {
    if (!opening.careerJobId || !opening.title || seen.has(opening.careerJobId)) continue;
    seen.add(opening.careerJobId);
    result.push(opening);
  }
  return result;
}

function assign(jobs: Job[], openings: Opening[]): Map<string, CareerHit> {
  const pairs: { jobId: string; opening: Opening; score: number }[] = [];
  for (const job of jobs) {
    for (const opening of openings) {
      const score = scoreOpening(job, opening);
      if (score >= MATCH_THRESHOLD) pairs.push({ jobId: job.id, opening, score });
    }
  }
  pairs.sort((a, b) => b.score - a.score);
  const usedJobs = new Set<string>();
  const usedIds = new Set<string>();
  const result = new Map<string, CareerHit>();
  for (const pair of pairs) {
    if (usedJobs.has(pair.jobId) || usedIds.has(pair.opening.careerJobId)) continue;
    usedJobs.add(pair.jobId);
    usedIds.add(pair.opening.careerJobId);
    result.set(pair.jobId, {
      careerJobId: pair.opening.careerJobId,
      careerTitle: pair.opening.title,
      applyUrl: pair.opening.applyUrl,
    });
  }
  return result;
}

function capQueries(queries: string[]): string[] {
  const unique: string[] = [];
  for (const query of queries) {
    const trimmed = query.trim();
    if (!trimmed) continue;
    if (unique.some((item) => item.toLowerCase() === trimmed.toLowerCase())) continue;
    unique.push(trimmed);
    if (unique.length >= 4) break;
  }
  return unique.length ? unique : ["software engineer"];
}

function parseGoogle(html: string): Opening[] {
  const openings: Opening[] = [];
  const re =
    /href="jobs\/results\/(\d+)[^"]*"\s+aria-label="Learn more about ([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const careerJobId = match[1];
    const title = decodeEntities(match[2]).trim();
    if (!title) continue;
    openings.push({
      careerJobId,
      title,
      location: "India",
      applyUrl: `https://www.google.com/about/careers/applications/jobs/results/${careerJobId}`,
    });
  }
  return openings;
}

export async function fetchGoogleOpenings(queries: string[]): Promise<Opening[] | null> {
  return fetchGoogle(queries);
}

async function fetchGoogle(queries: string[]): Promise<Opening[] | null> {
  const pages = await Promise.all(
    capQueries(queries).flatMap((query) =>
      [1, 2].map((page) =>
        fetchText(
          `https://www.google.com/about/careers/applications/jobs/results/?q=${encodeURIComponent(query)}&location=India&page=${page}`,
        ),
      ),
    ),
  );
  if (pages.every((page) => !page)) return null;
  return dedupe(pages.flatMap((page) => (page ? parseGoogle(page) : [])));
}

async function fetchMicrosoft(queries: string[]): Promise<Opening[] | null> {
  const pages = await Promise.all(
    capQueries(queries).map((query) =>
      fetchText(
        `https://apply.careers.microsoft.com/api/pcsx/search?domain=microsoft.com&query=${encodeURIComponent(query)}&location=India&start=0&num=40`,
      ),
    ),
  );
  if (pages.every((page) => !page?.trim().startsWith("{"))) return null;
  const openings: Opening[] = [];
  for (const page of pages) {
    if (!page?.trim().startsWith("{")) continue;
    try {
      const data = JSON.parse(page) as {
        data?: {
          positions?: {
            id?: number | string;
            displayJobId?: string;
            atsJobId?: string;
            name?: string;
            locations?: string[];
          }[];
        };
      };
      for (const position of data.data?.positions ?? []) {
        const careerJobId = String(position.displayJobId || position.atsJobId || "").trim();
        const title = position.name?.trim() ?? "";
        if (!careerJobId || !title) continue;
        openings.push({
          careerJobId,
          title,
          location: (position.locations ?? []).join(", "),
          applyUrl: position.id
            ? `https://jobs.careers.microsoft.com/global/en/job/${position.id}`
            : "https://jobs.careers.microsoft.com/global/en/search",
        });
      }
    } catch {
      // ignore a malformed page
    }
  }
  return dedupe(openings);
}

async function fetchAmazon(queries: string[]): Promise<Opening[] | null> {
  const pages = await Promise.all(
    capQueries(queries).map((query) =>
      fetchText(
        `https://www.amazon.jobs/en/search.json?base_query=${encodeURIComponent(query)}&country=IND&result_limit=40&sort=recent`,
      ),
    ),
  );
  if (pages.every((page) => !page?.trim().startsWith("{"))) return null;
  const openings: Opening[] = [];
  for (const page of pages) {
    if (!page?.trim().startsWith("{")) continue;
    try {
      const data = JSON.parse(page) as {
        jobs?: {
          id_icims?: string;
          title?: string;
          country_code?: string;
          normalized_location?: string;
          location?: string;
          job_path?: string;
        }[];
      };
      for (const job of data.jobs ?? []) {
        const careerJobId = String(job.id_icims || "").trim();
        const title = job.title?.trim() ?? "";
        const location = job.normalized_location || job.location || "";
        if (!careerJobId || !title) continue;
        if (job.country_code && job.country_code !== "IND" && !/india/i.test(location)) continue;
        openings.push({
          careerJobId,
          title,
          location,
          applyUrl: job.job_path
            ? `https://www.amazon.jobs${job.job_path}`
            : `https://www.amazon.jobs/en/jobs/${careerJobId}`,
        });
      }
    } catch {
      // ignore a malformed page
    }
  }
  return dedupe(openings);
}

async function fetchSmartRecruiters(companyId: string, queries: string[]): Promise<Opening[] | null> {
  const pages = await Promise.all(
    capQueries(queries).map((query) =>
      fetchText(
        `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(companyId)}/postings?q=${encodeURIComponent(query)}&limit=100`,
      ),
    ),
  );
  if (pages.every((page) => !page?.trim().startsWith("{"))) return null;
  const openings: Opening[] = [];
  for (const page of pages) {
    if (!page?.trim().startsWith("{")) continue;
    try {
      const data = JSON.parse(page) as {
        content?: {
          id?: string;
          name?: string;
          refNumber?: string;
          location?: { city?: string; fullLocation?: string };
        }[];
      };
      for (const posting of data.content ?? []) {
        const careerJobId = String(posting.refNumber || posting.id || "").trim();
        const title = posting.name?.trim() ?? "";
        if (!careerJobId || !title || !posting.id) continue;
        openings.push({
          careerJobId,
          title,
          location: posting.location?.fullLocation || posting.location?.city || "",
          applyUrl: `https://jobs.smartrecruiters.com/${encodeURIComponent(companyId)}/${posting.id}`,
        });
      }
    } catch {
      // ignore a malformed page
    }
  }
  return dedupe(openings);
}

function fetchBoardOnce(
  load: () => Promise<Opening[] | null>,
): (queries: string[]) => Promise<Opening[] | null> {
  let pending: Promise<Opening[] | null> | null = null;
  return () => {
    pending ??= load();
    return pending;
  };
}

async function fetchGreenhouse(board: string): Promise<Opening[] | null> {
  const page = await fetchText(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs`);
  if (!page?.trim().startsWith("{")) return null;
  try {
    const data = JSON.parse(page) as {
      jobs?: { id?: number; title?: string; absolute_url?: string; location?: { name?: string } }[];
    };
    return dedupe(
      (data.jobs ?? []).flatMap((job) => {
        const careerJobId = job.id ? String(job.id) : "";
        const title = job.title?.trim() ?? "";
        if (!careerJobId || !title) return [];
        return [
          {
            careerJobId,
            title,
            location: job.location?.name ?? "",
            applyUrl: job.absolute_url || `https://job-boards.greenhouse.io/${board}/jobs/${careerJobId}`,
          },
        ];
      }),
    );
  } catch {
    return null;
  }
}

async function fetchLever(board: string): Promise<Opening[] | null> {
  const page = await fetchText(`https://api.lever.co/v0/postings/${board}?mode=json`);
  if (!page?.trim().startsWith("[")) return null;
  try {
    const data = JSON.parse(page) as {
      id?: string;
      text?: string;
      hostedUrl?: string;
      categories?: { location?: string };
    }[];
    return dedupe(
      data.flatMap((job) => {
        const careerJobId = job.id?.trim() ?? "";
        const title = job.text?.trim() ?? "";
        if (!careerJobId || !title) return [];
        return [
          {
            careerJobId,
            title,
            location: job.categories?.location ?? "",
            applyUrl: job.hostedUrl || `https://jobs.lever.co/${board}/${careerJobId}`,
          },
        ];
      }),
    );
  } catch {
    return null;
  }
}

const FETCHERS: Record<string, (queries: string[]) => Promise<Opening[] | null>> = {
  Google: fetchGoogle,
  Microsoft: fetchMicrosoft,
  Amazon: fetchAmazon,
  Swiggy: (queries) => fetchSmartRecruiters("Swiggy", queries),
  Freshworks: (queries) => fetchSmartRecruiters("Freshworks", queries),
  Groww: fetchBoardOnce(() => fetchGreenhouse("groww")),
  Cred: fetchBoardOnce(() => fetchLever("cred")),
};

/**
 * Attach the requisition id and exact title published on each company's
 * public career listing. Internal catalog ids are left untouched.
 * A company whose feed fails is left unchanged.
 */
export async function applyCareerIdentities(jobs: Job[]): Promise<{ jobs: Job[]; lookedUp: boolean }> {
  const byCompany = new Map<string, Job[]>();
  for (const job of jobs) {
    const list = byCompany.get(job.company) ?? [];
    list.push(job);
    byCompany.set(job.company, list);
  }

  const updates = new Map<string, CareerHit | null>();
  let lookedUp = false;

  await Promise.all(
    [...byCompany.entries()].map(async ([company, companyJobs]) => {
      const fetcher = FETCHERS[company];
      if (!fetcher) return;
      const primary = await fetcher(["software engineer"]);
      if (!primary) return;
      lookedUp = true;
      let openings = primary;
      const preliminary = assign(companyJobs, openings);
      const unmatched = companyJobs.filter((job) => !preliminary.has(job.id));
      if (unmatched.length) {
        const extra = await fetcher(unmatched.map((job) => job.title));
        if (extra) openings = dedupe([...openings, ...extra]);
      }
      const assigned = assign(companyJobs, openings);
      for (const job of companyJobs) {
        updates.set(job.id, assigned.get(job.id) ?? null);
      }
    }),
  );

  return {
    lookedUp,
    jobs: jobs.map((job) => {
      if (!updates.has(job.id)) return job;
      const hit = updates.get(job.id);
      if (!hit) {
        return { ...job, careerJobId: null, careerTitle: null, directLink: false };
      }
      return {
        ...job,
        careerJobId: hit.careerJobId,
        careerTitle: hit.careerTitle,
        applyUrl: hit.applyUrl || job.applyUrl,
        directLink: !!hit.applyUrl,
      };
    }),
  };
}
