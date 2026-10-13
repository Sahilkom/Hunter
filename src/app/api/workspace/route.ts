import { NextResponse } from "next/server";
import { filterOpenJobs } from "@/lib/jobs/refresh";
import { readStore, resolveStorageInfo, updateStore } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const store = await readStore();
    const storage = await resolveStorageInfo();
    const openJobs = filterOpenJobs(store);
    const byStatus = store.applications.reduce<Record<string, number>>((acc, app) => {
      acc[app.status] = (acc[app.status] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      storage: {
        label: storage.label,
        kind: storage.kind,
        path: storage.storePath,
      },
      lastRefreshAt: store.lastRefreshAt,
      openJobs: openJobs.length,
      totalJobs: store.jobs.length,
      applications: store.applications.length,
      byStatus,
      hasResume: !!store.resume,
      resumeName: store.resume?.fullName ?? null,
      resumeFile: store.resume?.fileName ?? null,
      defaultNotifyEmail: store.meta.defaultNotifyEmail ?? "",
      sourceChecks: store.meta.lastSourceChecks ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load workspace" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { defaultNotifyEmail?: string };
    const store = await updateStore((current) => {
      if (typeof body.defaultNotifyEmail === "string") {
        current.meta.defaultNotifyEmail = body.defaultNotifyEmail.trim();
      }
    });
    return NextResponse.json({
      ok: true,
      defaultNotifyEmail: store.meta.defaultNotifyEmail,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update workspace" },
      { status: 500 },
    );
  }
}
