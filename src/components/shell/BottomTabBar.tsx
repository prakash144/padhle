import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { Sun, CalendarDays, Timer, BookOpen, ChartNoAxesCombined } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFeatures } from "@/lib/useFeatures";
import type { FeatureKey } from "@/lib/schema";

type Tab = {
  to: string;
  label: string;
  icon: typeof Sun;
  end?: boolean;
  hero?: boolean;
  requires?: FeatureKey[];
};

const tabs: Tab[] = [
  { to: "/", label: "Today", icon: Sun, end: true },
  { to: "/planner", label: "Planner", icon: CalendarDays },
  { to: "/focus", label: "Focus", icon: Timer, hero: true, requires: ["focus"] },
  { to: "/syllabus", label: "Syllabus", icon: BookOpen },
  { to: "/reports", label: "Reports", icon: ChartNoAxesCombined, requires: ["reports"] },
];

export function BottomTabBar() {
  const features = useFeatures();
  const visibleTabs = tabs.filter(
    (t) => !t.requires || t.requires.some((key) => features[key])
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 backdrop-blur-xl md:hidden">
      <ul className="flex items-end justify-between px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2">
        {visibleTabs.map(({ to, label, icon: Icon, end, hero }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "relative flex flex-col items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium text-text-muted transition-colors duration-micro",
                  isActive && "text-brand-600 dark:text-brand-500",
                  hero && "-mt-6"
                )
              }
            >
              {({ isActive }) =>
                hero ? (
                  <motion.span
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_20px_-8px_hsl(var(--primary)/.6)]",
                      isActive && "ring-4 ring-brand-600/20 ring-offset-2 ring-offset-bg"
                    )}
                    aria-hidden
                  >
                    <Icon size={24} />
                  </motion.span>
                ) : (
                  <>
                    <motion.span
                      whileTap={{ scale: 0.85 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                      className="flex items-center justify-center"
                    >
                      <Icon size={20} />
                    </motion.span>
                    {isActive && (
                      <motion.span
                        layoutId="tab-indicator"
                        className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-brand-600 dark:bg-brand-500"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    {label}
                  </>
                )
              }
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
