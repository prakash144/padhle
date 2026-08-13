import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all duration-standard disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:scale-[.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:bg-primary-hover shadow-[0_2px_10px_-3px_hsl(var(--primary)/.45)]",
        secondary:
          "border border-border bg-surface text-text-primary hover:border-border-strong hover:bg-surface-2",
        ghost: "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
        outline: "border border-border-strong bg-transparent text-text-primary hover:border-brand-600 hover:text-brand-600",
        danger: "bg-danger text-white hover:bg-danger/90 shadow-[0_2px_10px_-3px_hsl(var(--danger)/.4)]",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-3 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, children, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
    </button>
  )
);
Button.displayName = "Button";
