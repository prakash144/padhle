import { addDays, dayKey, monthKey, parseDayKey, startOfWeek } from "@/lib/dates";
import { buildAnalyticsInsights } from "@/lib/analytics";
import { buildPeriodSummary, computeFocusScore } from "@/lib/reports";
import { calculateMastery, summarizeSubjectMastery } from "@/lib/studyWorkflow";
import { emptyCounter } from "@/lib/schema";
import type {
  ChapterDoc,
  CounterDoc,
  ErrorBookDoc,
  ExamGoalDoc,
  FocusSessionDoc,
  MockTestDoc,
  SubjectDoc,
  TaskDoc,
  UserDoc,
} from "@/lib/schema";

export type ReportRange = "day" | "week" | "month" | "year" | "custom";
export type ExportFormat = "pdf" | "csv";
export type ReportPreset = "weekly" | "monthly" | "exam" | "parent";
export type ExportDataKey =
  | "summary"
  | "focus"
  | "questions"
  | "tests"
  | "syllabus"
  | "mistakes"
  | "revision"
  | "tasks";

export const EXPORT_DATA_LABEL: Record<ExportDataKey, string> = {
  summary: "Study Summary",
  focus: "Focus",
  questions: "Questions",
  tests: "Tests",
  syllabus: "Syllabus",
  mistakes: "Mistakes",
  revision: "Revision",
  tasks: "Tasks",
};

export interface ReportPeriod {
  range: ReportRange;
  start: string;
  end: string;
  label: string;
  filenamePart: string;
}

export interface ReportData {
  title: string;
  description: string;
  preset: ReportPreset;
  period: ReportPeriod;
  generatedAtIso: string;
  student: {
    name: string;
    email: string;
    classLabel: string;
    boardLabel: string;
    examLabel: string;
    targetLabel: string;
  };
  kpis: {
    focusMinutes: number;
    plannedMinutes: number;
    questions: number;
    tests: number;
    revisionMinutes: number;
    tasksCompleted: number;
    tasksPlanned: number;
    trees: number;
    streak: number;
    focusDeltaPct: number | null;
    focusScore: number | null;
  };
  syllabus: {
    coveragePct: number;
    masteryPct: number;
    covered: number;
    total: number;
  };
  subjects: ReportSubjectRow[];
  daily: ReportDailyRow[];
  tests: ReportTestRow[];
  mistakes: ReportMistakeRow[];
  strengths: string[];
  weaknesses: string[];
  insights: string[];
  nextSteps: string[];
}

export interface ReportSubjectRow {
  subject: string;
  focusMinutes: number;
  questions: number;
  accuracyPct: number | null;
  masteryPct: number;
}

export interface ReportDailyRow {
  date: string;
  focusMinutes: number;
  plannedMinutes: number;
  questions: number;
  tasksCompleted: number;
  tests: number;
}

export interface ReportTestRow {
  date: string;
  name: string;
  exam: string;
  score: number;
  maxScore: number;
  accuracyPct: number;
  attempted: number;
  timeSpentMinutes: number;
}

export interface ReportMistakeRow {
  date: string;
  subject: string;
  topic: string;
  errorType: string;
  status: string;
  reviewDate: string;
}

export interface BuildReportDataInput {
  userDoc: UserDoc;
  period: ReportPeriod;
  preset: ReportPreset;
  counter?: CounterDoc;
  previousCounter?: CounterDoc;
  subjects: (SubjectDoc & { id: string })[];
  chapters: (ChapterDoc & { id: string })[];
  sessions: (FocusSessionDoc & { id?: string })[];
  tasks: (TaskDoc & { id: string })[];
  tests: (MockTestDoc & { id: string })[];
  errors: (ErrorBookDoc & { id: string })[];
  exams: (ExamGoalDoc & { id: string })[];
}

const EXAM_LABEL: Record<string, string> = {
  class10: "Class 10 Boards",
  class12: "Class 12 Boards",
  jeeMain: "JEE Main",
  jeeAdvanced: "JEE Advanced",
  neet: "NEET",
};

