import assert from "node:assert/strict";

globalThis.localStorage = {
  value: null,
  getItem() { return this.value; },
  setItem(_key, value) { this.value = value; },
  removeItem() { this.value = null; }
};

const { zenPointsForMeditation, awardZenPoints } = await import("../src/zenPoints.ts");
const { defaultData, loadData, recordMeditationCompletion } = await import("../src/storage.ts");

assert.equal(zenPointsForMeditation(0), 5);
assert.equal(zenPointsForMeditation(599), 14);
assert.equal(zenPointsForMeditation(600), 15);

const awarded = awardZenPoints({ ...defaultData }, 15);
assert.equal(awarded.zenPoints, 15);
assert.equal(awarded.lifetimeZenPoints, 15);
assert.equal(awarded.stats.xp, 0, "ZenPoints must not alter XP");

localStorage.setItem("zenchad_app_data_v1", JSON.stringify({
  stats: { xp: 120, level: 2, sessionsCompleted: 1 },
  moods: [],
  preferences: { reducedMotion: true },
  progression: {}
}));
const migrated = loadData();
assert.equal(migrated.zenPoints, 0, "old saves receive a zero current balance");
assert.equal(migrated.lifetimeZenPoints, 0, "old saves receive a zero lifetime balance");
assert.equal(migrated.stats.xp, 120);
assert.equal(migrated.preferences.reducedMotion, true);

localStorage.setItem("zenchad_app_data_v1", JSON.stringify({
  ...defaultData,
  zenPoints: 9.8,
  lifetimeZenPoints: -4
}));
const normalized = loadData();
assert.equal(normalized.zenPoints, 9);
assert.equal(normalized.lifetimeZenPoints, 0);

const partiallyMigrated = { ...defaultData, zenPoints: 12 };
delete partiallyMigrated.lifetimeZenPoints;
localStorage.setItem("zenchad_app_data_v1", JSON.stringify(partiallyMigrated));
assert.equal(loadData().lifetimeZenPoints, 12, "a partially migrated save preserves current points as lifetime progress");

const completed = recordMeditationCompletion({ ...defaultData }, "nsdr", 600);
assert.equal(completed.zenPoints, 15);
assert.equal(completed.lifetimeZenPoints, 15);
assert.equal(completed.stats.xp, 150);

console.log("ZenPoints tests passed");
