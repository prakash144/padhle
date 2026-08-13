import { NavLink } from "react-router-dom";
import {
  Sun,
  CalendarDays,
  KanbanSquare,
  Timer,
  BookOpen,
  ClipboardCheck,
  NotebookPen,
  LayoutDashboard,
  ChartNoAxesCombined,
  CircleAlert,
  Inbox,
  ShieldCheck,
  PieChart,
  HelpCircle,
  Trees,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdmin } from "@/lib/hooks";
import { useFeatures } from "@/lib/useFeatures";
import type { FeatureKey } from "@/lib/schema";

const groups = [
  {
    label: "Learn",
    items: [
      { to: "/", label: "Today", icon: Sun, end: true },
      { to: "/planner", label: "Planner", icon: CalendarDays },
      { to: "/syllabus", label: "Syllabus", icon: BookOpen },
      { to: "/backlog", label: "Backlog", icon: Inbox },
    ],
  },
  {
    label: "Practice",
    items: [
      { to: "/sprints", label: "Sprints", icon: KanbanSquare, requires: ["sprints"] },
      { to: "/focus", label: "Focus Timer", icon: Timer, requires: ["focus"] },
      { to: "/tests", label: "Tests & PYQs", icon: ClipboardCheck, requires: ["mocks", "pyqs"] },
      { to: "/notes", label: "Notes", icon: NotebookPen, requires: ["notes"] },
    ],
  },
  {
    label: "Progress",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/reports", label: "Reports", icon: ChartNoAxesCombined, requires: ["reports"] },
      { to: "/analytics", label: "Analytics", icon: PieChart },
      { to: "/forest", label: "Study Forest", icon: Trees, requires: ["forest"] },
    ],
  },
  {
    label: "More",
    items: [
      { to: "/errors", label: "Mistake Log", icon: CircleAlert, requires: ["errorBook"] },
      { to: "/help", label: "How to use", icon: HelpCircle },
    ],
  },
  {
    label: "Admin",
    items: [{ to: "/admin", label: "Admin dashboard", icon: ShieldCheck }],
  },
] as const;

function itemHidden(
  item: { label: string; requires?: readonly FeatureKey[] },
  features: Record<FeatureKey, boolean>
) {
  if (!item.requires || item.requires.length === 0) return false;
  // "requires" means: show if ANY of these features is enabled.
  return !item.requires.some((key) => features[key]);
}

export function SideNav({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const isAdmin = useAdmin();
  const features = useFeatures();
  const visibleGroups = (isAdmin ? groups : groups.filter((g) => g.label !== "Admin"))
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !itemHidden(item, features)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-border bg-sidebar py-4 transition-[width] duration-300 ease-in-out md:flex",
        collapsed ? "w-[68px] px-2" : "w-60 px-4"
      )}
    >
      <div className={cn("flex", collapsed ? "justify-center" : "justify-end")}>
        <button
          onClick={onToggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors duration-micro hover:bg-surface-2 hover:text-text-primary"
          )}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>
      {visibleGroups.map((group) => (
        <div key={group.label} className={cn(!collapsed && "mt-5", collapsed && "mt-4")}>
          {!collapsed && (
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
              {group.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const { to, label, icon: Icon } = item;
              const end = "end" in item ? item.end : undefined;
              return (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    title={collapsed ? label : undefined}
                    className={({ isActive }) =>
                      cn(
                        "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors duration-micro hover:bg-surface-2 hover:text-text-primary",
                        collapsed && "justify-center px-0",
                        isActive &&
                          "bg-nav-active text-nav-active-fg hover:bg-nav-active hover:text-nav-active-fg"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span
                            aria-hidden
                            className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-500"
                          />
                        )}
                        <Icon size={18} strokeWidth={2} className="shrink-0" />
                        {!collapsed && <span>{label}</span>}
                      </>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="flex-1" />
    </aside>
  );
}
