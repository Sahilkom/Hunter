"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Briefcase,
  CheckCircle2,
  ExternalLink,
  EyeOff,
  Filter,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_JOB_FILTERS,
  type ExperienceBucket,
  type Job,
  type JobFilters,
  type JobSort,
  type PostedWithin,
  type SourceFilter,
} from "@/lib/types";
import { companyTierLabel, formatRelative } from "@/lib/format";
import { applyJobFilters, experienceLabel } from "@/lib/jobs/filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Props = {
  onMarkedApplied?: () => void;
  onRefreshed?: () => void;
};

const PAGE_SIZE = 40;

const CITY_LABELS: Record<string, string> = {
  all: "All cities",
  Bangalore: "Bangalore",
  Hyderabad: "Hyderabad",
  "Delhi/NCR": "Delhi/NCR",
  Pune: "Pune",
  Chennai: "Chennai",
  Mumbai: "Mumbai",
  "Remote-India": "Remote (India)",
  "Multiple-India": "Multiple cities",
  "Other-India": "Other (India)",
};

const TIER_LABELS: Record<string, string> = {
  all: "All tiers",
  big_tech: "Big Tech",
  bank: "Banks / Fintech MNCs",
  strong_firm: "Strong firms / MNCs",
  startup: "Startups",
  other: "Other companies",
};

const POSTED_LABELS: Record<PostedWithin, string> = {
  any: "Any time",
  "1": "Last 24 hours",
  "3": "Last 3 days",
  "7": "Last 7 days",
  "14": "Last 14 days",
  "30": "Last 30 days",
};

const EXPERIENCE_LABELS: Record<ExperienceBucket, string> = {
  any: "Any experience",
  "0-1": "0–1 years (fresher)",
  "1-3": "1–3 years",
  "3-5": "3–5 years",
  "5-8": "5–8 years",
  "8+": "8+ years",
};

const SOURCE_LABELS: Record<SourceFilter, string> = {
  all: "All sources",
  career_page: "Company career sites",
  linkedin_public: "LinkedIn",
  naukri_public: "Naukri",
  google_jobs: "Other job boards",
  seed: "Curated list",
};

const SORT_LABELS: Record<JobSort, string> = {
  recent: "Recently added first",
  posted: "Newest posting first",
  company: "Company A–Z",
};

