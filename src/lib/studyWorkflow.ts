import { dayKey, daysBetween, parseDayKey } from "@/lib/dates";
import type {
  BacklogDoc,
  ChapterDoc,
  CheckinDoc,
  ErrorBookDoc,
  ExamGoalDoc,
  FocusSessionDoc,
  Priority,
  SubjectDoc,
  TaskCategory,
  TaskDoc,
} from "@/lib/schema";

export type MasteryState =
  | "not_started"
  | "learning"
  | "practicing"
  | "weak"
  | "needs_revision"
  | "mastered";

export type TopicAction = "start" | "continue" | "practice" | "revise";

export interface ChapterMasterySnapshot {
  chapterId: string;
  subjectId: string;
  chapterName: string;
  subjectName: string;
  state: MasteryState;
  action: TopicAction;
  stateLabel: string;
  masteryPct: number;
  coveragePct: number;
  accuracyPct: number | null;
  openMistakes: number;
  dueMistakes: number;
  dueRevision: boolean;
  priorityScore: number;
  reason: string;
}

export interface SubjectMasterySummary {
  coveragePct: number;
  masteryPct: number;
  masteredCount: number;
  weakCount: number;
  needsRevisionCount: number;
  nextTopic?: ChapterMasterySnapshot;
}

export interface NextBestAction {
  kind: "task" | "review" | "practice" | "backlog" | "continue" | "checkin" | "plan";
  title: string;
  detail: string;
  reason: string;
  ctaLabel: string;
  to?: string;
}

export interface AutoPlanSuggestion {
  id: string;
  source: "backlog" | "weak_topic" | "mistake_review";
  title: string;
  reason: string;
  category: TaskCategory;
  priority: Priority;
  estimatedMinutes: number;
  targetQuestions?: number;
  subjectId?: string;
  subjectName?: string;
  chapterId?: string;
  chapterName?: string;
  deadline?: Date;
  backlogId?: string;
}

export interface AutoPlanResult {
  targetMinutes: number;
  scheduledMinutes: number;
  remainingMinutes: number;
  suggestions: AutoPlanSuggestion[];
}

const STAGE_BASE: Record<ChapterDoc["masteryStage"], number> = {
  not_started: 0,
  learning: 24,
  practicing: 46,
  pyq: 62,
  revised: 78,
  mastered: 92,
};

const PRIORITY_WEIGHT: Record<Priority, number> = {
  low: 1,
  med: 2,
  high: 3,
};

const MASTER_LABEL: Record<MasteryState, string> = {
  not_started: "Not started",
  learning: "Learning",
  practicing: "Practicing",
  weak: "Weak",
  needs_revision: "Needs revision",
  mastered: "Mastered",
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function accuracyPct(chapter: ChapterDoc): number | null {
  if (!chapter.accuracyDen) return null;
  return Math.round((chapter.accuracyNum / chapter.accuracyDen) * 100);
}

function hasCoverage(chapter: ChapterDoc) {
  return (
    chapter.masteryStage !== "not_started" ||
    chapter.focusMinutes > 0 ||
    chapter.questionsAttempted > 0 ||
    chapter.pyqsDone > 0
  );
}

function examUrgencyBoost(primaryExam?: ExamGoalDoc | null) {
  if (!primaryExam) return 0;
  const daysLeft = daysBetween(new Date(), primaryExam.examDate.toDate());
  if (daysLeft <= 14) return 18;
  if (daysLeft <= 30) return 10;
  if (daysLeft <= 60) return 4;
  return 0;
}

export function taskCategoryForExam(examType?: SubjectDoc["examType"]): TaskCategory {
  if (!examType) return "jee";
  if (examType === "class10" || examType === "class12") return "board";
  return "jee";
}

function titleMatchesPriorities(
  task: Pick<TaskDoc, "title" | "subjectName" | "chapterName">,
  priorities: string[]
) {
  const haystack = [task.title, task.subjectName, task.chapterName].filter(Boolean).join(" ").toLowerCase();
  return priorities.reduce((score, raw, i) => {
    const term = raw.trim().toLowerCase();
    if (!term || term.length < 3) return score;
    return haystack.includes(term) ? score + Math.max(4, 12 - i * 3) : score;
  }, 0);
}

function taskToFocusUrl(
  task: Pick<TaskDoc, "subjectId" | "chapterId" | "targetQuestions" | "category" | "sprintId"> & {
    id?: string;
  }
) {
  const params = new URLSearchParams();
  if (task.id) params.set("taskId", task.id);
  if (task.subjectId) params.set("subjectId", task.subjectId);
  if (task.chapterId) params.set("chapterId", task.chapterId);
  if (task.sprintId) params.set("sprintId", task.sprintId);
  if (task.targetQuestions) params.set("target", String(task.targetQuestions));
  if (task.category === "revision") params.set("activity", "revision");
  else if (task.category === "pyq") params.set("activity", "pyq");
  else params.set("activity", "practice");
  const query = params.toString();
  return query ? `/focus?${query}` : "/focus";
}

function parseMaybeDate(value?: { toDate?: () => Date } | Date | null) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  return null;
}

