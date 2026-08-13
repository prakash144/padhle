import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full border border-border-strong bg-surface-2",
        "transition-colors duration-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        checked && "border-transparent bg-primary shadow-[0_2px_10px_-4px_hsl(var(--primary)/.7)]",
        disabled && "opacity-50"
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className={cn(
          "absolute top-1 h-5 w-5 rounded-full bg-primary-foreground shadow-sm",
          checked ? "left-[calc(100%-1.5rem)]" : "left-1"
        )}
      />
    </button>
  );
}