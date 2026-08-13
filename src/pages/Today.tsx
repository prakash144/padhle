import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CheckCircle2, Flag, Sparkles, Sun, Target, Timer, Trees } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TaskItem } from "@/components/TaskItem";
import { CoachCard } from "@/components/CoachCard";
import { SprintCard } from "@/components/SprintCard";
import { CheckInSheet } from "@/components/CheckInSheet";
import { StreakFlame } from "@/components/StreakFlame";
import { LevelBadge } from "@/components/LevelBadge";
import { ForestStrip } from "@/components/ForestStrip";
import { OverdueRollover } from "@/components/OverdueRollover";
import { ReviewHub } from "@/components/ReviewHub";
import { QuoteCard } from "@/components/QuoteCard";
import { QuoteDialog } from "@/components/QuoteDialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  useBacklog,
  useCheckin,
  useChapters,
  useDayCounter,
  useErrors,
  useFocusSessions,
  useOverdueTasks,
  useSprints,
  useSubjects,
  useTasksForDate,
} from "@/lib/hooks";
import { saveReflection } from "@/lib/checkins";
import { setTaskDone } from "@/lib/tasks";
import { injectDueRevisions } from "@/lib/revisions";
import { FOCUS_PRESETS } from "@/lib/pomodoro";
import { dayForestSummary } from "@/lib/forest";
import { getNextBestAction } from "@/lib/studyWorkflow";
import { useToast } from "@/lib/useToast";
import { useFeatures } from "@/lib/useFeatures";
import { dayKey } from "@/lib/dates";
import { cn, friendlyFirstName } from "@/lib/utils";
import { filterBacklogByContext, filterChaptersByContext, filterErrorsByContext, filterSessionsByContext, filterTasksByContext, useAcademicContext } from "@/lib/academicContext";

