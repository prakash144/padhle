/**
 * Test-only stub for `@/lib/firebase` — Vitest aliases the real module to
 * this file so pure-logic unit tests can import library functions without
 * initializing the Firebase app (which needs a browser/indexedDB).
 *
 * None of the tested functions reach `db`; it's only referenced in code paths
 * the unit tests never execute. `as never` keeps the shape assignment silent.
 */
export const db = {} as never;
export const auth = null as never;