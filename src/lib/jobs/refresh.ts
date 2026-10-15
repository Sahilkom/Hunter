import { fetchLiveJobs } from "@/lib/jobs/live";
import { jsearchKey, jsearchQueryKey } from "@/lib/jobs/live/jsearch";
import { isSoftwareRole } from "@/lib/jobs/live/normalize";
import { materializeRefreshJob, REFRESH_POOL } from "@/lib/jobs/seed";
import { checkCareerSources } from "@/lib/jobs/source-check";
import { readStore, updateStore } from "@/lib/storage";
import type { Job, PostedWithin, SourceCheck, StoreData } from "@/lib/types";

const JSEARCH_REUSE_MS = 6 * 60 * 60 * 1000;
const AGGREGATOR_MAX_AGE_MS = 45 * 86_400_000;
const NEW_WINDOW_MS = 48 * 60 * 60 * 1000;
const UNSEEN_GRACE_MS = 3 * 86_400_000;

export type RefreshOptions = {
  query?: string;
  postedWithin?: PostedWithin;
  /** "search" only asks JSearch for the query; "all" also re-reads every company feed. */
  scope?: "all" | "search";
};

export type RefreshResult = {
  store: StoreData;
  added: number;
  removed: number;
  hiddenApplied: number;
  openJobs: Job[];
  sourceChecks: SourceCheck[];
  liveOk: number;
  liveFailed: number;
  jsearch: "used" | "skipped_recent" | "no_key" | "failed";
};

function isLive(job: Job): boolean {
  return job.origin === "live";
}

/**
 * Refresh strategy:
 * - Pulls live India software openings from public company job feeds
 *   (Greenhouse, Lever, Ashby, SmartRecruiters, Workday, Microsoft, Amazon, Google)
 * - Optionally pulls LinkedIn/Naukri/Indeed listings through JSearch when RAPIDAPI_KEY is set
 * - Keeps the curated seed catalog; rotates in seeded listings only when no live feed answers
 * - Drops live listings that disappeared from a feed that answered (the opening closed),
 *   unless the user is tracking them
 * - Never logs in to or scrapes LinkedIn/Naukri directly
 */
let inflightFull: Promise<RefreshResult> | null = null;

export async function refreshJobs(options: RefreshOptions = {}): Promise<RefreshResult> {
  if (options.scope === "search") return runRefresh(options);
  // A full refresh takes a while; overlapping clicks/tabs share the run in progress.
  inflightFull ??= runRefresh(options).finally(() => {
    inflightFull = null;
  });
  return inflightFull;
}

