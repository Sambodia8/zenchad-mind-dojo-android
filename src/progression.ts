import { MEDITATIONS, MEDITATION_SKILL_MAPPING } from "./data";
import type { CosmeticSlot, ProgressionData, ZenStatId } from "./types";
import { localCalendarDayDistance, localDateKey as dateKey } from "./streakFreeze";

export const ZEN_STAT_ORDER: ZenStatId[] = [
  "focus",
  "calm",
  "presence",
  "intuition",
  "equanimity",
  "compassion",
  "discipline",
  "strength"
];

export const ZEN_STAT_LABELS: Record<ZenStatId, string> = {
  focus: "Focus",
  calm: "Calm",
  presence: "Presence",
  intuition: "Intuition",
  equanimity: "Equanimity",
  compassion: "Compassion",
  discipline: "Discipline",
  strength: "Strength"
};

export const STAT_PROGRESSION_VERSION = 2 as const;

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
  earlyPrimaryCarryXp: 5,
  primaryXp: 25,
  secondaryXp: 10,
  easyThroughLevel: 5,
  earlyLevelCost: 20,
  laterLevelCost: 60,
  laterLevelCostGrowth: 25,
  strengthFirstLevelCost: 60,
  strengthLevelCostGrowth: 30,
  maxStrengthWorkoutXp: 120
} as const;

export const DEFAULT_EQUIPPED_COSMETICS = {
  hair: "default-pink-hair",
  top: "runner-top",
  wrist: "fitness-watch",
  legs: "runner-shorts",
  shoes: "red-trainers",
  aura: "indigo-flow"
} as const;

export const COSMETIC_SLOT_DEFINITIONS: Array<{ slot: CosmeticSlot; label: string; glyph: string }> = [
  { slot: "hair", label: "Hair", glyph: "✦" },
  { slot: "top", label: "Top", glyph: "▰" },
  { slot: "wrist", label: "Wrist", glyph: "⌚" },
  { slot: "legs", label: "Bottoms", glyph: "▥" },
  { slot: "shoes", label: "Footwear", glyph: "◒" },
  { slot: "aura", label: "Aura", glyph: "☯" }
];

