import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { motion } from "framer-motion";
import { Flame, PartyPopper, Sprout, Sun, Timer, Trees, Zap, Trophy, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SessionTree } from "@/components/ForestTree";
import { LevelBadge } from "@/components/LevelBadge";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { useFocusSessions, useSubjects } from "@/lib/hooks";
import { computeForestStats, weeklyTreeCounts } from "@/lib/forest";
import { parseDayKey, startOfWeekKey } from "@/lib/dates";
import { filterSessionsByContext, useAcademicContext } from "@/lib/academicContext";
import { cn } from "@/lib/utils";
import type { FocusSessionDoc } from "@/lib/schema";

// three.js is heavy, so the 3D scene is split into its own chunk and only
// fetched when the Forest page is opened.
const ForestCanvas = lazy(() => import("@/components/forest/ForestCanvas"));

const MAX_3D_TREES = 120;

const FOREST_TIERS = [
  { count: 1, label: "First sprout" },
  { count: 5, label: "Small grove" },
  { count: 10, label: "Clearing of trees" },
  { count: 25, label: "Young forest" },
  { count: 50, label: "Deep forest" },
  { count: 100, label: "Verdant forest" },
  { count: 250, label: "Ancient forest" },
];

/** Milestones earned by real study — mirrors the badge catalog's tone. */
const MILESTONES: {
  emoji: string;
  label: string;
  hint: string;
  count: number;
  kind?: "trees" | "hours" | "streak";
}[] = [
  { emoji: "🌱", label: "First tree", hint: "Your first focused session", count: 1, kind: "trees" },
  { emoji: "🌿", label: "Growing habit", hint: "5 trees planted", count: 5, kind: "trees" },
  { emoji: "🌳", label: "Young forest", hint: "25 trees planted", count: 25, kind: "trees" },
  { emoji: "🌲", label: "Deep focus", hint: "10 hours of focused study", count: 10, kind: "hours" },
  { emoji: "🌲", label: "Forest keeper", hint: "30-day study streak", count: 30, kind: "streak" },
  { emoji: "🏆", label: "Forest master", hint: "100 completed focus sessions", count: 100, kind: "trees" },
];

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const LEGEND = [
  { color: "text-forest-seed", label: "Wilted — left early" },
  { color: "text-forest-sprout", label: "Sprout — under 25 min" },
  { color: "text-forest-young", label: "Tree — 25–50 min" },
  { color: "text-forest-great", label: "Big tree — 50+ min" },
  { color: "text-forest-milestone", label: "Milestone — 90+ min" },
];

function supportsWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext("webgl2") || c.getContext("webgl"))
    );
  } catch {
    return false;
  }
}

