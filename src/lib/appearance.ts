import { useEffect, useState } from "react";

/**
 * Appearance = theme mode (light/dark/system) + color palette.
 * Stored in localStorage for a no-flash pre-paint apply (index.html inline
 * script) and mirrored into the Firestore user doc for cross-device sync
 * (see Profile → Appearance). Applying here only flips the `dark` class and
 * `data-palette` attribute on <html> — all colors read the CSS variables.
 */

export type ThemeMode = "light" | "dark" | "system";
export type PaletteId = "forest" | "ocean" | "indigo" | "plum" | "teal" | "warm";

export interface Palette {
  id: PaletteId;
  label: string;
  /** The signature primary, shown in the picker swatch. */
  light: string;
  dark: string;
}

export const PALETTES: Palette[] = [
  { id: "forest", label: "Forest", light: "#176B4D", dark: "#35B77A" },
  { id: "ocean", label: "Ocean", light: "#2563EB", dark: "#60A5FA" },
  { id: "indigo", label: "Indigo", light: "#4F46E5", dark: "#818CF8" },
  { id: "plum", label: "Plum", light: "#7C3AED", dark: "#A78BFA" },
  { id: "teal", label: "Teal", light: "#0F766E", dark: "#2DD4BF" },
  { id: "warm", label: "Warm", light: "#B45309", dark: "#F59E0B" },
];

export interface Appearance {
  mode: ThemeMode;
  palette: PaletteId;
}

const STORAGE_KEY = "padhle-appearance";
const LEGACY_STORAGE_KEY = "padhle-theme";
const APPLY_EVENT = "padhle-appearance";

export const DEFAULT_APPEARANCE: Appearance = { mode: "system", palette: "forest" };

const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

export function loadAppearance(): Appearance {
  if (typeof document === "undefined") return DEFAULT_APPEARANCE;
  // Migrate the pre-palette single-key preference ("light"/"dark").
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy && !localStorage.getItem(STORAGE_KEY)) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: legacy, palette: "forest" }));
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    const parsed = JSON.parse(raw) as Partial<Appearance>;
    const mode: ThemeMode =
      parsed.mode === "light" || parsed.mode === "dark" || parsed.mode === "system"
        ? parsed.mode
        : DEFAULT_APPEARANCE.mode;
    const palette: PaletteId = PALETTES.some((p) => p.id === parsed.palette)
      ? (parsed.palette as PaletteId)
      : DEFAULT_APPEARANCE.palette;
    return { mode, palette };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function resolveDark(mode: ThemeMode): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return typeof window !== "undefined" && window.matchMedia(SYSTEM_DARK_QUERY).matches;
}

/** Persist + apply to <html>. `persist` false = live preview without saving. */
export function applyAppearance(appearance: Appearance, persist = true): void {
  if (typeof document === "undefined") return;
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
    } catch {
      /* storage unavailable (private mode) — still apply for this session */
    }
  }
  const dark = resolveDark(appearance.mode);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.setAttribute("data-palette", appearance.palette);
  // Let the useAppearance hook (and any other listener) know an external
  // source (e.g. Firestore sync on login) changed the appearance.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(APPLY_EVENT, { detail: appearance }));
  }
}

export function isSystemDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia(SYSTEM_DARK_QUERY).matches;
}

export function useAppearance() {
  const [appearance, setAppearance] = useState<Appearance>(loadAppearance);

  useEffect(() => {
    applyAppearance(appearance);
  }, [appearance]);

  // External applies (Firestore sync on login) update local state too.
  useEffect(() => {
    const onChange = (e: Event) => {
      const next = (e as CustomEvent).detail as Appearance;
      setAppearance((prev) =>
        prev.mode === next.mode && prev.palette === next.palette ? prev : next
      );
    };
    window.addEventListener(APPLY_EVENT, onChange);
    return () => window.removeEventListener(APPLY_EVENT, onChange);
  }, []);

  // React to OS theme changes while in "system" mode.
  useEffect(() => {
    if (appearance.mode !== "system") return;
    const mql = window.matchMedia(SYSTEM_DARK_QUERY);
    const onChange = () => applyAppearance({ ...appearance, mode: "system" }, false);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [appearance]);

  const setMode = (mode: ThemeMode) => setAppearance((prev) => ({ ...prev, mode }));
  const setPalette = (palette: PaletteId) => setAppearance((prev) => ({ ...prev, palette }));

  return {
    ...appearance,
    isDark: resolveDark(appearance.mode),
    setMode,
    setPalette,
  };
}
