import { getQwenJournalStatus, generateQwenJournalDraft, isNativeAndroid } from "./native";
import type { StoryMissionDefinition } from "./runningCampaign";
import { DEFAULT_STORY_AI_BUDGET } from "./runningStory";

export type RunningDirectorReason =
  | "major-off-route"
  | "planned-set-piece-unavailable"
  | "campaign-branch"
  | "generated-dialogue-needed";

export interface RunningDirectorContext {
  sessionId: string;
  reason: RunningDirectorReason;
  mission: StoryMissionDefinition;
  elapsedMinutes: number;
  plannedMinutes: number;
  distanceKm: number;
  recentOutcome?: "escaped" | "pressure" | "caught-branch" | "";
  rerouteCount?: number;
  nearbyFeatures?: string[];
}

export interface RunningDirectorResponse {
  source: "local-ai" | "deterministic";
  radioTitle: string;
  radioLine: string;
  branchTag: string;
}

interface DirectorBudgetState {
  version: 1;
  sessionId: string;
  usedCalls: number;
  maxCalls: number;
  cache: Record<string, RunningDirectorResponse>;
}

const STORAGE_KEY = "zenchad_running_ai_director_v1";

function freshBudget(sessionId: string): DirectorBudgetState {
  return { version: 1, sessionId, usedCalls: 0, maxCalls: DEFAULT_STORY_AI_BUDGET, cache: {} };
}

function loadBudget(sessionId: string) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshBudget(sessionId);
    const parsed = JSON.parse(raw) as DirectorBudgetState;
    if (parsed?.version !== 1 || parsed.sessionId !== sessionId) return freshBudget(sessionId);
    return {
      ...parsed,
      usedCalls: Math.max(0, parsed.usedCalls ?? 0),
      maxCalls: Math.max(0, parsed.maxCalls ?? DEFAULT_STORY_AI_BUDGET),
      cache: parsed.cache ?? {}
    };
  } catch {
    return freshBudget(sessionId);
  }
}

function saveBudget(state: DirectorBudgetState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function cacheKey(context: RunningDirectorContext) {
  const outcome = context.recentOutcome || "none";
  const rerouteBand = Math.min(4, Math.max(0, context.rerouteCount ?? 0));
  return `${context.mission.id}:${context.reason}:${outcome}:r${rerouteBand}`;
}

function deterministicFallback(context: RunningDirectorContext): RunningDirectorResponse {
  if (context.reason === "major-off-route") {
    return {
      source: "deterministic",
      radioTitle: "CHANGE OF PLAN",
      radioLine: "Route changed. Keep moving — I'm rebuilding the mission around you.",
      branchTag: "reroute"
    };
  }
  if (context.reason === "planned-set-piece-unavailable") {
    return {
      source: "deterministic",
      radioTitle: "WINDOW CLOSED",
      radioLine: "That route option is gone. Stay moving; we'll use the next opening.",
      branchTag: "set-piece-skip"
    };
  }
  if (context.reason === "campaign-branch") {
    const line = context.recentOutcome === "caught-branch"
      ? "They changed the board on us. Keep moving. This branch is still live."
      : context.recentOutcome === "pressure"
        ? "They're still in the picture. Don't force the pace — we'll make the route do the work."
        : "Good. That changed what they think we're doing. Keep moving.";
    return { source: "deterministic", radioTitle: "MISSION UPDATED", radioLine: line, branchTag: context.recentOutcome || "branch" };
  }
  return {
    source: "deterministic",
    radioTitle: context.mission.contact.toUpperCase(),
    radioLine: "You're making good ground. Keep the line moving.",
    branchTag: "ambient"
  };
}

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Partial<RunningDirectorResponse>;
  } catch {
    return null;
  }
}

function validResponse(candidate: Partial<RunningDirectorResponse> | null): RunningDirectorResponse | null {
  if (!candidate) return null;
  if (typeof candidate.radioTitle !== "string" || typeof candidate.radioLine !== "string" || typeof candidate.branchTag !== "string") return null;
  const title = candidate.radioTitle.trim().slice(0, 42);
  const line = candidate.radioLine.trim().slice(0, 220);
  const branchTag = candidate.branchTag.trim().slice(0, 36);
  if (!title || !line || !branchTag) return null;
  return { source: "local-ai", radioTitle: title, radioLine: line, branchTag };
}

function promptFor(context: RunningDirectorContext) {
  const features = (context.nearbyFeatures ?? []).slice(0, 6).join(", ") || "none supplied";
  return [
    "You are a terse audio game director for Zenchad Story Run.",
    "The player is physically running. Never shame exercise performance. Never tell them to stop, inspect the phone, trespass, take a shortcut, cross a road, or suddenly accelerate.",
    "Navigation is handled separately. Do not give turn directions.",
    "Write ONE short radio line that preserves momentum and adapts the fiction.",
    `Mission: ${context.mission.title}. Objective: ${context.mission.objective}`,
    `Contact: ${context.mission.contact}. Reason: ${context.reason}.`,
    `Run: ${context.elapsedMinutes.toFixed(1)}/${context.plannedMinutes} min, ${context.distanceKm.toFixed(1)} km.`,
    `Recent chase outcome: ${context.recentOutcome || "none"}. Reroutes: ${context.rerouteCount ?? 0}.`,
    `Mapped nearby features: ${features}.`,
    "Return JSON only: {\"radioTitle\":\"MAX 5 WORDS\",\"radioLine\":\"MAX 30 WORDS\",\"branchTag\":\"short-tag\"}"
  ].join("\n");
}

export async function requestRunningDirector(context: RunningDirectorContext): Promise<RunningDirectorResponse> {
  const fallback = deterministicFallback(context);
  const budget = loadBudget(context.sessionId);
  const key = cacheKey(context);
  if (budget.cache[key]) return budget.cache[key];
  if (!isNativeAndroid() || budget.usedCalls >= budget.maxCalls) return fallback;

  try {
    const status = await getQwenJournalStatus();
    if (!status.modelInstalled) return fallback;

    // Reserve before generation. A timeout/crash still consumes the slot so retries can never explode cost/battery use.
    const reserved = { ...budget, usedCalls: budget.usedCalls + 1 };
    saveBudget(reserved);
    const generation = await Promise.race([
      generateQwenJournalDraft(promptFor(context), 160),
      new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("director-timeout")), 12_000))
    ]);
    const response = validResponse(extractJson(generation.output));
    if (!response) return fallback;
    const next = loadBudget(context.sessionId);
    next.cache[key] = response;
    saveBudget(next);
    return response;
  } catch {
    return fallback;
  }
}

export function runningDirectorBudgetStatus(sessionId: string) {
  const state = loadBudget(sessionId);
  return { used: state.usedCalls, max: state.maxCalls, remaining: Math.max(0, state.maxCalls - state.usedCalls) };
}
