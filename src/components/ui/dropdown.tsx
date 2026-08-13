import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Lightweight popover menu with outside-click + Escape close.
 * `trigger` is a render-prop so callers keep full control of the button markup
 * while the menu state, focus and animations stay consistent.
 */
export function Dropdown({
  trigger,
  children,
  align = "end",
  panelClassName,
}: {
  trigger: (state: { open: boolean; toggle: () => void; close: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggle = () => setOpen((v) => !v);
  const close = () => setOpen(false);

  return (
    <div ref={rootRef} className="relative">
      {trigger({ open, toggle, close })}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.22, 0.61, 0.36, 1] }}
            className={cn(
              "absolute top-full z-50 mt-2 min-w-44 rounded-lg border border-border bg-surface p-1 shadow-e3",
              align === "end" ? "right-0" : "left-0",
              panelClassName
            )}
          >
            {children(close)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}