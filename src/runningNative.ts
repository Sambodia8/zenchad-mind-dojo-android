import { registerPlugin } from "@capacitor/core";
import type { RunPoint } from "./running";

export interface NativeRunningSnapshot {
  running: boolean;
  sessionId: string;
  startedAt: number;
  distanceMeters: number;
  lastAccuracy: number;
  lastLocationAt: number;
  pointCount: number;
  points?: RunPoint[];
}

interface RunningTrackerPlugin {
  start(options: { sessionId: string; reset?: boolean }): Promise<NativeRunningSnapshot>;
  getSnapshot(options?: { includePoints?: boolean }): Promise<NativeRunningSnapshot>;
  stop(): Promise<NativeRunningSnapshot>;
  clear(): Promise<void>;
}

const RunningTracker = registerPlugin<RunningTrackerPlugin>("RunningTracker");

export function startNativeRunningTracker(sessionId: string, reset = false) {
  return RunningTracker.start({ sessionId, reset });
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
