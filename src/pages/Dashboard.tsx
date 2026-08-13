import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  Flame,
  RotateCcw,
  Target,
  Trees,
  Trophy,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LevelBadge } from "@/components/LevelBadge";
import { StreakFlame } from "@/components/StreakFlame";
import { SprintCard } from "@/components/SprintCard";
import { ForestStrip } from "@/components/ForestStrip";
import { AchievementsGrid } from "@/components/AchievementsGrid";
import { useAuth } from "@/contexts/AuthContext";
import {
  useBacklog,
  useChapters,
  useDayCounter,
  useErrors,
  useFocusSessions,
  useLastNDaysCounter,
  useMockTests,
  useSprints,
  useSubjects,
  useTasksForRange,
  useWeekCounter,
} from "@/lib/hooks";
import { computeForestStats } from "@/lib/forest";
import { summarizeSubjectMastery } from "@/lib/studyWorkflow";
import { addDays, dayKey, daysBetween } from "@/lib/dates";
import { useFeatures } from "@/lib/useFeatures";
import { cn } from "@/lib/utils";
import { filterBacklogByContext, filterChaptersByContext, filterErrorsByContext, filterSessionsByContext, filterSubjectsByContext, filterTasksByContext, filterTestsByContext, useAcademicContext } from "@/lib/academicContext";

const EXAM_LABEL: Record<string, string> = {
  class10: "Class 10 Boards",
  class12: "Class 12 Boards",
  jeeMain: "JEE Main",
  jeeAdvanced: "JEE Advanced",
  neet: "NEET",
};

