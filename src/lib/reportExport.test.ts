import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import {
  buildReportData,
  csvFilename,
  reportPeriod,
  serializeReportCsv,
  type ExportDataKey,
} from "@/lib/reportExport";
import type { ChapterDoc, FocusSessionDoc, SubjectDoc, TaskDoc, UserDoc } from "@/lib/schema";

const NOW = new Date(2026, 7, 12);

function user(overrides: Partial<UserDoc> = {}): UserDoc {
  return {
    displayName: "Aarav, \"The Focused\" Sharma",
    email: "aarav@example.com",
    stream: "jeeMain",
    timezone: "Asia/Kolkata",
    pomodoroPrefs: { defaultMode: "25/5", customFocus: 25, customBreak: 5 },
    throughput: {},
    createdAt: Timestamp.fromDate(NOW),
    updatedAt: Timestamp.fromDate(NOW),
    xp: 0,
    streakCount: 7,
    longestStreak: 9,
    badges: [],
    ...overrides,
  };
}

function subject(overrides: Partial<SubjectDoc & { id: string }> = {}): SubjectDoc & { id: string } {
  return {
    id: "physics",
    name: "Physics",
    examType: "jeeMain",
    color: "#176B4D",
    order: 1,
    chapterCount: 1,
    masteredCount: 0,
    accuracyNum: 19,
    accuracyDen: 25,
    focusMinutes: 60,
    ...overrides,
  };
}

function chapter(overrides: Partial<ChapterDoc & { id: string }> = {}): ChapterDoc & { id: string } {
  return {
    id: "current",
    subjectId: "physics",
    subjectName: "Physics",
    name: "Current, Electricity",
    examType: "jeeMain",
    masteryStage: "practicing",
    stageEnteredAt: Timestamp.fromDate(NOW),
    accuracyNum: 19,
    accuracyDen: 25,
    questionsAttempted: 25,
    pyqsDone: 6,
    focusMinutes: 60,
    revisionSchedule: [],
    updatedAt: Timestamp.fromDate(NOW),
    ...overrides,
  };
}

function session(overrides: Partial<FocusSessionDoc> = {}): FocusSessionDoc {
  return {
    date: "2026-08-12",
    subjectId: "physics",
    subjectName: "Physics",
    chapterId: "current",
    chapterName: "Current, Electricity",
    activity: "practice",
    mode: "25/5",
    plannedMinutes: 60,
    focusMinutes: 55,
    questionsDone: 25,
    startedAt: Timestamp.fromDate(NOW),
    completed: true,
    ...overrides,
  };
}

function task(overrides: Partial<TaskDoc & { id: string }> = {}): TaskDoc & { id: string } {
  return {
    id: "task-1",
    title: "Practice PYQs",
    category: "pyq",
    priority: "high",
    difficulty: "med",
    estimatedMinutes: 60,
    scheduledDate: "2026-08-12",
    status: "done",
    actualMinutes: 55,
    questionsDone: 25,
    source: "manual",
    createdAt: Timestamp.fromDate(NOW),
    updatedAt: Timestamp.fromDate(NOW),
    ...overrides,
  };
}

describe("reportPeriod", () => {
  it("builds stable weekly filenames", () => {
    const period = reportPeriod("week", undefined, undefined, NOW);
    expect(period.start).toBe("2026-08-10");
    expect(period.end).toBe("2026-08-16");
    expect(period.filenamePart).toBe("2026-08-10_to_2026-08-16");
  });

  it("normalizes inverted custom ranges", () => {
    const period = reportPeriod("custom", "2026-08-12", "2026-08-01", NOW);
    expect(period.start).toBe("2026-08-01");
    expect(period.end).toBe("2026-08-12");
  });
});

describe("buildReportData / serializeReportCsv", () => {
  it("creates normalized report data and escaped UTF-8 CSV", () => {
    const report = buildReportData({
      userDoc: user(),
      period: reportPeriod("day", undefined, undefined, NOW),
      preset: "weekly",
      subjects: [subject()],
      chapters: [chapter()],
      sessions: [session()],
      tasks: [task()],
      tests: [],
      errors: [],
      exams: [],
    });

    expect(report.student.name).toContain('"The Focused"');
    expect(report.kpis.focusMinutes).toBe(55);
    expect(report.subjects[0]).toMatchObject({ subject: "Physics", questions: 25, accuracyPct: 76 });

    const csv = serializeReportCsv(report, new Set<ExportDataKey>(["summary", "syllabus", "focus", "questions", "tasks"]));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"subject_performance"');
    expect(csv).toContain('"focus_minutes"');
    expect(csvFilename(report)).toBe("padhle_day_report_2026-08-12_to_2026-08-12.csv");
  });

  it("handles empty partial data without throwing", () => {
    const report = buildReportData({
      userDoc: user({ displayName: "Long Name ".repeat(20) }),
      period: reportPeriod("month", undefined, undefined, NOW),
      preset: "parent",
      subjects: [],
      chapters: [],
      sessions: [],
      tasks: [],
      tests: [],
      errors: [],
      exams: [],
    });

    expect(report.kpis.focusMinutes).toBe(0);
    expect(report.syllabus.coveragePct).toBe(0);
    expect(report.nextSteps.length).toBeGreaterThan(0);
    expect(() => serializeReportCsv(report, new Set<ExportDataKey>(["summary"]))).not.toThrow();
  });
});
