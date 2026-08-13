import { forwardRef, type ElementRef, type ComponentPropsWithoutRef } from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Checkbox = forwardRef<
  ElementRef<typeof CheckboxPrimitive.Root>,
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-border-strong bg-surface transition-all duration-micro",
      "hover:border-brand-600",
      "data-[state=checked]:animate-check-pop data-[state=checked]:border-success data-[state=checked]:bg-success data-[state=checked]:shadow-[0_2px_8px_-2px_hsl(var(--success)/.5)]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="text-white">
      <Check size={14} strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = "Checkbox";