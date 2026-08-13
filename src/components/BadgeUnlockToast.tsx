import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Badge } from "@/lib/gamification";

export function BadgeUnlockToast({
  badge,
  onDismiss,
}: {
  badge: Badge | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!badge) return;
    const id = setTimeout(onDismiss, 3200);
    return () => clearTimeout(id);
  }, [badge, onDismiss]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex justify-center px-4">
      <AnimatePresence>
        {badge && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="pointer-events-auto flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-e3"
          >
            <span className="text-2xl">{badge.emoji}</span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                Achievement unlocked
              </p>
              <p className="text-sm font-medium">{badge.label}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
