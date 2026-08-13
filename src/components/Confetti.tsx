import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = ["#176B4D", "#35B77A", "#55A982", "#E5A72C", "#3C9E76", "#7A8B3E"];

interface Piece {
  id: number;
  x: number;
  rotate: number;
  color: string;
  delay: number;
  drift: number;
}

function makePieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    rotate: Math.random() * 360,
    color: COLORS[i % COLORS.length],
    delay: Math.random() * 0.15,
    drift: (Math.random() - 0.5) * 80,
  }));
}

/**
 * A small, dependency-free confetti burst — reserved for moments that
 * actually deserve celebration (badge unlock, sprint complete, level up,
 * streak milestone), never for routine actions like ticking off a task.
 * Firing too often trains students to ignore it; scarcity is what makes it
 * feel special.
 *
 * Usage: bump a counter state (`setTrigger(t => t + 1)`) each time you want a
 * burst, and pass it as `trigger` — every change replays the animation with
 * a fresh random burst, even if triggered twice in a row.
 */
export function Confetti({ trigger, count = 24 }: { trigger: number; count?: number }) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (trigger === 0) return;
    setPieces(makePieces(count));
    const id = setTimeout(() => setPieces([]), 1500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  const hasPieces = useMemo(() => pieces.length > 0, [pieces]);
  if (!hasPieces) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      <AnimatePresence>
        {pieces.map((p) => (
          <motion.span
            key={p.id}
            initial={{ opacity: 1, top: "-5%", left: `${p.x}%`, rotate: 0 }}
            animate={{
              opacity: [1, 1, 0],
              top: "100%",
              left: `${p.x + p.drift / 10}%`,
              rotate: p.rotate,
            }}
            transition={{ duration: 1.4, delay: p.delay, ease: "easeIn" }}
            style={{ backgroundColor: p.color }}
            className="absolute h-2.5 w-2.5 rounded-sm"
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
