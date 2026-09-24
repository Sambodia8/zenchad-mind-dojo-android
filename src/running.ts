import { LEVEL_THRESHOLDS } from "./data";
import type { Stats } from "./types";
import { STORY_CHAPTER_IDS, type StoryChapterId } from "./runningStoryChapters";

export type RunMode = "quick" | "story" | "just";
export type RunStage = "briefing" | "prep" | "warmup" | "active" | "complete";
export type RunCompanionId = "katie" | "hana" | "rtr" | "yuna";

export interface RunCompanionDefinition {
  id: RunCompanionId;
  tag: string;
  name: string;
  detail: string;
}

export const RUN_COMPANIONS: readonly RunCompanionDefinition[] = [
  { id: "katie", tag: "@Katie", name: "Katie", detail: "Running buddy" },
  { id: "hana", tag: "@Hana", name: "Hana", detail: "Running buddy" },
  { id: "rtr", tag: "@RTR", name: "Run Talk Run", detail: "Running group" },
  { id: "yuna", tag: "@Yuna", name: "Yuna", detail: "Pet dog" }
] as const;

const RUN_COMPANION_IDS = new Set<RunCompanionId>(RUN_COMPANIONS.map((companion) => companion.id));
export type RunPrepStepId =
  | "phone"
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
  /** Degrees clockwise from true north when supplied by Android/GPS. */
  heading?: number | null;
  /** Provider road name matched from the route active when this point was accepted. */
  roadName?: string;
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
  version: 5;
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
  warmupStartedAt: number | null;
  runEndedAt: number | null;
  distanceMeters: number;
  points: RunPoint[];
  companionIds: RunCompanionId[];
  storyMissionId: string | null;
  storyHeardChapterIds: StoryChapterId[];
  runXp: number;
  checkpointAwards: Record<string, RunCheckpointReward>;
  checkpointXp: number;
  checkpointZenPoints: number;
  checkpointDice: number;
  distanceZenPointAwards: Record<string, RunDistanceZenPointReward>;
  distanceZenPoints: number;
  firstRunOfDayZenPoints: number;
  playerXpAtStart: number;
  playerLevelAtStart: number;
  completionLevelBefore: number | null;
  completionLevelAfter: number | null;
}

export interface RunDistanceZenPointReward {
  id: string;
  distanceMeters: number;
  zenPoints: number;
}

export interface RunCheckpointReward {
  id: "25" | "50" | "75" | "100";
  label: string;
  xp: number;
  zenPoints: number;
  dice: number;
}

export interface RunRecord {
  id: string;
  mode: RunMode;
  plannedMinutes: number;
  startedAt: number;
  endedAt: number;
  /** Wall-clock time between pressing start and banking the run, pauses included. */
  durationSeconds: number;
  /** Time represented by plausible moving GPS segments; never used to hide elapsed time. */
  movingSeconds: number;
  distanceMeters: number;
  averagePaceSecondsPerKm: number | null;
  completionRatio: number;
  xp: number;
  checkpointXp: number;
  zenPoints: number;
  dice: number;
  points: RunPoint[];
  companionIds: RunCompanionId[];
  splits: RunSplit[];
  bestEfforts: RunBestEffort[];
  personalBestKeys: RunBestEffortKey[];
  /** A completed run can be saved as a favourite route. Generated, unrun routes never enter history. */
  isFavorite: boolean;
  routeName: string;
  routeRoadNames: string[];
  routeNameSource?: "generated" | "user";
}

export interface RunRouteManeuver {
  routeDistanceMeters: number;
  streetNames?: string[];
  instruction?: string;
}

