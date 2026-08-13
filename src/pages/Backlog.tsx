import { useMemo, useState } from "react";
import { Plus, SplitSquareVertical, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { createBacklogItem, deleteBacklogItem, scheduleBacklogItem } from "@/lib/backlog";
import { useBacklog, useChapters, useErrors, useSubjects, useTasksForRange } from "@/lib/hooks";
import { createTask } from "@/lib/tasks";
import { addDays, dayKey, daysBetween } from "@/lib/dates";
import { getWeakTopics, taskCategoryForExam } from "@/lib/studyWorkflow";
import { useToast } from "@/lib/useToast";
import { cn } from "@/lib/utils";
import type { BacklogDoc, Priority, TaskCategory } from "@/lib/schema";
import { filterBacklogByContext, filterChaptersByContext, filterErrorsByContext, filterSubjectsByContext, filterTasksByContext, useAcademicContext } from "@/lib/academicContext";

type Filter = "all" | "high" | "learning" | "practice" | "revision" | "attention";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "high", label: "High Priority" },
  { value: "learning", label: "Learning" },
  { value: "practice", label: "Practice" },
  { value: "revision", label: "Revision" },
  { value: "attention", label: "Attention" },
];

const CATEGORY_OPTIONS: { value: TaskCategory; label: string }[] = [
  { value: "jee", label: "Competitive" },
  { value: "board", label: "Board" },
  { value: "school", label: "School" },
  { value: "pyq", label: "PYQ" },
  { value: "revision", label: "Revision" },
  { value: "mock", label: "Mock" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "med", label: "Medium" },
  { value: "high", label: "High" },
];

