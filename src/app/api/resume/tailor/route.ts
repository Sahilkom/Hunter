import { NextResponse } from "next/server";
import { tailorResumeToJob } from "@/lib/resume/tailor";
import { readStore, updateStore } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { jobId?: string };
    if (!body.jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }
    const store = await readStore();
    if (!store.resume) {
      return NextResponse.json(
        { error: "Upload a resume first (or load the sample)." },
        { status: 400 },
      );
    }
    const job = store.jobs.find((j) => j.id === body.jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const tailored = tailorResumeToJob(store.resume, job);
    await updateStore((current) => {
      current.resume = tailored;
    });
    return NextResponse.json({
      resume: tailored,
      job,
      note: "Edits reorder and emphasize existing content only — no invented experience.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Tailor failed" },
      { status: 500 },
    );
  }
}
