import { describe, expect, it } from "vitest";
import {
  BADGES,
  computeEarnedBadgeIds,
  computeNextStreak,
  levelForXp,
  newlyEarnedBadges,
  type StreakState,
} from "@/lib/gamification";

const empty = (): StreakState => ({ streakCount: 0, longestStreak: 0 });

describe("computeNextStreak", () => {
  it("starts a streak of 1 on first activity", () => {
    expect(computeNextStreak(empty(), "2026-08-10")).toEqual({
      streakCount: 1,
      longestStreak: 1,
      lastActiveDate: "2026-08-10",
    });
  });

  it("extends the streak on a consecutive day", () => {
    const day1 = computeNextStreak(empty(), "2026-08-10");
    expect(computeNextStreak(day1, "2026-08-11")).toMatchObject({
      streakCount: 2,
      longestStreak: 2,
    });
  });

  it("is a no-op when called twice on the same day", () => {
    const day1 = computeNextStreak(empty(), "2026-08-10");
    expect(computeNextStreak(day1, "2026-08-10")).toBe(day1);
  });

  it("resets to 1 after a gap but keeps the longest streak", () => {
    const day3 = computeNextStreak(computeNextStreak(computeNextStreak(empty(), "2026-08-10"), "2026-08-11"), "2026-08-12");
    // skip 08-13, activity on 08-14
    const afterGap = computeNextStreak(day3, "2026-08-14");
    expect(afterGap.streakCount).toBe(1);
    expect(afterGap.longestStreak).toBe(3);
  });
});

describe("levelForXp", () => {
  it("maps XP to a flat 100-per-level progression", () => {
    expect(levelForXp(0)).toMatchObject({ level: 1, xpIntoLevel: 0 });
    expect(levelForXp(99)).toMatchObject({ level: 1, xpIntoLevel: 99 });
    expect(levelForXp(100)).toMatchObject({ level: 2, xpIntoLevel: 0 });
    expect(levelForXp(250)).toMatchObject({ level: 3, xpIntoLevel: 50 });
    expect(levelForXp(1000)).toMatchObject({ level: 11, xpIntoLevel: 0 });
  });
});

describe("badges", () => {
  it("catalog has the expected milestone set", () => {
    expect(BADGES).toHaveLength(11);
    expect(BADGES.map((b) => b.id)).toContain("sprint-finisher");
  });

  it("earns nothing with an empty context", () => {
    expect(
      computeEarnedBadgeIds({
        xp: 0,
        streakCount: 0,
        longestStreak: 0,
        treesGrown: 0,
        chaptersMastered: 0,
        mockTestsLogged: 0,
        sprintsCompleted: 0,
      })
    ).toEqual([]);
  });

  it("earns the first-tree and streak badges from raw context", () => {
    const ids = computeEarnedBadgeIds({
      xp: 300,
      streakCount: 5,
      longestStreak: 5,
      treesGrown: 1,
      chaptersMastered: 1,
      mockTestsLogged: 0,
      sprintsCompleted: 0,
    });
    expect(ids).toEqual(expect.arrayContaining(["first-tree", "streak-3"]));
    expect(ids).not.toContain("streak-7");
  });

  it("newlyEarnedBadges only returns ids not already known", () => {
    expect(newlyEarnedBadges(["a"], ["a", "b"])).toEqual(["b"]);
    expect(newlyEarnedBadges(["a", "b"], ["a", "b"])).toEqual([]);
  });
});