import { doc, increment, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addDays, dayKey, parseDayKey } from "@/lib/dates";
import type { CounterBatch } from "@/lib/counters";

/**
 * Simple, transparent XP economy — every reward is easy for a student to
 * explain to themselves ("I get 10 XP per task, 1 XP per focus minute").
 * No hidden multipliers or decay; predictability matters more than
 * sophistication for a middle/high-schooler.
 */
export const XP_REWARDS = {
  taskComplete: 10,
  focusMinute: 1,
  chapterMastered: 30,
  mockLogged: 20,
  sprintCompleted: 100,
  weeklyReview: 20,
} as const;

/** 100 XP per level, flat — easy to explain ("100 XP = 1 level"). */
const XP_PER_LEVEL = 100;

export function levelForXp(xp: number) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = xp % XP_PER_LEVEL;
  return { level, xpIntoLevel, xpForNextLevel: XP_PER_LEVEL, progress: xpIntoLevel / XP_PER_LEVEL };
}

export function addXp(batch: CounterBatch, uid: string, amount: number) {
  if (amount === 0) return;
  batch.set(doc(db, "users", uid), { xp: increment(amount) }, { merge: true });
}

// ---------------------------------------------------------------------------
// Streak
// ---------------------------------------------------------------------------

export interface StreakState {
  streakCount: number;
  longestStreak: number;
  lastActiveDate?: string;
}

/**
 * Pure function: given the student's current streak state and that they had
 * activity "today", returns the updated state. Consecutive days extend the
 * streak; a gap of 1+ missed days resets it to 1; multiple calls on the same
 * day are a no-op. Kept pure and dependency-free so it's trivial to unit test.
 */
export function computeNextStreak(state: StreakState, today: string): StreakState {
  if (state.lastActiveDate === today) return state;

  const yesterday = dayKey(addDays(parseDayKey(today), -1));
  const isConsecutive = state.lastActiveDate === yesterday;
  const streakCount = isConsecutive ? state.streakCount + 1 : 1;

  return {
    streakCount,
    longestStreak: Math.max(state.longestStreak, streakCount),
    lastActiveDate: today,
  };
}

/** Call once per day when the student has done anything (task/session/checkin). */
export async function ensureDailyStreak(uid: string): Promise<StreakState> {
  const today = dayKey(new Date());
  const ref = doc(db, "users", uid);

  // Read the authoritative streak fields inside the transaction so concurrent
  // tabs can't both compute "streak = 1" from the same stale snapshot and lose
  // a day's increment. Firestore retries on write conflicts.
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const current: StreakState = {
      streakCount: data?.streakCount ?? 0,
      longestStreak: data?.longestStreak ?? 0,
      lastActiveDate: data?.lastActiveDate,
    };
    if (current.lastActiveDate === today) return current;

    const next = computeNextStreak(current, today);
    tx.update(ref, {
      streakCount: next.streakCount,
      longestStreak: next.longestStreak,
      lastActiveDate: next.lastActiveDate,
    });
    return next;
  });
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export interface BadgeContext {
  xp: number;
  streakCount: number;
  longestStreak: number;
  treesGrown: number;
  chaptersMastered: number;
  mockTestsLogged: number;
  sprintsCompleted: number;
}

export interface Badge {
  id: string;
  emoji: string;
  label: string;
  description: string;
  check: (ctx: BadgeContext) => boolean;
}

export const BADGES: Badge[] = [
  {
    id: "first-tree",
    emoji: "🌱",
    label: "First Sprout",
    description: "Complete your first focus session",
    check: (c) => c.treesGrown >= 1,
  },
  {
    id: "forest-10",
    emoji: "🌳",
    label: "Forest Starter",
    description: "Grow 10 trees in your Study Forest",
    check: (c) => c.treesGrown >= 10,
  },
  {
    id: "forest-50",
    emoji: "🌲",
    label: "Forest Keeper",
    description: "Grow 50 trees in your Study Forest",
    check: (c) => c.treesGrown >= 50,
  },
  {
    id: "streak-3",
    emoji: "🔥",
    label: "On a Roll",
    description: "3-day study streak",
    check: (c) => c.longestStreak >= 3,
  },
  {
    id: "streak-7",
    emoji: "🔥",
    label: "Week Warrior",
    description: "7-day study streak",
    check: (c) => c.longestStreak >= 7,
  },
  {
    id: "streak-30",
    emoji: "🔥",
    label: "Unstoppable",
    description: "30-day study streak",
    check: (c) => c.longestStreak >= 30,
  },
  {
    id: "first-mastery",
    emoji: "⭐",
    label: "First Mastery",
    description: "Master your first chapter",
    check: (c) => c.chaptersMastered >= 1,
  },
  {
    id: "mastery-10",
    emoji: "🏆",
    label: "Syllabus Slayer",
    description: "Master 10 chapters",
    check: (c) => c.chaptersMastered >= 10,
  },
  {
    id: "first-mock",
    emoji: "📝",
    label: "Test Pilot",
    description: "Log your first mock test",
    check: (c) => c.mockTestsLogged >= 1,
  },
  {
    id: "sprint-finisher",
    emoji: "🚀",
    label: "Sprint Finisher",
    description: "Complete a Study Sprint",
    check: (c) => c.sprintsCompleted >= 1,
  },
  {
    id: "level-5",
    emoji: "🎖️",
    label: "Level 5",
    description: "Reach Level 5",
    check: (c) => levelForXp(c.xp).level >= 5,
  },
];

export function computeEarnedBadgeIds(ctx: BadgeContext): string[] {
  return BADGES.filter((b) => b.check(ctx)).map((b) => b.id);
}

/** Badge ids present in `earned` but not yet in `known` — used to trigger unlock toasts. */
export function newlyEarnedBadges(known: string[], earned: string[]): string[] {
  const knownSet = new Set(known);
  return earned.filter((id) => !knownSet.has(id));
}
