import { Capacitor, registerPlugin } from "@capacitor/core";
import type { ChaseDifficulty } from "./runningStory";

export interface NativeStoryRouteEvent {
  type: "chase-start" | "chase-outcome" | "helicopter-start" | "helicopter-cover" | string;
  at: number;
  distanceMeters: number;
  detail: string;
}

export interface NativeStorySnapshot {
  sessionId: string;
  enabled: boolean;
  missionId: string;
  missionTitle: string;
  difficulty: ChaseDifficulty;
  phase: string;
  radioTitle: string;
  radioDetail: string;
  chaseCount: number;
  activeChase: boolean;
  chaseStartedAt: number;
  chaseDurationSeconds: number;
  chaseTargetSpeedMps: number;
  chaseAchievedSpeedMps: number;
  lastOutcome: string;
  helicopterTriggered: boolean;
  helicopterTargetDistanceMeters: number;
  eventsJson: string;
  sfxEnabled: boolean;
  sfxVolume: number;
  voiceVolume: number;
  updatedAt: number;
}

interface RunningStoryDirectorPlugin {
  getSnapshot(): Promise<NativeStorySnapshot>;
  setDifficulty(options: { difficulty: ChaseDifficulty }): Promise<NativeStorySnapshot>;
  setAudioSettings(options: {
    sfxEnabled?: boolean;
    sfxVolume?: number;
    voiceVolume?: number;
  }): Promise<NativeStorySnapshot>;
  clear(): Promise<NativeStorySnapshot>;
}

const RunningStoryDirector = registerPlugin<RunningStoryDirectorPlugin>("RunningStoryDirector");

export const usesNativeStoryDirector = () => Capacitor.getPlatform() === "android";

export function getNativeStorySnapshot() {
  return RunningStoryDirector.getSnapshot();
}

export function parseNativeStoryEvents(snapshot: Pick<NativeStorySnapshot, "eventsJson">): NativeStoryRouteEvent[] {
  try {
    const parsed = JSON.parse(snapshot.eventsJson || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((event): event is NativeStoryRouteEvent =>
      Boolean(
        event &&
        typeof event.type === "string" &&
        Number.isFinite(event.at) &&
        Number.isFinite(event.distanceMeters)
      )
    ).map((event) => ({
      type: event.type,
      at: event.at,
      distanceMeters: Math.max(0, event.distanceMeters),
      detail: typeof event.detail === "string" ? event.detail : ""
    }));
  } catch {
    return [];
  }
}

export function setNativeStoryDifficulty(difficulty: ChaseDifficulty) {
  return RunningStoryDirector.setDifficulty({ difficulty });
}

export function setNativeStoryAudioSettings(settings: {
  sfxEnabled?: boolean;
  sfxVolume?: number;
  voiceVolume?: number;
}) {
  return RunningStoryDirector.setAudioSettings(settings);
}

export function clearNativeStoryDirector() {
  return RunningStoryDirector.clear();
}
