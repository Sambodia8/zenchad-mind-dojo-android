import assert from "node:assert/strict";

process.env.TZ = "America/New_York";
globalThis.localStorage = {
  value: null,
  getItem() { return this.value; },
  setItem(_key, value) { this.value = value; },
  removeItem() { this.value = null; }
};

const {
  defaultData,
  loadData,
  recordMeditationCompletionWithResult
} = await import("../src/storage.ts");
const { createDefaultProgression } = await import("../src/progression.ts");

const atNoon = (year, month, day) => new Date(year, month - 1, day, 12, 0, 0);
const withStreak = (lastSessionDate, streak, freezes) => ({
  ...defaultData,
  stats: { ...defaultData.stats, lastSessionDate, streak },
  progression: {
    ...createDefaultProgression(),
    flowLastPracticeDate: lastSessionDate,
    flowConsecutiveDays: streak
  },
  shopInventory: freezes > 0 ? { "streak-freeze": freezes } : {}
});
const complete = (data, date) => recordMeditationCompletionWithResult(data, "focused-attention", 600, date);

let first = complete(withStreak(null, 0, 2), atNoon(2026, 1, 1));
let sameDay = complete(first.data, new Date(2026, 0, 1, 20, 0, 0));
assert.equal(sameDay.data.stats.streak, 1, "same-day sessions do not change the streak");
assert.equal(sameDay.data.shopInventory["streak-freeze"], 2, "same-day sessions do not consume inventory");
assert.equal(sameDay.streakFreezeUse, null);

let oneMissed = complete(withStreak("2026-01-01", 4, 2), atNoon(2026, 1, 3));
assert.equal(oneMissed.data.stats.streak, 5, "one missed day preserves and advances the meditation streak");
assert.equal(oneMissed.data.progression.flowConsecutiveDays, 5, "Flow consistency is preserved too");
assert.equal(oneMissed.data.shopInventory["streak-freeze"], 1, "exactly one freeze is consumed");
assert.equal(oneMissed.streakFreezeUse?.missedDate, "2026-01-02");
assert.equal(oneMissed.data.pendingStreakFreezeNotice?.remaining, 1, "consumption is persisted for visible feedback");

const secondSameDay = complete(oneMissed.data, new Date(2026, 0, 3, 18, 0, 0));
assert.equal(secondSameDay.data.shopInventory["streak-freeze"], 1, "a second session cannot consume another freeze");
assert.equal(secondSameDay.streakFreezeUse, null);

const multipleMissed = complete(withStreak("2026-01-01", 4, 2), atNoon(2026, 1, 4));
assert.equal(multipleMissed.data.stats.streak, 1, "multiple missed days reset the streak");
assert.equal(multipleMissed.data.shopInventory["streak-freeze"], 2, "multiple missed days do not waste a freeze");

const exhausted = complete(withStreak("2026-01-01", 4, 0), atNoon(2026, 1, 3));
assert.equal(exhausted.data.stats.streak, 1, "an exhausted inventory cannot preserve the streak");
assert.equal(exhausted.streakFreezeUse, null);

const historical = complete(withStreak("2026-01-10", 6, 2), atNoon(2026, 1, 8));
assert.equal(historical.data.stats.lastSessionDate, "2026-01-10", "historical entries cannot move the latest date backwards");
assert.equal(historical.data.stats.streak, 6, "historical entries do not reset the current streak");
assert.equal(historical.data.progression.flowLastPracticeDate, "2026-01-10");
assert.equal(historical.data.progression.flowConsecutiveDays, 6);
assert.equal(historical.data.shopInventory["streak-freeze"], 2, "historical entries never consume freezes");

const monthBoundary = complete(withStreak("2026-01-30", 2, 1), atNoon(2026, 2, 1));
assert.equal(monthBoundary.streakFreezeUse?.missedDate, "2026-01-31");
assert.equal(monthBoundary.data.stats.streak, 3);

const yearBoundary = complete(withStreak("2026-12-30", 2, 1), atNoon(2027, 1, 1));
assert.equal(yearBoundary.streakFreezeUse?.missedDate, "2026-12-31");
assert.equal(yearBoundary.data.stats.streak, 3);

const beforeDst = atNoon(2026, 3, 7);
const afterDst = atNoon(2026, 3, 9);
assert.equal((afterDst.getTime() - beforeDst.getTime()) / 3_600_000, 47, "fixture crosses the spring DST change");
const dstSensitive = complete(withStreak("2026-03-07", 3, 1), afterDst);
assert.equal(dstSensitive.streakFreezeUse?.missedDate, "2026-03-08", "local dates, not elapsed hours, control eligibility");
assert.equal(dstSensitive.data.stats.streak, 4);

const legacy = { ...defaultData, shopInventory: { "streak-freeze": 3 } };
delete legacy.pendingStreakFreezeNotice;
localStorage.setItem("zenchad_app_data_v1", JSON.stringify(legacy));
const migrated = loadData();
assert.equal(migrated.pendingStreakFreezeNotice, null, "older saves receive a safe notice default");
assert.equal(migrated.shopInventory["streak-freeze"], 3, "existing consumable inventory survives migration");

console.log("Streak Freeze tests passed");
