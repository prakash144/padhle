import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ProgressRing({
  size = 96,
  strokeWidth = 8,
  progress,
  gradient = false,
  colorClassName = "text-brand-600",
  trackClassName = "text-border",
  children,
  className,
}: {
  size?: number;
  strokeWidth?: number;
  /** 0-1 */
  progress: number;
  gradient?: boolean;
  colorClassName?: string;
  trackClassName?: string;
  children?: ReactNode;
  className?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = circumference * (1 - clamped);
  // Unique per mount (useId) so multiple gradient rings never collide on the
  // same SVG id and start resolving to the wrong def.
  const gradientId = `progress-ring-gradient-${useId().replace(/:/g, "")}`;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {gradient && (
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--brand-600) / 1)" />
              <stop offset="100%" stopColor="hsl(var(--brand-400) / 1)" />
            </linearGradient>
          </defs>
        )}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          className={trackClassName}
          stroke="currentColor"
          opacity={0.3}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          stroke={gradient ? `url(#${gradientId})` : "currentColor"}
          className={gradient ? "drop-shadow-[0_0_6px_hsl(var(--brand-600)/.3)]" : colorClassName}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 500ms cubic-bezier(.22,.61,.36,1)" }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  );
}
