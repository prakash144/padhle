import { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  // Stable per-instance id so multiple Segmented controls on one screen never
  // cross-animate their shared-layout indicator pills.
  const baseId = useId().replace(/:/g, "");
  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-border bg-surface-2 p-1",
        className
      )}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors duration-micro",
              active && "text-text-primary"
            )}
          >
            {active && (
              <motion.span
                layoutId={`segmented-${baseId}-indicator`}
                className="absolute inset-0 rounded-md bg-surface ring-1 ring-border"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}