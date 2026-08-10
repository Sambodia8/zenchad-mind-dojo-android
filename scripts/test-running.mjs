import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();

function loadTsModule(relativePath) {
  const filename = path.join(root, relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  }).outputText;
  const module = { exports: {} };
  const localRequire = (specifier) => {
    throw new Error(`Unexpected runtime import ${specifier} while testing ${relativePath}`);
  };
  new Function("exports", "module", "require", output)(module.exports, module, localRequire);
  return module.exports;
}

const story = loadTsModule("src/runningStory.ts");
const routes = loadTsModule("src/runningRouteDirector.ts");
const progression = loadTsModule("src/runningProgression.ts");

// Chase placement: only the explicitly agreed sudden-acceleration blockers are hard gates.
for (const context of [
  { atJunction: true },
  { atRoadCrossing: true },
  { onSteepDescent: true },
  { onStairs: true },
  { anchor: { kind: "junction" } },
  { anchor: { kind: "road-crossing" } },
  { anchor: { kind: "steep-descent" } },
  { anchor: { kind: "stairs" } }
]) {
  assert.equal(story.canTriggerChase(context), false, `chase should be blocked for ${JSON.stringify(context)}`);
}
assert.equal(story.canTriggerChase({ anchor: { kind: "open" } }), true);
assert.equal(story.canTriggerChase({ anchor: { kind: "cover" } }), true);

// Chase performance changes the fiction, never subtracts running XP.
assert.deepEqual(story.evaluateChase(3, 3).xpPenalty, 0);
assert.equal(story.evaluateChase(3, 3).kind, "escaped");
assert.equal(story.evaluateChase(3, 2.5).kind, "pressure");
assert.equal(story.evaluateChase(3, 1.5).kind, "caught-branch");
for (const achieved of [0.5, 1.8, 2.8, 4]) {
  assert.equal(story.evaluateChase(3, achieved).xpPenalty, 0);
}

const targetContext = {
  recentSpeedMps: 2.5,
  elapsedRunSeconds: 500,
  plannedRunSeconds: 1800,
  previousChases: []
};
const casual = story.chaseTarget({ ...targetContext, difficulty: "casual" });
const standard = story.chaseTarget({ ...targetContext, difficulty: "standard" });
const intense = story.chaseTarget({ ...targetContext, difficulty: "intense" });
assert.ok(casual.targetSpeedMps < standard.targetSpeedMps);
assert.ok(standard.targetSpeedMps < intense.targetSpeedMps);
const lateTarget = story.chaseTarget({ ...targetContext, difficulty: "standard", elapsedRunSeconds: 1650 });
assert.ok(lateTarget.increaseFraction <= standard.increaseFraction, "late-run chase should not demand a bigger surge");

const cover = story.chooseCoverAnchor([
  { id: "too-close", kind: "cover", distanceMeters: 50, confidence: 1 },
  { id: "uncertain", kind: "cover", distanceMeters: 400, confidence: 0.4 },
  { id: "good", kind: "cover", distanceMeters: 520, confidence: 0.9 }
], 100);
assert.equal(cover?.id, "good");
assert.equal(story.routeAnchorAllowsShortcut({ id: "x", kind: "neutral", distanceMeters: 0, confidence: 0.79 }), false);
assert.equal(story.routeAnchorAllowsShortcut({ id: "x", kind: "neutral", distanceMeters: 0, confidence: 0.8 }), true);
let budget = story.createStoryDirectorBudget(2);
budget = story.reserveStoryAiCall(budget);
assert.equal(budget.usedCalls, 1);
budget = story.reserveStoryAiCall(budget);
assert.equal(budget.usedCalls, 2);
assert.equal(story.reserveStoryAiCall(budget), null, "AI call budget must be a hard ceiling");

function candidate(overrides = {}) {
  return {
    id: "route",
    geometry: [{ lat: 1, lng: 1 }, { lat: 1.001, lng: 1.001 }],
    estimatedMinutes: 30,
    distanceMeters: 4000,
    endsNearStart: true,
    endDistanceFromStartMeters: 100,
    noveltyScore: 0.5,
    interestScore: 0.5,
    familiarityScore: 0.5,
    gameOpportunityScore: 0.5,
    routeConfidence: 0.9,
    uncertainShortcutCount: 0,
    ...overrides
  };
}

assert.equal(routes.routeCandidateIsUsable(candidate({ uncertainShortcutCount: 1 })), false, "uncertain shortcuts must be rejected");
assert.equal(routes.routeCandidateIsUsable(candidate()), true);
const familiar = candidate({ id: "familiar", noveltyScore: 0.15, familiarityScore: 0.95, gameOpportunityScore: 0.25 });
const novelGame = candidate({ id: "novel", noveltyScore: 0.95, familiarityScore: 0.1, gameOpportunityScore: 0.95 });
assert.equal(routes.chooseRunningRoute([familiar, novelGame], { mode: "story", plannedMinutes: 30, start: { lat: 1, lng: 1 } }).candidate.id, "novel");
assert.equal(routes.chooseRunningRoute([familiar, novelGame], { mode: "quick", plannedMinutes: 30, start: { lat: 1, lng: 1 } }).candidate.id, "familiar");
assert.equal(routes.offRouteInstruction("quick"), "reroute-silently");
assert.match(routes.offRouteInstruction("story"), /Change of plan/i);

// Streaks are bonus-only and do not erase the historical best after a gap.
let streak = { currentDays: 0, bestDays: 0, lastRunDay: null };
streak = progression.updateRunningStreak(streak, new Date("2026-08-01T12:00:00Z").getTime());
streak = progression.updateRunningStreak(streak, new Date("2026-08-02T12:00:00Z").getTime());
streak = progression.updateRunningStreak(streak, new Date("2026-08-03T12:00:00Z").getTime());
assert.equal(streak.currentDays, 3);
assert.equal(streak.bestDays, 3);
streak = progression.updateRunningStreak(streak, new Date("2026-08-06T12:00:00Z").getTime());
assert.equal(streak.currentDays, 1);
assert.equal(streak.bestDays, 3);
assert.equal(progression.runningStreakMultiplier(1), 1);
assert.equal(progression.runningStreakMultiplier(100), 1.5);

function runPoints(startAt) {
  return Array.from({ length: 14 }, (_, index) => ({
    lat: 53 + index * 0.00045,
    lng: -2.4,
    accuracy: 5,
    at: startAt + index * 30_000,
    distanceFromStart: index * 100
  }));
}

const baseState = {
  version: 1,
  processedRunIds: [],
  streak: { currentDays: 0, bestDays: 0, lastRunDay: null },
  achievements: [],
  sectors: []
};
const runOne = {
  id: "run-1",
  mode: "quick",
  endedAt: new Date("2026-08-01T12:30:00Z").getTime(),
  distanceMeters: 1300,
  completionRatio: 1,
  personalBestKeys: [],
  points: runPoints(new Date("2026-08-01T12:00:00Z").getTime())
};
const runTwo = {
  ...runOne,
  id: "run-2",
  endedAt: new Date("2026-08-02T12:30:00Z").getTime(),
  points: runPoints(new Date("2026-08-02T12:00:00Z").getTime())
};
let progressState = progression.processRunningRecord(baseState, runOne, [runOne]);
assert.equal(progressState.sectors.some((sector) => sector.discovered), false);
progressState = progression.processRunningRecord(progressState, runTwo, [runOne, runTwo]);
assert.equal(progressState.sectors.some((sector) => sector.discovered), true, "repeated real-world stretches should become Runner Sectors");

console.log("Running logic tests passed.");
