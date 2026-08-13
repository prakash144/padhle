import { addDays, dayKey, monthKey, parseDayKey, startOfWeek } from "@/lib/dates";
import { calculateMastery } from "@/lib/studyWorkflow";
import type { ChapterDoc, ErrorBookDoc, FocusActivity, FocusSessionDoc, MockTestDoc, SubjectDoc } from "@/lib/schema";

/**
 * Pure aggregation engine for the Analytics page. Every period check runs on
 * the session's stored `date` key (YYYY-MM-DD in the student's timezone), so
 * buckets always match the counters/reports week+month keys.
 */

export type TimePeriod = "day" | "week" | "month" | "year" | "custom";

export interface PeriodFilter {
  kind: TimePeriod;
  /** For "custom": inclusive start/end date keys. */
  customStart?: string;
  customEnd?: string;
  /** For "year": the calendar year (e.g. 2026). */
  year?: number;
}

/** Green-tonal ramp so charts read as calm "growth" instead of a rainbow. */
const PALETTE = [
  "#27834A",
  "#3A9D5D",
  "#2F7D4A",
  "#63D471",
  "#1F6D3C",
  "#7BE386",
  "#176B4D",
  "#9AE6A3",
];

export interface Slice {
  name: string;
  value: number; // minutes
  color: string;
}

export interface AnalyticsInsight {
  id: string;
  title: string;
  detail: string;
  actionLabel: string;
  actionHref: string;
  tone: "success" | "warning" | "info";
}

const ACTIVITY_META: Record<FocusActivity, { label: string; color: string }> = {
  lecture: { label: "Lectures", color: "#3A9D5D" },
  practice: { label: "Practice", color: "#63D471" },
  pyq: { label: "PYQs", color: "#2F7D4A" },
  revision: { label: "Revision", color: "#1F6D3C" },
};

function sameCalendar(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

/** The focused preset centered on "now", so filters stay stable across renders. */
export function currentFilter(kind: TimePeriod, year?: number, customStart?: string, customEnd?: string): PeriodFilter {
  const now = new Date();
  switch (kind) {
    case "year":
      return { kind, year: year ?? now.getFullYear() };
    case "custom": {
      const end = customEnd ?? dayKey(now);
      const start = customStart ?? dayKey(addDays(now, -29));
      return { kind, customStart: start, customEnd: end };
    }
    default:
      return { kind };
  }
}

/** Inclusive date-key test for whether a session's `date` falls in the period. */
export function keyInPeriod(dateKey: string, filter: PeriodFilter, now = new Date()): boolean {
  switch (filter.kind) {
    case "day":
      return dateKey === dayKey(now);
    case "week": {
      const start = dayKey(startOfWeek(now));
      const end = dayKey(addDays(startOfWeek(now), 6));
      return dateKey >= start && dateKey <= end;
    }
    case "month":
      return dateKey.startsWith(monthKey(now));
    case "year":
      return filter.year != null && dateKey.startsWith(`${filter.year}-`);
    case "custom":
      return !!(filter.customStart && filter.customEnd) && dateKey >= filter.customStart && dateKey <= filter.customEnd;
  }
}

export function sessionsInPeriod(sessions: FocusSessionDoc[], filter: PeriodFilter, now = new Date()): { list: FocusSessionDoc[]; totalMinutes: number; plannedMinutes: number; sessionCount: number; activeDays: number } {
  const active = new Set<string>();
  let totalMinutes = 0;
  let plannedMinutes = 0;
  const list: FocusSessionDoc[] = [];
  for (const s of sessions) {
    if (!keyInPeriod(s.date, filter, now)) continue;
    list.push(s);
    totalMinutes += s.focusMinutes;
    plannedMinutes += s.plannedMinutes;
    active.add(s.date);
  }
  return { list, totalMinutes, plannedMinutes, sessionCount: list.length, activeDays: active.size };
}

/** Time by subject (top 5 + "Other"), colored from the palette. */
export function bySubject(sessions: FocusSessionDoc[], filter: PeriodFilter, now = new Date()): Slice[] {
  const map = new Map<string, number>();
  for (const s of sessions) {
    if (!keyInPeriod(s.date, filter, now)) continue;
    const name = s.subjectName || "General";
    map.set(name, (map.get(name) ?? 0) + s.focusMinutes);
  }
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 5);
  const restMinutes = sorted.slice(5).reduce((sum, [, m]) => sum + m, 0);
  const slices: Slice[] = top.map(([name, value], i) => ({ name, value, color: PALETTE[i % PALETTE.length] }));
  if (restMinutes > 0) slices.push({ name: "Other", value: restMinutes, color: PALETTE[5 % PALETTE.length] });
  return slices;
}

