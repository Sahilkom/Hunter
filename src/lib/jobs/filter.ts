import type { ExperienceBucket, Job, JobFilters } from "@/lib/types";

function canonical(text: string): string {
  return ` ${text.toLowerCase()} `
    .replace(/front[\s-]end/g, "frontend")
    .replace(/back[\s-]end/g, "backend")
    .replace(/full[\s-]stack/g, "fullstack")
    .replace(/\b(sde|swe)\b/g, "software engineer $1")
    .replace(/\bdeveloper\b/g, "developer engineer")
    .replace(/\bdev\b/g, "developer engineer")
    .replace(/\s+/g, " ");
}

function haystack(job: Job): string {
  return canonical(
    [
      job.title,
      job.careerTitle ?? "",
      job.careerJobId ?? "",
      job.company,
      job.location,
      job.skills.join(" "),
      job.sourceLabel,
    ].join(" "),
  );
}

export function queryTokens(query: string): string[] {
  return canonical(query)
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !["in", "for", "and", "the", "jobs", "job", "role", "roles", "india"].includes(t));
}

const BUCKETS: Record<Exclude<ExperienceBucket, "any">, [number, number]> = {
  "0-1": [0, 1],
  "1-3": [1, 3],
  "3-5": [3, 5],
  "5-8": [5, 8],
  "8+": [8, 99],
};

export function matchesExperience(job: Job, bucket: ExperienceBucket, includeUnknown: boolean): boolean {
  if (bucket === "any") return true;
  if (job.yoeSource === "unknown") return includeUnknown;
  const [lo, hi] = BUCKETS[bucket];
  return job.yoeMin <= hi && job.yoeMax >= lo;
}

function time(value: string | undefined | null): number {
  const t = value ? new Date(value).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
}

export function applyJobFilters(jobs: Job[], filters: JobFilters, now = Date.now()): Job[] {
  const tokens = queryTokens(filters.query);
  const maxAgeMs = filters.postedWithin === "any" ? null : Number(filters.postedWithin) * 86_400_000;

  const result = jobs.filter((job) => {
    if (filters.company !== "all" && job.company !== filters.company) return false;
    if (filters.city !== "all" && job.city !== filters.city) return false;
    if (filters.tier !== "all" && job.companyTier !== filters.tier) return false;
    if (filters.source === "seed" && job.origin === "live") return false;
    if (filters.source !== "all" && filters.source !== "seed") {
      if (job.origin !== "live" || job.source !== filters.source) return false;
    }
    if (maxAgeMs !== null && now - time(job.postedAt) > maxAgeMs) return false;
    if (!matchesExperience(job, filters.experience, filters.includeUnknownYoe)) return false;
    if (tokens.length) {
      const text = haystack(job);
      if (!tokens.every((token) => text.includes(token))) return false;
    }
    return true;
  });

  const byPosted = (a: Job, b: Job) => time(b.postedAt) - time(a.postedAt);
  if (filters.sort === "posted") return result.sort(byPosted);
  if (filters.sort === "company") {
    return result.sort((a, b) => a.company.localeCompare(b.company) || byPosted(a, b));
  }
  return result.sort(
    (a, b) =>
      time(b.discoveredAt ?? b.postedAt) - time(a.discoveredAt ?? a.postedAt) || byPosted(a, b),
  );
}

export function experienceLabel(job: Job): string {
  if (job.employmentType === "Internship" && job.yoeMax === 0) return "Internship";
  if (job.yoeSource === "unknown") return "YOE not listed";
  const approx = job.yoeSource === "title" ? "~" : "";
  if (job.yoeMin === job.yoeMax) return `${approx}${job.yoeMin} YOE`;
  return `${approx}${job.yoeMin}–${job.yoeMax} YOE`;
}
