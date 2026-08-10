import type { RunMode } from "./running";
import type { RunningRoutePoint } from "./runningRouteDirector";

export interface RunningNavigationManeuver {
  id: string;
  instruction: string;
  verbalAlert: string;
  verbalInstruction: string;
  type: number;
  routeDistanceMeters: number;
  shapeIndex: number;
  lengthMeters: number;
  timeSeconds: number;
  streetNames: string[];
}

export interface PlannedRunningRoute {
  version: 1;
  sessionId: string;
  mode: RunMode;
  provider: string;
  createdAt: number;
  start: RunningRoutePoint;
  finish: RunningRoutePoint;
  estimatedMinutes: number;
  distanceMeters: number;
  geometry: RunningRoutePoint[];
  cumulativeMeters: number[];
  maneuvers: RunningNavigationManeuver[];
  routeScore: number;
  reasons: string[];
  rerouteCount: number;
}

export interface RunningRouteBuildState {
  sessionId: string;
  status: "idle" | "locating" | "building" | "ready" | "error";
  message: string;
  updatedAt: number;
}

const ROUTE_KEY = "zenchad_running_route_v1";
const ROUTE_STATE_KEY = "zenchad_running_route_state_v1";

export function loadPlannedRunningRoute(sessionId?: string | null): PlannedRunningRoute | null {
  try {
    const raw = localStorage.getItem(ROUTE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlannedRunningRoute;
    if (parsed?.version !== 1 || !parsed.sessionId || !Array.isArray(parsed.geometry)) return null;
    if (sessionId && parsed.sessionId !== sessionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePlannedRunningRoute(route: PlannedRunningRoute | null) {
  if (!route) {
    localStorage.removeItem(ROUTE_KEY);
    return;
  }
  localStorage.setItem(ROUTE_KEY, JSON.stringify(route));
}

export function loadRunningRouteBuildState(sessionId?: string | null): RunningRouteBuildState | null {
  try {
    const raw = localStorage.getItem(ROUTE_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RunningRouteBuildState;
    if (!parsed?.sessionId || !parsed.status) return null;
    if (sessionId && parsed.sessionId !== sessionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveRunningRouteBuildState(state: RunningRouteBuildState | null) {
  if (!state) {
    localStorage.removeItem(ROUTE_STATE_KEY);
    return;
  }
  localStorage.setItem(ROUTE_STATE_KEY, JSON.stringify(state));
}

export function clearRunningRouteState() {
  savePlannedRunningRoute(null);
  saveRunningRouteBuildState(null);
}
