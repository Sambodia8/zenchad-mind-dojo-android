import { loadRunSession, loadRunningProfile, type RunSession } from "./running";
import { navigationStateForLocation, cueForNavigationState, formatNavigationDistance, shouldRerouteNavigation, type NavigationCueLevel } from "./runningNavigation";
import { buildValhallaRunningRoute } from "./runningValhalla";
import { loadPlannedRunningRoute, loadRunningRouteBuildState, savePlannedRunningRoute, saveRunningRouteBuildState, clearRunningRouteState, type PlannedRunningRoute } from "./runningRouteStore";
import { speakRunningNavigation } from "./runningSpeech";
import { clearNativeBackgroundRunningRoute, setNativeBackgroundRunningRoute } from "./runningBackgroundNavigation";
import { annotateRunningRouteSemantics } from "./runningRouteSemantics";
import { chooseStoryMission } from "./runningCampaign";

const RUNTIME_DOCK_ID = "zenchad-running-navigation-dock";
const MIN_REROUTE_INTERVAL_MS = 45_000;
const ROUTE_RETRY_MS = 60_000;

let runtimeStarted = false;
let buildingSessionId: string | null = null;
let rerouteInFlight = false;
let lastRerouteAt = 0;
let nextBuildRetryAt = 0;
let nearestShapeIndex = 0;
let offRouteSince = 0;
let spoken: Record<string, NavigationCueLevel[]> = {};
let speaking = false;
let nativeRouteSignature = "";
const semanticsInFlight = new Set<string>();

function positionOnce() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("GPS is not available on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 18_000
    });
  });
}

function latestSessionLocation(session: RunSession) {
  const point = session.points[session.points.length - 1];
  return point ? { lat: point.lat, lng: point.lng, accuracy: point.accuracy } : null;
}

function setBuildState(sessionId: string, status: "idle" | "locating" | "building" | "ready" | "error", message: string) {
  saveRunningRouteBuildState({ sessionId, status, message, updatedAt: Date.now() });
}

function routeIdentity(route: PlannedRunningRoute) {
  return `${route.sessionId}:${route.createdAt}:${route.rerouteCount}`;
}

function syncNativeRoute(route: PlannedRunningRoute) {
  const signature = routeIdentity(route);
  if (signature === nativeRouteSignature) return;
  nativeRouteSignature = signature;
  void setNativeBackgroundRunningRoute(route).catch(() => {
    nativeRouteSignature = "";
  });
}

function clearNativeRouteOnce() {
  if (!nativeRouteSignature) return;
  nativeRouteSignature = "";
  void clearNativeBackgroundRunningRoute().catch(() => {});
}

function enrichRouteSemantics(route: PlannedRunningRoute) {
  const identity = routeIdentity(route);
  if (route.semanticsStatus === "ready" || semanticsInFlight.has(identity)) return;
  semanticsInFlight.add(identity);
  if (route.semanticsStatus !== "pending") {
    savePlannedRunningRoute({ ...route, semanticsStatus: "pending" });
  }

  void annotateRunningRouteSemantics(route)
    .then((anchors) => {
      const current = loadPlannedRunningRoute(route.sessionId);
      if (!current || routeIdentity(current) !== identity) return;
      savePlannedRunningRoute({
        ...current,
        storyAnchors: anchors,
        semanticsStatus: "ready",
        semanticsUpdatedAt: Date.now()
      });
    })
    .catch(() => {
      const current = loadPlannedRunningRoute(route.sessionId);
      if (!current || routeIdentity(current) !== identity) return;
      savePlannedRunningRoute({ ...current, semanticsStatus: "unavailable", semanticsUpdatedAt: Date.now() });
    })
    .finally(() => semanticsInFlight.delete(identity));
}

