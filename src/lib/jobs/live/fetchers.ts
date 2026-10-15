import { fetchGoogleOpenings } from "@/lib/jobs/career-ids";
import type { CompanyBoard } from "@/lib/jobs/live/companies";
import {
  isIndiaLocation,
  isSoftwareRole,
  stableId,
  stripHtml,
  toIso,
  workdayPostedOn,
  type RawListing,
} from "@/lib/jobs/live/normalize";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

async function fetchJson<T>(url: string, init: RequestInit = {}, timeoutMs = 20000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function keep(title: string, location: string): boolean {
  return isSoftwareRole(title) && isIndiaLocation(location);
}

async function greenhouse(company: CompanyBoard, board: string): Promise<RawListing[] | null> {
  const data = await fetchJson<{
    jobs?: {
      id?: number;
      title?: string;
      absolute_url?: string;
      location?: { name?: string };
      first_published?: string;
      updated_at?: string;
      content?: string;
      requisition_id?: string | null;
    }[];
  }>(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`);
  if (!data?.jobs) return null;
  return data.jobs.flatMap((job) => {
    const title = job.title?.trim() ?? "";
    const location = job.location?.name ?? "";
    if (!job.id || !title || !keep(title, location)) return [];
    return [
      {
        externalId: stableId(`gh-${board}`, String(job.id)),
        title,
        company: company.name,
        tier: company.tier,
        location,
        applyUrl: job.absolute_url || `https://job-boards.greenhouse.io/${board}/jobs/${job.id}`,
        postedAt: toIso(job.first_published) ?? toIso(job.updated_at),
        text: stripHtml(job.content ?? ""),
        source: "career_page" as const,
        sourceLabel: `${company.name} Careers`,
        careerJobId: job.requisition_id || String(job.id),
      },
    ];
  });
}

async function lever(company: CompanyBoard, board: string): Promise<RawListing[] | null> {
  const data = await fetchJson<
    {
      id?: string;
      text?: string;
      hostedUrl?: string;
      createdAt?: number;
      descriptionPlain?: string;
      additionalPlain?: string;
      lists?: { text?: string; content?: string }[];
      categories?: { location?: string; allLocations?: string[]; commitment?: string };
    }[]
  >(`https://api.lever.co/v0/postings/${board}?mode=json`);
  if (!Array.isArray(data)) return null;
  return data.flatMap((job) => {
    const title = job.text?.trim() ?? "";
    const location = [job.categories?.location, ...(job.categories?.allLocations ?? [])]
      .filter(Boolean)
      .join(", ");
    if (!job.id || !title || !keep(title, location)) return [];
    const lists = (job.lists ?? [])
      .map((l) => `${l.text ?? ""}\n${stripHtml(l.content ?? "")}`)
      .join("\n");
    return [
      {
        externalId: stableId(`lv-${board}`, job.id),
        title,
        company: company.name,
        tier: company.tier,
        location: job.categories?.location || location,
        applyUrl: job.hostedUrl || `https://jobs.lever.co/${board}/${job.id}`,
        postedAt: toIso(job.createdAt),
        text: `${job.descriptionPlain ?? ""}\n${lists}\n${job.additionalPlain ?? ""}`,
        source: "career_page" as const,
        sourceLabel: `${company.name} Careers`,
        employmentType: /intern/i.test(job.categories?.commitment ?? "") ? "Internship" : undefined,
      },
    ];
  });
}

async function ashby(company: CompanyBoard, board: string): Promise<RawListing[] | null> {
  const data = await fetchJson<{
    jobs?: {
      id?: string;
      title?: string;
      location?: string;
      secondaryLocations?: { location?: string }[];
      publishedAt?: string;
      jobUrl?: string;
      descriptionPlain?: string;
      employmentType?: string;
      isListed?: boolean;
    }[];
  }>(`https://api.ashbyhq.com/posting-api/job-board/${board}`);
  if (!data?.jobs) return null;
  return data.jobs.flatMap((job) => {
    const title = job.title?.trim() ?? "";
    const location = [job.location, ...(job.secondaryLocations ?? []).map((s) => s.location)]
      .filter(Boolean)
      .join(", ");
    if (!job.id || !title || job.isListed === false || !keep(title, location)) return [];
    return [
      {
        externalId: stableId(`ab-${board}`, job.id),
        title,
        company: company.name,
        tier: company.tier,
        location,
        applyUrl: job.jobUrl || `https://jobs.ashbyhq.com/${board}/${job.id}`,
        postedAt: toIso(job.publishedAt),
        text: job.descriptionPlain ?? "",
        source: "career_page" as const,
        sourceLabel: `${company.name} Careers`,
        employmentType: /intern/i.test(job.employmentType ?? "") ? "Internship" : undefined,
      },
    ];
  });
}

