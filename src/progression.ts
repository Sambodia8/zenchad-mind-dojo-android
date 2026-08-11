import { MEDITATIONS, MEDITATION_SKILL_MAPPING } from "./data";
import type { CosmeticSlot, ProgressionData, ZenStatId } from "./types";

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const ZEN_STAT_ORDER: ZenStatId[] = [
  "focus",
  "calm",
  "presence",
  "intuition",
  "equanimity",
  "compassion",
  "discipline"
];

export const ZEN_STAT_LABELS: Record<ZenStatId, string> = {
  focus: "Focus",
  calm: "Calm",
  presence: "Presence",
  intuition: "Intuition",
  equanimity: "Equanimity",
  compassion: "Compassion",
  discipline: "Discipline"
};

export const FLOW_TUNING = {
  firstPracticeBase: 14,
  additionalPracticeBase: 5,
  dailyBonus: 18,
  streakBonusPerDay: 2,
  streakBonusDays: 7,
  startingLevel: 1,
  startingXp: 0
} as const;

export const SKILL_TUNING = {
  primaryBaseXp: 18,
  secondaryBaseXp: 8,
  durationBonusPerMinute: 0.35,
  maxDurationBonus: 12,
  firstLevelCost: 90,
  levelCostGrowth: 35
} as const;

export const DEFAULT_EQUIPPED_COSMETICS = {
  head: "default-pink-hair",
  top: "runner-top",
  wrist: "fitness-watch",
  legs: "runner-shorts",
  shoes: "red-trainers",
  aura: "indigo-flow"
} as const;

export const COSMETIC_SLOT_DEFINITIONS: Array<{ slot: CosmeticSlot; label: string; glyph: string }> = [
  { slot: "head", label: "Head", glyph: "✦" },
  { slot: "top", label: "Top", glyph: "▰" },
  { slot: "wrist", label: "Wrist", glyph: "⌚" },
  { slot: "legs", label: "Legs", glyph: "▥" },
  { slot: "shoes", label: "Shoes", glyph: "◒" },
  { slot: "aura", label: "Aura", glyph: "☯" }
];

export function createDefaultProgression(): ProgressionData {
  const skillXp = Object.fromEntries(ZEN_STAT_ORDER.map((id) => [id, 0])) as Record<ZenStatId, number>;
  const skillLevels = Object.fromEntries(ZEN_STAT_ORDER.map((id) => [id, 1])) as Record<ZenStatId, number>;
  return {
    flowLevel: FLOW_TUNING.startingLevel,
    flowXp: FLOW_TUNING.startingXp,
    flowTotalXp: FLOW_TUNING.startingXp,
    flowLastPracticeDate: null,
    flowConsecutiveDays: 0,
    skillXp,
    skillLevels,
    equippedCosmetics: { ...DEFAULT_EQUIPPED_COSMETICS },
    flowForm: { activeFormId: null, unlockedFormIds: [] }
  };
}

export function flowXpForNextLevel(level: number) {
  return 120 + Math.max(0, level - 1) * 30;
}

export function skillXpForLevel(level: number) {
  const steps = Math.max(0, level - 1);
  return steps * SKILL_TUNING.firstLevelCost +
    (SKILL_TUNING.levelCostGrowth * steps * Math.max(0, steps - 1)) / 2;
}

export function skillLevelForXp(xp: number) {
  const safeXp = Math.max(0, Math.floor(xp));
  let level = 1;
  while (skillXpForLevel(level + 1) <= safeXp) level += 1;
  return level;
}

function flowRewardForCompletion(
  progression: ProgressionData,
  sessionDate: Date
) {
  const day = dateKey(sessionDate);
  const lastDay = progression.flowLastPracticeDate;
  const isNewDay = day !== lastDay;
  const previousDate = new Date(sessionDate);
  previousDate.setDate(previousDate.getDate() - 1);
  const consecutiveDays = isNewDay
    ? lastDay === dateKey(previousDate) ? progression.flowConsecutiveDays + 1 : 1
    : progression.flowConsecutiveDays;
  const reward = (isNewDay ? FLOW_TUNING.firstPracticeBase + FLOW_TUNING.dailyBonus : FLOW_TUNING.additionalPracticeBase) +
    Math.min(consecutiveDays, FLOW_TUNING.streakBonusDays) * FLOW_TUNING.streakBonusPerDay;
  return { day, isNewDay, consecutiveDays, reward };
}

export function awardMeditationProgress(
  progression: ProgressionData,
  meditationId: string,
  durationSeconds: number,
  sessionDate = new Date()
): ProgressionData {
  const mapping = MEDITATION_SKILL_MAPPING[meditationId];
  if (!mapping) return progression;

  const flowReward = flowRewardForCompletion(progression, sessionDate);
  let flowLevel = Math.max(1, progression.flowLevel);
  let flowXp = Math.max(0, progression.flowXp) + flowReward.reward;
  let flowTotalXp = Math.max(0, progression.flowTotalXp) + flowReward.reward;
  while (flowXp >= flowXpForNextLevel(flowLevel)) {
    flowXp -= flowXpForNextLevel(flowLevel);
    flowLevel += 1;
  }

  const durationBonus = Math.min(
    SKILL_TUNING.maxDurationBonus,
    Math.max(0, durationSeconds / 60) * SKILL_TUNING.durationBonusPerMinute
  );
  const skillXp = { ...progression.skillXp };
  skillXp[mapping.primary] = (skillXp[mapping.primary] ?? 0) + SKILL_TUNING.primaryBaseXp + durationBonus;
  skillXp[mapping.secondary] = (skillXp[mapping.secondary] ?? 0) + SKILL_TUNING.secondaryBaseXp + durationBonus / 2;
  const skillLevels = { ...progression.skillLevels };
  for (const statId of ZEN_STAT_ORDER) skillLevels[statId] = skillLevelForXp(skillXp[statId] ?? 0);

  return {
    ...progression,
    flowLevel,
    flowXp,
    flowTotalXp,
    flowLastPracticeDate: flowReward.isNewDay ? flowReward.day : progression.flowLastPracticeDate,
    flowConsecutiveDays: flowReward.consecutiveDays,
    skillXp,
    skillLevels
  };
}

export function meditationIdForName(name: string) {
  const normalized = name.trim().toLowerCase();
  return MEDITATIONS.find((meditation) =>
    meditation.id === normalized ||
    meditation.name.toLowerCase() === normalized ||
    meditation.shortName.toLowerCase() === normalized
  )?.id;
}
