import type { RunRecord } from "./running";
import {
  chooseRunningRoute,
  type RunningRouteCandidate,
  type RunningRoutePoint,
  type RunningRouteRequest
} from "./runningRouteDirector";
import type { PlannedRunningRoute, RunningNavigationManeuver } from "./runningRouteStore";

interface ValhallaManeuver {
  type?: number;
  instruction?: string;
  verbal_pre_transition_instruction?: string;
  verbal_transition_alert_instruction?: string;
  verbal_post_transition_instruction?: string;
  begin_shape_index?: number;
  end_shape_index?: number;
  length?: number;
  time?: number;
  street_names?: string[];
}

interface ValhallaLeg {
  shape?: string;
  maneuver?: ValhallaManeuver[];
  maneuvers?: ValhallaManeuver[];
}

interface ValhallaResponse {
  trip?: {
    summary?: { length?: number; time?: number };
    legs?: ValhallaLeg[];
    status?: number;
    status_message?: string;
  };
  error?: string;
}

export interface ValhallaRunningRouteCandidate extends RunningRouteCandidate {
  maneuvers: RunningNavigationManeuver[];
  cumulativeMeters: number[];
  provider: string;
}

export interface BuildValhallaRoutesOptions {
  history: RunRecord[];
  home?: RunningRoutePoint;
  baseUrl?: string;
  candidateCount?: number;
}

const DEFAULT_BASE_URL = "https://valhalla.openstreetmap.de";
const EARTH_RADIUS_M = 6_371_000;

const radians = (degrees: number) => degrees * Math.PI / 180;
const degrees = (radiansValue: number) => radiansValue * 180 / Math.PI;

function haversineMeters(a: RunningRoutePoint, b: RunningRoutePoint) {
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const dLat = lat2 - lat1;
  const dLng = radians(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function destinationPoint(origin: RunningRoutePoint, bearingDegrees: number, distanceMeters: number): RunningRoutePoint {
  const angular = distanceMeters / EARTH_RADIUS_M;
  const bearing = radians(bearingDegrees);
  const lat1 = radians(origin.lat);
  const lng1 = radians(origin.lng);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing)
  );
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
    Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2)
  );
  return { lat: degrees(lat2), lng: ((degrees(lng2) + 540) % 360) - 180 };
}

export function decodeValhallaPolyline6(encoded: string): RunningRoutePoint[] {
  const points: RunningRoutePoint[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    const deltaLat = (result & 1) ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    const deltaLng = (result & 1) ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    points.push({ lat: lat / 1e6, lng: lng / 1e6 });
  }

  return points;
}

export function cumulativeRouteMeters(points: RunningRoutePoint[]) {
  const cumulative = new Array<number>(points.length).fill(0);
  for (let index = 1; index < points.length; index += 1) {
    cumulative[index] = cumulative[index - 1] + haversineMeters(points[index - 1], points[index]);
  }
  return cumulative;
}

export function estimateRunnerSpeedMps(history: RunRecord[]) {
  const recent = history
    .filter((record) => record.distanceMeters >= 800 && record.averagePaceSecondsPerKm)
    .slice(0, 8)
    .map((record) => 1000 / Math.max(210, Math.min(900, record.averagePaceSecondsPerKm ?? 420)))
    .sort((a, b) => a - b);
  if (!recent.length) return 2.35;
  const middle = Math.floor(recent.length / 2);
  return recent.length % 2 ? recent[middle] : (recent[middle - 1] + recent[middle]) / 2;
}

function routeOverlapScore(geometry: RunningRoutePoint[], history: RunRecord[]) {
  const recentPoints = history.slice(0, 8).flatMap((record) => record.points.filter((_, index) => index % 3 === 0));
  if (!recentPoints.length || !geometry.length) return 0;
  const samples = geometry.filter((_, index) => index % Math.max(1, Math.floor(geometry.length / 40)) === 0);
  const familiar = samples.filter((point) => recentPoints.some((past) => haversineMeters(point, past) <= 60)).length;
  return familiar / Math.max(1, samples.length);
}

function geometricVarietyScore(geometry: RunningRoutePoint[], maneuvers: RunningNavigationManeuver[]) {
  if (geometry.length < 3) return 0.2;
  const turnDensity = Math.min(1, maneuvers.filter((maneuver) => maneuver.type >= 8).length / 12);
  const start = geometry[0];
  const spread = Math.max(...geometry.filter((_, index) => index % 8 === 0).map((point) => haversineMeters(start, point)), 0);
  const spreadScore = Math.min(1, spread / 1800);
  return Math.min(1, 0.35 + turnDensity * 0.35 + spreadScore * 0.3);
}

function createLoopLocations(start: RunningRoutePoint, finish: RunningRoutePoint, targetDistance: number, seed: number) {
  const scale = [0.86, 1, 1.12, 0.95, 1.06, 0.9][seed % 6];
  const radius = Math.max(450, targetDistance * scale / 3.8);
  const bearing = (seed * 73 + 18) % 360;
  const first = destinationPoint(start, bearing, radius);
  const second = destinationPoint(start, bearing + 112, radius * 1.04);
  return [start, first, second, finish];
}

