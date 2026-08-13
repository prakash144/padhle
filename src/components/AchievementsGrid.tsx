import { motion } from "framer-motion";
import { BADGES } from "@/lib/gamification";
import { cn } from "@/lib/utils";

export function AchievementsGrid({ earned }: { earned: string[] }) {
  const earnedSet = new Set(earned);

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {BADGES.map((badge, i) => {
        const isEarned = earnedSet.has(badge.id);
        return (
          <motion.div
            key={badge.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: i * 0.02 }}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border border-border bg-surface-2/50 p-3 text-center",
              !isEarned && "opacity-40 grayscale"
            )}
            title={badge.description}
          >
            <span className="text-2xl">{badge.emoji}</span>
            <p className="text-[11px] font-medium leading-tight">{badge.label}</p>
          </motion.div>
        );
      })}
    </div>
  );
}
