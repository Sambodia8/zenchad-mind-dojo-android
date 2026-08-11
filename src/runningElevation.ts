import type { RunPoint, RunRecord } from "./running";

export interface RunElevationSample {
  distanceMeters: number;
  elevationMeters: number;
}

export interface RunElevationInsight {
  runId: string;
  status: "ready" | "unavailable";
  updatedAt: number;
  gainMeters: number;
  lossMeters: number;
  minMeters: number;
  maxMeters: number;
  samples: RunElevationSample[];
}

interface ElevationStore {
  version: 1;
  byRunId: Record<string, RunElevationInsight>;
}

interface HeightResponse {
  range_height?: Array<[number, number | null]>;
}

const STORE_KEY = "zenchad_running_elevation_v1";
const DEFAULT_BASE_URL = "https://valhalla.openstreetmap.de";

function loadStore(): ElevationStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { version: 1, byRunId: {} };
    const parsed = JSON.parse(raw) as Partial<ElevationStore>;
    return { version: 1, byRunId: parsed.byRunId ?? {} };
  } catch {
    return { version: 1, byRunId: {} };
  }
}

function saveStore(store: ElevationStore) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

export function loadRunElevation(runId: string) {
  return loadStore().byRunId[runId] ?? null;
}

function sampleInputPoints(points: RunPoint[], maxPoints = 100) {
  if (points.length <= maxPoints) return points;
  const result: RunPoint[] = [];
  const stride = (points.length - 1) / (maxPoints - 1);
  for (let index = 0; index < maxPoints; index += 1) {
    result.push(points[Math.min(points.length - 1, Math.round(index * stride))]);
  }
  return result;
}

function summariseElevation(runId: string, raw: Array<[number, number | null]>): RunElevationInsight | null {
  const samples = raw
    .filter((item): item is [number, number] => Number.isFinite(item?.[0]) && Number.isFinite(item?.[1]))
    .map(([distanceMeters, elevationMeters]) => ({ distanceMeters, elevationMeters }));
  if (samples.length < 2) return null;

  let gainMeters = 0;
  let lossMeters = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const delta = samples[index].elevationMeters - samples[index - 1].elevationMeters;
    // Ignore tiny DEM/sample noise so a flat run doesn't accumulate fake climbing.
    if (delta >= 1.25) gainMeters += delta;
    else if (delta <= -1.25) lossMeters += Math.abs(delta);
  }
  const elevations = samples.map((sample) => sample.elevationMeters);
  return {
    runId,
    status: "ready",
    updatedAt: Date.now(),
    gainMeters,
    lossMeters,
    minMeters: Math.min(...elevations),
    maxMeters: Math.max(...elevations),
    samples
  };
}

export async function enrichRunElevation(
  record: RunRecord,
  baseUrl = import.meta.env.VITE_VALHALLA_BASE_URL || DEFAULT_BASE_URL
) {
  const existing = loadRunElevation(record.id);
  if (existing?.status === "ready") return existing;
  const points = sampleInputPoints(record.points);
  if (points.length < 2) return null;

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/height`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        range: true,
        resample_distance: 40,
        height_precision: 1,
        shape: points.map((point) => ({ lat: point.lat, lon: point.lng }))
      })
    });
    if (!response.ok) throw new Error(`Elevation server returned ${response.status}`);
    const payload = await response.json() as HeightResponse;
    const insight = summariseElevation(record.id, payload.range_height ?? []);
    if (!insight) throw new Error("Elevation profile was empty");
    const store = loadStore();
    store.byRunId[record.id] = insight;
    saveStore(store);
    return insight;
  } catch {
    const unavailable: RunElevationInsight = {
      runId: record.id,
      status: "unavailable",
      updatedAt: Date.now(),
      gainMeters: 0,
      lossMeters: 0,
      minMeters: 0,
      maxMeters: 0,
      samples: []
    };
    const store = loadStore();
    store.byRunId[record.id] = unavailable;
    saveStore(store);
    return unavailable;
  }
}

export function elevationProfilePoints(samples: RunElevationSample[]) {
  if (samples.length < 2) return "";
  const maxDistance = Math.max(1, samples[samples.length - 1].distanceMeters);
  const elevations = samples.map((sample) => sample.elevationMeters);
  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  const range = Math.max(1, max - min);
  return samples.map((sample) => {
    const x = 4 + sample.distanceMeters / maxDistance * 92;
    const y = 92 - (sample.elevationMeters - min) / range * 78;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}