async function smartRecruiters(company: CompanyBoard, board: string): Promise<RawListing[] | null> {
  const listings: RawListing[] = [];
  let ok = false;
  for (const query of ["software", "developer", "engineer"]) {
    for (let offset = 0; offset < 300; offset += 100) {
      const data = await fetchJson<{
        totalFound?: number;
        content?: {
          id?: string;
          name?: string;
          refNumber?: string;
          releasedDate?: string;
          location?: { fullLocation?: string; city?: string; remote?: boolean };
          experienceLevel?: { id?: string };
          typeOfEmployment?: { label?: string };
        }[];
      }>(
        `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(board)}/postings?q=${query}&country=in&limit=100&offset=${offset}`,
      );
      if (!data?.content) break;
      ok = true;
      for (const posting of data.content) {
        const title = posting.name?.trim() ?? "";
        const location = posting.location?.fullLocation || posting.location?.city || "India";
        if (!posting.id || !title || !isSoftwareRole(title)) continue;
        const level = posting.experienceLevel?.id ?? "";
        listings.push({
          externalId: stableId(`sr-${board}`, posting.id),
          title,
          company: company.name,
          tier: company.tier,
          location: /india/i.test(location) ? location : `${location}, India`,
          applyUrl: `https://jobs.smartrecruiters.com/${encodeURIComponent(board)}/${posting.id}`,
          postedAt: toIso(posting.releasedDate),
          text: "",
          source: "career_page",
          sourceLabel: `${company.name} Careers`,
          careerJobId: posting.refNumber || null,
          employmentType: /intern/i.test(`${posting.typeOfEmployment?.label} ${level}`)
            ? "Internship"
            : undefined,
          yoe:
            level === "entry_level"
              ? { yoeMin: 0, yoeMax: 2, yoeSource: "listed" }
              : level === "associate"
                ? { yoeMin: 1, yoeMax: 3, yoeSource: "listed" }
                : level === "mid_senior_level"
                  ? { yoeMin: 3, yoeMax: 8, yoeSource: "listed" }
                  : level === "director" || level === "executive"
                    ? { yoeMin: 10, yoeMax: 20, yoeSource: "listed" }
                    : null,
        });
      }
      if ((data.totalFound ?? 0) <= offset + 100) break;
    }
  }
  return ok ? listings : null;
}

async function workday(
  company: CompanyBoard,
  tenant: string,
  pod: number,
  site: string,
): Promise<RawListing[] | null> {
  const host = `https://${tenant}.wd${pod}.myworkdayjobs.com`;
  const listings: RawListing[] = [];
  let ok = false;
  for (const searchText of ["software engineer India", "software developer India"]) {
    for (let offset = 0; offset < 100; offset += 20) {
      const data = await fetchJson<{
        total?: number;
        jobPostings?: {
          title?: string;
          externalPath?: string;
          locationsText?: string;
          postedOn?: string;
          bulletFields?: string[];
        }[];
      }>(`${host}/wday/cxs/${tenant}/${site}/jobs`, {
        method: "POST",
        body: JSON.stringify({ appliedFacets: {}, limit: 20, offset, searchText }),
      });
      if (!data?.jobPostings) break;
      ok = true;
      for (const posting of data.jobPostings) {
        const title = posting.title?.trim() ?? "";
        const location = posting.locationsText ?? "";
        if (!posting.externalPath || !title || !keep(title, location)) continue;
        listings.push({
          externalId: stableId(`wd-${tenant}`, posting.externalPath),
          title,
          company: company.name,
          tier: company.tier,
          location,
          applyUrl: `${host}/en-US/${site}${posting.externalPath}`,
          postedAt: workdayPostedOn(posting.postedOn),
          text: "",
          source: "career_page",
          sourceLabel: `${company.name} Careers`,
          careerJobId: posting.bulletFields?.[0] ?? null,
        });
      }
      if ((data.total ?? 0) <= offset + 20 || data.jobPostings.length < 20) break;
    }
  }
  return ok ? listings : null;
}