export function Today() {
  const { user, userDoc } = useAuth();
  const features = useFeatures();
  const { selected, exams, activeExam } = useAcademicContext();
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [quoteDismissed, setQuoteDismissed] = useState(false);
  const [reflection, setReflectionText] = useState("");
  const [mood, setMood] = useState<number | undefined>(undefined);
  const [savingReflection, setSavingReflection] = useState(false);
  const hasPromptedCheckIn = useRef(false);
  const hasInjectedRevisions = useRef(false);
  const toast = useToast();

  const todayKey = dayKey(new Date());
  const allTasks = useTasksForDate(todayKey);
  const allBacklog = useBacklog();
  const allChapters = useChapters();
  const subjects = useSubjects();
  const allRecentSessions = useFocusSessions(50);
  const allOpenErrors = useErrors("open");
  const tasks = useMemo(() => filterTasksByContext(allTasks, subjects, selected.value), [allTasks, subjects, selected.value]);
  const backlog = useMemo(() => filterBacklogByContext(allBacklog, subjects, selected.value), [allBacklog, subjects, selected.value]);
  const chapters = useMemo(() => filterChaptersByContext(allChapters, selected.value), [allChapters, selected.value]);
  const recentSessions = useMemo(() => filterSessionsByContext(allRecentSessions, subjects, selected.value), [allRecentSessions, subjects, selected.value]);
  const openErrors = useMemo(() => filterErrorsByContext(allOpenErrors, subjects, selected.value), [allOpenErrors, subjects, selected.value]);
  const pendingTasks = tasks.filter((task) => task.status !== "done");
  const topThree = pendingTasks.slice(0, 3);
  const overdueTasks = useOverdueTasks(todayKey);
  const sprints = useSprints();
  const activeSprint = sprints.find((s) => s.status === "active");
  const checkin = useCheckin(todayKey);
  const counter = useDayCounter(todayKey);
  const forestToday = dayForestSummary(recentSessions, todayKey);
  const stripSessions = recentSessions.slice(-7);
  const revisionTasks = pendingTasks.filter((task) => task.category === "revision");

  useEffect(() => {
    if (!user || hasInjectedRevisions.current) return;
    hasInjectedRevisions.current = true;
    injectDueRevisions(user.uid).catch((err) => console.error("Failed to inject revisions", err));
  }, [user]);

  useEffect(() => {
    if (hasPromptedCheckIn.current || checkin === undefined || !quoteDismissed) return;
    hasPromptedCheckIn.current = true;
    if (checkin === null || checkin.top3.length === 0) {
      setCheckInOpen(true);
    }
  }, [checkin, quoteDismissed]);

  useEffect(() => {
    if (checkin === undefined) return;
    setReflectionText(checkin?.reflection ?? "");
    setMood(checkin?.mood);
  }, [checkin]);

  const primaryExam = activeExam;
  const daysLeft = primaryExam ? Math.max(0, Math.ceil((primaryExam.examDate.toDate().getTime() - Date.now()) / 86400000)) : null;
  const firstName = friendlyFirstName(userDoc?.displayName);
  const dailyTargetMinutes = checkin?.dailyTargetMinutes ?? 180;
  const plannedMinutes = tasks.reduce((sum, task) => sum + (task.estimatedMinutes || 0), 0);
  const showWrapUp =
    new Date().getHours() >= 18 || !!checkin?.reflection || counter.completedTasks > 0;
  const lastSession = [...recentSessions]
    .reverse()
    .find((session) => session.chapterId || session.subjectId);

  const nextAction = useMemo(
    () =>
      getNextBestAction({
        todayKey,
        tasks,
        backlog,
        chapters,
        errors: openErrors,
        recentSessions,
        checkin: checkin ?? null,
        primaryExam,
      }),
    [todayKey, tasks, backlog, chapters, openErrors, recentSessions, checkin, primaryExam]
  );

  if (!user || !userDoc) {
    return (
      <div className="mx-auto flex max-w-[720px] items-center justify-center py-16 text-sm text-text-secondary">
        Loading your day…
      </div>
    );
  }

  const handleSaveReflection = async () => {
    if (!reflection.trim() && mood === undefined) return;
    setSavingReflection(true);
    try {
      await saveReflection(user.uid, todayKey, reflection.trim(), mood);
      toast.success("Saved today's reflection.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save that reflection. Try again.");
    } finally {
      setSavingReflection(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">Today · {selected.shortLabel}</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">
            Good to see you, {firstName}
          </h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <StreakFlame streak={userDoc.streakCount} />
      </div>

      <Card className="overflow-hidden border-brand-600/20">
        <div className="flex items-center justify-between border-b border-border/70 bg-brand-500/[0.06] px-4 py-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
            <Sun size={12} aria-hidden /> Next best action
          </p>
          <span className="text-[11px] text-text-muted">{nextAction.detail}</span>
        </div>
        <div className="flex flex-col gap-4 p-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold leading-tight">{nextAction.title}</h2>
            <p className="mt-1 text-sm text-text-secondary">{nextAction.reason}</p>
          </div>
          <ActionCta
            action={nextAction}
            onCheckIn={() => setCheckInOpen(true)}
          />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <StatCard label="Focus" value={`${counter.focusMinutes}m`} />
        <StatCard label="Tasks" value={`${counter.completedTasks}/${counter.plannedTasks}`} />
        <StatCard label="Questions" value={`${counter.questionsDone}`} />
        <StatCard label="Trees" value={`${forestToday.trees}`} />
        <StatCard label="XP" value={`${forestToday.xp}`} />
        <StatCard label="Streak" value={`${userDoc.streakCount}`} />
      </div>

      <Card className="p-4">
        <div className="grid gap-4 md:grid-cols-[1.1fr_.9fr_1.2fr]">
          <TodayPanel label="Exam countdown" icon={<Target size={14} className="text-brand-600" />} title={primaryExam?.name ?? "Add your exam"} value={daysLeft !== null ? `${daysLeft} days` : "Not set"} hint={primaryExam ? "Active study context" : "Set this in onboarding or profile"} />
          <TodayPanel label="Daily target" icon={<Timer size={14} className="text-brand-600" />} title={`${dailyTargetMinutes} min`} value={`${counter.focusMinutes} / ${dailyTargetMinutes}`} hint="Focused minutes today" />
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-text-muted"><Flag size={12} aria-hidden /> Priorities</p>
            {checkin && checkin.top3.length > 0 ? (
              <div className="flex flex-wrap gap-2">{checkin.top3.map((goal, i) => <span key={`${goal}-${i}`} className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-secondary">{goal}</span>)}</div>
            ) : <p className="text-sm text-text-secondary">Set your top three and Padhle will rank the next move.</p>}
            <button onClick={() => setCheckInOpen(true)} className="mt-3 text-xs font-medium text-text-secondary transition-colors hover:text-brand-600">{checkin ? "Edit check-in →" : "Start check-in →"}</button>
          </div>
        </div>
      </Card>

      <CoachCard streak={userDoc.streakCount} exams={exams} />
      <QuoteCard uid={user.uid} />

      {features.focus && lastSession && nextAction.kind !== "continue" && (
        <Card className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <BookOpen size={15} className="text-brand-600" aria-hidden /> Continue learning
            </p>
            <p className="mt-1 truncate text-sm font-medium">
              {lastSession.chapterName ?? lastSession.subjectName ?? "Your last topic"}
            </p>
            <p className="text-xs text-text-secondary">
              Last session: {lastSession.focusMinutes} min {lastSession.activity ? `· ${lastSession.activity}` : ""}
            </p>
          </div>
          <Link
            to={`/focus?${new URLSearchParams(
              Object.fromEntries(
                [
                  ["subjectId", lastSession.subjectId],
                  ["chapterId", lastSession.chapterId],
                  ["activity", lastSession.activity ?? "practice"],
                ].filter((entry): entry is [string, string] => Boolean(entry[1]))
              )
            ).toString()}`}
          >
            <Button size="sm" variant="secondary">
              <Timer size={14} /> Resume topic
            </Button>
          </Link>
        </Card>
      )}

      {features.focus && (
        <div className="grid grid-cols-3 gap-2">
          {FOCUS_PRESETS.map((preset) => (
            <Link
              key={preset.id}
              to={`/focus?preset=${preset.id}`}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-center transition-colors duration-micro hover:border-brand-600 hover:bg-surface-2"
            >
              <p className="text-xs font-medium">{preset.label}</p>
              <p className="mt-0.5 text-[10px] text-text-muted">{preset.blurb}</p>
            </Link>
          ))}
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Today&apos;s plan</p>
            <p className="text-xs text-text-secondary">
              {plannedMinutes > 0 ? `${plannedMinutes} planned min` : "No work scheduled yet"}
            </p>
          </div>
          <Link to="/planner" className="text-xs text-text-secondary hover:text-brand-600">
            Open planner →
          </Link>
        </div>
        {topThree.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-8 text-center">
            <Sparkles className="text-brand-600" size={24} />
            <p className="text-sm text-text-secondary">
              Nothing planned for today yet. Use Auto Plan or drag work into today from the Planner.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {topThree.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={(done) => {
                  setTaskDone(user.uid, task, done).catch((err) => {
                    console.error(err);
                    toast.error("Couldn't save that change. Try again.");
                  });
                }}
              />
            ))}
          </div>
        )}
      </div>

      <OverdueRollover uid={user.uid} tasks={overdueTasks} />

      {features.errorBook && (
        <ReviewHub uid={user.uid} errors={openErrors} revisionTasks={revisionTasks} />
      )}

      {showWrapUp && (
        <Card className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <CheckCircle2 size={15} className="text-brand-600" aria-hidden /> Evening wrap-up
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Planned vs completed, then one short note before you close the day.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-right">
              <WrapStat label="Tasks" value={`${counter.completedTasks}/${counter.plannedTasks}`} />
              <WrapStat label="Time" value={`${counter.focusMinutes}/${dailyTargetMinutes}m`} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                onClick={() => setMood(value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-micro",
                  mood === value
                    ? "border-brand-600 bg-brand-500/10 text-brand-600"
                    : "border-border bg-surface-2 text-text-secondary hover:border-border-strong"
                )}
              >
                Mood {value}
              </button>
            ))}
          </div>
          <textarea
            value={reflection}
            onChange={(e) => setReflectionText(e.target.value)}
            placeholder="What worked? What slipped? What should tomorrow protect?"
            className="mt-3 min-h-24 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary outline-none transition-colors duration-micro placeholder:text-text-muted focus:border-brand-600"
          />
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSaveReflection}
              disabled={savingReflection || (!reflection.trim() && mood === undefined)}
            >
              {savingReflection ? "Saving..." : "Save wrap-up"}
            </Button>
          </div>
        </Card>
      )}

      {features.forest && (
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Trees size={15} className="text-brand-600" aria-hidden /> Today&apos;s forest
            </p>
            <Link to="/forest" className="text-xs text-text-secondary hover:text-brand-600">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <ForestStat label="Trees" value={String(forestToday.trees)} />
            <ForestStat label="Minutes" value={String(forestToday.focusMinutes)} />
            <ForestStat label="Sessions" value={String(forestToday.sessions.length)} />
            <ForestStat label="XP" value={String(forestToday.xp)} />
          </div>
          <div className="mt-3 border-t border-border/70 pt-3">
            <ForestStrip sessions={stripSessions} />
          </div>
          <div className="mt-3 border-t border-border/70 pt-3">
            <LevelBadge xp={userDoc.xp} />
          </div>
        </Card>
      )}

      {features.sprints && activeSprint && <SprintCard sprint={activeSprint} compact />}

      <QuoteDialog onDismiss={() => setQuoteDismissed(true)} />

      <CheckInSheet
        open={checkInOpen}
        onOpenChange={setCheckInOpen}
        uid={user.uid}
        date={todayKey}
        initialGoals={checkin?.top3}
        initialDailyTargetMinutes={checkin?.dailyTargetMinutes}
      />
    </div>
  );
}

