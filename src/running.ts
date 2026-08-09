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
export type RunBestEffortKey = "400m" | "half-mile" | "1k" | "1-mile" | "2-mile" | "5k";

export interface RunPoint {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
  distanceFromStart?: number;
}

export interface RunSplit {
  index: number;
  distanceMeters: number;
  durationSeconds: number;
  paceSecondsPerKm: number;
  completedAt: number;
}

export interface RunBestEffort {
  key: RunBestEffortKey;
  label: string;
  distanceMeters: number;
  durationSeconds: number;
  paceSecondsPerKm: number;
}

export interface RunSession {
  version: 2;
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
  splits: RunSplit[];
  bestEfforts: RunBestEffort[];
  personalBestKeys: RunBestEffortKey[];
}

export interface RunningProfile {
  version: 2;
  credits: number;
  unlockedStoreIds: string[];
  history: RunRecord[];
  routePrivacyMeters: number;
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

const BEST_EFFORT_TARGETS: Array<{
  key: RunBestEffortKey;
  label: string;
  distanceMeters: number;
}> = [
  { key: "400m", label: "400 m", distanceMeters: 400 },
  { key: "half-mile", label: "1/2 mile", distanceMeters: 804.672 },
  { key: "1k", label: "1K", distanceMeters: 1000 },
  { key: "1-mile", label: "1 mile", distanceMeters: 1609.344 },
  { key: "2-mile", label: "2 mile", distanceMeters: 3218.688 },
  { key: "5k", label: "5K", distanceMeters: 5000 }
];

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

const emptyProfile = (): RunningProfile => ({
  version: 2,
  credits: 0,
  unlockedStoreIds: [],
  history: [],
  routePrivacyMeters: 200
});

export function createRunSession(mode: RunMode, plannedMinutes: number, now = Date.now()): RunSession {
  return {
    version: 2,
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
    const parsed = JSON.parse(raw) as Partial<RunSession> & { version?: number };
    if (!parsed.id || !parsed.mode || !parsed.stage) return null;
    return {
      ...createRunSession(parsed.mode, parsed.plannedMinutes ?? 30, parsed.createdAt ?? Date.now()),
      ...parsed,
      version: 2,
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

function normaliseRecord(record: Partial<RunRecord>): RunRecord | null {
  if (!record.id || !record.mode || !record.startedAt || !record.endedAt) return null;
  const points = Array.isArray(record.points) ? record.points : [];
  const durationSeconds = record.durationSeconds ?? Math.max(1, Math.floor((record.endedAt - record.startedAt) / 1000));
  const distance = record.distanceMeters ?? 0;
  return {
    id: record.id,
    mode: record.mode,
    plannedMinutes: record.plannedMinutes ?? 30,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    durationSeconds,
    distanceMeters: distance,
    averagePaceSecondsPerKm:
      record.averagePaceSecondsPerKm ?? (distance >= 100 ? durationSeconds / (distance / 1000) : null),
    completionRatio: record.completionRatio ?? durationSeconds / Math.max(60, (record.plannedMinutes ?? 30) * 60),
    xp: record.xp ?? 0,
    points,
    splits: record.splits ?? calculateKilometreSplits(points),
    bestEfforts: record.bestEfforts ?? calculateBestEfforts(points),
    personalBestKeys: record.personalBestKeys ?? []
  };
}

export function loadRunningProfile(): RunningProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return emptyProfile();
    const parsed = JSON.parse(raw) as Partial<RunningProfile>;
    const history = Array.isArray(parsed.history)
      ? parsed.history.map((record) => normaliseRecord(record)).filter((record): record is RunRecord => Boolean(record))
      : [];
    return {
      version: 2,
      credits: parsed.credits ?? 0,
      unlockedStoreIds: parsed.unlockedStoreIds ?? [],
      history,
      routePrivacyMeters: parsed.routePrivacyMeters ?? 200
    };
  } catch {
    return emptyProfile();
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

function sampleDistances(points: RunPoint[]) {
  let distance = 0;
  return points.map((point, index) => {
    if (typeof point.distanceFromStart === "number" && Number.isFinite(point.distanceFromStart)) {
      distance = Math.max(distance, point.distanceFromStart);
    } else if (index > 0) {
      const previous = points[index - 1];
      const segment = distanceMeters(previous, point);
      const elapsed = Math.max(1, (point.at - previous.at) / 1000);
      if (segment >= 2 && segment <= 120 && segment / elapsed <= 12) distance += segment;
    }
    return { point, distance };
  });
}

function timeAtDistance(samples: ReturnType<typeof sampleDistances>, target: number) {
  if (!samples.length || target < samples[0].distance || target > samples[samples.length - 1].distance) return null;
  for (let index = 1; index < samples.length; index += 1) {
    const before = samples[index - 1];
    const after = samples[index];
    if (after.distance < target) continue;
    const span = after.distance - before.distance;
    if (span <= 0) return after.point.at;
    const fraction = Math.min(1, Math.max(0, (target - before.distance) / span));
    return before.point.at + (after.point.at - before.point.at) * fraction;
  }
  return samples[samples.length - 1].point.at;
}

export function calculateKilometreSplits(points: RunPoint[]) {
  const samples = sampleDistances(points);
  if (samples.length < 2) return [];
  const total = samples[samples.length - 1].distance;
  const count = Math.floor(total / 1000);
  const firstAt = samples[0].point.at;
  const splits: RunSplit[] = [];
  let previousAt = firstAt;
  for (let index = 1; index <= count; index += 1) {
    const completedAt = timeAtDistance(samples, index * 1000);
    if (completedAt === null) break;
    const durationSeconds = Math.max(1, (completedAt - previousAt) / 1000);
    splits.push({
      index,
      distanceMeters: 1000,
      durationSeconds,
      paceSecondsPerKm: durationSeconds,
      completedAt
    });
    previousAt = completedAt;
  }
  return splits;
}

export function calculateBestEfforts(points: RunPoint[]) {
  const samples = sampleDistances(points);
  if (samples.length < 2) return [];
  const total = samples[samples.length - 1].distance;
  const efforts: RunBestEffort[] = [];

  for (const target of BEST_EFFORT_TARGETS) {
    if (total < target.distanceMeters) continue;
    let right = 1;
    let bestDuration = Number.POSITIVE_INFINITY;
    for (let left = 0; left < samples.length - 1; left += 1) {
      if (right <= left) right = left + 1;
      const targetDistance = samples[left].distance + target.distanceMeters;
      while (right < samples.length && samples[right].distance < targetDistance) right += 1;
      if (right >= samples.length) break;
      const before = samples[right - 1];
      const after = samples[right];
      const span = after.distance - before.distance;
      const fraction = span <= 0 ? 1 : Math.min(1, Math.max(0, (targetDistance - before.distance) / span));
      const endAt = before.point.at + (after.point.at - before.point.at) * fraction;
      const duration = Math.max(0.1, (endAt - samples[left].point.at) / 1000);
      if (duration < bestDuration) bestDuration = duration;
    }
    if (!Number.isFinite(bestDuration)) continue;
    efforts.push({
      key: target.key,
      label: target.label,
      distanceMeters: target.distanceMeters,
      durationSeconds: bestDuration,
      paceSecondsPerKm: bestDuration / (target.distanceMeters / 1000)
    });
  }

  return efforts;
}

export function personalBestKeysFor(efforts: RunBestEffort[], history: RunRecord[]) {
  return efforts
    .filter((effort) => {
      const previousBest = history
        .flatMap((record) => record.bestEfforts)
        .filter((item) => item.key === effort.key)
        .reduce((best, item) => Math.min(best, item.durationSeconds), Number.POSITIVE_INFINITY);
      return effort.durationSeconds < previousBest;
    })
    .map((effort) => effort.key);
}

export function compactRunPoints(points: RunPoint[], maxPoints = 900) {
  if (points.length <= maxPoints) return points;
  const result: RunPoint[] = [points[0]];
  const stride = (points.length - 1) / (maxPoints - 1);
  for (let index = 1; index < maxPoints - 1; index += 1) {
    result.push(points[Math.min(points.length - 2, Math.round(index * stride))]);
  }
  result.push(points[points.length - 1]);
  return result;
}

export function trimRouteForPrivacy(points: RunPoint[], hideMeters: number) {
  if (hideMeters <= 0 || points.length < 2) return points;
  const samples = sampleDistances(points);
  if (!samples.length) return points;
  const total = samples[samples.length - 1].distance;
  if (total <= hideMeters * 2 + 100) return points;
  return samples
    .filter((sample) => sample.distance >= hideMeters && sample.distance <= total - hideMeters)
    .map((sample) => sample.point);
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
