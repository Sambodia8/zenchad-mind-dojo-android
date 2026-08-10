import { Capacitor, registerPlugin } from "@capacitor/core";
import type { ChaseDifficulty } from "./runningStory";

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
  updatedAt: number;
}

interface RunningStoryDirectorPlugin {
  getSnapshot(): Promise<NativeStorySnapshot>;
  setDifficulty(options: { difficulty: ChaseDifficulty }): Promise<NativeStorySnapshot>;
  clear(): Promise<NativeStorySnapshot>;
}

const RunningStoryDirector = registerPlugin<RunningStoryDirectorPlugin>("RunningStoryDirector");

export const usesNativeStoryDirector = () => Capacitor.getPlatform() === "android";

export function getNativeStorySnapshot() {
  return RunningStoryDirector.getSnapshot();
}

export function setNativeStoryDifficulty(difficulty: ChaseDifficulty) {
  return RunningStoryDirector.setDifficulty({ difficulty });
}

export function clearNativeStoryDirector() {
  return RunningStoryDirector.clear();
}
