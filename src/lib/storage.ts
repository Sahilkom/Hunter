import { promises as fs } from "fs";
import os from "os";
import path from "path";
import type { Application, Job, ResumeData, StoreData, StoreMeta } from "@/lib/types";
import { buildSeedJobs } from "@/lib/jobs/seed";

export interface StorageInfo {
  dataDir: string;
  storePath: string;
  label: string;
  kind: "desktop" | "repo";
}

function candidateDesktopDirs(): string[] {
  const home = os.homedir();
  return [
    path.join(home, "Desktop", "Hunter-Memory"),
    path.join(home, "Desktop", "Hunter Memory"),
    path.join(home, "OneDrive", "Desktop", "Hunter-Memory"),
    path.join(process.cwd(), "Hunter-Memory"),
  ];
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

let cachedInfo: StorageInfo | null = null;

export async function resolveStorageInfo(): Promise<StorageInfo> {
  if (cachedInfo) return cachedInfo;

  const configuredDir = process.env.DATA_DIR?.trim();
  if (configuredDir) {
    cachedInfo = {
      dataDir: configuredDir,
      storePath: path.join(configuredDir, "store.json"),
      label: configuredDir,
      kind: "repo",
    };
    return cachedInfo;
  }

  for (const dir of candidateDesktopDirs()) {
    if (await pathExists(dir)) {
      cachedInfo = {
        dataDir: dir,
        storePath: path.join(dir, "store.json"),
        label: dir.includes(`${path.sep}Desktop${path.sep}`)
          ? "Desktop/Hunter-Memory"
          : "Hunter-Memory",
        kind: "desktop",
      };
      return cachedInfo;
    }
  }

  // Create preferred Desktop path when Desktop exists
  const desktop = path.join(os.homedir(), "Desktop");
  if (await pathExists(desktop)) {
    const preferred = path.join(desktop, "Hunter-Memory");
    await fs.mkdir(preferred, { recursive: true });
    cachedInfo = {
      dataDir: preferred,
      storePath: path.join(preferred, "store.json"),
      label: "Desktop/Hunter-Memory",
      kind: "desktop",
    };
    return cachedInfo;
  }

  const repoData = path.join(process.cwd(), "data");
  cachedInfo = {
    dataDir: repoData,
    storePath: path.join(repoData, "store.json"),
    label: "repo/data",
    kind: "repo",
  };
  return cachedInfo;
}

function defaultMeta(storageLabel: string): StoreMeta {
  return {
    version: 2,
    defaultNotifyEmail: "",
    lastSourceChecks: [],
    storageLabel,
  };
}

function emptyStore(storageLabel: string): StoreData {
  return {
    jobs: buildSeedJobs(),
    applications: [],
    resume: null,
    lastRefreshAt: new Date().toISOString(),
    meta: defaultMeta(storageLabel),
  };
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function maybeMigrateFromRepo(target: StorageInfo): Promise<void> {
  if (target.kind !== "desktop") return;
  if (await pathExists(target.storePath)) return;
  const legacy = path.join(process.cwd(), "data", "store.json");
  if (!(await pathExists(legacy))) return;
  try {
    await fs.copyFile(legacy, target.storePath);
  } catch {
    // ignore migrate failures; fresh seed will be created
  }
}

export async function readStore(): Promise<StoreData> {
  const info = await resolveStorageInfo();
  await ensureDir(info.dataDir);
  await maybeMigrateFromRepo(info);

  try {
    const raw = await fs.readFile(info.storePath, "utf8");
    const parsed = JSON.parse(raw) as StoreData;
    if (!parsed.jobs?.length) {
      const seeded = emptyStore(info.label);
      await writeStore(seeded);
      return seeded;
    }
    return {
      jobs: parsed.jobs ?? [],
      applications: parsed.applications ?? [],
      resume: parsed.resume ?? null,
      lastRefreshAt: parsed.lastRefreshAt ?? null,
      meta: {
        ...defaultMeta(info.label),
        ...(parsed.meta ?? {}),
        storageLabel: info.label,
      },
    };
  } catch {
    const seeded = emptyStore(info.label);
    await writeStore(seeded);
    return seeded;
  }
}

export async function writeStore(store: StoreData): Promise<void> {
  const info = await resolveStorageInfo();
  await ensureDir(info.dataDir);
  store.meta = {
    ...defaultMeta(info.label),
    ...(store.meta ?? {}),
    storageLabel: info.label,
  };
  await fs.writeFile(info.storePath, JSON.stringify(store, null, 2), "utf8");
}

export async function updateStore(
  mutator: (store: StoreData) => StoreData | void,
): Promise<StoreData> {
  const store = await readStore();
  const next = mutator(store) ?? store;
  await writeStore(next);
  return next;
}

export async function getJobs(): Promise<Job[]> {
  return (await readStore()).jobs;
}

export async function getApplications(): Promise<Application[]> {
  return (await readStore()).applications;
}

export async function getResume(): Promise<ResumeData | null> {
  return (await readStore()).resume;
}
