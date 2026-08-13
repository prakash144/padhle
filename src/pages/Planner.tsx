import { useMemo, useState, type DragEvent } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TaskItem } from "@/components/TaskItem";
import { TaskFormDialog } from "@/components/TaskFormDialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  useBacklog,
  useChapters,
  useCheckin,
  useDayCounter,
  useErrors,
  useSubjects,
  useTasksForDate,
  useTasksForRange,
} from "@/lib/hooks";
import { scheduleBacklogItem } from "@/lib/backlog";
import { setTaskDone, deleteTask, rescheduleTask, createTask } from "@/lib/tasks";
import { buildAutoPlan, type AutoPlanSuggestion } from "@/lib/studyWorkflow";
import { dayKey, addDays, weekDates, monthGrid } from "@/lib/dates";
import { useToast } from "@/lib/useToast";
import type { TaskDoc } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { filterBacklogByContext, filterChaptersByContext, filterErrorsByContext, filterSubjectsByContext, filterTasksByContext, useAcademicContext } from "@/lib/academicContext";

type View = "day" | "week" | "month";

const WEEKDAY_LABEL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_BUDGET_MINUTES = 240;

export function Planner() {
  const { user } = useAuth();
  const [view, setView] = useState<View>("week");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [applyingPlan, setApplyingPlan] = useState(false);
  const toast = useToast();
  const { selected, activeExam } = useAcademicContext();

  const allSubjects = useSubjects();
  const allChapters = useChapters();
  const allBacklog = useBacklog();
  const allOpenErrors = useErrors("open");
  const subjects = useMemo(() => filterSubjectsByContext(allSubjects, selected.value), [allSubjects, selected.value]);
  const chapters = useMemo(() => filterChaptersByContext(allChapters, selected.value), [allChapters, selected.value]);
  const backlog = useMemo(() => filterBacklogByContext(allBacklog, allSubjects, selected.value), [allBacklog, allSubjects, selected.value]);
  const openErrors = useMemo(() => filterErrorsByContext(allOpenErrors, allSubjects, selected.value), [allOpenErrors, allSubjects, selected.value]);

  const selectedKey = dayKey(selectedDate);
  const allDayTasks = useTasksForDate(selectedKey);
  const checkin = useCheckin(selectedKey);
  const dayCounter = useDayCounter(selectedKey);

  const week = useMemo(() => weekDates(selectedDate), [selectedDate]);
  const allWeekTasks = useTasksForRange(dayKey(week[0]), dayKey(week[6]));

  const grid = useMemo(() => monthGrid(selectedDate), [selectedDate]);
  const allMonthTasks = useTasksForRange(dayKey(grid[0]), dayKey(grid[grid.length - 1]));
  const dayTasks = useMemo(() => filterTasksByContext(allDayTasks, allSubjects, selected.value), [allDayTasks, allSubjects, selected.value]);
  const weekTasks = useMemo(() => filterTasksByContext(allWeekTasks, allSubjects, selected.value), [allWeekTasks, allSubjects, selected.value]);
  const monthTasks = useMemo(() => filterTasksByContext(allMonthTasks, allSubjects, selected.value), [allMonthTasks, allSubjects, selected.value]);
  const primaryExam = activeExam;

  const autoPlan = useMemo(
    () =>
      buildAutoPlan({
        dateKey: selectedKey,
        dailyTargetMinutes: checkin?.dailyTargetMinutes,
        tasks: dayTasks,
        backlog,
        chapters,
        subjects,
        errors: openErrors,
        primaryExam,
      }),
    [selectedKey, checkin?.dailyTargetMinutes, dayTasks, backlog, chapters, subjects, openErrors, primaryExam]
  );

  if (!user) return null;

  const jumpTo = (date: Date) => {
    setSelectedDate(date);
    setView("day");
  };

  const handleToggle = async (task: TaskDoc & { id: string }, done: boolean) => {
    try {
      await setTaskDone(user.uid, task, done);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save that change. Try again.");
    }
  };

  const handleDelete = async (task: TaskDoc & { id: string }) => {
    try {
      await deleteTask(user.uid, task);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't delete that task. Try again.");
    }
  };

  const handleReschedule = async (task: TaskDoc & { id: string }, date: string) => {
    try {
      await rescheduleTask(user.uid, task, date);
      toast.success(date === dayKey(new Date()) ? "Moved to today." : "Moved.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't move that task. Try again.");
    }
  };

  const handleDropOnDay = async (date: string, e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain") || draggingId;
    const task = weekTasks.find((item) => item.id === taskId) ?? monthTasks.find((item) => item.id === taskId);
    setDraggingId(null);
    if (!task || task.scheduledDate === date) return;
    await handleReschedule(task, date);
  };

  const applySuggestion = async (suggestion: AutoPlanSuggestion) => {
    if (suggestion.source === "backlog" && suggestion.backlogId) {
      const item = backlog.find((backlogItem) => backlogItem.id === suggestion.backlogId);
      if (!item) return;
      await scheduleBacklogItem(user.uid, item, selectedKey);
      return;
    }

    await createTask(user.uid, {
      title: suggestion.title,
      category: suggestion.category,
      subjectId: suggestion.subjectId,
      subjectName: suggestion.subjectName,
      chapterId: suggestion.chapterId,
      chapterName: suggestion.chapterName,
      priority: suggestion.priority,
      difficulty: suggestion.priority === "high" ? "hard" : "med",
      estimatedMinutes: suggestion.estimatedMinutes,
      targetQuestions: suggestion.targetQuestions,
      deadline: suggestion.deadline,
      scheduledDate: selectedKey,
    });
  };

  const applyAutoPlan = async () => {
    if (autoPlan.suggestions.length === 0 || applyingPlan) return;
    setApplyingPlan(true);
    try {
      for (const suggestion of autoPlan.suggestions) {
        await applySuggestion(suggestion);
      }
      toast.success("Auto Plan added today's work.");
    } catch (err) {
      console.error(err);
      toast.error("Auto Plan couldn't finish. Check the plan before retrying.");
    } finally {
      setApplyingPlan(false);
    }
  };

  const pendingDayTasks = dayTasks.filter((task) => task.status !== "done");
  const plannedMinutes = dayTasks.reduce((sum, task) => sum + (task.estimatedMinutes || 0), 0);
  const pendingMinutes = pendingDayTasks.reduce((sum, task) => sum + (task.estimatedMinutes || 0), 0);
  const overloaded = pendingMinutes > (checkin?.dailyTargetMinutes ?? DAY_BUDGET_MINUTES);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold">Planner</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Schedule {selected.shortLabel} work for the week, then let Today pick the next action.
          </p>
        </div>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "day", label: "Day" },
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
        />
      </div>

      {view === "day" && (
        <>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedDate((d) => addDays(d, -1))}
              className="rounded-md p-2 hover:bg-surface-2"
              aria-label="Previous day"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setSelectedDate(new Date())}
              className="text-sm font-medium text-text-secondary hover:text-text-primary"
            >
              {selectedDate.toLocaleDateString("en-IN", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </button>
            <button
              onClick={() => setSelectedDate((d) => addDays(d, 1))}
              className="rounded-md p-2 hover:bg-surface-2"
              aria-label="Next day"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <Card className="p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-center">
              <PlannerStat label="Planned" value={`${plannedMinutes}m`} />
              <PlannerStat label="Actual" value={`${dayCounter.focusMinutes}m`} />
              <PlannerStat
                label="Tasks"
                value={`${dayCounter.completedTasks}/${dayCounter.plannedTasks}`}
              />
              <Button
                variant="secondary"
                disabled={applyingPlan || autoPlan.suggestions.length === 0}
                onClick={() => void applyAutoPlan()}
              >
                <Sparkles size={15} /> {applyingPlan ? "Planning..." : "Auto Plan"}
              </Button>
            </div>
            {pendingDayTasks.length > 0 && pendingMinutes > 0 && (
              <div className="mt-4 flex items-center gap-3">
                <p className="shrink-0 text-xs font-medium text-text-secondary">Daily load</p>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-500 ease-out",
                      overloaded ? "bg-warning" : "bg-brand-600"
                    )}
                    style={{
                      width: `${Math.min(
                        100,
                        (pendingMinutes / (checkin?.dailyTargetMinutes ?? DAY_BUDGET_MINUTES)) * 100
                      )}%`,
                    }}
                  />
                </div>
                <span
                  className={cn(
                    "shrink-0 text-xs font-medium tabular",
                    overloaded ? "text-warning" : "text-text-secondary"
                  )}
                >
                  ~{Math.round((pendingMinutes / 60) * 10) / 10}h{overloaded ? " · heavy" : ""}
                </span>
              </div>
            )}
          </Card>

          {autoPlan.suggestions.length > 0 && (
            <Card className="p-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles size={15} className="text-brand-600" /> Suggested next blocks
              </p>
              <div className="space-y-2">
                {autoPlan.suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="flex flex-col gap-2 rounded-lg bg-surface-2 px-3 py-2 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{suggestion.title}</p>
                      <p className="text-xs text-text-secondary">
                        {suggestion.estimatedMinutes}m · {suggestion.reason}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={applyingPlan}
                      onClick={() => {
                        setApplyingPlan(true);
                        applySuggestion(suggestion)
                          .then(() => toast.success("Added to the day."))
                          .catch((err) => {
                            console.error(err);
                            toast.error("Couldn't add that suggestion.");
                          })
                          .finally(() => setApplyingPlan(false));
                      }}
                    >
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="space-y-2">
            {dayTasks.length === 0 && (
              <Card className="py-8 text-center text-sm text-text-secondary">
                Nothing planned yet. Add a task or run Auto Plan.
              </Card>
            )}
            {dayTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={(done) => handleToggle(task, done)}
                onDelete={() => handleDelete(task)}
                onRescheduleNext={() => handleReschedule(task, dayKey(addDays(selectedDate, 1)))}
              />
            ))}
          </div>

          <Button onClick={() => setDialogOpen(true)} variant="secondary" className="w-full">
            <Plus size={16} /> Add task
          </Button>

          <TaskFormDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            uid={user.uid}
            scheduledDate={selectedKey}
            subjects={subjects}
            chapters={chapters}
          />
        </>
      )}

      {view === "week" && (
        <div className="grid gap-2 md:grid-cols-7">
          {week.map((date, i) => {
            const key = dayKey(date);
            const tasksForDay = weekTasks.filter((task) => task.scheduledDate === key);
            const doneCount = tasksForDay.filter((task) => task.status === "done").length;
            const dayLoad = tasksForDay
              .filter((task) => task.status !== "done")
              .reduce((sum, task) => sum + (task.estimatedMinutes || 0), 0);
            const actualMinutes = key === selectedKey ? dayCounter.focusMinutes : 0;
            const isToday = key === dayKey(new Date());
            return (
              <section
                key={key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => void handleDropOnDay(key, e)}
                className={cn(
                  "min-h-40 rounded-lg border border-border bg-surface p-2",
                  isToday && "border-brand-600",
                  dayLoad > DAY_BUDGET_MINUTES && !isToday && "border-warning/50"
                )}
              >
                <button onClick={() => jumpTo(date)} className="mb-2 w-full text-left">
                  <span className="block text-[11px] font-medium text-text-muted">{WEEKDAY_LABEL[i]}</span>
                  <span className="font-numeric text-lg font-semibold tabular">{date.getDate()}</span>
                  <span className="ml-2 text-[11px] text-text-muted">
                    {doneCount}/{tasksForDay.length} · {dayLoad}m
                    {actualMinutes ? ` · ${actualMinutes}m actual` : ""}
                  </span>
                </button>
                <div className="space-y-1.5">
                  {tasksForDay.slice(0, 4).map((task) => (
                    <button
                      key={task.id}
                      draggable={task.status !== "done"}
                      onDragStart={(e) => {
                        setDraggingId(task.id);
                        e.dataTransfer.setData("text/plain", task.id);
                      }}
                      onClick={() => jumpTo(date)}
                      className={cn(
                        "w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-left text-xs transition-colors hover:border-brand-600",
                        task.status === "done" && "opacity-60"
                      )}
                    >
                      <span className="line-clamp-2">{task.title}</span>
                    </button>
                  ))}
                  {tasksForDay.length > 4 && (
                    <p className="text-center text-[11px] text-text-muted">+{tasksForDay.length - 4} more</p>
                  )}
                  {tasksForDay.length === 0 && (
                    <p className="rounded-md border border-dashed border-border px-2 py-6 text-center text-xs text-text-muted">
                      Drop work here
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {view === "month" && (
        <div>
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-text-muted">
            {WEEKDAY_LABEL.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((date) => {
              const key = dayKey(date);
              const inMonth = date.getMonth() === selectedDate.getMonth();
              const tasksForDay = monthTasks.filter((task) => task.scheduledDate === key);
              const isToday = key === dayKey(new Date());
              return (
                <button
                  key={key}
                  onClick={() => jumpTo(date)}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-border bg-surface text-xs",
                    !inMonth && "opacity-40",
                    isToday && "border-brand-600"
                  )}
                >
                  <span className="font-numeric tabular">{date.getDate()}</span>
                  {tasksForDay.length > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-text-muted">
                      <CalendarClock size={10} /> {tasksForDay.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PlannerStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className="font-numeric text-lg font-semibold tabular">{value}</p>
    </div>
  );
}
