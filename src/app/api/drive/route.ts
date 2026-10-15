import { NextResponse } from "next/server";
import {
  cookieOptions,
  DRIVE_COOKIE,
  driveOAuthConfigured,
  folderUrl,
  getDriveConfig,
  getFolder,
  parseFolderId,
  revokeToken,
  seal,
  STORE_FILE_NAME,
} from "@/lib/drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function GET() {
  const config = await getDriveConfig();
  return NextResponse.json({
    oauthConfigured: driveOAuthConfigured(),
    connected: !!config,
    via: config?.via ?? null,
    folderId: config?.folderId ?? null,
    folderName: config?.folderName ?? null,
    folderUrl: config ? folderUrl(config.folderId) : null,
    fileName: STORE_FILE_NAME,
    renderDisk: !!process.env.DATA_DIR?.trim(),
  });
}

/** Switch the connected account to a different folder without signing in again. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { folder?: string };
    const folderId = parseFolderId(body.folder ?? "");
    if (!folderId) {
      return NextResponse.json({ error: "Paste a Google Drive folder link." }, { status: 400 });
    }
    const config = await getDriveConfig();
    if (!config || config.via !== "cookie") {
      return NextResponse.json(
        { error: "Connect Google Drive first, then you can switch folders." },
        { status: 400 },
      );
    }
    const folder = await getFolder(config.refreshToken, folderId);
    const response = NextResponse.json({
      ok: true,
      folderId: folder.id,
      folderName: folder.name,
      folderUrl: folderUrl(folder.id),
    });
    response.cookies.set(
      DRIVE_COOKIE,
      seal({ refreshToken: config.refreshToken, folderId: folder.id, folderName: folder.name }),
      cookieOptions(ONE_YEAR),
    );
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not switch folder" },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  const config = await getDriveConfig();
  if (config?.via === "cookie") await revokeToken(config.refreshToken);
  const response = NextResponse.json({ ok: true, envStillConfigured: config?.via === "env" });
  response.cookies.set(DRIVE_COOKIE, "", cookieOptions(0));
  return response;
}
