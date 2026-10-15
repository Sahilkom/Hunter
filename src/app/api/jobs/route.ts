import { NextResponse } from "next/server";
import { applyCareerIdentities } from "@/lib/jobs/career-ids";
import { jsearchKey } from "@/lib/jobs/live/jsearch";
import { filterOpenJobs, refreshJobs } from "@/lib/jobs/refresh";
import { readStore, resolveStorageInfo, updateStore } from "@/lib/storage";
import {
  DEFAULT_JOB_FILTERS,
  type Job,
  type JobFilters,
  type PostedWithin,
  type StoreData,
} from "@/lib/types";

const CAREER_TTL_MS = 6 * 60 * 60 * 1000;
const LIVE_STALE_MS = 12 * 60 * 60 * 1000;
const POSTED_WITHIN: PostedWithin[] = ["any", "1", "3", "7", "14", "30"];

async function jobsWithCareerIds(
  jobs: Job[],
  lookupAt: string | null | undefined,
  force: boolean,
): Promise<Job[]> {
  const age = lookupAt ? Date.now() - new Date(lookupAt).getTime() : Number.POSITIVE_INFINITY;
  if (!force && age < CAREER_TTL_MS) return jobs;
  // Live listings already carry their own requisition id and direct link.
  const curated = jobs.filter((job) => job.origin !== "live");
  const enriched = await applyCareerIdentities(curated);
  if (!enriched.lookedUp) return jobs;
  const saved = await updateStore((current) => {
    const byId = new Map(enriched.jobs.map((job) => [job.id, job]));
    current.jobs = current.jobs.map((job) => byId.get(job.id) ?? job);
    current.meta.careerLookupAt = new Date().toISOString();
  });
  return saved.jobs;
}

function sanitizeFilters(input: Partial<JobFilters> | undefined): JobFilters {
  const merged = { ...DEFAULT_JOB_FILTERS, ...(input ?? {}) };
  return {
    query: String(merged.query ?? "").slice(0, 120),
    company: String(merged.company ?? "all"),
    city: String(merged.city ?? "all"),
    tier: String(merged.tier ?? "all"),
    postedWithin: POSTED_WITHIN.includes(merged.postedWithin) ? merged.postedWithin : "any",
    experience: (["any", "0-1", "1-3", "3-5", "5-8", "8+"] as const).includes(merged.experience)
      ? merged.experience
      : "any",
    includeUnknownYoe: merged.includeUnknownYoe !== false,
    source: (["all", "career_page", "linkedin_public", "naukri_public", "google_jobs", "seed"] as const).includes(
      merged.source,
    )
      ? merged.source
      : "all",
    sort: (["recent", "posted", "company"] as const).includes(merged.sort) ? merged.sort : "recent",
  };
}

function payload(store: StoreData, jobs: Job[]) {
  const liveFetchAt = store.meta.liveFetchAt ?? null;
  return {
    jobs,
    lastRefreshAt: store.lastRefreshAt,
    total: jobs.length,
    sourceChecks: store.meta.lastSourceChecks ?? [],
    dismissedCount: (store.meta.dismissedJobIds ?? []).length,
    savedFilters: sanitizeFilters(store.meta.savedFilters),
    liveFetchAt,
    liveStale: !liveFetchAt || Date.now() - new Date(liveFetchAt).getTime() > LIVE_STALE_MS,
    liveSourceSummary: store.meta.liveSourceSummary ?? null,
    jsearchConfigured: !!jsearchKey(),
  };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeApplied = searchParams.get("includeApplied") === "1";
    const store = await readStore();
    const storage = await resolveStorageInfo();
    const jobsSource = await jobsWithCareerIds(store.jobs, store.meta.careerLookupAt, false);
    const jobs = includeApplied ? jobsSource : filterOpenJobs({ ...store, jobs: jobsSource });
    return NextResponse.json({
      ...payload(store, jobs),
      storage: {
        label: storage.label,
        kind: storage.kind,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load jobs" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      query?: string;
      postedWithin?: PostedWithin;
      scope?: "all" | "search";
    };
    const postedWithin =
      body.postedWithin && POSTED_WITHIN.includes(body.postedWithin) ? body.postedWithin : "any";
    const scope = body.scope === "search" ? "search" : "all";
    const result = await refreshJobs({ query: body.query?.slice(0, 120), postedWithin, scope });
    const jobsSource =
      scope === "all"
        ? await jobsWithCareerIds(result.store.jobs, null, true)
        : result.store.jobs;
    const store = { ...result.store, jobs: jobsSource };
    const openJobs = filterOpenJobs(store);
    const reachable = result.sourceChecks.filter((c) => c.ok).length;
    const parts = scope === "search" ? [
      result.jsearch === "used"
        ? `Search complete: ${result.added} new LinkedIn/Naukri listing(s) added for "${body.query || "software engineer"}".`
        : result.jsearch === "skipped_recent"
          ? "Showing saved results (this search already ran in the last 6h)."
          : result.jsearch === "failed"
            ? "LinkedIn/Naukri search (JSearch) failed; check RAPIDAPI_KEY or quota. Filtering saved jobs."
            : "Filtering saved jobs. Add RAPIDAPI_KEY to also search LinkedIn/Naukri.",
    ] : [
      result.added > 0
        ? `Refresh complete: ${result.added} new listing(s) added.`
        : "Refresh complete: no new listings since last time.",
      result.removed > 0 ? `${result.removed} closed listing(s) removed.` : "",
      `Live company feeds answered: ${result.liveOk}/${result.liveOk + result.liveFailed}.`,
      result.jsearch === "used"
        ? "LinkedIn/Naukri listings pulled via JSearch."
        : result.jsearch === "skipped_recent"
          ? "LinkedIn/Naukri search reused (same search ran in the last 6h)."
          : result.jsearch === "failed"
            ? "LinkedIn/Naukri search (JSearch) failed; check RAPIDAPI_KEY or quota."
            : "",
      `Career pages reachable: ${reachable}/${result.sourceChecks.length}.`,
    ].filter(Boolean);
    return NextResponse.json({
      ok: true,
      added: result.added,
      removed: result.removed,
      hiddenApplied: result.hiddenApplied,
      jsearch: result.jsearch,
      ...payload(store, openJobs),
      message: parts.join(" "),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Refresh failed" },
      { status: 500 },
    );
  }
}

/** Hide/restore jobs in the finder and persist the user's filters. */
export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      dismiss?: string;
      restore?: string;
      restoreAll?: boolean;
      filters?: Partial<JobFilters>;
    };
    const store = await updateStore((current) => {
      const dismissed = new Set(current.meta.dismissedJobIds ?? []);
      if (body.dismiss) dismissed.add(body.dismiss);
      if (body.restore) dismissed.delete(body.restore);
      if (body.restoreAll) dismissed.clear();
      current.meta.dismissedJobIds = [...dismissed];
      if (body.filters) current.meta.savedFilters = sanitizeFilters(body.filters);
    });
    const restoredJobs =
      body.restore || body.restoreAll ? filterOpenJobs(store) : undefined;
    return NextResponse.json({
      ok: true,
      dismissedCount: (store.meta.dismissedJobIds ?? []).length,
      savedFilters: sanitizeFilters(store.meta.savedFilters),
      jobs: restoredJobs,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update jobs" },
      { status: 500 },
    );
  }
}
