import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

/** A calm, understated daily streak. No pulsing, no aggressive gamification. */
export function StreakFlame({ streak, className }: { streak: number; className?: string }) {
  const hasStreak = streak > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-sm font-medium",
        className
      )}
      title={`${streak} day streak`}
    >
      <Flame
        size={15}
        className={hasStreak ? "text-streak" : "text-text-muted"}
        fill="currentColor"
        fillOpacity={hasStreak ? 0.2 : 0}
        aria-hidden
      />
      <span className="font-numeric tabular">{streak}</span>
      {hasStreak && (
        <span className="hidden text-xs font-normal text-text-muted sm:inline">day streak</span>
      )}
    </span>
  );
}