export function calculateMastery(
  chapter: ChapterDoc & { id: string },
  options?: {
    todayKey?: string;
    openMistakes?: number;
    dueMistakes?: number;
    primaryExam?: ExamGoalDoc | null;
  }
): ChapterMasterySnapshot {
  const today = options?.todayKey ?? dayKey(new Date());
  const openMistakes = options?.openMistakes ?? 0;
  const dueMistakes = options?.dueMistakes ?? 0;
  const acc = accuracyPct(chapter);
  const started = hasCoverage(chapter);
  const dueRevision = !!chapter.nextRevisionDue && chapter.nextRevisionDue <= today;

  let score = STAGE_BASE[chapter.masteryStage];
  score += Math.min(14, Math.round(chapter.focusMinutes / 18));
  score += Math.min(10, Math.round(chapter.questionsAttempted / 5));
  score += Math.min(8, Math.round(chapter.pyqsDone / 3));

  if (acc !== null) {
    if (acc >= 85) score += 8;
    else if (acc >= 70) score += 4;
    else if (acc < 60) score -= 18;
    else score -= 8;
  }

  score -= Math.min(24, openMistakes * 6);
  score -= Math.min(18, dueMistakes * 8);
  if (dueRevision) score -= 16;
  score = clamp(score, 0, 100);

  let state: MasteryState;
  let reason: string;

  if (!started) {
    state = "not_started";
    reason = "No sessions or questions logged yet.";
  } else if (dueRevision || dueMistakes > 0) {
    state = "needs_revision";
    reason = dueRevision
      ? "Revision is due now. Refresh this before you lose speed."
      : "Mistakes are waiting here. Close the loop before moving on.";
  } else if ((acc !== null && acc < 60) || openMistakes >= 2) {
    state = "weak";
    reason =
      acc !== null && acc < 60
        ? `Accuracy is ${acc}%. This needs a tighter practice loop.`
        : "Repeated mistakes are still clustered here.";
  } else if (chapter.masteryStage === "mastered" && (acc === null || acc >= 70)) {
    state = "mastered";
    reason = "Strong evidence across practice, revision, and accuracy.";
  } else if (chapter.masteryStage === "learning" || score < 40) {
    state = "learning";
    reason = "You've started. One more solid pass will make this stick.";
  } else {
    state = "practicing";
    reason =
      chapter.pyqsDone > 0
        ? "You're building exam-speed reps here."
        : "The base is in place. Keep practicing until it feels automatic.";
  }

  const urgency = examUrgencyBoost(options?.primaryExam);
  const priorityScore =
    (chapter.weightage ?? 0) * 4 +
    (100 - score) +
    openMistakes * 10 +
    dueMistakes * 12 +
    (dueRevision ? 18 : 0) +
    urgency;

  const action: TopicAction =
    state === "not_started"
      ? "start"
      : state === "learning"
        ? "continue"
        : state === "mastered" || state === "needs_revision"
          ? "revise"
          : "practice";

  return {
    chapterId: chapter.id,
    subjectId: chapter.subjectId,
    chapterName: chapter.name,
    subjectName: chapter.subjectName,
    state,
    action,
    stateLabel: MASTER_LABEL[state],
    masteryPct: score,
    coveragePct: started ? 100 : 0,
    accuracyPct: acc,
    openMistakes,
    dueMistakes,
    dueRevision,
    priorityScore,
    reason,
  };
}

