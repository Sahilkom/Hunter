import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";

export const DRIVE_COOKIE = "hm_drive";
export const DRIVE_STATE_COOKIE = "hm_drive_state";
export const STORE_FILE_NAME = "hunter-memory-store.json";
const SCOPE = "https://www.googleapis.com/auth/drive";

export type DriveConfig = {
  refreshToken: string;
  folderId: string;
  folderName?: string;
  /** "cookie" = connected from this browser, "env" = configured on the server for every visitor. */
  via: "cookie" | "env";
};

export function driveOAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

function secretKey(): Buffer {
  const secret = process.env.SESSION_SECRET?.trim() || process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!secret) throw new Error("Set SESSION_SECRET (or GOOGLE_CLIENT_SECRET) to store Drive credentials.");
  return createHash("sha256").update(secret).digest();
}

export function seal(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function unseal<T>(token: string | undefined): T | null {
  if (!token) return null;
  try {
    const raw = Buffer.from(token, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", secretKey(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const text = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Accepts a Drive folder URL (any of Google's formats) or a bare folder id. */
export function parseFolderId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const fromPath = value.match(/\/folders\/([a-zA-Z0-9_-]{15,})/);
  if (fromPath) return fromPath[1];
  const fromQuery = value.match(/[?&]id=([a-zA-Z0-9_-]{15,})/);
  if (fromQuery) return fromQuery[1];
  if (/^[a-zA-Z0-9_-]{19,}$/.test(value)) return value;
  return null;
}

export function folderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

export async function getDriveConfig(): Promise<DriveConfig | null> {
  try {
    const jar = await cookies();
    const fromCookie = unseal<Omit<DriveConfig, "via">>(jar.get(DRIVE_COOKIE)?.value);
    if (fromCookie?.refreshToken && fromCookie.folderId) return { ...fromCookie, via: "cookie" };
  } catch {
    // outside a request scope, or no secret configured
  }
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim();
  const folderId = parseFolderId(process.env.GOOGLE_DRIVE_FOLDER_ID ?? "");
  if (refreshToken && folderId) return { refreshToken, folderId, via: "env" };
  return null;
}

export function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/** Public origin of the app; behind Render's proxy request.url can carry the internal host. */
export function appBaseUrl(request: Request): string {
  const configured = process.env.APP_URL?.trim() || process.env.RENDER_EXTERNAL_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const headers = request.headers;
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  const proto = headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

export function redirectUri(request: Request): string {
  return process.env.GOOGLE_REDIRECT_URI?.trim() || `${appBaseUrl(request)}/api/drive/callback`;
}

export function authUrl(request: Request, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    redirect_uri: redirectUri(request),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCode(request: Request, code: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      redirect_uri: redirectUri(request),
      grant_type: "authorization_code",
    }),
  });
  const data = (await res.json()) as { refresh_token?: string; access_token?: string; error_description?: string };
  if (!res.ok || !data.refresh_token) {
    throw new Error(data.error_description || "Google did not return a refresh token. Try connecting again.");
  }
  if (data.access_token) tokenCache.set(data.refresh_token, { token: data.access_token, expires: Date.now() + 50 * 60_000 });
  return data.refresh_token;
}

const tokenCache = new Map<string, { token: string; expires: number }>();

export class DriveAuthError extends Error {}

async function accessToken(refreshToken: string): Promise<string> {
  const cached = tokenCache.get(refreshToken);
  if (cached && cached.expires > Date.now()) return cached.token;
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new DriveAuthError("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set on the server.");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !data.access_token) {
    tokenCache.delete(refreshToken);
    throw new DriveAuthError(
      data.error === "invalid_grant"
        ? "Google Drive access expired or was revoked. Reconnect Google Drive from the Storage panel."
        : "Could not refresh Google Drive access.",
    );
  }
  tokenCache.set(refreshToken, {
    token: data.access_token,
    expires: Date.now() + Math.max(60, (data.expires_in ?? 3600) - 120) * 1000,
  });
  return data.access_token;
}

async function driveFetch(refreshToken: string, url: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken(refreshToken);
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (res.status === 401) {
    tokenCache.delete(refreshToken);
    throw new DriveAuthError("Google Drive rejected the saved credentials. Reconnect Google Drive.");
  }
  return res;
}

