import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full font-medium transition-colors duration-micro",
  {
    variants: {
      tone: {
        neutral: "bg-surface-2 text-text-secondary ring-1 ring-inset ring-border",
        brand: "bg-brand-500/10 text-brand-600 dark:text-brand-500 ring-1 ring-inset ring-brand-600/20",
        success: "bg-success/10 text-success ring-1 ring-inset ring-success/20",
        warning: "bg-warning/15 text-warning ring-1 ring-inset ring-warning/25",
        danger: "bg-danger/10 text-danger ring-1 ring-inset ring-danger/20",
        info: "bg-info/10 text-info ring-1 ring-inset ring-info/20",
      },
      size: {
        sm: "px-2 py-0.5 text-[11px]",
        default: "px-2.5 py-1 text-xs",
      },
    },
    defaultVariants: { tone: "neutral", size: "default" },
  }
);

export interface BadgeProps
  extends VariantProps<typeof badgeVariants> {
  children: ReactNode;
  className?: string;
}

export function Badge({ tone, size, className, children }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)}>{children}</span>;
}
