"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import type { Job, ResumeData } from "@/lib/types";
import { ResumePreview } from "@/components/resume-preview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ResumeTailor({ onChanged }: { onChanged?: () => void }) {
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"upload" | "sample" | "tailor" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [jobQuery, setJobQuery] = useState("");

  const pickable = useMemo(() => {
    const q = jobQuery.trim().toLowerCase();
    const matches = q
      ? jobs.filter((j) =>
          `${j.company} ${j.careerTitle || j.title} ${j.careerJobId ?? ""}`.toLowerCase().includes(q),
        )
      : jobs;
    const list = matches.slice(0, 150);
    const selected = jobs.find((j) => j.id === jobId);
    if (selected && !list.some((j) => j.id === selected.id)) list.unshift(selected);
    return list;
  }, [jobs, jobQuery, jobId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resumeRes, jobsRes] = await Promise.all([
        fetch("/api/resume", { cache: "no-store" }),
        fetch("/api/jobs?includeApplied=1", { cache: "no-store" }),
      ]);
      const resumeData = await resumeRes.json();
      const jobsData = await jobsRes.json();
      if (!resumeRes.ok) throw new Error(resumeData.error || "Failed to load resume");
      if (!jobsRes.ok) throw new Error(jobsData.error || "Failed to load jobs");
      setResume(resumeData.resume);
      setJobs(jobsData.jobs);
      if (!jobId && jobsData.jobs[0]) setJobId(jobsData.jobs[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tailor workspace");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
    // intentionally once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setError(null);
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
      const message = err instanceof Error ? err.message : "Could not load sample";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const tailor = async () => {
    if (!jobId) {
      toast.error("Pick a job first");
      return;
    }
    setBusy("tailor");
    setError(null);
    try {
      const res = await fetch("/api/resume/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tailor failed");
      setResume(data.resume);
      setNote(data.note);
      toast.success("Resume tailored to the selected JD");
      onChanged?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Tailor failed";
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
      a.download = `${(resume?.fullName || "resume").replace(/\s+/g, "_")}_tailored.pdf`;
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
        <p className="text-sm font-medium text-[var(--teal)]">Resume Tailor</p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--ink)]">
          Align to a JD — keep the same format
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)]">
          Upload your resume, pick an opening, and we reorder skills and bullets to match the
          job description. We never invent employers, degrees, or metrics you did not already list.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-white/70 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">
            Target job
          </label>
          <Input
            value={jobQuery}
            onChange={(e) => setJobQuery(e.target.value)}
            placeholder="Filter jobs by company, title or job ID…"
            className="mb-2"
          />
          <Select value={jobId} onValueChange={(value) => setJobId(value ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a job">
                {(value) => {
                  const job = jobs.find((j) => j.id === value);
                  return job
                    ? `${job.company} — ${job.careerTitle || job.title}${job.careerJobId ? ` (${job.careerJobId})` : ""}`
                    : "Select a job";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {pickable.map((job) => (
                <SelectItem key={job.id} value={job.id}>
                  {job.company} — {job.careerTitle || job.title}
                  {job.careerJobId ? ` (${job.careerJobId})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
            {busy === "upload" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Upload resume
          </span>
        </label>
        <Button variant="outline" onClick={() => void loadSample()} disabled={!!busy}>
          {busy === "sample" ? <Loader2 className="size-4 animate-spin" /> : null}
          Load sample
        </Button>
        <Button className="gap-2" onClick={() => void tailor()} disabled={!!busy || !resume}>
          {busy === "tailor" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Tailor to job
        </Button>
        <Button
          variant="secondary"
          className="gap-2"
          onClick={() => void downloadPdf()}
          disabled={!!busy || !resume}
        >
          {busy === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Download PDF
        </Button>
      </div>

      {note && (
        <Alert>
          <AlertTitle>Authentic edits only</AlertTitle>
          <AlertDescription>{note}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not tailor</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Loader2 className="size-4 animate-spin" /> Loading resume workspace…
        </div>
      ) : (
        <ResumePreview resume={resume} />
      )}
    </div>
  );
}
