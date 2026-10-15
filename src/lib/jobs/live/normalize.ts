import { createHash } from "crypto";
import type { CompanyTier, Job, JobCity, JobSource } from "@/lib/types";

const INDIA_PLACES: { city: JobCity; re: RegExp }[] = [
  { city: "Bangalore", re: /\b(bangalore|bengaluru|blr)\b/i },
  { city: "Hyderabad", re: /\b(hyderabad|hyd|secunderabad)\b/i },
  { city: "Delhi/NCR", re: /\b(delhi|new delhi|noida|gurgaon|gurugram|ncr|faridabad|ghaziabad)\b/i },
  { city: "Pune", re: /\bpune\b/i },
  { city: "Chennai", re: /\b(chennai|madras)\b/i },
  { city: "Mumbai", re: /\b(mumbai|navi mumbai|thane|bombay)\b/i },
];

const OTHER_INDIA =
  /\b(india|kolkata|ahmedabad|kochi|cochin|jaipur|coimbatore|chandigarh|mohali|thiruvananthapuram|trivandrum|mysore|mysuru|indore|bhubaneswar|nagpur|vadodara|surat|lucknow|vizag|visakhapatnam|mangalore|mangaluru|goa)\b/i;

export function isIndiaLocation(location: string): boolean {
  return INDIA_PLACES.some((p) => p.re.test(location)) || OTHER_INDIA.test(location);
}

export function cityFromLocation(location: string): JobCity {
  const hits = INDIA_PLACES.filter((p) => p.re.test(location));
  if (hits.length > 1) return "Multiple-India";
  if (hits.length === 1) return hits[0].city;
  if (/remote/i.test(location)) return "Remote-India";
  return "Other-India";
}

const SE_TITLE =
  /\b(software|sde|swe|sdet|developer|programmer|full[\s-]?stack|fullstack|backend|back-end|frontend|front-end|devops|devsecops|site reliability|sre|mts|member of technical staff|engineering manager)\b/i;

/** Words that make a plain "Engineer" title a software role (e.g. "Data Engineer", "Engineer, Android"). */
const SE_QUALIFIER =
  /\b(mobile|android|ios|web|cloud|platform|infrastructure|data|ml|mlops|llmops|machine learning|ai|genai|llm|security|test automation|automation|qa|embedded|firmware|java|python|golang|react|node(\.js)?|\.net|c\+\+|javascript|typescript|database|api|search|observability|distributed systems)\b/i;

const NON_SE_TITLE =
  /\b(sales|account executive|account manager|marketing|recruit|talent|hr|human resources|finance|accountant|legal|counsel|customer success|customer support|support specialist|business development|bdr|sdr|mechanical|civil|electrical engineer|chemical|industrial|automotive|diagnostic|data cent(er|re)|hardware design|analog|rf engineer|layout|physical design|process engineer|manufacturing|field service|technician|consultant|pre-?sales|value engineer|designer|product manager|program manager|project manager|director|vice president|vp|head of)\b/i;

export function isSoftwareRole(title: string): boolean {
  if (NON_SE_TITLE.test(title)) return false;
  if (SE_TITLE.test(title)) return true;
  return /\bengineer\b/i.test(title) && SE_QUALIFIER.test(title);
}

export function stripHtml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<\s*(br|\/p|\/li|\/div|\/h\d)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export function shortDescription(text: string, max = 320): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastStop = cut.lastIndexOf(". ");
  return `${lastStop > max * 0.5 ? cut.slice(0, lastStop + 1) : cut.trimEnd()}…`;
}

const YEARS_RANGE =
  /(\d{1,2})\s*(?:\+\s*)?(?:-|–|—|to)\s*(\d{1,2})\s*\+?\s*(?:years?|yrs?)/i;
const YEARS_MIN = /(\d{1,2})\s*\+?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+\w+){0,4}\s+(?:experience|exp\b)/i;
const YEARS_PLUS = /(?:minimum|at least|min\.?)\s*(?:of\s*)?(\d{1,2})\s*(?:years?|yrs?)/i;

export type YoeGuess = { yoeMin: number; yoeMax: number; yoeSource: "listed" | "title" | "unknown" };

export function inferYoe(title: string, text: string, internship = false): YoeGuess {
  if (internship || /\bintern(ship)?\b/i.test(title)) {
    return { yoeMin: 0, yoeMax: 0, yoeSource: "title" };
  }
  const listed = listedYoe(`${title}\n${text}`.slice(0, 6000));
  return reconcileYoe(listed, yoeFromTitle(title));
}

function listedYoe(sample: string): YoeGuess | null {
  const range = sample.match(YEARS_RANGE);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    if (a <= 25 && b <= 30 && a <= b) return { yoeMin: a, yoeMax: b, yoeSource: "listed" };
  }
  const min = sample.match(YEARS_PLUS) ?? sample.match(YEARS_MIN);
  if (min) {
    const a = Number(min[1]);
    if (a <= 25) return { yoeMin: a, yoeMax: a + 3, yoeSource: "listed" };
  }
  return null;
}

/**
 * Prefer what the posting states, unless the title clearly says senior/staff/manager and the
 * stated range is far below it (descriptions often quote a team-wide or "nice to have" number).
 */
export function reconcileYoe(listed: YoeGuess | null, fromTitle: YoeGuess): YoeGuess {
  if (!listed) return fromTitle;
  if (fromTitle.yoeSource === "title" && fromTitle.yoeMin >= 4 && listed.yoeMax <= fromTitle.yoeMin) {
    return fromTitle;
  }
  return listed;
}

