import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { SideNav } from "./SideNav";
import { BottomTabBar } from "./BottomTabBar";
import { TopBar } from "./TopBar";
import { AppFooter } from "./AppFooter";
import { Confetti } from "@/components/Confetti";
import { BadgeUnlockToast } from "@/components/BadgeUnlockToast";
import { ConnectivityBanner } from "@/components/ConnectivityBanner";
import { CommandPalette } from "@/components/CommandPalette";
import { useGamificationSync } from "@/lib/useGamificationSync";

const SIDEBAR_KEY = "padhle:sidebar-collapsed";

export function AppShell() {
  const { unlockedBadge, dismissBadge, confettiTrigger } = useGamificationSync();
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(SIDEBAR_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      // storage unavailable — collapse just won't persist across reloads.
    }
  }, [sidebarCollapsed]);

  // Prefetch the most-visited route chunks once the browser is idle so
  // navigating to Planner/Syllabus/Reports/etc. feels instant instead of
  // showing a Suspense spinner while the chunk downloads.
  useEffect(() => {
    const prefetch = () => {
      const loaders = [
        import("@/pages/Planner"),
        import("@/pages/Syllabus"),
        import("@/pages/Focus"),
        import("@/pages/Dashboard"),
        import("@/pages/Reports"),
        import("@/pages/Backlog"),
        import("@/pages/Profile"),
      ];
      loaders.forEach((p) => p.catch(() => undefined));
    };
    const id = (window as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
      ? (window as { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(prefetch)
      : window.setTimeout(prefetch, 1500);
    return () => {
      if (typeof id === "number") window.clearTimeout(id);
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-bg">
      <SideNav collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((c) => !c)} />
      <div className="flex min-h-screen flex-1 flex-col">
        <TopBar onOpenPalette={() => setPaletteOpen(true)} />
        <ConnectivityBanner />
        <main className="flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-8">
          {/* Keyed fade-in only (no AnimatePresence exit): with `exit`
              animations, <Outlet /> re-resolves to the *new* page during the
              exit, so the old page visually swaps and the fade double-fires. */}
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </main>
        <AppFooter />
        <BottomTabBar />
      </div>
      <Confetti trigger={confettiTrigger} />
      <BadgeUnlockToast badge={unlockedBadge} onDismiss={dismissBadge} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
