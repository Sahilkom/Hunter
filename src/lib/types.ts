export type JobSource =
  | "career_page"
  | "linkedin_public"
  | "naukri_public"
  | "google_jobs"
  | "seed";

export type CompanyTier = "big_tech" | "bank" | "strong_firm" | "startup" | "other";

export type JobCity =
  | "Bangalore"
  | "Hyderabad"
  | "Delhi/NCR"
  | "Pune"
  | "Chennai"
  | "Mumbai"
  | "Remote-India"
  | "Multiple-India"
  | "Other-India";

export type JobOrigin = "seed" | "live";

export type ApplicationStatus =
  | "wishlist"
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn";

export type ToolId = "finder" | "tailor" | "updater" | "tracker";

export interface Job {
  id: string;
  title: string;
  company: string;
  companyTier: CompanyTier;
  location: string;
  city: JobCity;
  yoeMin: number;
  yoeMax: number;
  /** "listed" = parsed from the posting, "title" = inferred from seniority words, "unknown" = not stated. */
  yoeSource?: "listed" | "title" | "unknown";
  employmentType: "Full-time" | "Internship" | "Contract";
  description: string;
  requirements: string[];
  skills: string[];
  applyUrl: string;
  /** Requisition id printed on the company career page for this opening. */
  careerJobId?: string | null;
  /** Exact title published with careerJobId. */
  careerTitle?: string | null;
  source: JobSource;
  sourceLabel: string;
  postedAt: string;
  refreshedAt: string;
  /** When this app first saw the listing; drives "recently added" ordering. */
  discoveredAt?: string;
  isNew: boolean;
  sourceReachable?: boolean | null;
  origin?: JobOrigin;
  /** True when applyUrl opens the specific opening rather than a generic careers page. */
  directLink?: boolean;
}

export type PostedWithin = "any" | "1" | "3" | "7" | "14" | "30";
export type ExperienceBucket = "any" | "0-1" | "1-3" | "3-5" | "5-8" | "8+";
export type JobSort = "recent" | "posted" | "company";
export type SourceFilter = "all" | "career_page" | "linkedin_public" | "naukri_public" | "google_jobs" | "seed";

export interface JobFilters {
  query: string;
  company: string;
  city: string;
  tier: string;
  postedWithin: PostedWithin;
  experience: ExperienceBucket;
  includeUnknownYoe: boolean;
  source: SourceFilter;
  sort: JobSort;
}

export const DEFAULT_JOB_FILTERS: JobFilters = {
  query: "",
  company: "all",
  city: "all",
  tier: "all",
  postedWithin: "any",
  experience: "any",
  includeUnknownYoe: true,
  source: "all",
  sort: "recent",
};

export interface Application {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  notes: string;
  notifyEmail: string;
  appliedAt: string;
  updatedAt: string;
}

export interface ResumeExperience {
  company: string;
  role: string;
  start: string;
  end: string;
  bullets: string[];
}

export interface ResumeEducation {
  school: string;
  degree: string;
  end: string;
  details?: string;
}

export interface ResumeProject {
  name: string;
  summary: string;
  bullets: string[];
  tech: string[];
}

export interface ResumeData {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  location: string;
  links: string[];
  summary: string;
  skills: string[];
  experience: ResumeExperience[];
  education: ResumeEducation[];
  projects: ResumeProject[];
  rawText: string;
  fileName: string;
  updatedAt: string;
}

export interface SourceCheck {
  company: string;
  url: string;
  ok: boolean;
  status: number | null;
  checkedAt: string;
}

export interface StoreMeta {
  version: number;
  defaultNotifyEmail: string;
  lastSourceChecks: SourceCheck[];
  storageLabel: string;
  careerLookupAt?: string | null;
  /** Jobs the user removed from the finder; they stay hidden across refreshes. */
  dismissedJobIds?: string[];
  savedFilters?: JobFilters;
  liveFetchAt?: string | null;
  liveSourceSummary?: { ok: number; failed: number; failedCompanies?: string[]; jobs: number } | null;
  /** Query key -> ISO time of the last JSearch call, to stay inside the free quota. */
  jsearchCalls?: Record<string, string>;
}

export interface StoreData {
  jobs: Job[];
  applications: Application[];
  resume: ResumeData | null;
  lastRefreshAt: string | null;
  meta: StoreMeta;
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  wishlist: "Wishlist",
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const TOOL_IDS: ToolId[] = ["finder", "tailor", "updater", "tracker"];

export function isToolId(value: string | null | undefined): value is ToolId {
  return !!value && (TOOL_IDS as string[]).includes(value);
}
