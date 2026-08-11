import type { ChaseDifficulty, ChaseOutcomeKind } from "./runningStory";

export interface StoryChaseRecord {
  startedAt: number;
  durationSeconds: number;
  targetSpeedMps: number;
  achievedSpeedMps: number;
  outcome: ChaseOutcomeKind;
}

export interface ActiveStoryChase {
  startedAt: number;
  durationSeconds: number;
  targetSpeedMps: number;
  startDistanceMeters: number;
}

export type StoryRuntimePhase = "opening" | "cruise" | "chase" | "aftermath" | "helicopter" | "home";

export interface StoryRunRuntimeState {
  version: 1;
  sessionId: string;
  missionId: "ghost-signal-001";
  missionTitle: "Ghost Signal";
  difficulty: ChaseDifficulty;
  phase: StoryRuntimePhase;
  createdAt: number;
  linesPlayed: string[];
  chases: StoryChaseRecord[];
  activeChase: ActiveStoryChase | null;
  nextEventAfter: number;
  helicopterTriggered: boolean;
  helicopterTargetDistance: number | null;
  lastRadioTitle: string;
  lastRadioDetail: string;
}

const STORY_STATE_KEY = "zenchad_running_story_runtime_v1";

export function createStoryRunRuntimeState(sessionId: string): StoryRunRuntimeState {
  return {
    version: 1,
    sessionId,
    missionId: "ghost-signal-001",
    missionTitle: "Ghost Signal",
    difficulty: "standard",
    phase: "opening",
    createdAt: Date.now(),
    linesPlayed: [],
    chases: [],
    activeChase: null,
    nextEventAfter: Date.now(),
    helicopterTriggered: false,
    helicopterTargetDistance: null,
    lastRadioTitle: "COMMS ONLINE",
    lastRadioDetail: "Mission channel connected. Keep moving."
  };
}

export function loadStoryRunRuntimeState(sessionId?: string | null): StoryRunRuntimeState | null {
  try {
    const raw = localStorage.getItem(STORY_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoryRunRuntimeState;
    if (parsed?.version !== 1 || !parsed.sessionId) return null;
    if (sessionId && parsed.sessionId !== sessionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoryRunRuntimeState(state: StoryRunRuntimeState | null) {
  if (!state) {
    localStorage.removeItem(STORY_STATE_KEY);
    return;
  }
  localStorage.setItem(STORY_STATE_KEY, JSON.stringify(state));
}

export function storyLineWasPlayed(state: StoryRunRuntimeState, id: string) {
  return state.linesPlayed.includes(id);
}

export function markStoryLinePlayed(state: StoryRunRuntimeState, id: string) {
  if (storyLineWasPlayed(state, id)) return state;
  return { ...state, linesPlayed: [...state.linesPlayed, id] };
}
