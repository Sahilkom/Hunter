"use client";

import { useEffect, useState } from "react";
import { ExternalLink, HardDrive, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type DriveStatus = {
  oauthConfigured: boolean;
  connected: boolean;
  via: "cookie" | "env" | null;
  folderId: string | null;
  folderName: string | null;
  folderUrl: string | null;
  fileName: string;
  renderDisk: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storageLabel?: string;
  onChanged?: () => void;
};

export function StorageSettingsDialog({ open, onOpenChange, storageLabel, onChanged }: Props) {
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [folder, setFolder] = useState("");
  const [busy, setBusy] = useState<"switch" | "disconnect" | null>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/drive", { cache: "no-store" });
        const data = (await res.json()) as DriveStatus;
        if (!cancelled) {
          setStatus(data);
          setFolder(data.folderUrl ?? "");
        }
      } catch {
        if (!cancelled) setStatus(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const connect = () => {
    if (!folder.trim()) {
      toast.error("Paste the link of a Google Drive folder first.");
      return;
    }
    const target = new URL("/api/drive/connect", window.location.origin);
    target.searchParams.set("folder", folder.trim());
    window.location.assign(target.toString());
  };

  const switchFolder = async () => {
    setBusy("switch");
    try {
      const res = await fetch("/api/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not switch folder");
      setStatus((prev) => (prev ? { ...prev, ...data, connected: true } : prev));
      toast.success(`Now saving to Drive folder “${data.folderName}”`);
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not switch folder");
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    try {
      const res = await fetch("/api/drive", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not disconnect");
      setStatus((prev) =>
        prev && !data.envStillConfigured
          ? { ...prev, connected: false, via: null, folderId: null, folderName: null, folderUrl: null }
          : prev,
      );
      toast.success("Google Drive disconnected. Your data stays in the Drive folder.");
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not disconnect");
    } finally {
      setBusy(null);
    }
  };

  const connectedHere = status?.connected && status.via === "cookie";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="size-4" /> Storage
          </DialogTitle>
          <DialogDescription>
            Save jobs, applications, your resume and filters to a Google Drive folder so they
            survive redeploys on Render.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded-lg border border-[var(--line)] bg-white/60 px-3 py-2">
            <p className="text-xs text-[var(--muted-foreground)]">Currently saving to</p>
            <p className="font-medium text-[var(--ink)]">{storageLabel ?? "…"}</p>
            {status?.folderUrl && (
              <a
                href={status.folderUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--teal-ink)] underline underline-offset-2"
              >
                Open folder ({status.fileName}) <ExternalLink className="size-3" />
              </a>
            )}
            {status && !status.connected && !status.renderDisk && (
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                On Render&apos;s free plan this local file is wiped on every deploy or restart.
              </p>
            )}
          </div>

          {status && !status.oauthConfigured && (
            <Alert>
              <AlertTitle>Google sign-in needs a one-time server setup</AlertTitle>
              <AlertDescription>
                <span className="block">
                  Create an OAuth client (Web application) in Google Cloud Console, enable the Google
                  Drive API, and add this redirect URI:
                </span>
                <code className="mt-1 block select-all break-all rounded border border-[var(--line)] bg-white px-1.5 py-1 font-mono text-xs text-[var(--ink)]">
                  {origin}/api/drive/callback
                </code>
              </AlertDescription>
            </Alert>
          )}

          {status?.via === "env" && (
            <p className="text-xs text-[var(--muted-foreground)]">
              This server is pinned to a Drive folder through GOOGLE_DRIVE_FOLDER_ID, so every browser
              uses it. Connecting here overrides it for this browser only.
            </p>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">
              Google Drive folder link
            </label>
            <Input
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/…"
            />
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Create an empty folder in Drive, open it, and copy the URL from the address bar. Data is
              stored as {status?.fileName ?? "hunter-memory-store.json"} inside it. If the folder is
              empty, your current data is copied there on first save.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {connectedHere ? (
              <>
                <Button onClick={() => void switchFolder()} disabled={busy !== null} className="gap-2">
                  {busy === "switch" && <Loader2 className="size-4 animate-spin" />}
                  Use this folder
                </Button>
                <Button variant="outline" onClick={connect} disabled={busy !== null}>
                  Reconnect Google account
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => void disconnect()}
                  disabled={busy !== null}
                  className="gap-2 text-[var(--muted-foreground)]"
                >
                  {busy === "disconnect" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <LogOut className="size-4" />
                  )}
                  Disconnect
                </Button>
              </>
            ) : (
              <Button onClick={connect} disabled={!status?.oauthConfigured} className="gap-2">
                <HardDrive className="size-4" /> Connect Google Drive
              </Button>
            )}
          </div>

          <p className="text-xs text-[var(--muted-foreground)]">
            The connection is remembered in this browser. On another device, open Storage and connect
            the same folder to see the same data.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