export interface RunningProfile {
  version: 5;
  credits: number;
  unlockedStoreIds: string[];
  history: RunRecord[];
  routePrivacyMeters: number;
  dice: number;
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

const RUN_CHECKPOINT_REWARDS: RunCheckpointReward[] = [
  { id: "25", label: "25%", xp: 2, zenPoints: 0, dice: 0 },
  { id: "50", label: "50%", xp: 3, zenPoints: 0, dice: 1 },
  { id: "75", label: "75%", xp: 4, zenPoints: 0, dice: 0 },
  { id: "100", label: "Plan complete", xp: 6, zenPoints: 0, dice: 1 }
];

export const RUN_DISTANCE_ZEN_POINT_REWARDS: RunDistanceZenPointReward[] = [
  { id: "100m", distanceMeters: 100, zenPoints: 1 },
  { id: "300m", distanceMeters: 300, zenPoints: 1 },
  { id: "750m", distanceMeters: 750, zenPoints: 1 },
  { id: "1.25km", distanceMeters: 1250, zenPoints: 1 },
  { id: "2km", distanceMeters: 2000, zenPoints: 1 },
  { id: "2.75km", distanceMeters: 2750, zenPoints: 1 },
  { id: "3.75km", distanceMeters: 3750, zenPoints: 1 },
  { id: "5km", distanceMeters: 5000, zenPoints: 1 }
];

export const FIRST_RUN_OF_DAY_ZEN_POINTS = 3;

export const RUN_PREP_STEPS: RunPrepStep[] = [
  {
    id: "phone",
    title: "Charge / plug in phone",
    instruction: "Plug in the phone now so it has enough charge for the run.",
    targetSeconds: 60,
    graceSeconds: 60,
    baseXp: 2,
    bonusXp: 2,
    buttonLabel: "Phone charging",
    speedBonus: true
  },
  {
    id: "headphones",
    title: "Headphones",
    instruction: "Check your headphones have enough charge for the whole run. Story Mode depends on them.",
    targetSeconds: 60,
    graceSeconds: 60,
    baseXp: 2,
    bonusXp: 2,
    buttonLabel: "Headphones charged",
    speedBonus: true
  },
  {
    id: "clothes",
    title: "Getting Dressed",
    instruction: "Get changed into the outfit you actually want to run in. Don't forget socks.",
    targetSeconds: 4 * 60,
    graceSeconds: 4 * 60,
    baseXp: 4,
    bonusXp: 2,
    buttonLabel: "Dressed",
    speedBonus: true
  },
  {
    id: "water",
    title: "Water",
    instruction: "Get water sorted before the stretches so there is one less thing to remember afterwards.",
    targetSeconds: 2 * 60,
    graceSeconds: 2 * 60,
    baseXp: 3,
    bonusXp: 2,
    buttonLabel: "Water ready",
    speedBonus: true
  },
  {
    id: "shoes",
    title: "Running shoes",
    instruction: "Shoes on. You are almost out of the door.",
    targetSeconds: 90,
    graceSeconds: 90,
    baseXp: 3,
    bonusXp: 1,
    buttonLabel: "Shoes on",
    speedBonus: true
  },
  {
    id: "outside",
    title: "Get outside",
    instruction: "Head outside. You will get a short warm-up walk before the run timer starts.",
    targetSeconds: 3 * 60,
    graceSeconds: 3 * 60,
    baseXp: 3,
    bonusXp: 2,
    buttonLabel: "Outside",
    speedBonus: true
  },
  {
    id: "stretches",
    title: "Dynamic warm-up",
    instruction: "Do the short running warm-up here at your start point. There is no speed bonus: move comfortably and take your time.",
    targetSeconds: 0,
    graceSeconds: 0,
    baseXp: 3,
    bonusXp: 0,
    buttonLabel: "Warm-up done",
    speedBonus: false
  }
];

const emptyProfile = (): RunningProfile => ({
  version: 5,
  credits: 0,
  unlockedStoreIds: [],
  history: [],
  routePrivacyMeters: 200,
  dice: 0
});

export function createRunSession(
  mode: RunMode,
  plannedMinutes: number,
  now = Date.now(),
  playerXpAtStart = 0,
  playerLevelAtStart = levelForXp(playerXpAtStart)
): RunSession {
  return {
    version: 5,
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
    warmupStartedAt: null,
    runEndedAt: null,
    distanceMeters: 0,
    points: [],
    companionIds: [],
    storyMissionId: null,
    storyHeardChapterIds: [],
    runXp: 0,
    checkpointAwards: {},
    checkpointXp: 0,
    checkpointZenPoints: 0,
    checkpointDice: 0,
    distanceZenPointAwards: {},
    distanceZenPoints: 0,
    firstRunOfDayZenPoints: 0,
    playerXpAtStart: Math.max(0, Number.isFinite(playerXpAtStart) ? playerXpAtStart : 0),
    playerLevelAtStart: Math.max(1, Number.isFinite(playerLevelAtStart) ? Math.floor(playerLevelAtStart) : 1),
    completionLevelBefore: null,
    completionLevelAfter: null
  };
}

export function isDarkRunPreparationTime(at: Date | number = Date.now()) {
  const hour = (at instanceof Date ? at : new Date(at)).getHours();
  return hour < 7 || hour >= 19;
}

export function prepStepInstruction(step: RunPrepStep, at: Date | number = Date.now()) {
  if (step.id !== "phone" || !isDarkRunPreparationTime(at)) return step.instruction;
  return `${step.instruction} It is dark or getting dark, so charge and check the torch too.`;
}

export function restartRunPreparation(session: RunSession, now = Date.now()) {
  return {
    ...createRunSession(session.mode, session.plannedMinutes, now, session.playerXpAtStart, session.playerLevelAtStart),
    storyMissionId: session.storyMissionId,
    storyHeardChapterIds: session.storyHeardChapterIds,
    stage: "prep" as const
  };
}

export function loadRunSession(): RunSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RunSession> & { version?: number };
    if (
      typeof parsed.id !== "string" ||
      !["quick", "story", "just"].includes(parsed.mode ?? "") ||
      !["briefing", "prep", "warmup", "active", "complete"].includes(parsed.stage ?? "")
    ) return null;
    const finiteNonNegative = (value: unknown, fallback = 0) =>
      typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : fallback;
    const points = normaliseRunPoints(parsed.points);
    const defaults = createRunSession(
      parsed.mode as RunMode,
      finiteNonNegative(parsed.plannedMinutes, 30),
      finiteNonNegative(parsed.createdAt, Date.now()),
      finiteNonNegative(parsed.playerXpAtStart, 0),
      finiteNonNegative(parsed.playerLevelAtStart, 1)
    );
    return {
      ...defaults,
      ...parsed,
      version: 5,
      plannedMinutes: Math.max(1, finiteNonNegative(parsed.plannedMinutes, 30)),
      createdAt: finiteNonNegative(parsed.createdAt, defaults.createdAt),
      stepStartedAt: finiteNonNegative(parsed.stepStartedAt, defaults.stepStartedAt),
      prepStepIndex: Math.min(RUN_PREP_STEPS.length - 1, Math.floor(finiteNonNegative(parsed.prepStepIndex))),
      prepAwards: parsed.prepAwards && typeof parsed.prepAwards === "object" ? parsed.prepAwards : {},
      prepXp: finiteNonNegative(parsed.prepXp),
      runStartedAt: finiteNonNegative(parsed.runStartedAt) || null,
      warmupStartedAt: finiteNonNegative(parsed.warmupStartedAt) || null,
      runEndedAt: finiteNonNegative(parsed.runEndedAt) || null,
      distanceMeters: finiteNonNegative(parsed.distanceMeters),
      points,
      companionIds: normaliseRunCompanionIds(parsed.companionIds),
      storyMissionId: parsed.mode === "story" && typeof parsed.storyMissionId === "string" ? parsed.storyMissionId : null,
      storyHeardChapterIds: parsed.mode === "story" && Array.isArray(parsed.storyHeardChapterIds)
        ? STORY_CHAPTER_IDS.filter((chapterId) => parsed.storyHeardChapterIds?.includes(chapterId))
        : [],
      runXp: finiteNonNegative(parsed.runXp),
      checkpointAwards: parsed.checkpointAwards && typeof parsed.checkpointAwards === "object" ? parsed.checkpointAwards : {},
      checkpointXp: finiteNonNegative(parsed.checkpointXp),
      checkpointZenPoints: finiteNonNegative(parsed.checkpointZenPoints),
      checkpointDice: finiteNonNegative(parsed.checkpointDice),
      distanceZenPointAwards: parsed.distanceZenPointAwards && typeof parsed.distanceZenPointAwards === "object" ? parsed.distanceZenPointAwards : {},
      distanceZenPoints: finiteNonNegative(parsed.distanceZenPoints),
      firstRunOfDayZenPoints: finiteNonNegative(parsed.firstRunOfDayZenPoints),
      playerXpAtStart: finiteNonNegative(parsed.playerXpAtStart),
      playerLevelAtStart: Math.max(1, Math.floor(finiteNonNegative(parsed.playerLevelAtStart, 1))),
      completionLevelBefore: finiteNonNegative(parsed.completionLevelBefore) || null,
      completionLevelAfter: finiteNonNegative(parsed.completionLevelAfter) || null
    };
  } catch {
    return null;
  }
}

