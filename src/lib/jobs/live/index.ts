import { COMPANY_BOARDS, normalizeCompany } from "@/lib/jobs/live/companies";
import { fetchCompanyBoard } from "@/lib/jobs/live/fetchers";
import { fetchJSearch } from "@/lib/jobs/live/jsearch";
import { cityFromLocation, toJob, type RawListing } from "@/lib/jobs/live/normalize";
import type { Job, PostedWithin } from "@/lib/types";

const CONCURRENCY = 10;
const MAX_PER_COMPANY = 150;

export type LiveFetchResult = {
  jobs: Job[];
  /** Companies whose feed answered, so their missing listings can be treated as closed. */
  okCompanies: Set<string>;
  failedCompanies: string[];
  jsearchUsed: boolean;
  jsearchCount: number;
};

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index]);
      }
    }),
  );
  return results;
}

export async function fetchLiveJobs(options: {
  query?: string;
  postedWithin?: PostedWithin;
  includeJSearch: boolean;
  includeBoards?: boolean;
}): Promise<LiveFetchResult> {
  const now = new Date().toISOString();
  const okCompanies = new Set<string>();
  const failedCompanies: string[] = [];
  const raw: RawListing[] = [];

  const [boardResults, jsearch] = await Promise.all([
    pool(options.includeBoards === false ? [] : COMPANY_BOARDS, CONCURRENCY, async (company) => ({
      company,
      listings: await fetchCompanyBoard(company).catch(() => null),
    })),
    options.includeJSearch
      ? fetchJSearch(options.query ?? "", options.postedWithin ?? "any")
      : Promise.resolve(null),
  ]);

  for (const { company, listings } of boardResults) {
    if (!listings) {
      failedCompanies.push(company.name);
      continue;
    }
    okCompanies.add(company.name);
    const newestFirst = [...listings].sort(
      (a, b) => new Date(b.postedAt ?? 0).getTime() - new Date(a.postedAt ?? 0).getTime(),
    );
    raw.push(...newestFirst.slice(0, MAX_PER_COMPANY));
  }
  if (jsearch) raw.push(...jsearch);

  const seen = new Set<string>();
  const titleKeys = new Set<string>();
  const jobs: Job[] = [];
  const keyOf = (listing: RawListing) =>
    `${normalizeCompany(listing.company)}|${listing.title.toLowerCase()}|${cityFromLocation(listing.location)}`;
  for (const listing of raw) {
    if (seen.has(listing.externalId)) continue;
    seen.add(listing.externalId);
    const fromAggregator = listing.externalId.startsWith("js-");
    // An opening often appears on the company feed and on LinkedIn/Naukri; prefer the company feed.
    if (fromAggregator && titleKeys.has(keyOf(listing))) continue;
    titleKeys.add(keyOf(listing));
    jobs.push(toJob(listing, now));
  }

  return {
    jobs,
    okCompanies,
    failedCompanies,
    jsearchUsed: jsearch !== null,
    jsearchCount: jsearch?.length ?? 0,
  };
}