async function microsoft(company: CompanyBoard): Promise<RawListing[] | null> {
  const listings: RawListing[] = [];
  let ok = false;
  for (const query of ["software engineer", "software developer"]) {
    for (let start = 0; start < 200; start += 40) {
      const data = await fetchJson<{
        data?: {
          count?: number;
          positions?: {
            id?: number | string;
            displayJobId?: string;
            name?: string;
            locations?: string[];
            postedTs?: number;
            positionUrl?: string;
          }[];
        };
      }>(
        `https://apply.careers.microsoft.com/api/pcsx/search?domain=microsoft.com&query=${encodeURIComponent(query)}&location=India&start=${start}&num=40`,
      );
      const positions = data?.data?.positions;
      if (!positions) break;
      ok = true;
      for (const p of positions) {
        const title = p.name?.trim() ?? "";
        const location = (p.locations ?? []).join("; ");
        if (!p.id || !title || !keep(title, location)) continue;
        listings.push({
          externalId: stableId("ms", String(p.id)),
          title,
          company: company.name,
          tier: company.tier,
          location,
          applyUrl: p.positionUrl
            ? `https://apply.careers.microsoft.com${p.positionUrl}`
            : `https://jobs.careers.microsoft.com/global/en/job/${p.id}`,
          postedAt: toIso(p.postedTs),
          text: "",
          source: "career_page",
          sourceLabel: "Microsoft Careers",
          careerJobId: p.displayJobId ?? null,
        });
      }
      if (positions.length < 40) break;
    }
  }
  return ok ? listings : null;
}

async function amazon(company: CompanyBoard): Promise<RawListing[] | null> {
  const listings: RawListing[] = [];
  let ok = false;
  for (let offset = 0; offset < 400; offset += 100) {
    const data = await fetchJson<{
      hits?: number;
      jobs?: {
        id_icims?: string;
        title?: string;
        normalized_location?: string;
        location?: string;
        job_path?: string;
        posted_date?: string;
        description?: string;
        basic_qualifications?: string;
        preferred_qualifications?: string;
        is_intern?: boolean;
      }[];
    }>(
      `https://www.amazon.jobs/en/search.json?base_query=software&country=IND&result_limit=100&offset=${offset}&sort=recent`,
    );
    if (!data?.jobs) break;
    ok = true;
    for (const job of data.jobs) {
      const title = job.title?.trim() ?? "";
      const location = job.normalized_location || job.location || "India";
      if (!job.id_icims || !title || !keep(title, location)) continue;
      listings.push({
        externalId: stableId("amzn", job.id_icims),
        title,
        company: company.name,
        tier: company.tier,
        location,
        applyUrl: job.job_path
          ? `https://www.amazon.jobs${job.job_path}`
          : `https://www.amazon.jobs/en/jobs/${job.id_icims}`,
        postedAt: toIso(job.posted_date),
        text: stripHtml(
          `${job.description ?? ""}\n${job.basic_qualifications ?? ""}\n${job.preferred_qualifications ?? ""}`,
        ),
        source: "career_page",
        sourceLabel: "Amazon Jobs",
        careerJobId: job.id_icims,
        employmentType: job.is_intern ? "Internship" : undefined,
      });
    }
    if ((data.hits ?? 0) <= offset + 100) break;
  }
  return ok ? listings : null;
}

async function google(company: CompanyBoard): Promise<RawListing[] | null> {
  const openings = await fetchGoogleOpenings(["software engineer", "software developer", "site reliability engineer"]);
  if (!openings) return null;
  return openings
    .filter((o) => isSoftwareRole(o.title))
    .map((o) => ({
      externalId: stableId("goog", o.careerJobId),
      title: o.title,
      company: company.name,
      tier: company.tier,
      location: "India",
      applyUrl: o.applyUrl,
      postedAt: null,
      text: "",
      source: "career_page" as const,
      sourceLabel: "Google Careers",
      careerJobId: o.careerJobId,
    }));
}

export async function fetchCompanyBoard(company: CompanyBoard): Promise<RawListing[] | null> {
  const s = company.source;
  switch (s.provider) {
    case "greenhouse":
      return greenhouse(company, s.board);
    case "lever":
      return lever(company, s.board);
    case "ashby":
      return ashby(company, s.board);
    case "smartrecruiters":
      return smartRecruiters(company, s.board);
    case "workday":
      return workday(company, s.tenant, s.pod, s.site);
    case "microsoft":
      return microsoft(company);
    case "amazon":
      return amazon(company);
    case "google":
      return google(company);
  }
}
