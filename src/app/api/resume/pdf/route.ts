import { NextResponse } from "next/server";
import { resumeToPdfBytes } from "@/lib/resume/pdf";
import { getResume } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const resume = await getResume();
    if (!resume) {
      return NextResponse.json(
        { error: "No resume loaded. Upload or load the sample first." },
        { status: 400 },
      );
    }
    const bytes = await resumeToPdfBytes(resume);
    const filename = `${(resume.fullName || "resume").replace(/\s+/g, "_")}_HunterMemory.pdf`;
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PDF generation failed" },
      { status: 500 },
    );
  }
}
