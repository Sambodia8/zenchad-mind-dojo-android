import { routeNeedsReroute, type RunningRoutePoint } from "./runningRouteDirector";
import type { PlannedRunningRoute, RunningNavigationManeuver } from "./runningRouteStore";

export interface RunningNavigationState {
  routeProgressMeters: number;
  offRouteMeters: number;
  nearestShapeIndex: number;
  nextManeuver: RunningNavigationManeuver | null;
  distanceToManeuverMeters: number | null;
  estimatedSecondsToManeuver: number | null;
  routeRemainingMeters: number;
  routeProgressFraction: number;
}

export type NavigationCueLevel = "preview" | "now";

export interface RunningNavigationCue {
  maneuverId: string;
  level: NavigationCueLevel;
  speech: string;
}

const EARTH_RADIUS_M = 6_371_000;
const radians = (degrees: number) => degrees * Math.PI / 180;

function distanceMeters(a: RunningRoutePoint, b: RunningRoutePoint) {
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const dLat = lat2 - lat1;
  const dLng = radians(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function navigationStateForLocation(
  route: PlannedRunningRoute,
  location: RunningRoutePoint,
  previousShapeIndex = 0
): RunningNavigationState {
  if (!route.geometry.length) {
    return {
      routeProgressMeters: 0,
      offRouteMeters: Number.POSITIVE_INFINITY,
      nearestShapeIndex: 0,
      nextManeuver: null,
      distanceToManeuverMeters: null,
      estimatedSecondsToManeuver: null,
      routeRemainingMeters: 0,
      routeProgressFraction: 0
    };
  }

  const start = Math.max(0, previousShapeIndex - 25);
  const end = Math.min(route.geometry.length - 1, previousShapeIndex + 220);
  let nearestIndex = Math.min(previousShapeIndex, route.geometry.length - 1);
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let index = start; index <= end; index += 1) {
    const distance = distanceMeters(location, route.geometry[index]);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  }

  // If the constrained search clearly missed the route (e.g. a big reroute/reload), do one full recovery scan.
  if (nearestDistance > 150) {
    route.geometry.forEach((point, index) => {
      const distance = distanceMeters(location, point);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
  }

  const progress = route.cumulativeMeters[nearestIndex] ?? 0;
  const nextManeuver = route.maneuvers.find((maneuver) => maneuver.routeDistanceMeters > progress + 8) ?? null;
  const routeLength = route.cumulativeMeters[route.cumulativeMeters.length - 1] ?? route.distanceMeters;
  const distanceToManeuverMeters = nextManeuver ? Math.max(0, nextManeuver.routeDistanceMeters - progress) : null;
  const secondsPerMeter = routeLength > 0 ? route.estimatedMinutes * 60 / routeLength : 0;

  return {
    routeProgressMeters: progress,
    offRouteMeters: nearestDistance,
    nearestShapeIndex: nearestIndex,
    nextManeuver,
    distanceToManeuverMeters,
    estimatedSecondsToManeuver: distanceToManeuverMeters === null || secondsPerMeter <= 0
      ? null
      : Math.max(1, Math.round(distanceToManeuverMeters * secondsPerMeter)),
    routeRemainingMeters: Math.max(0, routeLength - progress),
    routeProgressFraction: routeLength > 0 ? Math.min(1, Math.max(0, progress / routeLength)) : 0
  };
}

function usableRoadName(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length >= 2 && !/^(continue|destination|the route|unnamed road|road)$/i.test(clean) ? clean : null;
}

function maneuverRoadName(maneuver: RunningNavigationManeuver | undefined) {
  const street = maneuver?.streetNames.map(usableRoadName).find((name): name is string => Boolean(name));
  if (street) return street;
  const match = maneuver?.instruction.match(/\b(?:onto|on|toward|towards)\s+(.+?)(?:[.,;]|$)/i);
  return match ? usableRoadName(match[1]) : null;
}

/** Match a GPS fix to the provider road represented by the active route at that progress. */
export function roadNameForLocation(route: PlannedRunningRoute, location: RunningRoutePoint) {
  const state = navigationStateForLocation(route, location);
  const current = [...route.maneuvers]
    .reverse()
    .find((maneuver) => maneuver.routeDistanceMeters <= state.routeProgressMeters + 20);
  return maneuverRoadName(current) ?? maneuverRoadName(state.nextManeuver ?? undefined) ?? undefined;
}

// The route provider's stored maneuver is the source of truth. In particular, do
// not infer a left/right turn from geometry: short GPS segments and loops make that
// surprisingly easy to reverse.
export function navigationArrowForManeuver(maneuver: RunningNavigationManeuver | null) {
  const instruction = maneuver?.instruction.toLowerCase() ?? "";
  if (/\b(?:u-turn|uturn)\b/.test(instruction)) return "↶";
  if (/\b(?:roundabout|rotary)\b/.test(instruction)) return "↻";
  if (/\bsharp left\b/.test(instruction)) return "↙";
  if (/\bsharp right\b/.test(instruction)) return "↘";
  if (/\b(?:turn|bear|keep|slight) left\b/.test(instruction)) return "↰";
  if (/\b(?:turn|bear|keep|slight) right\b/.test(instruction)) return "↱";
  if (/\b(?:arrive|destination)\b/.test(instruction)) return "◆";
  return "↑";
}

export function cueForNavigationState(
  state: RunningNavigationState,
  alreadySpoken: Record<string, NavigationCueLevel[]>
): RunningNavigationCue | null {
  const maneuver = state.nextManeuver;
  const distance = state.distanceToManeuverMeters;
  if (!maneuver || distance === null || state.offRouteMeters > 80) return null;
  const spoken = alreadySpoken[maneuver.id] ?? [];

  if (distance <= 38 && !spoken.includes("now")) {
    return {
      maneuverId: maneuver.id,
      level: "now",
      speech: `In ${formatNavigationDistance(distance)}, ${formatNavigationTime(state.estimatedSecondsToManeuver)} away, ${maneuver.verbalAlert || maneuver.instruction}`
    };
  }

  if (distance <= 135 && distance > 38 && !spoken.includes("preview")) {
    return {
      maneuverId: maneuver.id,
      level: "preview",
      speech: `In ${formatNavigationDistance(distance)}, ${formatNavigationTime(state.estimatedSecondsToManeuver)} away, ${maneuver.verbalInstruction || maneuver.instruction}`
    };
  }

  return null;
}

export function formatNavigationDistance(distance: number | null) {
  if (distance === null) return "";
  if (distance < 1000) return `${Math.max(10, Math.round(distance / 10) * 10)} m`;
  return `${(distance / 1000).toFixed(1)} km`;
}

export function formatNavigationTime(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "a moment";
  if (seconds < 45) return "under a minute";
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min${minutes === 1 ? "" : "s"}`;
}

export function shouldRerouteNavigation(
  state: RunningNavigationState,
  secondsOffRoute: number,
  gpsAccuracyMeters: number
) {
  return routeNeedsReroute(state.offRouteMeters, secondsOffRoute, gpsAccuracyMeters);
}
