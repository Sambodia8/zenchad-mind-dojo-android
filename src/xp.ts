import { LEVEL_THRESHOLDS } from "./data";

export interface LevelProgress {
  level: number;
  currentThreshold: number;
  nextThreshold: number;
  progressPercent: number;
  xpToNext: number;
  isMaxLevel: boolean;
}

export function getLevelProgress(xp: number, level?: number): LevelProgress {
  const safeXp = Math.max(0, Number.isFinite(xp) ? xp : 0);
  const derivedLevel = Math.max(
    1,
    LEVEL_THRESHOLDS.findIndex((threshold) => safeXp < threshold) === -1
      ? LEVEL_THRESHOLDS.length
      : LEVEL_THRESHOLDS.findIndex((threshold) => safeXp < threshold)
  );
  const safeLevel = Math.min(
    LEVEL_THRESHOLDS.length,
    Math.max(1, Number.isFinite(level) ? Math.floor(level as number) : derivedLevel)
  );
  const currentThreshold = LEVEL_THRESHOLDS[safeLevel - 1] ?? 0;
  const nextThreshold = LEVEL_THRESHOLDS[safeLevel] ?? currentThreshold;
  const isMaxLevel = safeLevel >= LEVEL_THRESHOLDS.length;
  const span = Math.max(1, nextThreshold - currentThreshold);
  const progressPercent = isMaxLevel
    ? 100
    : Math.min(100, Math.max(0, ((safeXp - currentThreshold) / span) * 100));

  return {
    level: safeLevel,
    currentThreshold,
    nextThreshold,
    progressPercent,
    xpToNext: isMaxLevel ? 0 : Math.max(0, nextThreshold - safeXp),
    isMaxLevel
  };
}
