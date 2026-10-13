"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Briefcase, ExternalLink, Filter, Loader2, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { Job } from "@/lib/types";
import { companyTierLabel, formatRelative } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export function JobFinder({ onMarkedApplied, onRefreshed }: Props) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("all");
  const [tier, setTier] = useState("all");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [sourceSummary, setSourceSummary] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load jobs");
      setJobs(data.jobs);
      setLastRefreshAt(data.lastRefreshAt);
      if (Array.isArray(data.sourceChecks) && data.sourceChecks.length) {
        const ok = data.sourceChecks.filter((c: { ok: boolean }) => c.ok).length;
        setSourceSummary(`Career pages last checked: ${ok}/${data.sourceChecks.length} reachable`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refresh failed");
      setJobs(data.jobs);
      setLastRefreshAt(data.lastRefreshAt);
      if (Array.isArray(data.sourceChecks) && data.sourceChecks.length) {
        const ok = data.sourceChecks.filter((c: { ok: boolean }) => c.ok).length;
        setSourceSummary(`Career pages last checked: ${ok}/${data.sourceChecks.length} reachable`);
      }
      toast.success(data.message);
      onRefreshed?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Refresh failed";
      setError(message);
      toast.error(message);
    } finally {
      setRefreshing(false);
    }
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

  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      if (city !== "all" && job.city !== city) return false;
      if (tier !== "all" && job.companyTier !== tier) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        (job.careerJobId ?? "").toLowerCase().includes(q) ||
        (job.careerTitle ?? "").toLowerCase().includes(q) ||
        job.title.toLowerCase().includes(q) ||
        job.company.toLowerCase().includes(q) ||
        job.skills.some((s) => s.toLowerCase().includes(q)) ||
        job.location.toLowerCase().includes(q)
      );
    });
  }, [jobs, city, tier, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--teal)]">Job Finder</p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--ink)]">
            SE roles in India, refreshed daily
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)]">
            Curated Software Engineer openings (0–2 YOE) from official career pages and
            public-style listings for big tech, banks, strong firms, and startups in
            Bangalore, Hyderabad, and Delhi/NCR. When a public career feed has that
            opening, the card shows the job ID printed on the career page next to the
            exact title from that listing. Applied jobs drop out of this feed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-col items-stretch gap-1 sm:items-end">
            <span className="text-xs text-[var(--muted-foreground)]">
              Last refresh {formatRelative(lastRefreshAt)}
            </span>
            {sourceSummary && (
              <span className="text-xs text-[var(--muted-foreground)]">{sourceSummary}</span>
            )}
            <Button onClick={() => void refresh()} disabled={refreshing} className="gap-2">
              {refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Refresh today
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-[var(--line)] bg-white/70 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
            <Filter className="size-3.5" /> Search
          </label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Career job ID, title, company…"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">City</label>
          <Select value={city} onValueChange={(value) => setCity(value ?? "all")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="City">
                {(value) =>
                  ({
                    all: "All cities",
                    Bangalore: "Bangalore",
                    Hyderabad: "Hyderabad",
                    "Delhi/NCR": "Delhi/NCR",
                    "Remote-India": "Remote-India",
                    "Multiple-India": "Multiple-India",
                  }[String(value)] ?? "City")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cities</SelectItem>
              <SelectItem value="Bangalore">Bangalore</SelectItem>
              <SelectItem value="Hyderabad">Hyderabad</SelectItem>
              <SelectItem value="Delhi/NCR">Delhi/NCR</SelectItem>
              <SelectItem value="Remote-India">Remote-India</SelectItem>
              <SelectItem value="Multiple-India">Multiple-India</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">Tier</label>
          <Select value={tier} onValueChange={(value) => setTier(value ?? "all")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Tier">
                {(value) =>
                  ({
                    all: "All tiers",
                    big_tech: "Big Tech",
                    bank: "Banks",
                    strong_firm: "Strong firms",
                    startup: "Startups",
                  }[String(value)] ?? "Tier")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tiers</SelectItem>
              <SelectItem value="big_tech">Big Tech</SelectItem>
              <SelectItem value="bank">Banks</SelectItem>
              <SelectItem value="strong_firm">Strong firms</SelectItem>
              <SelectItem value="startup">Startups</SelectItem>
            </SelectContent>
          </Select>
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
            Clear filters, or run Refresh today to pull newly discovered curated listings.
            Already-applied jobs stay hidden here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted-foreground)]">
            Showing {filtered.length} open role{filtered.length === 1 ? "" : "s"}
          </p>
          {filtered.map((job, index) => (
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
                    {job.sourceReachable === true && (
                      <Badge variant="secondary" className="bg-[var(--teal-soft)] text-[var(--teal-ink)]">
                        Source OK
                      </Badge>
                    )}
                    {job.sourceReachable === false && (
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
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
                    {job.description}
                  </p>
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
                  <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                    {job.yoeMin}–{job.yoeMax} YOE · {job.employmentType} · {job.sourceLabel} ·
                    posted {formatRelative(job.postedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-row gap-2 lg:flex-col">
                  <Button
                    variant="outline"
                    className="gap-1.5"
                    nativeButton={false}
                    render={
                      <a href={job.applyUrl} target="_blank" rel="noreferrer" />
                    }
                  >
                    Career page <ExternalLink className="size-3.5" />
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
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
