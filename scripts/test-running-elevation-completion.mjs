import assert from "node:assert/strict";
const stored = new Map();
globalThis.localStorage = {
  getItem(key) { return stored.get(key) ?? null; },
  setItem(key, value) { stored.set(key, value); },
  removeItem(key) { stored.delete(key); }
};
let fetchCount = 0;
globalThis.fetch = async () => { fetchCount++; throw new Error("No network expected"); };
const { enrichRunElevation, loadRunElevation } = await import("../src/runningElevation.ts");
for (const points of [[], [{ lat: 51.5, lng: -0.1, at: 1000, accuracy: 10 }]]) {
  const id = `no-gps-${points.length}`;
  const record = { id, points };
  const insight = await enrichRunElevation(record, "https://invalid.local");
  assert.equal(insight.status, "unavailable", "GPS-limited runs have a terminal enrichment result");
  assert.deepEqual(loadRunElevation(id), insight, "completion can read the saved unavailable result");
  const repeated = await enrichRunElevation(record, "https://invalid.local");
  assert.deepEqual(repeated, insight, "a re-render cannot restart unavailable enrichment");
}
assert.equal(fetchCount, 0);
console.log("Running completion with missing or insufficient GPS caches unavailable elevation without retries.");
