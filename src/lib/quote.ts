import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { dayKey } from "@/lib/dates";
import type { DailyQuoteDoc } from "@/lib/schema";

/** Fallback list so the quote card always has something to show, API key or not. */
const FALLBACK_QUOTES: { text: string; author: string }[] = [
  { text: "Chhoti shuruaat, badi jeet.", author: "Padhle" },
  { text: "One 25-minute session moves the needle more than an hour of worrying.", author: "Padhle" },
  { text: "Streaks break. Toppers restart the same day.", author: "Padhle" },
  { text: "Aage badh rahe ho — keep the rhythm.", author: "Padhle" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
];

function fallbackForToday(): { text: string; author: string } {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return FALLBACK_QUOTES[dayOfYear % FALLBACK_QUOTES.length];
}

/**
 * Cache-first: the first user to open the app on a given day fetches (or
 * falls back) and writes /dailyQuote/{date}; everyone after just reads it.
 * Keeps this to ~1 read/day instead of an API call per user per load.
 */
export async function getOrFetchDailyQuote(): Promise<DailyQuoteDoc> {
  const today = dayKey(new Date());
  const ref = doc(db, "dailyQuote", today);
  const existing = await getDoc(ref);
  if (existing.exists()) return existing.data() as DailyQuoteDoc;

  let quote = fallbackForToday();
  const apiKey = import.meta.env.VITE_API_NINJAS_KEY;
  if (apiKey) {
    try {
      const res = await fetch("https://api.api-ninjas.com/v1/quotes?category=motivational", {
        headers: { "X-Api-Key": apiKey },
      });
      if (res.ok) {
        const data = (await res.json()) as { quote: string; author: string }[];
        if (data[0]) quote = { text: data[0].quote, author: data[0].author };
      }
    } catch {
      // network hiccup or key issue — fall back silently, it's just a quote card
    }
  }

  const fresh: DailyQuoteDoc = {
    text: quote.text,
    author: quote.author,
    fetchedAt: serverTimestamp() as never,
  };
  await setDoc(ref, fresh, { merge: false }).catch(() => {
    // another tab/user may have won the race to create today's doc first — fine, ignore.
  });
  return fresh;
}
