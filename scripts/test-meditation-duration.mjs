import assert from "node:assert/strict";
import { MEDITATIONS } from "../src/data.ts";
import { fiveMinuteMeditation } from "../src/meditationDuration.ts";

for (const meditation of MEDITATIONS) {
  const original = JSON.stringify(meditation);
  const shortened = fiveMinuteMeditation(meditation);
  assert.equal(shortened.phases.reduce((sum, phase) => sum + phase.duration, 0), 300, meditation.id);
  assert.ok(shortened.phases.every((phase) => Number.isInteger(phase.duration) && phase.duration > 0), meditation.id);
  assert.deepEqual(shortened.phases.map((phase) => phase.instruction), meditation.phases.map((phase) => phase.instruction));
  assert.equal(shortened.phases.at(-1).kind, meditation.phases.at(-1).kind);
  assert.equal(JSON.stringify(meditation), original, "Full-length sessions must stay unchanged");
}
console.log(`Five-minute timing verified for all ${MEDITATIONS.length} meditations.`);
