import { Capacitor, registerPlugin } from "@capacitor/core";
import type { PlannedRunningRoute } from "./runningRouteStore";

interface RunningBackgroundNavigationPlugin {
  setRoute(options: { routeJson: string }): Promise<void>;
  setMuted(options: { muted: boolean }): Promise<void>;
  clearRoute(): Promise<void>;
}

const RunningBackgroundNavigation = registerPlugin<RunningBackgroundNavigationPlugin>("RunningBackgroundNavigation");

export async function setNativeBackgroundRunningRoute(route: PlannedRunningRoute) {
  if (Capacitor.getPlatform() !== "android") return;
  const payload = {
    sessionId: route.sessionId,
    mode: route.mode,
    plannedMinutes: Math.max(8, Math.round(route.plannedMinutes || 30)),
    storyMission: route.storyMission ?? null,
    geometry: route.geometry,
    cumulativeMeters: route.cumulativeMeters,
    storyAnchors: route.storyAnchors ?? [],
    maneuvers: route.maneuvers.map((maneuver) => ({
      id: maneuver.id,
      instruction: maneuver.instruction,
      verbalAlert: maneuver.verbalAlert,
      verbalInstruction: maneuver.verbalInstruction,
      routeDistanceMeters: maneuver.routeDistanceMeters
    }))
  };
  await RunningBackgroundNavigation.setRoute({ routeJson: JSON.stringify(payload) });
}

export async function clearNativeBackgroundRunningRoute() {
  if (Capacitor.getPlatform() !== "android") return;
  await Promise.all([
    RunningBackgroundNavigation.clearRoute(),
    RunningBackgroundNavigation.setMuted({ muted: false })
  ]);
}

/** Keeps the foreground and Android background navigation voices in agreement. */
export async function setNativeBackgroundNavigationMuted(muted: boolean) {
  if (Capacitor.getPlatform() !== "android") return;
  await RunningBackgroundNavigation.setMuted({ muted });
}
