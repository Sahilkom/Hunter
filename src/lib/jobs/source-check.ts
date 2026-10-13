import { CAREER_URLS } from "@/lib/jobs/seed";
import type { SourceCheck } from "@/lib/types";

/**
 * Lightweight ToS-safe reachability check against official career URLs.
 * Uses HEAD (falls back to GET) with a short timeout — no HTML scraping.
 */
export async function checkCareerSources(
  limit = 8,
): Promise<SourceCheck[]> {
  const entries = Object.entries(CAREER_URLS).slice(0, limit);
  const checkedAt = new Date().toISOString();

  const results = await Promise.all(
    entries.map(async ([company, url]) => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4500);
        let res = await fetch(url, {
          method: "HEAD",
          redirect: "follow",
          signal: controller.signal,
          headers: { "User-Agent": "HunterMemory/1.0 (+local job workspace)" },
        }).catch(() => null);

        if (!res || res.status === 405 || res.status === 501) {
          res = await fetch(url, {
            method: "GET",
            redirect: "follow",
            signal: controller.signal,
            headers: { "User-Agent": "HunterMemory/1.0 (+local job workspace)" },
          });
        }
        clearTimeout(timer);
        const ok = res.ok || (res.status >= 300 && res.status < 400);
        return {
          company,
          url,
          ok,
          status: res.status,
          checkedAt,
        } satisfies SourceCheck;
      } catch {
        return {
          company,
          url,
          ok: false,
          status: null,
          checkedAt,
        } satisfies SourceCheck;
      }
    }),
  );

  return results;
}
