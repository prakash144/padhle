import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Friendly first name from a display name. Handles "Prakash Rabidas",
 * "prakash rabidas", email usernames like "prakash.rabidas2", and
 * empty/null so greetings read naturally ("Good to see you, Prakash").
 */
export function friendlyFirstName(displayName?: string | null): string {
  const raw = (displayName ?? "").trim();
  if (!raw) return "there";
  const firstToken = raw.split(/[\s.]+/)[0] ?? raw;
  if (!firstToken) return "there";
  return firstToken.charAt(0).toUpperCase() + firstToken.slice(1);
}
