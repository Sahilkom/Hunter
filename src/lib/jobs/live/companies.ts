import type { CompanyTier } from "@/lib/types";

export type BoardSource =
  | { provider: "greenhouse"; board: string }
  | { provider: "lever"; board: string }
  | { provider: "ashby"; board: string }
  | { provider: "smartrecruiters"; board: string }
  | { provider: "workday"; tenant: string; pod: number; site: string }
  | { provider: "microsoft" }
  | { provider: "amazon" }
  | { provider: "google" };

export type CompanyBoard = {
  name: string;
  tier: CompanyTier;
  source: BoardSource;
};

const gh = (name: string, board: string, tier: CompanyTier): CompanyBoard => ({
  name,
  tier,
  source: { provider: "greenhouse", board },
});
const lever = (name: string, board: string, tier: CompanyTier): CompanyBoard => ({
  name,
  tier,
  source: { provider: "lever", board },
});
const ashby = (name: string, board: string, tier: CompanyTier): CompanyBoard => ({
  name,
  tier,
  source: { provider: "ashby", board },
});
const sr = (name: string, board: string, tier: CompanyTier): CompanyBoard => ({
  name,
  tier,
  source: { provider: "smartrecruiters", board },
});
const wd = (
  name: string,
  tenant: string,
  pod: number,
  site: string,
  tier: CompanyTier,
): CompanyBoard => ({ name, tier, source: { provider: "workday", tenant, pod, site } });

/**
 * Companies with India engineering openings on a public, unauthenticated job feed.
 * Each entry was checked against its live feed; a feed that later breaks is skipped
 * at refresh time without affecting the others.
 */
export const COMPANY_BOARDS: CompanyBoard[] = [
  { name: "Google", tier: "big_tech", source: { provider: "google" } },
  { name: "Microsoft", tier: "big_tech", source: { provider: "microsoft" } },
  { name: "Amazon", tier: "big_tech", source: { provider: "amazon" } },

  wd("Salesforce", "salesforce", 12, "External_Career_Site", "big_tech"),
  wd("Adobe", "adobe", 5, "external_experienced", "big_tech"),
  wd("Nvidia", "nvidia", 5, "NVIDIAExternalCareerSite", "big_tech"),
  wd("Intel", "intel", 1, "External", "big_tech"),
  wd("HP", "hp", 5, "ExternalCareerSite", "big_tech"),
  wd("Autodesk", "autodesk", 1, "Ext", "big_tech"),
  wd("Target", "target", 5, "targetcareers", "strong_firm"),
  wd("Lowe's", "lowes", 5, "LWS_External_CS", "strong_firm"),
  wd("Disney", "disney", 5, "disneycareer", "strong_firm"),
  wd("Warner Bros. Discovery", "warnerbros", 5, "global", "strong_firm"),
  wd("Micron", "micron", 1, "External", "big_tech"),
  wd("Applied Materials", "amat", 1, "External", "strong_firm"),
  wd("Analog Devices", "analogdevices", 1, "External", "strong_firm"),
  wd("Marvell", "marvell", 1, "MarvellCareers", "strong_firm"),
  wd("NXP", "nxp", 3, "careers", "strong_firm"),
  wd("Cadence", "cadence", 1, "External_Careers", "strong_firm"),
  wd("PTC", "ptc", 1, "PTC", "strong_firm"),
  wd("Motorola Solutions", "motorolasolutions", 5, "Careers", "strong_firm"),
  wd("Ciena", "ciena", 5, "Careers", "strong_firm"),
  wd("Broadcom", "broadcom", 1, "External_Career", "big_tech"),
  wd("CrowdStrike", "crowdstrike", 5, "crowdstrikecareers", "strong_firm"),
  wd("Sabre", "sabre", 1, "SabreJobs", "strong_firm"),
  wd("Equifax", "equifax", 5, "External", "strong_firm"),
  wd("Philips", "philips", 3, "jobs-and-careers", "strong_firm"),
  wd("Visa", "visa", 5, "Visa", "bank"),
  wd("Mastercard", "mastercard", 1, "CorporateCareers", "bank"),
  wd("PayPal", "paypal", 1, "jobs", "bank"),
  wd("Citi", "citi", 5, "2", "bank"),
  wd("Morgan Stanley", "ms", 5, "External", "bank"),
  wd("Deutsche Bank", "db", 3, "DBWebsite", "bank"),
  wd("Fidelity", "fmr", 1, "FidelityCareers", "bank"),
  wd("State Street", "statestreet", 1, "Global", "bank"),
  wd("LSEG", "lseg", 3, "Careers", "bank"),
  wd("Barclays", "barclays", 3, "External_Career_Site_Barclays", "bank"),

  sr("ServiceNow", "ServiceNow", "big_tech"),
  sr("Bosch", "BoschGroup", "strong_firm"),
  sr("Experian", "Experian", "strong_firm"),
  sr("NielsenIQ", "NielsenIQ", "strong_firm"),
  sr("Continental", "Continental", "strong_firm"),
  sr("Freshworks", "Freshworks", "strong_firm"),
  sr("Swiggy", "Swiggy", "startup"),

  gh("Databricks", "databricks", "strong_firm"),
  gh("Okta", "okta", "strong_firm"),
  gh("MongoDB", "mongodb", "strong_firm"),
  gh("Zscaler", "zscaler", "strong_firm"),
  gh("Pure Storage", "purestorage", "strong_firm"),
  gh("Stripe", "stripe", "strong_firm"),
  gh("Coinbase", "coinbase", "strong_firm"),
  gh("Airbnb", "airbnb", "big_tech"),
  gh("GitLab", "gitlab", "strong_firm"),
  gh("Twilio", "twilio", "strong_firm"),
  gh("Rubrik", "rubrik", "strong_firm"),
  gh("Druva", "druva", "strong_firm"),
  gh("Elastic", "elastic", "strong_firm"),
  gh("Cloudflare", "cloudflare", "strong_firm"),
  gh("Datadog", "datadog", "strong_firm"),
  gh("New Relic", "newrelic", "strong_firm"),
  gh("Samsara", "samsara", "strong_firm"),
  gh("Fivetran", "fivetran", "strong_firm"),
  gh("Toast", "toast", "strong_firm"),
  gh("Agoda", "agoda", "strong_firm"),
  gh("Thoughtworks", "thoughtworks", "strong_firm"),
  gh("Anaplan", "anaplan", "strong_firm"),
  gh("Celonis", "celonis", "strong_firm"),
  gh("Commvault", "commvault", "strong_firm"),
  gh("PubMatic", "pubmatic", "strong_firm"),
  gh("Sumo Logic", "sumologic", "strong_firm"),
  gh("Coursera", "coursera", "strong_firm"),
  gh("Jumio", "jumio", "strong_firm"),
  gh("BitGo", "bitgo", "startup"),
  gh("Apollo.io", "apolloio", "startup"),
  gh("Tide", "tide", "startup"),
  gh("Truecaller", "truecaller", "strong_firm"),
  gh("YugabyteDB", "yugabyte", "startup"),
  gh("HackerRank", "hackerrank", "startup"),
  gh("InMobi", "inmobi", "startup"),
  gh("Glance", "glance", "startup"),
  gh("Observe.AI", "observeai", "startup"),
  gh("Turing", "turing", "startup"),
  gh("Sigmoid", "sigmoid", "startup"),
  gh("Groww", "groww", "startup"),

  lever("Meesho", "meesho", "startup"),
  lever("Zeta", "zeta", "startup"),
  lever("Hevo Data", "hevodata", "startup"),
  lever("Mindtickle", "mindtickle", "startup"),
  lever("Paytm", "paytm", "startup"),
  lever("Saviynt", "saviynt", "strong_firm"),
  lever("Coupa", "coupa", "strong_firm"),
  lever("Entrata", "entrata", "strong_firm"),
  lever("Cred", "cred", "startup"),

  ashby("Tekion", "tekion", "startup"),
  ashby("Sarvam AI", "sarvam", "startup"),
  ashby("Snowflake", "snowflake", "strong_firm"),
  ashby("Atlan", "atlan", "startup"),
  ashby("Notion", "notion", "strong_firm"),
  ashby("Kong", "kong", "startup"),
  ashby("OpenAI", "openai", "big_tech"),
  ashby("Skyflow", "skyflow", "startup"),
  ashby("SpotDraft", "spotdraft", "startup"),
];

