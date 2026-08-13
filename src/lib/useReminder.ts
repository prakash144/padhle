import { useCallback, useEffect, useRef, useState } from "react";

export interface ReminderPrefs {
  enabled: boolean;
  time: string; // "HH:MM" 24h
}

const STORAGE_KEY = "padhle:reminder";
const REMINDER_MESSAGE = "Time to study! Your 25-minute focus session is waiting.";

function readPrefs(): ReminderPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...{ enabled: false, time: "20:00" }, ...JSON.parse(raw) };
  } catch {
    /* fall through to defaults */
  }
  return { enabled: false, time: "20:00" };
}

function msUntilTime(time: string): number {
  const [hh, mm] = time.split(":").map(Number);
  const now = new Date();
  const todayFireAt = new Date(now);
  todayFireAt.setHours(hh, mm, 0, 0);
  let ms = todayFireAt.getTime() - now.getTime();
  if (ms <= 0) ms += 86400000; // already past today -> fire tomorrow
  return ms;
}

/**
 * In-app daily study reminder. Fires a browser Notification at the chosen
 * local time while the app has a tab open (background tabs included, subject
 * to the browser's energy saver). No service worker, so it needs the tab open.
 * Preferences persist in localStorage; Notification permission is requested
 * from the UI on enable.
 */
export function useReminder() {
  const [prefs, setPrefs] = useState<ReminderPrefs>(readPrefs);
  const [supported] = useState(() => typeof window !== "undefined" && "Notification" in window);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    supported ? Notification.permission : "unsupported"
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const schedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const { enabled, time } = prefsRef.current;
    if (!enabled || !supported || Notification.permission !== "granted") return;
    const fire = () => {
      try {
        new Notification("padhle", { body: REMINDER_MESSAGE, tag: "daily-reminder" });
      } catch {
        /* some browsers throw in the constructor; ignore */
      }
      timerRef.current = setTimeout(fire, 86400000);
    };
    timerRef.current = setTimeout(fire, msUntilTime(time));
  }, [supported]);

  useEffect(() => {
    schedule();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [schedule, prefs.enabled, prefs.time]);

  const save = useCallback(
    async (next: ReminderPrefs) => {
      let granted: NotificationPermission | "unsupported" = permission;
      if (next.enabled && supported && Notification.permission === "default") {
        granted = await Notification.requestPermission();
        setPermission(granted);
      }
      const effective = granted === "granted" ? next : { ...next, enabled: false };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(effective));
      setPrefs(effective);
      return effective;
    },
    [permission, supported]
  );

  return { prefs, save, supported, permission };
}