export function Dashboard() {
  const { user, userDoc } = useAuth();
  const features = useFeatures();
  const { selected, activeExam } = useAcademicContext();
  const todayKey = dayKey(new Date());
  const today = useDayCounter(todayKey);
  const week = useWeekCounter(todayKey);
  const last30 = useLastNDaysCounter(30);
  const sprints = useSprints();
  const activeSprint = sprints.find((s) => s.status === "active");
  const allSessions = useFocusSessions(120);
  const allSubjects = useSubjects();
  const allChapters = useChapters();
  const allOpenErrors = useErrors("open");
  const allBacklog = useBacklog();
  const allTests = useMockTests(12);
  const allWeekTasks = useTasksForRange(todayKey, dayKey(addDays(new Date(), 6)));
  const subjects = useMemo(() => filterSubjectsByContext(allSubjects, selected.value), [allSubjects, selected.value]);
  const chapters = useMemo(() => filterChaptersByContext(allChapters, selected.value), [allChapters, selected.value]);
  const sessions = useMemo(() => filterSessionsByContext(allSessions, allSubjects, selected.value), [allSessions, allSubjects, selected.value]);
  const recentSessions = sessions.slice(-8);
  const openErrors = useMemo(() => filterErrorsByContext(allOpenErrors, allSubjects, selected.value), [allOpenErrors, allSubjects, selected.value]);
  const backlog = useMemo(() => filterBacklogByContext(allBacklog, allSubjects, selected.value), [allBacklog, allSubjects, selected.value]);
  const tests = useMemo(() => filterTestsByContext(allTests, selected.value), [allTests, selected.value]);
  const weekTasks = useMemo(() => filterTasksByContext(allWeekTasks, allSubjects, selected.value), [allWeekTasks, allSubjects, selected.value]);

  const subjectHealth = useMemo(
    () =>
      subjects
        .map((subject) => {
          const summary = summarizeSubjectMastery(
            subject,
            chapters.filter((chapter) => chapter.subjectId === subject.id),
            openErrors,
            todayKey
          );
          const accuracy =
            subject.accuracyDen > 0 ? Math.round((subject.accuracyNum / subject.accuracyDen) * 100) : null;
          return { subject, summary, accuracy };
        })
        .sort((a, b) => a.summary.masteryPct - b.summary.masteryPct),
    [subjects, chapters, openErrors, todayKey]
  );

  if (!user || !userDoc) return null;

  const primaryExam = activeExam;
  const daysLeft = primaryExam
    ? Math.max(0, daysBetween(new Date(), primaryExam.examDate.toDate()))
    : null;
  const totalChapters = subjects.reduce((sum, subject) => sum + subject.chapterCount, 0);
  const coveredChapters = chapters.filter((chapter) => chapter.masteryStage !== "not_started").length;
  const coveragePct = totalChapters > 0 ? Math.round((coveredChapters / totalChapters) * 100) : 0;
  const masteryPct =
    subjectHealth.length > 0
      ? Math.round(subjectHealth.reduce((sum, item) => sum + item.summary.masteryPct, 0) / subjectHealth.length)
      : 0;
  const forestStats = computeForestStats(sessions.filter((session) => session.completed));
  const plannedWeekMinutes = weekTasks.reduce((sum, task) => sum + (task.estimatedMinutes || 0), 0);
  const latestTest = tests[tests.length - 1];
  const previousTest = tests[tests.length - 2];
  const testDelta =
    latestTest && previousTest ? latestTest.accuracy - previousTest.accuracy : null;
  const weakestSubject = subjectHealth[0];

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Dashboard</h1>
          <p className="text-sm text-text-secondary">Overall study health across plan, practice, forest, and mastery.</p>
        </div>
        <StreakFlame streak={userDoc.streakCount} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <HealthCard icon={<Activity size={17} />} label="Focus this week" value={`${Math.round(week.focusMinutes / 60)}h`} hint={`${today.focusMinutes}m today`} />
        <HealthCard icon={<ClipboardCheck size={17} />} label="Questions" value={`${last30.questionsDone}`} hint={`${last30.pyqsDone} PYQs in 30d`} />
        <HealthCard icon={<RotateCcw size={17} />} label="Revision" value={`${week.revisionsDone}`} hint={`${openErrors.length} open mistakes`} />
        <HealthCard icon={<Trees size={17} />} label="Forest" value={`${forestStats.totalTrees}`} hint={`${forestStats.treesThisWeek} this week`} />
        <HealthCard icon={<BookOpen size={17} />} label="Coverage" value={`${coveragePct}%`} hint={`${coveredChapters}/${totalChapters} chapters`} />
        <HealthCard icon={<Target size={17} />} label="Mastery" value={`${masteryPct}%`} hint="Evidence-weighted" />
        <HealthCard icon={<CalendarClock size={17} />} label="Planned vs actual" value={`${plannedWeekMinutes}m`} hint={`${week.focusMinutes}m actual`} />
        <HealthCard icon={<Flame size={17} />} label="Streak" value={`${userDoc.streakCount}d`} hint={`Best ${userDoc.longestStreak}d`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Subject health</p>
            <Link to="/syllabus" className="text-xs text-text-secondary hover:text-brand-600">
              Open syllabus →
            </Link>
          </div>
          <div className="space-y-3">
            {subjectHealth.slice(0, 5).map(({ subject, summary, accuracy }) => (
              <div key={subject.id}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{subject.name}</span>
                  <span className="text-xs text-text-muted">
                    {summary.coveragePct}% covered · {summary.masteryPct}% mastery
                    {accuracy !== null ? ` · ${accuracy}% accuracy` : ""}
                  </span>
                </div>
                <div className="grid grid-cols-[1fr_1fr] gap-1">
                  <ProgressBar value={summary.coveragePct} tone="brand" />
                  <ProgressBar
                    value={summary.masteryPct}
                    tone={summary.weakCount + summary.needsRevisionCount > 0 ? "warning" : "success"}
                  />
                </div>
              </div>
            ))}
            {subjectHealth.length === 0 && (
              <p className="py-6 text-center text-sm text-text-secondary">No subjects yet.</p>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <p className="mb-3 text-sm font-semibold">Action signals</p>
          <div className="space-y-2">
            <Signal
              label="Weakest subject"
              value={weakestSubject?.subject.name ?? "Not enough data"}
              tone={weakestSubject?.summary.weakCount ? "warning" : "neutral"}
            />
            <Signal
              label="Backlog"
              value={`${backlog.length} waiting`}
              tone={backlog.some((item) => item.priority === "high") ? "warning" : "neutral"}
            />
            <Signal
              label="Latest test"
              value={
                latestTest
                  ? `${latestTest.accuracy}% accuracy${testDelta !== null ? ` (${testDelta >= 0 ? "+" : ""}${testDelta})` : ""}`
                  : "No tests logged"
              }
              tone={testDelta !== null && testDelta < 0 ? "warning" : "success"}
            />
            <Signal
              label="Revision pressure"
              value={`${openErrors.filter((error) => error.reviewDate <= todayKey).length} due mistakes`}
              tone={openErrors.some((error) => error.reviewDate <= todayKey) ? "danger" : "neutral"}
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {features.forest && (
          <Card className="p-4">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <Trees size={15} className="text-brand-600" aria-hidden /> Recent forest growth
            </p>
            <ForestStrip sessions={recentSessions} />
            {features.focus && (
              <Link to="/focus" className="mt-3 inline-block text-sm text-brand-600 hover:underline">
                <ArrowRight size={14} className="mr-1 inline" /> Start focusing
              </Link>
            )}
          </Card>
        )}

        {features.sprints && activeSprint ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Active sprint</p>
              <Link to="/sprints" className="text-xs text-text-secondary hover:text-brand-600">
                All sprints →
              </Link>
            </div>
            <SprintCard sprint={activeSprint} compact />
          </div>
        ) : (
          <Card className="p-4">
            <p className="text-sm font-semibold">No active sprint</p>
            <p className="mt-1 text-sm text-text-secondary">Create a short mission when your next exam block needs focus.</p>
            <Link to="/sprints" className="mt-3 inline-block">
              <Button size="sm" variant="secondary">Open sprints</Button>
            </Link>
          </Card>
        )}
      </div>

      {primaryExam && (
        <Card className="flex items-center justify-between gap-3 border-brand-600/20 bg-brand-500/[0.07] p-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {EXAM_LABEL[primaryExam.examType] ?? primaryExam.name}
            </p>
            <p className="mt-0.5 text-xs text-text-secondary">
              {primaryExam.examDate.toDate().toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-numeric text-3xl font-semibold tabular text-brand-600 dark:text-brand-500">
              {daysLeft}
            </p>
            <p className="text-[11px] uppercase tracking-wide text-text-muted">days to go</p>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Trophy size={15} className="text-achievement" aria-hidden /> Achievements
          </p>
          <LevelBadge xp={userDoc.xp} compact />
        </div>
        <AchievementsGrid earned={userDoc.badges} />
      </Card>

      <div className="flex gap-2">
        <Link to="/reports" className="flex-1">
          <Button variant="secondary" className="w-full">
            Open reports
          </Button>
        </Link>
        <Link to="/planner" className="flex-1">
          <Button className="w-full">Plan next block</Button>
        </Link>
      </div>
    </div>
  );
}

function HealthCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="p-3">
      <div className="mb-2 flex items-center justify-between text-text-muted">
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        <span className="text-brand-600">{icon}</span>
      </div>
      <p className="font-numeric text-2xl font-semibold tabular">{value}</p>
      <p className="mt-1 text-xs text-text-muted">{hint}</p>
    </Card>
  );
}

function ProgressBar({ value, tone }: { value: number; tone: "brand" | "warning" | "success" }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-border">
      <div
        className={cn(
          "h-full rounded-full",
          tone === "brand" && "bg-brand-600",
          tone === "warning" && "bg-warning",
          tone === "success" && "bg-success"
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function Signal({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2">
      <span className="text-sm text-text-secondary">{label}</span>
      <Badge
        tone={
          tone === "danger"
            ? "danger"
            : tone === "warning"
              ? "warning"
              : tone === "success"
                ? "success"
                : "neutral"
        }
        size="sm"
      >
        {value}
      </Badge>
    </div>
  );
}
