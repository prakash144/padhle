import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { applyAppearance } from "@/lib/appearance";
import { setDefaultTimezone } from "@/lib/dates";
import type { UserDoc } from "@/lib/schema";

interface AuthContextValue {
  user: User | null;
  userDoc: UserDoc | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const GAMIFICATION_DEFAULTS = {
  xp: 0,
  streakCount: 0,
  longestStreak: 0,
  badges: [] as string[],
};

/** Ensures /users/{uid} exists and has every gamification field before the live listener attaches. */
async function ensureUserDoc(user: User): Promise<void> {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data() as UserDoc;
    // Backfills gamification fields for accounts created before this layer
    // existed, so `userDoc.xp` etc. are never undefined in the UI.
    if (
      data.xp === undefined ||
      data.streakCount === undefined ||
      data.longestStreak === undefined ||
      data.badges === undefined ||
      !data.timezone ||
      !data.photoURL
    ) {
      await setDoc(
        ref,
        {
          ...GAMIFICATION_DEFAULTS,
          photoURL: user.photoURL ?? undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
        },
        { merge: true }
      );
    }
    return;
  }
  const fresh: UserDoc = {
    displayName: user.displayName ?? user.email?.split("@")[0] ?? "Student",
    email: user.email ?? "",
    photoURL: user.photoURL ?? undefined,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
    pomodoroPrefs: { defaultMode: "50/10", customFocus: 45, customBreak: 10 },
    throughput: {},
    ...GAMIFICATION_DEFAULTS,
    createdAt: serverTimestamp() as never,
    updatedAt: serverTimestamp() as never,
  };
  await setDoc(ref, fresh);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubDoc: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      unsubDoc?.();
      unsubDoc = undefined;
      setUser(u);

      if (!u) {
        setUserDoc(null);
        setLoading(false);
        return;
      }

      try {
        await ensureUserDoc(u);
      } catch (err) {
        console.error("Failed to ensure user doc", err);
        setLoading(false);
        return;
      }
      // Live subscription (not a one-time get): every batch write elsewhere
      // in the app that touches xp/streak/badges/onboarding shows up here
      // automatically — no manual "refresh" plumbing needed anywhere else.
      unsubDoc = onSnapshot(doc(db, "users", u.uid), (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserDoc;
          // All counter/checkin/streak keys are derived in the student's timezone.
          setDefaultTimezone(data.timezone);
          setUserDoc(data);
        }
        setLoading(false);
      });
    });

    return () => {
      unsubAuth();
      unsubDoc?.();
    };
  }, []);

  // Apply the account's saved appearance (theme + palette) once the doc loads,
  // so preferences follow the student across devices. The useAppearance hook
  // listens for the apply event and updates its local state.
  useEffect(() => {
    const saved = userDoc?.appearance;
    if (!saved?.mode && !saved?.palette) return;
    applyAppearance({
      mode: saved.mode ?? "system",
      palette: saved.palette ?? "forest",
    });
  }, [userDoc]);

  return <AuthContext.Provider value={{ user, userDoc, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
