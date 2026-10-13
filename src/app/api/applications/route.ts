import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { readStore, updateStore } from "@/lib/storage";
import type { ApplicationStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: ApplicationStatus[] = [
  "wishlist",
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
];

export async function GET() {
  try {
    const store = await readStore();
    const jobsById = Object.fromEntries(store.jobs.map((j) => [j.id, j]));
    const applications = store.applications
      .map((app) => ({
        ...app,
        job: jobsById[app.jobId] ?? null,
      }))
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    return NextResponse.json({ applications, lastRefreshAt: store.lastRefreshAt });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load applications" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      jobId?: string;
      status?: ApplicationStatus;
      notes?: string;
      notifyEmail?: string;
    };
    if (!body.jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }
    const status = body.status && STATUSES.includes(body.status) ? body.status : "applied";
    const now = new Date().toISOString();

    const store = await updateStore((current) => {
      const existing = current.applications.find((a) => a.jobId === body.jobId);
      const fallbackEmail = current.meta.defaultNotifyEmail ?? "";
      if (existing) {
        existing.status = status;
        existing.notes = body.notes ?? existing.notes;
        existing.notifyEmail = body.notifyEmail ?? existing.notifyEmail;
        existing.updatedAt = now;
        if (status !== "wishlist" && !existing.appliedAt) existing.appliedAt = now;
      } else {
        current.applications.push({
          id: randomUUID(),
          jobId: body.jobId!,
          status,
          notes: body.notes ?? "",
          notifyEmail: body.notifyEmail ?? fallbackEmail,
          appliedAt: status === "wishlist" ? "" : now,
          updatedAt: now,
        });
      }
    });

    const app = store.applications.find((a) => a.jobId === body.jobId);
    return NextResponse.json({ ok: true, application: app });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save application" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      status?: ApplicationStatus;
      notes?: string;
      notifyEmail?: string;
    };
    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const store = await updateStore((current) => {
      const app = current.applications.find((a) => a.id === body.id);
      if (!app) throw new Error("Application not found");
      if (body.status && STATUSES.includes(body.status)) {
        app.status = body.status;
        if (body.status !== "wishlist" && !app.appliedAt) {
          app.appliedAt = new Date().toISOString();
        }
      }
      if (typeof body.notes === "string") app.notes = body.notes;
      if (typeof body.notifyEmail === "string") app.notifyEmail = body.notifyEmail;
      app.updatedAt = new Date().toISOString();
    });

    return NextResponse.json({
      ok: true,
      application: store.applications.find((a) => a.id === body.id),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update application";
    const status = message === "Application not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await updateStore((current) => {
      current.applications = current.applications.filter((a) => a.id !== id);
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete application" },
      { status: 500 },
    );
  }
}