function FilterSelect<T extends string>({
  label,
  value,
  labels,
  onChange,
  options,
}: {
  label: string;
  value: T;
  labels: Record<string, string>;
  onChange: (value: T) => void;
  options?: { value: string; label: string }[];
}) {
  const items = options ?? Object.entries(labels).map(([v, l]) => ({ value: v, label: l }));
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">{label}</label>
      <Select value={value} onValueChange={(next) => onChange((next ?? items[0].value) as T)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={label}>
            {(v) => items.find((item) => item.value === String(v))?.label ?? label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function JobFinder({ onMarkedApplied, onRefreshed }: Props) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<"all" | "search" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_JOB_FILTERS);
  const [draftQuery, setDraftQuery] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [dismissedCount, setDismissedCount] = useState(0);
  const [sourceSummary, setSourceSummary] = useState<string | null>(null);
  const [jsearchConfigured, setJsearchConfigured] = useState(false);
  const filtersLoaded = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRefreshedRef = useRef(onRefreshed);
  useEffect(() => {
    onRefreshedRef.current = onRefreshed;
  }, [onRefreshed]);

  const applyPayload = useCallback(
    (data: {
      jobs: Job[];
      lastRefreshAt: string | null;
      dismissedCount?: number;
      jsearchConfigured?: boolean;
      liveSourceSummary?: { ok: number; failed: number; jobs: number } | null;
      sourceChecks?: { ok: boolean }[];
    }) => {
      setJobs(data.jobs);
      setLastRefreshAt(data.lastRefreshAt);
      if (typeof data.dismissedCount === "number") setDismissedCount(data.dismissedCount);
      if (typeof data.jsearchConfigured === "boolean") setJsearchConfigured(data.jsearchConfigured);
      const parts: string[] = [];
      if (data.liveSourceSummary) {
        const s = data.liveSourceSummary;
        parts.push(`${s.jobs} live openings from ${s.ok}/${s.ok + s.failed} company feeds`);
      }
      if (Array.isArray(data.sourceChecks) && data.sourceChecks.length) {
        const ok = data.sourceChecks.filter((c) => c.ok).length;
        parts.push(`career pages ${ok}/${data.sourceChecks.length} reachable`);
      }
      setSourceSummary(parts.length ? parts.join(" · ") : null);
    },
    [],
  );

  const runRefresh = useCallback(
    async (scope: "all" | "search", current: JobFilters, quiet = false) => {
      setRefreshing(scope);
      setError(null);
      try {
        const res = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope, query: current.query, postedWithin: current.postedWithin }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Refresh failed");
        applyPayload(data);
        if (!quiet || data.added > 0) toast.success(data.message);
        onRefreshedRef.current?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Refresh failed";
        setError(message);
        toast.error(message);
      } finally {
        setRefreshing(null);
      }
    },
    [applyPayload],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load jobs");
      applyPayload(data);
      const saved: JobFilters = { ...DEFAULT_JOB_FILTERS, ...(data.savedFilters ?? {}) };
      setFilters(saved);
      setDraftQuery(saved.query);
      filtersLoaded.current = true;
      if (data.liveStale) void runRefresh("all", saved, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, [applyPayload, runRefresh]);

  useEffect(() => {
    void load();
  }, [load]);

  const persistFilters = useCallback((next: JobFilters, immediate = false) => {
    if (!filtersLoaded.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const save = () =>
      void fetch("/api/jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters: next }),
      }).catch(() => undefined);
    if (immediate) save();
    else saveTimer.current = setTimeout(save, 1200);
  }, []);

  const updateFilters = (patch: Partial<JobFilters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    persistFilters(next);
    setVisible(PAGE_SIZE);
  };

  const submitSearch = () => {
    const next = { ...filters, query: draftQuery.trim() };
    setFilters(next);
    setVisible(PAGE_SIZE);
    persistFilters(next, true);
    void runRefresh("search", next);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_JOB_FILTERS);
    setDraftQuery("");
    setVisible(PAGE_SIZE);
    persistFilters(DEFAULT_JOB_FILTERS, true);
  };

  const markApplied = async (jobId: string) => {
    setMarkingId(jobId);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, status: "applied" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not mark applied");
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      toast.success("Marked applied — moved to Application Tracker");
      onMarkedApplied?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not mark applied");
    } finally {
      setMarkingId(null);
    }
  };

  const restore = async (jobId?: string) => {
    try {
      const res = await fetch("/api/jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jobId ? { restore: jobId } : { restoreAll: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not restore");
      if (Array.isArray(data.jobs)) setJobs(data.jobs);
      setDismissedCount(data.dismissedCount ?? 0);
      toast.success(jobId ? "Job restored" : "All removed jobs restored");
      onRefreshed?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not restore");
    }
  };

  const dismiss = async (job: Job) => {
    setDismissingId(job.id);
    try {
      const res = await fetch("/api/jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismiss: job.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not remove job");
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
      setDismissedCount(data.dismissedCount ?? 0);
      toast.success(`Removed ${job.company} — ${job.title}`, {
        action: { label: "Undo", onClick: () => void restore(job.id) },
      });
      onRefreshed?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove job");
    } finally {
      setDismissingId(null);
    }
  };

  const companies = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of jobs) counts.set(job.company, (counts.get(job.company) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [jobs]);

  const filtered = useMemo(() => applyJobFilters(jobs, filters), [jobs, filters]);
  const shown = filtered.slice(0, visible);
  const filtersActive =
    JSON.stringify({ ...filters, query: filters.query.trim() }) !== JSON.stringify(DEFAULT_JOB_FILTERS);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--teal)]">Job Finder</p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--ink)]">
            Software roles across India, refreshed live
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)]">
            Live software engineering openings from the public job feeds of ~100 big tech
            companies, banks, MNCs and startups
            {jsearchConfigured ? ", plus LinkedIn / Naukri / Indeed listings via JSearch" : ""}, merged with
            the curated list. &ldquo;View job&rdquo; opens the exact posting. Applied and removed
            jobs drop out of this feed.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-1 sm:items-end">
          <span className="text-xs text-[var(--muted-foreground)]">
            Last refresh {formatRelative(lastRefreshAt)}
          </span>
          {sourceSummary && (
            <span className="text-xs text-[var(--muted-foreground)]">{sourceSummary}</span>
          )}
          <Button
            onClick={() => void runRefresh("all", filters)}
            disabled={refreshing !== null}
            className="gap-2"
          >
            {refreshing === "all" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {refreshing === "all" ? "Fetching live jobs…" : "Refresh jobs"}
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-[var(--line)] bg-white/70 p-3">
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            submitSearch();
          }}
        >
          <div className="flex-1">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
              <Filter className="size-3.5" /> Search
            </label>
            <Input
              value={draftQuery}
              onChange={(e) => setDraftQuery(e.target.value)}
              placeholder="e.g. software engineer, backend java, SDE, React, job ID…"
            />
          </div>
          <Button type="submit" className="gap-2" disabled={refreshing !== null}>
            {refreshing === "search" ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            Search
          </Button>
        </form>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect
            label="Company"
            value={filters.company}
            labels={{}}
            options={[
              { value: "all", label: `All companies (${companies.length})` },
              ...companies.map(([name, count]) => ({ value: name, label: `${name} (${count})` })),
            ]}
            onChange={(company) => updateFilters({ company })}
          />
          <FilterSelect
            label="Years of experience"
            value={filters.experience}
            labels={EXPERIENCE_LABELS}
            onChange={(experience) => updateFilters({ experience })}
          />
          <FilterSelect
            label="Date posted"
            value={filters.postedWithin}
            labels={POSTED_LABELS}
            onChange={(postedWithin) => updateFilters({ postedWithin })}
          />
          <FilterSelect
            label="City"
            value={filters.city}
            labels={CITY_LABELS}
            onChange={(city) => updateFilters({ city })}
          />
          <FilterSelect
            label="Company tier"
            value={filters.tier}
            labels={TIER_LABELS}
            onChange={(tier) => updateFilters({ tier })}
          />
          <FilterSelect
            label="Source"
            value={filters.source}
            labels={SOURCE_LABELS}
            onChange={(source) => updateFilters({ source })}
          />
          <FilterSelect
            label="Sort by"
            value={filters.sort}
            labels={SORT_LABELS}
            onChange={(sort) => updateFilters({ sort })}
          />
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <Checkbox
                checked={filters.includeUnknownYoe}
                onCheckedChange={(checked) => updateFilters({ includeUnknownYoe: checked === true })}
              />
              Include jobs that don&apos;t list experience
            </label>
            <Button
              variant="ghost"
              size="sm"
              className="w-fit gap-1.5"
              disabled={!filtersActive}
              onClick={resetFilters}
            >
              <RotateCcw className="size-3.5" /> Reset filters
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Loader2 className="size-4 animate-spin" /> Loading open roles…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--line)] bg-white/50 px-6 text-center">
          <Briefcase className="size-8 text-[var(--teal)]" />
          <p className="mt-3 font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
            No open roles match
          </p>
          <p className="mt-1 max-w-md text-sm text-[var(--muted-foreground)]">
            {refreshing === "all"
              ? "Fetching live openings from company job feeds. This can take up to a minute."
              : "Loosen the filters, or run Refresh jobs to pull the latest live openings. Applied and removed jobs stay hidden here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--muted-foreground)]">
            <p>
              Showing {shown.length} of {filtered.length} open role{filtered.length === 1 ? "" : "s"}
              {filtered.length !== jobs.length ? ` (filtered from ${jobs.length})` : ""}
              {refreshing === "all" ? " · fetching live jobs…" : ""}
            </p>
            {dismissedCount > 0 && (
              <button
                type="button"
                className="text-xs underline underline-offset-2 hover:text-[var(--ink)]"
                onClick={() => void restore()}
              >
                {dismissedCount} removed · restore all
              </button>
            )}
          </div>
          {shown.map((job, index) => (
            <article
              key={job.id}
              className="job-row group rounded-xl border border-[var(--line)] bg-white/80 p-4 transition hover:border-[var(--teal)]/35 hover:bg-white sm:p-5"
              style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
                      {job.careerTitle || job.title}
                    </h3>
                    {job.isNew && (
                      <Badge className="bg-[var(--amber)] text-[var(--ink)] hover:bg-[var(--amber)]">
                        New
                      </Badge>
                    )}
                    <Badge variant="outline">{companyTierLabel(job.companyTier)}</Badge>
                    {job.origin === "live" ? (
                      <Badge variant="secondary" className="bg-[var(--teal-soft)] text-[var(--teal-ink)]">
                        Live
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[var(--muted-foreground)]">
                        Curated
                      </Badge>
                    )}
                    {job.origin !== "live" && job.sourceReachable === false && (
                      <Badge variant="outline" className="text-[var(--muted-foreground)]">
                        Source unreachable
                      </Badge>
                    )}
                  </div>
                  {job.careerJobId ? (
                    <p className="mt-1 font-mono text-xs tracking-tight text-[var(--teal-ink)]">
                      Job ID {job.careerJobId}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm font-medium text-[var(--teal-ink)]">
                    {job.company} · {job.location}
                  </p>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
                    {job.description}
                  </p>
                  {job.skills.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {job.skills.slice(0, 6).map((skill) => (
                        <Badge
                          key={skill}
                          variant="secondary"
                          className="rounded-md bg-[var(--teal-soft)] text-[var(--teal-ink)]"
                        >
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                    {experienceLabel(job)} · {job.employmentType} · {job.sourceLabel} · posted{" "}
                    {formatRelative(job.postedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-row flex-wrap gap-2 lg:flex-col">
                  <Button
                    variant="outline"
                    className="gap-1.5"
                    nativeButton={false}
                    render={<a href={job.applyUrl} target="_blank" rel="noreferrer" />}
                  >
                    {job.origin === "live" || job.directLink ? "View job" : "Career page"}{" "}
                    <ExternalLink className="size-3.5" />
                  </Button>
                  <Button
                    className="gap-1.5"
                    disabled={markingId === job.id}
                    onClick={() => void markApplied(job.id)}
                  >
                    {markingId === job.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-4" />
                    )}
                    Mark applied
                  </Button>
                  <Button
                    variant="ghost"
                    className="gap-1.5 text-[var(--muted-foreground)]"
                    disabled={dismissingId === job.id}
                    onClick={() => void dismiss(job)}
                  >
                    {dismissingId === job.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <EyeOff className="size-4" />
                    )}
                    Remove
                  </Button>
                </div>
              </div>
            </article>
          ))}
          {filtered.length > shown.length && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => setVisible((n) => n + PAGE_SIZE)}>
                Show {Math.min(PAGE_SIZE, filtered.length - shown.length)} more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
