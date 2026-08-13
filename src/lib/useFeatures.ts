import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_FEATURES, featureDefaultsForLevel } from "@/lib/preferences";
import type { FeatureKey } from "@/lib/schema";

/**
 * Resolved feature flags for the signed-in student.
 * Order of precedence: stored per-user prefs → stream/level defaults → all-on.
 */
export function useFeatures(): Record<FeatureKey, boolean> {
  const { userDoc } = useAuth();
  return useMemo(() => {
    if (!userDoc) return DEFAULT_FEATURES;
    const defaults = featureDefaultsForLevel(userDoc.academic?.level);
    return { ...defaults, ...(userDoc.prefs?.features ?? {}) };
  }, [userDoc]);
}
