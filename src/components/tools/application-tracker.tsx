"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, Kanban, Loader2, Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Application, ApplicationStatus, Job } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";
import { formatRelative } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Row = Application & { job: Job | null };

const BOARD_ORDER: ApplicationStatus[] = [
  "wishlist",
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
];

export function ApplicationTracker({
  refreshToken = 0,
  onChanged,
}: {
  refreshToken?: number;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [defaultEmail, setDefaultEmail] = useState("");
  const [drafts, setDrafts] = useState<
    Record<string, { notes: string; notifyEmail: string }>
  >({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appsRes, workspaceRes] = await Promise.all([
        fetch("/api/applications", { cache: "no-store" }),
        fetch("/api/workspace", { cache: "no-store" }),
      ]);
      const data = await appsRes.json();
      const workspace = await workspaceRes.json();
      if (!appsRes.ok) throw new Error(data.error || "Failed to load applications");
      setRows(data.applications);
      setLastRefreshAt(data.lastRefreshAt);
      if (workspaceRes.ok) setDefaultEmail(workspace.defaultNotifyEmail ?? "");
      const nextDrafts: Record<string, { notes: string; notifyEmail: string }> = {};
      for (const app of data.applications as Row[]) {
        nextDrafts[app.id] = {
          notes: app.notes,
          notifyEmail: app.notifyEmail || (workspace.defaultNotifyEmail ?? ""),
        };
      }
      setDrafts(nextDrafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load applications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const counts = useMemo(() => {
    const map = Object.fromEntries(BOARD_ORDER.map((s) => [s, 0])) as Record<
      ApplicationStatus,
      number
    >;
    for (const row of rows) map[row.status] += 1;
    return map;
  }, [rows]);

  const patch = async (
    id: string,
    patchBody: Partial<{ status: ApplicationStatus; notes: string; notifyEmail: string }>,
  ) => {
    setSavingId(id);
    try {
      const res = await fetch("/api/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patchBody }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setRows((prev) =>
        prev
          .map((row) => (row.id === id ? { ...row, ...data.application } : row))
          .sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          ),
      );
      toast.success("Application updated");
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (id: string) => {
    const row = rows.find((r) => r.id === id);
    const label = row?.job ? `${row.job.company} — ${row.job.careerTitle || row.job.title}` : "this application";
    if (!window.confirm(`Remove ${label} from the tracker?`)) return;
    setSavingId(id);
    try {
      const res = await fetch(`/api/applications?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setRows((prev) => prev.filter((r) => r.id !== id));
      const jobId = row?.jobId;
      toast.success("Removed from tracker. The job is back in Job Finder.", {
        action: jobId
          ? {
              label: "Hide it there too",
              onClick: () =>
                void fetch("/api/jobs", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ dismiss: jobId }),
                }).then(() => onChanged?.()),
            }
          : undefined,
      });
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSavingId(null);
    }
  };

  const saveDefaultEmail = async () => {
    try {
      const res = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultNotifyEmail: defaultEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save default email");
      toast.success("Default notify email saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save default email");
    }
  };

  const exportCsv = () => {
    window.location.href = "/api/applications/export";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--teal)]">Application Tracker</p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--ink)]">
            Status board that stays in sync
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)]">
            Track applied roles, screening, interviews, and outcomes. Optional email is stored
            for future notifications — inbox scraping is out of scope until credentials are
            provided. Job Finder refresh timestamps appear here too.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <p className="text-xs text-[var(--muted-foreground)]">
            Job catalog refresh {formatRelative(lastRefreshAt)}
          </p>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={exportCsv}>
            <Download className="size-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-white/70 p-4">
        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
          <Mail className="size-3.5" /> Default notify email (optional, future)
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            value={defaultEmail}
            onChange={(e) => setDefaultEmail(e.target.value)}
            placeholder="you@email.com"
          />
          <Button variant="secondary" onClick={() => void saveDefaultEmail()}>
            Save default
          </Button>
        </div>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">
          Prefills new application rows. Inbox scraping stays off until credentials are provided.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {BOARD_ORDER.map((status) => (
          <div
            key={status}
            className="rounded-xl border border-[var(--line)] bg-white/70 px-3 py-3"
          >
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              {STATUS_LABELS[status]}
            </p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
              {counts[status]}
            </p>
          </div>
        ))}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Tracker error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Loader2 className="size-4 animate-spin" /> Loading applications…
        </div>
      ) : rows.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--line)] bg-white/50 px-6 text-center">
          <Kanban className="size-8 text-[var(--teal)]" />
          <p className="mt-3 font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
            No applications yet
          </p>
          <p className="mt-1 max-w-md text-sm text-[var(--muted-foreground)]">
            Mark a role as applied in Job Finder to start your board. Statuses, notes, and an
            optional notification email live here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-[var(--line)] bg-white/80 p-4 sm:p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
                      {row.job?.careerTitle || row.job?.title || "Unknown role"}
                    </h3>
                    {row.job?.careerJobId ? (
                      <Badge variant="outline" className="font-mono text-[11px] tracking-tight">
                        Job ID {row.job.careerJobId}
                      </Badge>
                    ) : null}
                    <Badge variant="outline">{STATUS_LABELS[row.status]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-[var(--teal-ink)]">
                    {row.job?.company ?? "Company unavailable"} ·{" "}
                    {row.job?.location ?? "Location n/a"}
                  </p>
                  <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                    Updated {formatRelative(row.updatedAt)}
                    {row.appliedAt ? ` · applied ${formatRelative(row.appliedAt)}` : ""}
                  </p>
                </div>
                <div className="w-full max-w-xs">
                  <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">
                    Status
                  </label>
                  <Select
                    value={row.status}
                    onValueChange={(value) => {
                      if (!value) return;
                      void patch(row.id, { status: value as ApplicationStatus });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(value) =>
                          STATUS_LABELS[value as ApplicationStatus] ?? "Status"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {BOARD_ORDER.map((status) => (
                        <SelectItem key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">
                    Notes
                  </label>
                  <Textarea
                    rows={3}
                    value={drafts[row.id]?.notes ?? ""}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [row.id]: {
                          notes: e.target.value,
                          notifyEmail: prev[row.id]?.notifyEmail ?? "",
                        },
                      }))
                    }
                    placeholder="Recruiter name, referral, next steps…"
                  />
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
                    <Mail className="size-3.5" /> Notify email (optional, future)
                  </label>
                  <Input
                    type="email"
                    value={drafts[row.id]?.notifyEmail ?? ""}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [row.id]: {
                          notes: prev[row.id]?.notes ?? "",
                          notifyEmail: e.target.value,
                        },
                      }))
                    }
                    placeholder="you@email.com"
                  />
                  <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                    Stored locally for a future notification pass — no inbox access in v1.
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={savingId === row.id}
                  onClick={() =>
                    void patch(row.id, {
                      notes: drafts[row.id]?.notes ?? "",
                      notifyEmail: drafts[row.id]?.notifyEmail ?? "",
                    })
                  }
                >
                  {savingId === row.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  Save notes
                </Button>
                {row.job?.applyUrl ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    nativeButton={false}
                    render={<a href={row.job.applyUrl} target="_blank" rel="noreferrer" />}
                  >
                    {row.job.origin === "live" || row.job.directLink ? "View job" : "Career page"}
                    <ExternalLink className="size-3.5" />
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-destructive"
                  disabled={savingId === row.id}
                  onClick={() => void remove(row.id)}
                >
                  <Trash2 className="size-3.5" /> Remove
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
