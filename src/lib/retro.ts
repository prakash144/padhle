import type { CounterDoc, FocusSessionDoc, SprintDoc } from "@/lib/schema";
import { parseDayKey } from "@/lib/dates";

/** All YYYY-MM-DD keys from startKey to endKey inclusive, via pure UTC math (TZ-safe). */
function dayKeysBetween(startKey: string, endKey: string): string[] {
  const [y1, m1, d1] = startKey.split("-").map(Number);
  const [y2, m2, d2] = endKey.split("-").map(Number);
  const first = Date.UTC(y1, m1 - 1, d1);
  const last = Date.UTC(y2, m2 - 1, d2);
  const days = Math.round((last - first) / 86400000);
  return Array.from({ length: days + 1 }, (_, i) => new Date(first + i * 86400000).toISOString().slice(0, 10));
}

export interface RetroGoalLine {
  title: string;
  done: number;
  target: number;
  achieved: boolean;
  unit: string;
}

export interface RetroSubjectLine {
  name: string;
  minutes: number;
  pct: number;
}

export interface SprintRetro {
  status: "completed" | "abandoned";
  goals: RetroGoalLine[];
  goalsAchieved: number;
  goalCount: number;
  completionPct: number;
  focusTotalMin: number;
  questionsTotal: number;
  bestDay: { date: string; label: string; minutes: number } | null;
  worstDay: { date: string; label: string; minutes: number } | null;
  subjectFocus: RetroSubjectLine[];
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  congrats: string;
}

