import { Pencil, PencilLine, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MASTERY_LABEL, MASTERY_STAGES, nextMasteryStage } from "@/lib/chapters";
import { cn } from "@/lib/utils";
import type { ChapterDoc } from "@/lib/schema";

// One color per filled segment (5 segments = MASTERY_STAGES minus "not_started").
const SEGMENT_COLOR = [
  "bg-mastery-learning",
  "bg-mastery-practiced",
  "bg-mastery-confident",
  "bg-mastery-confident",
  "bg-mastery-mastered",
];

export function ChapterMasteryRow({
  chapter,
  stateLabel,
  summary,
  masteryPct,
  onAdvance,
  onAction,
  actionLabel,
  onPractice,
  onQueue,
  onRename,
  onDelete,
}: {
  chapter: ChapterDoc & { id: string };
  stateLabel?: string;
  summary?: string;
  masteryPct?: number;
  onAdvance: () => void;
  onAction?: () => void;
  actionLabel?: string;
  onPractice?: () => void;
  onQueue?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  const stageIndex = MASTERY_STAGES.indexOf(chapter.masteryStage);
  const accuracy =
    chapter.accuracyDen > 0 ? Math.round((chapter.accuracyNum / chapter.accuracyDen) * 100) : null;
  const isMastered = chapter.masteryStage === "mastered";
  const resolvedStateLabel = stateLabel ?? MASTERY_LABEL[chapter.masteryStage];
  const stateTone =
    resolvedStateLabel === "Weak"
      ? "warning"
      : resolvedStateLabel === "Needs revision"
        ? "brand"
        : resolvedStateLabel === "Mastered"
          ? "success"
          : "neutral";

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{chapter.name}</p>
          {chapter.weightage && chapter.weightage >= 7 && (
            <span className="shrink-0 text-xs text-warning">★</span>
          )}
          <span className="ml-auto flex shrink-0 items-center gap-1">
            {onRename && (
              <button
                onClick={onRename}
                aria-label={`Rename ${chapter.name}`}
                title="Rename"
                className="rounded-full p-1.5 text-text-muted transition-colors duration-micro hover:bg-surface-2 hover:text-text-primary"
              >
                <Pencil size={13} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                aria-label={`Delete ${chapter.name}`}
                title="Delete"
                className="rounded-full p-1.5 text-text-muted transition-colors duration-micro hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 size={13} />
              </button>
            )}
          </span>
        </div>
        <div className="mt-1.5 flex h-1.5 gap-0.5">
          {MASTERY_STAGES.slice(1).map((stage, i) => (
            <span
              key={stage}
              className={cn("flex-1 rounded-full bg-border", i < stageIndex && SEGMENT_COLOR[i])}
            />
          ))}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <Badge tone={stateTone} size="sm">
            {resolvedStateLabel}
          </Badge>
          {accuracy !== null && <span>· {accuracy}% accuracy</span>}
          {typeof masteryPct === "number" && <span>· {masteryPct}% mastery</span>}
        </div>
        {summary && (
          <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{summary}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <div className="flex items-center gap-1.5">
          {onQueue && (
            <button
              onClick={onQueue}
              aria-label={`Queue ${chapter.name}`}
              title="Send to backlog"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-2 text-text-secondary transition-colors duration-micro hover:border-brand-600 hover:text-brand-600"
            >
              <Plus size={14} />
            </button>
          )}
          {onAction && actionLabel && (
            <button
              onClick={onAction}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity duration-micro hover:opacity-95"
            >
              {actionLabel}
            </button>
          )}
        </div>
        {onPractice && (
          <button
            onClick={onPractice}
            aria-label={`Practice ${chapter.name}`}
            title="Practice this chapter"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-2 text-text-secondary transition-colors duration-micro hover:border-brand-600 hover:text-brand-600"
          >
            <PencilLine size={14} />
          </button>
        )}
        <button
          onClick={onAdvance}
          disabled={isMastered}
          className="shrink-0 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-micro hover:bg-surface disabled:opacity-40"
        >
          {isMastered ? "Mastered" : `→ ${MASTERY_LABEL[nextMasteryStage(chapter.masteryStage)]}`}
        </button>
      </div>
    </div>
  );
}
