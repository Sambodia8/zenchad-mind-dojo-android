import type {
  MysteryChallengeRun,
  MysteryChallengeState,
  MysteryMeditationCategory,
  MysteryMeditationCompletion
} from "./types";

export const MYSTERY_CATEGORIES: MysteryMeditationCategory[] = ["Emotional", "Sensory"];

function newRun(now = new Date().toISOString()): MysteryChallengeRun {
  return {
    id: crypto.randomUUID(),
    startedAt: now,
    meditations: [],
    journalEntryId: null
  };
}

function randomSecretOrder(): [MysteryMeditationCategory, MysteryMeditationCategory] {
  return Math.random() < 0.5 ? ["Emotional", "Sensory"] : ["Sensory", "Emotional"];
}

export function createMysteryChallengeState(): MysteryChallengeState {
  return {
    version: 1,
    secretOrder: randomSecretOrder(),
    currentRun: null,
    completedRuns: 0,
    lastCompletedAt: null,
    lastJournalEntryId: null,
    lastRunMatchedSecret: false,
    clueVisible: false,
    bonusUnlocked: false
  };
}

export function startMysteryRun(state: MysteryChallengeState): MysteryChallengeState {
  if (state.currentRun) return state;
  return { ...state, currentRun: newRun(), clueVisible: false };
}

export function recordMysteryMeditation(
  state: MysteryChallengeState,
  runId: string,
  completion: Omit<MysteryMeditationCompletion, "completedAt">,
  now = new Date().toISOString()
): MysteryChallengeState {
  const run = state.currentRun;
  if (!run || run.id !== runId || run.journalEntryId) return state;
  if (run.meditations.some((item) => item.category === completion.category || item.meditationId === completion.meditationId)) {
    return state;
  }

  return {
    ...state,
    currentRun: {
      ...run,
      meditations: [...run.meditations, { ...completion, completedAt: now }]
    }
  };
}

export function mysteryMeditationsComplete(state: MysteryChallengeState) {
  return MYSTERY_CATEGORIES.every((category) =>
    state.currentRun?.meditations.some((item) => item.category === category)
  );
}

export function mysterySecretOrderMatched(state: MysteryChallengeState) {
  const meditations = state.currentRun?.meditations ?? [];
  return meditations.length === 2 && meditations.every((item, index) => item.category === state.secretOrder[index]);
}

export function completeMysteryJournal(
  state: MysteryChallengeState,
  runId: string,
  journalEntryId: string,
  now = new Date().toISOString()
): MysteryChallengeState {
  const run = state.currentRun;
  if (!run || run.id !== runId || run.journalEntryId || !mysteryMeditationsComplete(state)) return state;

  const matchedSecret = mysterySecretOrderMatched(state);
  return {
    ...state,
    currentRun: null,
    completedRuns: state.completedRuns + 1,
    lastCompletedAt: now,
    lastJournalEntryId: journalEntryId,
    lastRunMatchedSecret: matchedSecret,
    clueVisible: !matchedSecret && !state.bonusUnlocked,
    bonusUnlocked: state.bonusUnlocked || matchedSecret
  };
}

export function challengeMeditationForCategory(
  state: MysteryChallengeState,
  category: MysteryMeditationCategory
) {
  return state.currentRun?.meditations.find((item) => item.category === category);
}
