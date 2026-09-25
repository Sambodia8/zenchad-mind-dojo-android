import type { RunMode } from "./running";

export interface RunningRoutePoint {
  lat: number;
  lng: number;
}

export interface RunningRouteCandidate {
  id: string;
  geometry: RunningRoutePoint[];
  estimatedMinutes: number;
  distanceMeters: number;
  endsNearStart: boolean;
  endDistanceFromStartMeters: number;
  noveltyScore: number;
  interestScore: number;
  familiarityScore: number;
  gameOpportunityScore: number;
  routeConfidence: number;
  uncertainShortcutCount: number;
  labels?: string[];
}

export interface RunningRouteRequest {
  mode: RunMode;
  plannedMinutes: number;
  start: RunningRoutePoint;
  recentRouteFingerprints?: string[];
}

/** Coarse private shape signature; GPS noise and reversed direction usually keep the same bucket. */
export function routeFingerprintFromPoints(points: RunningRoutePoint[], distanceMeters: number): string | null {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return null;
  let count = 0;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const point of points) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) continue;
    count += 1;
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLng = Math.min(minLng, point.lng);
    maxLng = Math.max(maxLng, point.lng);
  }
  if (count < 2) return null;
  const centreLat = (minLat + maxLat) / 2;
  const centreLng = (minLng + maxLng) / 2;
  const widthMeters = (maxLng - minLng) * 111_320 * Math.cos(centreLat * Math.PI / 180);
  const heightMeters = (maxLat - minLat) * 111_320;
  return [Math.round(centreLat * 300), Math.round(centreLng * 300), Math.round(distanceMeters / 400), Math.round(widthMeters / 300), Math.round(heightMeters / 300)].join(":");
}

export interface RunningRouteChoice {
  candidate: RunningRouteCandidate;
  score: number;
  reasons: string[];
}

export interface RunningRouteProvider {
  name: string;
  getCandidates(request: RunningRouteRequest): Promise<RunningRouteCandidate[]>;
}

const clamp01 = (value: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

function durationFit(candidate: RunningRouteCandidate, plannedMinutes: number) {
  const tolerance = Math.max(6, plannedMinutes * 0.35);
  const error = Math.abs(candidate.estimatedMinutes - plannedMinutes);
  return clamp01(1 - error / tolerance);
}

function finishConvenience(candidate: RunningRouteCandidate) {
  if (candidate.endsNearStart) return 1;
  if (candidate.endDistanceFromStartMeters <= 500) return 0.85;
  if (candidate.endDistanceFromStartMeters <= 1200) return 0.55;
  return 0.2;
}

export function routeCandidateIsUsable(candidate: RunningRouteCandidate) {
  if (candidate.geometry.length < 2) return false;
  if (candidate.geometry.some((point) => !Number.isFinite(point.lat) || !Number.isFinite(point.lng) || Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180)) return false;
  if (!Number.isFinite(candidate.estimatedMinutes) || candidate.estimatedMinutes <= 0) return false;
  if (!Number.isFinite(candidate.distanceMeters) || candidate.distanceMeters <= 0) return false;
  if (!Number.isFinite(candidate.routeConfidence) || candidate.routeConfidence < 0.45) return false;

  // Explicit project rule: low-confidence map interpretation must never become an invented shortcut.
  if (candidate.uncertainShortcutCount > 0) return false;
  return true;
}

export function scoreRunningRoute(candidate: RunningRouteCandidate, request: RunningRouteRequest): RunningRouteChoice {
  const fit = durationFit(candidate, request.plannedMinutes);
  const finish = finishConvenience(candidate);
  const novelty = clamp01(candidate.noveltyScore);
  const interest = clamp01(candidate.interestScore);
  const familiarity = clamp01(candidate.familiarityScore);
  const game = clamp01(candidate.gameOpportunityScore);
  const confidence = clamp01(candidate.routeConfidence);
  const fingerprint = routeFingerprintFromPoints(candidate.geometry, candidate.distanceMeters);
  const recentlyRepeated = fingerprint !== null && request.recentRouteFingerprints?.includes(fingerprint);

  let score: number;
  if (request.mode === "story") {
    score =
      fit * 0.28 +
      novelty * 0.24 +
      interest * 0.16 +
      game * 0.22 +
      finish * 0.06 +
      confidence * 0.04;
  } else {
    score =
      fit * 0.36 +
      interest * 0.19 +
      novelty * 0.14 +
      familiarity * 0.16 +
      finish * 0.11 +
      confidence * 0.04;
  }
  if (recentlyRepeated) score -= request.mode === "story" ? 0.18 : 0.12;

  const reasons: string[] = [];
  if (fit >= 0.85) reasons.push("good fit for the chosen time");
  if (candidate.endsNearStart) reasons.push("finishes near the start");
  if (novelty >= 0.7) reasons.push("contains plenty of new ground");
  if (interest >= 0.7) reasons.push("has varied or interesting surroundings");
  if (request.mode === "story" && game >= 0.65) reasons.push("has strong Story Run set-piece opportunities");
  if (request.mode === "quick" && familiarity >= 0.65) reasons.push("keeps enough familiar ground to stay low-friction");
  if (recentlyRepeated) reasons.push("recently used route");

  return { candidate, score, reasons };
}

export function chooseRunningRoute(candidates: RunningRouteCandidate[], request: RunningRouteRequest) {
  const usable = candidates.filter(routeCandidateIsUsable);
  if (!usable.length) return null;

  return usable
    .map((candidate) => scoreRunningRoute(candidate, request))
    .sort((a, b) => b.score - a.score)[0];
}

export async function planRunningRoute(provider: RunningRouteProvider, request: RunningRouteRequest) {
  const candidates = await provider.getCandidates(request);
  return chooseRunningRoute(candidates, request);
}

export function routeNeedsReroute(
  distanceFromPlannedRouteMeters: number,
  secondsOffRoute: number,
  gpsAccuracyMeters: number
) {
  const uncertaintyAllowance = Math.max(20, Math.min(80, gpsAccuracyMeters * 1.5));
  return distanceFromPlannedRouteMeters > uncertaintyAllowance + 35 && secondsOffRoute >= 8;
}

export function offRouteInstruction(mode: RunMode) {
  return mode === "story"
    ? "Change of plan. Keep moving — recalculating the mission around you."
    : "reroute-silently";
}
