import assert from "node:assert/strict";

const stored = new Map();
globalThis.localStorage = {
  getItem(key) { return stored.get(key) ?? null; },
  setItem(key, value) { stored.set(key, value); },
  removeItem(key) { stored.delete(key); }
};

const { completeBikeRide, createBikeQuestState, loadBikeQuestState, saveBikeQuestState } = await import("../src/bikeQuest.ts");
const { loadCompletedBikeRides, recordCompletedBikeRide } = await import("../src/bikeQuestHistory.ts");
const startedAt = 1_790_000_000_000;
const active = { ...createBikeQuestState(startedAt), step: "ride", rideStartedAt: startedAt + 10_000, totalQuestXp: 180, awards: { gear: 50 } };
const complete = completeBikeRide(active, active.rideStartedAt + 600_000);
assert.equal(complete.step, "complete", "ending a ride opens completion directly");
assert.equal(complete.rideSeconds, 600);
assert.equal(complete.awards.ride, 150);
assert.equal(complete.totalQuestXp, 330);
assert.equal(completeBikeRide(complete), null, "repeat completion cannot grant XP");
assert.equal(completeBikeRide({ ...complete, step: "ride" }), null, "a stale route cannot override the saved award");
saveBikeQuestState(complete);
assert.equal(completeBikeRide(loadBikeQuestState()), null, "reload does not award again");

const receipt = { id: String(startedAt), completedAt: complete.rideEndedAt, rideSeconds: complete.rideSeconds, questXp: complete.totalQuestXp, armSets: 2 };
recordCompletedBikeRide(receipt);
recordCompletedBikeRide(receipt);
assert.equal(loadCompletedBikeRides().length, 1, "one receipt per quest");

saveBikeQuestState({ ...complete, feedback: { enjoyment: "good" } });
recordCompletedBikeRide({ ...receipt, feedback: { enjoyment: "good" } });
assert.deepEqual(loadBikeQuestState().feedback, { enjoyment: "good" }, "one optional answer survives reload");
assert.deepEqual(loadCompletedBikeRides()[0].feedback, { enjoyment: "good" });
recordCompletedBikeRide({ ...receipt, feedback: { effort: "moderate" }, questXp: 360 });
assert.deepEqual(loadCompletedBikeRides()[0].feedback, { enjoyment: "good", effort: "moderate" });
assert.equal(loadCompletedBikeRides()[0].questXp, 360, "a recovery bonus updates history");

recordCompletedBikeRide({ ...receipt, completedAt: receipt.completedAt + 1000, rideSeconds: 9999 });
assert.equal(loadCompletedBikeRides()[0].rideSeconds, 600, "updates preserve original ride duration");
assert.equal(loadCompletedBikeRides()[0].completedAt, receipt.completedAt, "updates preserve original completion timestamp");
assert.equal(loadCompletedBikeRides().length, 1);
saveBikeQuestState({ ...loadBikeQuestState(), completionDismissed: true });
assert.equal(loadBikeQuestState().completionDismissed, true, "Done survives reload without deleting deferred shower context");
assert.deepEqual(loadBikeQuestState().feedback, { enjoyment: "good" });

stored.set("zenchad_completed_bike_rides_v1", JSON.stringify([{ id: "older", completedAt: startedAt, rideSeconds: 300 }]));
assert.equal(loadCompletedBikeRides()[0].id, "older", "older history stays readable");
stored.set("zenchad_completed_bike_rides_v1", "bad json");
assert.deepEqual(loadCompletedBikeRides(), []);
console.log("Bike completion, reload, optional feedback, recovery history, receipt dedup and legacy checks passed.");
