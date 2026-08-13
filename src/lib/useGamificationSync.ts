import { useCallback, useEffect, useRef, useState } from "react";
import { doc, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useBadgeContext, useDayCounter } from "@/lib/hooks";
import { dayKey } from "@/lib/dates";
import {
  BADGES,
  computeEarnedBadgeIds,
  ensureDailyStreak,
  newlyEarnedBadges,
  type Badge,
} from "@/lib/gamification";

/**
 * Runs once for the whole app (mounted in AppShell): keeps the daily streak
 * current and detects newly-earned badges, returning the most recent unlock
 * plus a confetti trigger counter so any screen can react without every
 * screen needing its own copy of this logic.
 */
export function useGamificationSync() {
  const { user, userDoc } = useAuth();
  const badgeCtx = useBadgeContext();
  const todayKey = dayKey(new Date());
  const todayCounter = useDayCounter(todayKey);

  const [unlockedBadge, setUnlockedBadge] = useState<Badge | null>(null);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const streakCheckedForDate = useRef<string | null>(null);
  const streakSyncInFlight = useRef(false);
  const badgeSyncInFlight = useRef(false);

  // Streak: bump once per day, the first time we see real activity today.
  useEffect(() => {
    if (!user || !userDoc) return;
    const hasActivityToday = todayCounter.completedTasks > 0 || todayCounter.focusMinutes > 0;
    if (!hasActivityToday) return;
    if (streakCheckedForDate.current === todayKey) return;
    if (userDoc.lastActiveDate === todayKey) {
      streakCheckedForDate.current = todayKey;
      return;
    }
    if (streakSyncInFlight.current) return;
    streakSyncInFlight.current = true;
    // userDoc is a live listener (see AuthContext), so this write reflects
    // in the UI on its own — no manual refresh needed. The guard ref is only
    // set on success so a transient failure can retry on the next render
    // instead of silently skipping the streak for the rest of the day.
    ensureDailyStreak(user.uid)
      .then(() => {
        streakCheckedForDate.current = todayKey;
      })
      .catch((err) => {
        console.error("Failed to update streak", err);
      })
      .finally(() => {
        streakSyncInFlight.current = false;
      });
    // userDoc intentionally excluded to avoid re-firing on every doc update this triggers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, todayCounter.completedTasks, todayCounter.focusMinutes, todayKey]);

  // Badges: diff computed-eligible vs stored, persist + surface new unlocks.
  useEffect(() => {
    if (!user || !userDoc || badgeSyncInFlight.current) return;
    const earned = computeEarnedBadgeIds(badgeCtx);
    if (newlyEarnedBadges(userDoc.badges ?? [], earned).length === 0) return;

    badgeSyncInFlight.current = true;
    // Read-before-write inside a transaction so two devices/tabs can't both
    // read the same `badges` array and clobber each other's just-unlocked
    // badge on append.
    runTransaction(db, async (tx) => {
      const snap = await tx.get(doc(db, "users", user.uid));
      const known = (snap.data()?.badges as string[] | undefined) ?? [];
      const fresh = newlyEarnedBadges(known, earned);
      if (fresh.length === 0) return null;
      tx.update(doc(db, "users", user.uid), { badges: [...known, ...fresh] });
      return fresh[0];
    })
      .then((firstFresh) => {
        if (firstFresh == null) return;
        const badge = BADGES.find((b) => b.id === firstFresh) ?? null;
        setUnlockedBadge(badge);
        setConfettiTrigger((t) => t + 1);
      })
      .catch((err) => console.error("Failed to save earned badges", err))
      .finally(() => {
        badgeSyncInFlight.current = false;
      });
  }, [user, userDoc, badgeCtx]);

  // Stable identity so the BadgeUnlockToast timeout isn't restarted on every
  // AppShell re-render (navigation), which would stretch the toast's lifetime.
  const dismissBadge = useCallback(() => setUnlockedBadge(null), []);

  return { unlockedBadge, dismissBadge, confettiTrigger };
}
