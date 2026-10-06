import assert from "node:assert/strict";
import { getActivityProgress } from "../src/activityProgress.ts";

const now = new Date(2026, 9, 5, 12).getTime();
const time = (daysAgo, hour = 10) => new Date(2026, 9, 5 - daysAgo, hour).getTime();
const iso = (at) => new Date(at).toISOString();
const session = (id, kind, at, seconds = 600) => ({ id, kind, completedAt: iso(at), seconds });
const input = (extra = {}) => ({ now, sessions: [], practices: [], runs: [], rides: [], weeklyMovementTarget: 3, ...extra });

assert.deepEqual(getActivityProgress(input()), { sessions: 0, activeDays: 0, movementSessions: 0, movementTarget: 3, movementTargetMet: false });

const mixed = getActivityProgress(input({
  sessions: [session("guided", "meditation", time(0)), session("yoga", "yoga", time(2)), session("run-1", "run", time(1)), session("bike-1", "bike", time(3)), session("practice:p1", "meditation", time(0))],
  practices: [{ id: "p1", completedAt: iso(time(0)), activeSeconds: 600 }],
  runs: [{ id: "run-1", endedAt: time(1), durationSeconds: 1200 }, { id: "run-1", endedAt: time(1), durationSeconds: 1200 }],
  rides: [{ id: "bike-1", completedAt: time(3), rideSeconds: 1200 }, { id: "bike-1", completedAt: time(3), rideSeconds: 1200 }]
}));
assert.equal(mixed.sessions, 5, "same persisted completion must count once across ledgers and dedicated histories");
assert.equal(mixed.activeDays, 4, "multiple activities on one day contribute one active day");
assert.equal(mixed.movementSessions, 2, "meditation/yoga must not satisfy the coach's movement target");
assert.equal(mixed.movementTargetMet, false);

const rideWithWarmupReceipts = getActivityProgress(input({
  sessions: [
    session("yoga-reward:bike-prep", "yoga", time(1)),
    session("yoga-substep:bike-cooldown", "yoga", time(1)),
    session("yoga-substep:run-prep", "yoga", time(2)),
    session("standalone-yoga", "yoga", time(3))
  ],
  rides: [{ id: "ride", completedAt: time(1), rideSeconds: 1200 }]
}));
assert.equal(rideWithWarmupReceipts.sessions, 2, "ride preparation/reward receipts must not inflate completed sessions");
assert.equal(rideWithWarmupReceipts.activeDays, 2, "an uncompleted run's preparation receipt must not invent an active day");
assert.equal(rideWithWarmupReceipts.movementSessions, 1);
assert.equal(getActivityProgress(input({ sessions: [session("yoga-reward:only", "yoga", time(0)), session("yoga-substep:only", "yoga", time(1))] })).sessions, 0);

const boundary = getActivityProgress(input({ sessions: [
  session("first", "yoga", time(6, 0)),
  session("before", "yoga", time(6, 0) - 1),
  session("today", "meditation", now),
  session("future", "yoga", now + 1),
  session("zero", "yoga", time(0), 0),
  session("negative", "yoga", time(0), -30),
  { id: "invalid", kind: "yoga", completedAt: "invalid", seconds: 300 },
  { id: "infinite", kind: "yoga", completedAt: iso(time(0)), seconds: Infinity }
] }));
assert.equal(boundary.sessions, 2, "calendar days include today's start plus the previous six local dates");
assert.equal(boundary.activeDays, 2);

const achieved = getActivityProgress(input({
  runs: [{ id: "r1", endedAt: now - 7 * 86_400_000, durationSeconds: 900 }, { id: "r2", endedAt: time(1), durationSeconds: 900 }],
  rides: [{ id: "b1", completedAt: time(0), rideSeconds: 900 }, { id: "old", completedAt: now - 7 * 86_400_000 - 1, rideSeconds: 900 }]
}));
assert.equal(achieved.movementSessions, 3, "coach achievement uses its rolling seven-day movement window");
assert.equal(achieved.movementTargetMet, true);
assert.equal(achieved.sessions, 2, "rolling movement target and seven local calendar-day counters have distinct boundaries");

// Europe/London's spring clock change makes these six calendar days 143 hours long.
const dstNow = new Date(2026, 2, 30, 12).getTime();
const dstBoundary = new Date(2026, 2, 24, 0).getTime();
assert.equal(getActivityProgress(input({ now: dstNow, sessions: [session("dst", "yoga", dstBoundary), session("before-dst", "yoga", dstBoundary - 1)] })).sessions, 1);
console.log("Activity progress: real dates, calendar boundaries, invalid records, cross-history deduplication and movement targets passed.");