export function yoeFromTitle(title: string): YoeGuess {
  const t = title.toLowerCase();
  if (/\b(new grad|graduate|fresher|freshers|entry[\s-]level|trainee|apprentice|campus|university)\b/.test(t)) {
    return { yoeMin: 0, yoeMax: 1, yoeSource: "title" };
  }
  const level = (n: string) => new RegExp(`\\b(engineer|developer|sde|swe|level|l)[\\s-]?(${n})\\b`).test(t);
  if (/\b(staff|principal|distinguished|architect|lead|manager|head)\b/.test(t)) {
    return { yoeMin: 8, yoeMax: 15, yoeSource: "title" };
  }
  if (level("4|5|iv|v")) return { yoeMin: 5, yoeMax: 10, yoeSource: "title" };
  if (/\b(senior|sr\.?)\b/.test(t) || level("3|iii")) {
    return { yoeMin: 4, yoeMax: 8, yoeSource: "title" };
  }
  if (level("2|ii") || /\bmid\b/.test(t)) return { yoeMin: 2, yoeMax: 5, yoeSource: "title" };
  if (/\b(junior|jr\.?|associate)\b/.test(t) || level("1|i")) {
    return { yoeMin: 0, yoeMax: 2, yoeSource: "title" };
  }
  return { yoeMin: 0, yoeMax: 0, yoeSource: "unknown" };
}

const SKILL_WORDS = [
  "Java", "Python", "Go", "Golang", "C++", "C#", "JavaScript", "TypeScript", "Kotlin", "Swift",
  "Rust", "Scala", "Ruby", "PHP", ".NET", "Node.js", "React", "Angular", "Vue", "Next.js",
  "Spring", "Spring Boot", "Django", "Flask", "FastAPI", "GraphQL", "REST", "gRPC", "SQL",
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "Cassandra", "Kafka", "Spark", "Hadoop", "Airflow",
  "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "Linux", "Microservices",
  "Distributed Systems", "Machine Learning", "LLM", "Android", "iOS", "Selenium", "CI/CD",
];

export function extractSkills(text: string, limit = 8): string[] {
  const found: string[] = [];
  for (const skill of SKILL_WORDS) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9+#]|$)`, "i");
    if (re.test(text)) found.push(skill === "Golang" ? "Go" : skill);
    if (found.length >= limit) break;
  }
  return [...new Set(found)];
}

export function extractRequirements(text: string, limit = 5): string[] {
  return text
    .split(/\n|(?<=\.)\s+/)
    .map((line) => line.replace(/^[\s•\-*·]+/, "").trim())
    .filter(
      (line) =>
        line.length > 25 &&
        line.length < 220 &&
        /\b(experience|proficien|knowledge|familiar|understanding|degree|skills?|ability)\b/i.test(line),
    )
    .slice(0, limit);
}

export function stableId(prefix: string, raw: string): string {
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, "");
  if (safe && safe.length <= 40) return `${prefix}-${safe}`;
  return `${prefix}-${createHash("sha1").update(raw).digest("hex").slice(0, 16)}`;
}

export function toIso(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const d = typeof value === "number" ? new Date(value < 1e12 ? value * 1000 : value) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Workday prints "Posted Today", "Posted Yesterday", "Posted 5 Days Ago", "Posted 30+ Days Ago". */
export function workdayPostedOn(text: string | undefined): string | null {
  if (!text) return null;
  const now = Date.now();
  if (/today/i.test(text)) return new Date(now).toISOString();
  if (/yesterday/i.test(text)) return new Date(now - 86_400_000).toISOString();
  const m = text.match(/(\d+)\+?\s*days?/i);
  if (m) return new Date(now - Number(m[1]) * 86_400_000).toISOString();
  return null;
}

export type RawListing = {
  externalId: string;
  title: string;
  company: string;
  tier: CompanyTier;
  location: string;
  applyUrl: string;
  postedAt: string | null;
  text: string;
  source: JobSource;
  sourceLabel: string;
  careerJobId?: string | null;
  employmentType?: Job["employmentType"];
  yoe?: YoeGuess | null;
};

export function toJob(raw: RawListing, now: string): Job {
  const internship = raw.employmentType === "Internship" || /\bintern(ship)?\b/i.test(raw.title);
  const yoe = raw.yoe
    ? reconcileYoe(raw.yoe, yoeFromTitle(raw.title))
    : inferYoe(raw.title, raw.text, internship);
  return {
    id: raw.externalId,
    title: raw.title.trim(),
    company: raw.company,
    companyTier: raw.tier,
    location: raw.location || "India",
    city: cityFromLocation(raw.location),
    yoeMin: yoe.yoeMin,
    yoeMax: yoe.yoeMax,
    yoeSource: yoe.yoeSource,
    employmentType: internship ? "Internship" : (raw.employmentType ?? "Full-time"),
    description: shortDescription(raw.text) || `${raw.title} at ${raw.company}.`,
    requirements: extractRequirements(raw.text),
    skills: extractSkills(`${raw.title}\n${raw.text}`),
    applyUrl: raw.applyUrl,
    careerJobId: raw.careerJobId ?? null,
    careerTitle: null,
    source: raw.source,
    sourceLabel: raw.sourceLabel,
    postedAt: raw.postedAt ?? now,
    refreshedAt: now,
    discoveredAt: now,
    isNew: true,
    sourceReachable: true,
    origin: "live",
    directLink: true,
  };
}