const TIER_BY_NAME = new Map<string, CompanyTier>(
  COMPANY_BOARDS.map((c) => [normalizeCompany(c.name), c.tier]),
);

const EXTRA_TIERS: Record<string, CompanyTier> = {
  flipkart: "strong_firm",
  myntra: "strong_firm",
  phonepe: "startup",
  razorpay: "startup",
  zomato: "startup",
  eternal: "startup",
  zepto: "startup",
  oracle: "big_tech",
  cisco: "big_tech",
  ibm: "big_tech",
  sap: "big_tech",
  uber: "big_tech",
  atlassian: "strong_firm",
  intuit: "big_tech",
  qualcomm: "big_tech",
  "jp morgan": "bank",
  jpmorgan: "bank",
  "jpmorgan chase": "bank",
  "goldman sachs": "bank",
  "wells fargo": "bank",
  hsbc: "bank",
  "american express": "bank",
  "hdfc bank": "bank",
  "icici bank": "bank",
  "axis bank": "bank",
  tcs: "strong_firm",
  "tata consultancy services": "strong_firm",
  infosys: "strong_firm",
  wipro: "strong_firm",
  "hcl technologies": "strong_firm",
  hcltech: "strong_firm",
  "tech mahindra": "strong_firm",
  accenture: "strong_firm",
  capgemini: "strong_firm",
  cognizant: "strong_firm",
  ltimindtree: "strong_firm",
  zoho: "strong_firm",
};

export function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\b(pvt|private|ltd|limited|inc|llc|india|technologies|technology|corp|corporation)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

for (const [name, tier] of Object.entries(EXTRA_TIERS)) {
  const key = normalizeCompany(name);
  if (!TIER_BY_NAME.has(key)) TIER_BY_NAME.set(key, tier);
}

export function tierForCompany(name: string): CompanyTier {
  return TIER_BY_NAME.get(normalizeCompany(name)) ?? "other";
}
