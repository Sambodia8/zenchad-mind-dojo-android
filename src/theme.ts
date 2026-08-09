import type { AppPreferences } from "./types";

export type ResolvedAppearance = "light" | "dark";

export const AUTO_LIGHT_START_HOUR = 7;
export const AUTO_DARK_START_HOUR = 19;

export function resolveAppearance(
  mode: AppPreferences["themeMode"],
  now = new Date()
): ResolvedAppearance {
  if (mode === "light" || mode === "dark") return mode;
  const hour = now.getHours();
  return hour >= AUTO_DARK_START_HOUR || hour < AUTO_LIGHT_START_HOUR ? "dark" : "light";
}

export function applyAppearance(
  mode: AppPreferences["themeMode"],
  now = new Date()
): ResolvedAppearance {
  const resolved = resolveAppearance(mode, now);
  const root = document.documentElement;
  root.dataset.appearance = resolved;
  root.style.colorScheme = resolved;

  const themeColor = resolved === "dark" ? "#080d1b" : "#f4f1ea";
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = themeColor;
  });

  return resolved;
}

export function startAppearanceController(
  getMode: () => AppPreferences["themeMode"]
): () => void {
  const refresh = () => applyAppearance(getMode());
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") refresh();
  };

  refresh();
  const intervalId = window.setInterval(refresh, 60_000);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("focus", refresh);

  return () => {
    window.clearInterval(intervalId);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("focus", refresh);
  };
}
