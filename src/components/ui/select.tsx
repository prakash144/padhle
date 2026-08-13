import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  /** Optional tailwind class for a leading colored dot (e.g. a difficulty tint). */
  dot?: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled,
  className,
  id,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Unique per-instance so the highlight pill never cross-animates another select.
  const baseId = useId().replace(/:/g, "");

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const highlightIndex = activeIndex >= 0 ? activeIndex : selectedIndex;

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onDocKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onDocKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onDocKeyDown);
    };
  }, [open, close]);

  const openMenu = useCallback(() => {
    if (disabled) return;
    setActiveIndex(selectedIndex);
    setOpen(true);
  }, [disabled, selectedIndex]);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        close();
        break;
      case "ArrowDown": {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % options.length);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
        break;
      }
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (highlightIndex >= 0) {
          onChange(options[highlightIndex].value);
          close();
        }
        break;
      case "Tab":
        close();
        break;
      default: {
        // Type-ahead: jump to the next option starting with the pressed char.
        const c = e.key.toLowerCase();
        if (c.length === 1 && /[a-z0-9]/.test(c)) {
          const start = activeIndex >= 0 ? activeIndex + 1 : 0;
          for (let i = 0; i < options.length; i++) {
            const idx = (start + i) % options.length;
            if (options[idx].label.toLowerCase().startsWith(c)) {
              setActiveIndex(idx);
              return;
            }
          }
        }
      }
    }
  };

  useEffect(() => {
    if (!open) return;
    const scrollIndex = highlightIndex >= 0 ? highlightIndex : 0;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${scrollIndex}"]`)?.scrollIntoView({
      block: "nearest",
    });
  }, [open, highlightIndex]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${baseId}-listbox`}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3.5 text-sm text-text-primary",
          "transition-all duration-micro",
          "hover:border-border-strong",
          !open && !disabled && "active:scale-[.995]",
          open && "border-brand-600 shadow-[0_0_0_3px_hsl(var(--brand-600)/.15)]",
          "focus-visible:border-brand-600 focus-visible:shadow-[0_0_0_3px_hsl(var(--brand-600)/.18)] focus-visible:outline-none",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-2">
            {selected.dot && (
              <span className={cn("h-2 w-2 shrink-0 rounded-full", selected.dot)} />
            )}
            <span className="truncate">{selected.label}</span>
          </span>
        ) : (
          <span className="truncate text-text-muted">{placeholder}</span>
        )}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="shrink-0 text-text-muted"
        >
          <ChevronDown size={16} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={`${baseId}-listbox`}
            role="listbox"
            ref={listRef}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.22, 0.61, 0.36, 1] }}
            className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 overflow-auto rounded-lg border border-border bg-surface p-1 shadow-e3"
          >
            {options.map((opt, i) => {
              const active = i === highlightIndex;
              return (
                <div
                  key={opt.value}
                  role="option"
                  aria-selected={opt.value === value}
                  data-index={i}
                  onMouseEnter={() => setActiveIndex(i)}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(opt.value);
                    close();
                  }}
                  className={cn(
                    "relative flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-text-secondary",
                    active && "text-text-primary"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId={`select-${baseId}-highlight`}
                      className="absolute inset-0 rounded-md bg-surface-3"
                      transition={{ type: "spring", stiffness: 500, damping: 36 }}
                    />
                  )}
                  <span className={cn("relative z-10 flex min-w-0 items-center gap-2")}>
                    {opt.dot && <span className={cn("h-2 w-2 shrink-0 rounded-full", opt.dot)} />}
                    <span className="truncate">{opt.label}</span>
                    {opt.value === value && (
                      <Check size={14} className="ml-auto shrink-0 text-brand-600" />
                    )}
                  </span>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}