function ActionCta({
  action,
  onCheckIn,
}: {
  action: ReturnType<typeof getNextBestAction>;
  onCheckIn: () => void;
}) {
  if (action.kind === "checkin") {
    return (
      <Button className="shrink-0" onClick={onCheckIn}>
        <Target size={14} /> {action.ctaLabel}
      </Button>
    );
  }

  if (!action.to) {
    return (
      <Button variant="secondary" className="shrink-0" onClick={onCheckIn}>
        <Target size={14} /> {action.ctaLabel}
      </Button>
    );
  }

  return (
    <Link to={action.to} className="shrink-0">
      <Button>
        <Timer size={14} /> {action.ctaLabel}
      </Button>
    </Link>
  );
}

function TodayPanel({
  label,
  icon,
  title,
  value,
  hint,
}: {
  label: string;
  icon: ReactNode;
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
        {icon} {label}
      </p>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-0.5 text-lg font-semibold">{value}</p>
      <p className="mt-1 text-xs text-text-secondary">{hint}</p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3 text-center">
      <p className={cn("font-numeric text-xl font-semibold tabular")}>{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </Card>
  );
}

function WrapStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <p className="font-numeric text-sm font-semibold tabular">{value}</p>
      <p className="text-[11px] text-text-muted">{label}</p>
    </div>
  );
}

function ForestStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2/70 px-2 py-2 text-center">
      <p className="font-numeric text-base font-semibold tabular">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-text-muted">{label}</p>
    </div>
  );
}
