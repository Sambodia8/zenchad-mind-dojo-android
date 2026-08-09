import { LEVEL_THRESHOLDS } from "./data";
import type { Stats } from "./types";

export type RunMode = "quick" | "story";
export type RunStage = "briefing" | "prep" | "active" | "complete";
export type RunPrepStepId =
  | "headphones"
  | "clothes"
  | "water"
  | "stretches"
  | "shoes"
  | "outside";

export interface RunPoint {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
}

export interface RunSession {
  version: 1;
  id: string;
  mode: RunMode;
  plannedMinutes: number;
  stage: RunStage;
  createdAt: number;
  stepStartedAt: number;
  prepStepIndex: number;
  prepAwards: Record<string, number>;
  prepXp: number;
  runStartedAt: number | null;
  runEndedAt: number | null;
  distanceMeters: number;
  points: RunPoint[];
  runXp: number;
}

export interface RunRecord {
  id: string;
  mode: RunMode;
  plannedMinutes: number;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  distanceMeters: number;
  averagePaceSecondsPerKm: number | null;
  completionRatio: number;
  xp: number;
  points: RunPoint[];
}

export interface RunningProfile {
  version: 1;
  credits: number;
  unlockedStoreIds: string[];
  history: RunRecord[];
}

export interface RunPrepStep {
  id: RunPrepStepId;
  title: string;
  instruction: string;
  targetSeconds: number;
  graceSeconds: number;
  baseXp: number;
  bonusXp: number;
  buttonLabel: string;
  speedBonus: boolean;
}

const SESSION_KEY = "zenchad_running_session_v1";
const PROFILE_KEY = "zenchad_running_profile_v1";

export const RUN_PREP_STEPS: RunPrepStep[] = [
  {
    id: "headphones",
    title: "Headphones first",
    instruction: "Check your headphones have enough charge for the whole run. Story Mode depends on them.",
    targetSeconds: 60,
    graceSeconds: 60,
    baseXp: 20,
    bonusXp: 15,
    buttonLabel: "Headphones charged",
    speedBonus: true
  },
  {
    id: "clothes",
    title: "Running clothes",
    instruction: "Get changed into the outfit you actually want to run in.",
    targetSeconds: 4 * 60,
    graceSeconds: 4 * 60,
    baseXp: 20,
    bonusXp: 30,
    buttonLabel: "Dressed",
    speedBonus: true
  },
  {
    id: "water",
    title: "Water",
    instruction: "Get water sorted before the stretches so there is one less thing to remember afterwards.",
    targetSeconds: 2 * 60,
    graceSeconds: 2 * 60,
    baseXp: 20,
    bonusXp: 20,
    buttonLabel: "Water ready",
    speedBonus: true
  },
  {
    id: "stretches",
    title: "Warm-up stretches",
    instruction: "Do the running warm-up. There is no speed bonus here: the goal is to warm up, not rush.",
    targetSeconds: 0,
    graceSeconds: 0,
    baseXp: 25,
    bonusXp: 0,
    buttonLabel: "Warm-up done",
    speedBonus: false
  },
  {
    id: "shoes",
    title: "Running shoes",
    instruction: "Shoes on. You are almost out of the door.",
    targetSeconds: 90,
    graceSeconds: 90,
    baseXp: 20,
    bonusXp: 20,
    buttonLabel: "Shoes on",
    speedBonus: true
  },
  {
    id: "outside",
    title: "Get outside",
    instruction: "Head outside. Press the button when you are ready to start moving; the run timer starts immediately.",
    targetSeconds: 3 * 60,
    graceSeconds: 3 * 60,
    baseXp: 20,
    bonusXp: 30,
    buttonLabel: "Start run",
    speedBonus: true
  }
];

export function createRunSession(mode: RunMode, plannedMinutes: number, now = Date.now()): RunSession {
  return {
    version: 1,
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    mode,
    plannedMinutes,
    stage: "briefing",
    createdAt: now,
    stepStartedAt: now,
    prepStepIndex: 0,
    prepAwards: {},
    prepXp: 0,
    runStartedAt: null,
    runEndedAt: null,
    distanceMeters: 0,
    points: [],
    runXp: 0
  };
}

export function loadRunSession(): RunSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RunSession>;
    if (parsed.version !== 1 || !parsed.id || !parsed.mode || !parsed.stage) return null;
    return {
      ...createRunSession(parsed.mode, parsed.plannedMinutes ?? 30, parsed.createdAt ?? Date.now()),
      ...parsed,
      prepAwards: parsed.prepAwards ?? {},
      points: parsed.points ?? []
    };
  } catch {
    return null;
  }
}

export function saveRunSession(session: RunSession | null) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadRunningProfile(): RunningProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { version: 1, credits: 0, unlockedStoreIds: [], history: [] };
    const parsed = JSON.parse(raw) as Partial<RunningProfile>;
    return {
      version: 1,
      credits: parsed.credits ?? 0,
      unlockedStoreIds: parsed.unlockedStoreIds ?? [],
      history: parsed.history ?? []
    };
  } catch {
    return { version: 1, credits: 0, unlockedStoreIds: [], history: [] };
  }
}

export function saveRunningProfile(profile: RunningProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function prepStepXp(step: RunPrepStep, elapsedSeconds: number) {
  if (!step.speedBonus || step.targetSeconds <= 0) return step.baseXp;
  if (elapsedSeconds <= step.targetSeconds) return step.baseXp + step.bonusXp;
  if (step.graceSeconds <= 0) return step.baseXp;
  const overtime = elapsedSeconds - step.targetSeconds;
  if (overtime >= step.graceSeconds) return step.baseXp;
  const remainingFraction = 1 - overtime / step.graceSeconds;
  return step.baseXp + Math.max(0, Math.ceil(step.bonusXp * remainingFraction));
}

export function distanceMeters(a: RunPoint, b: RunPoint) {
  const radius = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function calculateRunXp(durationSeconds: number, distance: number, plannedMinutes: number) {
  const plannedSeconds = Math.max(60, plannedMinutes * 60);
  const ratio = Math.max(0, durationSeconds / plannedSeconds);
  const timeXp = Math.floor(durationSeconds / 60) * 10;
  const distanceXp = Math.floor(distance / 250) * 5;
  const milestoneXp =
    (ratio >= 0.5 ? 20 : 0) +
    (ratio >= 0.75 ? 30 : 0) +
    (ratio >= 1 ? 60 : 0);
  return timeXp + distanceXp + milestoneXp;
}

export function levelForXp(xp: number) {
  const nextThreshold = LEVEL_THRESHOLDS.findIndex((threshold) => xp < threshold);
  return nextThreshold === -1 ? LEVEL_THRESHOLDS.length : Math.max(1, nextThreshold);
}

export function addRunningXp(stats: Stats, amount: number): Stats {
  const xp = stats.xp + Math.max(0, amount);
  return { ...stats, xp, level: levelForXp(xp) };
}

export function formatRunDistance(distance: number) {
  if (distance < 1000) return `${Math.round(distance)} m`;
  return `${(distance / 1000).toFixed(2)} km`;
}

export function formatRunClock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function formatRunPace(secondsPerKm: number | null) {
  if (!secondsPerKm || !Number.isFinite(secondsPerKm)) return "—";
  return `${formatRunClock(secondsPerKm)} /km`;
}
