import { motion, useReducedMotion } from "framer-motion";
import {
  BookOpen,
  Brain,
  Microscope,
  Pencil,
  Sprout,
  Target,
  Timer,
  type LucideIcon,
} from "lucide-react";

const BLOBS = [
  { color: "bg-brand-500/30", blur: "blur-3xl", init: { x: "-20%", y: "10%" }, dur: 26 },
  { color: "bg-[#3A9D5D]/25", blur: "blur-3xl", init: { x: "70%", y: "-15%" }, dur: 32 },
  { color: "bg-[#C99618]/20", blur: "blur-2xl", init: { x: "60%", y: "65%" }, dur: 38 },
] as const;

interface FloatItem {
  Icon: LucideIcon;
  color: string;
  x: string;
  dur: number;
  delay: number;
  size: string;
  rotate: number[];
}

// Study-themed open-source icons (lucide) drifting upward with a gentle
// rotation — cheaper than images (opacity/transform only, 60fps).
const FLOATING: FloatItem[] = [
  { Icon: Pencil, color: "text-brand-600", x: "8%", dur: 22, delay: 0, size: "h-6 w-6", rotate: [0, 18, -6, 0] },
  { Icon: BookOpen, color: "text-forest-sprout", x: "78%", dur: 26, delay: 4, size: "h-8 w-8", rotate: [0, -14, 8, 0] },
  { Icon: Timer, color: "text-forest-young", x: "35%", dur: 19, delay: 9, size: "h-5 w-5", rotate: [0, 20, -10, 0] },
  { Icon: Sprout, color: "text-forest-mature", x: "88%", dur: 24, delay: 2, size: "h-6 w-6", rotate: [0, -16, 6, 0] },
  { Icon: Microscope, color: "text-forest-great", x: "60%", dur: 21, delay: 14, size: "h-6 w-6", rotate: [0, 12, -8, 0] },
  { Icon: Brain, color: "text-brand-400", x: "18%", dur: 28, delay: 7, size: "h-8 w-8", rotate: [0, -12, 10, 0] },
  { Icon: Target, color: "text-forest-milestone/80", x: "92%", dur: 30, delay: 12, size: "h-6 w-6", rotate: [0, 14, -6, 0] },
] as const;

/**
 * Full-screen animated study backdrop for the login/onboarding screens:
 * slow-moving color blobs + floating icons. Framer Motion animates only
 * transform/opacity so it stays 60fps, and it goes static for users with
 * reduced-motion enabled.
 */
export function LoginBackdrop() {
  const reduced = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Base tint so the blobs read softly over bg-bg */}
      <div className="absolute inset-0 bg-gradient-to-b from-brand-500/[0.06] via-transparent to-[#C99618]/[0.04]" />

      {BLOBS.map((blob, i) => (
        <motion.div
          key={i}
          className={`absolute h-[55vmax] w-[55vmax] rounded-full ${blob.color} ${blob.blur}`}
          initial={{ ...blob.init }}
          animate={
            reduced
              ? undefined
              : {
                  x: ["-20%", "15%", "-5%", "25%", "-20%"],
                  y: ["10%", "35%", "60%", "20%", "10%"],
                }
          }
          transition={
            reduced ? undefined : { duration: blob.dur, repeat: Infinity, ease: "easeInOut" }
          }
        />
      ))}

      {!reduced &&
        FLOATING.map((f, i) => (
          <motion.span
            key={i}
            className={`absolute bottom-[-6%] opacity-30 ${f.size} ${f.color}`}
            style={{ left: f.x }}
            animate={{ y: ["0vmax", "-110vmax"], rotate: f.rotate }}
            transition={{
              y: { duration: f.dur, repeat: Infinity, delay: f.delay, ease: "linear" },
              rotate: { duration: f.dur / 2, repeat: Infinity, ease: "easeInOut" },
            }}
          >
            <f.Icon strokeWidth={1.5} className="h-full w-full drop-shadow-lg" />
          </motion.span>
        ))}
    </div>
  );
}