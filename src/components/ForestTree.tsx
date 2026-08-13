import { motion } from "framer-motion";
import { treeStage, type TreeStage } from "@/lib/forest";
import type { FocusSessionDoc } from "@/lib/schema";
import { cn } from "@/lib/utils";

/** Color ramp mirrors the study-growth palette (seed → sprout → young → great).
 *  An unusually long session (≥ 90 min) earns a gold milestone tree. */
function treeColor(stage: TreeStage, milestone: boolean): string {
  if (milestone) return "text-forest-milestone";
  switch (stage) {
    case "wilted":
      return "text-forest-seed";
    case "sprout":
      return "text-forest-sprout";
    case "tree":
      return "text-forest-young";
    case "big-tree":
      return "text-forest-great";
  }
}

export function ForestTree({
  stage,
  milestone = false,
  size = 22,
  className,
}: {
  stage: TreeStage;
  milestone?: boolean;
  size?: number;
  className?: string;
}) {
  const color = treeColor(stage, milestone);
  const trunk = (
    <rect x="10.6" y="14" width="2.8" height="7" rx="1.2" fill="currentColor" opacity={0.72} />
  );
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn(color, className)}
      aria-hidden
      focusable="false"
    >
      {stage === "wilted" && (
        <>
          <path
            d="M12 22V15"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M12 15c0-1.8-1.4-3-3.2-3.2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M9.2 10.6c-1.8-.3-3-1.7-2.7-3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
        </>
      )}
      {stage === "sprout" && (
        <>
          <path
            d="M12 22V12"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
          <ellipse cx="8" cy="7.5" rx="2.6" ry="1.8" fill="currentColor" />
          <ellipse cx="16" cy="7.5" rx="2.6" ry="1.8" fill="currentColor" />
          <path d="M12 12c-2.6.2-4-1.6-3.6-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          <path d="M12 12c2.6.2 4-1.6 3.6-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </>
      )}
      {stage === "tree" && (
        <>
          {trunk}
          <circle cx="12" cy="9" r="5.8" fill="currentColor" />
        </>
      )}
      {stage === "big-tree" && (
        <>
          <rect x="10.4" y="14" width="3.2" height="7" rx="1.4" fill="currentColor" opacity={0.75} />
          <circle cx="9" cy="10.5" r="4.4" fill="currentColor" />
          <circle cx="15" cy="10.5" r="4.4" fill="currentColor" />
          <circle cx="12" cy="7.5" r="4.8" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

/** Derives a stage from a session; long completed sessions are gold milestones. */
export function SessionTree({
  session,
  size,
  className,
  delay = 0,
}: {
  session: FocusSessionDoc & { id: string };
  size?: number;
  className?: string;
  delay?: number;
}) {
  const stage = treeStage(session);
  const milestone = session.focusMinutes >= 90;
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.24, delay }}
      className={cn(
        "leading-none",
        milestone && "drop-shadow-[0_0_4px_hsl(var(--forest-milestone)/.35)]"
      )}
      title={`${session.subjectName ?? "Focus"} · ${session.focusMinutes}m${milestone ? " · milestone" : ""}`}
    >
      <ForestTree stage={stage} milestone={milestone} size={size} className={className} />
    </motion.span>
  );
}
