import { registerPlugin } from "@capacitor/core";
import type { RunPoint } from "./running";

export interface NativeRunningSnapshot {
  running: boolean;
  startedAt: number;
  distanceMeters: number;
  lastAccuracy: number;
  lastLocationAt: number;
  pointCount: number;
  points?: RunPoint[];
}

interface RunningTrackerPlugin {
  start(options?: { reset?: boolean }): Promise<NativeRunningSnapshot>;
  getSnapshot(options?: { includePoints?: boolean }): Promise<NativeRunningSnapshot>;
  stop(): Promise<NativeRunningSnapshot>;
  clear(): Promise<void>;
}

const RunningTracker = registerPlugin<RunningTrackerPlugin>("RunningTracker");

export function startNativeRunningTracker(reset = true) {
  return RunningTracker.start({ reset });
}

export function getNativeRunningSnapshot(includePoints = false) {
  return RunningTracker.getSnapshot({ includePoints });
}

export function stopNativeRunningTracker() {
  return RunningTracker.stop();
}

export function clearNativeRunningTracker() {
  return RunningTracker.clear();
}
