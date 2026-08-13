import { describe, expect, it } from "vitest";
import {
  byActivity,
  bySubject,
  buildAnalyticsInsights,
  currentFilter,
  keyInPeriod,
  pctDelta,
  previousPeriod,
  sessionsInPeriod,
  trendSeries,
  type PeriodFilter,
} from "@/lib/analytics";
import type { ChapterDoc, ErrorBookDoc, FocusSessionDoc, MockTestDoc, SubjectDoc } from "@/lib/schema";

function s(date: string, minutes: number, subject?: string, activity: string = "practice"): FocusSessionDoc {
  return {
    subjectName: subject,
    activity: activity as FocusSessionDoc["activity"],
    date,
    focusMinutes: minutes,
    plannedMinutes: minutes,
    mode: "25/5",
    questionsDone: 0,
    startedAt: { toDate: () => new Date() } as unknown as FocusSessionDoc["startedAt"],
    completed: true,
  };
}

// A fixed "now" so the period math is deterministic.
const NOW = new Date(2026, 7, 12); // Wednesday 2026-08-12

describe("keyInPeriod", () => {
  it("matches the day preset", () => {
    expect(keyInPeriod("2026-08-12", { kind: "day" }, NOW)).toBe(true);
    expect(keyInPeriod("2026-08-11", { kind: "day" }, NOW)).toBe(false);
  });

  it("matches the whole current week (Mon-Sun)", () => {
    expect(keyInPeriod("2026-08-10", { kind: "week" }, NOW)).toBe(true); // Monday
    expect(keyInPeriod("2026-08-16", { kind: "week" }, NOW)).toBe(true); // Sunday
    expect(keyInPeriod("2026-08-17", { kind: "week" }, NOW)).toBe(false); // next Monday
  });

  it("matches month by prefix", () => {
    expect(keyInPeriod("2026-08-01", { kind: "month" }, NOW)).toBe(true);
    expect(keyInPeriod("2026-09-01", { kind: "month" }, NOW)).toBe(false);
  });

  it("matches year and custom ranges", () => {
    expect(keyInPeriod("2026-01-15", { kind: "year", year: 2026 }, NOW)).toBe(true);
    expect(keyInPeriod("2025-12-31", { kind: "year", year: 2026 }, NOW)).toBe(false);
    expect(keyInPeriod("2026-08-05", { kind: "custom", customStart: "2026-08-01", customEnd: "2026-08-10" }, NOW)).toBe(true);
    expect(keyInPeriod("2026-08-11", { kind: "custom", customStart: "2026-08-01", customEnd: "2026-08-10" }, NOW)).toBe(false);
  });
});

describe("sessionsInPeriod / bySubject / byActivity", () => {
  const sessions = [
    s("2026-08-11", 30, "Physics", "lecture"),
    s("2026-08-12", 60, "Physics"),
    s("2026-08-12", 45, "Maths", "pyq"),
    s("2026-08-20", 999, "Ignored", "lecture"),
  ];

  it("sums focus within the week window", () => {
    const agg = sessionsInPeriod(sessions, { kind: "week" }, NOW);
    expect(agg.totalMinutes).toBe(135);
    expect(agg.sessionCount).toBe(3);
    expect(agg.activeDays).toBe(2);
  });

  it("groups by subject, keeping only present subjects", () => {
    const slices = bySubject(sessions, { kind: "week" }, NOW);
    const byName = Object.fromEntries(slices.map((x) => [x.name, x.value]));
    expect(byName).toMatchObject({ Physics: 90, Maths: 45 });
    expect(byName.Ignored).toBeUndefined();
  });

  it("groups by activity with fixed labels", () => {
    const slices = byActivity(sessions, { kind: "week" }, NOW);
    const byLabel = Object.fromEntries(slices.map((x) => [x.name, x.value]));
    expect(byLabel.Practice).toBe(60);
    expect(byLabel.Lectures).toBe(30);
    expect(byLabel.PYQs).toBe(45);
  });
});

