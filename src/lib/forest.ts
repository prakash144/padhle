import type { FocusSessionDoc } from "@/lib/schema";
import { startOfWeekKey, weekDayIndex } from "@/lib/dates";

/**
 * The "Study Forest" is intentionally not a separate collection — every
 * focusSessions doc already records what we need (completed, planned vs
 * actual minutes), so a tree is just a small view over data we're already
 * writing. Forest-app style: finish the session, the tree grows; give up
 * early, it wilts.
 */
export type TreeStage = "wilted" | "sprout" | "tree" | "big-tree";

export function treeStage(session: Pick<FocusSessionDoc, "completed" | "focusMinutes" | "plannedMinutes">): TreeStage {
  if (!session.completed) {
    const ratio = session.plannedMinutes > 0 ? session.focusMinutes / session.plannedMinutes : 0;
    return ratio >= 0.5 ? "sprout" : "wilted";
  }
  if (session.plannedMinutes <= 25) return "sprout";
  if (session.plannedMinutes <= 50) return "tree";
  return "big-tree";
}

export const TREE_EMOJI: Record<TreeStage, string> = {
  wilted: "🥀",
  sprout: "🌱",
  tree: "🌳",
  "big-tree": "🌲",
};

export function treeEmoji(session: Pick<FocusSessionDoc, "completed" | "focusMinutes" | "plannedMinutes">): string {
  return TREE_EMOJI[treeStage(session)];
}

// ---------------------------------------------------------------------------
// Live growth (during a focus session)
// ---------------------------------------------------------------------------

/**
 * How a tree looks at a given point during a session, keyed off the fraction
 * of the planned focus time completed (0 → 1). The last threshold is
 * intentionally just under 1 so the "fully grown" celebration only fires at
 * 100%.
 */
export type GrowthStage = "seed" | "sprout" | "young" | "mature" | "full";

export const GROWTH_ORDER: GrowthStage[] = ["seed", "sprout", "young", "mature", "full"];

export function growthStage(progress: number): GrowthStage {
  if (progress <= 0.1) return "seed";
  if (progress <= 0.4) return "sprout";
  if (progress <= 0.7) return "young";
  if (progress <= 0.99) return "mature";
  return "full";
}

export const GROWTH_LABEL: Record<GrowthStage, string> = {
  seed: "Seed",
  sprout: "Sprout",
  young: "Young tree",
  mature: "Mature tree",
  full: "Fully grown",
};

// ---------------------------------------------------------------------------
// Tree variety — a subtle personality per subject, not a game-collectible
// ---------------------------------------------------------------------------

export type TreeVariety = "pine" | "oak" | "birch" | "palm";

const SUBJECT_VARIETY: [RegExp, TreeVariety][] = [
  [/math|maths|mathematics|ganit|physics|bhautik/i, "pine"],
  [/chem|chemistry|rasayan/i, "birch"],
  [/bio|biology|jeev/i, "oak"],
  [/sst|social|history|geography|civics|economics/i, "oak"],
  [/eng|english/i, "birch"],
];

/** Picks a stable variety for a subject; unknown subjects get a calm default. */
export function varietyForSubject(subjectName?: string): TreeVariety {
  if (!subjectName) return "oak";
  const match = SUBJECT_VARIETY.find(([re]) => re.test(subjectName));
  return match ? match[1] : "oak";
}

export const VARIETY_EMOJI: Record<TreeVariety, string> = {
  pine: "🌲",
  oak: "🌳",
  birch: "🌿",
  palm: "🌴",
};

export function sessionVariety(session: { subjectName?: string }): TreeVariety {
  return varietyForSubject(session.subjectName);
}

// ---------------------------------------------------------------------------
// Forest stats — derived from the session list (single source of truth)
// ---------------------------------------------------------------------------

export interface ForestStats {
  totalTrees: number;
  treesThisWeek: number;
  focusMinutes: number;
  focusHours: number;
  milestones: number; // completed 90+ min sessions
  bestDay: number; // most trees planted in any single day
  favoriteSubject: string | null; // most-studied subject by focus minutes
  mostProductiveDay: string | null; // YYYY-MM-DD with the most focus minutes
}

export function computeForestStats(sessions: (FocusSessionDoc & { id: string })[]): ForestStats {
  const totalTrees = sessions.length;
  const focusMinutes = sessions.reduce((sum, s) => sum + s.focusMinutes, 0);
  const milestones = sessions.filter((s) => s.focusMinutes >= 90).length;

  const treesByDay = new Map<string, number>();
  const minutesByDay = new Map<string, number>();
  const minutesBySubject = new Map<string, number>();
  const weekStart = startOfWeekKey(new Date());
  let treesThisWeek = 0;

  for (const s of sessions) {
    treesByDay.set(s.date, (treesByDay.get(s.date) ?? 0) + 1);
    minutesByDay.set(s.date, (minutesByDay.get(s.date) ?? 0) + s.focusMinutes);
    const subject = s.subjectName ?? "General";
    minutesBySubject.set(subject, (minutesBySubject.get(subject) ?? 0) + s.focusMinutes);
    if (s.date >= weekStart) treesThisWeek += 1;
  }

  let bestDay = 0;
  treesByDay.forEach((n) => (bestDay = Math.max(bestDay, n)));

  let mostProductiveDay: string | null = null;
  let maxMinutes = -1;
  minutesByDay.forEach((n, day) => {
    if (n > maxMinutes) {
      maxMinutes = n;
      mostProductiveDay = day;
    }
  });

  let favoriteSubject: string | null = null;
  let maxSubject = -1;
  minutesBySubject.forEach((n, name) => {
    if (n > maxSubject) {
      maxSubject = n;
      favoriteSubject = name;
    }
  });

  return {
    totalTrees,
    treesThisWeek,
    focusMinutes,
    focusHours: focusMinutes / 60,
    milestones,
    bestDay,
    favoriteSubject,
    mostProductiveDay,
  };
}

/** Tree counts per weekday for the current week, Mon→Sun. Used by the weekly view. */
export function weeklyTreeCounts(sessions: (FocusSessionDoc & { id: string })[]): number[] {
  const counts = new Array(7).fill(0) as number[];
  const weekStart = startOfWeekKey(new Date());
  for (const s of sessions) {
    if (s.date < weekStart) continue;
    const idx = weekDayIndex(s.date);
    if (idx >= 0 && idx < 7) counts[idx] += 1;
  }
  return counts;
}

/** Daily forest summary: trees, focus minutes, sessions and XP earned for a single day. */
export function dayForestSummary(sessions: (FocusSessionDoc & { id: string })[], date: string) {
  const daySessions = sessions.filter((s) => s.date === date);
  const focusMinutes = daySessions.reduce((sum, s) => sum + s.focusMinutes, 0);
  const xp = Math.round(focusMinutes); // 1 XP per focus minute (see gamification.ts)
  const trees = daySessions.filter((s) => s.completed).length;
  return { sessions: daySessions, trees, focusMinutes, xp };
}