export function reportPeriod(range: ReportRange, customStart?: string, customEnd?: string, now = new Date()): ReportPeriod {
  let start: string;
  let end: string;
  switch (range) {
    case "day":
      start = dayKey(now);
      end = start;
      break;
    case "week":
      start = dayKey(startOfWeek(now));
      end = dayKey(addDays(startOfWeek(now), 6));
      break;
    case "month":
      start = `${monthKey(now)}-01`;
      end = dayKey(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      break;
    case "year":
      start = `${now.getFullYear()}-01-01`;
      end = `${now.getFullYear()}-12-31`;
      break;
    case "custom":
      start = customStart || dayKey(addDays(now, -6));
      end = customEnd || dayKey(now);
      if (start > end) [start, end] = [end, start];
      break;
  }

  return {
    range,
    start,
    end,
    label: `${formatDate(start)} - ${formatDate(end)}`,
    filenamePart: `${start}_to_${end}`,
  };
}

export function buildReportData(input: BuildReportDataInput): ReportData {
  const primaryExam = input.exams.find((exam) => exam.isPrimary) ?? input.exams[0];
  const focusSessions = input.sessions
    .filter((session) => inRange(session.date, input.period))
    .sort((a, b) => a.date.localeCompare(b.date));
  const tasks = input.tasks
    .filter((task) => inRange(task.scheduledDate, input.period))
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  const tests = input.tests
    .filter((test) => inRange(test.date, input.period))
    .sort((a, b) => a.date.localeCompare(b.date));
  const mistakes = input.errors
    .filter((error) => {
      const key = timestampDayKey(error.createdAt) ?? error.reviewDate;
      return inRange(key, input.period);
    })
    .sort((a, b) => (timestampDayKey(a.createdAt) ?? a.reviewDate).localeCompare(timestampDayKey(b.createdAt) ?? b.reviewDate));

  const derived = deriveCounter(focusSessions, tasks, tests);
  const counter = input.counter ?? derived;
  const previous = input.previousCounter;
  const periodSummary = buildPeriodSummary(counter, previous);
  const score = input.period.range === "custom" || input.period.range === "year" ? null : computeFocusScore(counter).score;
  const subjectRows = buildSubjectRows(input.subjects, input.chapters, focusSessions);
  const daily = buildDailyRows(input.period, focusSessions, tasks, tests);
  const syllabus = buildSyllabusSummary(input.chapters);
  const analyticsInsights = buildAnalyticsInsights({
    sessions: input.sessions,
    filter: periodToAnalyticsFilter(input.period),
    subjects: input.subjects,
    chapters: input.chapters,
    errors: input.errors,
    tests: input.tests,
    now: parseDayKey(input.period.end),
  });

  const openMistakes = input.errors.filter((error) => error.status === "open").length;
  const weakestSubject = subjectRows.slice().sort((a, b) => a.masteryPct - b.masteryPct)[0];
  const strongestSubject = subjectRows.slice().sort((a, b) => {
    const aa = a.accuracyPct ?? 0;
    const ba = b.accuracyPct ?? 0;
    return ba + b.masteryPct - (aa + a.masteryPct);
  })[0];

  return {
    title: presetTitle(input.preset),
    description: presetDescription(input.preset),
    preset: input.preset,
    period: input.period,
    generatedAtIso: new Date().toISOString(),
    student: {
      name: input.userDoc.displayName || input.userDoc.email || "Student",
      email: input.userDoc.email,
      classLabel: classLabel(input.userDoc),
      boardLabel: "Not set",
      examLabel: primaryExam ? EXAM_LABEL[primaryExam.examType] ?? primaryExam.name : EXAM_LABEL[input.userDoc.stream ?? ""] ?? "Not set",
      targetLabel: targetLabel(primaryExam),
    },
    kpis: {
      focusMinutes: counter.focusMinutes,
      plannedMinutes: focusSessions.reduce((sum, session) => sum + session.plannedMinutes, 0) || tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0),
      questions: counter.questionsDone,
      tests: counter.mockCount || tests.length,
      revisionMinutes: focusSessions.filter((session) => session.activity === "revision").reduce((sum, session) => sum + session.focusMinutes, 0),
      tasksCompleted: counter.completedTasks,
      tasksPlanned: counter.plannedTasks,
      trees: focusSessions.filter((session) => session.completed).length,
      streak: input.userDoc.streakCount ?? 0,
      focusDeltaPct: periodSummary.focusDeltaPct,
      focusScore: score,
    },
    syllabus,
    subjects: subjectRows,
    daily,
    tests: tests.map((test) => ({
      date: test.date,
      name: test.name,
      exam: EXAM_LABEL[test.examType] ?? test.examType,
      score: test.totalMarks,
      maxScore: test.maxMarks,
      accuracyPct: test.accuracy,
      attempted: test.attempted,
      timeSpentMinutes: test.timeSpentMinutes,
    })),
    mistakes: mistakes.map((error) => ({
      date: timestampDayKey(error.createdAt) ?? error.reviewDate,
      subject: error.subjectName,
      topic: error.chapterName ?? "",
      errorType: error.errorType,
      status: error.status,
      reviewDate: error.reviewDate,
    })),
    strengths: [
      strongestSubject ? `${strongestSubject.subject} is the strongest subject signal.` : "Study activity is ready to build from.",
      counter.checkinDone > 0 ? "Planning rhythm is visible in this period." : "Focus sessions are being tracked consistently.",
    ],
    weaknesses: [
      openMistakes > 0 ? `${openMistakes} mistakes remain unrevised.` : "No open mistake pressure detected.",
      weakestSubject ? `${weakestSubject.subject} has the lowest mastery signal.` : "Add syllabus subjects for deeper mastery tracking.",
    ],
    insights: analyticsInsights.length > 0 ? analyticsInsights.map((insight) => insight.detail) : [periodSummary.nextChange],
    nextSteps: buildNextSteps({ openMistakes, weakestSubject, counter, primaryExam }),
  };
}

