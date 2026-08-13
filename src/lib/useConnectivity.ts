import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { dayKey } from "@/lib/dates";

const CHECK_TIMEOUT_MS = 5000;
const RETRY_MS = 15000;

function pingFirestore(): Promise<void> {
  // /dailyQuote is readable by any signed-in user — a cheap reachability check
  // that fails when the Firestore backend is unreachable even if the browser
  // still thinks it has a network connection.
  const ref = doc(db, "dailyQuote", dayKey(new Date()));
  return Promise.race([
    getDoc(ref).then(() => undefined),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("firestore ping timed out")), CHECK_TIMEOUT_MS)
    ),
  ]);
}

/**
 * True while the user is online *and* Firestore is reachable. Combines the
 * browser's on-line/off-line events with a periodic Firestore ping so the UI
 * can show a "stale data" banner instead of silently showing cached data when
 * writes/syncs are actually failing.
 */
export function useConnectivity(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const onUp = () => setOnline(true);
    const onDown = () => setOnline(false);
    window.addEventListener("online", onUp);
    window.addEventListener("offline", onDown);
    return () => {
      window.removeEventListener("online", onUp);
      window.removeEventListener("offline", onDown);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const check = () => {
      pingFirestore()
        .then(() => {
          if (!cancelled) setOnline(true);
        })
        .catch(() => {
          if (!cancelled) setOnline(false);
        });
    };

    check();
    const timer = setInterval(check, RETRY_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return online;
}