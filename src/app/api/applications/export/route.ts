import { NextResponse } from "next/server";
import { STATUS_LABELS } from "@/lib/types";
import { readStore } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET() {
  try {
    const store = await readStore();
    const jobsById = Object.fromEntries(store.jobs.map((j) => [j.id, j]));
    const header = [
      "jobId",
      "company",
      "title",
      "location",
      "status",
      "appliedAt",
      "updatedAt",
      "notifyEmail",
      "notes",
      "applyUrl",
    ];
    const rows = store.applications.map((app) => {
      const job = jobsById[app.jobId];
      return [
        job?.careerJobId ?? "",
        job?.company ?? "",
        job?.careerTitle || job?.title || "",
        job?.location ?? "",
        STATUS_LABELS[app.status] ?? app.status,
        app.appliedAt,
        app.updatedAt,
        app.notifyEmail,
        app.notes,
        job?.applyUrl ?? "",
      ]
        .map((cell) => csvEscape(String(cell ?? "")))
        .join(",");
    });

    const csv = [header.join(","), ...rows].join("\n");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="hunter-memory-applications.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 },
    );
  }
}