export function csvFilename(report: ReportData): string {
  return `padhle_${report.period.range}_report_${report.period.filenamePart}.csv`;
}

export function serializeReportCsv(report: ReportData, include: Set<ExportDataKey>): string {
  const rows: string[][] = [];
  rows.push(["Dataset", "Date", "Subject", "Topic", "Metric", "Value", "Unit", "Notes"]);
  if (include.has("summary")) {
    addMetric(rows, report.period.start, "", "", "focus_minutes", report.kpis.focusMinutes, "minutes");
    addMetric(rows, report.period.start, "", "", "planned_minutes", report.kpis.plannedMinutes, "minutes");
    addMetric(rows, report.period.start, "", "", "questions", report.kpis.questions, "count");
    addMetric(rows, report.period.start, "", "", "tests", report.kpis.tests, "count");
    addMetric(rows, report.period.start, "", "", "trees", report.kpis.trees, "count");
    addMetric(rows, report.period.start, "", "", "streak_days", report.kpis.streak, "days");
    addMetric(rows, report.period.start, "", "", "coverage_pct", report.syllabus.coveragePct, "percent");
    addMetric(rows, report.period.start, "", "", "mastery_pct", report.syllabus.masteryPct, "percent");
  }
  if (include.has("focus") || include.has("questions") || include.has("tasks")) {
    report.daily.forEach((day) => {
      if (include.has("focus")) addMetric(rows, day.date, "", "", "focus_minutes", day.focusMinutes, "minutes");
      if (include.has("focus")) addMetric(rows, day.date, "", "", "planned_minutes", day.plannedMinutes, "minutes");
      if (include.has("questions")) addMetric(rows, day.date, "", "", "questions", day.questions, "count");
      if (include.has("tasks")) addMetric(rows, day.date, "", "", "tasks_completed", day.tasksCompleted, "count");
    });
  }
  if (include.has("syllabus") || include.has("focus") || include.has("questions")) {
    report.subjects.forEach((subject) => {
      rows.push([
        "subject_performance",
        report.period.end,
        subject.subject,
        "",
        "subject_summary",
        String(subject.focusMinutes),
        "focus_minutes",
        `questions=${subject.questions}; accuracy_pct=${subject.accuracyPct ?? ""}; mastery_pct=${subject.masteryPct}`,
      ]);
    });
  }
  if (include.has("tests")) {
    report.tests.forEach((test) => {
      rows.push(["tests", test.date, "", "", "test_score", String(test.score), "marks", `${test.name}; max=${test.maxScore}; accuracy_pct=${test.accuracyPct}; attempted=${test.attempted}; minutes=${test.timeSpentMinutes}`]);
    });
  }
  if (include.has("mistakes")) {
    report.mistakes.forEach((mistake) => {
      rows.push(["mistakes", mistake.date, mistake.subject, mistake.topic, mistake.errorType, mistake.status, "", `review_date=${mistake.reviewDate}`]);
    });
  }
  if (include.has("revision")) {
    addMetric(rows, report.period.start, "", "", "revision_minutes", report.kpis.revisionMinutes, "minutes");
  }
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function addMetric(rows: string[][], date: string, subject: string, topic: string, metric: string, value: string | number, unit: string) {
  rows.push(["summary", date, subject, topic, metric, String(value), unit, ""]);
}

function buildSubjectRows(
  subjects: (SubjectDoc & { id: string })[],
  chapters: (ChapterDoc & { id: string })[],
  sessions: (FocusSessionDoc & { id?: string })[]
): ReportSubjectRow[] {
  return subjects.map((subject) => {
    const subjectSessions = sessions.filter((session) => session.subjectId === subject.id || session.subjectName === subject.name);
    const subjectChapters = chapters.filter((chapter) => chapter.subjectId === subject.id);
    const summary = summarizeSubjectMastery(subject, subjectChapters);
    const questions = subjectSessions.reduce((sum, session) => sum + session.questionsDone, 0);
    const accuracyPct = subject.accuracyDen > 0 ? Math.round((subject.accuracyNum / subject.accuracyDen) * 100) : null;
    return {
      subject: subject.name,
      focusMinutes: subjectSessions.reduce((sum, session) => sum + session.focusMinutes, 0),
      questions,
      accuracyPct,
      masteryPct: summary.masteryPct,
    };
  });
}

function buildDailyRows(
  period: ReportPeriod,
  sessions: (FocusSessionDoc & { id?: string })[],
  tasks: (TaskDoc & { id: string })[],
  tests: (MockTestDoc & { id: string })[]
): ReportDailyRow[] {
  const rows: ReportDailyRow[] = [];
  for (let d = parseDayKey(period.start); dayKey(d) <= period.end; d = addDays(d, 1)) {
    const key = dayKey(d);
    const daySessions = sessions.filter((session) => session.date === key);
    const dayTasks = tasks.filter((task) => task.scheduledDate === key);
    rows.push({
      date: key,
      focusMinutes: daySessions.reduce((sum, session) => sum + session.focusMinutes, 0),
      plannedMinutes: daySessions.reduce((sum, session) => sum + session.plannedMinutes, 0) || dayTasks.reduce((sum, task) => sum + task.estimatedMinutes, 0),
      questions: daySessions.reduce((sum, session) => sum + session.questionsDone, 0),
      tasksCompleted: dayTasks.filter((task) => task.status === "done").length,
      tests: tests.filter((test) => test.date === key).length,
    });
    if (rows.length >= 370) break;
  }
  return rows;
}

function buildSyllabusSummary(chapters: (ChapterDoc & { id: string })[]) {
  const total = chapters.length;
  const snapshots = chapters.map((chapter) => calculateMastery(chapter));
  const covered = snapshots.filter((snapshot) => snapshot.coveragePct > 0).length;
  return {
    coveragePct: total > 0 ? Math.round((covered / total) * 100) : 0,
    masteryPct: total > 0 ? Math.round(snapshots.reduce((sum, snapshot) => sum + snapshot.masteryPct, 0) / total) : 0,
    covered,
    total,
  };
}

function deriveCounter(
  sessions: (FocusSessionDoc & { id?: string })[],
  tasks: (TaskDoc & { id: string })[],
  tests: (MockTestDoc & { id: string })[]
): CounterDoc {
  return {
    ...emptyCounter(),
    plannedTasks: tasks.length,
    completedTasks: tasks.filter((task) => task.status === "done").length,
    focusMinutes: sessions.reduce((sum, session) => sum + session.focusMinutes, 0),
    questionsDone: sessions.reduce((sum, session) => sum + session.questionsDone, 0),
    pyqsDone: sessions.filter((session) => session.activity === "pyq").reduce((sum, session) => sum + session.questionsDone, 0),
    revisionsDone: sessions.filter((session) => session.activity === "revision").length,
    mockCount: tests.length,
  };
}

export function periodToAnalyticsFilter(period: ReportPeriod) {
  if (period.range === "year") return { kind: "year" as const, year: Number(period.start.slice(0, 4)) };
  if (period.range === "custom") return { kind: "custom" as const, customStart: period.start, customEnd: period.end };
  return { kind: period.range };
}

function presetTitle(preset: ReportPreset): string {
  if (preset === "monthly") return "Monthly Progress Report";
  if (preset === "exam") return "Exam Preparation Report";
  if (preset === "parent") return "Parent/Mentor Report";
  return "Weekly Study Report";
}

function presetDescription(preset: ReportPreset): string {
  if (preset === "exam") return "Syllabus, mastery, test performance, mistakes, revision, and exam readiness.";
  if (preset === "parent") return "A simple read-only summary of study consistency, progress, tests, and next priorities.";
  if (preset === "monthly") return "Your monthly study performance, progress trend, and improvement priorities.";
  return "Your weekly study performance and progress summary.";
}

function buildNextSteps({
  openMistakes,
  weakestSubject,
  counter,
  primaryExam,
}: {
  openMistakes: number;
  weakestSubject?: ReportSubjectRow;
  counter: CounterDoc;
  primaryExam?: ExamGoalDoc & { id: string };
}): string[] {
  const steps: string[] = [];
  if (openMistakes > 0) steps.push(`Revise ${openMistakes} open mistake${openMistakes === 1 ? "" : "s"}.`);
  if (weakestSubject) steps.push(`Schedule focused practice for ${weakestSubject.subject}.`);
  if (counter.completedTasks < counter.plannedTasks) steps.push("Reschedule unfinished planned tasks.");
  if (primaryExam) steps.push(`Keep exam plan aligned to ${EXAM_LABEL[primaryExam.examType] ?? primaryExam.name}.`);
  if (steps.length === 0) steps.push("Maintain the current plan-focus-practice-review rhythm.");
  return steps.slice(0, 4);
}

function classLabel(userDoc: UserDoc): string {
  if (userDoc.academic?.level === "primary") return "Primary";
  if (userDoc.academic?.level === "middle") return "Middle school";
  if (userDoc.stream === "class10") return "Class 10";
  if (userDoc.stream === "class12") return "Class 12";
  return "Not set";
}

function targetLabel(exam?: ExamGoalDoc & { id: string }): string {
  if (!exam) return "Not set";
  if (exam.targetPercentile) return `${exam.targetPercentile} percentile`;
  if (exam.targetScore) return `${exam.targetScore} target score`;
  return "Not set";
}

function timestampDayKey(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("toDate" in value)) return null;
  return dayKey((value as { toDate: () => Date }).toDate());
}

function inRange(date: string, period: ReportPeriod): boolean {
  return date >= period.start && date <= period.end;
}

function formatDate(key: string): string {
  return parseDayKey(key).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function csvCell(value: string): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}
