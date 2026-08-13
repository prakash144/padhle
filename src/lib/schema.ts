/**
 * Single source of truth for every Firestore document shape.
 * Mirrors the data model in docs (see plan) — /users/{uid}/<collection>/{id}
 * unless noted as top-level.
 */
import type { Timestamp } from "firebase/firestore";

export type ExamType = "class10" | "class12" | "jeeMain" | "jeeAdvanced" | "neet";
export type TaskCategory = "jee" | "board" | "school" | "pyq" | "revision" | "mock";
export type TaskStatus = "todo" | "in_progress" | "done" | "carried" | "dropped";
export type TaskSource = "manual" | "revision" | "adaptive" | "mistakeSprint";
export type Priority = "low" | "med" | "high";
export type Difficulty = "easy" | "med" | "hard";
export type MasteryStage =
  | "not_started"
  | "learning"
  | "practicing"
  | "pyq"
  | "revised"
  | "mastered";
export type SprintType = "7" | "14" | "30" | "mistake";
export type PomodoroMode = "25/5" | "50/10" | "90/20" | "custom";
export type ErrorType = "concept" | "formula" | "calc" | "silly" | "guessed" | "time";
export type ErrorStatus = "open" | "reviewed" | "resolved";
export type BacklogOrigin = "unfinishedTask" | "manual" | "adaptive";
export type BacklogStatus = "pending" | "scheduled" | "cleared";
export type RevisionStatus = "pending" | "injected" | "done" | "skipped";

/* ---- Personalization (appearance + features) ---- */
export type ThemeMode = "light" | "dark" | "system";
export type PaletteId = "forest" | "ocean" | "indigo" | "plum" | "teal" | "warm";
export type FeatureKey =
  | "mocks"
  | "pyqs"
  | "errorBook"
  | "notes"
  | "sprints"
  | "focus"
  | "reports"
  | "forest";
export type SchoolLevel = "primary" | "middle" | "secondary" | "senior";

export type UserAddress = {
  line?: string;
  city?: string;
  state?: string;
};

/** /users/{uid} */
export interface UserDoc {
  displayName: string;
  email: string;
  photoURL?: string;
  /** School/college name shown on the profile. */
  school?: string;
  /** Class/grade (e.g. "12" or "Dropper"). Plain text so younger tiers fit the conceptual model. */
  grade?: string;
  /** Postal address (line, city, state) — optional contact details. */
  address?: UserAddress;
  stream?: ExamType;
  primaryExamId?: string;
  /** Active study lens used by shared screens such as Today, Planner and Syllabus. */
  activeStudyContext?: ExamType;
  timezone: string; // e.g. "Asia/Kolkata"
  /** Appearance + feature personalization (Profile → Appearance / Features). */
  appearance?: { mode?: ThemeMode; palette?: PaletteId };
  prefs?: { features?: Partial<Record<FeatureKey, boolean>> };
  /** Academic tier for younger-school onboarding (primary/middle/secondary). */
  academic?: { level?: SchoolLevel };
  pomodoroPrefs: {
    defaultMode: PomodoroMode;
    customFocus: number;
    customBreak: number;
  };
  throughput: Record<string, number>; // subjectId -> questions/hour
  lastCheckinDate?: string; // YYYY-MM-DD
  onboardedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // --- Engagement / gamification (see src/lib/gamification.ts) ---
  xp: number;
  streakCount: number;
  longestStreak: number;
  lastActiveDate?: string; // YYYY-MM-DD, drives streak continuation
  badges: string[]; // earned badge ids from the BADGES catalog
  parents?: string[]; // emails with read-only access — see src/lib/share.ts
}

/** /dailyQuote/{YYYY-MM-DD} (top-level, shared) */
export interface DailyQuoteDoc {
  text: string;
  author: string;
  fetchedAt: Timestamp;
}

/** /admins/{uid} — created manually in the Firebase console. Grants read-only admin dashboard access. */
export interface AdminDoc {
  email: string;
  grantedAt: Timestamp;
}

/** /users/{uid}/examGoals/{examId} */
export interface ExamGoalDoc {
  name: string;
  examType: ExamType;
  examDate: Timestamp;
  targetScore?: number;
  targetPercentile?: number;
  isPrimary: boolean;
  createdAt: Timestamp;
}

/** /users/{uid}/subjects/{subjectId} */
export interface SubjectDoc {
  name: string;
  examType: ExamType;
  color: string;
  order: number;
  chapterCount: number;
  masteredCount: number;
  accuracyNum: number;
  accuracyDen: number;
  focusMinutes: number;
}

/** /users/{uid}/chapters/{chapterId} */
export interface ChapterDoc {
  subjectId: string;
  subjectName: string;
  name: string;
  examType: ExamType;
  masteryStage: MasteryStage;
  stageEnteredAt: Timestamp;
  accuracyNum: number;
  accuracyDen: number;
  questionsAttempted: number;
  pyqsDone: number;
  focusMinutes: number;
  weightage?: number;
  revisionSchedule: { offset: number; dueDate: string; done: boolean }[];
  lastRevisedAt?: Timestamp;
  nextRevisionDue?: string; // YYYY-MM-DD
  updatedAt: Timestamp;
}