export async function getFolder(
  refreshToken: string,
  folderId: string,
): Promise<{ id: string; name: string }> {
  const res = await driveFetch(
    refreshToken,
    `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,trashed&supportsAllDrives=true`,
  );
  if (res.status === 404) throw new Error("That Drive folder was not found, or this Google account cannot open it.");
  if (!res.ok) throw new Error(`Google Drive error ${res.status} while opening the folder.`);
  const data = (await res.json()) as { id: string; name: string; mimeType: string; trashed?: boolean };
  if (data.mimeType !== "application/vnd.google-apps.folder") throw new Error("That link is not a Drive folder.");
  if (data.trashed) throw new Error("That Drive folder is in the trash.");
  return { id: data.id, name: data.name };
}

type RemoteFile = { id: string; modifiedTime: string };

async function findStoreFile(refreshToken: string, folderId: string): Promise<RemoteFile | null> {
  const q = `name='${STORE_FILE_NAME}' and '${folderId}' in parents and trashed=false`;
  const res = await driveFetch(
    refreshToken,
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,modifiedTime)&orderBy=modifiedTime%20desc&supportsAllDrives=true&includeItemsFromAllDrives=true`,
  );
  if (!res.ok) throw new Error(`Google Drive error ${res.status} while listing the folder.`);
  const data = (await res.json()) as { files?: RemoteFile[] };
  return data.files?.[0] ?? null;
}

type CacheEntry = { fileId: string | null; modifiedTime: string | null; text: string | null; checkedAt: number };
const fileCache = new Map<string, CacheEntry>();
const RECHECK_MS = 10_000;

/** Returns the store JSON text from the folder, or null when the folder has no store yet. */
export async function readDriveStore(config: DriveConfig): Promise<string | null> {
  const cached = fileCache.get(config.folderId);
  if (cached && Date.now() - cached.checkedAt < RECHECK_MS) return cached.text;

  const remote = await findStoreFile(config.refreshToken, config.folderId);
  if (!remote) {
    fileCache.set(config.folderId, { fileId: null, modifiedTime: null, text: null, checkedAt: Date.now() });
    return null;
  }
  if (cached && cached.fileId === remote.id && cached.modifiedTime === remote.modifiedTime) {
    cached.checkedAt = Date.now();
    return cached.text;
  }
  const res = await driveFetch(
    config.refreshToken,
    `https://www.googleapis.com/drive/v3/files/${remote.id}?alt=media&supportsAllDrives=true`,
  );
  if (!res.ok) throw new Error(`Google Drive error ${res.status} while reading ${STORE_FILE_NAME}.`);
  const text = await res.text();
  fileCache.set(config.folderId, {
    fileId: remote.id,
    modifiedTime: remote.modifiedTime,
    text,
    checkedAt: Date.now(),
  });
  return text;
}

export async function writeDriveStore(config: DriveConfig, text: string): Promise<void> {
  let fileId = fileCache.get(config.folderId)?.fileId ?? null;
  if (!fileId) fileId = (await findStoreFile(config.refreshToken, config.folderId))?.id ?? null;

  let res: Response;
  if (fileId) {
    res = await driveFetch(
      config.refreshToken,
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,modifiedTime&supportsAllDrives=true`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: text },
    );
  } else {
    const boundary = `hm${randomBytes(8).toString("hex")}`;
    const metadata = JSON.stringify({
      name: STORE_FILE_NAME,
      parents: [config.folderId],
      mimeType: "application/json",
    });
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${boundary}--`;
    res = await driveFetch(
      config.refreshToken,
      `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime&supportsAllDrives=true`,
      { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body },
    );
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Google Drive error ${res.status} while saving: ${detail.slice(0, 200)}`);
  }
  const saved = (await res.json()) as RemoteFile;
  fileCache.set(config.folderId, {
    fileId: saved.id,
    modifiedTime: saved.modifiedTime,
    text,
    checkedAt: Date.now(),
  });
}

export async function revokeToken(refreshToken: string): Promise<void> {
  tokenCache.delete(refreshToken);
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
    method: "POST",
  }).catch(() => undefined);
}
