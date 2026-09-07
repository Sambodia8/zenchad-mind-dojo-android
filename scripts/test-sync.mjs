import assert from "node:assert/strict";
import {
  captureSyncEnvelope,
  mergeSyncEnvelopes,
  parseSyncEnvelope,
  serialiseSyncEnvelope
} from "../src/sync.ts";
import { defaultData } from "../src/storage.ts";

class MemoryStorage {
  values = new Map();
  get length() { return this.values.size; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
  key(index) { return [...this.values.keys()][index] ?? null; }
}

const storage = new MemoryStorage();
storage.setItem("zenchad_running_profile_v1", JSON.stringify({ version: 1, history: [{ id: "run-1", endedAt: 100 }] }));
storage.setItem("zenchad_active_timer_v1", JSON.stringify({ elapsed: 20 }));
storage.setItem("zenchad_last_guided_variant_v1", JSON.stringify({ foo: "bar" }));

const local = captureSyncEnvelope({
  ...defaultData,
  journal: [{ id: "journal-1", createdAt: "2026-08-15T10:00:00.000Z", title: "One", body: "Local" }]
}, storage, new Date("2026-08-15T10:00:00.000Z"));
const incoming = captureSyncEnvelope({
  ...defaultData,
  moods: [{ id: "mood-1", createdAt: "2026-08-15T11:00:00.000Z", stage: "before", value: 4, note: "Cloud" }],
  journal: [{ id: "journal-2", createdAt: "2026-08-15T11:00:00.000Z", title: "Two", body: "Remote" }],
  stats: { ...defaultData.stats, xp: 500, weeklySeconds: { "2026-08-15": 40 } }
}, storage, new Date("2026-08-15T11:00:00.000Z"));

const merged = mergeSyncEnvelopes(local, incoming).envelope;
assert.deepEqual(merged.data.journal.map((item) => item.id).sort(), ["journal-1", "journal-2"]);
assert.equal(merged.data.moods[0].id, "mood-1");
assert.equal(merged.data.stats.xp, 500);
assert.equal(merged.data.stats.weeklySeconds["2026-08-15"], 40);
assert.ok(merged.durableStores["zenchad_running_profile_v1"]);
assert.equal(merged.durableStores["zenchad_active_timer_v1"], undefined);

const roundTrip = parseSyncEnvelope(serialiseSyncEnvelope(merged));
assert.deepEqual(roundTrip.data.journal, merged.data.journal);
assert.throws(() => parseSyncEnvelope("{}"), /not a supported/i);

console.log("Sync envelope and merge checks passed");
