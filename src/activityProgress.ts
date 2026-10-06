import type { PracticeSession } from "./meditationPractice";
import type { RunRecord } from "./running";
import type { CompletedBikeRide } from "./bikeQuestHistory";
import { localDateKey } from "./streakFreeze";

export interface ProgressActivity {
  id: string;
  kind: "meditation" | "yoga" | "run" | "bike";
  completedAt: string;
  seconds: number;
}

export interface ActivityProgressInput {
  sessions: readonly ProgressActivity[];
  practices: readonly PracticeSession[];
  runs: readonly RunRecord[];
  rides: readonly CompletedBikeRide[];
  weeklyMovementTarget: number;
  now?: number;
}

/** Completed records only. Aggregate reward counters cannot reconstruct sessions. */
export function getActivityProgress(input: ActivityProgressInput) {
  const now = input.now ?? Date.now();
  const calendarStart = new Date(now);
  calendarStart.setHours(0, 0, 0, 0);
  calendarStart.setDate(calendarStart.getDate() - 6);
  const rollingStart = now - 7 * 86_400_000;
  const records = new Map<string, { at: number; kind: ProgressActivity["kind"] }>();
  const add = (id: string, kind: ProgressActivity["kind"], at: number, seconds: number) => {
    if (!id || !["meditation", "yoga", "run", "bike"].includes(kind) ||
        !Number.isFinite(at) || at <= 0 || at > now || !Number.isFinite(seconds) || seconds <= 0) return;
    const key = `${kind}:${id}`;
    if (!records.has(key)) records.set(key, { at, kind });
  };
  // Dedicated histories are canonical when a completion also has an AppData receipt.
  for (const run of input.runs) add(run.id, "run", run.endedAt, run.durationSeconds);
  for (const ride of input.rides) add(ride.id, "bike", ride.completedAt, ride.rideSeconds);
  for (const practice of input.practices) add(`practice:${practice.id}`, "meditation", Date.parse(practice.completedAt), practice.activeSeconds);
  for (const session of input.sessions) {
    if (session.id.startsWith("yoga-reward:") || session.id.startsWith("yoga-substep:")) continue;
    add(session.id, session.kind, Date.parse(session.completedAt), session.seconds);
  }
  const recent = [...records.values()].filter((record) => record.at >= calendarStart.getTime());
  const movementSessions = [...records.values()].filter((record) =>
    (record.kind === "run" || record.kind === "bike") && record.at >= rollingStart).length;
  const target = Number.isFinite(input.weeklyMovementTarget)
    ? Math.max(1, Math.min(7, Math.round(input.weeklyMovementTarget))) : 3;
  return {
    sessions: recent.length,
    activeDays: new Set(recent.map((record) => localDateKey(new Date(record.at)))).size,
    movementSessions,
    movementTarget: target,
    movementTargetMet: movementSessions >= target
  };
}
