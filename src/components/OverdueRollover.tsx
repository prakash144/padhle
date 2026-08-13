import { Card } from "@/components/ui/card";
import { rescheduleTask, dropTask } from "@/lib/tasks";
import { moveTaskToBacklog } from "@/lib/backlog";
import { dayKey } from "@/lib/dates";
import { useToast } from "@/lib/useToast";
import type { TaskDoc } from "@/lib/schema";

/**
 * The "adaptive" half of Phase 5: rather than letting overdue tasks silently
 * rot, surface them once and ask what to do — mirrors the plan's "25
 * questions remaining. Move to Tuesday / Add to backlog / Drop" idea, minus
 * the throughput-prediction stretch goal (left for a later pass, see TODO.md).
 */
export function OverdueRollover({
  uid,
  tasks,
}: {
  uid: string;
  tasks: (TaskDoc & { id: string })[];
}) {
  const toast = useToast();
  if (tasks.length === 0) return null;
  const today = dayKey(new Date());

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't update that task. Try again.");
    }
  };

  return (
    <Card className="p-4">
      <p className="mb-2 text-sm font-semibold">
        {tasks.length} unfinished from before — what now?
      </p>
      <div className="space-y-2">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">{task.title}</span>
            <div className="flex shrink-0 gap-1">
              <button
                onClick={() => run(() => rescheduleTask(uid, task, today))}
                className="rounded-md border border-border px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface-2"
              >
                Today
              </button>
              <button
                onClick={() => run(() => moveTaskToBacklog(uid, task))}
                className="rounded-md border border-border px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface-2"
              >
                Backlog
              </button>
              <button
                onClick={() => run(() => dropTask(uid, task))}
                className="rounded-md border border-border px-2 py-1 text-xs font-medium text-text-muted hover:bg-surface-2 hover:text-danger"
              >
                Drop
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
