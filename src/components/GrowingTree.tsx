import { motion } from "framer-motion";
import { ForestTree } from "@/components/ForestTree";
import { GROWTH_LABEL, growthStage, type GrowthStage, type TreeVariety } from "@/lib/forest";
import { cn } from "@/lib/utils";

/** Maps a live growth stage to the closest settled tree silhouette. */
const STAGE_TO_TREE: Record<GrowthStage, "sprout" | "tree" | "big-tree"> = {
  seed: "sprout",
  sprout: "sprout",
  young: "tree",
  mature: "big-tree",
  full: "big-tree",
};

const VARIETY_COLOR: Record<TreeVariety, string> = {
  pine: "text-forest-mature",
  oak: "text-forest-young",
  birch: "text-forest-sprout",
  palm: "text-forest-great",
};

/**
 * The tree that grows while a focus session runs. Driven purely by `progress`
 * (0–1 of planned focus time): seed → sprout → young → mature → full. Growth
 * is a slow scale + rise so it reads as "getting bigger", not an animation
 * show — the student should be able to look away and just study.
 */
export function GrowingTree({
  progress,
  variety = "oak",
  size = 120,
  label = true,
  className,
}: {
  /** 0–1, fraction of the planned focus time completed. */
  progress: number;
  variety?: TreeVariety;
  size?: number;
  label?: boolean;
  className?: string;
}) {
  const clamped = Math.min(1, Math.max(0, progress));
  const stage = growthStage(clamped);
  const treeStage = STAGE_TO_TREE[stage];
  const full = stage === "full";

  // Scale the silhouette across stages: seed sits tiny on the ground line and
  // grows into a full-size tree, with a final pop at 100%.
  const scale =
    stage === "seed"
      ? 0.32
      : stage === "sprout"
        ? 0.5
        : stage === "young"
          ? 0.72
          : stage === "mature"
            ? 0.9
            : 1.1;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <motion.div
        initial={{ scale: 0.2, y: 6 }}
        animate={{ scale, y: full ? -4 : 0 }}
        transition={{
          type: "spring",
          stiffness: 90,
          damping: 16,
          mass: 0.7,
          ...(full && { type: "spring", stiffness: 260, damping: 14 }),
        }}
      >
        <motion.div
          animate={
            !full && { scaleY: [1, 1.015, 1], y: [0, -1.5, 0] }
          }
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <ForestTree
            stage={treeStage}
            milestone={full}
            size={size}
            className={cn(full && "drop-shadow-[0_0_14px_hsl(var(--forest-milestone)/.4)]")}
          />
        </motion.div>
      </motion.div>
      {label && (
        <motion.p
          key={stage}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "mt-3 text-xs font-medium tracking-wide",
            full ? "text-forest-milestone" : VARIETY_COLOR[variety]
          )}
        >
          {full ? "Fully grown!" : GROWTH_LABEL[stage]}
        </motion.p>
      )}
    </div>
  );
}
