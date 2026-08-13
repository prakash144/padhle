import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Pause, Play, Square, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProgressRing } from "@/components/ProgressRing";
import { GrowingTree } from "@/components/GrowingTree";
import { useAuth } from "@/contexts/AuthContext";
import { useChapters, useSubjects, useTask, useTasksForDate } from "@/lib/hooks";
import { useCountdown } from "@/lib/useCountdown";
import { logFocusSession } from "@/lib/focusSessions";
import { recordDrillAccuracy } from "@/lib/drills";
import { ForestTree } from "@/components/ForestTree";
import { sessionVariety } from "@/lib/forest";
import { ACTIVITY_OPTIONS, FOCUS_PRESETS, POMODORO_PRESETS, formatClock } from "@/lib/pomodoro";
import { useToast } from "@/lib/useToast";
import { cn } from "@/lib/utils";
import { dayKey } from "@/lib/dates";
import type { FocusActivity, PomodoroMode } from "@/lib/schema";
import { filterChaptersByContext, filterSubjectsByContext, filterTasksByContext, useAcademicContext } from "@/lib/academicContext";

type Step = "subject" | "chapter" | "activity" | "duration" | "focus" | "break" | "complete" | "abandoned";

interface ActiveFocusState {
  clientSessionId: string;
  taskId?: string;
  sprintId?: string;
  subjectId: string;
  chapterId: string;
  activity?: FocusActivity;
  mode: PomodoroMode;
  customFocus: number;
  customBreak: number;
  startedAt: string;
  step: "focus" | "break";
  running: boolean;
  focusElapsedSeconds: number;
  breakElapsedSeconds: number;
  questionsDone?: number;
}

const ACTIVE_FOCUS_KEY = "padhle:active-focus";

