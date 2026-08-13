import type { CounterDoc } from "@/lib/schema";

/**
 * Weekly targets a student is nudged against — deliberately simple constants
 * rather than a personalization engine, so the score stays easy to explain.
 */
const WEEKLY_TARGETS = {
  focusMinutes: 600, // 10h/week
  questions: 200,
  revisions: 5,
  checkins: 7,
};

export interface FocusScoreComponents {
  taskCompletion: number;
  focusMinutes: number;
  practice: number;
  revision: number;
  planning: number;
}

export interface FocusScoreResult {
  score: number;
  components: FocusScoreComponents;
}

export interface PeriodSummary {
  completionPct: number;
  focusDeltaPct: number | null;
  wentWell: string;
  slipped: string;
  nextChange: string;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Focus Score (0-100): 30% task completion, 25% focus time, 20% practice, 15% revision, 10% planning. */
export function computeFocusScore(counter: CounterDoc): FocusScoreResult {
  const components: FocusScoreComponents = {
    taskCompletion: counter.plannedTasks > 0 ? clamp01(counter.completedTasks / counter.plannedTasks) : 0,
    focusMinutes: clamp01(counter.focusMinutes / WEEKLY_TARGETS.focusMinutes),
    practice: clamp01(counter.questionsDone / WEEKLY_TARGETS.questions),
    revision: clamp01(counter.revisionsDone / WEEKLY_TARGETS.revisions),
    planning: clamp01(counter.checkinDone / WEEKLY_TARGETS.checkins),
  };
  const score = Math.round(
    100 *
      (0.3 * components.taskCompletion +
        0.25 * components.focusMinutes +
        0.2 * components.practice +
        0.15 * components.revision +
        0.1 * components.planning)
  );
  return { score, components };
}

const COMPONENT_LABEL: Record<keyof FocusScoreComponents, string> = {
  taskCompletion: "finishing planned tasks",
  focusMinutes: "focus time",
  practice: "practice volume",
  revision: "revision consistency",
  planning: "daily planning",
};

/** One plain-language nudge, pointed at whichever component is weakest — never a wall of numbers. */
export function suggestionFor(components: FocusScoreComponents): string {
  const weakest = (Object.keys(components) as (keyof FocusScoreComponents)[]).reduce((a, b) =>
    components[a] <= components[b] ? a : b
  );
  if (components[weakest] >= 0.8) {
    return "Strong week across the board — keep the rhythm going.";
  }
  return `This week's growth area: ${COMPONENT_LABEL[weakest]}. A little extra attention here next week moves the needle most.`;
}

export function buildPeriodSummary(counter: CounterDoc, previous?: CounterDoc): PeriodSummary {
  const completionPct =
    counter.plannedTasks > 0 ? Math.round((counter.completedTasks / counter.plannedTasks) * 100) : 0;
  const focusDeltaPct =
    previous && previous.focusMinutes > 0
      ? Math.round(((counter.focusMinutes - previous.focusMinutes) / previous.focusMinutes) * 100)
      : null;
  const strongest = [
    { label: "focus", value: counter.focusMinutes / WEEKLY_TARGETS.focusMinutes },
    { label: "practice", value: counter.questionsDone / WEEKLY_TARGETS.questions },
    { label: "revision", value: counter.revisionsDone / WEEKLY_TARGETS.revisions },
    { label: "planning", value: counter.checkinDone / WEEKLY_TARGETS.checkins },
  ].sort((a, b) => b.value - a.value)[0];
  const weakest = [
    { label: "task completion", value: counter.plannedTasks > 0 ? counter.completedTasks / counter.plannedTasks : 0 },
    { label: "practice", value: counter.questionsDone / WEEKLY_TARGETS.questions },
    { label: "revision", value: counter.revisionsDone / WEEKLY_TARGETS.revisions },
    { label: "planning", value: counter.checkinDone / WEEKLY_TARGETS.checkins },
  ].sort((a, b) => a.value - b.value)[0];

  return {
    completionPct,
    focusDeltaPct,
    wentWell:
      strongest.value > 0
        ? `Strongest area: ${strongest.label}.`
        : "No strong signal yet for this period.",
    slipped:
      counter.plannedTasks > 0 && completionPct < 70
        ? `${counter.plannedTasks - counter.completedTasks} planned tasks slipped.`
        : `Watch ${weakest.label} next.`,
    nextChange:
      weakest.label === "revision"
        ? "Schedule one mistake-revision block before adding new work."
        : weakest.label === "practice"
          ? "Convert one focus block into questions or PYQs."
          : weakest.label === "planning"
            ? "Start the day with a short check-in."
            : "Keep tomorrow's plan smaller and finish it fully.",
  };
}