function dayLabel(key: string): string {
  const d = parseDayKey(key);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function computeSprintRetro(
  sprint: SprintDoc,
  counters: { id: string; data: CounterDoc }[],
  sessions: FocusSessionDoc[]
): SprintRetro {
  const status = sprint.status === "completed" ? "completed" : "abandoned";

  const rawGoals: { title: string; done: number; target: number; unit: string }[] = [
    { title: "Focus time", done: sprint.progress.focusMinutes, target: sprint.goals.targetFocusHours * 60, unit: "min" },
    { title: "Questions", done: sprint.progress.questions, target: sprint.goals.targetQuestions, unit: "" },
    { title: "PYQs", done: sprint.progress.pyqs, target: sprint.goals.targetPyqs, unit: "" },
    { title: "Mock tests", done: sprint.progress.mocks, target: sprint.goals.targetMocks, unit: "" },
  ];

  const goals = rawGoals.map((g) => ({
    ...g,
    achieved: g.target > 0 && g.done >= g.target,
  }));
  const activeGoals = goals.filter((g) => g.target > 0);
  const goalsAchieved = activeGoals.filter((g) => g.achieved).length;
  const goalCount = activeGoals.length;
  const completionPct =
    goalCount > 0
      ? Math.round(
          (activeGoals.reduce((sum, g) => sum + Math.min(1, g.done / g.target), 0) / goalCount) * 100
        )
      : 0;

  // The sprint's calendar window, as bare YYYY-MM-DD keys. Counter doc ids are
  // "day_YYYY-MM-DD", so strip the prefix before matching — a raw id match
  // would silently match nothing and zero every day-based metric.
  const dayIds = new Set(dayKeysBetween(sprint.startDate, sprint.endDate));
  const dayKeyOf = (id: string) => (id.startsWith("day_") ? id.slice(4) : id);

  // Per-day focus inside the sprint window, merged by day from both sources:
  // live counters (best/worst/total) and focus sessions (subject mix). Taking
  // the per-day max keeps the two from double-counting when both exist.
  const dayFocus = new Map<string, number>();
  for (const c of counters) {
    const key = dayKeyOf(c.id);
    if (dayIds.has(key) && c.data.focusMinutes > 0) {
      dayFocus.set(key, Math.max(dayFocus.get(key) ?? 0, c.data.focusMinutes));
    }
  }
  for (const s of sessions) {
    if (dayIds.has(s.date) && s.focusMinutes > 0) {
      dayFocus.set(s.date, Math.max(dayFocus.get(s.date) ?? 0, s.focusMinutes));
    }
  }
  const focusTotalMin = [...dayFocus.values()].reduce((a, b) => a + b, 0);
  const questionsTotal = counters
    .filter((c) => dayIds.has(dayKeyOf(c.id)))
    .reduce((sum, c) => sum + c.data.questionsDone, 0);

  let bestDay: SprintRetro["bestDay"] = null;
  let worstDay: SprintRetro["worstDay"] = null;
  for (const [id, minutes] of dayFocus) {
    if (!bestDay || minutes > bestDay.minutes) bestDay = { date: id, label: dayLabel(id), minutes };
    if (!worstDay || minutes < worstDay.minutes) worstDay = { date: id, label: dayLabel(id), minutes };
  }

  const bySubject = new Map<string, number>();
  for (const s of sessions) {
    if (dayIds.has(s.date) && s.focusMinutes > 0) {
      const key = s.subjectName || "General";
      bySubject.set(key, (bySubject.get(key) ?? 0) + s.focusMinutes);
    }
  }
  const subjectFocus: RetroSubjectLine[] = [...bySubject.entries()]
    .map(([name, minutes]) => ({
      name,
      minutes,
      pct: focusTotalMin ? Math.round((minutes / focusTotalMin) * 100) : 0,
    }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 4);

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const suggestions: string[] = [];

  if (bestDay) {
    strengths.push(`Best day: ${bestDay.label} — ${bestDay.minutes} min of focus`);
  }
  const topSubject = subjectFocus[0];
  if (topSubject && topSubject.pct >= 40) {
    strengths.push(`Most consistent in ${topSubject.name} (${topSubject.pct}% of your focus)`);
  }

  const missed = activeGoals.filter((g) => !g.achieved);
  if (missed.length > 0) {
    weaknesses.push(
      `Missed ${missed.length} goal${missed.length > 1 ? "s" : ""}: ${missed
        .map((m) => m.title)
        .join(", ")}`
    );
    if (missed.some((m) => m.title === "Focus time")) {
      suggestions.push("Book focus sessions at the same time daily — 25 minutes first thing beats a heroic evening");
    }
    if (missed.some((m) => m.title === "Questions" || m.title === "PYQs")) {
      suggestions.push("Set a smaller, daily question target and start your session with it — questions teach faster than notes");
    }
  } else if (goalCount > 0) {
    strengths.push("Every sprint goal achieved");
    suggestions.push("You cleared every goal — raise ONE target by ~15% next sprint and keep the rest");
  } else {
    suggestions.push("Open the sprint screen to set goals — a target turns effort into progress");
  }

  if (status === "abandoned") {
    weaknesses.push("This sprint was ended early");
    const lighter = "Restart with a lighter sprint — finishing builds momentum, aiming too high burns it";
    if (!suggestions.includes(lighter)) suggestions.unshift(lighter);
  } else if (completionPct < 90 && completionPct > 0) {
    suggestions.push(`You completed ${completionPct}% overall — next time set targets about 10% lighter so you win`);
  }

  if (bestDay && worstDay && worstDay.minutes < bestDay.minutes * 0.4) {
    weaknesses.push(`Slowest day: ${worstDay.label} (only ${worstDay.minutes} min)`);
    suggestions.push("Protect your weak days — plan a backup 15-min session for them so the streak never breaks");
  }

  if (focusTotalMin === 0 && questionsTotal === 0 && goalCount > 0) {
    weaknesses.push("No focus or questions landed while this sprint was live");
    suggestions.push("Make ONE tiny first move today: press the Focus timer for 10 minutes");
  }

  const congrats =
    status === "completed"
      ? goalCount > 0
        ? `Sprint complete! You achieved ${goalsAchieved} of ${goalCount} goals and stayed with it. That's how exams are won.`
        : "Sprint complete — every finished sprint is a step closer to the exam."
      : "You closed this sprint. Reviewed and restarted beats quietly abandoned — proud of you for checking in.";

  return {
    status,
    goals,
    goalsAchieved,
    goalCount,
    completionPct,
    focusTotalMin,
    questionsTotal,
    bestDay,
    worstDay,
    subjectFocus,
    strengths,
    weaknesses,
    suggestions: suggestions.slice(0, 4),
    congrats,
  };
}