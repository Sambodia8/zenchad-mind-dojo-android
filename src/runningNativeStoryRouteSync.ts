import { Capacitor } from "@capacitor/core";
import { loadRunSession } from "./running";
import { setNativeBackgroundRunningRoute } from "./runningBackgroundNavigation";
import { loadPlannedRunningRoute } from "./runningRouteStore";

let started = false;
let lastSignature = "";
let syncing = false;

function tick() {
  if (syncing) return;
  const session = loadRunSession();
  if (!session || session.stage !== "active" || session.mode !== "story") {
    lastSignature = "";
    return;
  }
  const route = loadPlannedRunningRoute(session.id);
  if (!route) return;
  const signature = `${route.sessionId}:${route.createdAt}:${route.rerouteCount}:${route.semanticsUpdatedAt ?? 0}:${route.storyAnchors?.length ?? 0}`;
  if (signature === lastSignature) return;
  syncing = true;
  void setNativeBackgroundRunningRoute(route)
    .then(() => { lastSignature = signature; })
    .catch(() => {})
    .finally(() => { syncing = false; });
}

export function startRunningNativeStoryRouteSync() {
  if (started || Capacitor.getPlatform() !== "android" || typeof window === "undefined") return;
  started = true;
  window.setInterval(tick, 1200);
  window.addEventListener("storage", tick);
  document.addEventListener("visibilitychange", tick);
  queueMicrotask(tick);
}
