import type { AppData } from "./types";

export const ZEN_POINTS_TUNING = {
  meditationCompletionBase: 5,
  meditationCompletionPerMinute: 1
} as const;

export function zenPointsForMeditation(seconds: number) {
  const completedMinutes = Math.max(0, Math.floor(Math.max(0, seconds) / 60));
  return ZEN_POINTS_TUNING.meditationCompletionBase +
    completedMinutes * ZEN_POINTS_TUNING.meditationCompletionPerMinute;
}

export function awardZenPoints(data: AppData, amount: number): AppData {
  const reward = Math.max(0, Math.floor(amount));
  return {
    ...data,
    zenPoints: Math.max(0, data.zenPoints) + reward,
    lifetimeZenPoints: Math.max(0, data.lifetimeZenPoints) + reward
  };
}
