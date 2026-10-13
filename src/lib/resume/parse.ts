import mammoth from "mammoth";
import { randomUUID } from "crypto";
import type { ResumeData, ResumeEducation, ResumeExperience, ResumeProject } from "@/lib/types";
import { buildSampleResume } from "@/lib/resume/sample";

function cleanLines(text: string): string[] {
  return text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function extractEmail(text: string): string {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
}

function extractPhone(text: string): string {
  return (
    text.match(/(\+?\d[\d\s\-()]{8,}\d)/)?.[0]?.replace(/\s+/g, " ").trim() ?? ""
  );
}

function sectionSlice(lines: string[], headers: string[]): string[] {
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  const start = lines.findIndex((l) =>
    lowerHeaders.some((h) => l.toLowerCase() === h || l.toLowerCase().startsWith(h)),
  );
  if (start < 0) return [];
  const known = [
    "summary",
    "profile",
    "experience",
    "work experience",
    "education",
    "projects",
    "skills",
    "technical skills",
  ];
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (known.includes(lines[i].toLowerCase())) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end);
}

function parseBullets(lines: string[]): string[] {
  return lines
    .filter((l) => /^[-•*]/.test(l) || l.length > 40)
    .map((l) => l.replace(/^[-•*]\s*/, ""))
    .slice(0, 8);
}

function parseExperience(lines: string[]): ResumeExperience[] {
  const chunk = sectionSlice(lines, ["experience", "work experience"]);
  if (!chunk.length) return [];
  const blocks: ResumeExperience[] = [];
  let current: ResumeExperience | null = null;
  for (const line of chunk) {
    const roleMatch = line.match(/^(.+?)\s+[|@\-–—]\s+(.+)$/);
    const dateMatch = line.match(
      /^((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})\s*[-–—]\s*(Present|\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})$/i,
    );
    if (roleMatch && !line.startsWith("-") && !line.startsWith("•")) {
      if (current) blocks.push(current);
      current = {
        role: roleMatch[1].trim(),
        company: roleMatch[2].trim(),
        start: "",
        end: "",
        bullets: [],
      };
      continue;
    }
    if (dateMatch && current) {
      current.start = dateMatch[1];
      current.end = dateMatch[2];
      continue;
    }
    if (current && (/^[-•*]/.test(line) || line.length > 35)) {
      current.bullets.push(line.replace(/^[-•*]\s*/, ""));
    }
  }
  if (current) blocks.push(current);
  return blocks.slice(0, 4);
}

function parseEducation(lines: string[]): ResumeEducation[] {
  const chunk = sectionSlice(lines, ["education"]);
  if (!chunk.length) return [];
  const first = chunk[0] ?? "";
  const second = chunk[1] ?? "";
  return [
    {
      school: first || "University",
      degree: second || "Degree",
      end: chunk.find((l) => /\d{4}/.test(l))?.match(/\d{4}/)?.[0] ?? "",
      details: chunk.slice(2).join(" · ") || undefined,
    },
  ];
}

function parseProjects(lines: string[]): ResumeProject[] {
  const chunk = sectionSlice(lines, ["projects"]);
  if (!chunk.length) return [];
  const name = chunk[0]?.replace(/^[-•*]\s*/, "") ?? "Project";
  return [
    {
      name,
      summary: chunk[1] ?? "",
      bullets: parseBullets(chunk.slice(1)),
      tech: [],
    },
  ];
}

function parseSkills(lines: string[]): string[] {
  const chunk = sectionSlice(lines, ["skills", "technical skills"]);
  if (!chunk.length) return [];
  return chunk
    .join(" ")
    .split(/[,|•]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 40)
    .slice(0, 24);
}

export function parseResumeText(text: string, fileName: string): ResumeData {
  const lines = cleanLines(text);
  const sample = buildSampleResume();
  const email = extractEmail(text);
  const phone = extractPhone(text);
  const fullName =
    lines.find((l) => !l.includes("@") && l.length < 48 && !/skills|experience/i.test(l)) ??
    sample.fullName;

  const experience = parseExperience(lines);
  const education = parseEducation(lines);
  const projects = parseProjects(lines);
  const skills = parseSkills(lines);
  const summaryLines = sectionSlice(lines, ["summary", "profile"]);

  // If parsing is thin, keep structure authentic by merging detected fields onto a clear skeleton
  // without inventing employers the user never listed.
  const resume: ResumeData = {
    id: randomUUID(),
    fullName,
    email: email || "",
    phone: phone || "",
    location: lines.find((l) => /bangalore|hyderabad|delhi|mumbai|india|pune|chennai/i.test(l)) ?? "",
    links: lines.filter((l) => /https?:\/\/|github\.com|linkedin\.com/i.test(l)).slice(0, 3),
    summary: summaryLines.join(" ").slice(0, 500) || text.slice(0, 280),
    skills: skills.length ? skills : [],
    experience: experience.length ? experience : [],
    education: education.length ? education : [],
    projects: projects.length ? projects : [],
    rawText: text.slice(0, 20_000),
    fileName,
    updatedAt: new Date().toISOString(),
  };

  // Guarantee a usable document: if the upload had almost no structure, seed demo content
  // only when the user explicitly loads the sample — otherwise keep sparse authentic fields.
  if (
    !resume.experience.length &&
    !resume.skills.length &&
    resume.rawText.length < 40
  ) {
    throw new Error("Could not read enough resume content. Try DOCX/TXT or load the sample resume.");
  }

  return resume;
}

export async function parseUploadedResume(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<ResumeData> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".docx") || mimeType.includes("wordprocessingml")) {
    const result = await mammoth.extractRawText({ buffer });
    return parseResumeText(result.value, fileName);
  }
  if (lower.endsWith(".txt") || mimeType.startsWith("text/")) {
    return parseResumeText(buffer.toString("utf8"), fileName);
  }
  if (lower.endsWith(".json") || mimeType.includes("json")) {
    const data = JSON.parse(buffer.toString("utf8")) as Partial<ResumeData>;
    const base = buildSampleResume();
    return {
      ...base,
      ...data,
      id: randomUUID(),
      fileName,
      updatedAt: new Date().toISOString(),
      rawText: buffer.toString("utf8").slice(0, 20_000),
    };
  }
  if (lower.endsWith(".pdf") || mimeType === "application/pdf") {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const parsed = await parser.getText();
      const text = (parsed.text || "").replace(/\s+/g, " ").trim();
      if (text.length >= 40) {
        return parseResumeText(parsed.text, fileName);
      }
    } catch {
      // fall through to coarse extract
    }
    const asText = buffer.toString("utf8").replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");
    const compact = asText.replace(/\s+/g, " ").trim();
    if (compact.length < 80) {
      throw new Error(
        "Could not extract enough text from this PDF. Upload DOCX/TXT, or use Load sample resume.",
      );
    }
    return parseResumeText(compact, fileName);
  }
  throw new Error("Unsupported file type. Upload DOCX, TXT, JSON, or PDF.");
}
