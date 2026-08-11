import { loadRunSession, loadRunningProfile } from "./running";
import { progressionForHistory, runningStreakMultiplier } from "./runningProgression";

export interface RunningRewardBonus {
  runId: string;
  streakDays: number;
  multiplier: number;
  baseXp: number;
  bonusXp: number;
  createdAt: number;
  appliedToGlobalXp: boolean;
}

interface RunningRewardBonusStore {
  version: 1;
  bonuses: RunningRewardBonus[];
}

const STORAGE_KEY = "zenchad_running_reward_bonus_v1";
export const RUNNING_BONUS_QUEUED_EVENT = "zenchad:running-bonus-queued";

function loadStore(): RunningRewardBonusStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, bonuses: [] };
    const parsed = JSON.parse(raw) as Partial<RunningRewardBonusStore>;
    return { version: 1, bonuses: Array.isArray(parsed.bonuses) ? parsed.bonuses : [] };
  } catch {
    return { version: 1, bonuses: [] };
  }
}

function saveStore(store: RunningRewardBonusStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: 1,
    bonuses: store.bonuses.slice(-300)
  }));
}

export function runningRewardBonuses() {
  return loadStore().bonuses;
}

export function runningRewardBonusForRun(runId: string) {
  return loadStore().bonuses.find((bonus) => bonus.runId === runId) ?? null;
}

export function queueRunningRewardBonusForCurrentRun() {
  const session = loadRunSession();
  if (!session || session.stage !== "complete") return null;
  const store = loadStore();
  const existing = store.bonuses.find((bonus) => bonus.runId === session.id);
  if (existing) return existing;

  const profile = loadRunningProfile();
  const record = profile.history.find((item) => item.id === session.id);
  if (!record) return null;
  const progression = progressionForHistory(profile.history);
  const streakDays = progression.streak.currentDays;
  const multiplier = runningStreakMultiplier(streakDays);
  const bonusXp = Math.max(0, Math.round(record.xp * Math.max(0, multiplier - 1)));
  const bonus: RunningRewardBonus = {
    runId: record.id,
    streakDays,
    multiplier,
    baseXp: record.xp,
    bonusXp,
    createdAt: record.endedAt,
    appliedToGlobalXp: bonusXp === 0
  };
  store.bonuses.push(bonus);
  saveStore(store);
  if (bonusXp > 0) window.dispatchEvent(new CustomEvent(RUNNING_BONUS_QUEUED_EVENT));
  return bonus;
}

export function pendingRunningRewardBonuses() {
  return loadStore().bonuses.filter((bonus) => bonus.bonusXp > 0 && !bonus.appliedToGlobalXp);
}

export function markRunningRewardBonusesApplied(runIds: string[]) {
  if (!runIds.length) return;
  const ids = new Set(runIds);
  const store = loadStore();
  let changed = false;
  store.bonuses = store.bonuses.map((bonus) => {
    if (!ids.has(bonus.runId) || bonus.appliedToGlobalXp) return bonus;
    changed = true;
    return { ...bonus, appliedToGlobalXp: true };
  });
  if (changed) saveStore(store);
}

export function totalRunningBonusXp() {
  return loadStore().bonuses.reduce((sum, bonus) => sum + bonus.bonusXp, 0);
}
