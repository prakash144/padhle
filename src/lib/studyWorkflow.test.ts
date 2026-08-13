import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import {
  buildAutoPlan,
  calculateMastery,
  getNextBestAction,
  getWeakTopics,
} from "@/lib/studyWorkflow";
import type {
  BacklogDoc,
  ChapterDoc,
  CheckinDoc,
  ErrorBookDoc,
  FocusSessionDoc,
  TaskDoc,
} from "@/lib/schema";

const TODAY = "2026-08-12";

function chapter(overrides: Partial<ChapterDoc & { id: string }> = {}): ChapterDoc & { id: string } {
  return {
    id: "chapter-1",
    subjectId: "subject-1",
    subjectName: "Physics",
    name: "Current Electricity",
    examType: "jeeMain",
    masteryStage: "practicing",
    stageEnteredAt: Timestamp.fromDate(new Date("2026-08-01")),
    accuracyNum: 16,
    accuracyDen: 30,
    questionsAttempted: 30,
    pyqsDone: 6,
    focusMinutes: 110,
    revisionSchedule: [],
    updatedAt: Timestamp.fromDate(new Date("2026-08-10")),
    ...overrides,
  };
}

function task(overrides: Partial<TaskDoc & { id: string }> = {}): TaskDoc & { id: string } {
  return {
    id: "task-1",
    title: "Practice Current Electricity",
    category: "jee",
    subjectId: "subject-1",
    subjectName: "Physics",
    chapterId: "chapter-1",
    chapterName: "Current Electricity",
    priority: "high",
    difficulty: "med",
    estimatedMinutes: 45,
    scheduledDate: TODAY,
    status: "todo",
    actualMinutes: 0,
    questionsDone: 0,
    source: "manual",
    createdAt: Timestamp.fromDate(new Date("2026-08-10")),
    updatedAt: Timestamp.fromDate(new Date("2026-08-10")),
    ...overrides,
  };
}

function backlog(overrides: Partial<BacklogDoc & { id: string }> = {}): BacklogDoc & { id: string } {
  return {
    id: "backlog-1",
    title: "Revise Semiconductors",
    category: "revision",
    priority: "high",
    origin: "manual",
    status: "pending",
    createdAt: Timestamp.fromDate(new Date("2026-08-05")),
    ...overrides,
  };
}

function error(overrides: Partial<ErrorBookDoc & { id: string }> = {}): ErrorBookDoc & { id: string } {
  return {
    id: "error-1",
    subjectId: "subject-1",
    subjectName: "Physics",
    chapterId: "chapter-1",
    chapterName: "Current Electricity",
    errorType: "concept",
    whyWrong: "Mixed up Kirchhoff sign convention",
    reviewDate: TODAY,
    status: "open",
    createdAt: Timestamp.fromDate(new Date("2026-08-11")),
    ...overrides,
  };
}

function checkin(overrides: Partial<CheckinDoc & { id: string }> = {}): CheckinDoc & { id: string } {
  return {
    id: TODAY,
    date: TODAY,
    top3: ["Current Electricity", "Organic revision", "Mock analysis"],
    dailyTargetMinutes: 180,
    completedGoals: 0,
    createdAt: Timestamp.fromDate(new Date("2026-08-12")),
    ...overrides,
  };
}

describe("calculateMastery", () => {
  it("flags a weak chapter when accuracy is low", () => {
    const result = calculateMastery(chapter(), { todayKey: TODAY });
    expect(result.state).toBe("weak");
    expect(result.action).toBe("practice");
    expect(result.masteryPct).toBeLessThan(60);
  });

  it("promotes untouched chapters to not_started", () => {
    const result = calculateMastery(
      chapter({
        masteryStage: "not_started",
        accuracyNum: 0,
        accuracyDen: 0,
        questionsAttempted: 0,
        pyqsDone: 0,
        focusMinutes: 0,
      }),
      { todayKey: TODAY }
    );
    expect(result.state).toBe("not_started");
    expect(result.coveragePct).toBe(0);
    expect(result.action).toBe("start");
  });
});

describe("getWeakTopics", () => {
  it("sorts attention topics ahead of healthy ones", () => {
    const weak = chapter({ id: "weak-1", accuracyNum: 10, accuracyDen: 25, weightage: 9 });
    const strong = chapter({
      id: "strong-1",
      name: "Kinematics",
      accuracyNum: 42,
      accuracyDen: 50,
      focusMinutes: 220,
      pyqsDone: 18,
      masteryStage: "mastered",
    });

    const topics = getWeakTopics({ chapters: [strong, weak], todayKey: TODAY });
    expect(topics).toHaveLength(1);
    expect(topics[0].chapterId).toBe("weak-1");
  });
});

describe("getNextBestAction", () => {
  it("prefers the strongest task already on today's plan", () => {
    const action = getNextBestAction({
      todayKey: TODAY,
      tasks: [task()],
      backlog: [],
      chapters: [chapter()],
      errors: [],
      checkin: checkin(),
    });
    expect(action.kind).toBe("task");
    expect(action.title).toContain("Practice Current Electricity");
    expect(action.to).toContain("/focus?");
  });

  it("falls back to due reviews when nothing is scheduled", () => {
    const action = getNextBestAction({
      todayKey: TODAY,
      tasks: [],
      backlog: [],
      chapters: [chapter()],
      errors: [error()],
      checkin: checkin(),
    });
    expect(action.kind).toBe("review");
    expect(action.title).toContain("Review 1 mistake");
  });

  it("uses the last active topic when there is no plan, backlog, or review", () => {
    const recent: FocusSessionDoc & { id: string } = {
      id: "session-1",
      subjectId: "subject-1",
      subjectName: "Physics",
      chapterId: "chapter-2",
      chapterName: "Kinematics",
      activity: "practice",
      mode: "50/10",
      plannedMinutes: 50,
      focusMinutes: 42,
      questionsDone: 18,
      startedAt: Timestamp.fromDate(new Date("2026-08-11T16:00:00")),
      date: "2026-08-11",
      completed: true,
    };
    const action = getNextBestAction({
      todayKey: TODAY,
      tasks: [],
      backlog: [],
      chapters: [],
      errors: [],
      recentSessions: [recent],
      checkin: checkin(),
    });
    expect(action.kind).toBe("continue");
    expect(action.title).toContain("Kinematics");
  });
});

describe("buildAutoPlan", () => {
  it("fills remaining time from backlog and weak topics", () => {
    const result = buildAutoPlan({
      dateKey: TODAY,
      dailyTargetMinutes: 150,
      tasks: [task({ estimatedMinutes: 30, priority: "med" })],
      backlog: [backlog({ estimatedMinutes: 35 })],
      chapters: [chapter()],
      subjects: [
        {
          id: "subject-1",
          name: "Physics",
          examType: "jeeMain",
          color: "#27834A",
          order: 0,
          chapterCount: 10,
          masteredCount: 2,
          accuracyNum: 0,
          accuracyDen: 0,
          focusMinutes: 0,
        },
      ],
      errors: [error()],
    });
    expect(result.remainingMinutes).toBe(120);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0].title).toBeTruthy();
  });
});
