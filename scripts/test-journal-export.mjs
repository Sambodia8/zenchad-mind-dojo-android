import assert from "node:assert/strict";
import { chronologicalJournal, serialiseJournal } from "../src/journalOrder.ts";
import { importJournalText } from "../src/storage.ts";

const rows = [
  { id: "old", createdAt: "2026-09-01T12:00:00Z", title: "Backdated", body: "First\nSecond", kind: "journal" },
  { id: "new", createdAt: "2026-09-24T10:00:00+01:00", title: "Today", body: "Quotes: \"hello\" — café 🧘", kind: "meditation", meditation: "NSDR" },
  { id: "invalid", createdAt: "unknown", title: "Legacy", body: "Still keep me", kind: "journal" },
  { id: "middle", createdAt: "2026-09-24T08:30:00Z", title: "Earlier today", body: "a".repeat(2000), kind: "journal" }
];
const original = JSON.stringify(rows);
assert.deepEqual(chronologicalJournal(rows).map(r => r.id), ["new", "middle", "old", "invalid"]);
assert.equal(JSON.stringify(rows), original, "Sorting must not mutate stored entries");
const exported = JSON.parse(serialiseJournal(rows));
assert.equal(exported.length, rows.length);
for (const row of rows) assert.deepEqual(exported.find(r => r.id === row.id), row);
const imported = importJournalText(serialiseJournal(rows));
assert.deepEqual(imported.map(r => [r.title,r.body,r.createdAt,r.meditation]), exported.map(r => [r.title,r.body,r.createdAt,r.meditation]));
assert.equal(serialiseJournal([]), "[]");
console.log("Journal chronological order, timezone ordering, Unicode/full-text export and import round-trip passed.");
