import { materializeRefreshJob, REFRESH_POOL } from "@/lib/jobs/seed";
import { checkCareerSources } from "@/lib/jobs/source-check";
import { updateStore } from "@/lib/storage";
import type { Job, SourceCheck, StoreData } from "@/lib/types";

/**
 * Daily refresh strategy (ToS-safe):
 * - Keeps curated official career URLs as apply destinations
 * - Updates refreshedAt timestamps on the catalog
 * - Rotates in a few "newly discovered" seeded listings from a public-style pool
 * - HEAD/GET reachability checks on official career URLs (no HTML scrape)
 * - Hides jobs the user already marked as applied (and beyond) from the finder feed
 * - Does NOT scrape LinkedIn/Naukri behind auth or bypass rate limits
 */
export async function refreshJobs(): Promise<{
  store: StoreData;
  added: number;
  hiddenApplied: number;
  openJobs: Job[];
  sourceChecks: SourceCheck[];
}> {
  const now = new Date().toISOString();
  let added = 0;
  const sourceChecks = await checkCareerSources();
  const reachability = new Map(
    sourceChecks.map((c) => [c.company.toLowerCase(), c.ok] as const),
  );

  const store = await updateStore((current) => {
    const appliedIds = new Set(
      current.applications
        .filter((a) => a.status !== "wishlist")
        .map((a) => a.jobId),
    );

    const existingIds = new Set(current.jobs.map((j) => j.id));
    const dayIndex = Math.floor(Date.now() / 86_400_000);
    const pickCount = 3;
    const newcomers: Job[] = [];

    for (let i = 0; i < pickCount; i++) {
      const poolItem = REFRESH_POOL[(dayIndex + i + newcomers.length) % REFRESH_POOL.length];
      const candidate = materializeRefreshJob(poolItem, i);
      const duplicate = current.jobs.some(
        (j) =>
          j.company === candidate.company &&
          j.title === candidate.title &&
          !appliedIds.has(j.id),
      );
      if (!duplicate && !existingIds.has(candidate.id)) {
        newcomers.push({
          ...candidate,
          sourceReachable: reachability.get(candidate.company.toLowerCase()) ?? null,
        });
        existingIds.add(candidate.id);
      }
    }

    added = newcomers.length;

    const updatedJobs = [
      ...newcomers,
      ...current.jobs.map((j) => ({
        ...j,
        refreshedAt: now,
        sourceReachable: reachability.has(j.company.toLowerCase())
          ? reachability.get(j.company.toLowerCase())!
          : (j.sourceReachable ?? null),
        isNew: newcomers.some((n) => n.id === j.id)
          ? true
          : Date.now() - new Date(j.postedAt).getTime() < 1000 * 60 * 60 * 48,
      })),
    ];

    current.jobs = updatedJobs;
    current.lastRefreshAt = now;
    current.meta.lastSourceChecks = sourceChecks;
  });

  const appliedIds = new Set(
    store.applications
      .filter((a) => a.status !== "wishlist")
      .map((a) => a.jobId),
  );
  const openJobs = store.jobs.filter((j) => !appliedIds.has(j.id));

  return {
    store,
    added,
    hiddenApplied: store.jobs.length - openJobs.length,
    openJobs,
    sourceChecks,
  };
}

export function filterOpenJobs(store: StoreData): Job[] {
  const appliedIds = new Set(
    store.applications
      .filter((a) => a.status !== "wishlist")
      .map((a) => a.jobId),
  );
  return store.jobs.filter((j) => !appliedIds.has(j.id));
}
