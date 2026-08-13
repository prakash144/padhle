import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { sprintCompletionPct, sprintDayProgress } from "@/lib/sprints";
import type { SprintDoc } from "@/lib/schema";
import { cn } from "@/lib/utils";

export function SprintCard({
  sprint,
  compact = false,
}: {
  sprint: SprintDoc & { id: string };
  compact?: boolean;
}) {
  const { currentDay, totalDays } = sprintDayProgress(sprint);
  const pct = sprintCompletionPct(sprint);
  const questionsLeft = Math.max(0, sprint.goals.targetQuestions - sprint.progress.questions);

  return (
    <Link to={`/sprints/${sprint.id}`} className="group block">
      <Card
        className={cn(
          "transition-[border-color,box-shadow,transform] duration-standard hover:border-brand-600",
          compact ? "p-3" : "p-4"
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate font-display font-semibold">{sprint.name}</p>
          <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-text-secondary">
            {sprint.type === "mistake" ? "Mistakes" : `${sprint.type}-day`}
          </span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-brand-600 transition-all duration-hero dark:bg-brand-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2.5 text-xs text-text-secondary">
          Day {currentDay} of {totalDays} · {pct}% · {questionsLeft} questions remaining
        </p>
      </Card>
    </Link>
  );
}
