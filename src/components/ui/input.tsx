import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-md border border-border bg-surface px-3.5 text-sm text-text-primary transition-all duration-micro",
        "placeholder:text-text-muted",
        "hover:border-border-strong",
        "focus-visible:border-brand-600 focus-visible:shadow-[0_0_0_3px_hsl(var(--brand-600)/.18)] focus-visible:outline-none",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";