function normaliseRunPoints(value: unknown): RunPoint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const point = candidate as Partial<RunPoint>;
    if (
      !Number.isFinite(point.lat) || !Number.isFinite(point.lng) ||
      !Number.isFinite(point.at) || !Number.isFinite(point.accuracy) ||
      Math.abs(point.lat as number) > 90 || Math.abs(point.lng as number) > 180 ||
      (point.accuracy as number) < 0
    ) return [];
    return [{
      lat: point.lat as number,
      lng: point.lng as number,
      at: point.at as number,
      accuracy: point.accuracy as number,
      ...(Number.isFinite(point.distanceFromStart) ? { distanceFromStart: Math.max(0, point.distanceFromStart as number) } : {}),
      ...(Number.isFinite(point.heading) ? { heading: point.heading as number } : {}),
      ...(typeof point.roadName === "string" ? { roadName: point.roadName.slice(0, 120) } : {})
    }];
  }).sort((a, b) => a.at - b.at).slice(-4000);
}

export function normaliseRunCompanionIds(value: unknown): RunCompanionId[] {
  if (!Array.isArray(value)) return [];
  const selected = new Set(
    value.filter((candidate): candidate is RunCompanionId =>
      typeof candidate === "string" && RUN_COMPANION_IDS.has(candidate as RunCompanionId)
    )
  );
  return RUN_COMPANIONS.filter((companion) => selected.has(companion.id)).map((companion) => companion.id);
}

