import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import {
  appBaseUrl,
  authUrl,
  cookieOptions,
  DRIVE_STATE_COOKIE,
  driveOAuthConfigured,
  parseFolderId,
  seal,
} from "@/lib/drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function back(request: Request, params: Record<string, string>) {
  const url = new URL("/", appBaseUrl(request));
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  if (!driveOAuthConfigured()) {
    return back(request, {
      drive: "error",
      reason: "Google sign-in is not configured on the server (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).",
    });
  }
  const folderId = parseFolderId(new URL(request.url).searchParams.get("folder") ?? "");
  if (!folderId) {
    return back(request, { drive: "error", reason: "Paste a Google Drive folder link first." });
  }
  try {
    const state = randomBytes(16).toString("hex");
    const response = NextResponse.redirect(authUrl(request, state));
    response.cookies.set(DRIVE_STATE_COOKIE, seal({ state, folderId }), cookieOptions(600));
    return response;
  } catch (error) {
    return back(request, {
      drive: "error",
      reason: error instanceof Error ? error.message : "Could not start Google sign-in",
    });
  }
}
