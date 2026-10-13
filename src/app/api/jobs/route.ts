import { NextResponse } from "next/server";
import { applyCareerIdentities } from "@/lib/jobs/career-ids";
import { filterOpenJobs, refreshJobs } from "@/lib/jobs/refresh";
import { readStore, resolveStorageInfo, updateStore } from "@/lib/storage";
import type { Job } from "@/lib/types";

const CAREER_TTL_MS = 6 * 60 * 60 * 1000;

async function jobsWithCareerIds(
  jobs: Job[],
  lookupAt: string | null | undefined,
  force: boolean,
): Promise<Job[]> {
  const age = lookupAt ? Date.now() - new Date(lookupAt).getTime() : Number.POSITIVE_INFINITY;
  if (!force && age < CAREER_TTL_MS) return jobs;
  const enriched = await applyCareerIdentities(jobs);
  if (!enriched.lookedUp) return jobs;
  const saved = await updateStore((current) => {
    const byId = new Map(enriched.jobs.map((job) => [job.id, job]));
    current.jobs = current.jobs.map((job) => byId.get(job.id) ?? job);
    current.meta.careerLookupAt = new Date().toISOString();
  });
  return saved.jobs;
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
      jobs,
      lastRefreshAt: store.lastRefreshAt,
      total: jobs.length,
      sourceChecks: store.meta.lastSourceChecks ?? [],
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

export async function POST() {
  try {
    const result = await refreshJobs();
    const jobsSource = await jobsWithCareerIds(result.store.jobs, null, true);
    const openJobs = filterOpenJobs({ ...result.store, jobs: jobsSource });
    const reachable = result.sourceChecks.filter((c) => c.ok).length;
    const messageBase =
      result.added > 0
        ? `Refresh complete — ${result.added} new listing(s) added from curated career sources.`
        : "Refresh complete — catalog timestamps updated; no net-new titles today.";
    return NextResponse.json({
      ok: true,
      added: result.added,
      hiddenApplied: result.hiddenApplied,
      jobs: openJobs,
      lastRefreshAt: result.store.lastRefreshAt,
      sourceChecks: result.sourceChecks,
      message: `${messageBase} Career pages reachable: ${reachable}/${result.sourceChecks.length}.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Refresh failed" },
      { status: 500 },
    );
  }
}
