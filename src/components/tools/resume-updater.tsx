"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, PenLine, Upload } from "lucide-react";
import { toast } from "sonner";
import type { ResumeData } from "@/lib/types";
import { ResumePreview } from "@/components/resume-preview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const EXAMPLES = [
  "add skills: Go, Kafka, System Design",
  "add bullet: Shipped onboarding checklist that cut support tickets by 15%.",
  "add project: CampusMesh — realtime campus map for event wayfinding",
  "append to summary: Comfortable pairing with PMs on early-career product squads.",
];

export function ResumeUpdater({ onChanged }: { onChanged?: () => void }) {
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [request, setRequest] = useState(EXAMPLES[0]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"upload" | "sample" | "update" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/resume", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load resume");
      setResume(data.resume);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load resume");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (file: File) => {
    setBusy("upload");
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/resume/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setResume(data.resume);
      toast.success(`Loaded ${file.name}`);
      onChanged?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const loadSample = async () => {
    setBusy("sample");
    try {
      const res = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sample" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load sample");
      setResume(data.resume);
      toast.success("Sample resume loaded");
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load sample");
    } finally {
      setBusy(null);
    }
  };

  const applyUpdate = async () => {
    setBusy("update");
    setError(null);
    try {
      const res = await fetch("/api/resume/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setResume(data.resume);
      setHint(data.hint);
      toast.success("Resume updated in the same format");
      onChanged?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Update failed";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const downloadPdf = async () => {
    setBusy("pdf");
    try {
      const res = await fetch("/api/resume/pdf", { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "PDF failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(resume?.fullName || "resume").replace(/\s+/g, "_")}_updated.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-[var(--teal)]">Resume Updater</p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--ink)]">
          Freeform edits, same visual format
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)]">
          Describe the change you want — skills, projects, bullets, contact details — and we
          apply it to the shared resume document used across Tailor and PDF export.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-[var(--line)] bg-white/70 p-4">
          <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">
            Update request
          </label>
          <Textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            rows={6}
            placeholder="add skills: TypeScript, PostgreSQL"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setRequest(example)}
                className="rounded-md border border-[var(--line)] bg-white px-2.5 py-1 text-left text-xs text-[var(--muted-foreground)] transition hover:border-[var(--teal)]/40 hover:text-[var(--ink)]"
              >
                {example}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer">
              <input
                type="file"
                accept=".docx,.txt,.json,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                  e.target.value = "";
                }}
              />
              <span className="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted">
                {busy === "upload" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Upload
              </span>
            </label>
            <Button variant="outline" onClick={() => void loadSample()} disabled={!!busy}>
              Load sample
            </Button>
            <Button className="gap-2" onClick={() => void applyUpdate()} disabled={!!busy || !request.trim()}>
              {busy === "update" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <PenLine className="size-4" />
              )}
              Apply update
            </Button>
            <Button
              variant="secondary"
              className="gap-2"
              onClick={() => void downloadPdf()}
              disabled={!!busy || !resume}
            >
              {busy === "pdf" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Download PDF
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--teal-soft)]/60 p-4 text-sm text-[var(--teal-ink)]">
          <p className="font-medium">How updates stay authentic</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[var(--ink)]/80">
            <li>Skills and projects are only added when you explicitly request them.</li>
            <li>We do not invent employers, degrees, or unverified metrics.</li>
            <li>PDF export uses the same teal sheet layout as Resume Tailor.</li>
          </ul>
          {hint && <p className="mt-3 text-xs text-[var(--muted-foreground)]">{hint}</p>}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Update failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Loader2 className="size-4 animate-spin" /> Loading resume…
        </div>
      ) : (
        <ResumePreview resume={resume} />
      )}
    </div>
  );
}
