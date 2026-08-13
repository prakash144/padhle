import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DEMO_EMAILS, seedDemoDataIfNeeded } from "@/lib/demoSeed";

/**
 * One-time, QA-only seeding. Runs after sign-in when the account's email is
 * on the demo list AND the account has no data yet, so a reviewer can click
 * through a fully-populated app. Renders nothing.
 */
export function DemoSeed() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (!user.email || !DEMO_EMAILS.includes(user.email.toLowerCase())) return;

    let cancelled = false;
    seedDemoDataIfNeeded(user.uid)
      .catch((err) => console.error("Demo seed failed", err))
      .finally(() => {
        if (cancelled) return;
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return null;
}