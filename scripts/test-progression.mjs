import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  awardStrengthProgress,
  awardMeditationProgress,
  createDefaultProgression,
  flowXpForNextLevel,
  getStatLevelProgress,
  skillLevelForXp,
  skillXpForLevel,
  statXpForLevel,
  strengthXpForWorkout
} from "../src/progression.ts";
import { migrateProgressionData } from "../src/storage.ts";

const dayOne = new Date("2026-01-01T12:00:00");
const dayTwo = new Date("2026-01-02T12:00:00");
const dayFour = new Date("2026-01-04T12:00:00");

let progression = createDefaultProgression();
assert.equal(progression.flowLevel, 1);
assert.equal(progression.flowXp, 0);
assert.equal(progression.skillLevels.focus, 1);
assert.equal(progression.skillLevels.strength, 1);
assert.equal(progression.version, 2);

progression = awardMeditationProgress(progression, "focused-attention", 60, dayOne);
assert.equal(progression.flowXp, 34, "first practice includes the daily bonus");
assert.equal(progression.flowConsecutiveDays, 1);
assert.equal(progression.skillXp.focus, 25, "the first primary practice advances one level and carries visible XP");
assert.equal(progression.skillLevels.focus, 2);
assert.equal(progression.skillXp.discipline, 10);
assert.equal(getStatLevelProgress("focus", progression.skillXp.focus).progressPercent, 25);

progression = awardMeditationProgress(progression, "focused-attention", 60, dayOne);
assert.equal(progression.flowXp, 41, "same-day practice receives the smaller reward");
assert.equal(progression.skillLevels.focus, 3);

progression = awardMeditationProgress(progression, "focused-attention", 60, dayOne);
assert.equal(progression.skillLevels.focus, 4);

progression = awardMeditationProgress(progression, "focused-attention", 60, dayOne);
assert.equal(progression.skillLevels.focus, 5, "four primary practices reach level five");

progression = awardMeditationProgress(progression, "focused-attention", 60, dayOne);
assert.equal(progression.skillLevels.focus, 5, "progression becomes harder after the opening levels");

progression = awardMeditationProgress(progression, "focused-attention", 60, dayTwo);
assert.equal(progression.flowConsecutiveDays, 2);
assert.equal(progression.flowXp, 98, "a consecutive new day receives the streak bonus");

progression = awardMeditationProgress(progression, "focused-attention", 60, dayFour);
assert.equal(progression.flowConsecutiveDays, 1, "a missed day resets only the consistency counter");
assert.ok(progression.flowTotalXp > 98, "missed days do not delete Flow XP");

const levelTwoThreshold = skillXpForLevel(2);
assert.equal(levelTwoThreshold, 20);
assert.equal(skillLevelForXp(levelTwoThreshold - 1), 1);
assert.equal(skillLevelForXp(levelTwoThreshold), 2);
assert.equal(skillXpForLevel(5), 80);
assert.equal(skillXpForLevel(6), 140);
assert.equal(statXpForLevel("strength", 2), 60);
assert.equal(statXpForLevel("strength", 3), 150);
assert.equal(strengthXpForWorkout(30 * 60), 30);
assert.equal(strengthXpForWorkout(4 * 60 * 60), 120, "very long workouts are capped");

let strengthProgression = awardStrengthProgress(createDefaultProgression(), 30 * 60);
assert.equal(strengthProgression.skillXp.strength, 30);
assert.equal(strengthProgression.skillLevels.strength, 1);
strengthProgression = awardStrengthProgress(strengthProgression, 30 * 60);
assert.equal(strengthProgression.skillLevels.strength, 2);

const legacy = createDefaultProgression();
delete legacy.version;
legacy.skillXp.focus = 152.5;
legacy.skillLevels.focus = 2;
const migrated = migrateProgressionData(legacy);
assert.equal(migrated.version, 2);
assert.equal(migrated.skillLevels.focus, 2, "migration preserves the old stat level");
assert.equal(migrated.skillXp.focus, 30, "migration preserves half of the progress within the old level");
assert.equal(migrated.skillXp.strength, 0);
assert.equal(flowXpForNextLevel(1), 120);

const root = process.cwd();
const source = (file) => fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
assert.match(source("src/screens/RunningModeScreen.tsx"), /awardStrengthProgress\(currentData\.progression, durationSeconds\)/, "banking a run must award Strength once from active duration");
assert.match(source("src/screens/BikeQuestScreen.tsx"), /awardStrengthProgress\(currentData\.progression, seconds\)/, "ending a Bike Quest ride must award Strength once from ride duration");
assert.match(source("src/screens/ProgressScreen.tsx"), /status-stat-xp-track/, "every stat must render visible within-level XP");
assert.match(source("src/App.tsx"), /persistent-settings-trigger/, "Settings must remain available in the global header");
assert.match(source("src/App.tsx"), /persistent-experience-hud/, "Level and XP must remain available in the global header");

console.log("Progression checks passed");