function mergeLegs(legs: ValhallaLeg[]) {
  const geometry: RunningRoutePoint[] = [];
  const rawManeuvers: Array<{ maneuver: ValhallaManeuver; shapeIndex: number }> = [];

  for (const leg of legs) {
    const legGeometry = leg.shape ? decodeValhallaPolyline6(leg.shape) : [];
    const offset = geometry.length ? geometry.length - 1 : 0;
    if (geometry.length && legGeometry.length) geometry.push(...legGeometry.slice(1));
    else geometry.push(...legGeometry);

    const maneuvers = leg.maneuvers ?? leg.maneuver ?? [];
    for (const maneuver of maneuvers) {
      rawManeuvers.push({
        maneuver,
        shapeIndex: Math.max(0, offset + (maneuver.begin_shape_index ?? 0))
      });
    }
  }

  const cumulative = cumulativeRouteMeters(geometry);
  const maneuvers: RunningNavigationManeuver[] = rawManeuvers.map(({ maneuver, shapeIndex }, index) => ({
    id: `m-${index}-${shapeIndex}`,
    instruction: maneuver.instruction || "Continue on the route",
    verbalAlert: maneuver.verbal_transition_alert_instruction || maneuver.instruction || "Continue on the route",
    verbalInstruction: maneuver.verbal_pre_transition_instruction || maneuver.instruction || "Continue on the route",
    type: maneuver.type ?? 0,
    routeDistanceMeters: cumulative[Math.min(shapeIndex, Math.max(0, cumulative.length - 1))] ?? 0,
    shapeIndex,
    lengthMeters: Math.max(0, (maneuver.length ?? 0) * 1000),
    timeSeconds: Math.max(0, maneuver.time ?? 0),
    streetNames: maneuver.street_names ?? []
  }));

  return { geometry, cumulative, maneuvers };
}

async function fetchCandidate(
  baseUrl: string,
  locations: RunningRoutePoint[],
  history: RunRecord[],
  runnerSpeedMps: number,
  seed: number
): Promise<ValhallaRunningRouteCandidate> {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      locations: locations.map((point) => ({ lat: point.lat, lon: point.lng, type: "break" })),
      costing: "pedestrian",
      shape_format: "polyline6",
      directions_options: { units: "kilometers" },
      id: `zenchad-running-${seed}`
    })
  });

  if (!response.ok) throw new Error(`Routing server returned ${response.status}`);
  const payload = await response.json() as ValhallaResponse;
  const legs = payload.trip?.legs ?? [];
  if (!legs.length) throw new Error(payload.trip?.status_message || payload.error || "No pedestrian route returned");

  const { geometry, cumulative, maneuvers } = mergeLegs(legs);
  if (geometry.length < 2) throw new Error("Routing server returned an empty route");
  const distanceMeters = cumulative[cumulative.length - 1] ?? (payload.trip?.summary?.length ?? 0) * 1000;
  const estimatedMinutes = distanceMeters / Math.max(1.2, runnerSpeedMps) / 60;
  const familiarity = routeOverlapScore(geometry, history);
  const variety = geometricVarietyScore(geometry, maneuvers);
  const endDistance = haversineMeters(geometry[geometry.length - 1], geometry[0]);

  return {
    id: `valhalla-${seed}-${Math.round(distanceMeters)}`,
    geometry,
    estimatedMinutes,
    distanceMeters,
    endsNearStart: endDistance <= 300,
    endDistanceFromStartMeters: endDistance,
    noveltyScore: 1 - familiarity,
    interestScore: variety,
    familiarityScore: familiarity,
    gameOpportunityScore: variety,
    routeConfidence: 0.9,
    uncertainShortcutCount: 0,
    labels: ["OpenStreetMap pedestrian route", `candidate ${seed + 1}`],
    maneuvers,
    cumulativeMeters: cumulative,
    provider: "Valhalla / OpenStreetMap"
  };
}

export async function buildValhallaRunningRoute(
  request: RunningRouteRequest,
  options: BuildValhallaRoutesOptions
): Promise<PlannedRunningRoute> {
  const history = options.history ?? [];
  const runnerSpeed = estimateRunnerSpeedMps(history);
  const targetDistance = runnerSpeed * request.plannedMinutes * 60;
  const finish = options.home ?? request.start;
  const count = Math.max(3, Math.min(6, options.candidateCount ?? 4));
  const baseUrl = options.baseUrl || import.meta.env.VITE_VALHALLA_BASE_URL || DEFAULT_BASE_URL;
  const attempts = Array.from({ length: count }, (_, seed) =>
    fetchCandidate(baseUrl, createLoopLocations(request.start, finish, targetDistance, seed), history, runnerSpeed, seed)
      .catch(() => null)
  );
  const candidates = (await Promise.all(attempts)).filter((candidate): candidate is ValhallaRunningRouteCandidate => Boolean(candidate));
  const choice = chooseRunningRoute(candidates, request);
  if (!choice) throw new Error("No usable running route could be built from the current location");
  const candidate = choice.candidate as ValhallaRunningRouteCandidate;

  return {
    version: 1,
    sessionId: "",
    mode: request.mode,
    provider: candidate.provider,
    createdAt: Date.now(),
    start: request.start,
    finish,
    estimatedMinutes: candidate.estimatedMinutes,
    distanceMeters: candidate.distanceMeters,
    geometry: candidate.geometry,
    cumulativeMeters: candidate.cumulativeMeters,
    maneuvers: candidate.maneuvers,
    routeScore: choice.score,
    reasons: choice.reasons,
    rerouteCount: 0
  };
}
