import assert from "node:assert/strict";
import {
  awardMeditationProgress,
  createDefaultProgression,
  flowXpForNextLevel,
  skillLevelForXp,
  skillXpForLevel
} from "../src/progression.ts";

const dayOne = new Date("2026-01-01T12:00:00");
const dayTwo = new Date("2026-01-02T12:00:00");
const dayFour = new Date("2026-01-04T12:00:00");

let progression = createDefaultProgression();
assert.equal(progression.flowLevel, 1);
assert.equal(progression.flowXp, 0);
assert.equal(progression.skillLevels.focus, 1);

progression = awardMeditationProgress(progression, "focused-attention", 60, dayOne);
assert.equal(progression.flowXp, 34, "first practice includes the daily bonus");
assert.equal(progression.flowConsecutiveDays, 1);
assert.equal(progression.skillXp.focus, 18.35);
assert.equal(progression.skillXp.discipline, 8.175);

progression = awardMeditationProgress(progression, "focused-attention", 60, dayOne);
assert.equal(progression.flowXp, 41, "same-day practice receives the smaller reward");

progression = awardMeditationProgress(progression, "focused-attention", 60, dayTwo);
assert.equal(progression.flowConsecutiveDays, 2);
assert.equal(progression.flowXp, 77, "a consecutive new day receives the streak bonus");

progression = awardMeditationProgress(progression, "focused-attention", 60, dayFour);
assert.equal(progression.flowConsecutiveDays, 1, "a missed day resets only the consistency counter");
assert.ok(progression.flowTotalXp > 77, "missed days do not delete Flow XP");

const levelTwoThreshold = skillXpForLevel(2);
assert.equal(levelTwoThreshold, 90);
assert.equal(skillLevelForXp(levelTwoThreshold - 1), 1);
assert.equal(skillLevelForXp(levelTwoThreshold), 2);
assert.equal(flowXpForNextLevel(1), 120);

console.log("Progression checks passed");
