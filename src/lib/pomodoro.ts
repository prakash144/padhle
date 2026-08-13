import type { FocusActivity, PomodoroMode } from "@/lib/schema";

export const POMODORO_PRESETS: { mode: PomodoroMode; focus: number; break: number; label: string }[] = [
  { mode: "25/5", focus: 25, break: 5, label: "Quick Focus" },
  { mode: "50/10", focus: 50, break: 10, label: "Deep Focus" },
  { mode: "90/20", focus: 90, break: 20, label: "Exam Focus" },
];

export const ACTIVITY_OPTIONS: { value: FocusActivity; label: string }[] = [
  { value: "lecture", label: "Lecture" },
  { value: "practice", label: "Practice" },
  { value: "pyq", label: "PYQ" },
  { value: "revision", label: "Revision" },
];

export interface FocusPreset {
  id: "deepwork" | "quick" | "pyq";
  label: string;
  blurb: string;
  mode: PomodoroMode;
  activity: FocusActivity;
}

/** One-tap launches from Today — jump straight into a session via ?preset=id. */
export const FOCUS_PRESETS: FocusPreset[] = [
  { id: "deepwork", label: "Deep work", blurb: "50m · lecture", mode: "50/10", activity: "lecture" },
  { id: "quick", label: "Quick focus", blurb: "25m · practice", mode: "25/5", activity: "practice" },
  { id: "pyq", label: "PYQ drill", blurb: "90m · PYQs", mode: "90/20", activity: "pyq" },
];

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
