import { NextResponse } from "next/server";
import { applyResumeUpdates } from "@/lib/resume/tailor";
import { readStore, updateStore } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { request?: string };
    const text = body.request?.trim();
    if (!text) {
      return NextResponse.json({ error: "request text is required" }, { status: 400 });
    }
    const store = await readStore();
    if (!store.resume) {
      return NextResponse.json(
        { error: "Upload a resume first (or load the sample)." },
        { status: 400 },
      );
    }
    const updated = applyResumeUpdates(store.resume, text);
    await updateStore((current) => {
      current.resume = updated;
    });
    return NextResponse.json({
      resume: updated,
      hint: "Supported directives: add skills:, summary:, append to summary:, add project:, add bullet:, location:, email:, phone:",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 },
    );
  }
}