/** Time by activity/goal (lectures / practice / PYQs / revision). */
export function byActivity(sessions: FocusSessionDoc[], filter: PeriodFilter, now = new Date()): Slice[] {
  const map = new Map<FocusActivity, number>();
  for (const s of sessions) {
    if (!keyInPeriod(s.date, filter, now)) continue;
    const act = s.activity ?? "practice";
    map.set(act, (map.get(act) ?? 0) + s.focusMinutes);
  }
  return (Object.keys(ACTIVITY_META) as FocusActivity[])
    .map((act) => ({ name: ACTIVITY_META[act].label, value: map.get(act) ?? 0, color: ACTIVITY_META[act].color }))
    .filter((s) => s.value > 0);
}

/**
 * Trend series: by day for day/week/custom (custom capped at 60 points),
 * by calendar month for year. Always ascending so the bar x-axis reads left→right.
 */
export function trendSeries(sessions: FocusSessionDoc[], filter: PeriodFilter, now = new Date()): { label: string; minutes: number }[] {
  const buckets: { key: string; minutes: number; label: string }[] = [];

  const bump = (key: string, label: string, minutes: number) => {
    const hit = buckets.find((b) => b.key === key);
    if (hit) hit.minutes += minutes;
    else buckets.push({ key, label, minutes });
  };

  for (const s of sessions) {
    if (!keyInPeriod(s.date, filter)) continue;
    switch (filter.kind) {
      case "year":
        bump(s.date.slice(0, 7), monthLabel(s.date), s.focusMinutes);
        break;
      default:
        bump(s.date, s.date.slice(5), s.focusMinutes);
    }
  }

  // Pad missing days/months so the timeline is continuous (no gaps).
  if (filter.kind === "week") {
    const start = startOfWeek(now);
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      const key = dayKey(d);
      bump(key, key.slice(5), 0);
    }
  } else if (filter.kind === "month") {
    const m = monthKey(now);
    const days = daysInMonth(now);
    for (let i = 1; i <= Math.min(days, 31); i++) {
      const key = `${m}-${String(i).padStart(2, "0")}`;
      bump(key, `${i}`, 0);
    }
  } else if (filter.kind === "year") {
    const y = filter.year ?? now.getFullYear();
    for (let i = 1; i <= 12; i++) {
      bump(`${y}-${String(i).padStart(2, "0")}`, monthShort(i), 0);
    }
  } else if (filter.kind === "custom") {
    const start = parseDayKey(filter.customStart ?? dayKey(now));
    const end = parseDayKey(filter.customEnd ?? dayKey(now));
    const total = Math.min(60, Math.max(0, diffDays(start, end)));
    for (let i = 0; i <= total; i++) {
      const d = addDays(start, i);
      const key = dayKey(d);
      bump(key, key.slice(5), 0);
    }
  } else {
    bump(dayKey(now), "Today", 0);
  }

  return buckets.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).map(({ label, minutes }) => ({ label, minutes }));
}

