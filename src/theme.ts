import { Capacitor, registerPlugin } from "@capacitor/core";
import type { AppearanceMode } from "./types";
import {
  millisecondsUntilNextAppearanceBoundary,
  resolveAppearance,
  type ResolvedAppearance
} from "./themeLogic";

interface AppearanceNativePlugin {
  setSystemBars(options: { dark: boolean }): Promise<void>;
}

const AppearanceNative = registerPlugin<AppearanceNativePlugin>("Appearance");
const BOUNDARY_FUZZ_MS = 50;

let currentMode: AppearanceMode = "auto";
let boundaryTimer: number | undefined;

function syncNativeSystemBars(resolved: ResolvedAppearance) {
  if (!Capacitor.isNativePlatform()) return;
  void AppearanceNative.setSystemBars({ dark: resolved === "dark" }).catch(() => {
    // Web styling remains functional even if a native bridge is unavailable.
  });
}

export function applyAppearance(
  mode: AppearanceMode = currentMode,
  now = new Date()
): ResolvedAppearance {
  currentMode = mode;
  const resolved = resolveAppearance(mode, now);
  const root = document.documentElement;
  root.dataset.appearance = resolved;
  root.style.colorScheme = resolved;
  root.style.removeProperty("background-color");
  document.getElementById("appearance-bootstrap")?.remove();

  const themeColor = resolved === "dark" ? "#080d1b" : "#f4f1ea";
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = themeColor;
  });
  syncNativeSystemBars(resolved);

  return resolved;
}

function scheduleBoundaryRefresh() {
  if (boundaryTimer !== undefined) {
    window.clearTimeout(boundaryTimer);
    boundaryTimer = undefined;
  }
  if (currentMode !== "auto") return;

  const delay = millisecondsUntilNextAppearanceBoundary(new Date()) + BOUNDARY_FUZZ_MS;
  boundaryTimer = window.setTimeout(() => {
    applyAppearance(currentMode);
    scheduleBoundaryRefresh();
  }, delay);
}

export function setAppearanceMode(mode: AppearanceMode) {
  currentMode = mode;
  applyAppearance(mode);
  scheduleBoundaryRefresh();
}

export function startAppearanceController(initialMode: AppearanceMode): () => void {
  currentMode = initialMode;
  const refresh = () => {
    applyAppearance(currentMode);
    scheduleBoundaryRefresh();
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") refresh();
  };

  refresh();
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("focus", refresh);

  return () => {
    if (boundaryTimer !== undefined) window.clearTimeout(boundaryTimer);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("focus", refresh);
  };
}

export { resolveAppearance } from "./themeLogic";
export type { ResolvedAppearance } from "./themeLogic";