/** /users/{uid}/tasks/{taskId} */
export interface TaskDoc {
  title: string;
  category: TaskCategory;
  subjectId?: string;
  subjectName?: string;
  chapterId?: string;
  chapterName?: string;
  priority: Priority;
  difficulty: Difficulty;
  estimatedMinutes: number;
  targetQuestions?: number;
  deadline?: Timestamp;
  scheduledDate: string; // YYYY-MM-DD, primary query key
  status: TaskStatus;
  sprintId?: string;
  revisionId?: string;
  actualMinutes: number;
  questionsDone: number;
  source: TaskSource;
  completedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** /users/{uid}/sprints/{sprintId} */
export interface SprintDoc {
  name: string;
  type: SprintType;
  startDate: string;
  endDate: string;
  goals: {
    targetQuestions: number;
    targetPyqs: number;
    targetMocks: number;
    targetFocusHours: number;
  };
  progress: {
    questions: number;
    pyqs: number;
    mocks: number;
    focusMinutes: number;
  };
  status: "active" | "completed" | "abandoned";
  autoGenerated: boolean;
  createdAt: Timestamp;
}

export type FocusActivity = "lecture" | "practice" | "pyq" | "revision";

/** /users/{uid}/focusSessions/{sessionId} */
export interface FocusSessionDoc {
  taskId?: string;
  chapterId?: string;
  subjectId?: string;
  sprintId?: string;
  chapterName?: string;
  subjectName?: string;
  activity?: FocusActivity;
  mode: PomodoroMode;
  plannedMinutes: number;
  focusMinutes: number;
  questionsDone: number;
  startedAt: Timestamp;
  endedAt?: Timestamp;
  date: string; // YYYY-MM-DD
  completed: boolean;
}

/** /users/{uid}/mockTests/{testId} */
export interface MockTestDoc {
  name: string;
  examType: ExamType;
  date: string;
  totalMarks: number;
  maxMarks: number;
  percentile?: number;
  rank?: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  accuracy: number;
  timeSpentMinutes: number;
  marksLostWrong: number;
  marksLostUnattempted: number;
  sprintId?: string;
  subjectBreakdown: {
    subjectId: string;
    subjectName: string;
    marks: number;
    correct: number;
    incorrect: number;
    unattempted: number;
    timeMinutes: number;
  }[];
  createdAt: Timestamp;
}

/** /users/{uid}/errors/{errorId} — Error Book */
export interface ErrorBookDoc {
  subjectId: string;
  subjectName: string;
  chapterId?: string;
  chapterName?: string;
  mockTestId?: string;
  errorType: ErrorType;
  questionText?: string;
  whyWrong: string;
  reviewDate: string;
  status: ErrorStatus;
  createdAt: Timestamp;
}

/** /users/{uid}/backlog/{backlogId} */
export interface BacklogDoc {
  title: string;
  subjectId?: string;
  subjectName?: string;
  chapterId?: string;
  chapterName?: string;
  category: TaskCategory;
  estimatedMinutes?: number;
  priority: Priority;
  deadline?: Timestamp;
  origin: BacklogOrigin;
  sourceTaskId?: string;
  status: BacklogStatus;
  createdAt: Timestamp;
}

/** /users/{uid}/checkins/{YYYY-MM-DD} */
export interface CheckinDoc {
  date: string;
  top3: string[];
  top3TaskIds?: string[];
  dailyTargetMinutes?: number;
  reflection?: string;
  mood?: number; // 1-5
  completedGoals: number;
  createdAt: Timestamp;
  reflectedAt?: Timestamp;
}

/** /users/{uid}/revisions/{revisionId} */
export interface RevisionDoc {
  chapterId: string;
  chapterName: string;
  subjectName: string;
  offset: 1 | 3 | 7 | 15 | 30;
  dueDate: string;
  status: RevisionStatus;
  taskId?: string;
  createdAt: Timestamp;
}

/** /users/{uid}/counters/{bucketId} — bucketId = "day_YYYY-MM-DD" | "week_YYYY-Www" | "month_YYYY-MM" */
export interface CounterDoc {
  plannedTasks: number;
  completedTasks: number;
  focusMinutes: number;
  questionsDone: number;
  pyqsDone: number;
  revisionsDone: number;
  checkinDone: number; // 0 or 1
  mockCount: number;
}

/** /users/{uid}/reports/{period} — period = "week_YYYY-Www" | "month_YYYY-MM" */
export interface ReportDoc {
  period: string;
  focusScore: number;
  components: {
    taskCompletion: number;
    focusMinutes: number;
    practice: number;
    revision: number;
    planning: number;
  };
  time: { totalFocusHours: number; avgPerDay: number; bestDay: string };
  execution: { planned: number; completed: number; completionPct: number };
  practice: { questions: number; pyqs: number; accuracy: number };
  syllabus: { chaptersAdvanced: number; masteredDelta: number };
  suggestion: string;
  generatedAt: Timestamp;
}

/** /users/{uid}/notes/{noteId} — rich-text study notes (HTML, sanitized on write). */
export interface NoteDoc {
  title: string;
  html: string;
  color: string; // hex accent for the card/editor chrome
  pinned: boolean;
  subjectId?: string;
  subjectName?: string;
  chapterId?: string;
  chapterName?: string;
  tags?: string[]; // tag ids (see /users/{uid}/tags)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** /users/{uid}/tags/{tagId} — user-managed custom tags for organizing notes. */
export interface TagDoc {
  name: string;
  createdAt: Timestamp;
}

/** /users/{uid}/weeklyFocus/{weekKey} — next week's focus areas chosen in the weekly review. */
export interface WeeklyFocusDoc {
  areas: string[];
  createdAt: Timestamp;
}

export const emptyCounter = (): CounterDoc => ({
  plannedTasks: 0,
  completedTasks: 0,
  focusMinutes: 0,
  questionsDone: 0,
  pyqsDone: 0,
  revisionsDone: 0,
  checkinDone: 0,
  mockCount: 0,
});
