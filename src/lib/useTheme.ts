import { useAppearance } from "@/lib/appearance";

/**
 * Small adapter so existing toggles (Login, TopBar) keep working while the
 * real state (mode + palette, System support, cross-device sync) lives in
 * useAppearance.
 */
export function useTheme() {
  const { isDark, setMode } = useAppearance();
  const theme: "light" | "dark" = isDark ? "dark" : "light";
  const toggleTheme = () => setMode(theme === "dark" ? "light" : "dark");
  return { theme, toggleTheme };
}
