export type JobSource =
  | "career_page"
  | "linkedin_public"
  | "naukri_public"
  | "google_jobs"
  | "seed";

export type CompanyTier = "big_tech" | "bank" | "strong_firm" | "startup";

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
  city: "Bangalore" | "Hyderabad" | "Delhi/NCR" | "Remote-India" | "Multiple-India";
  yoeMin: number;
  yoeMax: number;
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
  isNew: boolean;
  sourceReachable?: boolean | null;
}

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
