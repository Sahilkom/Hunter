"use client";

import { useEffect, useState } from "react";
import {
  BriefcaseBusiness,
  ClipboardList,
  FilePenLine,
  Sparkles,
  Menu,
} from "lucide-react";
import { JobFinder } from "@/components/tools/job-finder";
import { ResumeTailor } from "@/components/tools/resume-tailor";
import { ResumeUpdater } from "@/components/tools/resume-updater";
import { ApplicationTracker } from "@/components/tools/application-tracker";
import { WorkspaceOverview } from "@/components/workspace-overview";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { isToolId, type ToolId } from "@/lib/types";

const TOOLS = [
  {
    id: "finder" as const,
    label: "Job Finder",
    description: "Daily SE openings",
    icon: BriefcaseBusiness,
  },
  {
    id: "tailor" as const,
    label: "Resume Tailor",
    description: "Align to a JD",
    icon: Sparkles,
  },
  {
    id: "updater" as const,
    label: "Resume Updater",
    description: "Freeform edits",
    icon: FilePenLine,
  },
  {
    id: "tracker" as const,
    label: "Tracker",
    description: "Status board",
    icon: ClipboardList,
  },
];

function readToolFromUrl(): ToolId {
  if (typeof window === "undefined") return "finder";
  const params = new URLSearchParams(window.location.search);
  const tool = params.get("tool");
  return isToolId(tool) ? tool : "finder";
}

function NavList({
  active,
  onSelect,
}: {
  active: ToolId;
  onSelect: (id: ToolId) => void;
}) {
  return (
    <nav className="space-y-1">
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        const isActive = active === tool.id;
        return (
          <button
            key={tool.id}
            type="button"
            onClick={() => onSelect(tool.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition",
              isActive
                ? "bg-[var(--teal)] text-white shadow-[0_12px_30px_-18px_rgba(8,90,82,0.9)]"
                : "text-[var(--ink)] hover:bg-white/70",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span>
              <span className="block text-sm font-medium">{tool.label}</span>
              <span
                className={cn(
                  "block text-xs",
                  isActive ? "text-white/80" : "text-[var(--muted-foreground)]",
                )}
              >
                {tool.description}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export function AppShell() {
  const [active, setActive] = useState<ToolId>("finder");
  const [trackerToken, setTrackerToken] = useState(0);
  const [overviewKey, setOverviewKey] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setActive(readToolFromUrl());
    const onPop = () => setActive(readToolFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const select = (id: ToolId) => {
    setActive(id);
    setMobileOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set("tool", id);
    window.history.pushState({}, "", url.toString());
  };

  const bumpOverview = () => setOverviewKey((n) => n + 1);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 app-atmosphere" aria-hidden />
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-[var(--line)] bg-white/55 px-4 py-6 backdrop-blur-md lg:flex">
          <div className="px-2">
            <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--teal-ink)]">
              Hunter Memory
            </p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              One workspace for finding, tailoring, updating, and tracking.
            </p>
          </div>
          <div className="mt-8 flex-1">
            <NavList active={active} onSelect={select} />
          </div>
          <p className="px-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
            India · Software Engineer · 0–2 YOE
          </p>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[var(--line)] bg-white/75 px-4 py-3 backdrop-blur-md lg:hidden">
            <div>
              <p className="font-[family-name:var(--font-display)] text-lg text-[var(--teal-ink)]">
                Hunter Memory
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">Job hunting workspace</p>
            </div>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background"
                aria-label="Open tools"
              >
                <Menu className="size-4" />
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] bg-[var(--canvas)]">
                <SheetHeader>
                  <SheetTitle className="font-[family-name:var(--font-display)] text-[var(--teal-ink)]">
                    Tools
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-4 px-2">
                  <NavList active={active} onSelect={select} />
                </div>
              </SheetContent>
            </Sheet>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <WorkspaceOverview refreshKey={overviewKey} />
            <div key={active} className="tool-panel animate-in">
              {active === "finder" && (
                <JobFinder
                  onMarkedApplied={() => {
                    setTrackerToken((n) => n + 1);
                    bumpOverview();
                  }}
                  onRefreshed={bumpOverview}
                />
              )}
              {active === "tailor" && <ResumeTailor onChanged={bumpOverview} />}
              {active === "updater" && <ResumeUpdater onChanged={bumpOverview} />}
              {active === "tracker" && (
                <ApplicationTracker refreshToken={trackerToken} onChanged={bumpOverview} />
              )}
            </div>
          </main>
        </div>
      </div>
      <Toaster richColors position="top-center" />
    </div>
  );
}
