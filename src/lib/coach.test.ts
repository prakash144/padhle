import { describe, expect, it } from "vitest";
import {
  buildCoachMessage,
  DAILY_FOCUS_GOAL_MIN,
  type CoachContext,
} from "@/lib/coach";

function ctx(overrides: Partial<CoachContext> = {}): CoachContext {
  const now = new Date();
  return {
    now,
    hour: now.getHours(),
    isMonday: false,
    hasCheckin: true,
    todayFocusMin: 0,
    todayQuestions: 0,
    todayTasksDone: 0,
    weekFocusMin: 0,
    prevWeekFocusMin: 0,
    streak: 0,
    daysLeftToExam: null,
    examName: null,
    ...overrides,
  };
}

describe("buildCoachMessage", () => {
  it("turns urgent when the exam is within 14 days and nothing is done yet", () => {
    const msg = buildCoachMessage(ctx({ hour: 10, daysLeftToExam: 10, examName: "JEE Main", todayFocusMin: 0 }));
    expect(msg.tone).toBe("urgent");
    expect(msg.title).toContain("10 days");
  });

  it("asks for the check-in on a fresh morning", () => {
    const msg = buildCoachMessage(ctx({ hour: 8, hasCheckin: false }));
    expect(msg.tone).toBe("morning");
    expect(msg.body).toContain("check-in");
  });

  it("protects a running streak mid-afternoon", () => {
    const msg = buildCoachMessage(ctx({ hour: 15, streak: 5, todayFocusMin: 0 }));
    expect(msg.tone).toBe("encourage");
    expect(msg.title).toContain("keep the 5-day streak alive".toLowerCase() === "keep the 5-day streak alive" ? "5-day" : "streak");
    expect(msg.body).toContain("Ten focused minutes");
  });

  it("kicks off the week on a Monday using last week's actuals", () => {
    const msg = buildCoachMessage(ctx({ hour: 9, isMonday: true, prevWeekFocusMin: 420 }));
    expect(msg.title).toBe("Fresh week, fresh start");
    expect(msg.body).toContain("7.0");
  });

  it("wraps up the day in the evening with real numbers", () => {
    const msg = buildCoachMessage(
      ctx({ hour: 19, todayFocusMin: 60, todayQuestions: 12 })
    );
    expect(msg.tone).toBe("evening");
    expect(msg.body).toContain("60 min");
  });

  it("throws a party once today's focus goal is reached", () => {
    const msg = buildCoachMessage(ctx({ hour: 10, todayFocusMin: DAILY_FOCUS_GOAL_MIN }));
    expect(msg.tone).toBe("celebrate");
    expect(msg.progress).toBe(100);
  });

  it("shows progress for partial days", () => {
    const halfway = Math.round(DAILY_FOCUS_GOAL_MIN / 2);
    const msg = buildCoachMessage(ctx({ hour: 12, todayFocusMin: halfway }));
    expect(msg.tone).toBe("encourage");
    expect(msg.progress).toBe(50);
  });

  it("always returns a friendly fallback when nothing else applies", () => {
    const msg = buildCoachMessage(ctx());
    expect(["encourage", "morning", "midday"]).toContain(msg.tone);
  });
});