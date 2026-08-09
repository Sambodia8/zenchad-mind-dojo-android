import type { AppearanceMode } from "./types";

export type ResolvedAppearance = "light" | "dark";

export const AUTO_LIGHT_START_HOUR = 7;
export const AUTO_DARK_START_HOUR = 19;

export function resolveAppearance(
  mode: AppearanceMode,
  now = new Date()
): ResolvedAppearance {
  if (mode === "light" || mode === "dark") return mode;
  const hour = now.getHours();
  return hour >= AUTO_DARK_START_HOUR || hour < AUTO_LIGHT_START_HOUR ? "dark" : "light";
}

export function nextAppearanceBoundary(now = new Date()): Date {
  const next = new Date(now);
  const hour = now.getHours();

  if (hour < AUTO_LIGHT_START_HOUR) {
    next.setHours(AUTO_LIGHT_START_HOUR, 0, 0, 0);
    return next;
  }

  if (hour < AUTO_DARK_START_HOUR) {
    next.setHours(AUTO_DARK_START_HOUR, 0, 0, 0);
    return next;
  }

  next.setDate(next.getDate() + 1);
  next.setHours(AUTO_LIGHT_START_HOUR, 0, 0, 0);
  return next;
}

export function millisecondsUntilNextAppearanceBoundary(now = new Date()): number {
  return Math.max(1, nextAppearanceBoundary(now).getTime() - now.getTime());
}
