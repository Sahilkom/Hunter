import { tierForCompany } from "@/lib/jobs/live/companies";
import { isSoftwareRole, stableId, toIso, type RawListing } from "@/lib/jobs/live/normalize";
import type { JobSource, PostedWithin } from "@/lib/types";

type JSearchJob = {
  job_id?: string;
  job_uid?: string;
  job_title?: string;
  employer_name?: string;
  job_publisher?: string;
  job_apply_link?: string;
  job_apply_is_direct?: boolean;
  apply_options?: { publisher?: string; apply_link?: string; is_direct?: boolean }[];
  job_city?: string | null;
  job_state?: string | null;
  job_country?: string | null;
  job_location?: string | null;
  job_is_remote?: boolean;
  job_posted_at_datetime_utc?: string | null;
  job_posted_at_timestamp?: number | null;
  job_description?: string;
  job_employment_type?: string | null;
  job_required_experience?: {
    no_experience_required?: boolean;
    required_experience_in_months?: number | null;
  } | null;
};

export function jsearchKey(): string | null {
  return process.env.RAPIDAPI_KEY?.trim() || process.env.JSEARCH_API_KEY?.trim() || null;
}

function datePosted(within: PostedWithin): string {
  switch (within) {
    case "1":
      return "today";
    case "3":
      return "3days";
    case "7":
      return "week";
    case "14":
    case "30":
      return "month";
    default:
      return "all";
  }
}

function sourceFor(publisher: string): { source: JobSource; label: string } {
  if (/linkedin/i.test(publisher)) return { source: "linkedin_public", label: "LinkedIn" };
  if (/naukri/i.test(publisher)) return { source: "naukri_public", label: "Naukri" };
  return { source: "google_jobs", label: publisher || "Google Jobs" };
}

export function jsearchQueryKey(query: string, within: PostedWithin): string {
  return `${query.trim().toLowerCase() || "software engineer"}|${datePosted(within)}`;
}

/**
 * JSearch (RapidAPI) aggregates Google for Jobs, which indexes LinkedIn, Naukri,
 * Indeed, Glassdoor and company sites. One call per search keeps the free tier usable.
 */
export async function fetchJSearch(
  query: string,
  within: PostedWithin,
  pages = 1,
): Promise<RawListing[] | null> {
  const key = jsearchKey();
  if (!key) return null;
  const q = `${query.trim() || "software engineer"} in India`;
  const url = `https://jsearch.p.rapidapi.com/search-v2?query=${encodeURIComponent(q)}&page=1&num_pages=${pages}&country=in&date_posted=${datePosted(within)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "X-RapidAPI-Key": key,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
      },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: JSearchJob[] | { jobs?: JSearchJob[] } };
    const jobs = Array.isArray(body.data) ? body.data : (body.data?.jobs ?? []);
    return jobs.flatMap((job) => {
      const title = job.job_title?.trim() ?? "";
      const company = job.employer_name?.trim() ?? "";
      const id = job.job_id || job.job_uid;
      if (!id || !title || !company || !isSoftwareRole(title)) return [];
      if (job.job_country && !/^(in|india)$/i.test(job.job_country)) return [];
      const direct = job.apply_options?.find((o) => o.is_direct && o.apply_link);
      const applyUrl = direct?.apply_link || job.job_apply_link || job.apply_options?.[0]?.apply_link;
      if (!applyUrl) return [];
      const { source, label } = sourceFor(job.job_publisher ?? "");
      const location =
        job.job_location ||
        [job.job_city, job.job_state].filter(Boolean).join(", ") ||
        (job.job_is_remote ? "Remote, India" : "India");
      const months = job.job_required_experience?.required_experience_in_months;
      return [
        {
          externalId: stableId("js", id),
          title,
          company,
          tier: tierForCompany(company),
          location,
          applyUrl,
          postedAt: toIso(job.job_posted_at_datetime_utc) ?? toIso(job.job_posted_at_timestamp),
          text: job.job_description ?? "",
          source,
          sourceLabel: label,
          employmentType: /intern/i.test(job.job_employment_type ?? "")
            ? "Internship"
            : /contract/i.test(job.job_employment_type ?? "")
              ? "Contract"
              : undefined,
          yoe:
            typeof months === "number" && months >= 0
              ? {
                  yoeMin: Math.floor(months / 12),
                  yoeMax: Math.floor(months / 12) + 2,
                  yoeSource: "listed" as const,
                }
              : job.job_required_experience?.no_experience_required
                ? { yoeMin: 0, yoeMax: 1, yoeSource: "listed" as const }
                : null,
        },
      ];
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