export function summarizeSubjectMastery(
  subject: SubjectDoc & { id: string },
  chapters: (ChapterDoc & { id: string })[],
  errors: (ErrorBookDoc & { id: string })[] = [],
  todayKey: string = dayKey(new Date()),
  primaryExam?: ExamGoalDoc | null
): SubjectMasterySummary {
  void subject;
  const chapterErrors = chapters.map((chapter) => {
    const openMistakes = errors.filter((e) => e.chapterId === chapter.id).length;
    const dueMistakes = errors.filter(
      (e) => e.chapterId === chapter.id && e.reviewDate <= todayKey
    ).length;
    return calculateMastery(chapter, {
      todayKey,
      openMistakes,
      dueMistakes,
      primaryExam,
    });
  });

  if (chapterErrors.length === 0) {
    return {
      coveragePct: 0,
      masteryPct: 0,
      masteredCount: 0,
      weakCount: 0,
      needsRevisionCount: 0,
    };
  }

  const coveragePct = Math.round(
    chapterErrors.reduce((sum, c) => sum + c.coveragePct, 0) / chapterErrors.length
  );
  const masteryPct = Math.round(
    chapterErrors.reduce((sum, c) => sum + c.masteryPct, 0) / chapterErrors.length
  );
  const weakCount = chapterErrors.filter((c) => c.state === "weak").length;
  const needsRevisionCount = chapterErrors.filter((c) => c.state === "needs_revision").length;
  const masteredCount = chapterErrors.filter((c) => c.state === "mastered").length;
  const nextTopic = [...chapterErrors].sort((a, b) => b.priorityScore - a.priorityScore)[0];

  return {
    coveragePct,
    masteryPct,
    masteredCount,
    weakCount,
    needsRevisionCount,
    nextTopic,
  };
}