/** A persisted Story callback is only valid while its own Story session is active. */
export function acceptsStoryCallback(session: Pick<RunSession, "id" | "mode" | "stage"> | null, expectedSessionId?: string) {
  return Boolean(session && session.mode === "story" && session.stage === "active" && (!expectedSessionId || session.id === expectedSessionId));
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
  const points = normaliseRunPoints(record.points);
  const durationSeconds = Number.isFinite(record.durationSeconds)
    ? Math.max(1, record.durationSeconds as number)
    : Math.max(1, Math.floor((record.endedAt - record.startedAt) / 1000));
  const distance = Number.isFinite(record.distanceMeters) ? Math.max(0, record.distanceMeters as number) : 0;
  return {
    id: record.id,
    mode: record.mode,
    plannedMinutes: record.plannedMinutes ?? 30,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    durationSeconds,
    movingSeconds: record.movingSeconds ?? calculateMovingSeconds(points),
    distanceMeters: distance,
    averagePaceSecondsPerKm:
      record.averagePaceSecondsPerKm ?? (distance >= 100 ? durationSeconds / (distance / 1000) : null),
    completionRatio: record.completionRatio ?? durationSeconds / Math.max(60, (record.plannedMinutes ?? 30) * 60),
    xp: record.xp ?? 0,
    checkpointXp: record.checkpointXp ?? 0,
    zenPoints: record.zenPoints ?? 0,
    dice: record.dice ?? 0,
    points,
    companionIds: normaliseRunCompanionIds(record.companionIds),
    splits: record.splits ?? calculateKilometreSplits(points),
    bestEfforts: record.bestEfforts ?? calculateBestEfforts(points),
    personalBestKeys: record.personalBestKeys ?? [],
    isFavorite: record.isFavorite ?? false,
    routeName: record.routeName?.trim() || "Recorded route",
    routeRoadNames: Array.isArray(record.routeRoadNames) ? record.routeRoadNames.filter((name): name is string => typeof name === "string") : [],
    routeNameSource: record.routeNameSource === "user" ? "user" : "generated"
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
      version: 5,
      credits: Number.isFinite(parsed.credits) ? Math.max(0, parsed.credits as number) : 0,
      unlockedStoreIds: Array.isArray(parsed.unlockedStoreIds) ? parsed.unlockedStoreIds.filter((id): id is string => typeof id === "string") : [],
      history,
      routePrivacyMeters: parsed.routePrivacyMeters ?? 200,
      dice: Number.isFinite(parsed.dice) ? Math.max(0, parsed.dice as number) : 0
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

export function completeRunPrepStep(session: RunSession, now = Date.now()) {
  if (session.stage !== "prep") return null;
  const step = RUN_PREP_STEPS[session.prepStepIndex];
  if (!step || session.prepAwards[step.id] !== undefined) return null;

  const elapsed = Math.max(0, (now - session.stepStartedAt) / 1000);
  const xp = prepStepXp(step, elapsed);
  const isLast = session.prepStepIndex === RUN_PREP_STEPS.length - 1;
  const startBonus = isLast ? 3 : 0;
  const next: RunSession = {
    ...session,
    prepAwards: {
      ...session.prepAwards,
      [step.id]: xp,
      ...(isLast ? { "run-start": startBonus } : {})
    },
    prepXp: session.prepXp + xp + startBonus,
    prepStepIndex: isLast ? session.prepStepIndex : session.prepStepIndex + 1,
    stepStartedAt: now,
    stage: isLast ? "warmup" : "prep",
    warmupStartedAt: isLast ? now : session.warmupStartedAt
  };
  return { next, step, xp, startBonus, isLast };
}

export function skipRunPrepStep(session: RunSession, now = Date.now()) {
  if (session.stage !== "prep") return null;
  const step = RUN_PREP_STEPS[session.prepStepIndex];
  if (!step || session.prepAwards[step.id] !== undefined) return null;
  const isLast = session.prepStepIndex === RUN_PREP_STEPS.length - 1;
  const next: RunSession = {
    ...session,
    prepAwards: { ...session.prepAwards, [step.id]: 0 },
    prepStepIndex: isLast ? session.prepStepIndex : session.prepStepIndex + 1,
    stepStartedAt: now,
    stage: isLast ? "warmup" : "prep",
    warmupStartedAt: isLast ? now : session.warmupStartedAt
  };
  return { next, step, isLast };
}

export function skipRemainingRunPreparation(session: RunSession, now = Date.now()) {
  if (session.stage !== "prep") return null;
  const skippedAwards = Object.fromEntries(
    RUN_PREP_STEPS.slice(session.prepStepIndex).map((step) => [step.id, 0])
  );
  return {
    ...session,
    prepAwards: { ...session.prepAwards, ...skippedAwards },
    prepStepIndex: RUN_PREP_STEPS.length - 1,
    stepStartedAt: now,
    stage: "warmup" as const,
    warmupStartedAt: now
  };
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

function plausibleIncrement(distance: number, elapsedSeconds: number) {
  return Number.isFinite(distance)
    && distance >= 0
    && elapsedSeconds > 0
    && distance <= Math.min(120, elapsedSeconds * 8);
}

function sampleDistances(points: RunPoint[]) {
  let distance = 0;
  return points.map((point, index) => {
    if (index > 0) {
      const previous = points[index - 1];
      const elapsed = (point.at - previous.at) / 1000;
      const reported = typeof point.distanceFromStart === "number" && typeof previous.distanceFromStart === "number"
        ? point.distanceFromStart - previous.distanceFromStart
        : null;
      const geometric = distanceMeters(previous, point);
      // Prefer the persisted tracker total when it advances plausibly. Older records
      // fall back to geometry, but neither path accepts a teleport or a backwards fix.
      if (reported !== null && plausibleIncrement(reported, elapsed)) distance += reported;
      else if (geometric >= 2 && plausibleIncrement(geometric, elapsed)) distance += geometric;
    }
    return { point, distance };
  });
}

export function calculateMovingSeconds(points: RunPoint[]) {
  const samples = sampleDistances(points);
  let movingSeconds = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const before = samples[index - 1];
    const after = samples[index];
    const elapsed = (after.point.at - before.point.at) / 1000;
    const distance = after.distance - before.distance;
    const speed = distance / Math.max(1, elapsed);
    // A long, slow jump after a coffee stop is not secretly moving time. We only
    // bank intervals that are both fresh and plausible running/walking movement.
    if (elapsed > 0 && elapsed <= 45 && distance >= 4 && speed >= 0.5 && speed <= 8) {
      movingSeconds += elapsed;
    }
  }
  return Math.round(movingSeconds);
}

function usableRoadName(value: string) {
  const name = value.replace(/\s+/g, " ").trim();
  return name.length >= 2 && !/^(continue|destination|the route|unnamed road|road)$/i.test(name) ? name : null;
}

function roadNameFromManeuver(maneuver: RunRouteManeuver) {
  const namedStreet = maneuver.streetNames?.map(usableRoadName).find((name): name is string => Boolean(name));
  if (namedStreet) return namedStreet;
  const instruction = maneuver.instruction ?? "";
  const match = instruction.match(/\b(?:onto|on|toward|towards)\s+(.+?)(?:[.,;]|$)/i);
  return match ? usableRoadName(match[1].replace(/\b(?:the|a)\s+(?:route|destination)$/i, "")) : null;
}

/** Builds a human route name from real provider maneuvers closest to the route's thirds. */
export function routeNameFromManeuvers(maneuvers: RunRouteManeuver[], routeDistanceMeters = 0) {
  const named = maneuvers
    .map((maneuver) => ({ distance: Math.max(0, maneuver.routeDistanceMeters || 0), name: roadNameFromManeuver(maneuver) }))
    .filter((item): item is { distance: number; name: string } => Boolean(item.name));
  if (!named.length) return { routeName: "Recorded route", roadNames: [] as string[] };
  const total = Math.max(routeDistanceMeters, ...named.map((item) => item.distance), 1);
  const selected: string[] = [];
  for (const fraction of [0, 1 / 3, 2 / 3]) {
    const closest = named.reduce((best, item) =>
      Math.abs(item.distance - total * fraction) < Math.abs(best.distance - total * fraction) ? item : best
    );
    if (!selected.some((name) => name.localeCompare(closest.name, undefined, { sensitivity: "accent" }) === 0)) selected.push(closest.name);
  }
  return { routeName: selected.length ? selected.join(" · ") : "Recorded route", roadNames: selected };
}

/** Names only roads represented by accepted measured-run points, never untravelled plan legs. */
export function routeNameFromRunPoints(points: RunPoint[]) {
  const named = points.flatMap((point) => {
    const name = usableRoadName(point.roadName ?? "");
    return name ? [{ distance: Math.max(0, point.distanceFromStart ?? 0), name }] : [];
  });
  if (!named.length) return { routeName: "Recorded route", roadNames: [] as string[] };
  const total = Math.max(points.at(-1)?.distanceFromStart ?? 0, ...named.map((item) => item.distance), 1);
  const selected: string[] = [];
  for (const fraction of [0, 1 / 3, 2 / 3]) {
    const closest = named.reduce((best, item) =>
      Math.abs(item.distance - total * fraction) < Math.abs(best.distance - total * fraction) ? item : best
    );
    if (!selected.some((name) => name.localeCompare(closest.name, undefined, { sensitivity: "accent" }) === 0)) selected.push(closest.name);
  }
  return { routeName: selected.join(" · ") || "Recorded route", roadNames: selected };
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
  // Genuine runs receive an early-game-friendly completion base. Very short GPS
  // tests still receive only their small time/distance amount.
  const safeMinutes = Math.min(Math.floor(Math.max(0, durationSeconds) / 60), Math.max(20, plannedMinutes));
  const timeXp = safeMinutes;
  const distanceXp = Math.min(30, Math.floor(Math.max(0, distance) / 500) * 5);
  const completionBase = safeMinutes >= 8 ? 25 : 0;
  return completionBase + timeXp + distanceXp;
}

export function checkpointRewardsForProgress(progress: number, awarded: Record<string, RunCheckpointReward> = {}) {
  const safeProgress = Math.max(0, progress);
  return RUN_CHECKPOINT_REWARDS.filter((reward) => safeProgress >= Number(reward.id) / 100 && !awarded[reward.id]);
}

export function distanceZenPointRewardsForProgress(
  distance: number,
  awarded: Record<string, RunDistanceZenPointReward> = {}
) {
  const safeDistance = Math.max(0, Number.isFinite(distance) ? distance : 0);
  return RUN_DISTANCE_ZEN_POINT_REWARDS.filter((reward) => safeDistance >= reward.distanceMeters && !awarded[reward.id]);
}

function localRunDay(at: number) {
  const date = new Date(at);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function firstRunOfDayZenPoints(history: RunRecord[], endedAt = Date.now()) {
  const day = localRunDay(endedAt);
  const alreadyCompletedToday = history.some((record) => localRunDay(record.endedAt) === day);
  return alreadyCompletedToday ? 0 : FIRST_RUN_OF_DAY_ZEN_POINTS;
}

export function rollingPaceSecondsPerKm(points: RunPoint[], now = Date.now(), windowSeconds = 30) {
  if (points.length < 2) return null;
  const latest = points[points.length - 1];
  if (now - latest.at > 15_000) return null;
  const cutoff = latest.at - windowSeconds * 1000;
  let first = points[0];
  for (const point of points) {
    if (point.at <= cutoff) first = point;
    else break;
  }
  const startDistance = first.distanceFromStart ?? 0;
  const endDistance = latest.distanceFromStart ?? startDistance;
  const distance = Math.max(0, endDistance - startDistance);
  const elapsedSeconds = Math.max(0, (latest.at - first.at) / 1000);
  // Small movement over a full window is treated as a stop, not a wildly slow pace.
  if (elapsedSeconds < 8 || (elapsedSeconds >= 20 && distance < 12)) return null;
  const speed = distance / elapsedSeconds;
  if (speed < 0.75 || speed > 7) return null;
  return 1000 / speed;
}

export function adaptiveRunPlan(history: RunRecord[], durations = [20, 30, 45, 60]) {
  const completed = history
    .filter((run) => run.durationSeconds >= 8 * 60 && run.distanceMeters >= 500)
    .slice(0, 8);
  if (!completed.length) return { recommendedMinutes: 20, expectedDistanceMeters: null, source: "starter" as const };
  const byDuration = [...completed].sort((a, b) => a.durationSeconds - b.durationSeconds);
  const median = byDuration[Math.floor(byDuration.length / 2)];
  const sustainableMinutes = Math.max(20, Math.floor((median.durationSeconds / 60) * 0.85));
  const recommendedMinutes = durations.reduce((closest, minutes) =>
    Math.abs(minutes - sustainableMinutes) < Math.abs(closest - sustainableMinutes) ? minutes : closest
  );
  const metresPerMinute = median.distanceMeters / Math.max(1, median.durationSeconds / 60);
  return {
    recommendedMinutes,
    expectedDistanceMeters: Math.round(metresPerMinute * recommendedMinutes / 100) * 100,
    source: "history" as const
  };
}

export function levelForXp(xp: number) {
  const safeXp = Math.max(0, Number.isFinite(xp) ? xp : 0);
  const nextThreshold = LEVEL_THRESHOLDS.findIndex((threshold) => safeXp < threshold);
  return nextThreshold === -1 ? LEVEL_THRESHOLDS.length : Math.max(1, nextThreshold);
}

export function addRunningXp(stats: Stats, amount: number): Stats {
  const xp = Math.max(0, Number.isFinite(stats.xp) ? stats.xp : 0) + Math.max(0, Number.isFinite(amount) ? amount : 0);
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
