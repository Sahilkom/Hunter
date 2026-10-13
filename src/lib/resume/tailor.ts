import type { Job, ResumeData } from "@/lib/types";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#.]/)
    .filter((t) => t.length > 1);
}

function uniquePreserve(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Authentic tailoring: reorder/emphasize existing skills and bullets that match the JD.
 * Never invent employers, degrees, or metrics the resume does not already contain.
 */
export function tailorResumeToJob(resume: ResumeData, job: Job): ResumeData {
  const jdTokens = new Set(
    tokenize([job.title, job.description, ...job.requirements, ...job.skills].join(" ")),
  );

  const scoreText = (text: string) =>
    tokenize(text).reduce((score, token) => score + (jdTokens.has(token) ? 1 : 0), 0);

  const overlappingSkills = resume.skills.filter((s) =>
    job.skills.some(
      (js) =>
        js.toLowerCase() === s.toLowerCase() ||
        s.toLowerCase().includes(js.toLowerCase()) ||
        js.toLowerCase().includes(s.toLowerCase()),
    ),
  );
  const remainingSkills = resume.skills.filter((s) => !overlappingSkills.includes(s));
  const skills = uniquePreserve([...overlappingSkills, ...remainingSkills]);

  const experience = resume.experience.map((exp) => ({
    ...exp,
    bullets: [...exp.bullets].sort((a, b) => scoreText(b) - scoreText(a)),
  }));

  const projects = [...resume.projects].sort(
    (a, b) =>
      scoreText(`${b.name} ${b.summary} ${b.bullets.join(" ")} ${b.tech.join(" ")}`) -
      scoreText(`${a.name} ${a.summary} ${a.bullets.join(" ")} ${a.tech.join(" ")}`),
  );

  const highlightSkills = overlappingSkills.slice(0, 5);
  const baseSummary = resume.summary.replace(/\s+/g, " ").trim();
  const emphasis =
    highlightSkills.length > 0
      ? ` Emphasizing relevant strengths for ${job.company}'s ${job.title} role: ${highlightSkills.join(", ")}.`
      : ` Tailored emphasis for ${job.company}'s ${job.title} opening using existing experience only.`;

  // Keep summary authentic — append alignment sentence, do not fabricate claims.
  const summary = `${baseSummary}${emphasis}`.slice(0, 700);

  return {
    ...resume,
    summary,
    skills,
    experience,
    projects,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Apply freeform update requests without inventing unverified experience.
 * Supports additive skill/project/summary edits when the user explicitly asks.
 */
export function applyResumeUpdates(resume: ResumeData, request: string): ResumeData {
  const next: ResumeData = structuredClone(resume);
  const text = request.trim();
  if (!text) return next;

  const lower = text.toLowerCase();

  // Skills: "add skills: X, Y" or "add skill X"
  const skillsMatch =
    text.match(/add skills?:\s*(.+)$/im) ||
    text.match(/skills?\s*[-:]\s*(.+)$/im);
  if (skillsMatch) {
    const extras = skillsMatch[1]
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    next.skills = uniquePreserve([...next.skills, ...extras]);
  }

  // Summary rewrite/append
  if (lower.includes("summary:") || lower.startsWith("update summary")) {
    const summaryText = text.split(/summary:\s*/i)[1]?.trim();
    if (summaryText) next.summary = summaryText.slice(0, 700);
  } else if (lower.includes("append to summary")) {
    const appendText = text.split(/append to summary:?\s*/i)[1]?.trim();
    if (appendText) next.summary = `${next.summary} ${appendText}`.slice(0, 700);
  }

  // Project add: "add project: Name — details"
  const projectMatch = text.match(/add project:\s*([^\n—\-|]+)(?:[—\-|:]\s*(.+))?/i);
  if (projectMatch) {
    next.projects = [
      {
        name: projectMatch[1].trim(),
        summary: (projectMatch[2] || "Added from resume update request.").trim(),
        bullets: [
          "Details provided by candidate update request — expand with concrete outcomes before applying.",
        ],
        tech: [],
      },
      ...next.projects,
    ];
  }

  // Bullet add to latest experience: "add bullet: ..."
  const bulletMatch = text.match(/add bullet:\s*(.+)$/im);
  if (bulletMatch && next.experience[0]) {
    next.experience[0].bullets = [
      bulletMatch[1].trim(),
      ...next.experience[0].bullets,
    ].slice(0, 8);
  }

  // Location / contact
  const locationMatch = text.match(/location:\s*(.+)$/im);
  if (locationMatch) next.location = locationMatch[1].trim();
  const phoneMatch = text.match(/phone:\s*(.+)$/im);
  if (phoneMatch) next.phone = phoneMatch[1].trim();
  const emailMatch = text.match(/email:\s*(\S+@\S+)/im);
  if (emailMatch) next.email = emailMatch[1].trim();

  // Generic freeform: if no structured directive matched, append a note to summary
  // rather than inventing experience.
  const structured =
    skillsMatch ||
    lower.includes("summary") ||
    projectMatch ||
    bulletMatch ||
    locationMatch ||
    phoneMatch ||
    emailMatch;
  if (!structured) {
    next.summary = `${next.summary} Update note: ${text}`.slice(0, 700);
  }

  next.updatedAt = new Date().toISOString();
  return next;
}