export function getWeakTopics(input: {
  chapters: (ChapterDoc & { id: string })[];
  errors?: (ErrorBookDoc & { id: string })[];
  todayKey?: string;
  primaryExam?: ExamGoalDoc | null;
}) {
  const today = input.todayKey ?? dayKey(new Date());
  const errors = input.errors ?? [];
  return input.chapters
    .map((chapter) =>
      calculateMastery(chapter, {
        todayKey: today,
        openMistakes: errors.filter((e) => e.chapterId === chapter.id).length,
        dueMistakes: errors.filter((e) => e.chapterId === chapter.id && e.reviewDate <= today).length,
        primaryExam: input.primaryExam,
      })
    )
    .filter((chapter) => chapter.state === "weak" || chapter.state === "needs_revision")
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

export function getNextBestAction(input: {
  todayKey?: string;
  tasks: (TaskDoc & { id: string })[];
  backlog: (BacklogDoc & { id: string })[];
  chapters: (ChapterDoc & { id: string })[];
  errors?: (ErrorBookDoc & { id: string })[];
  recentSessions?: (FocusSessionDoc & { id: string })[];
  checkin?: (CheckinDoc & { id: string }) | null;
  primaryExam?: ExamGoalDoc | null;
}): NextBestAction {
  const today = input.todayKey ?? dayKey(new Date());
  const errors = input.errors ?? [];
  const priorities = input.checkin?.top3 ?? [];
  const weakTopics = getWeakTopics({
    chapters: input.chapters,
    errors,
    todayKey: today,
    primaryExam: input.primaryExam,
  });

  const weakMap = new Map(weakTopics.map((topic) => [topic.chapterId, topic]));
  const pendingTasks = input.tasks.filter((task) => task.status !== "done");
  const rankedTask = [...pendingTasks].sort((a, b) => {
    const aDeadline = parseMaybeDate(a.deadline);
    const bDeadline = parseMaybeDate(b.deadline);
    const aDays = aDeadline ? daysBetween(new Date(), aDeadline) : 999;
    const bDays = bDeadline ? daysBetween(new Date(), bDeadline) : 999;
    const aScore =
      PRIORITY_WEIGHT[a.priority] * 20 +
      (a.category === "revision" ? 26 : 0) +
      (a.source === "revision" ? 12 : 0) +
      titleMatchesPriorities(a, priorities) +
      Math.max(0, 24 - aDays * 4) +
      (weakMap.get(a.chapterId ?? "")?.priorityScore ?? 0) / 8;
    const bScore =
      PRIORITY_WEIGHT[b.priority] * 20 +
      (b.category === "revision" ? 26 : 0) +
      (b.source === "revision" ? 12 : 0) +
      titleMatchesPriorities(b, priorities) +
      Math.max(0, 24 - bDays * 4) +
      (weakMap.get(b.chapterId ?? "")?.priorityScore ?? 0) / 8;
    return bScore - aScore;
  })[0];

  if (rankedTask) {
    const weakTopic = rankedTask.chapterId ? weakMap.get(rankedTask.chapterId) : undefined;
    const detail = [rankedTask.subjectName, rankedTask.chapterName].filter(Boolean).join(" · ");
    return {
      kind: "task",
      title: rankedTask.title,
      detail: detail || "Today's plan",
      reason:
        rankedTask.category === "revision"
          ? "Revision is already on your plan. Close that first."
          : weakTopic?.state === "weak"
            ? "This is tied to a weak topic, so it moves the needle fastest."
            : "This is the highest-value task already on today's plan.",
      ctaLabel: rankedTask.category === "revision" ? "Revise now" : "Start focus",
      to: taskToFocusUrl(rankedTask),
    };
  }

  const dueErrors = errors.filter((error) => error.reviewDate <= today);
  if (dueErrors.length > 0) {
    const first = dueErrors[0];
    return {
      kind: "review",
      title: `Review ${dueErrors.length} mistake${dueErrors.length > 1 ? "s" : ""}`,
      detail: first.chapterName ?? first.subjectName,
      reason: "Mistakes already due are the easiest marks to recover next.",
      ctaLabel: "Open mistake log",
      to: "/errors",
    };
  }

  const topWeak = weakTopics[0];
  if (topWeak) {
    const params = new URLSearchParams({
      subjectId: topWeak.subjectId,
      chapterId: topWeak.chapterId,
      activity: topWeak.action === "revise" ? "revision" : "practice",
    });
    return {
      kind: "practice",
      title:
        topWeak.action === "revise"
          ? `Revise ${topWeak.chapterName}`
          : `Practice ${topWeak.chapterName}`,
      detail: `${topWeak.subjectName} · ${topWeak.stateLabel}`,
      reason: topWeak.reason,
      ctaLabel: topWeak.action === "revise" ? "Revise topic" : "Practice topic",
      to: `/focus?${params.toString()}`,
    };
  }

  const topBacklog = [...input.backlog].sort((a, b) => {
    const aAge = ageInDays(a.createdAt, today);
    const bAge = ageInDays(b.createdAt, today);
    const aDays = parseMaybeDate(a.deadline) ? daysBetween(new Date(), parseMaybeDate(a.deadline)!) : 999;
    const bDays = parseMaybeDate(b.deadline) ? daysBetween(new Date(), parseMaybeDate(b.deadline)!) : 999;
    const aScore = PRIORITY_WEIGHT[a.priority] * 20 + aAge * 2 + Math.max(0, 18 - aDays * 3);
    const bScore = PRIORITY_WEIGHT[b.priority] * 20 + bAge * 2 + Math.max(0, 18 - bDays * 3);
    return bScore - aScore;
  })[0];
  if (topBacklog) {
    return {
      kind: "backlog",
      title: topBacklog.title,
      detail: [topBacklog.subjectName, topBacklog.chapterName].filter(Boolean).join(" · ") || "Backlog",
      reason: "Nothing is scheduled right now. Pull the strongest item from backlog.",
      ctaLabel: "Open backlog",
      to: "/backlog",
    };
  }

  const lastSession = [...(input.recentSessions ?? [])]
    .reverse()
    .find((session) => session.chapterId || session.subjectId);
  if (lastSession) {
    const params = new URLSearchParams();
    if (lastSession.subjectId) params.set("subjectId", lastSession.subjectId);
    if (lastSession.chapterId) params.set("chapterId", lastSession.chapterId);
    params.set("activity", lastSession.activity ?? "practice");
    return {
      kind: "continue",
      title: `Continue ${lastSession.chapterName ?? lastSession.subjectName ?? "your last topic"}`,
      detail: `${lastSession.focusMinutes} min last session`,
      reason: "Restarting the last active topic is the lowest-friction way back in.",
      ctaLabel: "Continue learning",
      to: `/focus?${params.toString()}`,
    };
  }

  if (!input.checkin || input.checkin.top3.length === 0) {
    return {
      kind: "checkin",
      title: "Set today's target",
      detail: "Add a target and your top three priorities.",
      reason: "Padhle works best when the day starts with one clear plan.",
      ctaLabel: "Morning check-in",
    };
  }

  return {
    kind: "plan",
    title: "Plan the next block",
    detail: "Nothing urgent is queued right now.",
    reason: "Use the planner to turn the next chapter into a concrete task.",
    ctaLabel: "Open planner",
    to: "/planner",
  };
}

function ageInDays(value: { toDate?: () => Date } | Date, todayKey: string) {
  const created = parseMaybeDate(value);
  if (!created) return 0;
  return Math.max(0, daysBetween(created, parseDayKey(todayKey)));
}

export function buildAutoPlan(input: {
  dateKey: string;
  dailyTargetMinutes?: number;
  tasks: (TaskDoc & { id: string })[];
  backlog: (BacklogDoc & { id: string })[];
  chapters: (ChapterDoc & { id: string })[];
  subjects: (SubjectDoc & { id: string })[];
  errors?: (ErrorBookDoc & { id: string })[];
  primaryExam?: ExamGoalDoc | null;
}) : AutoPlanResult {
  const targetMinutes = clamp(input.dailyTargetMinutes ?? 180, 60, 600);
  const scheduledMinutes = input.tasks
    .filter((task) => task.status !== "done")
    .reduce((sum, task) => sum + (task.estimatedMinutes || 0), 0);
  const remainingMinutes = Math.max(0, targetMinutes - scheduledMinutes);

  if (remainingMinutes < 20) {
    return { targetMinutes, scheduledMinutes, remainingMinutes, suggestions: [] };
  }

  const errors = input.errors ?? [];
  const weakTopics = getWeakTopics({
    chapters: input.chapters,
    errors,
    todayKey: input.dateKey,
    primaryExam: input.primaryExam,
  });
  const scheduledChapterIds = new Set(
    input.tasks.filter((task) => task.status !== "done").map((task) => task.chapterId).filter(Boolean)
  );
  const queuedChapterIds = new Set(input.backlog.map((item) => item.chapterId).filter(Boolean));

  const mistakeGroups = new Map<string, { count: number; chapterId?: string; chapterName?: string; subjectId?: string; subjectName?: string }>();
  for (const error of errors.filter((item) => item.reviewDate <= input.dateKey)) {
    const key = error.chapterId ?? `subject:${error.subjectId}`;
    mistakeGroups.set(key, {
      count: (mistakeGroups.get(key)?.count ?? 0) + 1,
      chapterId: error.chapterId,
      chapterName: error.chapterName,
      subjectId: error.subjectId,
      subjectName: error.subjectName,
    });
  }

  const candidates: (AutoPlanSuggestion & { score: number })[] = [];

  for (const item of input.backlog) {
    const deadline = parseMaybeDate(item.deadline);
    const daysToDeadline = deadline ? daysBetween(new Date(), deadline) : 999;
    candidates.push({
      id: `backlog:${item.id}`,
      source: "backlog",
      title: item.title,
      reason: "Already captured. Scheduling it now turns intent into work.",
      category: item.category,
      priority: item.priority,
      estimatedMinutes: item.estimatedMinutes ?? 30,
      subjectId: item.subjectId,
      subjectName: item.subjectName,
      chapterId: item.chapterId,
      chapterName: item.chapterName,
      deadline: deadline ?? undefined,
      backlogId: item.id,
      score:
        PRIORITY_WEIGHT[item.priority] * 20 +
        ageInDays(item.createdAt, input.dateKey) * 2 +
        Math.max(0, 18 - daysToDeadline * 3) +
        (item.origin === "unfinishedTask" ? 8 : 0),
    });
  }

  for (const topic of weakTopics) {
    if (scheduledChapterIds.has(topic.chapterId) || queuedChapterIds.has(topic.chapterId)) continue;
    const subject = input.subjects.find((item) => item.id === topic.subjectId);
    const estimatedMinutes = topic.state === "needs_revision" ? 25 : 40;
    candidates.push({
      id: `topic:${topic.chapterId}`,
      source: "weak_topic",
      title:
        topic.action === "revise"
          ? `Revise ${topic.chapterName}`
          : `${topic.action === "start" ? "Start" : "Practice"} ${topic.chapterName}`,
      reason: topic.reason,
      category:
        topic.action === "revise" ? "revision" : taskCategoryForExam(subject?.examType),
      priority: topic.masteryPct < 45 || (topic.dueRevision || topic.dueMistakes > 0) ? "high" : "med",
      estimatedMinutes,
      targetQuestions: topic.action === "revise" ? 8 : 15,
      subjectId: topic.subjectId,
      subjectName: topic.subjectName,
      chapterId: topic.chapterId,
      chapterName: topic.chapterName,
      score: topic.priorityScore,
    });
  }

  for (const [key, group] of mistakeGroups) {
    if (group.chapterId && (scheduledChapterIds.has(group.chapterId) || queuedChapterIds.has(group.chapterId))) {
      continue;
    }
    candidates.push({
      id: `mistake:${key}`,
      source: "mistake_review",
      title: `Redo ${group.count} mistake${group.count > 1 ? "s" : ""} — ${group.chapterName ?? group.subjectName ?? "Review"}`,
      reason: "Recent mistakes should be revised before they repeat.",
      category: "revision",
      priority: "high",
      estimatedMinutes: clamp(group.count * 12, 20, 45),
      targetQuestions: group.count,
      subjectId: group.subjectId,
      subjectName: group.subjectName,
      chapterId: group.chapterId,
      chapterName: group.chapterName,
      score: 82 + group.count * 6,
    });
  }

  const suggestions: AutoPlanSuggestion[] = [];
  let minutesLeft = remainingMinutes;

  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    if (minutesLeft < 20) break;
    if (suggestions.some((item) => item.chapterId && item.chapterId === candidate.chapterId)) continue;
    if (candidate.estimatedMinutes > minutesLeft + 10 && suggestions.length > 0) continue;
    suggestions.push(candidate);
    minutesLeft -= candidate.estimatedMinutes;
    if (suggestions.length >= 3) break;
  }

  return {
    targetMinutes,
    scheduledMinutes,
    remainingMinutes,
    suggestions,
  };
}
