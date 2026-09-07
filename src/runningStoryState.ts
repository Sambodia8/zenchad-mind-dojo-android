import type { ChaseDifficulty, ChaseOutcomeKind } from "./runningStory";
import {
  STORY_CHAPTER_IDS,
  storyChapterIdForLineKey,
  type StoryChapterId
} from "./runningStoryChapters";

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
  version: 2;
  sessionId: string;
  missionId: string;
  missionTitle: string;
  difficulty: ChaseDifficulty;
  phase: StoryRuntimePhase;
  createdAt: number;
  linesPlayed: string[];
  heardChapterIds: StoryChapterId[];
  failedLineKeys: string[];
  lastTranscript: string;
  audioState: "idle" | "pending" | "playing" | "failed";
  chases: StoryChaseRecord[];
  activeChase: ActiveStoryChase | null;
  nextEventAfter: number;
  helicopterTriggered: boolean;
  helicopterTargetDistance: number | null;
  lastRadioTitle: string;
  lastRadioDetail: string;
}

const STORY_STATE_KEY = "zenchad_running_story_runtime_v1";

export function createStoryRunRuntimeState(
  sessionId: string,
  missionId = "ghost-signal-001",
  missionTitle = "Ghost Signal",
  heardChapterIds: StoryChapterId[] = []
): StoryRunRuntimeState {
  const heard = STORY_CHAPTER_IDS.filter((chapterId) => heardChapterIds.includes(chapterId));
  const seededLineKeys = heard.flatMap((chapterId) => ({
    briefing: ["opening-1"],
    contact: ["opening-2"],
    pursuit: ["pursuit-bridge"],
    complication: ["complication-bridge"],
    extraction: ["home-stretch"]
  })[chapterId]);
  return {
    version: 2,
    sessionId,
    missionId,
    missionTitle,
    difficulty: "standard",
    phase: "opening",
    createdAt: Date.now(),
    linesPlayed: seededLineKeys,
    heardChapterIds: heard,
    failedLineKeys: [],
    lastTranscript: "",
    audioState: "pending",
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
    const parsed = JSON.parse(raw) as Partial<StoryRunRuntimeState> & { version?: number };
    if (![1, 2].includes(Number(parsed?.version)) || !parsed.sessionId) return null;
    if (sessionId && parsed.sessionId !== sessionId) return null;
    const defaults = createStoryRunRuntimeState(
      parsed.sessionId,
      typeof parsed.missionId === "string" ? parsed.missionId : undefined,
      typeof parsed.missionTitle === "string" ? parsed.missionTitle : undefined
    );
    return {
      ...defaults,
      ...parsed,
      version: 2,
      linesPlayed: Array.isArray(parsed.linesPlayed) ? parsed.linesPlayed.filter((value): value is string => typeof value === "string") : [],
      heardChapterIds: Array.isArray(parsed.heardChapterIds)
        ? STORY_CHAPTER_IDS.filter((id) => parsed.heardChapterIds?.includes(id))
        : [],
      failedLineKeys: Array.isArray(parsed.failedLineKeys) ? parsed.failedLineKeys.filter((value): value is string => typeof value === "string") : [],
      lastTranscript: typeof parsed.lastTranscript === "string" ? parsed.lastTranscript : "",
      audioState: parsed.audioState === "playing" || parsed.audioState === "failed" || parsed.audioState === "idle" ? parsed.audioState : "pending"
    } as StoryRunRuntimeState;
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
  const chapterId = storyChapterIdForLineKey(id);
  return {
    ...state,
    linesPlayed: [...state.linesPlayed, id],
    heardChapterIds: chapterId && !state.heardChapterIds.includes(chapterId)
      ? STORY_CHAPTER_IDS.filter((candidate) => candidate === chapterId || state.heardChapterIds.includes(candidate))
      : state.heardChapterIds,
    failedLineKeys: state.failedLineKeys.filter((key) => key !== id),
    audioState: "idle" as const
  };
}
