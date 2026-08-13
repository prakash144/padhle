/**
 * Recharts sets `fill`/`tick` as SVG *attributes*, where CSS custom-properties
 * don't resolve (the browser falls back to black). Resolve a design token to a
 * concrete hsl() string before handing it to chart props. Call sites must
 * re-render on theme change (e.g. via `useAppearance`) so the computed value
 * tracks the active theme.
 */
export function cssColor(varName: string): string {
  if (typeof document === "undefined") return "hsl(127 57% 61%)";
  const val = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return val ? `hsl(${val})` : "hsl(127 57% 61%)";
}
