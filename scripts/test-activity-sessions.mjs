import assert from "node:assert/strict";
import { appendActivitySession, defaultData, loadData, migrateActivitySessions, recordMeditationCompletion, recordPracticeCompletion, saveData } from "../src/storage.ts";
import { captureSyncEnvelope, mergeSyncEnvelopes, parseSyncEnvelope, serialiseSyncEnvelope } from "../src/sync.ts";

class MemoryStorage {
  values = new Map();
  get length() { return this.values.size; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
  key(index) { return [...this.values.keys()][index] ?? null; }
}
const store = new MemoryStorage();
globalThis.localStorage = store;
const date = new Date("2026-10-05T10:00:00.000Z");
const receipt = { id: "session-1", kind: "meditation", completedAt: date.toISOString(), seconds: 600 };
assert.deepEqual(migrateActivitySessions(undefined), []);
assert.deepEqual(migrateActivitySessions([{ ...receipt, completedAt: "2026-02-30T10:00:00Z" }, { ...receipt, completedAt: "2026-10-05T10:00:00" }]), [], "invalid days and timestamps without a timezone are not genuine receipts");
assert.deepEqual(migrateActivitySessions([receipt, receipt, { ...receipt, id: "bad", seconds: -1 }, { ...receipt, id: "bad-date", completedAt: "yesterday" }, { ...receipt, id: "bad-kind", kind: "unknown" }, { id: "missing-time", kind: "yoga", seconds: 600 }]), [receipt]);

const recorded = recordMeditationCompletion(structuredClone(defaultData), "nsdr", 600, date, receipt.id);
assert.deepEqual(recorded.activitySessions, [receipt]);
assert.equal(recordMeditationCompletion(recorded, "nsdr", 600, date, receipt.id), recorded, "replaying the same session must not award XP or currency again");
const yoga = { ...receipt, kind: "yoga", seconds: 1200 };
const yogaRecorded = appendActivitySession(recorded, yoga);
assert.equal(yogaRecorded.activitySessions.length, 2, "receipt IDs are scoped by activity kind");
assert.equal(appendActivitySession(yogaRecorded, yoga), yogaRecorded);
assert.equal(appendActivitySession(yogaRecorded, { ...yoga, id: "invalid", completedAt: "" }), yogaRecorded);
saveData(yogaRecorded);
assert.deepEqual(loadData().activitySessions, yogaRecorded.activitySessions);
store.setItem("zenchad_app_data_v1", JSON.stringify({ stats: { sessionsCompleted: 8, totalSeconds: 8000 } }));
assert.deepEqual(loadData().activitySessions, [], "legacy totals cannot invent dated sessions");

const practice = recordPracticeCompletion(structuredClone(defaultData), { id: "silent", preset: "free", mode: "countdown", status: "completed", elapsedSeconds: 600, targetSeconds: 600, completedAt: date.toISOString() });
assert.equal(practice.practiceSessions.length, 1);
assert.deepEqual(practice.activitySessions, [], "silent practice already has its own receipt");

const local = captureSyncEnvelope(recorded, store, date);
const remote = captureSyncEnvelope({ ...defaultData, activitySessions: [yoga, { ...receipt, id: "session-2" }] }, store, new Date(date.getTime() + 1000));
const merged = mergeSyncEnvelopes(local, remote).envelope;
assert.equal(merged.data.activitySessions.length, 3);
assert.equal(mergeSyncEnvelopes(merged, remote).envelope.data.activitySessions.length, 3, "repeat sync must deduplicate receipts");
assert.deepEqual(parseSyncEnvelope(serialiseSyncEnvelope(merged)).data.activitySessions, merged.data.activitySessions);
const legacy = JSON.parse(serialiseSyncEnvelope(remote));
delete legacy.data.activitySessions;
assert.deepEqual(parseSyncEnvelope(JSON.stringify(legacy)).data.activitySessions, []);
assert.equal(mergeSyncEnvelopes(merged, parseSyncEnvelope(JSON.stringify(legacy))).envelope.data.activitySessions.length, 3);
console.log("Activity receipt validation, migration, persistence, reward idempotency and sync checks passed.");