describe("trendSeries", () => {
  it("fills all 7 days of the week with zero padding", () => {
    const series = trendSeries([s("2026-08-12", 40)], { kind: "week" }, NOW);
    expect(series).toHaveLength(7);
    expect(series.find((x) => x.label === "08-12")?.minutes).toBe(40);
    expect(series.every((x) => x.minutes >= 0)).toBe(true);
  });

  it("sorts ascending by date key", () => {
    const series = trendSeries([], { kind: "week" }, NOW);
    const keys = series.map((x) => x.label);
    expect([...keys].sort()).toEqual(keys);
  });

  it("caps a giant custom range at 60 points", () => {
    const filter: PeriodFilter = { kind: "custom", customStart: "2026-01-01", customEnd: "2026-12-31" };
    const series = trendSeries([], filter, NOW);
    expect(series.length).toBeLessThanOrEqual(61);
  });
});

describe("previousPeriod / pctDelta", () => {
  it("shifts a custom period back by its own span", () => {
    const prev = previousPeriod({ kind: "custom", customStart: "2026-08-05", customEnd: "2026-08-11" });
    expect(prev).toMatchObject({ customStart: "2026-07-29", customEnd: "2026-08-04" });
  });

  it("walks last week back to the prior Monday-Sunday", () => {
    const prev = previousPeriod({ kind: "week" }, NOW);
    expect(prev).toMatchObject({ customStart: "2026-08-03", customEnd: "2026-08-09" });
  });

  it("returns null delta when the previous period is zero", () => {
    expect(pctDelta(50, 0)).toBeNull();
    expect(pctDelta(60, 30)).toBeCloseTo(100);
  });

  it("currentFilter defaults a custom range to the last 30 days", () => {
    const f = currentFilter("custom");
    expect(f.kind).toBe("custom");
    expect(f.customStart && f.customEnd).toBeTruthy();
  });
});

describe("buildAnalyticsInsights", () => {
  it("turns focus drops, open mistakes, weak topics, and test trends into actions", () => {
    const sessions = [
      s("2026-08-04", 120, "Physics"),
      s("2026-08-05", 120, "Physics"),
      s("2026-08-12", 30, "Physics"),
    ];
    sessions[2].plannedMinutes = 120;
    const chapters = [
      {
        id: "c1",
        name: "Kinematics",
        subjectId: "s1",
        subjectName: "Physics",
        examType: "jeeMain",
        masteryStage: "practicing",
        stageEnteredAt: { toDate: () => new Date("2026-08-01") },
        accuracyNum: 3,
        accuracyDen: 10,
        questionsAttempted: 10,
        pyqsDone: 0,
        focusMinutes: 60,
        revisionSchedule: [],
        updatedAt: { toDate: () => new Date("2026-08-10") },
      } as unknown as ChapterDoc & { id: string },
    ];
    const errors = Array.from({ length: 3 }, (_, i) => ({
      id: `e${i}`,
      subjectName: "Physics",
      status: "open",
    })) as (ErrorBookDoc & { id: string })[];
    const tests = [
      { id: "t1", accuracy: 70, subjectBreakdown: [] },
      {
        id: "t2",
        accuracy: 60,
        subjectBreakdown: [{ subjectName: "Physics", correct: 3, incorrect: 7, unattempted: 0 }],
      },
    ] as (MockTestDoc & { id: string })[];
    const subjects = [{ id: "s1", masteredCount: 0 }] as unknown as (SubjectDoc & { id: string })[];

    const insights = buildAnalyticsInsights({
      sessions,
      filter: { kind: "week" },
      subjects,
      chapters,
      errors,
      tests,
      now: NOW,
    });

    expect(insights.map((item) => item.id)).toEqual(
      expect.arrayContaining(["focus-consistency", "planned-vs-actual", "unrevised-mistakes", "weak-topic"])
    );
    expect(insights[0].actionHref).toBe("/focus");
  });
});
