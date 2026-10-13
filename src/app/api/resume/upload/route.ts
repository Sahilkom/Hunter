import { NextResponse } from "next/server";
import { parseUploadedResume } from "@/lib/resume/parse";
import { updateStore } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const resume = await parseUploadedResume(buffer, file.name, file.type || "");
    await updateStore((store) => {
      store.resume = resume;
    });
    return NextResponse.json({ resume });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
