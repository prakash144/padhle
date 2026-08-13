import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookMarked, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { completeMistakeReview } from "@/lib/errors";
import { dayKey } from "@/lib/dates";
import { useToast } from "@/lib/useToast";
import { cn } from "@/lib/utils";
import type { ErrorBookDoc, TaskDoc } from "@/lib/schema";

interface ReviewHubProps {
  uid: string;
  /** All "open" mistakes from the error book. */
  errors: (ErrorBookDoc & { id: string })[];
  /** Today's not-yet-done revision tasks (already injected into the plan). */
  revisionTasks: (TaskDoc & { id: string })[];
}

/**
 * The REVIEW step of the loop: surfaces mistakes whose review date has arrived
 * (invisible anywhere else until you open the Mistake Log) plus a pointer to
 * today's scheduled chapter revisions. "Reviewed" resolves the mistake and
 * counts as one revision for the day.
 */
export function ReviewHub({ uid, errors, revisionTasks }: ReviewHubProps) {
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const todayKey = dayKey(new Date());

  const dueErrors = useMemo(
    () =>
      errors
        .filter((e) => e.reviewDate <= todayKey)
        .sort((a, b) => a.reviewDate.localeCompare(b.reviewDate))
        .slice(0, 5),
    [errors, todayKey]
  );

  const totalDue = errors.filter((e) => e.reviewDate <= todayKey).length;
  const count = totalDue + revisionTasks.length;
  if (count === 0) return null;

  const handleReviewed = async (err: ErrorBookDoc & { id: string }) => {
    if (busyId) return;
    setBusyId(err.id);
    try {
      await completeMistakeReview(uid, err.id);
      toast.success("Marked reviewed — good catch.");
    } catch {
      toast.error("Couldn't save that review. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <BookMarked size={15} className="text-brand-600" aria-hidden /> Review
        </p>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-text-secondary">
          {count} due
        </span>
      </div>

      {dueErrors.length > 0 && (
        <ul className="space-y-2">
          {dueErrors.map((err) => {
            const overdue = err.reviewDate < todayKey;
            return (
              <li
                key={err.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/40 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {err.chapterName ?? err.subjectName}
                  </p>
                  <p className="truncate text-xs text-text-muted">{err.whyWrong}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-[11px]",
                    overdue ? "text-danger" : "text-text-muted"
                  )}
                >
                  {overdue ? "Overdue" : "Due today"}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  className="shrink-0"
                  disabled={busyId !== null}
                  onClick={() => void handleReviewed(err)}
                >
                  <Check size={13} /> Reviewed
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        {revisionTasks.length > 0 ? (
          <p className="text-xs text-text-secondary">
            {revisionTasks.length} chapter revision
            {revisionTasks.length > 1 ? "s" : ""} scheduled — tick them off in
            your plan below.
          </p>
        ) : (
          <span />
        )}
        <Link
          to="/errors"
          className="ml-auto text-xs font-medium text-text-secondary hover:text-brand-600"
        >
          Open mistake log →
        </Link>
      </div>
    </Card>
  );
}
