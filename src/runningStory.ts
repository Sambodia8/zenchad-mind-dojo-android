export type ChaseDifficulty = "casual" | "standard" | "intense";
export type StoryThreat = "runner" | "police" | "helicopter";
export type StoryAnchorKind =
  | "open"
  | "cover"
  | "landmark"
  | "junction"
  | "road-crossing"
  | "steep-descent"
  | "stairs"
  | "neutral";

export interface StoryRouteAnchor {
  id: string;
  kind: StoryAnchorKind;
  distanceMeters: number;
  confidence: number;
  label?: string;
}

export interface ChasePlacementContext {
  anchor?: StoryRouteAnchor | null;
  atJunction?: boolean;
  atRoadCrossing?: boolean;
  onSteepDescent?: boolean;
  onStairs?: boolean;
}

export interface ChasePerformanceContext {
  difficulty: ChaseDifficulty;
  recentSpeedMps: number;
  elapsedRunSeconds: number;
  plannedRunSeconds: number;
  previousChases: Array<{
    targetSpeedMps: number;
    achievedSpeedMps: number;
  }>;
}

export interface ChaseTarget {
  targetSpeedMps: number;
  increaseFraction: number;
  suggestedDurationSeconds: number;
  intensityLabel: string;
}

export type ChaseOutcomeKind = "escaped" | "pressure" | "caught-branch";

export interface ChaseOutcome {
  kind: ChaseOutcomeKind;
  performanceRatio: number;
  narrativeInstruction: string;
  xpPenalty: 0;
}

export interface StorySetPiece {
  id: string;
  threat: StoryThreat;
  startDistanceMeters: number;
  targetDistanceMeters?: number;
  targetAnchorId?: string;
  cue: string;
  successCue: string;
}

export interface StoryDirectorBudget {
  maxCalls: number;
  usedCalls: number;
}

const CHASE_MULTIPLIER: Record<ChaseDifficulty, number> = {
  casual: 1.08,
  standard: 1.15,
  intense: 1.22
};

const CHASE_DURATION: Record<ChaseDifficulty, number> = {
  casual: 35,
  standard: 45,
  intense: 55
};

const BAD_ACCELERATION_ANCHORS = new Set<StoryAnchorKind>([
  "junction",
  "road-crossing",
  "steep-descent",
  "stairs"
]);

export const DEFAULT_STORY_AI_BUDGET = 4;

export function canTriggerChase(context: ChasePlacementContext) {
  if (context.atJunction || context.atRoadCrossing || context.onSteepDescent || context.onStairs) {
    return false;
  }
  if (context.anchor && BAD_ACCELERATION_ANCHORS.has(context.anchor.kind)) return false;
  return true;
}

export function chaseTarget(context: ChasePerformanceContext): ChaseTarget {
  const safeRecentSpeed = Math.max(1.2, context.recentSpeedMps);
  const baseIncrease = CHASE_MULTIPLIER[context.difficulty] - 1;
  const planned = Math.max(60, context.plannedRunSeconds);
  const runProgress = Math.max(0, context.elapsedRunSeconds / planned);

  // The longer the run has already gone, the less aggressively the chase asks for another surge.
  const fatigueAdjustment = Math.min(0.055, Math.max(0, runProgress - 0.45) * 0.08);

  let historyAdjustment = 0;
  if (context.previousChases.length) {
    const recent = context.previousChases.slice(-3);
    const averageRatio = recent.reduce((sum, chase) => {
      return sum + chase.achievedSpeedMps / Math.max(0.1, chase.targetSpeedMps);
    }, 0) / recent.length;

    if (averageRatio < 0.88) historyAdjustment = -0.035;
    else if (averageRatio > 1.08) historyAdjustment = 0.025;
  }

  const increaseFraction = Math.max(0.05, baseIncrease - fatigueAdjustment + historyAdjustment);
  const targetSpeedMps = safeRecentSpeed * (1 + increaseFraction);
  const durationAdjustment = runProgress > 0.8 ? -10 : runProgress < 0.25 ? 5 : 0;

  return {
    targetSpeedMps,
    increaseFraction,
    suggestedDurationSeconds: Math.max(20, CHASE_DURATION[context.difficulty] + durationAdjustment),
    intensityLabel: `${Math.round(increaseFraction * 100)}% pace surge`
  };
}

export function evaluateChase(targetSpeedMps: number, achievedSpeedMps: number): ChaseOutcome {
  const ratio = Math.max(0, achievedSpeedMps / Math.max(0.1, targetSpeedMps));

  if (ratio >= 0.95) {
    return {
      kind: "escaped",
      performanceRatio: ratio,
      narrativeInstruction: "Resolve the pursuit cleanly and let the player keep moving.",
      xpPenalty: 0
    };
  }

  if (ratio >= 0.78) {
    return {
      kind: "pressure",
      performanceRatio: ratio,
      narrativeInstruction: "The pursuer gains ground. Increase tension and branch into a pressured escape without removing XP.",
      xpPenalty: 0
    };
  }

  return {
    kind: "caught-branch",
    performanceRatio: ratio,
    narrativeInstruction: "Treat this as a story branch: interception, forced reroute, cover, or another complication. Never frame it as exercise failure.",
    xpPenalty: 0
  };
}

export function chooseCoverAnchor(
  anchors: StoryRouteAnchor[],
  currentDistanceMeters: number,
  maxLookAheadMeters = 900
) {
  return anchors
    .filter((anchor) =>
      anchor.kind === "cover" &&
      anchor.confidence >= 0.65 &&
      anchor.distanceMeters > currentDistanceMeters + 80 &&
      anchor.distanceMeters <= currentDistanceMeters + maxLookAheadMeters
    )
    .sort((a, b) => a.distanceMeters - b.distanceMeters)[0] ?? null;
}

export function buildHelicopterSetPiece(
  anchors: StoryRouteAnchor[],
  currentDistanceMeters: number
): StorySetPiece | null {
  const cover = chooseCoverAnchor(anchors, currentDistanceMeters);
  if (!cover) return null;

  return {
    id: `helicopter-${Math.round(currentDistanceMeters)}-${cover.id}`,
    threat: "helicopter",
    startDistanceMeters: currentDistanceMeters,
    targetDistanceMeters: cover.distanceMeters,
    targetAnchorId: cover.id,
    cue: "Helicopter has visual. Keep running and reach cover ahead.",
    successCue: "Cover reached. Helicopter visual broken. Keep moving."
  };
}

export function createStoryDirectorBudget(maxCalls = DEFAULT_STORY_AI_BUDGET): StoryDirectorBudget {
  return { maxCalls: Math.max(0, Math.floor(maxCalls)), usedCalls: 0 };
}

export function reserveStoryAiCall(budget: StoryDirectorBudget) {
  if (budget.usedCalls >= budget.maxCalls) return null;
  return { ...budget, usedCalls: budget.usedCalls + 1 };
}

export function shouldAskLiveDirector(reason: string) {
  return [
    "major-off-route",
    "planned-set-piece-unavailable",
    "campaign-branch",
    "generated-dialogue-needed"
  ].includes(reason);
}

export function routeAnchorAllowsShortcut(anchor: StoryRouteAnchor | null | undefined) {
  // The route engine must not invent a shortcut from uncertain map interpretation.
  return Boolean(anchor && anchor.confidence >= 0.8);
}