async function runRefresh(options: RefreshOptions): Promise<RefreshResult> {
  const now = new Date().toISOString();
  const before = await readStore();
  const queryKey = jsearchQueryKey(options.query ?? "", options.postedWithin ?? "any");
  const lastCall = before.meta.jsearchCalls?.[queryKey];
  const hasKey = !!jsearchKey();
  const jsearchDue =
    hasKey && (!lastCall || Date.now() - new Date(lastCall).getTime() > JSEARCH_REUSE_MS);

  const searchOnly = options.scope === "search";
  const [sourceChecks, live] = await Promise.all([
    searchOnly ? Promise.resolve(before.meta.lastSourceChecks ?? []) : checkCareerSources(),
    fetchLiveJobs({
      query: options.query,
      postedWithin: options.postedWithin,
      includeJSearch: jsearchDue,
      includeBoards: !searchOnly,
    }),
  ]);
  const reachability = new Map(
    sourceChecks.map((c) => [c.company.toLowerCase(), c.ok] as const),
  );

  let added = 0;
  let removed = 0;

  const store = await updateStore((current) => {
    const tracked = new Set(current.applications.map((a) => a.jobId));
    const appliedIds = new Set(
      current.applications.filter((a) => a.status !== "wishlist").map((a) => a.jobId),
    );
    const existingById = new Map(current.jobs.map((j) => [j.id, j]));
    const fetchedById = new Map(live.jobs.map((j) => [j.id, j]));

    const newcomers: Job[] = [];
    const dayIndex = Math.floor(Date.now() / 86_400_000);
    // Seeded "new" listings are only a fallback for when every live feed is unreachable.
    const rotateSeeds = !searchOnly && live.jobs.length === 0;
    for (let i = 0; i < (rotateSeeds ? 3 : 0); i++) {
      const poolItem = REFRESH_POOL[(dayIndex + i) % REFRESH_POOL.length];
      const candidate = materializeRefreshJob(poolItem, i);
      const duplicate = current.jobs.some(
        (j) =>
          !isLive(j) &&
          j.company === candidate.company &&
          j.title === candidate.title &&
          !appliedIds.has(j.id),
      );
      if (!duplicate) {
        newcomers.push({
          ...candidate,
          discoveredAt: now,
          sourceReachable: reachability.get(candidate.company.toLowerCase()) ?? null,
        });
      }
    }

    for (const job of live.jobs) {
      const previous = existingById.get(job.id);
      if (previous) continue;
      newcomers.push(job);
    }
    added = newcomers.length;

    const kept: Job[] = [];
    for (const job of current.jobs) {
      if (isLive(job)) {
        const fetched = fetchedById.get(job.id);
        if (fetched) {
          // Feeds without a posting date get stamped with the fetch time; keep the first stamp.
          const undated = fetched.postedAt === fetched.discoveredAt;
          const postedAt = undated ? job.postedAt : fetched.postedAt;
          kept.push({
            ...fetched,
            discoveredAt: job.discoveredAt ?? fetched.discoveredAt,
            postedAt,
            isNew: Date.now() - new Date(postedAt).getTime() < NEW_WINDOW_MS,
          });
          continue;
        }
        const fromAggregator = job.id.startsWith("js-");
        // Large feeds are paged and capped, so one missed fetch does not mean the opening closed.
        const closed = fromAggregator
          ? Date.now() - new Date(job.postedAt).getTime() > AGGREGATOR_MAX_AGE_MS
          : live.okCompanies.has(job.company) &&
            Date.now() - new Date(job.refreshedAt).getTime() > UNSEEN_GRACE_MS;
        if ((closed || !isSoftwareRole(job.title)) && !tracked.has(job.id)) {
          removed++;
          continue;
        }
        kept.push(searchOnly ? job : { ...job, isNew: false });
        continue;
      }
      if (searchOnly) {
        kept.push(job);
        continue;
      }
      kept.push({
        ...job,
        origin: "seed",
        refreshedAt: now,
        discoveredAt: job.discoveredAt ?? job.postedAt,
        sourceReachable: reachability.has(job.company.toLowerCase())
          ? reachability.get(job.company.toLowerCase())!
          : (job.sourceReachable ?? null),
        isNew: Date.now() - new Date(job.postedAt).getTime() < NEW_WINDOW_MS,
      });
    }

    current.jobs = [...newcomers, ...kept];
    if (!searchOnly) {
      current.lastRefreshAt = now;
      current.meta.lastSourceChecks = sourceChecks;
      current.meta.liveFetchAt = now;
      current.meta.liveSourceSummary = {
        ok: live.okCompanies.size,
        failed: live.failedCompanies.length,
        failedCompanies: live.failedCompanies,
        jobs: current.jobs.filter(isLive).length,
      };
    }
    if (live.jsearchUsed) {
      current.meta.jsearchCalls = { ...(current.meta.jsearchCalls ?? {}), [queryKey]: now };
    }
  });

  const openJobs = filterOpenJobs(store);
  return {
    store,
    added,
    removed,
    hiddenApplied: store.jobs.length - openJobs.length,
    openJobs,
    sourceChecks,
    liveOk: live.okCompanies.size,
    liveFailed: live.failedCompanies.length,
    jsearch: !hasKey
      ? "no_key"
      : !jsearchDue
        ? "skipped_recent"
        : live.jsearchUsed
          ? "used"
          : "failed",
  };
}

export function filterOpenJobs(store: StoreData): Job[] {
  const hidden = new Set([
    ...store.applications.filter((a) => a.status !== "wishlist").map((a) => a.jobId),
    ...(store.meta.dismissedJobIds ?? []),
  ]);
  return store.jobs.filter((j) => !hidden.has(j.id));
}