async function buildInitialRoute(session: RunSession) {
  if (buildingSessionId === session.id || Date.now() < nextBuildRetryAt) return;
  const existing = loadPlannedRunningRoute(session.id);
  if (existing) {
    syncNativeRoute(existing);
    enrichRouteSemantics(existing);
    return;
  }

  buildingSessionId = session.id;
  try {
    setBuildState(session.id, "locating", "Finding your start point…");
    const position = await positionOnce();
    const start = { lat: position.coords.latitude, lng: position.coords.longitude };
    setBuildState(session.id, "building", "Choosing a route for the time you picked…");
    const route = await buildValhallaRunningRoute(
      { mode: session.mode, plannedMinutes: session.plannedMinutes, start },
      { history: loadRunningProfile().history, home: start }
    );
    const saved: PlannedRunningRoute = {
      ...route,
      sessionId: session.id,
      storyMission: session.mode === "story" ? chooseStoryMission(session.id) : undefined,
      semanticsStatus: "pending"
    };
    savePlannedRunningRoute(saved);
    syncNativeRoute(saved);
    enrichRouteSemantics(saved);
    setBuildState(session.id, "ready", `${(saved.distanceMeters / 1000).toFixed(1)} km route ready · about ${Math.round(saved.estimatedMinutes)} min`);
    nearestShapeIndex = 0;
    spoken = {};
  } catch (error) {
    const message = error instanceof Error ? error.message : "Route generation failed";
    setBuildState(session.id, "error", message);
    nextBuildRetryAt = Date.now() + ROUTE_RETRY_MS;
  } finally {
    buildingSessionId = null;
  }
}

async function reroute(session: RunSession, route: PlannedRunningRoute) {
  const current = latestSessionLocation(session);
  if (!current || rerouteInFlight || Date.now() - lastRerouteAt < MIN_REROUTE_INTERVAL_MS) return;
  rerouteInFlight = true;
  lastRerouteAt = Date.now();
  try {
    const elapsedMinutes = session.runStartedAt ? (Date.now() - session.runStartedAt) / 60_000 : 0;
    const remainingMinutes = Math.max(8, session.plannedMinutes - elapsedMinutes);
    setBuildState(session.id, "building", session.mode === "story" ? "Change of plan. Rebuilding the mission route…" : "Recalculating route…");
    const replacement = await buildValhallaRunningRoute(
      { mode: session.mode, plannedMinutes: remainingMinutes, start: { lat: current.lat, lng: current.lng } },
      { history: loadRunningProfile().history, home: route.start, candidateCount: 3 }
    );
    const saved: PlannedRunningRoute = {
      ...replacement,
      sessionId: session.id,
      finish: route.start,
      storyMission: route.storyMission,
      rerouteCount: route.rerouteCount + 1,
      semanticsStatus: "pending"
    };
    savePlannedRunningRoute(saved);
    syncNativeRoute(saved);
    enrichRouteSemantics(saved);
    setBuildState(session.id, "ready", "Route recalculated. Keep moving.");
    nearestShapeIndex = 0;
    offRouteSince = 0;
    spoken = {};
  } catch (error) {
    setBuildState(session.id, "error", error instanceof Error ? error.message : "Could not recalculate route");
  } finally {
    rerouteInFlight = false;
  }
}

function syncBriefingNote(session: RunSession) {
  const note = document.querySelector<HTMLElement>(".running-route-note");
  if (!note) return;
  const strong = note.querySelector<HTMLElement>("strong");
  const small = note.querySelector<HTMLElement>("small");
  const state = loadRunningRouteBuildState(session.id);
  const route = loadPlannedRunningRoute(session.id);

  if (route) {
    syncNativeRoute(route);
    enrichRouteSemantics(route);
    if (strong) strong.textContent = route.storyMission ? `Mission · ${route.storyMission.title}` : "Route ready";
    if (small) {
      const reasons = route.reasons.slice(0, 2).join(" · ");
      const storyNote = session.mode === "story" && route.semanticsStatus === "ready" ? " · set pieces mapped" : "";
      const missionNote = route.storyMission ? ` · ${route.storyMission.objective}` : "";
      small.textContent = `${(route.distanceMeters / 1000).toFixed(1)} km · about ${Math.round(route.estimatedMinutes)} min${reasons ? ` · ${reasons}` : ""}${storyNote}${missionNote}`;
    }
    note.dataset.routeStatus = "ready";
    return;
  }

  if (strong) strong.textContent = state?.status === "error" ? "Route unavailable — run still works" : "Building your route…";
  if (small) small.textContent = state?.message || "Zenchad is finding several pedestrian routes and choosing the best fit.";
  note.dataset.routeStatus = state?.status ?? "idle";
}

