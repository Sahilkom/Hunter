import type { ResumeData } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

export function ResumePreview({
  resume,
  emptyHint,
}: {
  resume: ResumeData | null;
  emptyHint?: string;
}) {
  if (!resume) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--line)] bg-white/50 px-6 text-center">
        <p className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
          No resume loaded
        </p>
        <p className="mt-2 max-w-sm text-sm text-[var(--muted-foreground)]">
          {emptyHint ?? "Upload a DOCX/TXT resume or load the sample to preview and export PDF."}
        </p>
      </div>
    );
  }

  return (
    <article className="resume-sheet rounded-xl border border-[var(--line)] bg-white p-6 shadow-[0_20px_50px_-32px_rgba(8,45,42,0.45)] sm:p-8">
      <header className="border-b border-[var(--line)] pb-4">
        <h3 className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--teal-ink)]">
          {resume.fullName}
        </h3>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          {[resume.email, resume.phone, resume.location].filter(Boolean).join(" · ")}
        </p>
        {resume.links.length > 0 && (
          <p className="mt-1 text-xs text-[var(--teal)]">{resume.links.join(" · ")}</p>
        )}
      </header>

      {resume.summary && (
        <section className="mt-5">
          <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">
            Summary
          </h4>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">{resume.summary}</p>
        </section>
      )}

      {resume.skills.length > 0 && (
        <section className="mt-5">
          <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">
            Skills
          </h4>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {resume.skills.map((skill) => (
              <Badge
                key={skill}
                variant="secondary"
                className="rounded-md bg-[var(--teal-soft)] text-[var(--teal-ink)]"
              >
                {skill}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {resume.experience.length > 0 && (
        <section className="mt-5">
          <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">
            Experience
          </h4>
          <div className="mt-3 space-y-4">
            {resume.experience.map((exp) => (
              <div key={`${exp.company}-${exp.role}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--ink)]">
                    {exp.role} <span className="font-normal text-[var(--muted-foreground)]">| {exp.company}</span>
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {[exp.start, exp.end].filter(Boolean).join(" – ")}
                  </p>
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--ink)]">
                  {exp.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {resume.projects.length > 0 && (
        <section className="mt-5">
          <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">
            Projects
          </h4>
          <div className="mt-3 space-y-3">
            {resume.projects.map((project) => (
              <div key={project.name}>
                <p className="text-sm font-semibold text-[var(--ink)]">{project.name}</p>
                {project.summary && (
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">{project.summary}</p>
                )}
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--ink)]">
                  {project.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {resume.education.length > 0 && (
        <section className="mt-5">
          <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">
            Education
          </h4>
          <div className="mt-3 space-y-2">
            {resume.education.map((edu) => (
              <div key={`${edu.school}-${edu.degree}`}>
                <p className="text-sm font-semibold text-[var(--ink)]">
                  {edu.degree} <span className="font-normal text-[var(--muted-foreground)]">| {edu.school}</span>
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {[edu.end, edu.details].filter(Boolean).join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
