import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { getOrFetchDailyQuote } from "@/lib/quote";
import type { DailyQuoteDoc } from "@/lib/schema";

export function QuoteCard({ uid }: { uid: string }) {
  const [quote, setQuote] = useState<DailyQuoteDoc | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOrFetchDailyQuote().then((q) => {
      if (!cancelled) setQuote(q);
    });
    return () => {
      cancelled = true;
    };
    // uid only used to key the effect per signed-in student, not read directly
  }, [uid]);

  if (!quote) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
    >
      <Card className="relative border-brand-600/15 bg-brand-500/[0.07] px-6 py-5">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-2 left-4 select-none font-display text-6xl leading-none text-brand-600/15"
        >
          "
        </span>
        <p className="relative font-devanagari text-sm font-medium italic leading-relaxed text-text-primary">
          {quote.text}
        </p>
        <p className="relative mt-1.5 text-xs font-medium text-brand-600 dark:text-brand-500">— {quote.author}</p>
      </Card>
    </motion.div>
  );
}