function makeSessionId() {
  return `focus_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readActiveFocus(): ActiveFocusState | null {
  try {
    const raw = window.localStorage.getItem(ACTIVE_FOCUS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveFocusState;
    return parsed?.clientSessionId && parsed.startedAt ? parsed : null;
  } catch {
    return null;
  }
}

function writeActiveFocus(state: ActiveFocusState | null) {
  try {
    if (!state) window.localStorage.removeItem(ACTIVE_FOCUS_KEY);
    else window.localStorage.setItem(ACTIVE_FOCUS_KEY, JSON.stringify(state));
  } catch {
    // Timer recovery is a convenience; the Firestore write path remains the source of truth.
  }
}

export function Focus() {
  const { user, userDoc } = useAuth();
  const [searchParams] = useSearchParams();
  const recovered = useMemo(readActiveFocus, []);
  const paramTaskId = searchParams.get("taskId") ?? undefined;
  const sprintId = recovered?.sprintId ?? searchParams.get("sprintId") ?? undefined;
  // One-tap presets (from Today) skip the wizard and start the timer immediately.
  const presetConfig = FOCUS_PRESETS.find((p) => p.id === searchParams.get("preset"));
  // Per-chapter drills (from Syllabus) prefill subject/chapter/activity too.
  const paramSubject = searchParams.get("subjectId") ?? "";
  const paramChapter = searchParams.get("chapterId") ?? "";
  const drillActivity = ACTIVITY_OPTIONS.find((a) => a.value === searchParams.get("activity"))?.value;
  const paramTarget = Number(searchParams.get("target") ?? 0) || undefined;
  const quickStart = !!recovered || !!presetConfig || (!!paramChapter && !!drillActivity);

  const allSubjects = useSubjects();
  const allChapters = useChapters();
  const allTodayTasks = useTasksForDate(dayKey(new Date()));
  const { selected: academicContext } = useAcademicContext();
  const subjects = useMemo(() => filterSubjectsByContext(allSubjects, academicContext.value), [allSubjects, academicContext.value]);
  const chapters = useMemo(() => filterChaptersByContext(allChapters, academicContext.value), [allChapters, academicContext.value]);
  const todayTasks = useMemo(() => filterTasksByContext(allTodayTasks, allSubjects, academicContext.value).filter((task) => task.status !== "done"), [allTodayTasks, allSubjects, academicContext.value]);

  const [step, setStep] = useState<Step>(recovered?.step ?? (quickStart ? "focus" : "subject"));
  const [clientSessionId, setClientSessionId] = useState(recovered?.clientSessionId ?? makeSessionId());
  const [taskId, setTaskId] = useState(recovered?.taskId ?? paramTaskId ?? "");
  const linkedTask = useTask(taskId || undefined);
  const [subjectId, setSubjectId] = useState(recovered?.subjectId ?? paramSubject);
  const [chapterId, setChapterId] = useState(recovered?.chapterId ?? paramChapter);
  const [activity, setActivity] = useState<FocusActivity | undefined>(
    recovered?.activity ?? presetConfig?.activity ?? drillActivity
  );
  const [mode, setMode] = useState<PomodoroMode>(
    recovered?.mode ?? presetConfig?.mode ?? userDoc?.pomodoroPrefs.defaultMode ?? "50/10"
  );
  const [customFocus, setCustomFocus] = useState(
    recovered?.customFocus ?? userDoc?.pomodoroPrefs.customFocus ?? 45
  );
  const [customBreak, setCustomBreak] = useState(
    recovered?.customBreak ?? userDoc?.pomodoroPrefs.customBreak ?? 10
  );
  const [running, setRunning] = useState(recovered?.running ?? quickStart);
  const [startedAt, setStartedAt] = useState<Date | null>(
    recovered?.startedAt ? new Date(recovered.startedAt) : quickStart ? new Date() : null
  );
  const sessionNonce = startedAt?.getTime() ?? 0;
  const [questionsDone, setQuestionsDone] = useState<number | "">(recovered?.questionsDone ?? paramTarget ?? "");
  const [correctCount, setCorrectCount] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const subject = subjects.find((s) => s.id === subjectId);
  const chapterOptions = useMemo(
    () => chapters.filter((c) => c.subjectId === subjectId),
    [chapters, subjectId]
  );
  const chapter = chapterOptions.find((c) => c.id === chapterId);

  const preset = POMODORO_PRESETS.find((p) => p.mode === mode);
  const focusMinutesTotal = mode === "custom" ? customFocus : preset!.focus;
  const breakMinutesTotal = mode === "custom" ? customBreak : preset!.break;

  const focusTimer = useCountdown(
    focusMinutesTotal * 60,
    step === "focus" && running,
    () => {
      setStep(breakMinutesTotal > 0 ? "break" : "complete");
      setRunning(true);
    },
    sessionNonce,
    recovered?.focusElapsedSeconds ?? 0
  );
  const breakTimer = useCountdown(
    breakMinutesTotal * 60,
    step === "break" && running,
    () => {
      setStep("complete");
      writeActiveFocus(null);
    },
    sessionNonce,
    recovered?.breakElapsedSeconds ?? 0
  );

  useEffect(() => {
    if (!linkedTask || startedAt) return;
    if (linkedTask.subjectId) setSubjectId(linkedTask.subjectId);
    if (linkedTask.chapterId) setChapterId(linkedTask.chapterId);
    if (linkedTask.category === "revision") setActivity("revision");
    else if (linkedTask.category === "pyq") setActivity("pyq");
    else setActivity((current) => current ?? "practice");
    if (linkedTask.targetQuestions) setQuestionsDone(linkedTask.targetQuestions);
  }, [linkedTask, startedAt]);

  useEffect(() => {
    if (step !== "focus" && step !== "break") return;
    if (!startedAt) return;
    writeActiveFocus({
      clientSessionId,
      taskId: taskId || undefined,
      sprintId,
      subjectId,
      chapterId,
      activity,
      mode,
      customFocus,
      customBreak,
      startedAt: startedAt.toISOString(),
      step,
      running,
      focusElapsedSeconds: focusTimer.elapsed,
      breakElapsedSeconds: breakTimer.elapsed,
      questionsDone: questionsDone === "" ? undefined : Number(questionsDone),
    });
  }, [
    clientSessionId,
    taskId,
    sprintId,
    subjectId,
    chapterId,
    activity,
    mode,
    customFocus,
    customBreak,
    startedAt,
    step,
    running,
    focusTimer.elapsed,
    breakTimer.elapsed,
    questionsDone,
  ]);

  if (!user) return null;

  const startFocus = () => {
    setClientSessionId((current) => current || makeSessionId());
    setStartedAt(new Date());
    setRunning(true);
    setStep("focus");
  };

  const endFocusEarly = () => {
    setRunning(false);
    setStep("abandoned");
  };

  const skipBreak = () => setStep("complete");

  const focusProgress =
    focusMinutesTotal > 0 ? Math.min(1, focusTimer.elapsed / (focusMinutesTotal * 60)) : 0;
  const sessionCompleted = focusTimer.elapsed >= focusMinutesTotal * 60;
  const focusMinutesElapsed = Math.round(focusTimer.elapsed / 60);
  const xpEarned = Math.round(focusTimer.elapsed / 60); // 1 XP per focus minute

  const resetWizard = () => {
    setStep("subject");
    setSubjectId("");
    setChapterId("");
    setActivity(undefined);
    setTaskId("");
    setQuestionsDone("");
    setCorrectCount("");
    setStartedAt(null);
    setRunning(false);
    setClientSessionId(makeSessionId());
    writeActiveFocus(null);
  };

  const submitLog = async () => {
    setSaving(true);
    try {
      const qDone = questionsDone === "" ? 0 : Number(questionsDone);
      const correct = correctCount === "" ? 0 : Number(correctCount);
      await logFocusSession(user.uid, {
        clientSessionId,
        taskId: taskId || undefined,
        subjectId: subject?.id,
        subjectName: subject?.name,
        chapterId: chapter?.id,
        chapterName: chapter?.name,
        sprintId,
        activity,
        mode,
        plannedMinutes: focusMinutesTotal,
        focusMinutes: focusTimer.elapsed / 60,
        questionsDone: qDone,
        completed: sessionCompleted,
        startedAt: startedAt ?? new Date(),
      });
      // Feed accuracy into the chapter/subject rolls so the syllabus "Weak"
      // filter and mastery reflect real drill performance.
      if (
        chapterId &&
        (activity === "practice" || activity === "pyq" || activity === "revision") &&
        qDone > 0
      ) {
        await recordDrillAccuracy(user.uid, {
          subjectId: subjectId || undefined,
          chapterId,
          questionsAttempted: qDone,
          correct,
        });
      }
      writeActiveFocus(null);
      resetWizard();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save your session — your progress is safe, try Done again.");
    } finally {
      setSaving(false);
    }
  };

  const breadcrumb = [subject?.name, chapter?.name, activity && capitalize(activity)]
    .filter(Boolean)
    .join(" › ");

  return (
    <div className="mx-auto max-w-md">
      <AnimatePresence mode="wait">
        {step === "subject" && (
          <WizardStep key="subject" title="What are you studying?">
            {todayTasks.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
                  Link to today&apos;s plan
                </p>
                <div className="max-h-44 space-y-1.5 overflow-y-auto">
                  {todayTasks.map((task) => (
                    <OptionButton
                      key={task.id}
                      label={task.title}
                      selected={task.id === taskId}
                      onClick={() => {
                        setTaskId(task.id);
                        if (task.subjectId) setSubjectId(task.subjectId);
                        if (task.chapterId) setChapterId(task.chapterId);
                        if (task.category === "revision") setActivity("revision");
                        else if (task.category === "pyq") setActivity("pyq");
                        else setActivity("practice");
                        if (task.targetQuestions) setQuestionsDone(task.targetQuestions);
                      }}
                      full
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {subjects.map((s) => (
                <OptionButton
                  key={s.id}
                  label={s.name}
                  selected={s.id === subjectId}
                  onClick={() => {
                    setSubjectId(s.id);
                    setChapterId("");
                  }}
                />
              ))}
            </div>
            <StepFooter onSkip={() => setStep("activity")} onNext={() => setStep("chapter")} />
          </WizardStep>
        )}

        {step === "chapter" && (
          <WizardStep key="chapter" title="Which chapter?">
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {chapterOptions.map((c) => (
                <OptionButton
                  key={c.id}
                  label={c.name}
                  selected={c.id === chapterId}
                  onClick={() => setChapterId(c.id)}
                  full
                />
              ))}
              {chapterOptions.length === 0 && (
                <p className="py-4 text-center text-sm text-text-secondary">
                  No chapters found for this subject.
                </p>
              )}
            </div>
            <StepFooter onSkip={() => setStep("activity")} onNext={() => setStep("activity")} />
          </WizardStep>
        )}

        {step === "activity" && (
          <WizardStep key="activity" title="What kind of work?">
            <div className="grid grid-cols-2 gap-2">
              {ACTIVITY_OPTIONS.map((a) => (
                <OptionButton
                  key={a.value}
                  label={a.label}
                  selected={a.value === activity}
                  onClick={() => setActivity(a.value)}
                />
              ))}
            </div>
            <StepFooter onSkip={() => setStep("duration")} onNext={() => setStep("duration")} />
          </WizardStep>
        )}

        {step === "duration" && (
          <WizardStep key="duration" title="How long?">
            <div className="space-y-2">
              {POMODORO_PRESETS.map((p) => (
                <OptionButton
                  key={p.mode}
                  label={`${p.label} — ${p.focus}m focus / ${p.break}m break`}
                  selected={mode === p.mode}
                  onClick={() => setMode(p.mode)}
                  full
                />
              ))}
              <OptionButton
                label="Custom"
                selected={mode === "custom"}
                onClick={() => setMode("custom")}
                full
              />
              {mode === "custom" && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <label className="text-xs text-text-muted">
                    Focus (min)
                    <Input
                      type="number"
                      min={5}
                      value={customFocus}
                      onChange={(e) => setCustomFocus(Number(e.target.value))}
                      className="mt-1"
                    />
                  </label>
                  <label className="text-xs text-text-muted">
                    Break (min)
                    <Input
                      type="number"
                      min={0}
                      value={customBreak}
                      onChange={(e) => setCustomBreak(Number(e.target.value))}
                      className="mt-1"
                    />
                  </label>
                </div>
              )}
            </div>
            <Button onClick={startFocus} className="mt-6 w-full">
              Start focus <ArrowRight size={16} />
            </Button>
          </WizardStep>
        )}

        {step === "focus" && (
          <QuietOverlay key="focus">
            {breadcrumb && (
              <p className="mb-4 rounded-full border border-white/10 bg-white/[0.06] px-4 py-1.5 text-sm text-white/80">
                {breadcrumb}
              </p>
            )}
            <GrowingTree progress={focusProgress} variety={sessionVariety({ subjectName: subject?.name })} size={104} />
            <ProgressRing
              size={220}
              strokeWidth={10}
              progress={focusProgress}
              colorClassName={focusProgress >= 0.85 ? "text-warning" : "text-brand-400"}
              className="mt-2"
            >
              <span className="font-numeric text-4xl font-semibold tabular text-white">
                {formatClock(focusTimer.remaining)}
              </span>
            </ProgressRing>
            <div className="mt-8 flex items-center gap-4">
              <button
                onClick={() => setRunning((r) => !r)}
                className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white transition-colors hover:bg-white/10"
              >
                {running ? <Pause size={22} /> : <Play size={22} />}
              </button>
              <button
                onClick={endFocusEarly}
                className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white transition-colors hover:bg-white/10"
              >
                <Square size={20} />
              </button>
            </div>
          </QuietOverlay>
        )}

        {step === "break" && (
          <QuietOverlay key="break" tint="teal">
            <p className="mb-6 text-sm text-white/80">Break · stretch, drink water</p>
            <ProgressRing
              size={220}
              strokeWidth={10}
              progress={breakMinutesTotal > 0 ? breakTimer.elapsed / (breakMinutesTotal * 60) : 0}
              colorClassName="text-brand-400"
            >
              <span className="font-numeric text-4xl font-semibold tabular text-white">
                {formatClock(breakTimer.remaining)}
              </span>
            </ProgressRing>
            <button
              onClick={skipBreak}
              className="mt-8 rounded-full border border-white/10 bg-white/[0.06] px-5 py-2 text-sm text-white transition-colors hover:bg-white/10"
            >
              Skip break
            </button>
          </QuietOverlay>
        )}

        {step === "complete" && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            <Card className="p-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
                <Check size={24} />
              </div>
              <ForestTree
                stage="big-tree"
                milestone
                size={52}
                className="mx-auto mb-2 drop-shadow-[0_0_14px_hsl(var(--forest-milestone)/.4)]"
              />
              <p className="font-display text-lg font-bold">
                Session complete! Your tree has fully grown. 🌳
              </p>
              <p className="mt-1 text-sm text-text-secondary">{breadcrumb || "Focus session"}</p>

              <div className="mx-auto mt-3 grid max-w-xs grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-surface-2 p-2">
                  <p className="font-numeric text-base font-semibold tabular">+{xpEarned}</p>
                  <p className="text-[10px] uppercase tracking-wide text-text-muted">XP</p>
                </div>
                <div className="rounded-lg bg-surface-2 p-2">
                  <p className="font-numeric text-base font-semibold tabular">+1</p>
                  <p className="text-[10px] uppercase tracking-wide text-text-muted">Tree</p>
                </div>
                <div className="rounded-lg bg-surface-2 p-2">
                  <p className="font-numeric text-base font-semibold tabular">+{focusMinutesElapsed}m</p>
                  <p className="text-[10px] uppercase tracking-wide text-text-muted">Focus</p>
                </div>
              </div>

              {(activity === "practice" || activity === "pyq" || activity === "revision") && (
                <label className="mt-4 block text-left text-xs text-text-muted">
                  How many questions?
                  <Input
                    type="number"
                    min={0}
                    value={questionsDone}
                    onChange={(e) =>
                      setQuestionsDone(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="mt-1"
                  />
                </label>
              )}

              {chapterId &&
                (activity === "practice" || activity === "pyq" || activity === "revision") && (
                  <label className="mt-3 block text-left text-xs text-text-muted">
                    How many did you get right?
                    <Input
                      type="number"
                      min={0}
                      max={questionsDone === "" ? undefined : Number(questionsDone)}
                      value={correctCount}
                      onChange={(e) =>
                        setCorrectCount(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      className="mt-1"
                    />
                    <span className="mt-1 block text-[11px]">
                      Feeds your chapter accuracy + weak-topic detection.
                    </span>
                  </label>
                )}

              <div className="mt-5 grid gap-2">
                <Button onClick={submitLog} disabled={saving} className="w-full">
                  {saving ? "Saving..." : "Done"}
                </Button>
                <Link
                  to="/forest"
                  onClick={() => {
                    if (!saving) resetWizard();
                  }}
                  className="text-center text-sm text-brand-600 hover:underline dark:text-brand-500"
                >
                  View your forest →
                </Link>
              </div>
            </Card>
          </motion.div>
        )}

        {step === "abandoned" && (
          <motion.div
            key="abandoned"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            <Card className="p-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-text-secondary">
                <ForestTree stage="sprout" size={28} className="opacity-80" />
              </div>
              <p className="font-display text-lg font-bold">Your tree paused.</p>
              <p className="mt-1 text-sm text-text-secondary">
                You focused for {focusMinutesElapsed} of {focusMinutesTotal} minutes.
              </p>
              <p className="mt-2 text-sm text-text-secondary">
                That's okay — every minute still counts. Let's try again. 🌱
              </p>
              <div className="mt-5 grid gap-2">
                <Button onClick={submitLog} disabled={saving} className="w-full">
                  {saving ? "Saving..." : "Save what I did"}
                </Button>
                <Button variant="secondary" onClick={resetWizard} className="w-full">
                  Start another session
                </Button>
                <Link to="/" className="text-center text-sm text-text-secondary hover:text-text-primary">
                  Back to Today
                </Link>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WizardStep({ title, children }: { title: string; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22 }}
    >
      <h1 className="mb-4 text-center font-display text-xl font-bold">{title}</h1>
      {children}
    </motion.div>
  );
}

function StepFooter({ onSkip, onNext }: { onSkip: () => void; onNext: () => void }) {
  return (
    <div className="mt-6 flex items-center justify-between">
      <button onClick={onSkip} className="text-sm text-text-muted hover:text-text-secondary">
        Skip
      </button>
      <Button onClick={onNext} size="sm">
        Next <ArrowRight size={14} />
      </Button>
    </div>
  );
}

function OptionButton({
  label,
  selected,
  onClick,
  full,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  full?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg border bg-surface px-3 py-2.5 text-left text-sm font-medium text-text-secondary transition-all duration-standard",
        "hover:border-border-strong",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        selected && "border-brand-600 bg-brand-500/10 text-brand-600",
        full && "w-full"
      )}
    >
      <span>{label}</span>
      {selected && <Check size={15} strokeWidth={2.5} className="shrink-0 text-brand-600" />}
    </button>
  );
}

function QuietOverlay({
  children,
  tint = "dark",
}: {
  children: ReactNode;
  tint?: "dark" | "teal";
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center px-4",
        tint === "dark" ? "bg-focus-dark" : "bg-focus-teal"
      )}
      style={{
        backgroundImage:
          "radial-gradient(640px 460px at 50% -12%, hsl(var(--brand-500) / 0.14), transparent 70%)",
      }}
    >
      {children}
    </motion.div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