function ensureNavigationDock() {
  const existing = document.getElementById(RUNTIME_DOCK_ID);
  if (existing) return existing;
  const endButton = document.querySelector(".running-end-button");
  if (!endButton?.parentElement) return null;
  const dock = document.createElement("section");
  dock.id = RUNTIME_DOCK_ID;
  dock.className = "running-navigation-dock";
  dock.innerHTML = `
    <span class="running-nav-arrow">↑</span>
    <div><span class="eyebrow">Navigation</span><strong data-running-nav-instruction>Route guidance loading…</strong><small data-running-nav-detail></small></div>
    <b data-running-nav-distance></b>
  `;
  endButton.parentElement.insertBefore(dock, endButton);
  return dock;
}

function updateNavigationDock(route: PlannedRunningRoute, session: RunSession) {
  syncNativeRoute(route);
  enrichRouteSemantics(route);
  const dock = ensureNavigationDock();
  if (!dock) return;
  const latest = latestSessionLocation(session);
  const instruction = dock.querySelector<HTMLElement>("[data-running-nav-instruction]");
  const detail = dock.querySelector<HTMLElement>("[data-running-nav-detail]");
  const distanceNode = dock.querySelector<HTMLElement>("[data-running-nav-distance]");
  if (!latest) {
    if (instruction) instruction.textContent = "Waiting for a GPS fix…";
    if (detail) detail.textContent = "Your route is ready.";
    if (distanceNode) distanceNode.textContent = "";
    return;
  }

  const state = navigationStateForLocation(route, latest, nearestShapeIndex);
  nearestShapeIndex = state.nearestShapeIndex;
  if (instruction) instruction.textContent = state.nextManeuver?.instruction || "Stay on the route";
  if (detail) {
    detail.textContent = state.offRouteMeters > 80
      ? session.mode === "story" ? "Change of plan · recalculating if you stay off route" : "Recalculating if needed"
      : `${(state.routeRemainingMeters / 1000).toFixed(1)} km remaining · route ${route.rerouteCount ? `recalculated ${route.rerouteCount}×` : "locked"}`;
  }
  if (distanceNode) distanceNode.textContent = formatNavigationDistance(state.distanceToManeuverMeters);

  if (state.offRouteMeters > Math.max(55, latest.accuracy * 1.5)) {
    if (!offRouteSince) offRouteSince = Date.now();
  } else {
    offRouteSince = 0;
  }
  const secondsOffRoute = offRouteSince ? (Date.now() - offRouteSince) / 1000 : 0;
  if (shouldRerouteNavigation(state, secondsOffRoute, latest.accuracy)) void reroute(session, route);

  const cue = cueForNavigationState(state, spoken);
  if (cue && !speaking) {
    spoken[cue.maneuverId] = [...(spoken[cue.maneuverId] ?? []), cue.level];
    speaking = true;
    void speakRunningNavigation(cue.speech).finally(() => { speaking = false; });
  }
}

function removeNavigationDock() {
  document.getElementById(RUNTIME_DOCK_ID)?.remove();
}

function tick() {
  const session = loadRunSession();
  if (!session) {
    clearRunningRouteState();
    clearNativeRouteOnce();
    removeNavigationDock();
    return;
  }

  if (session.stage === "briefing") {
    void buildInitialRoute(session);
    syncBriefingNote(session);
    removeNavigationDock();
    return;
  }

  if (session.stage === "active") {
    const route = loadPlannedRunningRoute(session.id);
    if (route) updateNavigationDock(route, session);
    else {
      ensureNavigationDock();
      if (Date.now() >= nextBuildRetryAt) void buildInitialRoute(session);
    }
    return;
  }

  removeNavigationDock();
}

export function startRunningRouteRuntime() {
  if (runtimeStarted || typeof window === "undefined") return;
  runtimeStarted = true;
  window.addEventListener("storage", tick);
  window.setInterval(tick, 1000);
  queueMicrotask(tick);
}
