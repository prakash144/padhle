import { useEffect, useRef } from "react";
import { animate } from "framer-motion";

export function AnimatedNumber({
  value,
  format,
  className,
  duration = 0.6,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const from = Number(node.dataset.animated ?? 0) || 0;
    const controls = animate(from, value, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => {
        node.dataset.animated = String(v);
        node.textContent = format ? format(v) : String(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value, format, duration]);

  return <span ref={ref} className={className} />;
}