/** Same-length previous period + % delta, e.g. last year → this year. */
export function previousPeriod(filter: PeriodFilter, now = new Date()): PeriodFilter {
  switch (filter.kind) {
    case "day":
      return { kind: "custom", customStart: dayKey(addDays(now, -1)), customEnd: dayKey(addDays(now, -1)) };
    case "week":
      return { kind: "custom", customStart: dayKey(addDays(startOfWeek(now), -7)), customEnd: dayKey(addDays(startOfWeek(now), -1)) };
    case "month": {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const days = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      return { kind: "custom", customStart: dayKey(prev), customEnd: dayKey(addDays(prev, days - 1)) };
    }
    case "year":
      return { kind: "year", year: (filter.year ?? now.getFullYear()) - 1 };
    case "custom": {
      const start = parseDayKey(filter.customStart ?? dayKey(now));
      const end = parseDayKey(filter.customEnd ?? dayKey(now));
      const span = diffDays(start, end);
      const prevEnd = addDays(start, -1);
      return { kind: "custom", customStart: dayKey(addDays(prevEnd, -span)), customEnd: dayKey(prevEnd) };
    }
  }
}

export function pctDelta(cur: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function monthShort(i: number): string {
  return new Date(2026, i - 1, 1).toLocaleDateString("en-US", { month: "short" });
}

function monthLabel(dateKey: string): string {
  const [, mm] = dateKey.split("-").map(Number);
  return monthShort(mm);
}

/**
 * Inclusive [start, end] date-key window for a period filter (bounds the
 * server query so Analytics/SprintRetro/Reports never pull every session).
 */
export function periodDateRange(filter: PeriodFilter, now = new Date()): { start: string; end: string } {
  switch (filter.kind) {
    case "day": {
      const key = dayKey(now);
      return { start: key, end: key };
    }
    case "week": {
      const start = dayKey(startOfWeek(now));
      return { start, end: dayKey(addDays(startOfWeek(now), 6)) };
    }
    case "month": {
      const start = `${monthKey(now)}-01`;
      const end = dayKey(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      return { start, end };
    }
    case "year":
      return { start: `${filter.year ?? now.getFullYear()}-01-01`, end: `${filter.year ?? now.getFullYear()}-12-31` };
    case "custom":
      return { start: filter.customStart ?? dayKey(now), end: filter.customEnd ?? dayKey(now) };
  }
}

/** Combined query window for the current period plus its comparison period. */
export function sessionQueryWindow(filter: PeriodFilter, now = new Date()): { start: string; end: string } {
  const cur = periodDateRange(filter, now);
  const prev = periodDateRange(previousPeriod(filter, now), now);
  return { start: prev.start < cur.start ? prev.start : cur.start, end: cur.end > prev.end ? cur.end : prev.end };
}

/** True if a date equality check references the same wall-clock calendar day as now. */
export function isTodayKey(key: string): boolean {
  return sameCalendar(parseDayKey(key), new Date());
}

export function totalOf(slices: Slice[]): number {
  return slices.reduce((s, x) => s + x.value, 0);
}

export function topSlice(slices: Slice[]): Slice | undefined {
  return slices[0];
}

export function buildAnalyticsInsights({
  sessions,
  filter,
  subjects,
  chapters,
  errors,
  tests,
  now = new Date(),
}: {
  sessions: FocusSessionDoc[];
  filter: PeriodFilter;
  subjects: (SubjectDoc & { id: string })[];
  chapters: (ChapterDoc & { id: string })[];
  errors: (ErrorBookDoc & { id: string })[];
  tests: (MockTestDoc & { id: string })[];
  now?: Date;
}): AnalyticsInsight[] {
  const period = sessionsInPeriod(sessions, filter, now);
  const prev = sessionsInPeriod(sessions, previousPeriod(filter, now), now);
  const insights: AnalyticsInsight[] = [];

  const focusDelta = pctDelta(period.totalMinutes, prev.totalMinutes);
  if (focusDelta !== null && Math.abs(focusDelta) >= 15) {
    insights.push({
      id: "focus-consistency",
      title: focusDelta > 0 ? `Focus time +${Math.round(focusDelta)}%` : `Focus time ${Math.round(focusDelta)}%`,
      detail:
        focusDelta > 0
          ? "Your consistency is improving against the previous period. Keep the same study windows."
          : "Focus slipped compared with the previous period. Put one short session on today's plan.",
      actionLabel: focusDelta > 0 ? "Open Planner" : "Start Focus",
      actionHref: focusDelta > 0 ? "/planner" : "/focus",
      tone: focusDelta > 0 ? "success" : "warning",
    });
  }

  const planGap = period.plannedMinutes - period.totalMinutes;
  if (period.plannedMinutes > 0 && planGap >= 45) {
    insights.push({
      id: "planned-vs-actual",
      title: `${Math.round((period.totalMinutes / period.plannedMinutes) * 100)}% of planned focus done`,
      detail: `${Math.round(planGap)} planned minutes did not convert into focus. Reduce the next plan or reschedule missed work.`,
      actionLabel: "Review Planner",
      actionHref: "/planner",
      tone: "warning",
    });
  }

  const openErrors = errors.filter((error) => error.status === "open");
  if (openErrors.length >= 3) {
    const bySubject = countBy(openErrors.map((error) => error.subjectName || "Mistakes"));
    const [name, count] = [...bySubject.entries()].sort((a, b) => b[1] - a[1])[0];
    insights.push({
      id: "unrevised-mistakes",
      title: `${count} ${name} mistakes unrevised`,
      detail: "Open mistakes are the fastest route from practice to revision and mastery.",
      actionLabel: "Start Revision",
      actionHref: "/errors",
      tone: "warning",
    });
  }

  const weak = chapters
    .map((chapter) => ({ chapter, state: calculateMastery(chapter, { todayKey: dayKey(now) }) }))
    .filter((item) => item.state.state === "weak" || item.state.state === "needs_revision")
    .sort((a, b) => a.state.masteryPct - b.state.masteryPct)[0];
  if (weak) {
    insights.push({
      id: "weak-topic",
      title: `${weak.chapter.name} needs attention`,
      detail: `${weak.chapter.subjectName} is marked ${weak.state.state.replace("_", " ")}. Queue practice before adding new chapters.`,
      actionLabel: "Open Syllabus",
      actionHref: `/syllabus/${weak.chapter.subjectId}`,
      tone: "info",
    });
  }

  const latest = tests[tests.length - 1];
  const previous = tests[tests.length - 2];
  if (latest && previous) {
    const delta = latest.accuracy - previous.accuracy;
    const weakestBreakdown = latest.subjectBreakdown
      .map((row) => ({
        name: row.subjectName,
        attempted: row.correct + row.incorrect,
        accuracy: row.correct + row.incorrect > 0 ? Math.round((row.correct / (row.correct + row.incorrect)) * 100) : 0,
      }))
      .filter((row) => row.attempted > 0)
      .sort((a, b) => a.accuracy - b.accuracy)[0];
    if (Math.abs(delta) >= 5 || weakestBreakdown) {
      insights.push({
        id: "test-trend",
        title: delta >= 0 ? `Test accuracy +${Math.round(delta)} pts` : `Test accuracy ${Math.round(delta)} pts`,
        detail: weakestBreakdown
          ? `${weakestBreakdown.name} is the weakest tested subject at ${weakestBreakdown.accuracy}% accuracy.`
          : "Latest test trend is available from your logged attempts.",
        actionLabel: "Open Tests",
        actionHref: "/tests",
        tone: delta >= 0 ? "success" : "warning",
      });
    }
  }

  const noMastery = subjects.length > 0 && subjects.every((subject) => subject.masteredCount === 0);
  if (noMastery) {
    insights.push({
      id: "mastery-start",
      title: "No mastered chapters yet",
      detail: "Start with one high-priority chapter and move it through learn, practice, revision, then mastery.",
      actionLabel: "Open Syllabus",
      actionHref: "/syllabus",
      tone: "info",
    });
  }

  return insights.slice(0, 4);
}

function countBy(values: string[]): Map<string, number> {
  const map = new Map<string, number>();
  values.forEach((value) => map.set(value, (map.get(value) ?? 0) + 1));
  return map;
}
