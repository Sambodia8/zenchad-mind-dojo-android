import { Capacitor } from "@capacitor/core";
import { loadRunSession, saveRunSession, type RunPoint } from "./running";
import { stopNativeRunningTracker } from "./runningNative";

let started = false;
let banking = false;
const allowNextClick = new WeakSet<HTMLButtonElement>();

function usableNativePoints(points: RunPoint[] | undefined) {
  if (!Array.isArray(points)) return [];
  return points
    .filter((point) =>
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lng) &&
      Number.isFinite(point.at) &&
      Number.isFinite(point.accuracy) &&
      point.accuracy <= 80
    )
    .sort((a, b) => a.at - b.at)
    .slice(-4000);
}

async function bankNativeFinish(button: HTMLButtonElement) {
  const before = loadRunSession();
  if (!before || before.stage !== "active") return;
  banking = true;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "BANKING FINAL GPS…";

  try {
    const snapshot = await stopNativeRunningTracker();
    const current = loadRunSession();
    if (!current || current.stage !== "active" || snapshot.sessionId !== current.id) return;
    const points = usableNativePoints(snapshot.points);
    if (points.length >= 2 && Number.isFinite(snapshot.distanceMeters) && snapshot.distanceMeters >= 0) {
      saveRunSession({
        ...current,
        points,
        distanceMeters: snapshot.distanceMeters
      });
    }
  } catch {
    // The existing WebView GPS remains a valid fallback; finishing the run must never be blocked.
  } finally {
    banking = false;
    button.disabled = false;
    button.textContent = originalText;
    const current = loadRunSession();
    if (current?.stage === "active") {
      allowNextClick.add(button);
      button.click();
    }
  }
}

function onClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  const button = target?.closest<HTMLButtonElement>(".running-end-button.confirming");
  if (!button || Capacitor.getPlatform() !== "android") return;
  if (allowNextClick.has(button)) {
    allowNextClick.delete(button);
    return;
  }
  if (banking) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  const session = loadRunSession();
  if (!session || session.stage !== "active") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  void bankNativeFinish(button);
}

export function startRunningFinishGuardRuntime() {
  if (started || typeof document === "undefined") return;
  started = true;
  document.addEventListener("click", onClick, true);
}
