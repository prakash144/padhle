import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  BookOpen,
  ClipboardCheck,
  NotebookPen,
  LayoutDashboard,
  ChartNoAxesCombined,
  User,
  CircleAlert,
  Inbox,
  ShieldCheck,
  PieChart,
  HelpCircle,
  Sun,
  Timer,
  KanbanSquare,
  Moon,
  CornerDownLeft,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAdmin } from "@/lib/hooks";
import { useFeatures } from "@/lib/useFeatures";
import { useTheme } from "@/lib/useTheme";
import { cn } from "@/lib/utils";
import type { FeatureKey } from "@/lib/schema";

interface Command {
  id: string;
  label: string;
  keywords: string[];
  icon: LucideIcon;
  group: "Navigate" | "Actions";
  run: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const features = useFeatures();
  const isAdmin = useAdmin();
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K anywhere in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  const commands = useMemo<Command[]>(() => {
    const requires: Partial<Record<string, FeatureKey[]>> = {
      sprints: ["sprints"],
      focus: ["focus"],
      tests: ["mocks", "pyqs"],
      notes: ["notes"],
      reports: ["reports"],
      errors: ["errorBook"],
    };

    const allNav: Command[] = [
      { id: "today", label: "Today", keywords: ["home", "day"], icon: Sun, group: "Navigate", run: () => go("/") },
      { id: "planner", label: "Planner", keywords: ["plan", "task", "schedule"], icon: CalendarDays, group: "Navigate", run: () => go("/planner") },
      { id: "sprints", label: "Sprints", keywords: ["challenge", "kanban"], icon: KanbanSquare, group: "Navigate", run: () => go("/sprints") },
      { id: "focus", label: "Focus Timer", keywords: ["pomodoro", "study", "deep work"], icon: Timer, group: "Navigate", run: () => go("/focus") },
      { id: "syllabus", label: "Syllabus", keywords: ["chapters", "subjects", "curriculum"], icon: BookOpen, group: "Navigate", run: () => go("/syllabus") },
      { id: "tests", label: "Tests & PYQs", keywords: ["mock", "test", "pyq", "practice"], icon: ClipboardCheck, group: "Navigate", run: () => go("/tests") },
      { id: "notes", label: "Notes", keywords: ["note", "write", "study"], icon: NotebookPen, group: "Navigate", run: () => go("/notes") },
      { id: "dashboard", label: "Dashboard", keywords: ["overview", "stats"], icon: LayoutDashboard, group: "Navigate", run: () => go("/dashboard") },
      { id: "reports", label: "Reports", keywords: ["retro", "weekly", "pdf"], icon: ChartNoAxesCombined, group: "Navigate", run: () => go("/reports") },
      { id: "analytics", label: "Analytics", keywords: ["charts", "trend"], icon: PieChart, group: "Navigate", run: () => go("/analytics") },
      { id: "profile", label: "Profile", keywords: ["settings", "account", "appearance"], icon: User, group: "Navigate", run: () => go("/profile") },
      { id: "errors", label: "Mistake Log", keywords: ["mistake", "error", "review", "wrong"], icon: CircleAlert, group: "Navigate", run: () => go("/errors") },
      { id: "backlog", label: "Backlog", keywords: ["later", "someday"], icon: Inbox, group: "Navigate", run: () => go("/backlog") },
      { id: "help", label: "How to use", keywords: ["help", "guide", "tips"], icon: HelpCircle, group: "Navigate", run: () => go("/help") },
      { id: "admin", label: "Admin dashboard", keywords: ["admin"], icon: ShieldCheck, group: "Navigate", run: () => go("/admin") },
    ];
    const nav = allNav
      .filter((c) => c.id !== "admin" || isAdmin)
      .filter((c) => {
        const req = requires[c.id];
        return !req || req.some((key) => features[key]);
      });

    const actions: Command[] = [
      { id: "start-focus", label: "Start a focus session", keywords: ["pomodoro", "timer", "start"], icon: Timer, group: "Actions", run: () => go("/focus") },
      { id: "add-task", label: "Add a task for today", keywords: ["plan", "create", "todo"], icon: CalendarDays, group: "Actions", run: () => go("/planner") },
      { id: "log-mistake", label: "Log a mistake", keywords: ["error", "review", "wrong"], icon: CircleAlert, group: "Actions", run: () => go("/errors") },
      { id: "toggle-theme", label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode", keywords: ["theme", "dark", "light", "appearance"], icon: theme === "dark" ? Sun : Moon, group: "Actions", run: () => { toggleTheme(); onOpenChange(false); } },
    ];

    return [...actions, ...nav];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- closures capture onOpenChange/toggleTheme intentionally
  }, [features, isAdmin, theme, navigate]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? commands.filter(
          (c) => c.label.toLowerCase().includes(q) || c.keywords.some((k) => k.includes(q))
        )
      : commands;
  }, [query, commands]);

  const groups = useMemo(() => {
    const out: { name: string; items: Command[] }[] = [];
    for (const g of ["Actions", "Navigate"] as const) {
      const items = results.filter((r) => r.group === g);
      if (items.length) out.push({ name: g, items });
    }
    return out;
  }, [results]);

  const flat = groups.flatMap((g) => g.items);
  const active = Math.min(index, Math.max(0, flat.length - 1));

  const runAt = (i: number) => flat[i]?.run();

  useEffect(() => setIndex(0), [query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg p-0"
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setIndex((i) => (flat.length ? (i + 1) % flat.length : 0));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIndex((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            runAt(active);
          }
        }}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border px-4">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages and actions…"
            className="h-12 w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
          <kbd className="shrink-0 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
            ESC
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {flat.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-text-secondary">
              No matches for “{query}”.
            </p>
          )}
          {groups.map((g) => (
            <div key={g.name} className="mb-1">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                {g.name}
              </p>
              {g.items.map((c, i) => {
                const flatIndex = groups
                  .slice(0, groups.indexOf(g))
                  .reduce((n, x) => n + x.items.length, 0) + i;
                const selected = flatIndex === active;
                return (
                  <button
                    key={c.id}
                    onClick={() => c.run()}
                    onMouseEnter={() => setIndex(flatIndex)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm",
                      selected ? "bg-surface-2 text-text-primary" : "text-text-secondary"
                    )}
                  >
                    <c.icon size={16} className={cn("shrink-0", selected && "text-brand-600")} />
                    <span className="flex-1 truncate">{c.label}</span>
                    {selected && <CornerDownLeft size={13} className="shrink-0 text-text-muted" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
