"use client";

import { useEffect, useState } from "react";
import { HardDrive, FileText, Briefcase, ClipboardList } from "lucide-react";
import { formatRelative } from "@/lib/format";

type Overview = {
  storage: { label: string; kind: string };
  lastRefreshAt: string | null;
  openJobs: number;
  applications: number;
  hasResume: boolean;
  resumeName: string | null;
  sourceChecks: { ok: boolean }[];
};

export function WorkspaceOverview({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/workspace", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && res.ok) setData(json);
      } catch {
        // keep previous overview
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (!data) return null;

  const reachable = data.sourceChecks.filter((c) => c.ok).length;

  return (
    <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-xl border border-[var(--line)] bg-white/70 px-3 py-3">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
          <Briefcase className="size-3.5" /> Open roles
        </p>
        <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          {data.openJobs}
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          Refresh {formatRelative(data.lastRefreshAt)}
        </p>
      </div>
      <div className="rounded-xl border border-[var(--line)] bg-white/70 px-3 py-3">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
          <ClipboardList className="size-3.5" /> Applications
        </p>
        <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          {data.applications}
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">Tracked in board</p>
      </div>
      <div className="rounded-xl border border-[var(--line)] bg-white/70 px-3 py-3">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
          <FileText className="size-3.5" /> Resume
        </p>
        <p className="mt-1 truncate font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
          {data.hasResume ? data.resumeName || "Loaded" : "Not loaded"}
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          {data.hasResume ? "Ready to tailor" : "Upload or sample"}
        </p>
      </div>
      <div className="rounded-xl border border-[var(--line)] bg-white/70 px-3 py-3">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
          <HardDrive className="size-3.5" /> Storage
        </p>
        <p className="mt-1 truncate font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
          {data.storage.label}
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          {data.sourceChecks.length
            ? `Sources OK ${reachable}/${data.sourceChecks.length}`
            : "Refresh to check sources"}
        </p>
      </div>
    </div>
  );
}