export function createDefaultProgression(): ProgressionData {
  const skillXp = Object.fromEntries(ZEN_STAT_ORDER.map((id) => [id, 0])) as Record<ZenStatId, number>;
  const skillLevels = Object.fromEntries(ZEN_STAT_ORDER.map((id) => [id, 1])) as Record<ZenStatId, number>;
  return {
    version: STAT_PROGRESSION_VERSION,
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
  return statXpForLevel("focus", level);
}

export function skillLevelForXp(xp: number) {
  return statLevelForXp("focus", xp);
}

export function statXpForLevel(statId: ZenStatId, level: number) {
  const steps = Math.max(0, Math.floor(level) - 1);
  if (statId === "strength") {
    return steps * SKILL_TUNING.strengthFirstLevelCost +
      (SKILL_TUNING.strengthLevelCostGrowth * steps * Math.max(0, steps - 1)) / 2;
  }

  const earlySteps = Math.min(steps, SKILL_TUNING.easyThroughLevel - 1);
  const laterSteps = Math.max(0, steps - earlySteps);
  return earlySteps * SKILL_TUNING.earlyLevelCost +
    laterSteps * SKILL_TUNING.laterLevelCost +
    (SKILL_TUNING.laterLevelCostGrowth * laterSteps * Math.max(0, laterSteps - 1)) / 2;
}

export function statLevelForXp(statId: ZenStatId, xp: number) {
  const safeXp = Math.max(0, Math.floor(xp));
  let level = 1;
  while (statXpForLevel(statId, level + 1) <= safeXp) level += 1;
  return level;
}

export interface StatLevelProgress {
  level: number;
  currentXp: number;
  nextXp: number;
  earnedWithinLevel: number;
  xpForNextLevel: number;
  xpToNext: number;
  progressPercent: number;
}

export function getStatLevelProgress(statId: ZenStatId, xp: number): StatLevelProgress {
  const safeXp = Math.max(0, Number.isFinite(xp) ? xp : 0);
  const level = statLevelForXp(statId, safeXp);
  const currentXp = statXpForLevel(statId, level);
  const nextXp = statXpForLevel(statId, level + 1);
  const xpForNextLevel = Math.max(1, nextXp - currentXp);
  const earnedWithinLevel = Math.max(0, safeXp - currentXp);
  return {
    level,
    currentXp,
    nextXp,
    earnedWithinLevel,
    xpForNextLevel,
    xpToNext: Math.max(0, nextXp - safeXp),
    progressPercent: Math.min(100, (earnedWithinLevel / xpForNextLevel) * 100)
  };
}

function legacySkillXpForLevel(level: number) {
  const steps = Math.max(0, Math.floor(level) - 1);
  return steps * 90 + (35 * steps * Math.max(0, steps - 1)) / 2;
}

export function migrateLegacyStatXp(statId: ZenStatId, xp: number, savedLevel: number) {
  if (statId === "strength") return 0;
  const level = Math.max(1, Math.floor(savedLevel));
  const safeXp = Math.max(0, Number.isFinite(xp) ? xp : 0);
  const legacyCurrent = legacySkillXpForLevel(level);
  const legacyNext = legacySkillXpForLevel(level + 1);
  const fraction = Math.min(1, Math.max(0, (safeXp - legacyCurrent) / Math.max(1, legacyNext - legacyCurrent)));
  const current = statXpForLevel(statId, level);
  const next = statXpForLevel(statId, level + 1);
  return current + fraction * (next - current);
}

function flowRewardForCompletion(
  progression: ProgressionData,
  sessionDate: Date,
  preserveOneMissedDay: boolean
) {
  const day = dateKey(sessionDate);
  const lastDay = progression.flowLastPracticeDate;
  const distance = lastDay ? localCalendarDayDistance(lastDay, day) : null;
  const isNewDay = !lastDay || (distance !== null && distance > 0);
  const consecutiveDays = isNewDay
    ? !lastDay
      ? 1
      : distance === 1 || (distance === 2 && preserveOneMissedDay)
        ? progression.flowConsecutiveDays + 1
        : 1
    : progression.flowConsecutiveDays;
  const reward = (isNewDay ? FLOW_TUNING.firstPracticeBase + FLOW_TUNING.dailyBonus : FLOW_TUNING.additionalPracticeBase) +
    Math.min(consecutiveDays, FLOW_TUNING.streakBonusDays) * FLOW_TUNING.streakBonusPerDay;
  return { day, isNewDay, consecutiveDays, reward };
}

export function awardMeditationProgress(
  progression: ProgressionData,
  meditationId: string,
  _durationSeconds: number,
  sessionDate = new Date(),
  preserveOneMissedDay = false
): ProgressionData {
  const mapping = MEDITATION_SKILL_MAPPING[meditationId];
  if (!mapping) return progression;

  const flowReward = flowRewardForCompletion(progression, sessionDate, preserveOneMissedDay);
  let flowLevel = Math.max(1, progression.flowLevel);
  let flowXp = Math.max(0, progression.flowXp) + flowReward.reward;
  let flowTotalXp = Math.max(0, progression.flowTotalXp) + flowReward.reward;
  while (flowXp >= flowXpForNextLevel(flowLevel)) {
    flowXp -= flowXpForNextLevel(flowLevel);
    flowLevel += 1;
  }

  const skillXp = { ...progression.skillXp };
  const primaryXp = skillXp[mapping.primary] ?? 0;
  const primaryLevel = statLevelForXp(mapping.primary, primaryXp);
  skillXp[mapping.primary] = primaryLevel < SKILL_TUNING.easyThroughLevel
    ? statXpForLevel(mapping.primary, primaryLevel + 1) + SKILL_TUNING.earlyPrimaryCarryXp
    : primaryXp + SKILL_TUNING.primaryXp;
  skillXp[mapping.secondary] = (skillXp[mapping.secondary] ?? 0) + SKILL_TUNING.secondaryXp;
  const skillLevels = { ...progression.skillLevels };
  for (const statId of ZEN_STAT_ORDER) skillLevels[statId] = statLevelForXp(statId, skillXp[statId] ?? 0);

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

export function strengthXpForWorkout(durationSeconds: number) {
  const completedMinutes = Math.max(1, Math.floor(Math.max(0, durationSeconds) / 60));
  return Math.min(SKILL_TUNING.maxStrengthWorkoutXp, completedMinutes);
}

export function awardStrengthProgress(progression: ProgressionData, durationSeconds: number): ProgressionData {
  const skillXp = { ...progression.skillXp };
  skillXp.strength = (skillXp.strength ?? 0) + strengthXpForWorkout(durationSeconds);
  return {
    ...progression,
    version: STAT_PROGRESSION_VERSION,
    skillXp,
    skillLevels: {
      ...progression.skillLevels,
      strength: statLevelForXp("strength", skillXp.strength)
    }
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
