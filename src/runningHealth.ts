import { Capacitor, registerPlugin } from "@capacitor/core";

export interface RunningHealthStatus {
  supported: boolean;
  permissionGranted: boolean;
  source: string;
}

export interface RunningHeartRateSample {
  at: number;
  bpm: number;
}

export interface RunningCadenceSample {
  at: number;
  stepsPerMinute: number;
}

export interface NativeRunningHealthResult {
  heartRateSamples: RunningHeartRateSample[];
  heartRateSampleCount: number;
  averageHeartRate: number | null;
  minimumHeartRate: number | null;
  maximumHeartRate: number | null;
  steps: number;
  cadenceSamples: RunningCadenceSample[];
  cadenceSampleCount: number;
  averageCadence: number | null;
  maximumCadence: number | null;
}

export interface StoredRunningHealthResult extends NativeRunningHealthResult {
  runId: string;
  importedAt: number;
  source: "Health Connect";
}

interface RunningHealthPlugin {
  getStatus(): Promise<RunningHealthStatus>;
  requestHealthPermissions(): Promise<RunningHealthStatus>;
  readRunHealth(options: { startedAt: number; endedAt: number }): Promise<NativeRunningHealthResult>;
}

const RunningHealth = registerPlugin<RunningHealthPlugin>("RunningHealth");
const STORAGE_KEY = "zenchad_running_health_v1";

interface RunningHealthStore {
  version: 1;
  records: StoredRunningHealthResult[];
}

export const runningHealthNativeAvailable = () => Capacitor.getPlatform() === "android";

export function getRunningHealthStatus() {
  return RunningHealth.getStatus();
}

export function requestRunningHealthPermissions() {
  return RunningHealth.requestHealthPermissions();
}

export function readNativeRunningHealth(startedAt: number, endedAt: number) {
  return RunningHealth.readRunHealth({ startedAt, endedAt });
}

function loadStore(): RunningHealthStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, records: [] };
    const parsed = JSON.parse(raw) as Partial<RunningHealthStore>;
    return { version: 1, records: Array.isArray(parsed.records) ? parsed.records : [] };
  } catch {
    return { version: 1, records: [] };
  }
}

function saveStore(store: RunningHealthStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, records: store.records.slice(0, 300) }));
}

function compactSamples<T>(samples: T[], limit: number) {
  if (samples.length <= limit) return samples;
  const result: T[] = [];
  const step = (samples.length - 1) / Math.max(1, limit - 1);
  for (let index = 0; index < limit; index += 1) {
    result.push(samples[Math.min(samples.length - 1, Math.round(index * step))]);
  }
  return result;
}

export function runningHealthForRun(runId: string) {
  return loadStore().records.find((record) => record.runId === runId) ?? null;
}

export function saveRunningHealth(runId: string, result: NativeRunningHealthResult): StoredRunningHealthResult {
  const record: StoredRunningHealthResult = {
    ...result,
    runId,
    importedAt: Date.now(),
    source: "Health Connect",
    heartRateSamples: compactSamples(Array.isArray(result.heartRateSamples) ? result.heartRateSamples : [], 180),
    cadenceSamples: compactSamples(Array.isArray(result.cadenceSamples) ? result.cadenceSamples : [], 120)
  };
  const store = loadStore();
  const existing = store.records.findIndex((item) => item.runId === runId);
  if (existing >= 0) store.records[existing] = record;
  else store.records.unshift(record);
  store.records.sort((a, b) => b.importedAt - a.importedAt);
  saveStore(store);
  window.dispatchEvent(new CustomEvent("zenchad:running-health-updated", { detail: { runId } }));
  return record;
}
