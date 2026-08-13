import { describe, expect, it } from "vitest";
import { buildPeriodSummary, computeFocusScore, suggestionFor } from "@/lib/reports";
import { emptyCounter, type CounterDoc } from "@/lib/schema";

function at(c: Partial<CounterDoc>): CounterDoc {
  return { ...emptyCounter(), ...c };
}

describe("computeFocusScore", () => {
  it("scores 100 when every weekly target is hit", () => {
    const { score } = computeFocusScore(
      at({ plannedTasks: 10, completedTasks: 10, focusMinutes: 600, questionsDone: 200, revisionsDone: 5, checkinDone: 7 })
    );
    expect(score).toBe(100);
  });

  it("scores 0 on an empty counter", () => {
    expect(computeFocusScore(emptyCounter()).score).toBe(0);
  });

  it("is roughly linear at half the targets", () => {
    const { score } = computeFocusScore(
      at({ plannedTasks: 10, completedTasks: 5, focusMinutes: 300, questionsDone: 100, revisionsDone: 3, checkinDone: 3 })
    );
    expect(score).toBeGreaterThan(40);
    expect(score).toBeLessThan(60);
  });

  it("clamps over-achievement so scores never exceed 100", () => {
    const { score } = computeFocusScore(
      at({ plannedTasks: 3, completedTasks: 9, focusMinutes: 1200, questionsDone: 999, revisionsDone: 20, checkinDone: 14 })
    );
    expect(score).toBe(100);
  });
});

describe("suggestionFor", () => {
  it("praises a strong week when everything is above 0.8", () => {
    const { components } = computeFocusScore(
      at({ plannedTasks: 10, completedTasks: 10, focusMinutes: 600, questionsDone: 200, revisionsDone: 5, checkinDone: 7 })
    );
    expect(suggestionFor(components)).toContain("Strong week");
  });

  it("points at the weakest component", () => {
    const { components } = computeFocusScore(
      at({ plannedTasks: 10, completedTasks: 0, focusMinutes: 600, questionsDone: 200, revisionsDone: 5, checkinDone: 7 })
    );
    expect(suggestionFor(components)).toContain("finishing planned tasks");
  });
});

describe("buildPeriodSummary", () => {
  it("reports completion, focus delta, slipped work, and next change", () => {
    const summary = buildPeriodSummary(
      at({ plannedTasks: 10, completedTasks: 6, focusMinutes: 300, questionsDone: 40, revisionsDone: 0, checkinDone: 4 }),
      at({ focusMinutes: 200 })
    );
    expect(summary.completionPct).toBe(60);
    expect(summary.focusDeltaPct).toBe(50);
    expect(summary.slipped).toContain("4 planned tasks");
    expect(summary.nextChange).toContain("revision");
  });
});
