import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  appBaseUrl,
  cookieOptions,
  DRIVE_COOKIE,
  DRIVE_STATE_COOKIE,
  exchangeCode,
  getFolder,
  seal,
  unseal,
} from "@/lib/drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const home = new URL("/", appBaseUrl(request));
  const fail = (reason: string) => {
    home.searchParams.set("drive", "error");
    home.searchParams.set("reason", reason);
    const response = NextResponse.redirect(home);
    response.cookies.set(DRIVE_STATE_COOKIE, "", cookieOptions(0));
    return response;
  };

  const googleError = url.searchParams.get("error");
  if (googleError) return fail(googleError === "access_denied" ? "Google sign-in was cancelled." : googleError);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const pending = unseal<{ state: string; folderId: string }>(jar.get(DRIVE_STATE_COOKIE)?.value);
  if (!code || !state || !pending || pending.state !== state) {
    return fail("Sign-in session expired. Start Connect Google Drive again.");
  }

  try {
    const refreshToken = await exchangeCode(request, code);
    const folder = await getFolder(refreshToken, pending.folderId);
    home.searchParams.set("drive", "connected");
    const response = NextResponse.redirect(home);
    response.cookies.set(
      DRIVE_COOKIE,
      seal({ refreshToken, folderId: folder.id, folderName: folder.name }),
      cookieOptions(ONE_YEAR),
    );
    response.cookies.set(DRIVE_STATE_COOKIE, "", cookieOptions(0));
    return response;
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not connect Google Drive");
  }
}