/** 2D fallback scene (also the Suspense placeholder while three.js loads). */
function CssForestScene({ sessions }: { sessions: (FocusSessionDoc & { id: string })[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="relative h-32 bg-gradient-to-b from-sky-300 to-sky-100 px-4 pt-4 dark:from-sky-900 dark:to-sky-950">
        <div className="absolute right-6 top-5 h-10 w-10 rounded-full bg-yellow-300/90 shadow-[0_0_24px_8px_hsl(var(--forest-milestone)/.25)]" aria-hidden />
        <p className="relative font-display text-sm font-semibold text-sky-900/70 dark:text-sky-200/70">
          {sessions.length === 0
            ? "A bare plot, ready for your first tree."
            : `${sessions.length} tree${sessions.length === 1 ? "" : "s"} planted so far.`}
        </p>
      </div>
      <div className="relative min-h-[200px] bg-gradient-to-b from-[#7fbd5a] to-[#4c9a43] px-4 pb-6 pt-3">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Sprout size={40} className="text-forest-seed" />
            <p className="max-w-xs text-sm font-medium text-forest-mature">
              Complete a focus session and a seed will sprout here. Keep going and a forest grows.
            </p>
            <Link to="/focus">
              <Button size="sm" variant="secondary">
                Start your first focus session
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(30px,1fr))] items-end gap-x-2 gap-y-4 sm:grid-cols-[repeat(auto-fit,minmax(36px,1fr))]">
            {sessions.map((session, index) => (
              <div key={session.id} className="flex justify-center">
                <SessionTree session={session} size={30} delay={Math.min(index, 24) * 0.025} className="drop-shadow-[0_3px_2px_hsl(0_0%_0%/.18)]" />
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

export function Forest() {
  const { user, userDoc } = useAuth();
  const sessions = useFocusSessions(200);
  const subjects = useSubjects();
  const { selected } = useAcademicContext();
  const [webgl] = useState(supportsWebGL);
  const [treeTotal, setTreeTotal] = useState(0);

  // Exact lifetime tree count (session list above is a capped sample for the
  // 3D scene, so stats would undercount for very large histories). Only
  // completed sessions plant trees — abandoned ones never enter the forest.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getCountFromServer(
      query(collection(db, "users", user.uid, "focusSessions"), where("completed", "==", true))
    )
      .then((snap) => {
        if (!cancelled) setTreeTotal(snap.data().count);
      })
      .catch(() => {
        if (!cancelled) setTreeTotal(sessions.filter((s) => s.completed).length);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const contextSessions = useMemo(
    () => filterSessionsByContext(sessions, subjects, selected.value),
    [sessions, subjects, selected.value]
  );
  const completedSessions = useMemo(() => contextSessions.filter((s) => s.completed), [contextSessions]);
  const stats = useMemo(() => computeForestStats(completedSessions), [completedSessions]);
  const weeklyCounts = useMemo(() => weeklyTreeCounts(completedSessions), [completedSessions]);
  const weeklyTotal = weeklyCounts.reduce((a, b) => a + b, 0);
  const weeklyMinutes = useMemo(
    () =>
      completedSessions
        .filter((s) => s.date >= startOfWeekKey(new Date()))
        .reduce((a, s) => a + s.focusMinutes, 0),
    [completedSessions]
  );

  const totalTrees = treeTotal > 0 ? treeTotal : stats.totalTrees;
  const xp = userDoc?.xp ?? 0;
  const streak = userDoc?.streakCount ?? 0;
  const longestStreak = userDoc?.longestStreak ?? 0;

  const tier = useMemo(() => {
    const next = FOREST_TIERS.find((t) => t.count > totalTrees);
    const prevCount = [...FOREST_TIERS].reverse().find((t) => t.count <= totalTrees)?.count ?? 0;
    const progress = next ? (totalTrees - prevCount) / (next.count - prevCount) : 1;
    return { next, progress };
  }, [totalTrees]);

  const milestones = useMemo(() => {
    return MILESTONES.map((m) => {
      const reached =
        m.kind === "hours"
          ? stats.focusHours >= m.count
          : m.kind === "streak"
            ? longestStreak >= m.count
            : totalTrees >= m.count;
      return { ...m, reached };
    });
  }, [stats.focusHours, longestStreak, totalTrees]);

  if (!user) return null;

  const sceneSessions = completedSessions.slice(-MAX_3D_TREES);
  const empty = completedSessions.length === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-sidebar p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-10 -right-8 h-40 w-40 rounded-full bg-brand-500/10 blur-2xl"
        />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">Study Forest · {selected.shortLabel}</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">
            Your Study Forest <span aria-hidden>🌳</span>
          </h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            A living record of completed focus sessions in this study context.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="flex items-center gap-1.5 font-medium">
              <Flame size={15} className="text-forest-milestone" /> {streak} day streak
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <Timer size={15} className="text-brand-600" /> {stats.focusHours.toFixed(1)}h focused
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <Trees size={15} className="text-forest-young" /> {totalTrees} trees
            </span>
            <LevelBadge xp={xp} compact />
          </div>
        </div>
        <div className="relative mt-4 flex gap-2">
          <Link to="/focus">
            <Button size="sm">
              <Sprout size={15} /> {empty ? "Plant your first tree" : "Grow a tree"}
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile icon={<Trees size={16} className="text-forest-young" />} label="All-time trees" value={String(totalTrees)} />
        <StatTile icon={<Timer size={16} className="text-brand-600" />} label="Focus time" value={`${stats.focusHours.toFixed(1)}h`} />
        <StatTile icon={<Zap size={16} className="text-brand-600" />} label="Trees this week" value={String(weeklyTotal)} />
        <StatTile icon={<Flame size={16} className="text-forest-milestone" />} label="Longest streak" value={`${longestStreak}d`} />
        <StatTile icon={<Trophy size={16} className="text-achievement" />} label="Total XP" value={String(xp)} />
        <StatTile
          icon={<BookOpen size={16} className="text-brand-600" />}
          label="Favorite subject"
          value={stats.favoriteSubject ?? "—"}
        />
        <StatTile icon={<Sun size={16} className="text-brand-600" />} label="Best day" value={`${stats.bestDay} trees`} />
        <StatTile icon={<PartyPopper size={16} className="text-forest-milestone" />} label="Milestone sessions" value={String(stats.milestones)} />
      </div>

      {/* Forest visualization */}
      {empty ? (
        <Card className="p-8">
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <motion.span
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 16 }}
            >
              <Sprout size={44} className="text-forest-sprout" />
            </motion.span>
            <p className="font-display text-lg font-semibold">This plot is ready.</p>
            <p className="max-w-xs text-sm text-text-secondary">
              Complete a {selected.shortLabel} focus session and plant the first tree in this plot.
            </p>
            <Link to="/focus">
              <Button size="lg">
                <Timer size={16} /> Start 25 min focus
              </Button>
            </Link>
          </div>
        </Card>
      ) : webgl ? (
        <>
          <Suspense fallback={<CssForestScene sessions={sceneSessions} />}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
              <ForestCanvas sessions={sceneSessions} />
            </motion.div>
          </Suspense>
          {sessions.length > MAX_3D_TREES && (
            <p className="text-center text-xs text-text-muted">
              Showing your most recent {MAX_3D_TREES} sessions in 3D — the rest live in your stats.
            </p>
          )}
        </>
      ) : (
        <CssForestScene sessions={sceneSessions} />
      )}

      {/* Weekly growth */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">This week</p>
          <span className="text-xs text-text-muted">
            {weeklyTotal} tree{weeklyTotal === 1 ? "" : "s"} · {(weeklyMinutes / 60).toFixed(1)}h focused
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {weeklyCounts.map((count, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="flex h-10 w-full items-end justify-center rounded-md bg-surface-2/70 pb-1">
                <div className="flex flex-wrap items-end justify-center gap-[1px]">
                  {Array.from({ length: Math.min(count, 8) }).map((_, j) => (
                    <SessionTree
                      key={j}
                      session={lastWeeklySession(completedSessions, i)}
                      size={12}
                      delay={0}
                      className={count === 0 ? "opacity-20" : ""}
                    />
                  ))}
                </div>
              </div>
              <p className={cn("text-[10px]", count > 0 ? "font-medium text-text-primary" : "text-text-muted")}>
                {WEEKDAY_LABELS[i]}
              </p>
            </div>
          ))}
        </div>
        {weeklyTotal === 0 && (
          <p className="mt-2 text-center text-xs text-text-muted">
            No trees yet this week — start a session and your forest grows.
          </p>
        )}
      </Card>

      {/* Milestones */}
      <Card className="p-4">
        <p className="mb-3 text-sm font-semibold">Milestones</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {milestones.map((m) => (
            <div
              key={m.label}
              className={cn(
                "flex items-center gap-2.5 rounded-lg border border-border px-3 py-2",
                m.reached ? "bg-surface-2" : "opacity-60"
              )}
            >
              <span className="text-lg" aria-hidden>
                {m.emoji}
              </span>
              <div className="min-w-0">
                <p className={cn("text-sm font-medium", m.reached && "text-forest-mature")}>{m.label}</p>
                <p className="truncate text-xs text-text-muted">{m.hint}</p>
              </div>
              {m.reached && (
                <CheckIcon className="ml-auto shrink-0 text-success" />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Forest tier progress */}
      <Card className="p-4">
        <div className="mb-1 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Sprout size={15} className="text-brand-600" /> Forest milestone
          </p>
          <span className="text-xs text-text-muted">
            {tier.next
              ? `${tier.next.count - totalTrees} tree${tier.next.count - totalTrees === 1 ? "" : "s"} to ${tier.next.label.toLowerCase()}`
              : "The tallest forest you can grow — keep going."}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-gradient-to-r from-forest-seed via-forest-sprout to-forest-great transition-[width] duration-500"
            style={{ width: `${Math.round(Math.min(1, tier.progress) * 100)}%` }}
          />
        </div>
      </Card>

      <Card className="p-4">
        <p className="mb-2 text-sm font-semibold">What the trees mean</p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {LEGEND.map((l) => (
            <div key={l.label} className="flex items-center gap-2 text-xs text-text-secondary">
              <Sprout size={14} className={cn("shrink-0", l.color)} />
              {l.label}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-text-muted">
          Hover a tree to see which session planted it. Finish a session — it grows; leave early, it
          stays a sprout. Level up for consistent study, and your forest rewards you with rarer
          varieties.
        </p>
      </Card>
    </div>
  );
}

/** Returns a representative session for a weekday (for the weekly mini-trees). */
function lastWeeklySession(
  sessions: (FocusSessionDoc & { id: string })[],
  dayIndex: number
): FocusSessionDoc & { id: string } {
  return sessions.find((s) => new Date(parseDayKey(s.date)).getDay() === (dayIndex + 1) % 7) ?? sessions[0];
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} className={className} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="flex items-center gap-2.5 p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2">{icon}</span>
      <div className="min-w-0">
        <p className="truncate font-numeric text-lg font-semibold tabular">{value}</p>
        <p className="truncate text-[11px] text-text-muted">{label}</p>
      </div>
    </Card>
  );
}
