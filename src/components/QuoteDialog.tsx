import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getOrFetchDailyQuote } from "@/lib/quote";
import { dayKey } from "@/lib/dates";
import type { DailyQuoteDoc } from "@/lib/schema";

const AUTO_DISMISS_MS = 4500;
const SEEN_PREFIX = "padhle:quote-seen:";

function hasSeenQuote(today: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SEEN_PREFIX + today) === "1";
  } catch {
    return false;
  }
}

function markQuoteSeen(today: string) {
  try {
    window.localStorage.setItem(SEEN_PREFIX + today, "1");
  } catch {
    // storage unavailable (private mode etc.) — the dialog just reappears, fine.
  }
}

/**
 * Shows the day's quote front-and-center on first open of the day, then fades
 * away on its own (~4.5s) so the student actually reads it before starting.
 * Appears once per day per browser; reports dismissal via onDismiss so the
 * check-in prompt can wait its turn.
 */
export function QuoteDialog({ onDismiss }: { onDismiss?: () => void }) {
  const today = useMemo(() => dayKey(new Date()), []);
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState<DailyQuoteDoc | null>(null);

  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    []
  );

  useEffect(() => {
    if (hasSeenQuote(today)) {
      onDismiss?.();
      return;
    }
    let cancelled = false;
    getOrFetchDailyQuote().then((q) => {
      if (cancelled) return;
      setQuote(q);
      setOpen(true);
    });
    return () => {
      cancelled = true;
    };
    // onDismiss is stable from the caller; quote is fetched once per day
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  const close = () => {
    if (!open) return;
    setOpen(false);
    markQuoteSeen(today);
    onDismiss?.();
  };

  useEffect(() => {
    if (!open || reducedMotion) return;
    const id = window.setTimeout(close, AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reducedMotion]);

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : close())}>
      <DialogContent onPointerDownOutside={close} onEscapeKeyDown={close}>
        <DialogTitle className="sr-only">Daily quote</DialogTitle>
        {quote ? (
          <div className="relative px-1 pt-2">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-3 left-2 select-none font-display text-7xl leading-none text-brand-600/15"
            >
              "
            </span>
            <p className="relative font-devanagari text-lg font-medium italic leading-relaxed text-text-primary">
              {quote.text}
            </p>
            <p className="relative mt-2 text-sm font-medium text-brand-600 dark:text-brand-500">
              — {quote.author}
            </p>
            <p className="relative mt-4 text-center text-[11px] uppercase tracking-widest text-text-muted">
              Good luck today 🌱
            </p>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-text-secondary">Picking your quote…</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
