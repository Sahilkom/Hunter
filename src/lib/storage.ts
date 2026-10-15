import { promises as fs } from "fs";
import os from "os";
import path from "path";
import type { Application, Job, ResumeData, StoreData, StoreMeta } from "@/lib/types";
import { buildSeedJobs } from "@/lib/jobs/seed";
import {
  folderUrl,
  getDriveConfig,
  readDriveStore,
  STORE_FILE_NAME,
  writeDriveStore,
  type DriveConfig,
} from "@/lib/drive";

export interface StorageInfo {
  dataDir: string;
  storePath: string;
  label: string;
  kind: "desktop" | "repo" | "drive";
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

let cachedFileInfo: StorageInfo | null = null;

async function resolveFileStorageInfo(): Promise<StorageInfo> {
  if (cachedFileInfo) return cachedFileInfo;

  const configuredDir = process.env.DATA_DIR?.trim();
  if (configuredDir) {
    cachedFileInfo = {
      dataDir: configuredDir,
      storePath: path.join(configuredDir, "store.json"),
      label: configuredDir,
      kind: "repo",
    };
    return cachedFileInfo;
  }

  for (const dir of candidateDesktopDirs()) {
    if (await pathExists(dir)) {
      cachedFileInfo = {
        dataDir: dir,
        storePath: path.join(dir, "store.json"),
        label: dir.includes(`${path.sep}Desktop${path.sep}`)
          ? "Desktop/Hunter-Memory"
          : "Hunter-Memory",
        kind: "desktop",
      };
      return cachedFileInfo;
    }
  }

  // Create preferred Desktop path when Desktop exists
  const desktop = path.join(os.homedir(), "Desktop");
  if (await pathExists(desktop)) {
    const preferred = path.join(desktop, "Hunter-Memory");
    await fs.mkdir(preferred, { recursive: true });
    cachedFileInfo = {
      dataDir: preferred,
      storePath: path.join(preferred, "store.json"),
      label: "Desktop/Hunter-Memory",
      kind: "desktop",
    };
    return cachedFileInfo;
  }

  const repoData = path.join(process.cwd(), "data");
  cachedFileInfo = {
    dataDir: repoData,
    storePath: path.join(repoData, "store.json"),
    label: "repo/data",
    kind: "repo",
  };
  return cachedFileInfo;
}

function driveInfo(config: DriveConfig): StorageInfo {
  const url = folderUrl(config.folderId);
  return {
    dataDir: url,
    storePath: `${url} → ${STORE_FILE_NAME}`,
    label: `Google Drive · ${config.folderName || "folder"}`,
    kind: "drive",
  };
}

export async function resolveStorageInfo(): Promise<StorageInfo> {
  const drive = await getDriveConfig();
  if (drive) return driveInfo(drive);
  return resolveFileStorageInfo();
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

function normalizeStore(parsed: Partial<StoreData>, label: string): StoreData | null {
  if (!parsed.jobs?.length) return null;
  return {
    jobs: parsed.jobs ?? [],
    applications: parsed.applications ?? [],
    resume: parsed.resume ?? null,
    lastRefreshAt: parsed.lastRefreshAt ?? null,
    meta: {
      ...defaultMeta(label),
      ...(parsed.meta ?? {}),
      storageLabel: label,
    },
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

async function readLocalStoreText(): Promise<string | null> {
  const info = await resolveFileStorageInfo();
  try {
    return await fs.readFile(info.storePath, "utf8");
  } catch {
    return null;
  }
}

async function readDriveBackedStore(config: DriveConfig): Promise<StoreData> {
  const info = driveInfo(config);
  const text = await readDriveStore(config);
  if (text) {
    try {
      const store = normalizeStore(JSON.parse(text) as Partial<StoreData>, info.label);
      if (store) return store;
    } catch {
      throw new Error(`${STORE_FILE_NAME} in your Drive folder is not valid JSON. Fix or delete it, then reload.`);
    }
  }
  // Empty folder: carry over whatever this server already had so connecting Drive loses nothing.
  let seeded: StoreData | null = null;
  const local = await readLocalStoreText();
  if (local) {
    try {
      seeded = normalizeStore(JSON.parse(local) as Partial<StoreData>, info.label);
    } catch {
      seeded = null;
    }
  }
  const store = seeded ?? emptyStore(info.label);
  await writeDriveStore(config, JSON.stringify(store));
  return store;
}

export async function readStore(): Promise<StoreData> {
  const drive = await getDriveConfig();
  if (drive) return readDriveBackedStore(drive);

  const info = await resolveFileStorageInfo();
  await ensureDir(info.dataDir);
  await maybeMigrateFromRepo(info);

  try {
    const raw = await fs.readFile(info.storePath, "utf8");
    const store = normalizeStore(JSON.parse(raw) as Partial<StoreData>, info.label);
    if (store) return store;
  } catch {
    // missing or unreadable file: fall through to a fresh seed
  }
  const seeded = emptyStore(info.label);
  await writeStore(seeded);
  return seeded;
}

export async function writeStore(store: StoreData): Promise<void> {
  const drive = await getDriveConfig();
  const info = drive ? driveInfo(drive) : await resolveFileStorageInfo();
  store.meta = {
    ...defaultMeta(info.label),
    ...(store.meta ?? {}),
    storageLabel: info.label,
  };
  if (drive) {
    await writeDriveStore(drive, JSON.stringify(store));
    return;
  }
  await ensureDir(info.dataDir);
  await fs.writeFile(info.storePath, JSON.stringify(store, null, 2), "utf8");
}

let queue: Promise<unknown> = Promise.resolve();

/** Read-modify-write, serialized so overlapping requests cannot drop each other's changes. */
export async function updateStore(
  mutator: (store: StoreData) => StoreData | void,
): Promise<StoreData> {
  const run = queue.then(async () => {
    const store = await readStore();
    const next = mutator(store) ?? store;
    await writeStore(next);
    return next;
  });
  queue = run.catch(() => undefined);
  return run;
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
