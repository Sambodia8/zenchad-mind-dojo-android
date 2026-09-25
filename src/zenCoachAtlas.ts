import { trimRouteForPrivacy, type RunPoint, type RunRecord } from "./running";
import { routeFingerprintFromPoints } from "./runningRouteDirector";

export interface AtlasVisit {
  id: string;
  endedAt: number;
  distanceMeters: number;
  durationSeconds: number;
  points: RunPoint[];
}

export interface AtlasPlace {
  id: string;
  name: string;
  isFavorite: boolean;
  visitCount: number;
  lastVisitedAt: number;
  firstVisitedAt: number;
  totalDistanceMeters: number;
  visits: AtlasVisit[];
  /** A coarse visual trace after the profile's home/end trimming has been applied. */
  previewPoints: RunPoint[];
  rediscovery: "recent" | "ready" | "forgotten";
}

export interface ZenCoachAtlasState {
  enabled: boolean;
}

const ATLAS_KEY = "zenchad_zen_coach_atlas_v1";
const DAY = 86_400_000;

function privatePreview(points: RunPoint[], privacyMeters: number): RunPoint[] {
  const trimmed = trimRouteForPrivacy(points, Math.max(200, privacyMeters));
  // The shared helper deliberately keeps short traces intact for other app views.
  // Atlas promises trimmed previews, so omit one that cannot be trimmed safely.
  return trimmed === points ? [] : trimmed;
}

export function loadZenCoachAtlasState(): ZenCoachAtlasState {
  try {
    const parsed = JSON.parse(localStorage.getItem(ATLAS_KEY) ?? "null") as Partial<ZenCoachAtlasState> | null;
    return { enabled: parsed?.enabled === true };
  } catch {
    return { enabled: false };
  }
}

export function saveZenCoachAtlasState(state: ZenCoachAtlasState): void {
  localStorage.setItem(ATLAS_KEY, JSON.stringify({ enabled: state.enabled }));
}

function validRecord(record: RunRecord) {
  return Number.isFinite(record.endedAt) && record.endedAt > 0 &&
    Number.isFinite(record.durationSeconds) && record.durationSeconds > 0;
}

function safeName(record: RunRecord) {
  const name = record.routeName.trim();
  return name && name !== "Recorded route" ? name : "Unnamed recorded route";
}

function groupKey(record: RunRecord) {
  // A fingerprint makes nearby GPS recordings group despite ordinary noise. A user-given
  // name deliberately stays separate, because it represents an explicit personal distinction.
  const fingerprint = record.points.length >= 2 ? routeFingerprintFromPoints(record.points, record.distanceMeters) : null;
  return record.routeNameSource === "user" ? `name:${safeName(record).toLocaleLowerCase()}` : fingerprint ? `shape:${fingerprint}` : `run:${record.id}`;
}

function rediscoveryFor(lastVisitedAt: number, now: number): AtlasPlace["rediscovery"] {
  const age = Math.max(0, now - lastVisitedAt);
  if (age >= 42 * DAY) return "forgotten";
  if (age >= 14 * DAY) return "ready";
  return "recent";
}

/**
 * Builds private, non-navigable place cards from banked runs only. No generated routes,
 * geocoding, or exact start/end location escapes this boundary.
 */
export function buildZenCoachAtlas(records: RunRecord[], privacyMeters: number, now = Date.now()): AtlasPlace[] {
  const groups = new Map<string, RunRecord[]>();
  records.filter(validRecord).forEach((record) => {
    const key = groupKey(record);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  });

  return [...groups.entries()].map(([id, visits]) => {
    const ordered = [...visits].sort((a, b) => b.endedAt - a.endedAt);
    const latest = ordered[0];
    const named = ordered.find((record) => record.routeNameSource === "user") ?? latest;
    const previewSource = ordered.find((record) => record.points.length >= 2) ?? latest;
    return {
      id,
      name: safeName(named),
      isFavorite: ordered.some((record) => record.isFavorite),
      visitCount: ordered.length,
      lastVisitedAt: latest.endedAt,
      firstVisitedAt: ordered[ordered.length - 1].endedAt,
      totalDistanceMeters: ordered.reduce((total, record) => total + Math.max(0, record.distanceMeters), 0),
      visits: ordered.map((record) => ({
        id: record.id,
        endedAt: record.endedAt,
        distanceMeters: Math.max(0, record.distanceMeters),
        durationSeconds: Math.max(0, record.durationSeconds),
        points: privatePreview(record.points, privacyMeters)
      })),
      previewPoints: privatePreview(previewSource.points, privacyMeters),
      rediscovery: rediscoveryFor(latest.endedAt, now)
    };
  }).sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || b.lastVisitedAt - a.lastVisitedAt);
}

export function atlasRediscoverySuggestion(places: AtlasPlace[]): AtlasPlace | null {
  return places.find((place) => place.isFavorite && place.rediscovery !== "recent")
    ?? places.find((place) => place.rediscovery === "forgotten")
    ?? places.find((place) => place.rediscovery === "ready")
    ?? null;
}
