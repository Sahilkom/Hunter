"use client";

import { useEffect, useState } from "react";
import { HardDrive, FileText, Briefcase, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { formatRelative } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { StorageSettingsDialog } from "@/components/storage-settings";

type Overview = {
  storage: { label: string; kind: string };
  lastRefreshAt: string | null;
  openJobs: number;
  applications: number;
  hasResume: boolean;
  resumeName: string | null;
  sourceChecks: { ok: boolean }[];
};

export function WorkspaceOverview({
  refreshKey = 0,
  onStorageChanged,
}: {
  refreshKey?: number;
  onStorageChanged?: () => void;
}) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storageOpen, setStorageOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/workspace", { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setData(json);
          setError(null);
        } else {
          setError(json.error || "Could not load workspace");
        }
      } catch {
        // keep previous overview
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const drive = url.searchParams.get("drive");
    if (!drive) return;
    if (drive === "connected") {
      toast.success("Google Drive connected. Your data now saves to that folder.");
    } else {
      toast.error(url.searchParams.get("reason") || "Could not connect Google Drive", {
        duration: 15000,
        action: { label: "Open storage", onClick: () => setStorageOpen(true) },
      });
    }
    url.searchParams.delete("drive");
    url.searchParams.delete("reason");
    window.history.replaceState({}, "", url.toString());
  }, []);

  const dialog = (
    <StorageSettingsDialog
      open={storageOpen}
      onOpenChange={setStorageOpen}
      storageLabel={data?.storage.label}
      onChanged={onStorageChanged}
    />
  );

  if (!data) {
    return (
      <>
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Storage problem</AlertTitle>
            <AlertDescription>
              <span className="block">{error}</span>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => setStorageOpen(true)}>
                Open storage settings
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {dialog}
      </>
    );
  }

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
      <button
        type="button"
        onClick={() => setStorageOpen(true)}
        className="rounded-xl border border-[var(--line)] bg-white/70 px-3 py-3 text-left transition hover:border-[var(--teal)]/40 hover:bg-white"
        title="Storage settings"
      >
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
          <HardDrive className="size-3.5" /> Storage
        </p>
        <p className="mt-1 truncate font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
          {data.storage.label}
        </p>
        <p className="text-xs text-[var(--teal-ink)] underline underline-offset-2">
          {data.storage.kind === "drive" ? "Manage Google Drive" : "Save to Google Drive"}
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          {data.sourceChecks.length
            ? `Sources OK ${reachable}/${data.sourceChecks.length}`
            : "Refresh to check sources"}
        </p>
      </button>
      {dialog}
    </div>
  );
}
