import { motion } from "framer-motion";
import { levelForXp } from "@/lib/gamification";
import { cn } from "@/lib/utils";

export function LevelBadge({ xp, compact = false }: { xp: number; compact?: boolean }) {
  const { level, progress } = levelForXp(xp);

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
        Lv {level}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {level}
      </span>
      <div className="min-w-0 flex-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-border">
          <motion.div
            className="h-full rounded-full bg-brand-600 dark:bg-brand-500"
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
          />
        </div>
      </div>
      <span className={cn("shrink-0 text-xs tabular text-achievement")}>{xp} XP</span>
    </div>
  );
}
