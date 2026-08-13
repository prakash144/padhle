import { motion } from "framer-motion";
import { CalendarArrowDown, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TaskDoc } from "@/lib/schema";

const CATEGORY_LABEL: Record<TaskDoc["category"], string> = {
  jee: "JEE",
  board: "Board",
  school: "School",
  pyq: "PYQ",
  revision: "Revision",
  mock: "Mock",
};

const CATEGORY_TONE: Record<TaskDoc["category"], "brand" | "info" | "neutral" | "warning" | "success" | "danger"> = {
  jee: "brand",
  board: "info",
  school: "neutral",
  pyq: "warning",
  revision: "success",
  mock: "danger",
};

const DIFFICULTY_META: Record<TaskDoc["difficulty"], { label: string; tone: "success" | "warning" | "danger" }> = {
  easy: { label: "Easy", tone: "success" },
  med: { label: "Med", tone: "warning" },
  hard: { label: "Hard", tone: "danger" },
};

const PRIORITY_DOT: Record<TaskDoc["priority"], string> = {
  high: "bg-danger",
  med: "bg-warning",
  low: "bg-text-muted",
};

export function TaskItem({
  task,
  onToggle,
  onDelete,
  onRescheduleNext,
}: {
  task: TaskDoc & { id: string };
  onToggle: (done: boolean) => void;
  onDelete?: () => void;
  onRescheduleNext?: () => void;
}) {
  const done = task.status === "done";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-border bg-surface p-3 shadow-e1",
        "transition-[box-shadow,border-color,transform] duration-standard hover:border-border-strong hover:shadow-e2",
        done && "opacity-60"
      )}
    >
      <Checkbox checked={done} onCheckedChange={(v) => onToggle(v === true)} />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", done && "text-text-secondary line-through")}>
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <span
            className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_DOT[task.priority])}
            title={`Priority: ${task.priority}`}
          />
          {task.subjectName && <span>{task.subjectName}</span>}
          <Badge tone={CATEGORY_TONE[task.category]} size="sm">
            {CATEGORY_LABEL[task.category]}
          </Badge>
          <Badge tone={DIFFICULTY_META[task.difficulty ?? "med"].tone} size="sm">
            {DIFFICULTY_META[task.difficulty ?? "med"].label}
          </Badge>
          <span>{task.estimatedMinutes}m</span>
          {task.targetQuestions ? <span>{task.targetQuestions}Q</span> : null}
        </div>
      </div>
      {onRescheduleNext && !done && (
        <button
          onClick={onRescheduleNext}
          aria-label={`Move ${task.title} to tomorrow`}
          title="Move to tomorrow"
          className="rounded-lg p-1.5 text-text-muted opacity-70 transition-opacity duration-micro hover:bg-surface-2 hover:text-brand-600 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
        >
          <CalendarArrowDown size={16} />
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          aria-label={`Delete ${task.title}`}
          title="Delete task"
          className="rounded-lg p-1.5 text-text-muted opacity-70 transition-opacity duration-micro hover:bg-surface-2 hover:text-danger focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
        >
          <Trash2 size={16} />
        </button>
      )}
    </motion.div>
  );
}