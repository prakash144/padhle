import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { FeatureKey, PaletteId, SchoolLevel, ThemeMode } from "@/lib/schema";

/**
 * User preferences persisted on /users/{uid} (appearance + feature flags).
 * Pure presentation: toggling a feature off never touches the underlying
 * data/collections — it only hides navigation + dashboard surfaces, and the
 * feature can be re-enabled at any time.
 */

export const DEFAULT_FEATURES: Record<FeatureKey, boolean> = {
  mocks: true,
  pyqs: true,
  errorBook: true,
  notes: true,
  sprints: true,
  focus: true,
  reports: true,
  forest: true,
};

/** Younger school tiers default the competitive-exam tools off. */
export function featureDefaultsForLevel(level?: SchoolLevel): Record<FeatureKey, boolean> {
  if (level === "primary" || level === "middle") {
    return { ...DEFAULT_FEATURES, mocks: false, pyqs: false, errorBook: false };
  }
  return DEFAULT_FEATURES;
}

export const FEATURE_META: { key: FeatureKey; label: string; description: string }[] = [
  { key: "mocks", label: "Mock Tests", description: "Full-length test practice & score tracking" },
  { key: "pyqs", label: "PYQs", description: "Previous-year question practice" },
  { key: "errorBook", label: "Error Book", description: "Mistake log with review & revision sprints" },
  { key: "notes", label: "Notes", description: "Rich-text study notes" },
  { key: "sprints", label: "Study Sprints", description: "7/14/30-day focus sprints with a task board" },
  { key: "focus", label: "Focus Timer", description: "Pomodoro focus sessions" },
  { key: "reports", label: "Reports", description: "Weekly/monthly progress reports" },
  { key: "forest", label: "Study Forest", description: "Grow a tree for every focus session" },
];

export async function saveAppearancePref(
  uid: string,
  appearance: { mode: ThemeMode; palette: PaletteId }
): Promise<void> {
  await setDoc(doc(db, "users", uid), { appearance }, { merge: true });
}

export async function saveFeaturePrefs(
  uid: string,
  features: Record<FeatureKey, boolean>
): Promise<void> {
  await setDoc(doc(db, "users", uid), { prefs: { features } }, { merge: true });
}

export async function saveAcademicLevel(
  uid: string,
  level: SchoolLevel
): Promise<void> {
  await setDoc(doc(db, "users", uid), { academic: { level } }, { merge: true });
}
