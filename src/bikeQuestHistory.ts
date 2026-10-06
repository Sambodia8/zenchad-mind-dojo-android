import type { BikeQuestFeedback } from "./bikeQuest";

export interface CompletedBikeRide {
  id: string;
  completedAt: number;
  rideSeconds: number;
  questXp?: number;
  armSets?: number;
  feedback?: BikeQuestFeedback;
}

const HISTORY_KEY = "zenchad_completed_bike_rides_v1";

export function loadCompletedBikeRides(): CompletedBikeRide[] {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((ride): ride is CompletedBikeRide =>
      ride && typeof ride.id === "string" &&
      Number.isFinite(ride.completedAt) && ride.completedAt > 0 &&
      Number.isFinite(ride.rideSeconds) && ride.rideSeconds > 0
    );
  } catch {
    return [];
  }
}

export function recordCompletedBikeRide(ride: CompletedBikeRide): void {
  if (!ride.id || !Number.isFinite(ride.completedAt) || ride.completedAt <= 0 || !Number.isFinite(ride.rideSeconds) || ride.rideSeconds <= 0) return;
  const previous = loadCompletedBikeRides();
  const index = previous.findIndex((entry) => entry.id === ride.id);
  if (index !== -1) {
    const existing = previous[index];
    // Preserve the original receipt while allowing later recovery and feedback to save.
    previous[index] = { ...existing, questXp: ride.questXp ?? existing.questXp, armSets: ride.armSets ?? existing.armSets, feedback: { ...existing.feedback, ...ride.feedback } };
    localStorage.setItem(HISTORY_KEY, JSON.stringify(previous));
    return;
  }
  localStorage.setItem(HISTORY_KEY, JSON.stringify([ride, ...previous].slice(0, 300)));
}