export function Backlog() {
  const { user } = useAuth();
  const allItems = useBacklog();
  const allSubjects = useSubjects();
  const allChapters = useChapters();
  const allOpenErrors = useErrors("open");
  const { selected } = useAcademicContext();
  const todayKey = dayKey(new Date());
  const allWeekTasks = useTasksForRange(todayKey, dayKey(addDays(new Date(), 6)));
  const [filter, setFilter] = useState<Filter>("all");
  const toast = useToast();
  const subjects = useMemo(() => filterSubjectsByContext(allSubjects, selected.value), [allSubjects, selected.value]);
  const chapters = useMemo(() => filterChaptersByContext(allChapters, selected.value), [allChapters, selected.value]);
  const items = useMemo(() => filterBacklogByContext(allItems, allSubjects, selected.value), [allItems, allSubjects, selected.value]);
  const openErrors = useMemo(() => filterErrorsByContext(allOpenErrors, allSubjects, selected.value), [allOpenErrors, allSubjects, selected.value]);
  const weekTasks = useMemo(() => filterTasksByContext(allWeekTasks, allSubjects, selected.value), [allWeekTasks, allSubjects, selected.value]);

  const recommendations = useMemo(
    () => {
      const queuedChapterIds = new Set(items.map((item) => item.chapterId).filter(Boolean));
      const scheduledChapterIds = new Set(
        weekTasks.map((task) => task.chapterId).filter(Boolean)
      );

      return getWeakTopics({
        chapters,
        errors: openErrors,
        todayKey,
      })
        .filter(
          (topic) =>
            !queuedChapterIds.has(topic.chapterId) && !scheduledChapterIds.has(topic.chapterId)
        )
        .slice(0, 3);
    },
    [items, weekTasks, chapters, openErrors, todayKey]
  );

  const filtered = useMemo(
    () =>
      [...items]
        .filter((item) => matchesFilter(item, filter))
        .sort((a, b) => backlogScore(b) - backlogScore(a)),
    [items, filter]
  );

  if (!user) return null;

  const queueRecommendation = async (chapterId: string) => {
    const topic = recommendations.find((item) => item.chapterId === chapterId);
    const chapter = chapters.find((item) => item.id === chapterId);
    if (!topic || !chapter) return;
    try {
      await createBacklogItem(user.uid, {
        title:
          topic.action === "revise"
            ? `Revise ${topic.chapterName}`
            : `${topic.action === "start" ? "Start" : "Practice"} ${topic.chapterName}`,
        subjectId: topic.subjectId,
        subjectName: topic.subjectName,
        chapterId: topic.chapterId,
        chapterName: topic.chapterName,
        category: topic.action === "revise" ? "revision" : taskCategoryForExam(chapter.examType),
        estimatedMinutes: topic.action === "revise" ? 25 : 40,
        priority: topic.state === "weak" || topic.state === "needs_revision" ? "high" : "med",
        origin: "adaptive",
      });
      toast.success("Added recommended topic to backlog.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't add that recommendation.");
    }
  };

  const doRecommendationNow = async (chapterId: string) => {
    const topic = recommendations.find((item) => item.chapterId === chapterId);
    const chapter = chapters.find((item) => item.id === chapterId);
    if (!topic || !chapter) return;
    try {
      await createTask(user.uid, {
        title:
          topic.action === "revise"
            ? `Revise ${topic.chapterName}`
            : `${topic.action === "start" ? "Start" : "Practice"} ${topic.chapterName}`,
        category: topic.action === "revise" ? "revision" : taskCategoryForExam(chapter.examType),
        subjectId: topic.subjectId,
        subjectName: topic.subjectName,
        chapterId: topic.chapterId,
        chapterName: topic.chapterName,
        priority: topic.state === "weak" || topic.state === "needs_revision" ? "high" : "med",
        difficulty: topic.state === "weak" ? "hard" : "med",
        estimatedMinutes: topic.action === "revise" ? 25 : 40,
        targetQuestions: topic.action === "revise" ? 8 : 15,
        scheduledDate: todayKey,
      });
      toast.success("Scheduled for today.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't schedule that recommendation.");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="font-display text-xl font-bold">Backlog</h1>
        <p className="text-sm text-text-secondary">
          {items.length} {selected.shortLabel} task{items.length === 1 ? "" : "s"} waiting to be pulled into the plan.
        </p>
      </div>

      <QuickAddCard uid={user.uid} subjects={subjects} chapters={chapters} />

      {recommendations.length > 0 && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Needs attention</p>
              <p className="text-xs text-text-secondary">
                Smart recommendations from weak topics and unresolved mistakes.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {recommendations.map((topic) => (
              <div
                key={topic.chapterId}
                className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2/50 px-3 py-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {topic.chapterName} <span className="text-text-muted">· {topic.subjectName}</span>
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">{topic.reason}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => void queueRecommendation(topic.chapterId)}>
                    Queue
                  </Button>
                  <Button size="sm" onClick={() => void doRecommendationNow(topic.chapterId)}>
                    Do now
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-micro",
              filter === option.value
                ? "border-brand-600 bg-brand-500/10 text-brand-600"
                : "border-border bg-surface text-text-secondary hover:border-border-strong hover:bg-surface-2"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="py-10 text-center text-sm text-text-secondary">
          Nothing in this filter right now.
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <BacklogRow key={item.id} uid={user.uid} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuickAddCard({
  uid,
  subjects,
  chapters,
}: {
  uid: string;
  subjects: { id: string; name: string; examType: string }[];
  chapters: { id: string; name: string; subjectId: string }[];
}) {
  const [title, setTitle] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [category, setCategory] = useState<TaskCategory>("jee");
  const [priority, setPriority] = useState<Priority>("med");
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | "">(30);
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const chapterOptions = chapters.filter((chapter) => chapter.subjectId === subjectId);

  const reset = () => {
    setTitle("");
    setSubjectId("");
    setChapterId("");
    setCategory("jee");
    setPriority("med");
    setEstimatedMinutes(30);
    setDeadline("");
    setExpanded(false);
  };

  const handleAdd = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const subject = subjects.find((item) => item.id === subjectId);
      const chapter = chapterOptions.find((item) => item.id === chapterId);
      await createBacklogItem(uid, {
        title: title.trim(),
        subjectId: subject?.id,
        subjectName: subject?.name,
        chapterId: chapter?.id,
        chapterName: chapter?.name,
        category,
        priority,
        estimatedMinutes: estimatedMinutes === "" ? undefined : Number(estimatedMinutes),
        deadline: deadline ? new Date(`${deadline}T12:00:00`) : undefined,
      });
      toast.success("Added to backlog.");
      reset();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't add that backlog item.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-2 md:flex-row">
        <Input
          placeholder="Quick add: what should be captured for later?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "Less" : "More"}
          </Button>
          <Button onClick={() => void handleAdd()} disabled={saving || !title.trim()}>
            <Plus size={14} /> Add
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Select
            value={subjectId}
            onChange={(value) => {
              setSubjectId(value);
              setChapterId("");
            }}
            options={[
              { value: "", label: "No subject" },
              ...subjects.map((subject) => ({ value: subject.id, label: subject.name })),
            ]}
          />
          <Select
            value={chapterId}
            onChange={setChapterId}
            options={[
              { value: "", label: "No chapter" },
              ...chapterOptions.map((chapter) => ({ value: chapter.id, label: chapter.name })),
            ]}
          />
          <Select value={category} onChange={(value) => setCategory(value as TaskCategory)} options={CATEGORY_OPTIONS} />
          <Select value={priority} onChange={(value) => setPriority(value as Priority)} options={PRIORITY_OPTIONS} />
          <Input
            type="number"
            min={5}
            placeholder="Minutes"
            value={estimatedMinutes}
            onChange={(e) =>
              setEstimatedMinutes(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
          <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
      )}
    </Card>
  );
}

function BacklogRow({ uid, item }: { uid: string; item: BacklogDoc & { id: string } }) {
  const [date, setDate] = useState(dayKey(new Date()));
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const handleSchedule = async (scheduledDate: string) => {
    setBusy(true);
    try {
      await scheduleBacklogItem(uid, item, scheduledDate);
      toast.success(scheduledDate === dayKey(new Date()) ? "Scheduled for today." : "Scheduled.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't schedule that task. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteBacklogItem(uid, item.id);
      toast.success("Removed from backlog.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't delete that backlog item.");
    } finally {
      setBusy(false);
    }
  };

  const handleBreakDown = async () => {
    const totalMinutes = item.estimatedMinutes ?? 60;
    const parts = totalMinutes >= 120 ? 3 : 2;
    const each = Math.ceil(totalMinutes / parts);
    setBusy(true);
    try {
      for (let i = 1; i <= parts; i++) {
        await createBacklogItem(uid, {
          title: `${item.title} — Part ${i}`,
          subjectId: item.subjectId,
          subjectName: item.subjectName,
          chapterId: item.chapterId,
          chapterName: item.chapterName,
          category: item.category,
          priority: item.priority,
          estimatedMinutes: each,
          deadline: item.deadline?.toDate?.(),
        });
      }
      await deleteBacklogItem(uid, item.id);
      toast.success("Split into smaller steps.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't break that task down.");
    } finally {
      setBusy(false);
    }
  };

  const createdDaysAgo = Math.max(0, daysBetween(item.createdAt.toDate(), new Date()));
  const deadline = item.deadline?.toDate?.();
  const deadlineText = deadline
    ? `Due ${deadline.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
    : null;

  return (
    <Card className="p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
            {item.subjectName && <span>{item.subjectName}</span>}
            {item.chapterName && <span>· {item.chapterName}</span>}
            <span className="capitalize">· {item.priority}</span>
            {item.estimatedMinutes ? <span>· {item.estimatedMinutes}m</span> : null}
            <span>· {createdDaysAgo}d old</span>
            {deadlineText ? <span>· {deadlineText}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void handleSchedule(dayKey(new Date()))}>
            Do now
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void handleSchedule(dayKey(addDays(new Date(), 1)))}>
            Tomorrow
          </Button>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 w-36"
          />
          <Button size="sm" disabled={busy} onClick={() => void handleSchedule(date)}>
            Schedule
          </Button>
          {(item.estimatedMinutes ?? 0) >= 60 && (
            <button
              onClick={() => void handleBreakDown()}
              disabled={busy}
              className="flex h-9 items-center gap-1 rounded-md border border-border px-3 text-xs font-medium text-text-secondary transition-colors duration-micro hover:border-brand-600 hover:text-brand-600 disabled:opacity-50"
            >
              <SplitSquareVertical size={14} /> Break down
            </button>
          )}
          <button
            onClick={() => void handleDelete()}
            disabled={busy}
            className="flex h-9 items-center gap-1 rounded-md border border-border px-3 text-xs font-medium text-text-muted transition-colors duration-micro hover:border-danger hover:text-danger disabled:opacity-50"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>
    </Card>
  );
}

function matchesFilter(item: BacklogDoc & { id: string }, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "high") return item.priority === "high";
  if (filter === "revision") return item.category === "revision";
  if (filter === "practice") return item.category === "pyq" || item.category === "mock";
  if (filter === "learning") {
    return item.category === "jee" || item.category === "board" || item.category === "school";
  }
  if (filter === "attention") {
    const age = daysBetween(item.createdAt.toDate(), new Date());
    const daysToDeadline = item.deadline?.toDate ? daysBetween(new Date(), item.deadline.toDate()) : 99;
    return item.priority === "high" || age >= 7 || daysToDeadline <= 2;
  }
  return true;
}

function backlogScore(item: BacklogDoc & { id: string }) {
  const priorityScore = item.priority === "high" ? 40 : item.priority === "med" ? 20 : 8;
  const age = daysBetween(item.createdAt.toDate(), new Date());
  const deadlineScore = item.deadline?.toDate
    ? Math.max(0, 20 - daysBetween(new Date(), item.deadline.toDate()) * 4)
    : 0;
  return priorityScore + age * 2 + deadlineScore;
}
