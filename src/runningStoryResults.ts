import type { ChaseDifficulty, ChaseOutcomeKind } from "./runningStory";

export interface StoryRouteEvent {
  type: "chase-start" | "chase-outcome" | "helicopter-start" | "helicopter-cover" | string;
  at: number;
  distanceMeters: number;
  detail: string;
}

export interface StoryRunResult {
  runId: string;
  missionId: string;
  missionTitle: string;
  difficulty: ChaseDifficulty;
  chaseCount: number;
  lastOutcome: ChaseOutcomeKind | "";
  helicopterEncountered: boolean;
  completedAt: number;
  source: "native" | "browser";
  events?: StoryRouteEvent[];
}

interface StoryResultStore {
  version: 1;
  results: StoryRunResult[];
}

const STORE_KEY = "zenchad_running_story_results_v1";

function loadStore(): StoryResultStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { version: 1, results: [] };
    const parsed = JSON.parse(raw) as Partial<StoryResultStore>;
    return { version: 1, results: Array.isArray(parsed.results) ? parsed.results : [] };
  } catch {
    return { version: 1, results: [] };
  }
}

function saveStore(store: StoryResultStore) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

export function loadStoryRunResults() {
  return loadStore().results;
}

export function storyResultForRun(runId: string) {
  return loadStore().results.find((result) => result.runId === runId) ?? null;
}

export function saveStoryRunResult(result: StoryRunResult) {
  const store = loadStore();
  const index = store.results.findIndex((item) => item.runId === result.runId);
  if (index >= 0) store.results[index] = result;
  else store.results.push(result);
  store.results = store.results.sort((a, b) => b.completedAt - a.completedAt).slice(0, 300);
  saveStore(store);
  return result;
}

export function storyCampaignTotals(results = loadStoryRunResults()) {
  return {
    missions: results.length,
    chases: results.reduce((sum, result) => sum + result.chaseCount, 0),
    escaped: results.filter((result) => result.lastOutcome === "escaped").length,
    pressureBranches: results.filter((result) => result.lastOutcome === "pressure").length,
    caughtBranches: results.filter((result) => result.lastOutcome === "caught-branch").length,
    helicopterEncounters: results.filter((result) => result.helicopterEncountered).length
  };
}

export function storyOutcomeLabel(outcome: StoryRunResult["lastOutcome"]) {
  if (outcome === "escaped") return "Pursuit broken";
  if (outcome === "pressure") return "Pursuer stayed with you";
  if (outcome === "caught-branch") return "Intercepted · story branched";
  return "No chase outcome this run";
}
