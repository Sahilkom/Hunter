import { NextResponse } from "next/server";
import { getResume, updateStore } from "@/lib/storage";
import { buildSampleResume } from "@/lib/resume/sample";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const resume = await getResume();
    return NextResponse.json({ resume });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load resume" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { action?: string };
    if (body.action === "sample") {
      const resume = buildSampleResume();
      await updateStore((store) => {
        store.resume = resume;
      });
      return NextResponse.json({ resume });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to set resume" },
      { status: 500 },
    );
  }
}
