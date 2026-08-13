import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { useChapters, useSprintTasks, useSubjects } from "@/lib/hooks";
import { createTask, setTaskDone, setTaskStatus } from "@/lib/tasks";
import { dayKey } from "@/lib/dates";
import { useToast } from "@/lib/useToast";
import { cn } from "@/lib/utils";
import type { TaskDoc } from "@/lib/schema";

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: "jee", label: "JEE" },
  { value: "board", label: "Board" },
  { value: "school", label: "School" },
  { value: "pyq", label: "PYQ" },
  { value: "revision", label: "Revision" },
  { value: "mock", label: "Mock" },
];

const COLUMNS = [
  { key: "todo", label: "To Do", dot: "bg-border", ring: "hover:border-brand-600" },
  { key: "in_progress", label: "In Progress", dot: "bg-warning", ring: "hover:border-warning" },
  { key: "done", label: "Done", dot: "bg-success", ring: "hover:border-success" },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

const PRIORITY_META: Record<TaskDoc["priority"], { label: string; cls: string }> = {
  high: { label: "P1", cls: "text-danger" },
  med: { label: "P2", cls: "text-warning" },
  low: { label: "P3", cls: "text-text-muted" },
};

export function SprintBoard({ uid, sprintId }: { uid: string; sprintId: string }) {
  const tasks = useSprintTasks(sprintId);
  const subjects = useSubjects();
  const chapters = useChapters();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TaskDoc["category"]>("school");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | "">(25);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<ColumnKey | null>(null);
  const chapterOptions = chapters.filter((chapter) => chapter.subjectId === subjectId);

  const moveTo = async (task: TaskDoc & { id: string }, status: ColumnKey) => {
    if (task.status === status) return;
    try {
      if (status === "done") {
        await setTaskDone(uid, task, true);
      } else if (task.status === "done") {
        await setTaskDone(uid, task, false);
      } else {
        await setTaskStatus(uid, task.id, status);
      }
    } catch {
      toast.error("Couldn't move the task. Try again.");
    }
  };

  const addTask = async () => {
    if (!title.trim()) return;
    try {
      const subject = subjects.find((item) => item.id === subjectId);
      const chapter = chapterOptions.find((item) => item.id === chapterId);
      await createTask(uid, {
        title: title.trim(),
        category,
        subjectId: subject?.id,
        subjectName: subject?.name,
        chapterId: chapter?.id,
        chapterName: chapter?.name,
        priority: "med",
        difficulty: "med",
        estimatedMinutes: estimatedMinutes === "" ? 25 : Number(estimatedMinutes),
        scheduledDate: dayKey(new Date()),
        sprintId,
      });
      setTitle("");
      setSubjectId("");
      setChapterId("");
      setEstimatedMinutes(25);
    } catch {
      toast.error("Couldn't add the task.");
    }
  };

  const onDrop = (col: ColumnKey) => {
    setOverCol(null);
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const task = tasks.find((t) => t.id === id);
    if (task) void moveTo(task, col);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold">Sprint board</p>
        <span className="text-xs text-text-muted">Drag cards between columns, or use the buttons</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          placeholder="Add a task to this sprint…"
          className="min-w-52 flex-1"
        />
        <Select
          value={category}
          onChange={(v) => setCategory(v as TaskDoc["category"])}
          options={CATEGORY_OPTIONS}
          className="w-36"
        />
        <Select
          value={subjectId}
          onChange={(v) => {
            setSubjectId(v);
            setChapterId("");
          }}
          options={[
            { value: "", label: "No subject" },
            ...subjects.map((subject) => ({ value: subject.id, label: subject.name })),
          ]}
          className="w-40"
        />
        <Select
          value={chapterId}
          onChange={setChapterId}
          options={[
            { value: "", label: "No chapter" },
            ...chapterOptions.map((chapter) => ({ value: chapter.id, label: chapter.name })),
          ]}
          className="w-44"
        />
        <Input
          type="number"
          min={5}
          value={estimatedMinutes}
          onChange={(e) => setEstimatedMinutes(e.target.value === "" ? "" : Number(e.target.value))}
          className="w-24"
          aria-label="Estimated minutes"
        />
        <Button size="sm" onClick={addTask} disabled={!title.trim()}>
          <Plus size={15} /> Add
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key);
          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                setOverCol(col.key);
              }}
              onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
              onDrop={() => onDrop(col.key)}
              className={cn(
                "flex flex-col gap-2 rounded-xl border border-border bg-surface-2/50 p-2 transition-colors duration-micro",
                overCol === col.key && "border-brand-600 bg-surface",
                col.ring
              )}
            >
              <div className="flex items-center justify-between px-1">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  <span className={cn("h-2 w-2 rounded-full", col.dot)} />
                  {col.label}
                </p>
                <span className="text-xs text-text-muted">{colTasks.length}</span>
              </div>

              {colTasks.length === 0 && (
                <p className="px-1 py-3 text-center text-xs text-text-muted">Nothing here yet</p>
              )}

              {colTasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", task.id);
                    setDragId(task.id);
                  }}
                  onDragEnd={() => setDragId(null)}
                  className="group cursor-grab rounded-lg border border-border bg-surface p-2.5 text-sm shadow-e1 active:cursor-grabbing"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="leading-snug">{task.title}</p>
                    <span className={cn("font-numeric text-[11px] font-semibold", PRIORITY_META[task.priority].cls)}>
                      {PRIORITY_META[task.priority].label}
                    </span>
                  </div>
                  {task.subjectName && (
                    <p className="mt-1 text-[11px] text-text-muted">
                      {task.subjectName}
                      {task.chapterName ? ` · ${task.chapterName}` : ""}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-1">
                    <Link
                      to={`/focus?taskId=${task.id}&sprintId=${sprintId}${task.subjectId ? `&subjectId=${task.subjectId}` : ""}${task.chapterId ? `&chapterId=${task.chapterId}` : ""}`}
                      className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-brand-600 hover:bg-surface-2"
                    >
                      <span className="inline-flex items-center gap-1">
                        <Timer size={11} /> Focus
                      </span>
                    </Link>
                    {col.key !== "todo" && (
                      <button
                        onClick={() => void moveTo(task, "todo")}
                        className="rounded-md px-1.5 py-0.5 text-[11px] text-text-muted hover:bg-surface-2 hover:text-text-primary"
                      >
                        ◀ Todo
                      </button>
                    )}
                    {col.key !== "in_progress" && task.status !== "done" && (
                      <button
                        onClick={() => void moveTo(task, "in_progress")}
                        className="rounded-md px-1.5 py-0.5 text-[11px] text-text-muted hover:bg-surface-2 hover:text-text-primary"
                      >
                        ▶ Start
                      </button>
                    )}
                    {col.key !== "done" && (
                      <button
                        onClick={() => void moveTo(task, "done")}
                        className="ml-auto rounded-md px-1.5 py-0.5 text-[11px] font-medium text-success hover:bg-surface-2"
                      >
                        ✓ Done
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
