import { Capacitor, registerPlugin } from "@capacitor/core";
import type { AppearanceMode } from "./types";
import type { ResolvedAppearance } from "./themeLogic";

interface AppearanceNativePlugin {
  setSystemBars(options: { dark: boolean }): Promise<void>;
}

const AppearanceNative = registerPlugin<AppearanceNativePlugin>("Appearance");

function syncNativeSystemBars(resolved: ResolvedAppearance) {
  if (!Capacitor.isNativePlatform()) return;
  void AppearanceNative.setSystemBars({ dark: resolved === "dark" }).catch(() => {
    // Styling remains functional even if the native bridge is unavailable.
  });
}

export function applyAppearance(_mode: AppearanceMode = "dark"): ResolvedAppearance {
  const resolved: ResolvedAppearance = "dark";
  const root = document.documentElement;
  root.dataset.appearance = resolved;
  root.style.colorScheme = resolved;
  root.style.removeProperty("background-color");
  document.getElementById("appearance-bootstrap")?.remove();

  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = "#080d1b";
  });
  syncNativeSystemBars(resolved);

  return resolved;
}

export function setAppearanceMode(_mode: AppearanceMode) {
  applyAppearance("dark");
}

export function startAppearanceController(_initialMode: AppearanceMode): () => void {
  const refresh = () => applyAppearance("dark");
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") refresh();
  };

  refresh();
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("focus", refresh);

  return () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("focus", refresh);
  };
}

export { resolveAppearance } from "./themeLogic";
export type { ResolvedAppearance } from "./themeLogic";
