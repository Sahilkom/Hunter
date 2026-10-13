import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ResumeData } from "@/lib/types";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const ACCENT = rgb(0.05, 0.35, 0.32);
const INK = rgb(0.12, 0.14, 0.16);
const MUTED = rgb(0.35, 0.4, 0.42);

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export async function resumeToPdfBytes(resume: ResumeData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const maxWidth = PAGE_WIDTH - MARGIN * 2;
  let y = PAGE_HEIGHT - MARGIN;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  const drawLine = (text: string, font: PDFFont, size: number, color = INK, gap = 14) => {
    const lines = wrapText(text, font, size, maxWidth);
    for (const line of lines) {
      ensureSpace(gap);
      page.drawText(line, { x: MARGIN, y, size, font, color });
      y -= gap;
    }
  };

  const section = (title: string) => {
    ensureSpace(28);
    y -= 8;
    page.drawText(title.toUpperCase(), {
      x: MARGIN,
      y,
      size: 10,
      font: bold,
      color: ACCENT,
    });
    y -= 6;
    page.drawRectangle({
      x: MARGIN,
      y,
      width: maxWidth,
      height: 1,
      color: rgb(0.78, 0.86, 0.84),
    });
    y -= 14;
  };

  // Header — consistent visual format for tailor/update exports
  drawLine(resume.fullName || "Candidate", bold, 20, ACCENT, 24);
  const contact = [resume.email, resume.phone, resume.location, ...resume.links]
    .filter(Boolean)
    .join("  ·  ");
  if (contact) drawLine(contact, regular, 9, MUTED, 12);

  if (resume.summary) {
    section("Summary");
    drawLine(resume.summary, regular, 10, INK, 13);
  }

  if (resume.skills.length) {
    section("Skills");
    drawLine(resume.skills.join(" · "), regular, 10, INK, 13);
  }

  if (resume.experience.length) {
    section("Experience");
    for (const exp of resume.experience) {
      ensureSpace(40);
      const left = `${exp.role}  |  ${exp.company}`;
      const right = [exp.start, exp.end].filter(Boolean).join(" – ");
      page.drawText(left, { x: MARGIN, y, size: 11, font: bold, color: INK });
      if (right) {
        const w = regular.widthOfTextAtSize(right, 9);
        page.drawText(right, {
          x: PAGE_WIDTH - MARGIN - w,
          y,
          size: 9,
          font: regular,
          color: MUTED,
        });
      }
      y -= 14;
      for (const bullet of exp.bullets) {
        const lines = wrapText(`• ${bullet}`, regular, 10, maxWidth - 8);
        for (const line of lines) {
          ensureSpace(13);
          page.drawText(line, { x: MARGIN + 4, y, size: 10, font: regular, color: INK });
          y -= 13;
        }
      }
      y -= 6;
    }
  }

  if (resume.projects.length) {
    section("Projects");
    for (const project of resume.projects) {
      drawLine(project.name, bold, 11, INK, 14);
      if (project.summary) drawLine(project.summary, regular, 10, MUTED, 12);
      if (project.tech.length) drawLine(project.tech.join(" · "), regular, 9, MUTED, 12);
      for (const bullet of project.bullets) {
        const lines = wrapText(`• ${bullet}`, regular, 10, maxWidth - 8);
        for (const line of lines) {
          ensureSpace(13);
          page.drawText(line, { x: MARGIN + 4, y, size: 10, font: regular, color: INK });
          y -= 13;
        }
      }
      y -= 6;
    }
  }

  if (resume.education.length) {
    section("Education");
    for (const edu of resume.education) {
      drawLine(`${edu.degree}  |  ${edu.school}`, bold, 11, INK, 14);
      const meta = [edu.end, edu.details].filter(Boolean).join(" · ");
      if (meta) drawLine(meta, regular, 10, MUTED, 12);
      y -= 4;
    }
  }

  // Footer mark for format consistency
  const pages = doc.getPages();
  pages.forEach((p: PDFPage, idx: number) => {
    p.drawText(`Hunter Memory · Resume export · ${idx + 1}/${pages.length}`, {
      x: MARGIN,
      y: 24,
      size: 8,
      font: regular,
      color: MUTED,
    });
  });

  return doc.save();
}
